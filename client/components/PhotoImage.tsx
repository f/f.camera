import { useLayoutEffect, useRef, useState } from "preact/hooks";
import type { Photo } from "../data/types";

type Props = {
  photo: Photo;
  alt: string;
  mode?: "gallery" | "viewer";
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
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");
  const viewer = mode === "viewer";
  const hasDimensions = Number(photo.width) > 0 && Number(photo.height) > 0;

  // Cached images can finish before the component's load listener is attached.
  useLayoutEffect(() => {
    const image = imageRef.current;
    if (image?.complete && image.currentSrc) {
      setState(image.naturalWidth > 0 ? "loaded" : "error");
    }
  }, []);

  return (
    <span
      class={`photo-frame photo-frame--${mode}`}
      data-state={state}
      aria-busy={state === "loading"}
      style={hasDimensions ? { "--image-ratio": `${photo.width} / ${photo.height}` } : undefined}
    >
      <img
        ref={imageRef}
        id={viewer ? "lightbox-image" : undefined}
        class={viewer ? undefined : "photo-image"}
        src={photo.src}
        srcSet={photo.srcset || undefined}
        sizes={
          viewer
            ? "(max-width: 800px) calc(100vw - 32px), calc(100vw - 420px)"
            : "(max-width: 600px) calc(100vw - 40px), (max-width: 1000px) calc((100vw - 82px) / 2), (min-width: 1800px) 516px, (min-width: 1560px) 473px, calc((100vw - 140px) / 3)"
        }
        alt={alt}
        width={hasDimensions ? photo.width : undefined}
        height={hasDimensions ? photo.height : undefined}
        loading={loading}
        decoding="async"
        fetchPriority={highPriority ? "high" : undefined}
        onLoad={() => setState("loaded")}
        onError={() => setState("error")}
      />
      <span class="photo-loading" aria-hidden="true">
        {state === "loading" && <Aperture id={`aperture-${mode}-${photo.id}`} />}
        {state === "error" && <span class="photo-loading-error">Photograph unavailable</span>}
        <span class="photo-loading-text">{alt}</span>
      </span>
      {state === "error" && (
        <span class="sr-only" role="status">
          This photograph could not load.
        </span>
      )}
    </span>
  );
}

export function PhotoImage(props: Props) {
  // A new source gets its own loading state, including while navigating the viewer.
  return <ImageFrame key={`${props.photo.src}|${props.photo.srcset}`} {...props} />;
}
