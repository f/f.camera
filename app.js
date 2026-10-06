import { readPhotoMetadata } from "./photo-metadata.js?v=bio-gear-1";
import {
  photoDate,
  sortPhotosNewestFirst,
} from "./photo-dates.js?v=bio-gear-1";

const gallery = document.querySelector("#gallery");
const galleryState = document.querySelector("#gallery-state");
const lightbox = document.querySelector("#lightbox");
const lightboxImage = document.querySelector("#lightbox-image");
const lightboxImageError = document.querySelector("#lightbox-image-error");
const parser = new DOMParser();
let photos = [];
let selectedIndex = 0;
let lastPhotoButton = null;
let sampleDetails = {};
let detailRequest = 0;
let masonryObserver = null;
let masonryFrame = 0;

function plainText(value) {
  return parser
    .parseFromString(String(value || ""), "text/html")
    .body.textContent.trim();
}

export function photoNote(value) {
  const body = parser.parseFromString(String(value || ""), "text/html").body;
  body
    .querySelectorAll("p.attachment, script, style, iframe, object")
    .forEach((node) => node.remove());
  const breaks = [...body.querySelectorAll("br")];
  breaks.forEach((node) => {
    if (node.previousSibling?.nodeType === Node.TEXT_NODE)
      node.previousSibling.textContent =
        node.previousSibling.textContent.replace(/[ \t\r\n]+$/, "");
    if (node.nextSibling?.nodeType === Node.TEXT_NODE)
      node.nextSibling.textContent = node.nextSibling.textContent.replace(
        /^[ \t\r\n]+/,
        "",
      );
  });
  breaks.forEach((node) => node.replaceWith("\n"));
  body
    .querySelectorAll("p, div, blockquote, li, h1, h2, h3, h4, h5, h6")
    .forEach((node) => node.append("\n\n"));
  return body.textContent
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function safeUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value, window.location.origin);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function normalizePhoto(media) {
  if (!media || !safeUrl(media.source_url)) return null;
  const details = media.media_details || {};
  const candidates = new Map();
  for (const size of Object.values(details.sizes || {})) {
    const sameRatio =
      !details.width ||
      !details.height ||
      Math.abs(
        Number(size.width) / Number(size.height) -
          Number(details.width) / Number(details.height),
      ) < 0.025;
    if (Number(size.width) > 0 && sameRatio && safeUrl(size.source_url)) {
      candidates.set(Number(size.width), safeUrl(size.source_url));
    }
  }
  if (Number(details.width) > 0)
    candidates.set(Number(details.width), safeUrl(media.source_url));
  return {
    id: media.id,
    src: safeUrl(media.source_url),
    srcset: [...candidates]
      .sort(([a], [b]) => a - b)
      .map(([width, url]) => `${url} ${width}w`)
      .join(", "),
    width: details.width,
    height: details.height,
    title: media.title?.rendered || "",
    caption: media.caption?.rendered || "",
    note: photoNote(media.description?.rendered),
    alt: media.alt_text || "",
    date: media.date || "",
    dateGmt: media.date_gmt || "",
    wpMeta: details.image_meta || {},
    originalSrc: new URL(
      details.original_image || media.source_url,
      media.source_url,
    ).pathname,
    sample: sampleDetails[new URL(media.source_url).pathname] || null,
  };
}

function photoTitle(photo, index) {
  return (
    plainText(photo.title) || `Photograph ${String(index + 1).padStart(2, "0")}`
  );
}

