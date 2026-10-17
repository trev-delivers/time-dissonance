import { DST_TABLE } from "./dst-table.js";
import { REGION_BY_KEY } from "./regions.js";

const toDateNumber = (iso) => Number(iso.replaceAll("-", ""));

/* Every time the clocks went forward in a region after the day you were
   born, up to now. A jump on your birthday itself isn't counted, because we
   don't know what time you were born.

   dob is "YYYY-MM-DD". Returns the jumps and the total time skipped. */
export function skippedSince(regionKey, dob, now = new Date()) {
  const rows = DST_TABLE[regionKey] ?? [];
  const born = toDateNumber(dob);
  const nowSec = now.getTime() / 1000;
  const jumps = rows.filter(([date, utc]) => date > born && utc <= nowSec);
  const seconds = jumps.reduce((sum, [, , s]) => sum + s, 0);
  return { count: jumps.length, seconds, hours: seconds / 3600, jumps };
}

/* The next time the clocks go forward in a region, as a UTC Date and the
   local date it happens on, or null. */
export function nextJump(regionKey, now = new Date()) {
  const rows = DST_TABLE[regionKey] ?? [];
  const nowSec = now.getTime() / 1000;
  const row = rows.find(([, utc]) => utc > nowSec);
  if (!row) return null;
  const [date, utc] = row;
  const y = Math.floor(date / 10000), m = Math.floor(date / 100) % 100, d = date % 100;
  return { at: new Date(utc * 1000), localDate: { year: y, month: m, day: d } };
}

export function hasClockChanges(regionKey) {
  const region = REGION_BY_KEY[regionKey];
  return Boolean(region?.zone) && (DST_TABLE[regionKey]?.length ?? 0) > 0;
}
