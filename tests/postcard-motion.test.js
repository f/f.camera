import assert from "node:assert/strict";
import test from "node:test";
import { postcardBounds, postcardTransform } from "../client/lib/postcard-motion.js";

test("each postcard keeps its photo ratio, centers inside the viewport, and returns to its gallery bounds", () => {
  for (const source of [
    { left: 24, top: 420, width: 360, height: 240 },
    { left: 450, top: -180, width: 300, height: 450 },
  ]) {
    const viewport = { width: 1200, height: 900 };
    const fitted = postcardBounds(source, viewport);
    assert.equal(fitted.width / fitted.height, source.width / source.height);
    assert.equal(fitted.left + fitted.width / 2, viewport.width / 2);
    assert.equal(fitted.top + fitted.height / 2, viewport.height / 2);
    const scale = source.width / fitted.width;
    assert.ok(Math.abs(fitted.height * scale - source.height) < 1e-9, "return scale preserves the photo height");
  }
  const mobile = postcardBounds({ width: 1500, height: 1000 }, { width: 390, height: 844 });
  assert.equal(mobile.width, 358);
  assert.equal(mobile.height, 358 / 1.5);
  const tilted = postcardBounds({ width: 1000, height: 1500 }, { width: 390, height: 844 }, -1.8);
  const angle = 1.8 * Math.PI / 180;
  assert.ok(tilted.width * Math.cos(angle) + tilted.height * Math.sin(angle) <= 358 + 1e-9,
    "tilted paper stays inside the mobile viewport");
  assert.ok(Math.abs(tilted.width / tilted.height - 2 / 3) < 1e-9);
  assert.equal(
    postcardTransform({ left: 24, top: -100, width: 180 }, { left: 100, top: 64, width: 900 }),
    "translate(-76px, -164px) scale(0.2)",
  );
});
