import { describe, expect, it } from "vitest";
import { calendarAge, dobProblem, localISODate, parseLocalDate, yearsOldAt } from "./age.js";

const at = (y, m, d, h = 0, mi = 0, s = 0) => new Date(y, m - 1, d, h, mi, s);

describe("parseLocalDate", () => {
  it("is local midnight, not UTC midnight", () => {
    const d = parseLocalDate("1990-07-04");
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([1990, 6, 4, 0]);
  });
  it("rejects dates that don't exist", () => {
    expect(parseLocalDate("2023-02-29")).toBeNull();
    expect(parseLocalDate("1990-13-01")).toBeNull();
    expect(parseLocalDate("")).toBeNull();
  });
  it("accepts 29 February in a leap year", () => {
    expect(parseLocalDate("2000-02-29")?.getDate()).toBe(29);
  });
});

describe("dobProblem", () => {
  const now = at(2026, 10, 17, 9);
  it("asks for a date when there isn't one", () => expect(dobProblem("", now)).toBe("empty"));
  it("accepts 1 January 1900 and today", () => {
    expect(dobProblem("1900-01-01", now)).toBeNull();
    expect(dobProblem("2026-10-17", now)).toBeNull();
  });
  // The old message said "between 1900 and today" but 1899 went through.
  it("rejects 1899 and tomorrow, as the message says", () => {
    expect(dobProblem("1899-12-31", now)).toBe("range");
    expect(dobProblem("2026-10-18", now)).toBe("range");
  });
  it("uses the local date for today, not the UTC one", () => {
    // 00:30 on 1 July in London is still 30 June in UTC.
    expect(localISODate(at(2026, 7, 1, 0, 30))).toBe("2026-07-01");
    expect(dobProblem("2026-07-01", at(2026, 7, 1, 0, 30))).toBeNull();
  });
});

describe("calendarAge", () => {
  // Replays the old bug: born 15 June 1950, on 17 October 2026 the average
  // year and month lengths gave 76y 4m 3d instead of 4m 2d.
  it("counts calendar months and days", () => {
    const a = calendarAge(parseLocalDate("1950-06-15"), at(2026, 10, 17, 22, 32, 2));
    expect(a).toMatchObject({ years: 76, months: 4, days: 2, hours: 22, minutes: 32, seconds: 2 });
  });
  it("turns a year older at midnight on the birthday", () => {
    const b = parseLocalDate("1990-03-10");
    expect(calendarAge(b, at(2020, 3, 9, 23, 59, 59))).toMatchObject({ years: 29, months: 11, days: 28 });
    expect(calendarAge(b, at(2020, 3, 10, 0, 0, 0))).toMatchObject({ years: 30, months: 0, days: 0 });
  });
  it("is 0 on the day you're born", () => {
    expect(calendarAge(parseLocalDate("2026-10-17"), at(2026, 10, 17, 8))).toMatchObject({ years: 0, months: 0, days: 0, hours: 8 });
  });
  it("dates a leap-day birthday to 1 March in other years", () => {
    const b = parseLocalDate("2000-02-29");
    expect(calendarAge(b, at(2001, 2, 28, 12))).toMatchObject({ years: 0, months: 11, days: 30 });
    expect(calendarAge(b, at(2001, 3, 1))).toMatchObject({ years: 1, months: 0, days: 0 });
    expect(calendarAge(b, at(2004, 2, 29))).toMatchObject({ years: 4, months: 0, days: 0 });
  });
  it("handles a birthday on the 31st in a short month", () => {
    const b = parseLocalDate("1990-01-31");
    expect(calendarAge(b, at(1990, 2, 28))).toMatchObject({ years: 0, months: 0, days: 28 });
    expect(calendarAge(b, at(1990, 3, 1))).toMatchObject({ years: 0, months: 1, days: 0 });
    expect(calendarAge(b, at(1990, 3, 31))).toMatchObject({ years: 0, months: 2, days: 0 });
  });
  // 29 March 2026 had 23 hours in London and 25 October 2026 has 25. Dividing
  // milliseconds by 24 hours drifts a day either side of them.
  it("counts a 23-hour day as 1 day", () => {
    const b = parseLocalDate("2026-03-28");
    expect(calendarAge(b, at(2026, 3, 30, 0, 0, 0))).toMatchObject({ months: 0, days: 2, hours: 0 });
    expect(calendarAge(b, at(2026, 3, 29, 23, 59, 0))).toMatchObject({ days: 1, hours: 23 });
  });
  it("counts a 25-hour day as 1 day", () => {
    const b = parseLocalDate("2026-10-24");
    expect(calendarAge(b, at(2026, 10, 26, 0, 0, 0))).toMatchObject({ days: 2, hours: 0 });
    expect(calendarAge(b, at(2026, 10, 25, 23, 0, 0))).toMatchObject({ days: 1, hours: 23 });
  });
  it("shows the time on the clock on the spring-forward day", () => {
    // 02:00 to 03:00 didn't happen, so 03:30 is 2.5 real hours after midnight.
    const a = calendarAge(parseLocalDate("2000-01-01"), at(2026, 3, 29, 3, 30));
    expect(a).toMatchObject({ hours: 3, minutes: 30 });
  });
});

describe("yearsOldAt", () => {
  it("works out the age in January 2038", () => {
    expect(yearsOldAt(parseLocalDate("1990-01-19"), new Date("2038-01-19T03:14:07Z"))).toBe(48);
    expect(yearsOldAt(parseLocalDate("1990-01-20"), new Date("2038-01-19T03:14:07Z"))).toBe(47);
  });
});
