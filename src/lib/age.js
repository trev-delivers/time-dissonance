/* Dates of birth and ages, worked out on the calendar in the viewer's own
   time zone rather than by dividing milliseconds by an average year. */

export const EARLIEST_DOB = "1900-01-01";

/* "YYYY-MM-DD" as midnight local time. new Date("YYYY-MM-DD") would give
   midnight UTC, which is the day before for anyone west of Greenwich. */
export function parseLocalDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]) - 1, d = Number(m[3]);
  const date = new Date(y, mo, d);
  date.setFullYear(y); // years 0 to 99 would otherwise land in the 1900s
  if (date.getFullYear() !== y || date.getMonth() !== mo || date.getDate() !== d) return null;
  return date;
}

/* Today's date in local time as "YYYY-MM-DD", for the input's max. */
export function localISODate(date = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

/* What's wrong with a date of birth, or null if it's fine. Born today is
   fine. */
export function dobProblem(iso, now = new Date()) {
  if (!iso) return "empty";
  const birth = parseLocalDate(iso);
  if (!birth) return "invalid";
  if (iso < EARLIEST_DOB || iso > localISODate(now)) return "range";
  return null;
}

const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();

/* The date `months` calendar months after a birth date. When that month is
   too short (born on the 31st, or on 29 February), it's the 1st of the next
   month, which is how UK law dates a leap-day birthday. */
function monthsAfter(birth, months) {
  const total = birth.getMonth() + months;
  const y = birth.getFullYear() + Math.floor(total / 12);
  const m = ((total % 12) + 12) % 12;
  const d = birth.getDate();
  if (d > daysInMonth(y, m)) return new Date(y, m + 1, 1);
  return new Date(y, m, d);
}

/* Age in calendar years, months and days, plus the time of day on the
   viewer's clock. birth is a local-midnight Date. */
export function calendarAge(birth, now = new Date()) {
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (monthsAfter(birth, months) > now) months -= 1;
  while (monthsAfter(birth, months + 1) <= now) months += 1;
  const anchor = monthsAfter(birth, months);
  /* Count days on the calendar, so a 23 or 25 hour day still counts as 1. */
  let days = 0;
  const cursor = new Date(anchor);
  for (;;) {
    const next = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
    if (next > now) break;
    days += 1;
    cursor.setTime(next.getTime());
  }
  return {
    years: Math.floor(months / 12),
    months: months % 12,
    days,
    hours: now.getHours(),
    minutes: now.getMinutes(),
    seconds: now.getSeconds(),
  };
}

/* Whole years old at a moment. */
export function yearsOldAt(birth, moment) {
  return calendarAge(birth, moment).years;
}
