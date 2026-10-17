import { useState, useEffect, useRef, useCallback } from "react";
import Starfield from "./Starfield.jsx";
import { REGIONS, REGION_BY_KEY, DEFAULT_REGION } from "./lib/regions.js";
import { nextJump, skippedSince } from "./lib/dst.js";

/* The region list as [group, regions] pairs for the <optgroup>s. */
const REGION_GROUPS = [...new Set(REGIONS.map(r => r.group))].map(g => [g, REGIONS.filter(r => r.group === g)]);

/* Hours skipped are whole except where a zone jumped by half an hour. */
const fmtHours = h => Number.isInteger(h) ? h.toLocaleString("en-GB") : h.toLocaleString("en-GB", { maximumFractionDigits: 1 });


// ─────────────────────────────────────────────────────────────
// FLIGHT FREQUENCY OPTIONS
// ─────────────────────────────────────────────────────────────
const FLIGHT_OPTIONS = [
  { key: "never",    label: "Never or almost never",  hoursPerYear: 0 },
  { key: "rare",     label: "Rarely (1 long-haul flight every few years)", hoursPerYear: 5 },
  { key: "annual",   label: "Once or twice a year",   hoursPerYear: 20 },
  { key: "frequent", label: "Several times a year",   hoursPerYear: 60 },
  { key: "heavy",    label: "Very often (for work, say)", hoursPerYear: 120 },
];

// ─────────────────────────────────────────────────────────────
// LEAP SECONDS — every one ever inserted, per IERS Bulletin C.
// All 27 fall at the end of 30 June or 31 December; day-level
// precision is enough since date-of-birth is a plain date input.
// None have been added since 2016, and none will be again once the
// 2035 phase-out lands (see the Computing Time section below).
// ─────────────────────────────────────────────────────────────
const LEAP_SECOND_DATES = [
  "1972-06-30","1972-12-31","1973-12-31","1974-12-31","1975-12-31","1976-12-31",
  "1977-12-31","1978-12-31","1979-12-31","1981-06-30","1982-06-30","1983-06-30",
  "1985-06-30","1987-12-31","1989-12-31","1990-12-31","1992-06-30","1993-06-30",
  "1994-06-30","1995-12-31","1997-06-30","1998-12-31","2005-12-31","2008-12-31",
  "2012-06-30","2015-06-30","2016-12-31",
].map(d => new Date(d + "T00:00:00Z"));

// The moment 32-bit signed Unix time overflows: 03:14:07 UTC, 19 January 2038.
const Y2038_MOMENT = new Date("2038-01-19T03:14:07Z");

// Relativistic time dilation estimate
// At cruising altitude ~35,000ft (~10,700m), two effects compete:
// Gravitational: clocks run faster (altitude above Earth) → +ve aging
// Velocity: clocks run slower (speed ~900km/h) → -ve aging
// Net: gravitational dominates slightly → you age *slightly* more than if on ground
// Δt_grav ≈ g*h/c² per second ≈ 1.09e-13 per second at 10km
// Δt_vel ≈ v²/(2c²) per second ≈ 3.13e-13 per second at 900km/h
// Net: velocity dominates on planes → you age slightly LESS
// Per flight hour: ~(3.13-1.09)e-13 * 3600 ≈ 7.3e-10 seconds younger = ~0.73ns younger
// We present as "you are X nanoseconds younger than your grounded twin"
function calcRelativisticNS(flightKey, ageYears) {
  const opt = FLIGHT_OPTIONS.find(o => o.key === flightKey) || FLIGHT_OPTIONS[0];
  const adultYears = Math.max(0, ageYears - 18);
  const totalFlightHours = adultYears * opt.hoursPerYear;
  // Net: velocity dominates, you're slightly YOUNGER
  const nsYounger = Math.round(totalFlightHours * 0.73);
  return { nsYounger, totalFlightHours: Math.round(totalFlightHours) };
}

// ─────────────────────────────────────────────────────────────
// MAIN CALCULATION
// ─────────────────────────────────────────────────────────────
function calcDissonance(dob, region, flightKey) {
  const now = new Date();
  const birth = new Date(dob);
  if (isNaN(birth) || birth >= now) return null;

  const reg = REGION_BY_KEY[region] ?? REGION_BY_KEY.none;
  const skipped = reg.zone ? skippedSince(reg.key, dob, now) : { count: 0, hours: 0, seconds: 0 };
  const hoursStolen = skipped.hours;

  const msAlive = now - birth;
  const totalHours = msAlive / 3600000;
  const totalDays = msAlive / 86400000;
  const years = Math.floor(totalDays / 365.25);
  const rem = totalDays - years * 365.25;
  const months = Math.floor(rem / 30.44);
  const days = Math.floor(rem - months * 30.44);
  const hours = Math.floor((msAlive % 86400000) / 3600000);
  const minutes = Math.floor((msAlive % 3600000) / 60000);
  const seconds = Math.floor((msAlive % 60000) / 1000);

  const pctStolen = hoursStolen > 0 ? ((hoursStolen / totalHours) * 100).toFixed(6) : "0.000000";

  const { nsYounger, totalFlightHours } = calcRelativisticNS(flightKey, years);

  const next = reg.zone ? nextJump(reg.key, now) : null;
  const nextSpring = next ? new Date(next.localDate.year, next.localDate.month - 1, next.localDate.day) : null;
  const daysToNextSteal = next ? Math.ceil((next.at - now) / 86400000) : null;

  const leapSecondsLived = LEAP_SECOND_DATES.filter(ls => ls > birth).length;
  const y2038Age = Math.floor((Y2038_MOMENT - birth) / (365.25 * 86400000));

  return {
    years, months, days, hours, minutes, seconds,
    hoursStolen, jumps: skipped.count, minutesStolen: Math.round(skipped.seconds / 60),
    totalHours: Math.floor(totalHours),
    pctStolen,
    nsYounger, totalFlightHours,
    daysToNextSteal, nextSpring,
    regionNoDST: skipped.count === 0,
    regionHasZone: Boolean(reg.zone),
    regionLabel: reg.label,
    leapSecondsLived, y2038Age,
  };
}

