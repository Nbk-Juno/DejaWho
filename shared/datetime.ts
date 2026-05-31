// Relative-date handling for spoken encounters.
//
// The encounter parser extracts a `dayOffset`: how many whole days BEFORE the
// recording day the encounter happened ("yesterday" → 1, "last week" → 7,
// "last month" → 30, no time wording → 0). The offset is applied against the
// recorder's own clock so the resulting calendar day is correct in their
// timezone, then serialized to UTC for storage.

const MAX_DAY_OFFSET = 365;

// Coerce an untrusted value (GPT output, JSON body) into a sane day offset:
// a whole number of days in [0, 365]. Anything non-numeric, negative (a future
// date — out of scope), or absurdly large collapses to a safe value.
export function clampDayOffset(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(Math.max(Math.trunc(n), 0), MAX_DAY_OFFSET);
}

// Resolve an encounter datetime from a relative day offset. Subtracts whole
// calendar days from `now` using local-time semantics (so the wall-clock time
// of day is preserved across month/DST boundaries and the date lands on the
// right day in the caller's timezone), then returns an ISO-8601 UTC string.
// `now` defaults to the current instant; it's injectable for testing.
export function datetimeFromDayOffset(value: unknown, now: Date = new Date()): string {
  const offset = clampDayOffset(value);
  const when = new Date(now.getTime());
  when.setDate(when.getDate() - offset);
  return when.toISOString();
}
