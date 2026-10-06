const MAX_ORIGINAL_BYTES = 20 * 1024 * 1024;
const READ_TIMEOUT_MS = 20_000;
const originalReads = new Map();

function text(value) {
  return typeof value === "string" && value.trim() && value.trim() !== "0"
    ? value.trim()
    : null;
}

function number(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim()) {
    const parts = value.trim().split("/");
    if (parts.length === 2) return number(parts);
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (Array.isArray(value) && value.length === 2) {
    const numerator = number(value[0]);
    const denominator = number(value[1]);
    return numerator !== null && denominator !== null && denominator !== 0
      ? numerator / denominator
      : null;
  }
  if (
    value &&
    typeof value === "object" &&
    "numerator" in value &&
    "denominator" in value
  ) {
    return number([value.numerator, value.denominator]);
  }
  return null;
}

function positive(...values) {
  return (
    values.map(number).find((value) => value !== null && value > 0) ?? null
  );
}

function decimal(value, digits = 2) {
  return Number(value.toFixed(digits)).toString();
}

function exposure(seconds) {
  if (seconds === null) return null;
  const denominator = Math.round(1 / seconds);
  if (
    seconds < 1 &&
    denominator > 1 &&
    Math.abs(seconds * denominator - 1) < 0.002
  )
    return `1/${denominator} s`;
  return `${decimal(seconds, 5)} s`;
}

function captureDate(exif, wpMeta) {
  const recorded = text(exif.DateTimeOriginal);
  if (recorded) {
    const match = recorded.match(
      /^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:\s*(Z|[+-]\d{2}:?\d{2}))?$/,
    );
    if (match) {
      const [, year, month, day, hour, minute, second, zone] = match;
      const check = new Date(
        Date.UTC(
          Number(year),
          Number(month) - 1,
          Number(day),
          Number(hour),
          Number(minute),
          Number(second),
        ),
      );
      if (
        Number(year) >= 1900 &&
        check.getUTCFullYear() === Number(year) &&
        check.getUTCMonth() + 1 === Number(month) &&
        check.getUTCDate() === Number(day) &&
        Number(hour) < 24 &&
        Number(minute) < 60 &&
        Number(second) < 60
      ) {
        const offset = zone || text(exif.OffsetTimeOriginal);
        const suffix =
          offset && /^(Z|[+-](?:0\d|1[0-4]):?[0-5]\d)$/.test(offset)
            ? ` ${offset}`
            : "";
        return `${year}-${month}-${day} ${hour}:${minute}:${second}${suffix}`;
      }
    }
  }
  // WordPress image_meta.created_timestamp comes from the photograph's EXIF,
  // unlike the attachment's upload date. Keep its recorded clock without
  // inventing a timezone when the original EXIF did not include one.
  const timestamp = positive(wpMeta.created_timestamp);
  if (timestamp === null) return null;
  const date = new Date(timestamp * 1000);
  return Number.isFinite(date.getTime())
    ? date.toISOString().slice(0, 19).replace("T", " ")
    : null;
}

function coordinate(value, reference, directions) {
  const ref = text(reference)?.toUpperCase();
  if (!ref || !directions.includes(ref)) return null;
  const parts = Array.isArray(value) ? value.map(number) : null;
  const degrees =
    parts?.length === 3 &&
    parts.every((part) => part !== null && part >= 0) &&
    parts[1] < 60 &&
    parts[2] < 60
      ? parts[0] + parts[1] / 60 + parts[2] / 3600
      : number(value);
  return degrees === null
    ? null
    : Math.abs(degrees) * (ref === "S" || ref === "W" ? -1 : 1);
}

function gpsLocation(exif) {
  const latitude =
    number(exif.latitude) ??
    coordinate(exif.GPSLatitude, exif.GPSLatitudeRef, ["N", "S"]);
  const longitude =
    number(exif.longitude) ??
    coordinate(exif.GPSLongitude, exif.GPSLongitudeRef, ["E", "W"]);
  if (
    latitude === null ||
    longitude === null ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  )
    return null;
  return {
    latitude,
    longitude,
    label: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
    precision: "gps",
    source: "exif",
  };
}

