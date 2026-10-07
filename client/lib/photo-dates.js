const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function parseDate(value) {
  if (typeof value !== "string") return null;
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z?)?$/,
  );
  if (!match) return null;
  const [
    ,
    year,
    month,
    day,
    hour = "0",
    minute = "0",
    second = "0",
    fraction = "0",
  ] = match;
  const parts = [year, month, day, hour, minute, second].map(Number);
  const date = new Date(0);
  // WordPress dates without an offset use a fixed clock, never the browser's zone.
  date.setUTCFullYear(parts[0], parts[1] - 1, parts[2]);
  date.setUTCHours(
    parts[3],
    parts[4],
    parts[5],
    Number(fraction.padEnd(3, "0")),
  );
  const actual = [
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
  ];
  return actual.every((part, index) => part === parts[index])
    ? date.getTime()
    : null;
}

function captureTimestamp(value) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const timestamp = Number(value) * 1000;
  return timestamp > 0 && Number.isFinite(new Date(timestamp).getTime())
    ? timestamp
    : null;
}

function dated(timestamp, kind) {
  const date = new Date(timestamp);
  return {
    timestamp,
    iso: date.toISOString().slice(0, 10),
    label: `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`,
    kind,
  };
}

/** Capture or upload dates from WordPress; no image reads. */
export function photoDate(photo, { mode = "taken" } = {}) {
  if (mode !== "uploaded") {
    const taken = captureTimestamp(photo.wpMeta?.created_timestamp);
    if (taken !== null) return dated(taken, "taken");
  }
  const added = parseDate(photo.dateGmt) ?? parseDate(photo.date);
  if (added !== null) return dated(added, "added");
  return {
    timestamp: Number.NEGATIVE_INFINITY,
    iso: "",
    label: "Date unknown",
    kind: "unknown",
  };
}

/** Return a new array; equal dates use descending WordPress attachment IDs. */
export function sortPhotosNewestFirst(photos, options) {
  return photos
    .map((photo) => ({ photo, timestamp: photoDate(photo, options).timestamp }))
    .sort(
      (a, b) =>
        b.timestamp - a.timestamp ||
        Number(b.photo.id) - Number(a.photo.id) ||
        0,
    )
    .map(({ photo }) => photo);
}