function captionContent(value) {
  const source = parser.parseFromString(String(value || ""), "text/html").body;
  const fragment = document.createDocumentFragment();
  function appendSafe(node, parent) {
    if (node.nodeType === Node.TEXT_NODE) {
      parent.append(document.createTextNode(node.textContent));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (["SCRIPT", "STYLE", "IFRAME", "OBJECT"].includes(node.tagName)) return;
    if (node.tagName === "A" && safeUrl(node.getAttribute("href"))) {
      const link = document.createElement("a");
      link.href = safeUrl(node.getAttribute("href"));
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      for (const child of node.childNodes) appendSafe(child, link);
      parent.append(link);
      return;
    }
    for (const child of node.childNodes) appendSafe(child, parent);
    if (["BR", "P", "DIV"].includes(node.tagName))
      parent.append(document.createTextNode(" "));
  }
  for (const node of source.childNodes) appendSafe(node, fragment);
  return fragment;
}

function showState(heading, detail, retry = false) {
  gallery.hidden = true;
  galleryState.hidden = false;
  galleryState.replaceChildren();
  const title = document.createElement("p");
  title.className = "state-heading";
  title.textContent = heading;
  const description = document.createElement("p");
  description.className = "state-detail";
  description.textContent = detail;
  galleryState.append(title, description);
  if (retry) {
    const button = document.createElement("button");
    button.className = "state-retry";
    button.type = "button";
    button.textContent = "Try again";
    button.addEventListener("click", loadPhotos, { once: true });
    galleryState.append(button);
  }
}

function layoutMasonry() {
  if (gallery.hidden) return;
  const gap =
    Number.parseFloat(
      getComputedStyle(gallery).getPropertyValue("--masonry-gap"),
    ) || 0;
  const rows = [...gallery.children].map((figure) => ({
    figure,
    span: Math.max(1, Math.ceil(figure.getBoundingClientRect().height + gap)),
  }));
  for (const { figure, span } of rows) {
    const value = `span ${span}`;
    if (figure.style.gridRowEnd !== value) figure.style.gridRowEnd = value;
  }
}

function queueMasonryLayout() {
  if (masonryFrame) return;
  masonryFrame = requestAnimationFrame(() => {
    masonryFrame = 0;
    layoutMasonry();
  });
}

function renderPhotos() {
  masonryObserver?.disconnect();
  cancelAnimationFrame(masonryFrame);
  masonryFrame = 0;
  gallery.replaceChildren();
  photos.forEach((photo, index) => {
    const figure = document.createElement("figure");
    figure.className = "photo";
    figure.style.setProperty("--photo-index", index);
    const width = Number(photo.width);
    const height = Number(photo.height);
    const title = photoTitle(photo, index);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "photo-open";
    button.setAttribute("aria-label", `Open ${title}`);
    button.setAttribute("aria-haspopup", "dialog");
    const image = document.createElement("img");
    image.className = "photo-image";
    image.alt = plainText(photo.alt) || title;
    image.loading = index < 2 ? "eager" : "lazy";
    image.decoding = "async";
    if (index === 0) image.fetchPriority = "high";
    if (width > 0 && height > 0) {
      image.width = width;
      image.height = height;
      image.style.setProperty("--image-ratio", `${width} / ${height}`);
    }
    if (photo.srcset) image.srcset = photo.srcset;
    image.sizes =
      "(max-width: 600px) calc(100vw - 40px), (max-width: 1000px) calc((100vw - 82px) / 2), (min-width: 1800px) 516px, (min-width: 1560px) 473px, calc((100vw - 140px) / 3)";
    image.src = safeUrl(photo.src);
    image.addEventListener("load", queueMasonryLayout, { once: true });
    image.addEventListener(
      "error",
      () => {
        const error = document.createElement("span");
        error.className = "photo-unavailable";
        error.textContent = "Photograph unavailable";
        image.replaceWith(error);
        queueMasonryLayout();
      },
      { once: true },
    );
    button.append(image);
    if (photo.note) {
      const note = document.createElement("span");
      note.id = `photo-note-${photo.id}`;
      note.className = `photo-note photo-note--${(Number(photo.id) % 4) + 1}`;
      const text = document.createElement("span");
      text.className = "photo-note-text";
      text.textContent = photo.note;
      note.append(text);
      button.append(note);
      button.setAttribute("aria-describedby", note.id);
    }
    button.addEventListener("click", () => {
      lastPhotoButton = button;
      selectedIndex = index;
      updateLightbox();
      lightbox.showModal();
    });
    const caption = document.createElement("figcaption");
    caption.className = "photo-caption";
    const name = document.createElement("h3");
    name.className = "photo-title";
    name.textContent = title;
    caption.append(name);
    const date = photoDate(photo);
    if (date.iso) {
      const time = document.createElement("time");
      time.className = "photo-date";
      time.dateTime = date.iso;
      time.textContent =
        date.kind === "added" ? `Added ${date.label}` : date.label;
      time.title = `${date.kind === "added" ? "Added" : "Taken"} ${date.label}`;
      caption.append(time);
    }
    figure.append(button, caption);
    gallery.append(figure);
  });
  galleryState.hidden = true;
  gallery.hidden = false;
  layoutMasonry();
  if (typeof ResizeObserver !== "undefined") {
    masonryObserver = new ResizeObserver(queueMasonryLayout);
    for (const figure of gallery.children) masonryObserver.observe(figure);
  }
}

async function loadPhotos() {
  showState("Loading photographs…", "");
  gallery.setAttribute("aria-busy", "true");
  try {
    const endpoint =
      "/wp-json/wp/v2/media?media_type=image&per_page=100&orderby=date&order=desc&_fields=id,source_url,media_details,title,caption,description,alt_text,date,date_gmt";
    const [response, samples] = await Promise.all([
      fetch(endpoint, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15000),
      }),
      fetch("/sample-details.json?v=bio-gear-1", {
        signal: AbortSignal.timeout(8000),
      })
        .then((result) => (result.ok ? result.json() : {}))
        .catch(() => ({})),
    ]);
    sampleDetails = samples;
    if (!response.ok)
      throw new Error(`Could not load photographs (${response.status}).`);
    const payload = await response.json();
    if (!Array.isArray(payload))
      throw new Error("The photo collection is unavailable.");
    photos = sortPhotosNewestFirst(
      payload
        .map(normalizePhoto)
        .filter((photo) => photo && safeUrl(photo.src)),
    );
    const count = photos.length;
    if (!count) {
      showState("No photographs yet.", "Check back soon.");
      return;
    }
    renderPhotos();
  } catch {
    showState(
      "Could not load photographs.",
      "Please try again in a moment.",
      true,
    );
  } finally {
    gallery.setAttribute("aria-busy", "false");
  }
}

