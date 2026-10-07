import assert from 'node:assert/strict';
import test from 'node:test';
import { photoDate, sortPhotosNewestFirst } from '../client/lib/photo-dates.js';

test('capture precedence, uploaded mode, and honest date kinds', () => {
  const photo = { wpMeta: { created_timestamp: String(Date.UTC(2026, 4, 3, 14) / 1000) }, dateGmt: '2026-10-06T14:33:57' };
  assert.deepEqual(photoDate(photo), { timestamp: Date.UTC(2026, 4, 3, 14), iso: '2026-05-03', label: '3 May 2026', kind: 'taken' });
  assert.deepEqual(photoDate(photo, { mode: 'uploaded' }), { timestamp: Date.UTC(2026, 9, 6, 14, 33, 57), iso: '2026-10-06', label: '6 Oct 2026', kind: 'added' });
  assert.equal(photoDate({ ...photo, wpMeta: { created_timestamp: '0' } }).iso, '2026-10-06');
});

test('sorts newest first without mutation, with upload fallback and ID ties', () => {
  const photos = [
    { id: 5, wpMeta: { created_timestamp: Date.UTC(2025, 7, 31) / 1000 } },
    { id: 6, dateGmt: '2026-10-06T14:34:51' },
    { id: 8, wpMeta: { created_timestamp: Date.UTC(2026, 4, 3) / 1000 } },
    { id: 9, wpMeta: { created_timestamp: Date.UTC(2026, 4, 3) / 1000 } },
    { id: 10 },
    { id: 11 },
  ];
  const sorted = sortPhotosNewestFirst(photos);
  assert.deepEqual(sorted.map(({ id }) => id), [6, 9, 8, 5, 11, 10]);
  assert.deepEqual(photos.map(({ id }) => id), [5, 6, 8, 9, 10, 11]);
  assert.equal(photoDate(sorted[0]).kind, 'added');
  assert.equal(photoDate(sorted[1]).kind, 'taken');
});

test('rejects invalid dates and parses WordPress clocks deterministically', () => {
  const fallback = { dateGmt: '2026-02-30T14:00:00', date: '2024-02-29T23:30:00' };
  assert.deepEqual(photoDate({ ...fallback, wpMeta: { created_timestamp: 'Infinity' } }), { timestamp: Date.UTC(2024, 1, 29, 23, 30), iso: '2024-02-29', label: '29 Feb 2024', kind: 'added' });
  assert.equal(photoDate({ dateGmt: '2026-10-06T14:33:57Z' }).timestamp, Date.UTC(2026, 9, 6, 14, 33, 57));
  assert.deepEqual(photoDate({ date: '2026-05-03T24:00:00' }), { timestamp: -Infinity, iso: '', label: 'Date unknown', kind: 'unknown' });
});
