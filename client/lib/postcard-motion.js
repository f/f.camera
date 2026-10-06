/**
 * Fit the photo inside the viewport without changing its aspect ratio.
 * @param {{width: number, height: number}} photo
 * @param {{width: number, height: number}} viewport
 * @param {number} tilt The final paper rotation in degrees.
 */
export function postcardBounds(photo, viewport, tilt = 0) {
  const ratio = photo.width / photo.height;
  const radians = tilt * Math.PI / 180;
  const cosine = Math.abs(Math.cos(radians));
  const sine = Math.abs(Math.sin(radians));
  const width = Math.min(
    Math.max(1, viewport.width - 32) / (cosine + sine / ratio),
    Math.max(1, viewport.height - 128) / (sine + cosine / ratio),
  );
  const height = width / ratio;
  return { left: (viewport.width - width) / 2, top: (viewport.height - height) / 2, width, height };
}

/**
 * Both faces use the same fitted bounds; only uniform scale and position change.
 * @param {{left: number, top: number, width: number}} source
 * @param {{left: number, top: number, width: number}} target
 */
export function postcardTransform(source, target) {
  return `translate(${source.left - target.left}px, ${source.top - target.top}px) scale(${source.width / target.width})`;
}