function updateLightbox() {
  const photo = photos[selectedIndex];
  const request = ++detailRequest;
  lightboxImage.hidden = false;
  lightboxImageError.hidden = true;
  lightboxImage.alt = plainText(photo.alt) || photoTitle(photo, selectedIndex);
  lightboxImage.sizes =
    "(max-width: 800px) calc(100vw - 32px), calc(100vw - 420px)";
  if (photo.srcset) lightboxImage.srcset = photo.srcset;
  else lightboxImage.removeAttribute("srcset");
  lightboxImage.src = safeUrl(photo.src);
  document.querySelector("#lightbox-title").textContent = photoTitle(
    photo,
    selectedIndex,
  );
  document.querySelector("#lightbox-count").textContent =
    `${String(selectedIndex + 1).padStart(2, "0")} / ${String(photos.length).padStart(2, "0")}`;
  document
    .querySelector("#lightbox-credit")
    .replaceChildren(captionContent(photo.caption));
  document.querySelector("#photo-previous").disabled = photos.length < 2;
  document.querySelector("#photo-next").disabled = photos.length < 2;
  document.querySelector(".lightbox-content").scrollTop = 0;
  document.querySelector(".photo-details").scrollTop = 0;
  renderPhotoDetails(photo, null);
  readPhotoMetadata(photo)
    .then((metadata) => {
      if (request === detailRequest) renderPhotoDetails(photo, metadata);
    })
    .catch(() => {
      if (request === detailRequest)
        renderPhotoDetails(photo, { status: "unavailable" });
    });
}

