/* The places you can pick under "Where did you grow up?".
 *
 * Each one is a zone in the IANA tz database, the file every phone and
 * browser uses to know when clocks change. scripts/gen-dst.mjs reads each
 * zone's history out of it and writes src/lib/dst-table.js.
 *
 * Why these zones:
 * - Before the 1960s and 70s, daylight saving was set country by country in
 *   Europe and city by city in the US, so there's no one "Continental
 *   Europe" or "United States" answer for those years. Each option is a
 *   country, a US time zone or an Australian state, and the city in brackets
 *   is the one whose clocks it follows.
 * - tzdb only keeps old history for one city per modern rule set. Amsterdam,
 *   Oslo, Stockholm and Copenhagen now share Brussels' or Berlin's pre-1970
 *   history, which is wrong for them, so they aren't offered.
 *
 * Keys are only used in this session (nothing is saved), so renaming one is
 * safe.
 */
export const REGIONS = [
  { key: "uk", label: "United Kingdom", zone: "Europe/London", group: "Europe" },
  { key: "ie", label: "Ireland", zone: "Europe/Dublin", group: "Europe" },
  { key: "fr", label: "France", zone: "Europe/Paris", group: "Europe" },
  { key: "de", label: "Germany", zone: "Europe/Berlin", group: "Europe" },
  { key: "it", label: "Italy", zone: "Europe/Rome", group: "Europe" },
  { key: "es", label: "Spain (mainland)", zone: "Europe/Madrid", group: "Europe" },
  { key: "be", label: "Belgium", zone: "Europe/Brussels", group: "Europe" },

  { key: "us-east", label: "US Eastern (New York)", zone: "America/New_York", group: "North America" },
  { key: "us-central", label: "US Central (Chicago)", zone: "America/Chicago", group: "North America" },
  { key: "us-mountain", label: "US Mountain (Denver)", zone: "America/Denver", group: "North America" },
  { key: "us-arizona", label: "Arizona (Phoenix)", zone: "America/Phoenix", group: "North America" },
  { key: "us-pacific", label: "US Pacific (Los Angeles)", zone: "America/Los_Angeles", group: "North America" },
  { key: "ca-east", label: "Canada Eastern (Toronto)", zone: "America/Toronto", group: "North America" },
  { key: "ca-pacific", label: "Canada Pacific (Vancouver)", zone: "America/Vancouver", group: "North America" },

  { key: "au-nsw", label: "New South Wales and ACT (Sydney)", zone: "Australia/Sydney", group: "Australia and New Zealand" },
  { key: "au-vic", label: "Victoria (Melbourne)", zone: "Australia/Melbourne", group: "Australia and New Zealand" },
  { key: "au-qld", label: "Queensland (Brisbane)", zone: "Australia/Brisbane", group: "Australia and New Zealand" },
  { key: "au-sa", label: "South Australia (Adelaide)", zone: "Australia/Adelaide", group: "Australia and New Zealand" },
  { key: "au-tas", label: "Tasmania (Hobart)", zone: "Australia/Hobart", group: "Australia and New Zealand" },
  { key: "au-wa", label: "Western Australia (Perth)", zone: "Australia/Perth", group: "Australia and New Zealand" },
  { key: "nz", label: "New Zealand", zone: "Pacific/Auckland", group: "Australia and New Zealand" },

  { key: "jp", label: "Japan", zone: "Asia/Tokyo", group: "Elsewhere" },
  { key: "in", label: "India", zone: "Asia/Kolkata", group: "Elsewhere" },
  { key: "none", label: "Somewhere the clocks never change", zone: null, group: "Elsewhere" },
];

export const REGION_BY_KEY = Object.fromEntries(REGIONS.map((r) => [r.key, r]));

export const DEFAULT_REGION = "uk";
