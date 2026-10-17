# Time Dissonance

How many clock-hours daylight saving has skipped since you were born, plus the other ways clocks go wrong: relativity, solar storms and the shortcuts computers take with time. Live at https://time-dissonance.vercel.app.

Put in your date of birth, where you grew up and how often you fly. It shows your exact age ticking to the second, the hours the clocks skipped each time they went forward, how many nanoseconds younger flying has made you, the leap seconds you've lived through, how old you'll be when 32-bit Unix time runs out (03:14:07 UTC, 19 January 2038) and how long until the next skipped hour.

Below the calculator are short pieces on daylight saving, relativity, solar storms and computer time bugs, then a timeline that runs from Benjamin Franklin's candle joke in 1784 to the May 2024 storm.

## Running it

```
npm install
npm run dev      # local server
npm run check    # lint, tests, tz table check, build, design system audit, smoke test
```

It's React and Vite with no backend. Everything is worked out in the browser. It deploys to Vercel from `main`.

## How the numbers are worked out

**Hours skipped.** Every date comes from the IANA tz database, the file phones and browsers use to know when clocks change. `npm run dst:generate` reads each region's history out of Node's copy of it and writes `src/lib/dst-table.js`; the tests check that table against the database and against years with a known answer. It counts every time the clocks went forward after the day you were born, from 1900 on. Most of those are 1 hour, but the UK's wartime double summer time meant 2 jumps in some years.

Each region is a country, a US time zone or an Australian state, with a city in brackets. Before the 1960s the US set its clocks city by city and Europe country by country, so for those years the count follows that city. New York kept daylight saving from 1946 to 1966, for example, while Denver had none. If you pick somewhere the clocks never change, it's 0.

**Exact age.** Counted on the calendar in your own time zone, so a 23 or 25 hour day still counts as 1 day. If you were born on 29 February, your birthday comes round on 1 March in other years, as it does in UK law.

**Flying.** At cruising altitude, height makes your clock run about 1.09 × 10⁻¹³ seconds per second fast and speed makes it run about 3.13 × 10⁻¹³ slow. Speed wins, so you come out about 0.73 nanoseconds younger per hour in the air. Hours in the air are a guess from your age (counting from 18) and how often you said you fly.

**Leap seconds.** All 27 added since 1972, from IERS Bulletin C. None since 31 December 2016. It counts the ones on or after your date of birth.

**Solar storms.** Rated on NOAA's G-scale, G1 (minor) to G5 (extreme), with Carrington-class above that.

## Sources

Each card on the site links to its source. The ones behind the computer time section:

- [BIPM, 2022 CGPM Resolution 4](https://www.bipm.org/en/-/2022-11-18-cgpm-resolutions): the vote to stop adding leap seconds by 2035
- [Meta Engineering, "It's time to leave the leap second in the past"](https://engineering.fb.com/2022/07/25/production-engineering/its-time-to-leave-the-leap-second-in-the-past/): the Reddit (2012) and Cloudflare (2017) outages
- [The Register on Microsoft's "Y2K22" Exchange bug](https://www.theregister.com/software/2022/01/03/microsoft-patches-y2k-like-bug-in-on-prem-exchange-server/1513135)
- [Wikipedia, GPS week number rollover](https://en.wikipedia.org/wiki/GPS_week_number_rollover)
- [EFF, Astrolabe v. Olson](https://www.eff.org/cases/astrolabe-v-olson): the 2011 tz database lawsuit

## Design system

Colours, type, spacing, motion and the interaction components come from obvious, copied into `ds/` by `scripts/sync-ds.mjs` and stamped in `ds/.version`. Don't edit `ds/` by hand, because the next sync replaces it. The theme is Dissonance: Libre Baskerville for headings and Libre Franklin for everything else, loaded in `index.html`.

- `npm run ds:check` fails if `ds/` has fallen behind obvious
- `npm run ds:audit` shows what the app uses and what went around the system
- `npm run ds:audit:ci` is the same, with a limit of 15

`ds-proposals/` holds fixes and 2 components meant for obvious, and `transitions/` is the transitions.dev catalogue they came from. The app doesn't import either.