// ─────────────────────────────────────────────────────────────
// COMBINED TIMELINE (historical + solar)
// ─────────────────────────────────────────────────────────────
const HISTORY_EVENTS = [
  { date: "1784-01-01", label: "Franklin's satire", type: "history", desc: "Benjamin Franklin writes a tongue-in-cheek essay suggesting Parisians could save candles by waking at dawn. He means it as a joke. It is later cited, without irony, in favour of daylight saving." },
  { date: "1859-09-01", label: "Carrington event", type: "solar", severity: "G5+", desc: "The most powerful geomagnetic storm on record. Telegraph systems caught fire. Operators received electric shocks. Auroras visible at the equator." },
  { date: "1884-01-01", label: "GMT standardised", type: "history", desc: "The International Meridian Conference establishes Greenwich Mean Time as the global baseline. Before this, every town kept its own local solar time." },
  { date: "1905-01-01", label: "Einstein's special relativity", type: "history", desc: "Time isn't fixed. A moving clock runs slower than one standing still." },
  { date: "1916-01-01", label: "Daylight saving first adopted", type: "history", desc: "Germany and Britain introduce daylight saving to reduce wartime coal consumption. The argument has not meaningfully improved since." },
  { date: "1921-05-15", label: "New York railroad storm", type: "solar", severity: "G5+", desc: "One of the largest geomagnetic storms of the 20th century. Telegraph and telephone systems across North America and Europe severely disrupted." },
  { date: "1938-01-21", label: "Great aurora storm", type: "solar", severity: "G5", desc: "Visible as far south as Portugal. Disrupted radio and early aviation navigation. One of the largest storms of the pre-Space Age era." },
  { date: "1958-02-10", label: "February 1958 superstorm", type: "solar", severity: "G5", desc: "One of the largest storms of the Space Age. Widespread power and communications disruptions across Canada and the northern US." },
  { date: "1971-01-01", label: "Hafele–Keating experiment", type: "history", desc: "Atomic clocks flown around the world confirm relativistic time dilation. Moving clocks really do run slow." },
  { date: "1972-08-04", label: "August 1972 storm", type: "solar", severity: "G5", desc: "Caused accidental detonation of US naval mines off Vietnam due to magnetic field disruption. Also knocked out AT&T long-lines communications." },
  { date: "1989-03-13", label: "Quebec blackout", type: "solar", severity: "G5", desc: "Knocked out power across Quebec for 9 hours, leaving 6 million people without electricity. Auroras visible in Texas. Transformer damage took months to repair." },
  { date: "1998-01-01", label: "Leap second disputes begin", type: "history", desc: "Atomic clocks now so precise they outpace Earth's irregular rotation. Leap seconds are added now and then, and software keeps tripping over them." },
  { date: "1999-08-21", label: "First GPS week rollover", type: "computing", desc: "GPS's 10-bit week counter hits 1,024 and resets to zero. Some early receivers lose track of the date entirely. Hardly anyone else notices." },
  { date: "2000-07-14", label: "Bastille Day event", type: "solar", severity: "G5", desc: "X5.7 flare launched a CME directly at Earth. Disrupted satellites, caused radio blackouts, and produced auroras across Europe. Observed by both Voyager spacecraft." },
  { date: "2003-10-29", label: "Halloween storms", type: "solar", severity: "G5", desc: "17 major flares over two weeks. Two G5 events. The X28 flare on 4 November may be the largest ever measured. Power grid fluctuations across Europe and North America." },
  { date: "2011-10-14", label: "tz database saved by ICANN", type: "computing", desc: "Weeks after a lawsuit over unrelated astrology data forced the timezone database's mailing list and file server offline, ICANN takes over stewardship. The case is dropped the following February." },
  { date: "2012-07-23", label: "Near miss (Carrington-class)", type: "solar", severity: "G5+", desc: "A CME erupted but missed Earth by 9 days. Scientists estimate it would have caused $2 trillion in damage to global infrastructure if it had hit." },
  { date: "2015-03-17", label: "St Patrick's Day storm", type: "solar", severity: "G4", desc: "The strongest storm of Solar Cycle 24. Disrupted GPS signals globally and produced auroras visible across the UK and northern US." },
  { date: "2017-09-06", label: "X9.3 flare", type: "solar", severity: "G3", desc: "Largest solar flare of Solar Cycle 24. Significant radio blackouts across Europe, Africa, and the Atlantic. GPS and navigation affected." },
  { date: "2019-04-06", label: "Second GPS week rollover", type: "computing", desc: "The 1,024-week counter resets again. A KLM flight is delayed by faulty flight-management software, New York's public wireless network crashes, and some Honda dashboards and GoPro drones forget what year it is." },
  { date: "2022-11-18", label: "Leap seconds voted out", type: "computing", desc: "The General Conference on Weights and Measures resolves to stop inserting leap seconds by 2035, after tech companies lobbied that the correction causes more outages than it prevents." },
  { date: "2024-05-10", label: "Gannon storm", type: "solar", severity: "G5", desc: "Strongest geomagnetic storm since 2003. Auroras visible across the UK and as far south as Florida. GPS errors disrupted automated farm equipment. Radio blackouts affected aviation." },
];

/* NOAA's G-scale, with a plain note per rating for the tooltip. */
const SEVERITY = {
  "G5+": { cls: "g5plus", note: "Carrington-class, beyond the top of the scale" },
  "G5":  { cls: "g5",     note: "Extreme: grid collapse and satellite damage" },
  "G4":  { cls: "g4",     note: "Severe: voltage control problems, GPS degraded" },
  "G3":  { cls: "g3",     note: "Strong: surface charging, navigation errors" },
  "G2":  { cls: "g2",     note: "Moderate: high-latitude power systems affected" },
};

