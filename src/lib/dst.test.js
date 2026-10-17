import { describe, expect, it } from "vitest";
import { DST_TABLE, FROM_YEAR, TO_YEAR } from "./dst-table.js";
import { REGIONS } from "./regions.js";
import { hasClockChanges, nextJump, skippedSince } from "./dst.js";

/* Local dates (YYYYMMDD) of the forward jumps in a region in a span of years. */
const jumpsIn = (key, from, to) =>
  DST_TABLE[key].map(([date]) => date).filter((d) => d >= from * 10000 && d < (to + 1) * 10000);

/* Independent of the table: the nth or last Sunday of a month, as YYYYMMDD. */
function sunday(year, month, which) {
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const sundays = [];
  for (let d = 1; d <= days; d++) if (new Date(Date.UTC(year, month - 1, d)).getUTCDay() === 0) sundays.push(d);
  const d = which === "last" ? sundays.at(-1) : sundays[which - 1];
  return year * 10000 + month * 100 + d;
}

const years = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

describe("the table", () => {
  it("covers every region with a zone", () => {
    for (const r of REGIONS) {
      if (r.zone) expect(DST_TABLE[r.key], r.key).toBeDefined();
      else expect(DST_TABLE[r.key], r.key).toBeUndefined();
    }
    expect(FROM_YEAR).toBe(1900);
    expect(TO_YEAR).toBeGreaterThanOrEqual(2030);
  });

  /* A second way of reading tzdb (the zone's offset name, not its wall
     clock) agrees with every row: the offset rises by exactly the recorded
     amount at exactly the recorded second. */
  it("matches the tz database at every jump", () => {
    const offsetName = (zone, sec) =>
      new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longOffset" })
        .formatToParts(new Date(sec * 1000)).find((p) => p.type === "timeZoneName").value;
    const seconds = (name) => {
      const m = /^GMT(?:([+-])(\d\d):(\d\d)(?::(\d\d))?)?$/.exec(name);
      if (!m[1]) return 0;
      return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 3600 + Number(m[3]) * 60 + Number(m[4] ?? 0));
    };
    for (const r of REGIONS.filter((x) => x.zone)) {
      for (const [, utc, skipped] of DST_TABLE[r.key]) {
        const before = seconds(offsetName(r.zone, utc - 1));
        const after = seconds(offsetName(r.zone, utc));
        expect(after - before, `${r.key} at ${utc}`).toBe(skipped);
      }
    }
  });
});

describe("Europe", () => {
  it("UK: British Summer Time all year from February 1968 to October 1971", () => {
    expect(jumpsIn("uk", 1968, 1972)).toEqual([19680218, 19720319]);
  });
  it("UK: double summer time in the war meant 2 jumps some years", () => {
    expect(jumpsIn("uk", 1941, 1941)).toEqual([19410504]);
    expect(jumpsIn("uk", 1947, 1947)).toEqual([19470316, 19470413]);
  });
  it("UK: last Sunday in March from 1981", () => {
    for (const y of years(1981, 2040)) expect(jumpsIn("uk", y, y), String(y)).toEqual([sunday(y, 3, "last")]);
  });
  // Replays the old bug: "Continental Europe" counted every March from 1946.
  it("Germany: no daylight saving from 1950 to 1979", () => {
    expect(jumpsIn("de", 1950, 1979)).toEqual([]);
    expect(jumpsIn("de", 1980, 1980)).toEqual([19800406]);
  });
  it("France: none from 1946 to 1975, back in 1976", () => {
    expect(jumpsIn("fr", 1946, 1975)).toEqual([]);
    expect(jumpsIn("fr", 1976, 1976)).toEqual([19760328]);
  });
  it("EU: last Sunday in March everywhere from 1996", () => {
    for (const key of ["uk", "ie", "fr", "de", "it", "es", "be"]) {
      for (const y of years(1996, 2040)) expect(jumpsIn(key, y, y), `${key} ${y}`).toEqual([sunday(y, 3, "last")]);
    }
  });
});

