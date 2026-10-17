import { calendarAge, dobProblem, parseLocalDate, yearsOldAt } from "./age.js";
import { nextJump, skippedSince } from "./dst.js";
import { REGION_BY_KEY } from "./regions.js";

export const FLIGHT_OPTIONS = [
  { key: "never",    label: "Never or almost never",  hoursPerYear: 0 },
  { key: "rare",     label: "Rarely (1 long-haul flight every few years)", hoursPerYear: 5 },
  { key: "annual",   label: "Once or twice a year",   hoursPerYear: 20 },
  { key: "frequent", label: "Several times a year",   hoursPerYear: 60 },
  { key: "heavy",    label: "Very often (for work, say)", hoursPerYear: 120 },
];

/* Every leap second ever inserted, per IERS Bulletin C. All 27 fall at the
   end of 30 June or 31 December, so day-level precision is enough for a date
   of birth. None since 2016, and they're due to stop by 2035. */
export const LEAP_SECOND_DATES = [
  "1972-06-30","1972-12-31","1973-12-31","1974-12-31","1975-12-31","1976-12-31",
  "1977-12-31","1978-12-31","1979-12-31","1981-06-30","1982-06-30","1983-06-30",
  "1985-06-30","1987-12-31","1989-12-31","1990-12-31","1992-06-30","1993-06-30",
  "1994-06-30","1995-12-31","1997-06-30","1998-12-31","2005-12-31","2008-12-31",
  "2012-06-30","2015-06-30","2016-12-31",
];

/* 32-bit signed Unix time overflows at 03:14:07 UTC on 19 January 2038. */
export const Y2038_MOMENT = new Date("2038-01-19T03:14:07Z");

/* At cruising altitude (about 10.7km, 900km/h) two effects compete.
   Altitude makes a clock run fast, about 1.09e-13 s per second; speed makes
   it run slow, about 3.13e-13. Speed wins, so per hour in the air you age
   about (3.13 - 1.09)e-13 * 3600 = 7.3e-10 s, or 0.73ns, less. */
export const NS_YOUNGER_PER_FLIGHT_HOUR = 0.73;

export function flightEstimate(flightKey, ageYears) {
  const opt = FLIGHT_OPTIONS.find((o) => o.key === flightKey) ?? FLIGHT_OPTIONS[0];
  const adultYears = Math.max(0, ageYears - 18);
  const totalFlightHours = adultYears * opt.hoursPerYear;
  return {
    nsYounger: Math.round(totalFlightHours * NS_YOUNGER_PER_FLIGHT_HOUR),
    totalFlightHours: Math.round(totalFlightHours),
  };
}

/* A share of a life as a percentage, to 2 significant figures. Someone with
   40 skipped hours out of 350,000 gets "0.011". */
export function formatPercent(part, whole) {
  if (!part || !whole) return "0";
  return Number(((part / whole) * 100).toPrecision(2)).toString();
}

/* Days on the calendar from today to a date, so a 23 or 25 hour day in
   between doesn't tip it over. */
function calendarDaysUntil({ year, month, day }, now) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((new Date(year, month - 1, day) - today) / 86400000);
}

/* Everything the results show. dob is "YYYY-MM-DD"; returns null if it
   isn't a usable date of birth. */
export function calcDissonance(dob, regionKey, flightKey, now = new Date()) {
  if (dobProblem(dob, now)) return null;
  const birth = parseLocalDate(dob);
  const region = REGION_BY_KEY[regionKey] ?? REGION_BY_KEY.none;

  const age = calendarAge(birth, now);
  const totalHours = Math.max(0, (now - birth) / 3600000);
  const skipped = region.zone ? skippedSince(region.key, dob, now) : { count: 0, hours: 0, seconds: 0 };
  const next = region.zone ? nextJump(region.key, now) : null;
  const { nsYounger, totalFlightHours } = flightEstimate(flightKey, age.years);

  return {
    ...age,
    regionKey: region.key,
    regionLabel: region.label,
    regionHasZone: Boolean(region.zone),
    jumps: skipped.count,
    hoursSkipped: skipped.hours,
    minutesSkipped: Math.round(skipped.seconds / 60),
    totalHours: Math.floor(totalHours),
    pctSkipped: formatPercent(skipped.hours, totalHours),
    nsYounger,
    totalFlightHours,
    nextJump: next,
    daysToNextJump: next ? calendarDaysUntil(next.localDate, now) : null,
    leapSecondsLived: LEAP_SECOND_DATES.filter((d) => d >= dob).length,
    y2038Age: yearsOldAt(birth, Y2038_MOMENT),
  };
}