// ─────────────────────────────────────────────────────────────
// STYLES
// Fonts are loaded in index.html. Keep comments out of this string:
// it ships in the bundle as-is.
// ─────────────────────────────────────────────────────────────
const styles = `
  *{box-sizing:border-box;margin:0;padding:0}

  :root{
    --bg0:var(--ds-color-bg);
    --bg1:var(--ds-color-bg-alt);
    --bg2:var(--ds-color-surface);
    --border:var(--ds-color-border);
    --border-hi:var(--ds-color-border-strong);
    --text-primary:var(--ds-color-text);
    --text-secondary:var(--ds-color-text-dim);
    --text-dim:var(--ds-color-text-muted);
    --amber:var(--ds-color-accent);
    --amber-hi:var(--ds-color-accent-hover);
    --cold:var(--ds-color-info);
    --green:var(--ds-color-success);
    --star-cold:color-mix(in srgb,var(--ds-color-text) 70%,var(--ds-color-info));
    --star-warm:color-mix(in srgb,var(--ds-color-accent-hover) 70%,var(--ds-color-text));
  }

  .t-tt-wrap:hover .t-tt,.t-tt-wrap:focus-within .t-tt{opacity:1;transform:translateY(0) scale(1)}
  .t-tt{background:var(--ds-color-surface-raised);border-color:var(--ds-color-border);color:var(--ds-color-text-dim);font-family:var(--ds-font-sans);font-size:var(--ds-type-label-size);box-shadow:0 12px 26px -14px var(--ds-color-shadow-color)}
  .t-think{--think-base:var(--ds-color-text-muted);--think-highlight:var(--ds-color-text)}
  .t-stagger{--stagger-dur:var(--ds-duration-slow);--stagger-ease:var(--ds-ease-out)}
  .t-stagger .t-stagger-line:nth-child(2){transition-delay:var(--stagger-stagger)}
  .t-stagger .t-stagger-line:nth-child(3){transition-delay:calc(var(--stagger-stagger) * 2)}

  @keyframes td-enter{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}

  .td-label{font-family:var(--ds-font-sans);font-size:var(--ds-type-label-size);line-height:var(--ds-type-label-leading);font-weight:var(--ds-type-label-weight);letter-spacing:0}
  .td-num{font-variant-numeric:tabular-nums}

  .td-progress{position:fixed;top:0;left:0;height:2px;background:var(--amber-hi);z-index:200;transform-origin:0 50%;width:100%}

  .td-root{background:var(--bg0);color:var(--text-primary);font-family:var(--ds-font-sans);font-size:var(--ds-type-body-size);line-height:var(--ds-type-body-leading);font-weight:400;min-height:100vh;overflow-x:hidden;position:relative}
  .td-canvas{position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0}
  .td-main{position:relative;z-index:2}

  .td-banner{background:color-mix(in srgb,var(--bg1) 92%,transparent);backdrop-filter:blur(10px);border-bottom:1px solid var(--border);padding:0.6rem 1.4rem;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:100;color:var(--text-dim)}
  .td-live{color:var(--amber-hi);font-variant-numeric:tabular-nums}

  .td-hero{min-height:100svh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:4rem 1.5rem 5rem;position:relative;--stagger-stagger:300ms}
  .td-hero-lines{display:flex;flex-direction:column;align-items:center}
  .td-title{font-family:var(--ds-font-display);font-size:clamp(3rem,16vw,7rem);font-weight:400;line-height:0.95;letter-spacing:-0.02em;color:var(--text-primary)}
  .td-title-em{font-style:italic;color:var(--amber-hi);display:block}
  .td-sub{font-family:var(--ds-font-display);font-size:clamp(1rem,3.5vw,1.2rem);color:var(--text-secondary);max-width:520px;line-height:1.8;margin-top:1.8rem;font-style:italic}
  .td-clock-wrap{margin-top:2rem;position:relative}
  .td-clock{overflow:visible}
  .td-clock-rim{fill:none;stroke:color-mix(in srgb,var(--border-hi) 25%,transparent);stroke-width:0.5;stroke-dasharray:2 6}
  .td-clock-const{stroke:color-mix(in srgb,var(--text-dim) 12%,transparent);stroke-width:0.6}
  .td-clock-hour{stroke:color-mix(in srgb,var(--text-primary) 35%,transparent);stroke-width:1.2;stroke-linecap:round;stroke-dasharray:3 5}
  .td-clock-min{stroke:color-mix(in srgb,var(--amber-hi) 45%,transparent);stroke-width:0.9;stroke-linecap:round;stroke-dasharray:1 4}
  .td-clock-star{fill:var(--star-cold)}
  .td-clock-sec{fill:var(--amber-hi)}
  .td-clock-halo{fill:none;stroke:color-mix(in srgb,var(--amber-hi) 25%,transparent);stroke-width:0.8}
  .td-clock-centre{fill:color-mix(in srgb,var(--text-primary) 90%,transparent)}

  .td-calc-wrap{background:var(--bg1);border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
  .td-calc-inner{max-width:900px;margin:0 auto;padding:clamp(3rem,8vh,5rem) clamp(1.2rem,5vw,4rem)}

  .td-h2{font-family:var(--ds-font-display);font-size:clamp(1.8rem,7vw,3rem);font-weight:400;color:var(--text-primary);line-height:1.1;margin-bottom:0.8rem}
  .td-h2 em{font-style:italic;color:var(--amber-hi)}
  .td-intro{font-family:var(--ds-font-display);font-size:clamp(1rem,3vw,1.1rem);color:var(--text-secondary);line-height:1.85;margin-bottom:2rem;max-width:620px;font-style:italic}

  .td-steps{display:flex;flex-direction:column;gap:2rem;margin-bottom:2rem}
  .td-step-label{color:var(--text-secondary);margin-bottom:0.6rem;display:flex;align-items:center;gap:0.6rem}
  .td-step-label::before{content:attr(data-n);display:inline-flex;align-items:center;justify-content:center;width:1.5rem;height:1.5rem;border:1px solid var(--border-hi);border-radius:50%;font-size:var(--ds-text-xs);font-variant-numeric:tabular-nums;color:var(--amber);flex-shrink:0}

  .td-input-row{display:flex;gap:1rem;align-items:flex-end;flex-wrap:wrap}
  .td-input-group{display:flex;flex-direction:column;gap:0.4rem;flex:1;min-width:160px}
  .td-input-group .t-input{width:100%;--t-input-picker-filter:invert(0.6)}
  .td-input-group select{color-scheme:dark}

  .td-hint{color:var(--text-dim);margin-top:0.5rem;max-width:62ch}

  .td-pills{display:flex;flex-wrap:wrap;gap:0.5rem}
  .td-pill{line-height:1.4;text-align:left;justify-content:flex-start;--t-chip-pad:0.55rem 0.85rem;--t-chip-radius:var(--ds-radius-sm)}

  .td-calc-btn{background:transparent;border:1px solid var(--amber);border-radius:var(--ds-radius-sm);color:var(--amber-hi);font-family:var(--ds-font-sans);font-size:var(--ds-type-ui-size);font-weight:var(--ds-type-ui-weight);padding:0.85rem 1.8rem;cursor:pointer;transition:background var(--ds-duration-base) var(--ds-ease-out),border-color var(--ds-duration-base) var(--ds-ease-out),color var(--ds-duration-base) var(--ds-ease-out);margin-top:0.5rem;align-self:flex-start;display:inline-flex;align-items:center;gap:0.6rem}
  .td-calc-btn:hover{background:color-mix(in srgb,var(--ds-color-accent) 12%,transparent)}
  .td-calc-btn[data-state="loading"],.td-calc-btn[data-state="done"]{cursor:default}
  .td-calc-btn[data-state="done"]{border-color:var(--green);color:var(--green)}
  .td-calc-btn .t-check-badge{width:15px;height:15px;flex:0 0 15px;--check-ring-w:2px}
  .td-calc-btn .t-think{font:inherit}

  .td-result{animation:td-enter var(--ds-duration-slower) var(--ds-ease-out) both}
  .td-age-display{color:var(--text-secondary);margin-bottom:2rem;line-height:2}
  .td-age-display strong{color:var(--text-primary);font-weight:500}
  .td-age-display .amber{color:var(--amber-hi)}

  .td-stolen-hero{background:var(--bg2);border:1px solid var(--amber);padding:2rem;margin-bottom:1.5px;text-align:center}
  .td-stolen-num{font-family:var(--ds-font-display);font-size:clamp(4rem,18vw,8rem);font-weight:400;color:var(--amber-hi);line-height:1;letter-spacing:-0.03em;font-variant-numeric:tabular-nums}
  .td-stolen-label{color:var(--text-secondary);margin-top:0.75rem}
  .td-stolen-sub{color:var(--text-secondary);margin-top:0.75rem}

  .td-no-dst{background:var(--bg2);border:1px solid var(--border);padding:1.5rem;margin-bottom:1.5px}
  .td-no-dst p{color:var(--text-secondary)}
  .td-no-dst strong{color:var(--text-primary);font-weight:500}

  .td-metric-grid{display:grid;grid-template-columns:1fr 1fr;gap:1.5px;margin-bottom:1.5px}
  @media(min-width:600px){.td-metric-grid{grid-template-columns:repeat(4,1fr)}}
  .td-metric{background:var(--bg2);border:1px solid var(--border);padding:1.2rem;text-align:center}
  .td-metric-val{font-size:clamp(1.1rem,4vw,1.6rem);font-weight:500;color:var(--text-primary);line-height:1;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
  .td-metric-val.amber{color:var(--amber-hi)}
  .td-metric-val.cold{color:var(--cold)}
  .td-metric-val.mist{color:var(--text-secondary)}
  .td-metric-val.green{color:var(--green)}
  .td-metric-lbl{color:var(--text-secondary);margin-top:0.5rem}

  .td-insight{background:var(--bg2);border:1px solid var(--border);padding:1.8rem;margin-bottom:1.5px}
  .td-insight p{color:var(--text-secondary);line-height:1.75;max-width:62ch}
  .td-insight p+p{margin-top:1rem}
  .td-insight strong{color:var(--text-primary);font-weight:500}
  .td-insight .amber{color:var(--amber-hi)}
  .td-insight .cold{color:var(--cold)}
  .td-insight .green{color:var(--green)}

  .td-next-steal{background:var(--bg2);border:1px solid var(--border-hi);padding:1.2rem 1.5rem;display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap}
  .td-next-label{color:var(--text-secondary)}
  .td-next-val{font-family:var(--ds-font-display);font-size:1.3rem;color:var(--text-primary);margin-top:0.2rem}
  .td-next-days{color:var(--amber-hi);text-align:right}

  .td-reset-btn{background:none;border:none;color:var(--text-dim);cursor:pointer;margin-top:1.5rem;padding:0;text-decoration:underline;text-underline-offset:3px;transition:color var(--ds-duration-base) var(--ds-ease-out)}
  .td-reset-btn:hover{color:var(--text-secondary)}

  .td-stats{background:var(--bg2);border-top:1px solid var(--border);border-bottom:1px solid var(--border);padding:2.5rem 1.5rem;display:grid;grid-template-columns:1fr 1fr;gap:2rem 1rem;text-align:center}
  @media(min-width:600px){.td-stats{grid-template-columns:repeat(4,1fr)}}
  .td-stat-val{font-family:var(--ds-font-display);font-size:clamp(2rem,8vw,3rem);font-weight:400;color:var(--amber-hi);letter-spacing:-0.02em;line-height:1}
  .td-stat-label{color:var(--text-secondary);margin-top:0.6rem}

  .td-section{padding:clamp(3rem,8vh,6rem) clamp(1.2rem,5vw,4rem);max-width:900px;margin:0 auto}

  .td-dst{background:var(--bg2);border:1px solid var(--border);padding:1.5rem;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:1rem;margin-bottom:2rem;text-align:center}
  .td-dst-big{font-size:clamp(2rem,8vw,3.5rem);font-weight:500;color:var(--text-primary);line-height:1;font-variant-numeric:tabular-nums}
  .td-dst-big.stolen{color:var(--amber-hi)}
  .td-dst-label{color:var(--text-secondary);margin-top:0.5rem}
  .td-dst-mid{color:var(--text-dim)}

  .td-cards{display:grid;grid-template-columns:1fr;gap:1.5px}
  @media(min-width:600px){.td-cards{grid-template-columns:1fr 1fr}}
  .td-card{background:var(--bg1);border:1px solid var(--border);padding:1.8rem}
  .td-card-title{font-family:var(--ds-font-display);font-size:clamp(1.1rem,4vw,1.3rem);font-weight:400;color:var(--text-primary);margin-bottom:0.75rem;line-height:1.3}
  .td-card-body{line-height:1.7;color:var(--text-secondary)}
  .td-card-link{display:inline-block;margin-top:1rem}

  .td-quote{padding:clamp(3rem,6vh,5rem) clamp(1.2rem,5vw,4rem);max-width:800px;margin:0 auto;text-align:center}
  .td-quote p{font-family:var(--ds-font-display);font-size:clamp(1.25rem,4.5vw,2.1rem);line-height:1.55;color:var(--text-primary);font-style:italic}
  .td-quote cite{display:block;margin-top:1.2rem;color:var(--text-secondary);font-style:normal}

  .td-timeline{position:relative;padding-left:1.2rem}
  .td-timeline::before{content:'';position:absolute;left:0;top:0;bottom:0;width:1px;background:var(--border-hi)}
  .td-titem{position:relative;padding:0 0 0.1rem 1.5rem;animation:td-enter var(--ds-duration-slow) var(--ds-ease-out) both}
  .td-titem-inner{padding-bottom:2rem}

  .td-sev{--sev:var(--border-hi);font-family:var(--ds-font-sans);font-size:var(--ds-text-xs);font-weight:500;font-variant-numeric:tabular-nums;padding:0.1rem 0.4rem;border-radius:var(--ds-radius-sm);color:var(--sev);background:color-mix(in srgb,var(--sev) 13%,transparent);border:1px solid color-mix(in srgb,var(--sev) 27%,transparent)}
  .td-sev--g5plus{--sev:var(--ds-color-danger)}
  .td-sev--g5{--sev:var(--amber)}
  .td-sev--g4{--sev:var(--ds-color-warning)}
  .td-sev--g3{--sev:var(--cold)}
  .td-sev--g2{--sev:var(--border-hi)}

  .td-tdot{position:absolute;left:-0.32rem;top:0.4rem;width:0.62rem;height:0.62rem;border-radius:50%;border:1px solid var(--border-hi);background:var(--bg0)}
  .td-tdot.solar{border-color:var(--amber);background:var(--bg2)}
  .td-tdot.solar.g5plus{border-color:var(--ds-color-danger);background:var(--ds-color-danger)}
  .td-tdot.solar.g5{border-color:var(--amber);background:var(--amber)}
  .td-tdot.solar.g4{border-color:var(--ds-color-warning)}
  .td-tdot.solar.g3{border-color:var(--text-secondary)}
  .td-tdot.computing{border-color:var(--cold);background:var(--bg2)}

  .td-tdate{color:var(--text-dim);margin-bottom:0.2rem;font-variant-numeric:tabular-nums}
  .td-tdate.solar{color:var(--amber)}
  .td-trow{display:flex;align-items:center;gap:0.6rem;margin-bottom:0.3rem;flex-wrap:wrap}
  .td-ttitle{font-family:var(--ds-font-display);font-weight:400;font-size:clamp(1rem,3.2vw,1.15rem);color:var(--text-primary);line-height:1.3}
  .td-tbody{color:var(--text-secondary);line-height:1.7;max-width:62ch}
  .td-sev-wrap{display:inline-flex}
  .td-sev-wrap .t-tt{white-space:normal;width:max-content;max-width:15rem;text-align:left;line-height:1.5}

  .td-legend{display:flex;gap:0.6rem 1.5rem;flex-wrap:wrap;margin-bottom:1.5rem}
  .td-legend-item{display:flex;align-items:center;gap:0.5rem;color:var(--text-secondary)}
  .td-legend-dot{width:0.6rem;height:0.6rem;border-radius:50%;border:1px solid var(--border-hi);background:var(--bg0);flex:none}
  .td-legend-dot--solar{border-color:var(--amber);background:var(--bg2)}
  .td-legend-dot--g5{border-color:var(--amber);background:var(--amber)}
  .td-legend-dot--carrington{border-color:var(--ds-color-danger);background:var(--ds-color-danger)}
  .td-legend-dot--computing{border-color:var(--cold);background:var(--bg2)}

  .td-filter{display:flex;gap:0.5rem;margin-bottom:2rem;flex-wrap:wrap}
  .td-filter-btn{--t-chip-pad:0.45rem 0.75rem;--t-chip-radius:var(--ds-radius-sm)}

  .td-divider{height:1px;background:var(--border);margin:0 1.5rem}
  .td-footer{border-top:1px solid var(--border);padding:2rem 1.5rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.8rem}
  .td-footer-brand{font-family:var(--ds-font-display);font-size:1.05rem;color:var(--text-secondary)}
  .td-footer-brand em{color:var(--amber-hi);font-style:italic}
  .td-footer-note{color:var(--text-dim)}
`;

