import { useId, useState } from "preact/hooks";

const openingPath = "M36 24 30 34.392 18 34.392 12 24 18 13.608 30 13.608Z";

export function ApertureLogo({ shutter = 0 }: { shutter?: number }) {
  const clipId = `logo-aperture-${useId()}`;
  const centerClipId = `${clipId}-center`;
  const irisClass = shutter ? "logo-iris logo-iris--shutter" : "logo-iris";

  return (
    <svg class="aperture-logo" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={clipId}>
          <circle cx="24" cy="24" r="19" />
        </clipPath>
        <clipPath id={centerClipId}>
          <path key={shutter} class={irisClass} d={openingPath} />
        </clipPath>
      </defs>
      <circle class="logo-rim" cx="24" cy="24" r="21" />
      <g clip-path={`url(#${clipId})`}>
        <circle class="logo-blades" cx="24" cy="24" r="19" />
        <g key={shutter} class={irisClass}>
          <path class="logo-opening" d={openingPath} />
          {[0, 60, 120, 180, 240, 300].map((angle) => (
            <path
              key={angle}
              class="logo-seam"
              d="M36 24 66 75.96"
              transform={`rotate(${angle} 24 24)`}
            />
          ))}
        </g>
      </g>
      <g clip-path={`url(#${centerClipId})`}>
        <circle class="logo-dot" cx="24" cy="24" r="6.7" />
      </g>
    </svg>
  );
}

export function ApertureButton({
  className = "brand-icon",
  label = "Release camera shutter",
}: {
  className?: string;
  label?: string;
}) {
  const [shutter, setShutter] = useState(0);

  return (
    <button
      class={className}
      type="button"
      aria-label={label}
      onClick={() => setShutter((count) => count + 1)}
    >
      <ApertureLogo shutter={shutter} />
    </button>
  );
}
