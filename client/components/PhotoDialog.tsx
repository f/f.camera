import type { RefObject } from "preact";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import { readPhotoMetadata } from "../lib/photo-metadata.js";
import { createPhotoSwipe } from "../lib/photo-swipe.js";
import { locationMap, photoTitle, safeUrl } from "../data/photos";
import type { Photo, PhotoLocation, PhotoMetadata } from "../data/types";
import { PhotoImage } from "./PhotoImage";
import { ExternalLinkIcon } from "./ExternalLinkIcon";

export function LocationMap({
  location,
  title,
  loading,
}: {
  location: PhotoLocation | null | undefined;
  title: string;
  loading: boolean;
}) {
  const map = locationMap(location);
  return (
    <section class="detail-section" aria-labelledby="location-heading">
      <h3 id="location-heading">Location</h3>
      <p id="photo-location" class="location-name">
        {map?.label || (loading ? "Checking location…" : "Location not recorded")}
      </p>
      <p id="location-note" class="detail-note">
        {map?.note ||
          (loading ? "" : "No GPS coordinates or published location are available for this photo.")}
      </p>
      {map && (
        <>
          <div id="photo-map" class="photo-map">
            <iframe
              key={map.embed}
              src={map.embed}
              title={`Map showing ${map.label}`}
              loading="lazy"
              tabIndex={-1}
              aria-hidden="true"
            />
          </div>
          <div id="map-links" class="map-links">
            <a
              id="open-map"
              class="detail-link"
              href={map.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open the map for ${title} on OpenStreetMap`}
            >
              Open map <ExternalLinkIcon />
            </a>
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener noreferrer"
            >
              © OpenStreetMap contributors
            </a>
          </div>
        </>
      )}
    </section>
  );
}

export function PhotoDetails({
  photo,
  title,
  detailsRef,
}: {
  photo: Photo;
  title: string;
  detailsRef: RefObject<HTMLElement>;
}) {
  const [extracted, setExtracted] = useState<PhotoMetadata | null>(null);
  useEffect(() => {
    let current = true;
    setExtracted(null);
    readPhotoMetadata(photo)
      .then((metadata: PhotoMetadata) => {
        if (current) setExtracted(metadata);
      })
      .catch(() => {
        if (current) setExtracted({ status: "unavailable" });
      });
    return () => {
      current = false;
    };
  }, [photo]);

  const source = photo.sample;
  const metadata = source?.metadata || {};
  const keys = [
    "camera",
    "lens",
    "aperture",
    "shutter",
    "iso",
    "focalLength",
    "capturedAt",
  ] as const;
  const value = (key: (typeof keys)[number]) => extracted?.[key] ?? metadata[key];
  const fields = [
    { label: "Camera", value: value("camera"), wide: true },
    { label: "Lens", value: value("lens"), wide: true },
    { label: "Aperture", value: value("aperture") },
    { label: "Shutter", value: value("shutter") },
    { label: "ISO", value: value("iso") },
    { label: "Focal length", value: value("focalLength") },
    { label: "Taken", value: value("capturedAt"), wide: true },
    {
      label: "Image size",
      value: photo.width && photo.height ? `${photo.width} × ${photo.height}` : null,
    },
  ];
  const usedSource = keys.some((key) => metadata[key] && !extracted?.[key]);
  const sourceHref = usedSource ? safeUrl(source?.sourceUrl) : null;
  const hasDetails = keys.some((key) => value(key));
  const status = !extracted
    ? "Reading photo metadata…"
    : usedSource
      ? "Photo details recovered from the original source."
      : hasDetails
        ? "Settings recorded in the photo."
        : extracted.status === "unavailable"
          ? "Photo metadata could not be read."
          : "Camera settings are not included in this file.";

  return (
    <aside ref={detailsRef} class="photo-details" aria-label="Photograph details" tabIndex={0}>
      <div class="lightbox-caption">
        <h2 id="lightbox-title">{title}</h2>
        {photo.note && (
          <section class="photo-note-section" aria-label="Photo note">
            <div class={`photo-note photo-note--${(photo.id % 4) + 1} photo-note--detail`}>
              <p class="photo-note-text">{photo.note}</p>
            </div>
          </section>
        )}
      </div>
      <section class="detail-section" aria-labelledby="settings-heading">
        <h3 id="settings-heading">Photo details</h3>
        <dl id="photo-exif" class="photo-exif">
          {fields
            .filter((field) => field.value)
            .map((field) => (
              <div key={field.label} class={field.wide ? "exif-wide" : undefined}>
                <dt>{field.label}</dt>
                <dd>{field.value}</dd>
              </div>
            ))}
        </dl>
        <p id="metadata-status" class="detail-note" role="status">
          {status}
        </p>
        {sourceHref && (
          <a
            id="metadata-source"
            class="detail-link"
            href={sourceHref}
            target="_blank"
            rel="noopener noreferrer"
          >
            Details from the photo source <ExternalLinkIcon />
          </a>
        )}
      </section>
      <LocationMap
        location={extracted?.location || source?.location}
        title={title}
        loading={!extracted}
      />
    </aside>
  );
}

export function PhotoDialog({
  photo,
  index,
  count,
  onMove,
  onClose,
}: {
  photo: Photo | null;
  index: number;
  count: number;
  onMove: (direction: number) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLElement>(null);
  const swipe = useMemo(() => createPhotoSwipe(), []);
  const [dragOffset, setDragOffset] = useState(0);
  const [slideDirection, setSlideDirection] = useState(0);
  const open = photo !== null;
  const title = photo ? photoTitle(photo, index) : "";
  const viewportScale = () => window.visualViewport?.scale ?? 1;
  const movePhoto = (direction: number) => {
    if (count < 2) return;
    setSlideDirection(direction);
    onMove(direction);
  };

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);
  useLayoutEffect(() => {
    swipe.cancel();
    setDragOffset(0);
    if (!photo) setSlideDirection(0);
    if (contentRef.current) contentRef.current.scrollTop = 0;
    if (detailsRef.current) detailsRef.current.scrollTop = 0;
  }, [photo?.id]);

  return (
    <dialog
      ref={dialogRef}
      id="lightbox"
      class="lightbox"
      aria-labelledby="lightbox-title"
      onClose={onClose}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") {
          event.preventDefault();
          movePhoto(1);
        }
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          movePhoto(-1);
        }
      }}
    >
      <div class="lightbox-shell">
        <header class="lightbox-header">
          <span class="lightbox-brand">f.camera</span>
          <span id="lightbox-count" aria-live="polite">
            {photo
              ? `${String(index + 1).padStart(2, "0")} / ${String(count).padStart(2, "0")}`
              : ""}
          </span>
          <div class="lightbox-actions">
            <button
              id="photo-previous"
              class="icon-button"
              type="button"
              aria-label="Previous photograph"
              disabled={count < 2}
              onClick={() => movePhoto(-1)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m14 6-6 6 6 6" />
              </svg>
            </button>
            <button
              id="photo-next"
              class="icon-button"
              type="button"
              aria-label="Next photograph"
              disabled={count < 2}
              onClick={() => movePhoto(1)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m10 6 6 6-6 6" />
              </svg>
            </button>
            <button
              id="lightbox-close"
              class="icon-button"
              type="button"
              aria-label="Close photograph"
              autoFocus
              onClick={() => dialogRef.current?.close()}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        </header>
        {photo && (
          <div ref={contentRef} class="lightbox-content">
            <div
              class="lightbox-image-wrap"
              onTouchStart={(event) => {
                if (count < 2) return;
                swipe.begin(event.touches, viewportScale());
                setSlideDirection(0);
                setDragOffset(0);
              }}
              onTouchMove={(event) => {
                const offset = swipe.move(event.touches, viewportScale());
                setDragOffset(offset);
              }}
              onTouchEnd={(event) => {
                const direction = swipe.end(
                  event.changedTouches,
                  event.touches.length,
                  viewportScale(),
                );
                setDragOffset(0);
                if (direction) movePhoto(direction);
              }}
              onTouchCancel={() => {
                swipe.cancel();
                setDragOffset(0);
              }}
            >
              <div
                key={photo.id}
                class="lightbox-image-slide"
                data-dragging={dragOffset !== 0 ? "true" : undefined}
                data-slide={slideDirection > 0 ? "next" : slideDirection < 0 ? "previous" : undefined}
                style={{ "--swipe-offset": `${dragOffset}px` }}
              >
                <PhotoImage photo={photo} alt={photo.alt || title} mode="viewer" />
              </div>
            </div>
            <PhotoDetails
              key={photo.id}
              detailsRef={detailsRef}
              photo={photo}
              title={title}
            />
          </div>
        )}
      </div>
    </dialog>
  );
}