describe("North America", () => {
  // Replays the old bug: 1942 to 1945 was one jump (War Time ran all year),
  // and 1946 to 1966 had no federal daylight saving at all.
  it("War Time: 1 jump on 9 February 1942, then none until 1946", () => {
    for (const key of ["us-east", "us-central", "us-mountain", "us-pacific"]) {
      expect(jumpsIn(key, 1942, 1945), key).toEqual([19420209]);
    }
  });
  it("Denver kept no daylight saving from 1946 to 1964, as federal law had none", () => {
    expect(jumpsIn("us-mountain", 1946, 1964)).toEqual([]);
  });
  it("New York did keep it from 1946 to 1966, by local law", () => {
    expect(jumpsIn("us-east", 1946, 1966)).toHaveLength(21);
    expect(jumpsIn("us-east", 1950, 1950)).toEqual([19500430]);
  });
  it("Arizona hasn't changed its clocks since 1967", () => {
    expect(jumpsIn("us-arizona", 1968, 2040)).toEqual([]);
  });
  it("the 1974 and 1975 energy crisis started early", () => {
    expect(jumpsIn("us-east", 1974, 1975)).toEqual([19740106, 19750223]);
  });
  it("second Sunday in March from 2007", () => {
    for (const key of ["us-east", "us-central", "us-mountain", "us-pacific", "ca-east", "ca-pacific"]) {
      for (const y of years(2007, 2040)) expect(jumpsIn(key, y, y), `${key} ${y}`).toEqual([sunday(y, 3, 2)]);
    }
  });
});

describe("Australia, New Zealand and elsewhere", () => {
  // Replays the old bug: every year from 1944 to 1970 counted a March jump.
  it("New South Wales: none from 1944 to 1970, then October", () => {
    expect(jumpsIn("au-nsw", 1944, 1970)).toEqual([]);
    expect(jumpsIn("au-nsw", 1971, 1971)).toEqual([19711031]);
  });
  it("New South Wales: first Sunday in October from 2008", () => {
    for (const y of years(2008, 2040)) expect(jumpsIn("au-nsw", y, y), String(y)).toEqual([sunday(y, 10, 1)]);
  });
  it("Queensland: none since 1991", () => {
    expect(jumpsIn("au-qld", 1992, 2040)).toEqual([]);
  });
  it("Japan: only 1948 to 1951", () => {
    expect(DST_TABLE.jp.map(([d]) => Math.floor(d / 10000))).toEqual([1948, 1949, 1950, 1951]);
  });
});

describe("skippedSince", () => {
  const now = new Date("2026-10-17T12:00:00Z");
  // Replays the old bug: a 1950 birth in "Continental Europe" got 72 hours.
  it("Germany from mid-1950 is 47 jumps, 1980 to 2026", () => {
    expect(skippedSince("de", "1950-06-15", now)).toMatchObject({ count: 47, hours: 47 });
  });
  it("doesn't count a jump on the day you were born", () => {
    expect(skippedSince("uk", "2026-03-29", now).count).toBe(0);
    expect(skippedSince("uk", "2026-03-28", now).count).toBe(1);
  });
  it("doesn't count a jump that hasn't happened yet", () => {
    expect(skippedSince("uk", "2025-01-01", new Date("2026-03-29T00:59:59Z")).count).toBe(1);
    expect(skippedSince("uk", "2025-01-01", new Date("2026-03-29T01:00:00Z")).count).toBe(2);
  });
  it("is 0 for somewhere the clocks never change", () => {
    expect(skippedSince("none", "1950-01-01", now)).toMatchObject({ count: 0, hours: 0 });
    expect(hasClockChanges("none")).toBe(false);
  });
});

describe("nextJump", () => {
  it("UK after October 2026 is 28 March 2027", () => {
    expect(nextJump("uk", new Date("2026-10-17T12:00:00Z")).localDate).toEqual({ year: 2027, month: 3, day: 28 });
  });
  it("Sydney's next is in October", () => {
    expect(nextJump("au-nsw", new Date("2026-06-01T00:00:00Z")).localDate).toEqual({ year: 2026, month: 10, day: 4 });
  });
  it("is null where the clocks don't change any more", () => {
    expect(nextJump("jp", new Date("2026-01-01T00:00:00Z"))).toBeNull();
  });
});
