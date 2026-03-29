# Time Dissonance

A meditation on slipping hours. A single-page website exploring the ways time is quietly taken from you — by policy, physics, and the sun.

**Live site:** https://time-dissonance.netlify.app

---

## What it shows

### 1. Personal dissonance calculator

Enter your date of birth, where you grew up, and how often you fly. The calculator works out:

- **Your exact age** to the second, ticking live
- **DST hours that didn't exist** — every spring the clocks skip forward and one hour simply wasn't there. Not lost, not stolen. Absent. The calculator counts every spring forward you've lived through, using historically accurate DST rules going back to 1916
- **Relativistic nanoseconds younger** — flying at altitude and speed means time runs fractionally slower for you. At cruising altitude (~35,000ft, ~900km/h), velocity time dilation slightly outweighs the gravitational effect, so you arrive fractionally younger than a version of yourself who stayed home. About 0.73 nanoseconds younger per flight hour
- **Next spring forward** — how many days until the next hour that won't exist

### 2. DST explanation

The history and mechanics of daylight saving time: where it came from, what it does to your body, why it no longer does what it promised, and why the hour you get back in autumn isn't the one that left.

### 3. Relativistic effects

How time dilation works in practice: the Hafele-Keating experiment (atomic clocks on commercial flights), GPS satellites running 38 microseconds fast per day without Einstein corrections, and what this means for anyone who has ever been on a plane.

### 4. Solar interference

How solar storms distort the infrastructure time depends on — GPS timing errors, power grid frequency drift, and the 2012 near-miss that could have caused months of GPS failure worldwide.

### 5. Timeline

A chronological record of events that disrupted how time was experienced, from Benjamin Franklin's satirical essay in 1784 to the G5 solar storm of May 2024.

---

## How the calculations work

### DST hours

The app contains historically accurate DST rules for the UK, EU, US, Canada, Australia, and New Zealand, going back to their respective start dates (UK: 1916, US: 1918, etc.). For each year between your birth and today, it checks whether a spring forward occurred after your birth date. Each one that did adds one hour to your total.

Regions without DST (Japan, India, most of Africa) show zero lost hours.

### Relativistic time dilation

At cruising altitude two relativistic effects compete:

- **Gravitational time dilation** — further from Earth's mass, clocks run slightly faster (~+1.09 × 10⁻¹³ per second)
- **Velocity time dilation** — moving fast, clocks run slightly slower (~-3.13 × 10⁻¹³ per second at 900km/h)

Velocity dominates on commercial flights, so passengers age fractionally less than people on the ground. The net difference is approximately **0.73 nanoseconds younger per flight hour**.

The app estimates total flight hours based on your age (counting from 18) and your stated frequency, then multiplies by 0.73ns.

### Solar storms

Rated on the NOAA G-scale (G1 minor to G5+ Carrington-class). Historical events are sourced from NASA and NOAA records.

---

## Tech

Built with React and Vite. No external data dependencies — all calculations run client-side.

```
npm install
npm run dev      # local dev server
npm run build    # production build → dist/
```

Deployed via Netlify.
