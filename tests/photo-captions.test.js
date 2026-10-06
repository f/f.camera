import assert from 'node:assert/strict';
import test from 'node:test';
import { projectPhotoCaptions, readPhotoCaptions } from '../server/photo-captions.ts';

test('public post-its use only raw captions, including an explicitly empty caption', () => {
  const captions = projectPhotoCaptions([
    { id: 34, caption: { raw: '', rendered: '<p>Hello world!</p>\n' }, description: { raw: 'Hello world!' } },
    { id: 30, caption: { raw: 'A note\nfrom the coast.', rendered: '<p>A note<br>from the coast.</p>' }, description: { raw: 'A note\nfrom the coast.' } },
    { id: 99, caption: { raw: 'Private attachment note.' } },
  ], new Set([34, 30]));
  assert.deepEqual(captions, { 34: '', 30: 'A note\nfrom the coast.' });
});

test('malformed caption responses fail instead of falling back to rendered content', () => {
  const allowed = new Set([34]);
  for (const payload of [
    { code: 'rest_forbidden', message: 'Private upstream details.' },
    [{ id: 34, caption: { rendered: '<p>Fallback description.</p>' } }],
    [{ id: '34', caption: { raw: 'Invalid identifier.' } }],
    Array.from({ length: 101 }, (_, index) => ({ id: index + 1, caption: { raw: '' } })),
  ]) {
    assert.throws(() => projectPhotoCaptions(payload, allowed), { message: 'Could not load photo captions.' });
  }
});

test('an unconfigured gallery has no canonical post-its and performs no authenticated read', async () => {
  assert.deepEqual(await readPhotoCaptions({}), {});
  assert.deepEqual(await readPhotoCaptions({ WP_MEDIA_ORIGIN: 'https://f.camera' }), {});
  assert.deepEqual(await readPhotoCaptions({ WP_MEDIA_TOKEN: 'test-only-token' }), {});
});

test('caption reads reject origins that could send the token outside the fixed media endpoint', async () => {
  for (const origin of [
    'http://f.camera', 'https://user:password@f.camera', 'https://f.camera/other',
    'https://f.camera?target=other', 'https://f.camera#other',
  ]) {
    await assert.rejects(readPhotoCaptions({ WP_MEDIA_ORIGIN: origin, WP_MEDIA_TOKEN: 'test-only-token' }), {
      message: 'Invalid WordPress media origin.',
    });
  }
});