// ─────────────────────────────────────────────────────────────
// REACT COMPONENTS
// ─────────────────────────────────────────────────────────────

// ── CONSTELLATION CLOCK ───────────────────────────────────────
// The clock face is hidden. Instead, 12 constellation-like star
// clusters mark the hour positions. The hour hand is a faint line
// connecting named stars; the minute hand connects a different set.
// The second indicator is a single pulsing star moving around the rim.
// Stars are scattered in natural-looking clusters around each position.
function Clock({ size = 240 }) {
  const [hands, setHands] = useState({ h: 0, m: 0, s: 0 });
  useEffect(() => {
    const tick = () => {
      const n = new Date(), s = n.getSeconds(), m = n.getMinutes() + s / 60, hr = (n.getHours() % 12) + m / 60;
      setHands({ h: hr * 30, m: m * 6, s: s * 6 });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const cx = size / 2, cy = size / 2;
  const rimR   = size / 2 - 8;   // outermost star ring
  const faceR  = size / 2 - 22;  // inner label ring

  // Convert clock-angle (degrees, 12=top) to x,y
  const polar = (deg, r) => {
    const rad = (deg - 90) * Math.PI / 180;
    return { x: cx + Math.cos(rad) * r, y: cy + Math.sin(rad) * r };
  };

  // Constellation star clusters at each hour position
  // Each hour has 3-5 stars scattered in a small radius
  const seed = (n) => { let x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };
  const hourClusters = Array.from({ length: 12 }, (_, i) => {
    const deg = i * 30;
    const centre = polar(deg, faceR);
    const count  = 3 + Math.floor(seed(i * 3) * 3); // 3–5 stars
    const stars  = Array.from({ length: count }, (_, j) => {
      const spread = 9;
      const ox = (seed(i * 13 + j * 7) - 0.5) * spread * 2;
      const oy = (seed(i * 17 + j * 5) - 0.5) * spread * 2;
      const brightness = 0.35 + seed(i * 11 + j * 3) * 0.65;
      const r = 0.7 + seed(i * 9 + j) * 1.4;
      return { x: centre.x + ox, y: centre.y + oy, r, brightness };
    });
    // brightest star in cluster = the "marker" star
    const marker = { x: centre.x, y: centre.y, r: 1.8, brightness: 1 };
    return { deg, centre, stars: [marker, ...stars] };
  });

  // Constellation lines — connect some of the hour-marker stars for a real constellation feel
  // A few arcs across the face, like Orion's belt etc
  const constLines = [
    [0, 4], [4, 8], [8, 0],   // triangle
    [1, 5], [5, 9],            // diagonal chain
    [2, 6],                    // axis
    [3, 7], [7, 11], [11, 3], // second triangle
  ];

  // Hand endpoints
  const hEnd = polar(hands.h, faceR * 0.55);
  const mEnd = polar(hands.m, faceR * 0.82);
  const sPos = polar(hands.s, rimR * 0.88);

  // Second indicator: a bright pulsing star
  return (
    <svg className="td-clock" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>

      {/* Faint outer rim circle — barely visible */}
      <circle className="td-clock-rim" cx={cx} cy={cy} r={rimR}/>

      {/* Constellation connecting lines between hour clusters */}
      {constLines.map(([a, b], i) => {
        const ca = hourClusters[a].centre;
        const cb = hourClusters[b].centre;
        return (
          <line className="td-clock-const" key={i}
            x1={ca.x} y1={ca.y} x2={cb.x} y2={cb.y}
          />
        );
      })}

      {/* Hour hand — faint dotted line to nearest cluster star */}
      <line className="td-clock-hour" x1={cx} y1={cy} x2={hEnd.x} y2={hEnd.y}/>

      {/* Minute hand — slightly brighter */}
      <line className="td-clock-min" x1={cx} y1={cy} x2={mEnd.x} y2={mEnd.y}/>

      {/* Hour cluster stars */}
      {hourClusters.map((cluster, ci) =>
        cluster.stars.map((star, si) => (
          <circle className="td-clock-star" key={`${ci}-${si}`}
            cx={star.x} cy={star.y} r={star.r}
            opacity={star.brightness}
          />
        ))
      )}

      {/* Second indicator — a single amber star creeping around the rim */}
      <circle className="td-clock-sec" cx={sPos.x} cy={sPos.y} r={2.4} opacity={0.9}/>
      {/* Tiny halo */}
      <circle className="td-clock-halo" cx={sPos.x} cy={sPos.y} r={4.5}/>

      {/* Centre star */}
      <circle className="td-clock-centre" cx={cx} cy={cy} r={2}/>
    </svg>
  );
}

function LiveTime() {
  const [t,setT]=useState("");
  useEffect(()=>{const tick=()=>{const n=new Date();setT([n.getHours(),n.getMinutes(),n.getSeconds()].map(v=>String(v).padStart(2,"0")).join(":"));};tick();const id=setInterval(tick,1000);return()=>clearInterval(id);},[]);
  return <span className="td-live">{t}</span>;
}

// Thin amber readout under the banner tracking how far down the page
// you are — an instrument-panel nod that also just helps orient you
// on what is otherwise one very long scroll.
function ScrollProgress() {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const scrollable = h.scrollHeight - h.clientHeight;
      setPct(scrollable > 0 ? Math.min(1, h.scrollTop / scrollable) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, []);
  return <div className="td-progress" style={{ transform: `scaleX(${pct})` }} />;
}

/* t-stagger plays on .is-shown rather than on mount, so the class goes on a
   frame later — set in the same paint as the markup and there is no
   from-state for the browser to transition out of. */
function Stagger({className="",children}) {
  const ref=useRef(null);
  useEffect(()=>{
    const id=requestAnimationFrame(()=>ref.current?.classList.add("is-shown"));
    return()=>cancelAnimationFrame(id);
  },[]);
  return <div className={`t-stagger ${className}`} ref={ref}>{children}</div>;
}

function LiveAge({dob,region,flightKey}) {
  const [d,setD]=useState(()=>calcDissonance(dob,region,flightKey));
  useEffect(()=>{const id=setInterval(()=>setD(calcDissonance(dob,region,flightKey)),1000);return()=>clearInterval(id);},[dob,region,flightKey]);
  if(!d) return null;
  const pad=v=>String(v).padStart(2,"0");
  return(
    <div className="td-age-display td-num">
      You are{" "}
      <strong>{d.years}y {d.months}m {d.days}d</strong>{" "}
      <span className="amber">{pad(d.hours)}:{pad(d.minutes)}:{pad(d.seconds)}</span> old.
      <br/>
      That's <strong>{d.totalHours.toLocaleString("en-GB")}</strong> hours so far.
    </div>
  );
}

// Eases the headline figure up from 0 once, then holds. Skips straight to
// the value under prefers-reduced-motion.
function CountUp({ value, duration = 650, format = v => v.toLocaleString("en-GB") }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const dur = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : duration;
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const p = dur <= 0 ? 1 : Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(p < 1 ? Math.round(value * eased) : value);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return format(display);
}

function DissonanceCalc() {
  const [step, setStep] = useState(1); // 1=inputs, 2=results
  const [dob, setDob] = useState("");
  const [region, setRegion] = useState(DEFAULT_REGION);
  const [flight, setFlight] = useState("annual");
  const [result, setResult] = useState(null);
  const [calcState, setCalcState] = useState("idle"); // idle | loading | done
  const [dobError, setDobError] = useState("");
  // The shake is state rather than a class added to the node: React rewrites
  // className on the re-render that sets dobError, which would wipe it.
  const [shaking, setShaking] = useState(false);
  const revertTimer = useRef(null);

  useEffect(() => () => window.clearTimeout(revertTimer.current), []);

  const calculate = useCallback(() => {
    if (calcState !== "idle") return;
    const r = calcDissonance(dob, region, flight);
    if (!r) {
      // is-error and is-shaking come from ds/css/components/field.css; the
      // message clears itself after 3 seconds.
      setDobError(dob
        ? "Pick a date between 1900 and today."
        : "Enter your date of birth first.");
      // Drop and re-add in separate frames so the shake can replay.
      setShaking(false);
      requestAnimationFrame(() => setShaking(true));
      window.clearTimeout(revertTimer.current);
      revertTimer.current = window.setTimeout(() => setDobError(""), 3000);
      return;
    }
    setDobError("");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) { setResult(r); setStep(2); return; }
    setCalcState("loading");
    window.setTimeout(() => {
      setCalcState("done");
      window.setTimeout(() => {
        setResult(r);
        setStep(2);
        setCalcState("idle");
      }, 260);
    }, 550);
  }, [dob, region, flight, calcState]);

  const reset = () => { setStep(1); setResult(null); };

  const fmtDate = d => d.toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"});
  const flightOpt = FLIGHT_OPTIONS.find(o=>o.key===flight);
  const n = v => v.toLocaleString("en-GB");

  return (
    <div className="td-calc-wrap">
      <div className="td-calc-inner">
        <h2 className="td-h2">How much time has <em>gone missing?</em></h2>
        <p className="td-intro">
          Give it your date of birth, where you grew up and how much you fly. It counts the clock-hours daylight saving has skipped since you were born, and works out how much younger flying has made you.
        </p>

        {step === 1 && (
          <div className="td-steps">
            <div>
              <div className="td-step-label td-label" data-n="1">Date of birth</div>
              <div className="td-input-row">
                <div className="td-input-group">
                  <div className={`t-input-wrap${dobError?" is-error":""}`}>
                    <div className={`t-input${dobError?" is-error":""}${shaking?" is-shaking":""}`}
                      onAnimationEnd={()=>setShaking(false)}>
                      <input type="date" value={dob}
                        aria-label="Date of birth"
                        max={new Date().toISOString().split("T")[0]} min="1900-01-01"
                        aria-invalid={dobError?"true":undefined}
                        aria-describedby="td-dob-error"
                        onChange={e=>{setDob(e.target.value);setDobError("");}}
                        onKeyDown={e=>e.key==="Enter"&&calculate()}
                      />
                    </div>
                    <p className="t-error-msg td-label" id="td-dob-error" role="alert">
                      {dobError||" "}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="td-step-label td-label" data-n="2">Where did you grow up?</div>
              <div className="td-input-row">
                <div className="td-input-group">
                  <div className="t-input t-input--select">
                    <select value={region} aria-label="Where did you grow up?" aria-describedby="td-region-hint" onChange={e=>setRegion(e.target.value)}>
                      {REGION_GROUPS.map(([group, items])=>(
                        <optgroup key={group} label={group}>
                          {items.map(r=>(
                            <option key={r.key} value={r.key}>{r.label}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <p className="td-hint td-label" id="td-region-hint">
                    Before the 1960s the US set clocks city by city and Europe country by country, so older years follow the city in brackets. The dates come from the tz database, which is what your phone uses too.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <div className="td-step-label td-label" data-n="3">How often do you take long-haul flights?</div>
              <div className="td-pills">
                {FLIGHT_OPTIONS.map(o=>(
                  <button key={o.key} className={`td-pill td-label t-chip t-chip--outlined${flight===o.key?" is-on":""}`} aria-pressed={flight===o.key} onClick={()=>setFlight(o.key)}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <button className="td-calc-btn" data-state={calcState} onClick={calculate} disabled={calcState !== "idle"} aria-live="polite">
              <span className="t-check-blur-wrap" hidden={calcState === "idle"} aria-hidden="true">
                <span className="t-check-badge" data-state={calcState === "done" ? "done" : "loading"}>
                  <span className="t-check-ring"/>
                  <span className="t-check-arc"/>
                  <span className="t-check-fill"/>
                  <span className="t-check-disc">
                    <svg viewBox="0 0 22 22" fill="none">
                      <path className="t-check-mark" d="M6 11.5L9.5 15L16 8" style={{"--check-mark-len":"15"}}/>
                    </svg>
                  </span>
                </span>
              </span>
              <span className="td-calc-label">
                {calcState === "loading" ? (
                  <span className="t-think">
                    <span className="t-think-sizer">Working it out…</span>
                    <span className="t-think-text" data-text="Working it out…">Working it out…</span>
                  </span>
                ) : calcState === "done" ? "Done" : "Work it out"}
              </span>
            </button>
          </div>
        )}

        {step === 2 && result && (
          <div className="td-result">
            <LiveAge dob={dob} region={region} flightKey={flight}/>

            {result.regionNoDST ? (
              <div className="td-no-dst">
                <p>
                  {result.regionHasZone
                    ? <><strong>The clocks haven't gone forward in {result.regionLabel} since you were born,</strong> so they've never skipped an hour on you.</>
                    : <><strong>You grew up somewhere the clocks never change,</strong> so they've never skipped an hour on you.</>}
                  {" "}Flying, leap seconds and the 2038 bug still apply, and they're below.
                </p>
              </div>
            ) : (
              <div className="td-stolen-hero">
                <div className="td-stolen-num"><CountUp value={result.hoursStolen} format={fmtHours}/></div>
                <div className="td-stolen-label td-label">Hours skipped since you were born</div>
                <div className="td-stolen-sub td-num">
                  That's {n(result.minutesStolen)} minutes, from {result.jumps === 1 ? "the 1 time" : `the ${result.jumps} times`} the clocks went forward.
                </div>
              </div>
            )}

            <div className="td-metric-grid">
              {!result.regionNoDST && (
                <div className="td-metric">
                  <div className="td-metric-val amber">{fmtHours(result.hoursStolen)}</div>
                  <div className="td-metric-lbl td-label">Hours skipped</div>
                </div>
              )}
              {!result.regionNoDST && (
                <div className="td-metric">
                  <div className="td-metric-val">{result.pctStolen}%</div>
                  <div className="td-metric-lbl td-label">Of your life so far</div>
                </div>
              )}
              <div className="td-metric">
                <div className="td-metric-val green">{n(result.nsYounger)}ns</div>
                <div className="td-metric-lbl td-label">Younger than if you'd never flown</div>
              </div>
              <div className="td-metric">
                <div className="td-metric-val cold">{n(result.totalFlightHours)}h</div>
                <div className="td-metric-lbl td-label">Hours in the air (estimate)</div>
              </div>
              {result.regionNoDST && (
                <div className="td-metric">
                  <div className="td-metric-val mist">{n(result.totalHours)}</div>
                  <div className="td-metric-lbl td-label">Hours lived</div>
                </div>
              )}
              {result.regionNoDST && (
                <div className="td-metric">
                  <div className="td-metric-val amber">0</div>
                  <div className="td-metric-lbl td-label">Hours skipped by daylight saving</div>
                </div>
              )}
              <div className="td-metric">
                <div className="td-metric-val mist">{result.leapSecondsLived}</div>
                <div className="td-metric-lbl td-label">Leap seconds lived through</div>
              </div>
              <div className="td-metric">
                <div className="td-metric-val cold">{result.y2038Age}</div>
                <div className="td-metric-lbl td-label">Your age when 32-bit time runs out</div>
              </div>
            </div>

            <div className="td-insight td-num">
              {!result.regionNoDST && (
                <p>
                  Of your <strong>{n(result.totalHours)} hours</strong>, <span className="amber">{fmtHours(result.hoursStolen)} ({result.pctStolen}%)</span> were clock-hours that never happened. Each spring the clocks jumped forward and the hour in between was skipped.
                </p>
              )}
              {!result.regionNoDST && (
                <p>
                  You get an hour back when the clocks go back in autumn, but it's a repeat of 1am. The one skipped in spring stays skipped.
                </p>
              )}
              {result.nsYounger > 0 && (
                <p>
                  You said you fly <strong>{flightOpt.label.toLowerCase()}</strong>. Counting from age 18, that's roughly <strong>{n(result.totalFlightHours)} hours</strong> in the air. At cruising speed the slowing from velocity outweighs the speeding up from altitude, so you're about <span className="green">{n(result.nsYounger)} nanoseconds younger</span> than you'd be if you'd never flown.
                </p>
              )}
              {result.nsYounger === 0 && (
                <p>
                  You've barely flown, so you're the same age, to the nanosecond, as a version of you who never left the ground.
                </p>
              )}
              {result.leapSecondsLived > 0 ? (
                <p>
                  You've also lived through <strong>{result.leapSecondsLived} leap second{result.leapSecondsLived === 1 ? "" : "s"}</strong>, added to keep atomic clocks in step with the Earth's uneven spin. None have been added since 2016 and they're due to stop by 2035. You'll be about <strong className="cold">{result.y2038Age}</strong> when 32-bit Unix time runs out, at 03:14:07 UTC on 19 January 2038.
                </p>
              ) : (
                <p>
                  No leap second has been added since you were born, and they're due to stop by 2035, so you may never get one. You'll be about <strong className="cold">{result.y2038Age}</strong> when 32-bit Unix time runs out, at 03:14:07 UTC on 19 January 2038.
                </p>
              )}
            </div>

            {result.daysToNextSteal && (
              <div className="td-next-steal">
                <div>
                  <div className="td-next-label td-label">Next skipped hour</div>
                  <div className="td-next-val">{fmtDate(result.nextSpring)}</div>
                </div>
                <div className="td-next-days td-label td-num">In {result.daysToNextSteal} days</div>
              </div>
            )}

            <button className="td-reset-btn td-label" onClick={reset}>Start again</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// COMBINED TIMELINE COMPONENT
// ─────────────────────────────────────────────────────────────
const FILTERS = [
  { key: "all",       label: "All" },
  { key: "solar",     label: "Solar storms" },
  { key: "history",   label: "History" },
  { key: "computing", label: "Computing" },
];

// Dates stored as YYYY-01-01 only mean "some time that year".
const fmtEventDate = (iso) => {
  if (iso.endsWith("-01-01")) return iso.slice(0, 4);
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
};

function CombinedTimeline() {
  const [filter, setFilter] = useState("all");

  const filtered = HISTORY_EVENTS.filter(e => filter === "all" || e.type === filter);

  const severityClass = (sev) => (sev ? SEVERITY[sev]?.cls ?? "" : "");

  return (
    <section className="td-section">
      <h2 className="td-h2">A timeline of <em>disrupted time</em></h2>
      <p className="td-intro">
        Policy, physics, the sun and software, in date order. Solar storms use NOAA's G-scale, from G1 (minor) to G5 (extreme).
      </p>

      <div className="td-legend">
        <div className="td-legend-item td-label"><div className="td-legend-dot"/>Historical event</div>
        <div className="td-legend-item td-label"><div className="td-legend-dot td-legend-dot--solar"/>G3 or G4 solar storm</div>
        <div className="td-legend-item td-label"><div className="td-legend-dot td-legend-dot--g5"/>G5 storm</div>
        <div className="td-legend-item td-label"><div className="td-legend-dot td-legend-dot--carrington"/>Carrington-class</div>
        <div className="td-legend-item td-label"><div className="td-legend-dot td-legend-dot--computing"/>Computing bug</div>
      </div>

      <div className="td-filter">
        {FILTERS.map(f=>(
          <button key={f.key} className={`td-filter-btn td-label t-chip t-chip--outlined${filter===f.key?" is-on":""}`} aria-pressed={filter===f.key} onClick={()=>setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="td-timeline">
        {filtered.map((item) => (
          <div className="td-titem" key={item.date + item.label}>
            <div className={`td-tdot ${item.type}${item.severity ? " "+severityClass(item.severity) : ""}`}/>
            <div className="td-titem-inner">
              <div className={`td-tdate td-label${item.type==="solar"?" solar":""}`}>
                {fmtEventDate(item.date)}
              </div>
              <div className="td-trow">
                <h3 className="td-ttitle">{item.label}</h3>
                {item.severity && (
                  // tabIndex so the tooltip opens on keyboard focus too.
                  <span className="t-tt-wrap td-sev-wrap">
                    <span className={`td-sev td-sev--${severityClass(item.severity)}`} tabIndex={0}>
                      {item.severity}
                    </span>
                    <span className="t-tt" role="tooltip">{SEVERITY[item.severity].note}</span>
                  </span>
                )}
              </div>
              <p className="td-tbody">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// STATIC DATA
// ─────────────────────────────────────────────────────────────
const dstCards = [
  {title:"It started as a joke",body:"In 1784 Benjamin Franklin wrote a satirical letter suggesting Parisians get up at dawn to save on candles. In 1916 Germany brought in daylight saving to save coal during the war, and Britain followed 3 weeks later.",link:"https://www.britannica.com/story/who-invented-daylight-saving-time",linkLabel:"Britannica on who invented it"},
  {title:"Your body keeps the old time",body:"Heart attacks and car crashes both go up in the days after the spring change. Your body clock doesn't reset when the one on the wall does, and takes a few days to catch up.",link:"https://www.sleepfoundation.org/sleep-hygiene/daylight-saving-time-and-sleep",linkLabel:"Sleep Foundation on the effects"},
  {title:"It may never have saved energy",body:"The point was to cut energy use by moving daylight into the evening. The evidence that it ever did is thin. A study of Indiana found electricity use went up, because people ran air conditioning through the lighter evenings.",link:"https://www.nber.org/papers/w14429",linkLabel:"The NBER paper"},
  {title:"The autumn hour is a repeat",body:"When the clocks go back in October you get an extra hour, but it's 1am to 2am a second time. The hour skipped in spring is still gone.",link:"https://www.bbc.co.uk/news/uk-politics-49678133",linkLabel:"BBC on the UK debate"},
];

const relCards = [
  {title:"Every flight makes you slightly younger",body:"The faster you move, the slower your clock runs compared with someone standing still. On a long-haul flight that comes to a few nanoseconds.",link:"https://www.bbc.co.uk/sciencefocus/article/does-time-pass-more-slowly-on-a-plane",linkLabel:"BBC Science Focus"},
  {title:"Altitude makes clocks run fast",body:"The further you are from a large mass, the faster time passes. GPS satellites orbit at about 20,000km and, with speed and altitude together, their clocks would run 38 microseconds a day fast without correction. Left alone, that puts your position out by about 10km a day.",link:"https://science.nasa.gov/learn/explainers/einsteins-theory-of-relativity/",linkLabel:"NASA on relativity"},
  {title:"It was tested on commercial flights",body:"In 1971 Joseph Hafele and Richard Keating flew atomic clocks around the world on ordinary passenger flights, once eastward and once westward, then compared them with clocks left on the ground. The results matched Einstein's predictions.",link:"https://www.science.org/doi/10.1126/science.177.4044.166",linkLabel:"The paper in Science"},
  {title:"Your phone already corrects for it",body:"The relativity corrections in GPS aren't optional. Without them the system would be useless within hours. Every time you follow a map, it's relying on satellite clocks adjusted for running at a different rate in orbit.",link:"https://physicscentral.com/explore/writers/will.cfm",linkLabel:"Physics Central"},
];

const solarCards = [
  {title:"GPS goes wrong without telling you",body:"Solar storms distort the ionosphere that GPS signals pass through, and errors creep in, tens of metres at first. Nothing warns you. Your phone still shows a blue dot, just in the wrong place.",link:"https://www.swpc.noaa.gov/impacts/gps-position-errors",linkLabel:"NOAA on GPS errors"},
  {title:"Your oven runs on the power grid",body:"Many appliances keep time by counting the cycles of mains electricity, 50 a second in the UK. When the grid is disrupted the frequency drifts, and ovens, microwaves and older alarm clocks gain or lose minutes.",link:"https://www.newscientist.com/article/2239540-slow-clocks-why-your-oven-and-other-appliances-may-be-running-behind/",linkLabel:"New Scientist"},
  {title:"2012: a near miss nobody felt",body:"A Carrington-class CME erupted in July 2012 and missed Earth by 9 days. Modelling afterwards suggested a hit would have meant months of GPS problems, power cuts across continents and trillions in damage.",link:"https://science.nasa.gov/science-research/heliophysics/the-perfect-solar-superstorm-the-1859-carrington-event/",linkLabel:"NASA on Carrington-class storms"},
  {title:"The one you might have seen",body:"In May 2024 a G5 storm, the strongest in over 20 years, put auroras over the UK and as far south as Florida. At the same time GPS-guided tractors were drifting off their lines and some aviation radio went down.",link:"https://www.bbc.co.uk/news/science-environment-69012972",linkLabel:"BBC News"},
];

const computingCards = [
  {title:"Leap seconds are being dropped",body:"In November 2022 the world's metrologists voted to stop adding leap seconds by 2035. Meta and Google had pushed for it. A leap second in 2012 took Reddit offline for about half an hour, and one at the start of 2017 made Cloudflare's code hand a negative number to a function that crashed on it. After 27 since 1972, clock time will be left to drift away from the Earth's rotation.",link:"https://www.bipm.org/en/-/2022-11-18-cgpm-resolutions",linkLabel:"BIPM Resolution 4"},
  {title:"A 32-bit number that runs out",body:"Lots of systems still store time as seconds since 1970 in a signed 32-bit integer. That tops out at 2,147,483,647, which is 03:14:07 UTC on 19 January 2038. A second later it goes negative and the date reads 1901. A similar overflow froze Microsoft Exchange mail queues on 1 January 2022.",link:"https://www.theregister.com/software/2022/01/03/microsoft-patches-y2k-like-bug-in-on-prem-exchange-server/1513135",linkLabel:"The Register on the Exchange bug"},
  {title:"GPS forgets what week it is",body:"GPS counts weeks in a 10-bit number that goes back to zero every 1,024 weeks, about every 19.6 years. It happened in 1999 and again in April 2019, when flight-management software delayed a KLM flight, New York's public wifi went down, and some GoPro drones and Honda dashboards lost track of the year. The next rollover is in November 2038, a few months after the 32-bit bug. The two aren't connected.",link:"https://en.wikipedia.org/wiki/GPS_week_number_rollover",linkLabel:"Wikipedia"},
  {title:"A lawsuit nearly took down the time zone database",body:"The tz database is the file that tells your phone when Berlin's clocks change. It's public domain and run by volunteers. In 2011 a company called Astrolabe sued its maintainers over astrology data once mentioned on the mailing list, and the list and file server came down within a week. ICANN took it over, and the case was dropped 4 months later.",link:"https://www.eff.org/cases/astrolabe-v-olson",linkLabel:"EFF on the case"},
];

function Cards({ items }) {
  return (
    <div className="td-cards">
      {items.map((c) => (
        <article className="td-card" key={c.title}>
          <h3 className="td-card-title">{c.title}</h3>
          <p className="td-card-body">{c.body}</p>
          <a className="td-card-link td-label t-link" href={c.link} target="_blank" rel="noopener noreferrer">{c.linkLabel}</a>
        </article>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// APP
// ─────────────────────────────────────────────────────────────
export default function App() {
  return (
    <div className="td-root">
      <style>{styles}</style>
      <Starfield/>
      <ScrollProgress/>
      <div className="td-main">

        <div className="td-banner td-label">
          <span>Time Dissonance</span>
          <LiveTime/>
        </div>

        <section className="td-hero">
          <Stagger className="td-hero-lines">
            <h1 className="t-stagger-line td-title">Time<br/><span className="td-title-em">Dissonance</span></h1>
            <p className="t-stagger-line td-sub">Clocks skip an hour every spring, run fast in orbit and drift when the sun acts up. This works out how much of that has happened to you.</p>
            <div className="t-stagger-line td-clock-wrap" aria-hidden="true">
              <Clock size={200}/>
            </div>
          </Stagger>
        </section>

        <DissonanceCalc/>

        <div className="td-stats">
          <div><div className="td-stat-val">1h</div><div className="td-stat-label td-label">Skipped each spring</div></div>
          <div><div className="td-stat-val">38µs</div><div className="td-stat-label td-label">GPS clock drift per day, uncorrected</div></div>
          <div><div className="td-stat-val">0.73ns</div><div className="td-stat-label td-label">Younger per hour in the air</div></div>
          <div><div className="td-stat-val">$2tn</div><div className="td-stat-label td-label">Cost if the 2012 near miss had hit</div></div>
        </div>

        <section className="td-section">
          <h2 className="td-h2">The hour that <em>wasn't there</em></h2>
          <p className="td-intro">Every spring the clocks go forward an hour. In most of Europe, one minute it's 01:59 and the next it's 03:00. Nothing happens between 2am and 3am because that hour doesn't exist.</p>
          <div className="td-dst">
            <div><div className="td-dst-big">01:59</div><div className="td-dst-label td-label">Late Saturday night</div></div>
            <div className="td-dst-mid td-label">1 minute later</div>
            <div><div className="td-dst-big stolen">03:00</div><div className="td-dst-label td-label">2am never happened</div></div>
          </div>
          <Cards items={dstCards}/>
        </section>

        <div className="td-divider"/>

        <figure className="td-quote">
          <blockquote><p>Time is an illusion. Lunchtime doubly so.</p></blockquote>
          <figcaption><cite className="td-label">Douglas Adams, The Hitchhiker's Guide to the Galaxy</cite></figcaption>
        </figure>

        <div className="td-divider"/>

        <section className="td-section">
          <h2 className="td-h2">You age <em>at your own rate</em></h2>
          <p className="td-intro">Every clock runs at a slightly different rate. Move faster and yours runs slower. Get further from the Earth and it runs faster. Both have been measured.</p>
          <Cards items={relCards}/>
        </section>

        <div className="td-divider"/>

        <section className="td-section">
          <h2 className="td-h2">When the sun <em>loses track</em></h2>
          <p className="td-intro">Now and then the sun throws a billion-tonne cloud of magnetised plasma at the Earth, and it gets here a day or 2 later. As well as auroras, it disrupts GPS and the power grid, and a lot of timekeeping relies on both.</p>
          <Cards items={solarCards}/>
        </section>

        <div className="td-divider"/>

        <section className="td-section">
          <h2 className="td-h2">The clock wasn't <em>built to last</em></h2>
          <p className="td-intro">All of the above assumes the clock underneath works. Computers store time using shortcuts taken decades ago, and some of them run out on known dates.</p>
          <Cards items={computingCards}/>
        </section>

        <div className="td-divider"/>

        <CombinedTimeline/>

        <footer className="td-footer">
          <span className="td-footer-brand">Time <em>Dissonance</em></span>
          <span className="td-footer-note td-label">Figures are estimates. Each card links to its source.</span>
        </footer>

      </div>
    </div>
  );
}
