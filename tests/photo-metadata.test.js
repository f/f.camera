import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizePhotoMetadata } from '../client/lib/photo-metadata.js';

test('EXIF camera and rational exposure win while native image metadata fills missing fields', () => {
  const metadata = normalizePhotoMetadata({ wpMeta: { camera: 'Old camera', aperture: '4', focal_length: '50', iso: '0', shutter_speed: 2 } }, {
    Make: 'Canon', Model: 'Canon EOS R5', LensModel: 'RF50mm F1.8 STM',
    FNumber: { numerator: 28, denominator: 10 }, ExposureTime: [1, 125], ISO: 400,
    DateTimeOriginal: '2024:06:05 14:23:00', OffsetTimeOriginal: '+03:00',
    GPSLatitude: [[0, 1], [0, 1], [0, 1]], GPSLatitudeRef: 'N',
    GPSLongitude: [0, 0, 0], GPSLongitudeRef: 'W',
  });
  assert.deepEqual(metadata, {
    camera: 'Canon EOS R5', lens: 'RF50mm F1.8 STM', aperture: 'ƒ/2.8', focalLength: '50 mm', iso: '400', shutter: '1/125 s',
    capturedAt: '2024-06-05 14:23:00 +03:00',
    location: { latitude: 0, longitude: -0, label: '0.00000, 0.00000', precision: 'gps', source: 'exif' },
    status: 'available', readStatus: 'read',
  });
});

test('zero placeholders and upload dates do not become metadata, but zero GPS is valid', () => {
  const photo = { date: '2026-10-06T17:00:00', wpMeta: { aperture: 0, focal_length: '0', iso: 0, shutter_speed: '0/0', created_timestamp: '0' } };
  const empty = normalizePhotoMetadata(photo, { DateTimeOriginal: '2024:02:31 25:00:00', latitude: 91, longitude: 0 });
  assert.equal(empty.status, 'empty');
  assert.deepEqual(Object.fromEntries(Object.entries(empty).filter(([key]) => !['status', 'readStatus'].includes(key))), {
    camera: null, lens: null, aperture: null, focalLength: null, iso: null, shutter: null, capturedAt: null, location: null,
  });
  assert.deepEqual(normalizePhotoMetadata(photo, { latitude: 0, longitude: 0 }).location, {
    latitude: 0, longitude: 0, label: '0.00000, 0.00000', precision: 'gps', source: 'exif',
  });
});

test('original read failure keeps usable WordPress EXIF and does not imply metadata was absent', () => {
  const metadata = normalizePhotoMetadata({ wpMeta: { camera: 'Nikon D850', shutter_speed: '1/4', created_timestamp: 1717597380 } }, {}, 'timeout');
  assert.equal(metadata.camera, 'Nikon D850');
  assert.equal(metadata.shutter, '1/4 s');
  assert.equal(metadata.capturedAt, '2024-06-05 14:23:00');
  assert.equal(metadata.status, 'partial');
  assert.equal(metadata.readStatus, 'timeout');
  assert.equal(normalizePhotoMetadata({}, {}, 'too-large').status, 'unavailable');
});

test('the bounded original reader parses actual JPEG EXIF and refuses oversized originals', async () => {
  const { createServer } = await import('node:http');
  const { readFile } = await import('node:fs/promises');
  const { once } = await import('node:events');
  const { readPhotoMetadata } = await import('../client/lib/photo-metadata.js');
  // Authored 269-byte JPEG/EXIF container with test tags, not a copied photograph.
  const bytes = await readFile(new URL('./fixtures/exif-gps.jpg', import.meta.url));
  const server = createServer((request, response) => {
    response.setHeader('content-type', 'image/jpeg');
    response.setHeader('content-length', request.url === '/large.jpg' ? 21 * 1024 * 1024 : bytes.byteLength);
    response.end(request.url === '/large.jpg' ? undefined : bytes);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  const previousWindow = globalThis.window;
  globalThis.window = { location: { href: `${origin}/`, origin } };
  try {
    const metadata = await readPhotoMetadata({ originalSrc: `${origin}/photo.jpg` });
    assert.equal(metadata.camera, 'Canon EOS R5');
    assert.equal(metadata.aperture, 'ƒ/2.8');
    assert.equal(metadata.shutter, '1/125 s');
    assert.equal(metadata.capturedAt, '2024-06-05 14:23:00');
    assert.deepEqual(metadata.location, { latitude: 0, longitude: -0, label: '0.00000, 0.00000', precision: 'gps', source: 'exif' });
    assert.equal(metadata.status, 'available');
    assert.equal((await readPhotoMetadata({ originalSrc: `${origin}/large.jpg` })).readStatus, 'too-large');
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
