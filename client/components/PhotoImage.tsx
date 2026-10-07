import { useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import type { Photo } from "../data/types";
import { waitToRetry } from "../lib/load-retry.js";

type Props = {
  photo: Photo;
  alt: string;
  mode?: "gallery" | "viewer" | "postcard";
  loading?: "eager" | "lazy";
  highPriority?: boolean;
};

function Aperture({ id }: { id: string }) {
  return (
    <svg class="photo-aperture" viewBox="0 0 48 48" focusable="false">
      <defs>
        <clipPath id={id}>
          <circle cx="24" cy="24" r="19" />
        </clipPath>
      </defs>
      <circle class="aperture-ring" cx="24" cy="24" r="21" />
      <g clip-path={`url(#${id})`}>
        <circle class="aperture-blades" cx="24" cy="24" r="19" />
        <g transform="translate(24 24)">
          <g class="aperture-iris">
            <path class="aperture-opening" d="M6 0 3 5.196-3 5.196-6 0-3-5.196 3-5.196Z" />
            {/* Extend each hexagon edge to the rim to form six interlocking blades. */}
            {[0, 60, 120, 180, 240, 300].map((angle) => (
              <path
                key={angle}
                class="aperture-seam"
                d="M6 0 36 51.96"
                transform={`rotate(${angle})`}
              />
            ))}
          </g>
        </g>
      </g>
    </svg>
  );
}

function ImageFrame({ photo, alt, mode = "gallery", loading = "eager", highPriority }: Props) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [state, setState] = useState<"loading" | "loaded">("loading");
  const [useOriginal, setUseOriginal] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const viewer = mode !== "gallery";
  const hasDimensions = Number(photo.width) > 0 && Number(photo.height) > 0;
  const source = useMemo(() => {
    if (!attempt) return photo.src;
    const url = new URL(photo.src, window.location.href);
    url.searchParams.set("_fcamera_retry", `${Date.now()}-${attempt}`);
    return url.href;
  }, [photo.src, attempt]);

  useLayoutEffect(() => {
    const image = imageRef.current;
    if (!image) return;
    let pendingRetry: AbortController | undefined;
    let disposed = false;
    let failed = false;

    const loaded = () => {
      if (disposed || image !== imageRef.current) return;
      pendingRetry?.abort();
      pendingRetry = undefined;
      failed = false;
      setState("loaded");
    };
    const retry = () => {
      if (failed || disposed || image !== imageRef.current) return;
      failed = true;
      setState("loading");
      if (!useOriginal && photo.srcset) {
        setUseOriginal(true);
        return;
      }
      const controller = new AbortController();
      pendingRetry = controller;
      void waitToRetry(attempt, controller.signal).then(
        () => {
          if (!disposed && !controller.signal.aborted && image === imageRef.current) {
            setAttempt((current) => current + 1);
          }
        },
        () => {}, // Loading or removing this image cancels the pending retry.
      );
    };

    image.addEventListener("load", loaded);
    image.addEventListener("error", retry);
    // A cached request may finish before listeners attach. Untouched lazy images
    // have no currentSrc, so they must not start a retry timer.
    if (image.complete && image.currentSrc) {
      if (image.naturalWidth > 0) loaded();
      else retry();
    }
    return () => {
      disposed = true;
      pendingRetry?.abort();
      image.removeEventListener("load", loaded);
      image.removeEventListener("error", retry);
    };
  }, [attempt, useOriginal, photo.srcset]);

  return (
    <span
      class={`photo-frame photo-frame--${mode}`}
      data-state={state}
      aria-busy={state === "loading"}
      style={hasDimensions ? { "--image-ratio": `${photo.width} / ${photo.height}` } : undefined}
    >
      <img
        key={`${useOriginal ? "original" : "responsive"}-${attempt}`}
        ref={imageRef}
        id={mode === "viewer" ? "lightbox-image" : undefined}
        class={viewer ? undefined : "photo-image"}
        src={source}
        srcSet={useOriginal ? undefined : photo.srcset || undefined}
        sizes={
          useOriginal
            ? undefined
            : mode === "postcard"
              ? "calc(100vw - 32px)"
              : viewer
                ? "(max-width: 800px) calc(100vw - 32px), calc(100vw - 420px)"
                : "(max-width: 600px) calc(100vw - 40px), (max-width: 1000px) calc((100vw - 82px) / 2), (min-width: 1800px) 516px, (min-width: 1560px) 473px, calc((100vw - 140px) / 3)"
        }
        alt={alt}
        width={hasDimensions ? photo.width : undefined}
        height={hasDimensions ? photo.height : undefined}
        loading={useOriginal || attempt > 0 ? "eager" : loading}
        decoding="async"
        fetchPriority={highPriority ? "high" : undefined}
      />
      <span class="photo-loading" aria-hidden="true">
        {state === "loading" && <Aperture id={`aperture-${mode}-${photo.id}`} />}
        <span class="photo-loading-text">{alt}</span>
      </span>
    </span>
  );
}

export function PhotoImage(props: Props) {
  // A new source gets its own loading state, including while navigating the viewer.
  return <ImageFrame key={`${props.photo.src}|${props.photo.srcset}`} {...props} />;
}
