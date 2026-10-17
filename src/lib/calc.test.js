import { describe, expect, it } from "vitest";
import { calcDissonance, flightEstimate, formatPercent } from "./calc.js";

const at = (y, m, d, h = 0, mi = 0) => new Date(y, m - 1, d, h, mi);

describe("calcDissonance", () => {
  const now = at(2026, 10, 17, 12);
  it("turns down dates it can't use", () => {
    expect(calcDissonance("", "uk", "annual", now)).toBeNull();
    expect(calcDissonance("1899-12-31", "uk", "annual", now)).toBeNull();
    expect(calcDissonance("2026-10-18", "uk", "annual", now)).toBeNull();
  });
  it("works out a UK birth", () => {
    const r = calcDissonance("1990-07-04", "uk", "annual", now);
    expect(r).toMatchObject({ years: 36, months: 3, days: 13, jumps: 36, hoursSkipped: 36, minutesSkipped: 2160 });
    expect(r.nextJump.localDate).toEqual({ year: 2027, month: 3, day: 28 });
    expect(r.daysToNextJump).toBe(162);
  });
  it("counts a leap second on the day you were born", () => {
    expect(calcDissonance("2016-12-31", "uk", "never", now).leapSecondsLived).toBe(1);
    expect(calcDissonance("2017-01-01", "uk", "never", now).leapSecondsLived).toBe(0);
  });
  it("has no next jump somewhere the clocks never change", () => {
    const r = calcDissonance("1990-07-04", "none", "never", now);
    expect(r).toMatchObject({ jumps: 0, hoursSkipped: 0, nextJump: null, daysToNextJump: null, regionHasZone: false });
  });
});

describe("formatPercent", () => {
  // The old figure was 6 decimal places, like 0.010759%.
  it("gives 2 significant figures", () => {
    expect(formatPercent(40, 350000)).toBe("0.011");
    expect(formatPercent(72, 669214)).toBe("0.011");
    expect(formatPercent(0, 669214)).toBe("0");
  });
});

describe("flightEstimate", () => {
  it("counts flying from 18", () => {
    expect(flightEstimate("annual", 17)).toEqual({ nsYounger: 0, totalFlightHours: 0 });
    expect(flightEstimate("annual", 28)).toEqual({ nsYounger: 146, totalFlightHours: 200 });
  });
});
