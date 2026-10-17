# Time Dissonance

A one-page site that works out how many clock-hours daylight saving has
skipped since you were born, with notes on relativity, solar storms and the
bugs in computer clocks. Live at https://time-dissonance.vercel.app.

React 19 and Vite. The page is `src/App.jsx`; the sums are in `src/lib/`
with tests next to them. Read the engineer skill in `.claude/skills/engineer`
before changing anything, and `write-like-trev` before writing any words.

## Checks

`npm run check` runs everything: ESLint, the unit tests, `dst:check`, the
build, the design system audit (`ds:audit:ci`, 15 allowed) and a Playwright
smoke test at 390px and 1280px. CI runs the same on every pull request and
push to `main`. Run it before you push and read the output.

## How it ships

Pull request to `main`, then Vercel deploys it. The footer shows the commit
the build came from, so check that against the sha you merged.

## Careful with

- The daylight saving dates. I say on the page that they're right, so they
  have to be. They come from `src/lib/dst-table.js`, which
  `npm run dst:generate` writes from the tz database in Node. Don't edit it
  by hand. If Node's tz database changes (`node -p process.versions.tz`),
  regenerate it, run the tests, and bump `.nvmrc` to match, because CI uses
  that exact Node to check the table.
- The region list in `src/lib/regions.js`. Each one follows a city in tzdb.
  Some zones (Amsterdam, Oslo, Stockholm, Copenhagen) now share another
  city's history before 1970, so they'd give wrong answers for those years.
  Check any new one against what actually happened there.
- Ages are worked out on the calendar in the viewer's time zone. Don't go
  back to dividing milliseconds by 365.25.
- `ds/` is copied in from obvious by `scripts/sync-ds.mjs`. Don't edit it.

## Leave alone

The starfield, the constellation clock and the hero text coming in line by
line are mine.
