import { sortPhotosNewestFirst } from "../lib/photo-dates.js";
import type { Photo, PhotoLocation, WpMedia } from "./types";

export async function loadPhotoMedia(origin = "", signal?: AbortSignal): Promise<WpMedia[]> {
  const params = new URLSearchParams({
    media_type: "image",
    per_page: "100",
    orderby: "date",
    order: "desc",
    _fields: "id,source_url,media_details,title,caption,description,alt_text,date,date_gmt",
  });
  // Public WordPress reads must not wait for a Zero session or realtime connection.
  const response = await fetch(`${origin}/wp-json/wp/v2/media?${params}`, {
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) throw new Error("Could not load photographs.");
  const media: WpMedia[] = await response.json();
  if (!Array.isArray(media) || media.some((item) =>
    !item || !Number.isInteger(item.id) || typeof item.source_url !== "string")) {
    throw new Error("Invalid photograph list.");
  }
  return media;
}

export function plainText(value: unknown): string {
  return (
    new DOMParser().parseFromString(String(value || ""), "text/html").body.textContent?.trim() || ""
  );
}

export function safeUrl(value: unknown, base = window.location.origin): string | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const url = new URL(value, base);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function photoNote(value: unknown): string {
  const body = new DOMParser().parseFromString(String(value || ""), "text/html").body;
  body
    .querySelectorAll("p.attachment, script, style, iframe, object")
    .forEach((node) => node.remove());
  const breaks = [...body.querySelectorAll("br")];
  for (const node of breaks) {
    if (node.previousSibling?.nodeType === Node.TEXT_NODE) {
      node.previousSibling.textContent =
        node.previousSibling.textContent?.replace(/[ \t\r\n]+$/, "") || "";
    }
    if (node.nextSibling?.nodeType === Node.TEXT_NODE) {
      node.nextSibling.textContent = node.nextSibling.textContent?.replace(/^[ \t\r\n]+/, "") || "";
    }
  }
  breaks.forEach((node) => node.replaceWith("\n"));
  body
    .querySelectorAll("p, div, blockquote, li, h1, h2, h3, h4, h5, h6")
    .forEach((node) => node.append("\n\n"));
  return (body.textContent || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizePhoto(
  media: WpMedia,
  captions: Record<string, string>,
): Photo | null {
  const src = safeUrl(media?.source_url);
  if (!src) return null;
  const details = media.media_details || {};
  const candidates = new Map<number, string>();
  for (const size of Object.values(details.sizes || {})) {
    const sameRatio =
      !details.width ||
      !details.height ||
      Math.abs(Number(size.width) / Number(size.height) - details.width / details.height) < 0.025;
    const url = safeUrl(size.source_url);
    if (Number(size.width) > 0 && sameRatio && url) candidates.set(Number(size.width), url);
  }
  if (Number(details.width) > 0) candidates.set(Number(details.width), src);
  return {
    id: media.id,
    src,
    srcset: [...candidates]
      .sort(([a], [b]) => a - b)
      .map(([width, url]) => `${url} ${width}w`)
      .join(", "),
    width: details.width,
    height: details.height,
    title: plainText(media.title?.rendered),
    // WordPress may generate caption.rendered from Description when Caption is empty.
    note: photoNote(media.caption?.raw ?? captions[String(media.id)] ?? ""),
    description: photoNote(media.description?.rendered),
    alt: plainText(media.alt_text),
    date: media.date || "",
    dateGmt: media.date_gmt || "",
    wpMeta: details.image_meta || {},
    originalSrc: new URL(details.original_image || src, src).href,
  };
}

export function normalizePhotos(
  media: WpMedia[],
  captions: Record<string, string> = {},
): Photo[] {
  const photos = media
    .map((item) => normalizePhoto(item, captions))
    .filter((photo): photo is Photo => photo !== null);
  return sortPhotosNewestFirst(photos);
}

export function photoTitle(photo: Photo, index: number): string {
  return photo.title || `Photograph ${String(index + 1).padStart(2, "0")}`;
}

export function locationMap(location: PhotoLocation | null | undefined) {
  if (!location) return null;
  const lat = location.latitude;
  const lon = location.longitude;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180)
    return null;
  const latitude = Math.max(-85, Math.min(85, lat));
  const longitudeSpan = 0.008 / Math.max(0.15, Math.cos((latitude * Math.PI) / 180));
  const rawBounds = location.bounds || [
    lon - longitudeSpan,
    latitude - 0.006,
    lon + longitudeSpan,
    latitude + 0.006,
  ];
  const halfWidth = Math.max((rawBounds[2] - rawBounds[0]) * 0.6, 0.003);
  const halfHeight = Math.max((rawBounds[3] - rawBounds[1]) * 0.6, 0.002);
  const bounds = [
    Math.max(-180, lon - halfWidth),
    Math.max(-85, latitude - halfHeight),
    Math.min(180, lon + halfWidth),
    Math.min(85, latitude + halfHeight),
  ];
  const embed = new URL("https://www.openstreetmap.org/export/embed.html");
  embed.searchParams.set("bbox", bounds.join(","));
  embed.searchParams.set("layer", "mapnik");
  const full = new URL("https://www.openstreetmap.org/");
  if (location.precision === "gps") {
    embed.searchParams.set("marker", `${lat},${lon}`);
    full.searchParams.set("mlat", String(lat));
    full.searchParams.set("mlon", String(lon));
  }
  const span = Math.max(bounds[2] - bounds[0], bounds[3] - bounds[1]);
  const zoom = Math.max(3, Math.min(15, Math.floor(Math.log2(360 / span))));
  full.hash = `map=${zoom}/${latitude}/${lon}`;
  return {
    label: location.label || `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
    note:
      location.precision === "gps"
        ? "GPS recorded in the photo."
        : "Approximate area from the photo source.",
    embed: embed.href,
    href: full.href,
  };
}
