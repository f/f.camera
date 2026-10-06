import assert from "node:assert/strict";
import test from "node:test";
import { createPhotoSwipe } from "../client/lib/photo-swipe.js";

const contact = (clientX, clientY = 0, identifier = 1) => ({ identifier, clientX, clientY });

test("photo swipes follow the finger and navigate once only after enough horizontal travel", () => {
  const swipe = createPhotoSwipe();
  swipe.begin([contact(100)]);
  assert.equal(swipe.move([contact(65, 4)]), -35);
  assert.equal(swipe.end([contact(50, 4)]), 1);
  assert.equal(swipe.end([contact(0)]), 0);
  swipe.begin([contact(100)]);
  assert.equal(swipe.end([contact(150)]), -1);
  swipe.begin([contact(100)]);
  assert.equal(swipe.end([contact(149)]), 0);
  swipe.begin([contact(100)]);
  assert.equal(swipe.end([contact(100)]), 0);
});

test("vertical scrolling, multitouch, zoom, and canceled gestures never change the photo", () => {
  const swipe = createPhotoSwipe();
  swipe.begin([contact(100)]);
  assert.equal(swipe.move([contact(95, 15)]), 0);
  assert.equal(swipe.end([contact(0, 15)]), 0);
  swipe.begin([contact(100)]);
  assert.equal(swipe.move([contact(80)]), -20);
  assert.equal(swipe.end([contact(30, 80)]), 0);
  swipe.begin([contact(100)]);
  assert.equal(swipe.move([contact(60), contact(90, 0, 2)]), 0);
  assert.equal(swipe.end([contact(0)]), 0);
  swipe.begin([contact(100)]);
  assert.equal(swipe.end([contact(0)], 1), 0);
  swipe.begin([contact(100)], 2);
  assert.equal(swipe.end([contact(0)]), 0);
  swipe.begin([contact(100)]);
  assert.equal(swipe.end([contact(0)], 0, 2), 0);
  swipe.begin([contact(100)]);
  assert.equal(swipe.end([contact(0, 0, 2)]), 0);
  swipe.begin([contact(100)]);
  swipe.cancel();
  assert.equal(swipe.end([contact(0)]), 0);
  swipe.begin([contact(100)]);
  assert.equal(swipe.end([contact(0)]), 1);
});