/**
 * EXIF wins; WordPress image_meta fills only missing fields. Display strings
 * and location are null when absent. No attachment/upload date is consulted.
 * DateTimeOriginal is a camera clock unless EXIF recorded an explicit offset.
 */
export function normalizePhotoMetadata(photo, exif = {}, readStatus = "read") {
  const wpMeta = photo.wpMeta || {};
  const model = text(exif.Model);
  const make = text(exif.Make);
  const camera = model
    ? make && !model.toLowerCase().startsWith(make.split(" ")[0].toLowerCase())
      ? `${make} ${model}`
      : model
    : text(wpMeta.camera) || make;
  const aperture = positive(exif.FNumber, wpMeta.aperture);
  const focalLength = positive(exif.FocalLength, wpMeta.focal_length);
  const iso = positive(
    exif.ISO,
    exif.ISOSpeed,
    exif.ISOSpeedRatings,
    exif.PhotographicSensitivity,
    wpMeta.iso,
  );
  const result = {
    camera,
    lens: text(exif.LensModel) || text(exif.Lens) || text(wpMeta.lens),
    aperture: aperture === null ? null : `ƒ/${decimal(aperture)}`,
    focalLength: focalLength === null ? null : `${decimal(focalLength)} mm`,
    iso: iso === null ? null : decimal(iso),
    shutter: exposure(positive(exif.ExposureTime, wpMeta.shutter_speed)),
    capturedAt: captureDate(exif, wpMeta),
    location: gpsLocation(exif),
  };
  const hasMetadata = Object.values(result).some((value) => value !== null);
  const scanned = readStatus === "read" || readStatus === "empty";
  return {
    ...result,
    status: hasMetadata
      ? scanned
        ? "available"
        : "partial"
      : scanned
        ? "empty"
        : "unavailable",
    readStatus,
  };
}

function readFailure(reason) {
  return Object.assign(new Error(reason), { metadataReason: reason });
}

async function readOriginal(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), READ_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      credentials: "same-origin",
      redirect: "error",
    });
    if (!response.ok) throw readFailure("failed");
    const size = Number(response.headers.get("content-length"));
    if (size > MAX_ORIGINAL_BYTES) throw readFailure("too-large");
    const reader = response.body?.getReader();
    // Browsers without a streaming body cannot enforce a safe byte limit.
    if (!reader) throw readFailure("unsupported");
    const chunks = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_ORIGINAL_BYTES) throw readFailure("too-large");
        chunks.push(value);
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
    const heif =
      bytes.length >= 12 &&
      String.fromCharCode(...bytes.subarray(4, 8)) === "ftyp";
    // The bundled browser reader supports JPEG and HEIF (including AVIF).
    if (!jpeg && !heif) throw readFailure("unsupported");
    const { parse } = await import("./assets/exifr.mjs");
    const exif = await parse(bytes, {
      reviveValues: false,
      xmp: false,
      makerNote: false,
      userComment: false,
      ifd1: false,
    });
    return { exif: exif || {}, readStatus: exif ? "read" : "empty" };
  } catch (error) {
    return {
      exif: {},
      readStatus: controller.signal.aborted
        ? "timeout"
        : error.metadataReason || "failed",
    };
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
}

/**
 * Read the same-origin original once per page session, bounded to 20 MiB / 20 s.
 * Input: { wpMeta, originalSrc, src }. Other photograph fields are untouched.
 * Failures return the usable WordPress metadata with an honest partial status.
 */
export async function readPhotoMetadata(photo) {
  const original = photo.originalSrc || photo.src;
  if (!original) return normalizePhotoMetadata(photo, {}, "no-original");
  let url;
  try {
    url = new URL(original, window.location.href);
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.origin !== window.location.origin ||
      url.username ||
      url.password
    ) {
      return normalizePhotoMetadata(photo, {}, "cross-origin");
    }
  } catch {
    return normalizePhotoMetadata(photo, {}, "no-original");
  }
  if (!originalReads.has(url.href))
    originalReads.set(url.href, readOriginal(url.href));
  const { exif, readStatus } = await originalReads.get(url.href);
  return normalizePhotoMetadata(photo, exif, readStatus);
}
