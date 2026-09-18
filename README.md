# Time Dissonance

A meditation on slipping hours. A single-page site about the ways time is quietly taken from you — by policy, by physics, by the sun, and by a handful of decades-old engineering shortcuts that are running out of road.

**Live site:** https://time-dissonance.vercel.app

---

## What it shows

### 1. Personal dissonance calculator

Enter your date of birth, where you grew up, and how often you fly. It works out:

- **Your exact age**, ticking live to the second
- **DST hours that didn't exist** — every spring the clocks skip forward and one hour simply wasn't there. Not lost, not stolen. Absent. Counts every spring-forward you've lived through, using historically accurate DST rules going back to 1916
- **Relativistic nanoseconds younger** — flying at altitude and speed means time runs fractionally slower for you than for someone who stayed on the ground. About 0.73 nanoseconds younger per flight hour
- **Leap seconds you've lived through** — out of the 27 ever inserted into UTC since 1972 (none since 2016, and the world has voted to stop adding them by 2035)
- **Your age when 32-bit Unix time overflows** — 03:14:07 UTC, 19 January 2038
- **Next spring forward** — how many days until the next hour that won't exist

### 2. DST

Where daylight saving came from, what it does to your body, why it no longer does what it promised, and why the hour you get back in autumn isn't the one that left.

### 3. Relativistic effects

The Hafele–Keating experiment (atomic clocks flown around the world on commercial jets), GPS satellites running 38 microseconds fast a day without relativistic correction, and what that means for anyone who's ever been on a plane.

### 4. Solar interference

How solar storms distort the infrastructure time depends on — GPS timing errors, power-grid frequency drift, and the 2012 near-miss that could have caused months of GPS failure worldwide.

### 5. Computing time bugs

The layer underneath all of the above: the engineering compromises baked into how computers represent time, several of which are already unwinding on a public schedule.

- **Leap seconds, retired by 2035** — the 2022 CGPM resolution to stop correcting UTC for Earth's spin, after leap seconds caused real outages (Reddit, 2012; Cloudflare, 2017)
- **The Year 2038 problem** — 32-bit signed Unix time running out of numbers, illustrated with a sibling bug that already hit Microsoft Exchange on 1 January 2022
- **GPS week-number rollover** — a 10-bit counter that resets every ~19.6 years (1999, 2019, and next in November 2038 — a coincidence, not a shared cause)
- **The 2011 lawsuit that nearly took the tz database offline** — the file that tells your phone when Berlin's clocks change, and the copyright claim over unrelated astrology tables that briefly shut down its mailing list and file server

### 6. Timeline

A chronological record of events that disrupted how time was experienced, from Benjamin Franklin's satirical essay in 1784 to the computing time bugs above.

---

## How the calculations work

### DST hours

Historically accurate DST rules for the UK, EU, US, Canada, Australia, and New Zealand, going back to each region's start date (UK: 1916, US: 1918, etc.). For each year between your birth and today, it checks whether a spring-forward occurred after your birth date; each one that did adds one hour to your total.

Regions without DST (Japan, India, most of Africa) show zero lost hours.

### Relativistic time dilation

At cruising altitude two relativistic effects compete:

- **Gravitational time dilation** — further from Earth's mass, clocks run slightly faster (~+1.09 × 10⁻¹³ per second)
- **Velocity time dilation** — moving fast, clocks run slightly slower (~-3.13 × 10⁻¹³ per second at 900km/h)

Velocity dominates on commercial flights, so passengers age fractionally less than people on the ground — a net difference of approximately **0.73 nanoseconds younger per flight hour**. Total flight hours are estimated from your age (counting from 18) and your stated flying frequency.

### Solar storms

Rated on the NOAA G-scale (G1 minor to G5+ Carrington-class). Historical events sourced from NASA and NOAA records.

### Leap seconds

All 27 leap seconds inserted into UTC since 1972 are stored as a fixed date list (per IERS Bulletin C — day-level precision, since date of birth is a plain date input). The calculator counts how many fall after your date of birth. None have been inserted since 31 December 2016.

### The Year 2038 problem

A fixed constant: 03:14:07 UTC, 19 January 2038 — the moment a 32-bit signed integer counting seconds since 1 January 1970 overflows. Your age at that moment is computed directly from your date of birth.

---

## Sources

Every claim on the site links to its source inline, but the ones behind the newer computing-time section specifically:

- [BIPM — 2022 CGPM Resolution 4](https://www.bipm.org/en/-/2022-11-18-cgpm-resolutions) — the decision to retire leap seconds by 2035
- [Meta Engineering — "It's time to leave the leap second in the past"](https://engineering.fb.com/2022/07/25/production-engineering/its-time-to-leave-the-leap-second-in-the-past/) — the Reddit (2012) and Cloudflare (2017) leap-second outages
- [The Register — Microsoft's "Y2K22" Exchange bug](https://www.theregister.com/software/2022/01/03/microsoft-patches-y2k-like-bug-in-on-prem-exchange-server/1513135)
- [Wikipedia — GPS week number rollover](https://en.wikipedia.org/wiki/GPS_week_number_rollover)
- [EFF — Astrolabe, Inc. v. Olson](https://www.eff.org/cases/astrolabe-v-olson) — the 2011 tz database lawsuit

---

## Design system

The look is not this repo's. Colour, type, spacing, motion and the interaction
components all come from [obvious](https://github.com/trev-delivers/obvious),
vendored into `ds/` by `scripts/sync-ds.mjs` and stamped in `ds/.version`.
Nothing in `ds/` is edited here — the sync deletes and re-copies the folder, so
edits there last until the next pull and no longer.

- `npm run ds:check` — fail if the vendored copy has drifted from upstream
- `npm run ds:audit` — what the app uses, and what went around the system
- `npm run ds:audit:ci` — the same, against a bypass budget

`ds-proposals/` is design system work found while building this app that
belongs upstream rather than here — fixes to broken components and two new
ones adapted from [transitions.dev](https://transitions.dev) recipes. Each
file is written to be lifted into `obvious` and deleted from here once it
lands; `ds-proposals/README.md` has the detail and the promotion steps.

`transitions/` is the vendored free transitions.dev catalogue
(`npx transitions-dev add --free`), kept in-repo so every component in
`ds-proposals/` can point at the recipe it came from.

## Tech

React + Vite, no backend and no external data dependencies — every calculation runs client-side, in your browser.

```
npm install
npm run dev      # local dev server
npm run build    # production build → dist/
```

Deployed on Vercel, auto-deploying from `main`.
