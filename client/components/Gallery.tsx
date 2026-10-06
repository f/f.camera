import { useLayoutEffect, useRef } from "preact/hooks";
import { PhotoImage } from "./PhotoImage";
import type { PostcardSource } from "./PhotoPostcard";
import { photoDate } from "../lib/photo-dates.js";
import { photoTitle } from "../data/photos";
import type { Photo } from "../data/types";

type OpenPhoto = (photo: Photo, opener: HTMLButtonElement) => void;
type OpenPostcard = (photo: Photo, source: PostcardSource) => void;

export function GalleryState({
  heading,
  detail = "",
  onRetry,
}: {
  heading: string;
  detail?: string;
  onRetry?: () => void;
}) {
  return (
    <div id="gallery-state" class="gallery-state" role="status" aria-live="polite">
      <p class="state-heading">{heading}</p>
      <p class="state-detail">{detail}</p>
      {onRetry && (
        <button class="state-retry" type="button" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

function PhotoCard({ photo, index, onOpen, onPostcard }: {
  photo: Photo;
  index: number;
  onOpen: OpenPhoto;
  onPostcard: OpenPostcard;
}) {
  const imageButtonRef = useRef<HTMLButtonElement>(null);
  const title = photoTitle(photo, index);
  const date = photoDate(photo);
  const noteId = `photo-note-${photo.id}`;
  return (
    <figure class="photo" style={{ "--photo-index": index }}>
      <button
        ref={imageButtonRef}
        class="photo-open"
        type="button"
        aria-label={`Open ${title}`}
        aria-haspopup="dialog"
        aria-describedby={photo.note ? noteId : undefined}
        onClick={(event) => onOpen(photo, event.currentTarget)}
      >
        <PhotoImage
          photo={photo}
          alt={photo.alt || title}
          loading={index < 2 ? "eager" : "lazy"}
          highPriority={index === 0}
        />
        {photo.note && (
          <span id={noteId} class={`photo-note photo-note--${(photo.id % 4) + 1}`}>
            <span class="photo-note-text">{photo.note}</span>
          </span>
        )}
      </button>
      <figcaption class="photo-caption">
        <h3 class="photo-title">
          {photo.description ? (
            <button
              class="postcard-trigger"
              type="button"
              aria-haspopup="dialog"
              onClick={(event) => {
                const image = imageButtonRef.current;
                if (!image) return;
                onPostcard(photo, {
                  rect: image.getBoundingClientRect(),
                  image,
                  trigger: event.currentTarget,
                  previewSrc: image.querySelector("img")?.currentSrc || photo.src,
                });
              }}
            >
              {title}
              <span class="sr-only"> — read the postcard</span>
            </button>
          ) : title}
        </h3>
        {date.iso && (
          <time
            class="photo-date"
            dateTime={date.iso}
            title={`${date.kind === "added" ? "Added" : "Taken"} ${date.label}`}
          >
            {date.kind === "added" ? `Added ${date.label}` : date.label}
          </time>
        )}
      </figcaption>
    </figure>
  );
}

export function PhotoGallery({ photos, onOpen, onPostcard }: {
  photos: Photo[];
  onOpen: OpenPhoto;
  onPostcard: OpenPostcard;
}) {
  const galleryRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const gallery = galleryRef.current;
    if (!gallery) return;
    let frame = 0;
    const layout = () => {
      const gap =
        Number.parseFloat(getComputedStyle(gallery).getPropertyValue("--masonry-gap")) || 0;
      const rows = [...gallery.children]
        .filter((child): child is HTMLElement => child instanceof HTMLElement)
        .map((figure) => ({
          figure,
          span: Math.max(1, Math.ceil(figure.getBoundingClientRect().height + gap)),
        }));
      for (const { figure, span } of rows) {
        const value = `span ${span}`;
        if (figure.style.gridRowEnd !== value) figure.style.gridRowEnd = value;
      }
    };
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        layout();
      });
    };
    layout();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    for (const figure of gallery.children) observer?.observe(figure);
    gallery.addEventListener("load", schedule, true);
    gallery.addEventListener("error", schedule, true);
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      observer?.disconnect();
      cancelAnimationFrame(frame);
      gallery.removeEventListener("load", schedule, true);
      gallery.removeEventListener("error", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, [photos]);
  return (
    <div
      ref={galleryRef}
      id="gallery"
      class="gallery"
      role="region"
      aria-labelledby="gallery-title"
      aria-busy="false"
    >
      {photos.map((photo, index) => (
        <PhotoCard key={photo.id} photo={photo} index={index} onOpen={onOpen} onPostcard={onPostcard} />
      ))}
    </div>
  );
}