function renderPhotoDetails(photo, extracted) {
  const source = photo.sample;
  const metadata = { ...source?.metadata };
  for (const [key, value] of Object.entries(extracted || {})) {
    if (value !== null && value !== undefined) metadata[key] = value;
  }
  const list = document.querySelector("#photo-exif");
  list.replaceChildren();
  const fields = [
    ["Camera", metadata.camera],
    ["Lens", metadata.lens],
    ["Aperture", metadata.aperture],
    ["Shutter", metadata.shutter],
    ["ISO", metadata.iso],
    ["Focal length", metadata.focalLength],
    ["Taken", metadata.capturedAt],
    [
      "Image size",
      photo.width && photo.height ? `${photo.width} × ${photo.height}` : null,
    ],
  ];
  for (const [label, value] of fields) {
    if (!value) continue;
    const row = document.createElement("div");
    if (["Camera", "Lens", "Taken"].includes(label))
      row.className = "exif-wide";
    const name = document.createElement("dt");
    name.textContent = label;
    const detail = document.createElement("dd");
    detail.textContent = value;
    row.append(name, detail);
    list.append(row);
  }
  const usedSource = Object.keys(source?.metadata || {}).some(
    (key) => source.metadata[key] && !extracted?.[key],
  );
  const sourceLink = document.querySelector("#metadata-source");
  sourceLink.hidden = !usedSource || !safeUrl(source?.sourceUrl);
  if (!sourceLink.hidden) sourceLink.href = safeUrl(source.sourceUrl);
  const status = document.querySelector("#metadata-status");
  const hasCameraDetails = fields.slice(0, -1).some(([, value]) => value);
  status.textContent = !extracted
    ? "Reading photo metadata…"
    : usedSource
      ? "Photo details recovered from the original source."
      : hasCameraDetails
        ? "Settings recorded in the photo."
        : extracted.status === "unavailable"
          ? "Photo metadata could not be read."
          : "Camera settings are not included in this file.";
  renderLocation(
    extracted?.location || source?.location,
    photoTitle(photo, selectedIndex),
    !extracted,
  );
}

function renderLocation(location, title, loading) {
  const map = document.querySelector("#photo-map");
  const links = document.querySelector("#map-links");
  const name = document.querySelector("#photo-location");
  const note = document.querySelector("#location-note");
  const lat = location?.latitude;
  const lon = location?.longitude;
  const valid =
    typeof lat === "number" &&
    typeof lon === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180;
  map.hidden = !valid;
  links.hidden = !valid;
  if (!valid) {
    map.replaceChildren();
    name.textContent = loading ? "Checking location…" : "Location not recorded";
    note.textContent = loading
      ? ""
      : "No GPS coordinates or published location are available for this photo.";
    return;
  }
  name.textContent = location.label || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  note.textContent =
    location.precision === "gps"
      ? "GPS recorded in the photo."
      : "Approximate area from the photo source.";
  const latitude = Math.max(-85, Math.min(85, lat));
  const longitudeSpan =
    0.008 / Math.max(0.15, Math.cos((latitude * Math.PI) / 180));
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
  if (location.precision === "gps")
    embed.searchParams.set("marker", `${lat},${lon}`);
  if (map.firstElementChild?.src !== embed.href) {
    const frame = document.createElement("iframe");
    frame.src = embed.href;
    frame.title = `Map showing ${name.textContent}`;
    frame.loading = "lazy";
    frame.tabIndex = -1;
    frame.setAttribute("aria-hidden", "true");
    map.replaceChildren(frame);
  }
  const mapLink = document.querySelector("#open-map");
  const large = new URL("https://www.openstreetmap.org/");
  if (location.precision === "gps") {
    large.searchParams.set("mlat", String(lat));
    large.searchParams.set("mlon", String(lon));
  }
  const span = Math.max(bounds[2] - bounds[0], bounds[3] - bounds[1]);
  const zoom = Math.max(3, Math.min(15, Math.floor(Math.log2(360 / span))));
  large.hash = `map=${zoom}/${latitude}/${lon}`;
  mapLink.href = large.href;
  mapLink.setAttribute(
    "aria-label",
    `Open the map for ${title} on OpenStreetMap`,
  );
}

function movePhoto(direction) {
  if (!photos.length) return;
  selectedIndex = (selectedIndex + direction + photos.length) % photos.length;
  updateLightbox();
}

window.addEventListener("resize", queueMasonryLayout, { passive: true });
lightboxImage.addEventListener("error", () => {
  lightboxImage.hidden = true;
  lightboxImageError.hidden = false;
});
document
  .querySelector("#photo-previous")
  .addEventListener("click", () => movePhoto(-1));
document
  .querySelector("#photo-next")
  .addEventListener("click", () => movePhoto(1));
document
  .querySelector("#lightbox-close")
  .addEventListener("click", () => lightbox.close());
lightbox.addEventListener("keydown", (event) => {
  if (event.key === "ArrowRight") {
    event.preventDefault();
    movePhoto(1);
  }
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    movePhoto(-1);
  }
});
lightbox.addEventListener("close", () => {
  ++detailRequest;
  document.querySelector("#photo-map").replaceChildren();
  lastPhotoButton?.focus({ preventScroll: true });
});
loadPhotos();
