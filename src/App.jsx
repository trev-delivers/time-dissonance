import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────────────────────
// DST REGION DATA
// Each region has: name, label, rules per era
// rule: { from, to, springMonth (0-indexed), springRule, fallMonth, fallRule }
// springRule: "lastSun", "lastSun", or specific date logic
// ─────────────────────────────────────────────────────────────

function lastSundayOf(year, month) {
  const last = new Date(year, month + 1, 0);
  const dow = last.getDay();
  return new Date(year, month, last.getDate() - (dow === 0 ? 0 : dow));
}

function firstSundayOf(year, month) {
  const first = new Date(year, month, 1);
  const dow = first.getDay();
  return new Date(year, month, 1 + (dow === 0 ? 0 : 7 - dow));
}

function secondSundayOf(year, month) {
  const f = firstSundayOf(year, month);
  return new Date(year, month, f.getDate() + 7);
}

// Returns array of { year, springForward } dates for a region between birth and now
function getDSTSprings(regionKey, birthDate, toDate) {
  const region = DST_REGIONS[regionKey];
  if (!region || region.noDST) return [];
  const springs = [];
  for (let y = birthDate.getFullYear(); y <= toDate.getFullYear(); y++) {
    const spring = region.getSpring(y);
    if (spring && spring > birthDate && spring <= toDate) {
      springs.push(spring);
    }
  }
  return springs;
}

const DST_REGIONS = {
  uk: {
    label: "United Kingdom",
    noDST: false,
    getSpring: (y) => {
      if (y < 1916) return null; // No DST before 1916
      if (y === 1916) return new Date(1916, 4, 21); // May 21
      if (y >= 1917 && y <= 1939) return lastSundayOf(y, 2); // Last Sun March
      if (y >= 1940 && y <= 1945) return null; // Double BST / war time (complex — skip net)
      if (y >= 1946 && y <= 1967) return lastSundayOf(y, 2);
      if (y === 1968) return null; // UK stayed on BST all year 1968–1971
      if (y === 1969) return null;
      if (y === 1970) return null;
      if (y === 1971) return null;
      if (y >= 1972) return lastSundayOf(y, 2); // Last Sun March
      return null;
    },
  },
  eu: {
    label: "Continental Europe",
    noDST: false,
    getSpring: (y) => {
      if (y < 1916) return null;
      if (y >= 1916 && y <= 1939) return lastSundayOf(y, 2);
      if (y >= 1940 && y <= 1945) return null; // War disruptions
      if (y >= 1946 && y <= 1979) return lastSundayOf(y, 2); // approximate
      if (y >= 1980) return lastSundayOf(y, 2); // Harmonised EU: last Sun March
      return null;
    },
  },
  us: {
    label: "United States",
    noDST: false,
    getSpring: (y) => {
      if (y < 1918) return null;
      if (y >= 1918 && y <= 1919) return lastSundayOf(y, 2);
      if (y >= 1920 && y <= 1941) return null; // No federal DST
      if (y >= 1942 && y <= 1945) return new Date(y, 1, 9); // War time year-round
      if (y >= 1946 && y <= 1966) return lastSundayOf(y, 3); // Last Sun April
      if (y >= 1967 && y <= 2006) return lastSundayOf(y, 3); // Last Sun April
      if (y >= 2007) return secondSundayOf(y, 2); // 2nd Sun March (Energy Policy Act)
      return null;
    },
  },
  au: {
    label: "Australia (SE)",
    noDST: false,
    getSpring: (y) => {
      // Southern hemisphere: spring = October
      if (y < 1917) return null;
      // Australia DST varies by state — using VIC/NSW/ACT/TAS/SA approximation
      if (y >= 2008) return firstSundayOf(y, 9); // First Sun October
      if (y >= 1971) return lastSundayOf(y, 9); // Last Sun October
      if (y >= 1944) return new Date(y, 2, 1); // approx March (complex war era)
      return null;
    },
  },
  nz: {
    label: "New Zealand",
    noDST: false,
    getSpring: (y) => {
      if (y < 1927) return null;
      // NZ spring = September/October
      if (y >= 2007) return lastSundayOf(y, 8); // Last Sun September
      if (y >= 1974) return lastSundayOf(y, 9); // Last Sun October
      return null;
    },
  },
  ca: {
    label: "Canada",
    noDST: false,
    getSpring: (y) => {
      if (y < 1918) return null;
      if (y >= 2007) return secondSundayOf(y, 2); // Follows US
      if (y >= 1967) return lastSundayOf(y, 3);
      return null;
    },
  },
  none: {
    label: "No DST (e.g. Japan, India, most of Africa)",
    noDST: true,
    getSpring: () => null,
  },
};

// ─────────────────────────────────────────────────────────────
// FLIGHT FREQUENCY OPTIONS
// ─────────────────────────────────────────────────────────────
const FLIGHT_OPTIONS = [
  { key: "never",    label: "Never / almost never",  hoursPerYear: 0 },
  { key: "rare",     label: "Rarely (1 long-haul every few years)", hoursPerYear: 5 },
  { key: "annual",   label: "Once or twice a year",   hoursPerYear: 20 },
  { key: "frequent", label: "Several times a year",   hoursPerYear: 60 },
  { key: "heavy",    label: "Very frequently (work travel etc)", hoursPerYear: 120 },
];

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

  const springs = getDSTSprings(region, birth, now);
  const hoursStolen = springs.length;

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

  // Next spring forward
  const reg = DST_REGIONS[region];
  let nextSpring = null;
  if (reg && !reg.noDST) {
    for (let y = now.getFullYear(); y <= now.getFullYear() + 1; y++) {
      const s = reg.getSpring(y);
      if (s && s > now) { nextSpring = s; break; }
    }
  }
  const daysToNextSteal = nextSpring ? Math.ceil((nextSpring - now) / 86400000) : null;

  return {
    years, months, days, hours, minutes, seconds,
    hoursStolen, minutesStolen: hoursStolen * 60,
    totalHours: Math.floor(totalHours),
    pctStolen,
    nsYounger, totalFlightHours,
    daysToNextSteal, nextSpring,
    regionNoDST: reg && reg.noDST,
  };
}

// ─────────────────────────────────────────────────────────────
// COMBINED TIMELINE (historical + solar)
// ─────────────────────────────────────────────────────────────
const HISTORY_EVENTS = [
  { date: "1784-01-01", label: "Franklin's satire", type: "history", desc: "Benjamin Franklin writes a tongue-in-cheek essay suggesting Parisians could save candles by waking at dawn. He means it as a joke. It is later used, without irony, to justify DST." },
  { date: "1859-09-01", label: "Carrington Event", type: "solar", severity: "G5+", desc: "The most powerful geomagnetic storm on record. Telegraph systems caught fire. Operators received electric shocks. Auroras visible at the equator." },
  { date: "1884-01-01", label: "GMT standardised", type: "history", desc: "The International Meridian Conference establishes Greenwich Mean Time as the global baseline. Before this, every town kept its own local solar time." },
  { date: "1905-01-01", label: "Einstein: Special Relativity", type: "history", desc: "Time is not a fixed background. It bends, stretches, and slows depending on speed and gravity. Every clock in the universe runs at its own pace." },
  { date: "1916-01-01", label: "DST first adopted", type: "history", desc: "Germany and Britain introduce Daylight Saving Time to reduce wartime coal consumption. The argument has not meaningfully improved since." },
  { date: "1921-05-15", label: "New York Railroad Storm", type: "solar", severity: "G5+", desc: "One of the largest geomagnetic storms of the 20th century. Telegraph and telephone systems across North America and Europe severely disrupted." },
  { date: "1938-01-21", label: "Great Aurora Storm", type: "solar", severity: "G5", desc: "Visible as far south as Portugal. Disrupted radio and early aviation navigation. One of the largest storms of the pre-Space Age era." },
  { date: "1958-02-10", label: "Feb 1958 Superstorm", type: "solar", severity: "G5", desc: "One of the largest storms of the Space Age. Widespread power and communications disruptions across Canada and the northern US." },
  { date: "1971-01-01", label: "Hafele-Keating experiment", type: "history", desc: "Atomic clocks flown around the world confirm relativistic time dilation. Moving clocks really do run slow. The universe doesn't care about your schedule." },
  { date: "1972-08-04", label: "Aug 1972 Storm", type: "solar", severity: "G5", desc: "Caused accidental detonation of US naval mines off Vietnam due to magnetic field disruption. Also knocked out AT&T long-lines communications." },
  { date: "1989-03-13", label: "Quebec Blackout", type: "solar", severity: "G5", desc: "Knocked out power across Quebec for 9 hours. 6 million people without electricity. Auroras visible in Texas. Transformer damage took months to repair." },
  { date: "1998-01-01", label: "Leap second disputes begin", type: "history", desc: "Atomic clocks now so precise they outpace Earth's irregular rotation. Leap seconds added intermittently. The internet finds this extremely inconvenient." },
  { date: "2000-07-14", label: "Bastille Day Event", type: "solar", severity: "G5", desc: "X5.7 flare launched a CME directly at Earth. Disrupted satellites, caused radio blackouts, and produced auroras across Europe. Observed by both Voyager spacecraft." },
  { date: "2003-10-29", label: "Halloween Storms", type: "solar", severity: "G5", desc: "17 major flares over two weeks. Two G5 events. The X28 flare on Nov 4 may be the largest ever measured. Power grid fluctuations across Europe and North America." },
  { date: "2012-07-23", label: "Near Miss (Carrington-class)", type: "solar", severity: "G5+", desc: "A CME erupted but missed Earth by 9 days. Scientists estimate it would have caused $2 trillion in damage to global infrastructure if it had hit." },
  { date: "2015-03-17", label: "St Patrick's Day Storm", type: "solar", severity: "G4", desc: "The strongest storm of Solar Cycle 24. Disrupted GPS signals globally and produced auroras visible across the UK and northern US." },
  { date: "2017-09-06", label: "X9.3 Flare", type: "solar", severity: "G3", desc: "Largest solar flare of Solar Cycle 24. Significant radio blackouts across Europe, Africa, and the Atlantic. GPS and navigation affected." },
  { date: "2024-05-10", label: "Gannon Storm", type: "solar", severity: "G5", desc: "Strongest geomagnetic storm since 2003. Auroras visible across the UK and as far south as Florida. GPS errors disrupted automated farm equipment. Radio blackouts affected aviation." },
];

const SEVERITY_COLORS = {
  "G5+": "#ff4444",
  "G5": "#d4853a",
  "G4": "#c9a227",
  "G3": "#6b8cb0",
  "G2": "#2e4060",
};

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=DM+Mono:ital,wght@0,300;0,400;1,300&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}

  /* Colour tokens — all secondary text now #9db5cc (WCAG AA on #04060d) */
  :root{
    --bg0:#04060d;
    --bg1:#080e1a;
    --bg2:#0d1526;
    --border:#1e3050;
    --border-hi:#2e4868;
    --text-primary:#dde8f2;
    --text-secondary:#9db5cc;
    --text-dim:#6a8aaa;
    --amber:#d4853a;
    --amber-hi:#f0a050;
    --cold:#5aabcf;
    --green:#4ab07a;
  }

  .td-root{background:var(--bg0);color:var(--text-primary);font-family:'Libre Baskerville',Georgia,serif;font-weight:400;min-height:100vh;overflow-x:hidden;position:relative}
  .td-canvas{position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0}
  .td-main{position:relative;z-index:2}

  .td-banner{background:rgba(8,14,26,0.92);backdrop-filter:blur(10px);border-bottom:1px solid var(--border);padding:0.6rem 1.4rem;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:100;font-family:'DM Mono',monospace;font-size:0.6rem;letter-spacing:0.08em;color:var(--text-dim)}
  .td-live{color:var(--amber-hi)}

  .td-hero{min-height:100svh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:4rem 1.5rem 5rem;position:relative}
  .td-eyebrow{font-family:'DM Mono',monospace;font-size:0.6rem;letter-spacing:0.28em;text-transform:uppercase;color:var(--text-secondary);margin-bottom:2rem;animation:fadeUp 1.2s ease 0.3s both}
  .td-title{font-size:clamp(3rem,16vw,7rem);font-weight:400;line-height:0.95;letter-spacing:-0.02em;color:var(--text-primary);animation:fadeUp 1.2s ease 0.6s both}
  .td-title-em{font-style:italic;color:var(--amber-hi);display:block}
  .td-sub{font-size:clamp(1rem,3.5vw,1.2rem);color:var(--text-secondary);max-width:500px;line-height:1.8;margin-top:1.8rem;animation:fadeUp 1.2s ease 0.9s both;font-style:italic}
  .td-clock-wrap{margin-top:2rem;animation:fadeUp 1.2s ease 1.2s both;position:relative}
  .td-clock-caption{font-family:'DM Mono',monospace;font-size:0.5rem;letter-spacing:0.2em;color:var(--text-dim);text-transform:uppercase;text-align:center;margin-top:0.6rem}
  .td-scroll-hint{position:absolute;bottom:1.5rem;left:50%;transform:translateX(-50%);font-family:'DM Mono',monospace;font-size:0.52rem;letter-spacing:0.2em;color:var(--text-dim);text-transform:uppercase;animation:fadeUp 1s ease 2s both,pulse 3s ease-in-out 3s infinite;white-space:nowrap}

  @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
  @keyframes pulse{0%,100%{opacity:0.45}50%{opacity:1}}

  /* ── CALCULATOR ── */
  .td-calc-wrap{background:var(--bg1);border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
  .td-calc-inner{max-width:900px;margin:0 auto;padding:clamp(3rem,8vh,5rem) clamp(1.2rem,5vw,4rem)}
  .td-calc-header{display:flex;align-items:center;gap:1rem;margin-bottom:2rem}
  .td-calc-num{font-family:'DM Mono',monospace;font-size:0.58rem;color:var(--amber);letter-spacing:0.12em;white-space:nowrap}
  .td-calc-line{flex:1;height:1px;background:linear-gradient(to right,var(--border),transparent)}
  .td-calc-title{font-size:clamp(1.8rem,7vw,3rem);font-weight:400;color:var(--text-primary);line-height:1.1;margin-bottom:0.8rem}
  .td-calc-title em{font-style:italic;color:var(--amber-hi)}
  .td-calc-sub{font-size:clamp(1rem,3vw,1.1rem);color:var(--text-secondary);line-height:1.8;margin-bottom:2rem;max-width:560px;font-style:italic}

  /* Steps */
  .td-steps{display:flex;flex-direction:column;gap:2rem;margin-bottom:2rem}
  .td-step-label{font-family:'DM Mono',monospace;font-size:0.58rem;letter-spacing:0.18em;text-transform:uppercase;color:var(--text-secondary);margin-bottom:0.6rem;display:flex;align-items:center;gap:0.6rem}
  .td-step-label::before{content:attr(data-n);display:inline-flex;align-items:center;justify-content:center;width:1.5rem;height:1.5rem;border:1px solid var(--border-hi);border-radius:50%;font-size:0.55rem;color:var(--amber);flex-shrink:0}

  .td-input-row{display:flex;gap:1rem;align-items:flex-end;flex-wrap:wrap}
  .td-input-group{display:flex;flex-direction:column;gap:0.4rem;flex:1;min-width:160px}
  .td-input{background:var(--bg2);border:1px solid var(--border-hi);color:var(--text-primary);font-family:'Libre Baskerville',Georgia,serif;font-size:1.1rem;font-weight:400;padding:0.75rem 1rem;outline:none;transition:border-color 0.3s ease;width:100%;-webkit-appearance:none;appearance:none;color-scheme:dark}
  .td-input:focus{border-color:var(--amber)}
  .td-input::-webkit-calendar-picker-indicator{filter:invert(0.5)}

  .td-select{background:var(--bg2);border:1px solid var(--border-hi);color:var(--text-primary);font-family:'DM Mono',monospace;font-size:0.62rem;letter-spacing:0.04em;padding:0.75rem 1rem;outline:none;transition:border-color 0.3s ease;width:100%;-webkit-appearance:none;appearance:none;cursor:pointer;color-scheme:dark}
  .td-select:focus{border-color:var(--amber)}

  .td-pills{display:flex;flex-wrap:wrap;gap:0.5rem}
  .td-pill{background:transparent;border:1px solid var(--border-hi);color:var(--text-secondary);font-family:'DM Mono',monospace;font-size:0.55rem;letter-spacing:0.08em;padding:0.55rem 0.85rem;cursor:pointer;transition:all 0.2s ease;text-align:left;line-height:1.4}
  .td-pill:hover{border-color:var(--text-secondary);color:var(--text-primary)}
  .td-pill.active{border-color:var(--amber);color:var(--amber-hi);background:rgba(212,133,58,0.08)}

  .td-calc-btn{background:transparent;border:1px solid var(--amber);color:var(--amber-hi);font-family:'DM Mono',monospace;font-size:0.62rem;letter-spacing:0.18em;text-transform:uppercase;padding:0.9rem 2rem;cursor:pointer;transition:background 0.3s ease;margin-top:0.5rem;align-self:flex-start}
  .td-calc-btn:hover{background:rgba(212,133,58,0.1)}

  /* Results */
  .td-result{animation:fadeUp 0.6s ease both}
  .td-age-display{font-size:clamp(0.82rem,2.2vw,0.9rem);color:var(--text-secondary);font-family:'DM Mono',monospace;letter-spacing:0.04em;margin-bottom:2rem;line-height:2.4}
  .td-age-display strong{color:var(--text-primary);font-weight:400}
  .td-age-display .amber{color:var(--amber-hi)}

  .td-stolen-hero{background:linear-gradient(135deg,var(--bg2),rgba(212,133,58,0.05));border:1px solid var(--amber);padding:2rem;margin-bottom:1.5px;text-align:center}
  .td-stolen-num{font-size:clamp(4rem,18vw,8rem);font-weight:400;color:var(--amber-hi);line-height:1;letter-spacing:-0.03em}
  .td-stolen-label{font-family:'DM Mono',monospace;font-size:0.58rem;letter-spacing:0.18em;text-transform:uppercase;color:var(--text-secondary);margin-top:0.5rem}
  .td-stolen-sub{font-size:clamp(1.05rem,3.5vw,1.25rem);color:var(--text-secondary);margin-top:1rem;line-height:1.7;font-style:italic}

  .td-no-dst{background:var(--bg2);border:1px solid var(--border);padding:1.5rem;text-align:center;margin-bottom:1.5px}
  .td-no-dst p{font-size:clamp(1rem,3vw,1.2rem);color:var(--text-secondary);line-height:1.8;font-style:italic}
  .td-no-dst p strong{color:var(--text-primary);font-weight:400}

  .td-metric-grid{display:grid;grid-template-columns:1fr 1fr;gap:1.5px;margin-bottom:1.5px}
  @media(min-width:600px){.td-metric-grid{grid-template-columns:repeat(4,1fr)}}
  .td-metric{background:var(--bg2);border:1px solid var(--border);padding:1.2rem;text-align:center}
  .td-metric-val{font-size:clamp(1.1rem,4vw,1.8rem);font-weight:400;color:var(--text-primary);letter-spacing:-0.02em;line-height:1}
  .td-metric-val.amber{color:var(--amber-hi)}
  .td-metric-val.cold{color:var(--cold)}
  .td-metric-val.mist{color:var(--text-secondary)}
  .td-metric-val.green{color:var(--green)}
  .td-metric-lbl{font-family:'DM Mono',monospace;font-size:0.5rem;letter-spacing:0.13em;text-transform:uppercase;color:var(--text-secondary);margin-top:0.5rem;line-height:1.5}

  .td-insight{background:var(--bg2);border:1px solid var(--border);padding:1.8rem;margin-bottom:1.5px}
  .td-insight p{font-size:clamp(1rem,3vw,1.08rem);color:var(--text-secondary);line-height:1.9}
  .td-insight p+p{margin-top:1rem}
  .td-insight strong{color:var(--text-primary);font-weight:400}
  .td-insight .amber{color:var(--amber-hi)}
  .td-insight .cold{color:var(--cold)}
  .td-insight .green{color:var(--green)}

  .td-next-steal{background:linear-gradient(135deg,var(--bg2),rgba(139,58,42,0.06));border:1px solid var(--border-hi);padding:1.2rem 1.5rem;display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap}
  .td-next-label{font-family:'DM Mono',monospace;font-size:0.55rem;letter-spacing:0.15em;text-transform:uppercase;color:var(--text-secondary)}
  .td-next-val{font-size:1.3rem;color:var(--text-primary);margin-top:0.2rem}
  .td-next-days{font-family:'DM Mono',monospace;font-size:0.58rem;color:var(--amber);letter-spacing:0.1em;text-align:right}

  .td-reset-btn{background:none;border:none;color:var(--text-dim);font-family:'DM Mono',monospace;font-size:0.55rem;letter-spacing:0.15em;text-transform:uppercase;cursor:pointer;margin-top:1.5rem;padding:0;transition:color 0.3s}
  .td-reset-btn:hover{color:var(--text-secondary)}

  /* STATS */
  .td-stats{background:var(--bg2);border-top:1px solid var(--border);border-bottom:1px solid var(--border);padding:2.5rem 1.5rem;display:grid;grid-template-columns:1fr 1fr;gap:2rem 1rem;text-align:center}
  @media(min-width:600px){.td-stats{grid-template-columns:repeat(4,1fr)}}
  .td-stat-val{font-size:clamp(2rem,8vw,3rem);font-weight:400;color:var(--amber-hi);letter-spacing:-0.02em;line-height:1}
  .td-stat-label{font-family:'DM Mono',monospace;font-size:0.52rem;letter-spacing:0.13em;text-transform:uppercase;color:var(--text-secondary);margin-top:0.5rem;line-height:1.5}

  /* SECTION */
  .td-section{padding:clamp(3rem,8vh,6rem) clamp(1.2rem,5vw,4rem);max-width:900px;margin:0 auto}
  .td-section-header{display:flex;align-items:center;gap:1rem;margin-bottom:2rem}
  .td-section-num{font-family:'DM Mono',monospace;font-size:0.58rem;color:var(--amber);letter-spacing:0.12em;white-space:nowrap}
  .td-section-line{flex:1;height:1px;background:linear-gradient(to right,var(--border),transparent)}
  .td-section-title{font-size:clamp(1.8rem,7vw,3rem);font-weight:400;color:var(--text-primary);line-height:1.1;margin-bottom:0.8rem}
  .td-section-title em{font-style:italic;color:var(--amber-hi)}
  .td-section-intro{font-size:clamp(1rem,3vw,1.1rem);color:var(--text-secondary);line-height:1.85;margin-bottom:2rem;font-style:italic}

  /* DST VISUAL */
  .td-dst{background:var(--bg2);border:1px solid var(--border);padding:1.5rem;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:1rem;margin-bottom:2rem;text-align:center}
  .td-dst-big{font-size:clamp(2rem,8vw,3.5rem);font-weight:400;color:var(--text-primary);letter-spacing:-0.02em;line-height:1}
  .td-dst-big.stolen{color:var(--amber-hi)}
  .td-dst-label{font-family:'DM Mono',monospace;font-size:0.52rem;letter-spacing:0.13em;text-transform:uppercase;color:var(--text-secondary);margin-top:0.4rem}
  .td-dst-arrow{display:flex;flex-direction:column;align-items:center;gap:0.2rem;color:var(--amber);font-size:1.2rem}
  .td-dst-arrow span{font-family:'DM Mono',monospace;font-size:0.48rem;letter-spacing:0.1em;color:var(--text-dim);text-transform:uppercase}
  .td-dst-arrow strong{color:var(--amber-hi);font-weight:400;font-size:0.58rem;font-family:'DM Mono',monospace}

  /* CARDS */
  .td-cards{display:grid;grid-template-columns:1fr;gap:1.5px}
  @media(min-width:600px){.td-cards{grid-template-columns:1fr 1fr}}
  .td-card{background:linear-gradient(135deg,var(--bg1),var(--bg2));border:1px solid var(--border);padding:1.8rem}
  .td-card-tag{font-family:'DM Mono',monospace;font-size:0.52rem;letter-spacing:0.18em;text-transform:uppercase;color:var(--amber);margin-bottom:0.6rem;display:block}
  .td-card-title{font-size:clamp(1.1rem,4vw,1.35rem);font-weight:400;color:var(--text-primary);margin-bottom:0.75rem;line-height:1.3}
  .td-card-body{font-size:clamp(0.95rem,2.8vw,1.02rem);line-height:1.8;color:var(--text-secondary)}
  .td-card-link{display:inline-flex;align-items:center;gap:0.3rem;margin-top:1rem;font-family:'DM Mono',monospace;font-size:0.55rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--amber-hi);text-decoration:none}

  /* REL */
  .td-rel-grid{display:grid;grid-template-columns:1fr;gap:1.5px}
  @media(min-width:600px){.td-rel-grid{grid-template-columns:1fr 1fr}}
  .td-rel-card{background:var(--bg1);border:1px solid var(--border);padding:1.8rem;position:relative}
  .td-rel-card.hl{border-color:var(--amber);background:linear-gradient(135deg,var(--bg1),rgba(212,133,58,0.04))}
  .td-rel-num{font-size:4rem;font-weight:400;color:var(--border);line-height:1;position:absolute;top:0.5rem;right:1rem;pointer-events:none}

  /* QUOTE */
  .td-quote{padding:clamp(3rem,6vh,5rem) clamp(1.2rem,5vw,4rem);max-width:800px;margin:0 auto;text-align:center;position:relative}
  .td-quote-mark{font-size:8rem;line-height:0.5;color:var(--border);font-family:'Libre Baskerville',serif;position:absolute;top:2rem;left:0.5rem;pointer-events:none}
  .td-quote p{font-size:clamp(1.25rem,4.5vw,2.1rem);line-height:1.55;color:var(--text-primary);font-style:italic;position:relative;z-index:1}
  .td-quote cite{display:block;margin-top:1.2rem;font-family:'DM Mono',monospace;font-size:0.52rem;letter-spacing:0.15em;color:var(--text-secondary);font-style:normal;text-transform:uppercase}

  /* ── COMBINED TIMELINE ── */
  .td-timeline{position:relative;padding-left:1.2rem}
  .td-timeline::before{content:'';position:absolute;left:0;top:0;bottom:0;width:1px;background:linear-gradient(to bottom,transparent,var(--border-hi) 10%,var(--border-hi) 90%,transparent)}

  .td-titem{position:relative;padding:0 0 0.1rem 1.5rem;display:flex;flex-direction:column;gap:0}
  .td-titem-inner{padding-bottom:2rem}

  .td-tdot{position:absolute;left:-0.32rem;top:0.4rem;width:0.62rem;height:0.62rem;border-radius:50%;border:1px solid var(--border-hi);background:var(--bg0);transition:all 0.2s}
  .td-tdot.solar{border-color:var(--amber);background:var(--bg2)}
  .td-tdot.solar.g5plus{border-color:#ff5555;box-shadow:0 0 6px rgba(255,85,85,0.4)}
  .td-tdot.solar.g5{border-color:var(--amber);box-shadow:0 0 6px rgba(212,133,58,0.3)}
  .td-tdot.solar.g4{border-color:#c9a227}
  .td-tdot.solar.g3{border-color:var(--text-secondary)}
  .td-tdot.history{border-color:var(--border-hi);background:var(--bg0)}

  .td-tdate{font-family:'DM Mono',monospace;font-size:0.55rem;letter-spacing:0.12em;color:var(--text-dim);margin-bottom:0.2rem}
  .td-tdate.solar{color:var(--amber)}

  .td-trow{display:flex;align-items:center;gap:0.6rem;margin-bottom:0.3rem}
  .td-ttitle{font-size:clamp(1rem,3.2vw,1.15rem);color:var(--text-primary);line-height:1.2}
  .td-tseverity{font-family:'DM Mono',monospace;font-size:0.45rem;letter-spacing:0.1em;padding:0.15rem 0.4rem;border-radius:2px;font-weight:400}
  .td-tbody{font-size:clamp(0.92rem,2.5vw,1rem);color:var(--text-secondary);line-height:1.8}

  /* Timeline legend */
  .td-legend{display:flex;gap:1.5rem;flex-wrap:wrap;margin-bottom:2rem}
  .td-legend-item{display:flex;align-items:center;gap:0.5rem;font-family:'DM Mono',monospace;font-size:0.52rem;letter-spacing:0.08em;color:var(--text-secondary)}
  .td-legend-dot{width:0.6rem;height:0.6rem;border-radius:50%;border:1px solid}

  /* Solar filter */
  .td-filter{display:flex;gap:0.5rem;margin-bottom:1.5rem;flex-wrap:wrap}
  .td-filter-btn{background:transparent;border:1px solid var(--border);color:var(--text-secondary);font-family:'DM Mono',monospace;font-size:0.52rem;letter-spacing:0.08em;padding:0.45rem 0.75rem;cursor:pointer;transition:all 0.2s}
  .td-filter-btn:hover{border-color:var(--border-hi);color:var(--text-primary)}
  .td-filter-btn.active{border-color:var(--amber);color:var(--amber-hi);background:rgba(212,133,58,0.06)}

  .td-divider{height:1px;background:linear-gradient(to right,transparent,var(--border),transparent);margin:0 1.5rem}
  .td-footer{border-top:1px solid var(--border);padding:2rem 1.5rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.8rem}
  .td-footer-brand{font-size:1.05rem;color:var(--text-secondary)}
  .td-footer-brand em{color:var(--amber-hi);font-style:italic}
  .td-footer-note{font-family:'DM Mono',monospace;font-size:0.52rem;letter-spacing:0.12em;color:var(--text-dim);text-transform:uppercase}

  .td-reveal{opacity:0;transform:translateY(24px);transition:opacity 0.7s ease,transform 0.7s ease}
  .td-reveal.visible{opacity:1;transform:translateY(0)}
`;

// ─────────────────────────────────────────────────────────────
// REACT COMPONENTS
// ─────────────────────────────────────────────────────────────

// ── WARP STARFIELD ────────────────────────────────────────────
// Radial warp: stars born near centre, stream outward.
// Key properties matching the reference image:
//  - Hugely varied sizes: most are sub-pixel pinpricks, a few larger
//  - Soft glow/blur via radial gradient (no sharp uniform circles)
//  - Streaks that are LINES not stretched circles — thin & directional
//  - Speed varies a lot so motion feels organic not mechanical
//  - Overall very dark — glow is blue-white, mostly dim
function Starfield() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx    = canvas.getContext("2d");
    let W, H, CX, CY, raf;

    // Stars carry their own intrinsic size so the field is genuinely varied
    const mkStar = () => {
      // Size distribution: heavily weighted toward tiny
      const sizeRoll = Math.random();
      // ~70% sub-pixel, ~25% small, ~5% slightly larger
      const baseR = sizeRoll < 0.70 ? 0.15 + Math.random() * 0.25
                  : sizeRoll < 0.95 ? 0.4  + Math.random() * 0.55
                  :                   0.9  + Math.random() * 1.1;
      // Speed: wide range so near/far feel is clear
      const speed = 0.03 + Math.pow(Math.random(), 1.6) * 0.55;
      // Glow radius: larger stars get more glow, tiny ones almost none
      const glowR = baseR < 0.3 ? 0 : baseR * (1.8 + Math.random() * 2.5);
      // Colour: mostly cold blue-white, occasional warm
      const warm  = Math.random() < 0.07;
      return {
        angle: Math.random() * Math.PI * 2,
        dist:  2 + Math.random() * 8,
        speed,
        baseR,
        glowR,
        warm,
      };
    };

    // Total star count — dense like the reference
    const TOTAL = 700;
    let stars = Array.from({ length: TOTAL }, mkStar);

    // Pre-scatter across full diagonal so screen fills instantly
    const resize = () => {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
      CX = W / 2; CY = H / 2;
    };

    // Draw a soft glow blob — radial gradient, pure blur effect
    const drawGlow = (x, y, r, col) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0,   col);
      g.addColorStop(0.3, col);
      g.addColorStop(1,   col.replace(/[\d.]+\)$/, "0)"));
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
    };

    // Initialise distances spread across screen
    resize();
    const initMaxDist = Math.sqrt(CX * CX + CY * CY);
    stars.forEach(s => { s.dist = 4 + Math.random() * initMaxDist * 1.1; });

    const draw = () => {
      // Semi-transparent fill: controls how long streak ghosts linger
      // More opaque = shorter trails (reference has medium length)
      ctx.fillStyle = "rgba(4,6,13,0.20)";
      ctx.fillRect(0, 0, W, H);

      const maxDist = Math.sqrt(CX * CX + CY * CY);

      stars.forEach((s, i) => {
        // Acceleration tied to current distance — feels like zooming in
        s.dist += s.speed * (1 + s.dist * 0.0055);

        const x = CX + Math.cos(s.angle) * s.dist;
        const y = CY + Math.sin(s.angle) * s.dist;

        // t: 0 at origin, 1 at screen edge — drives fade-in and size growth
        const t = Math.min(s.dist / maxDist, 1);

        // Opacity: fade in gently from centre, never fully opaque for most stars
        const maxOpac = s.baseR > 0.8 ? 0.75 : s.baseR > 0.35 ? 0.45 : 0.28;
        const opacity = Math.min(t * 2.8, 1) * maxOpac;

        // Radius grows slightly as star approaches (perspective scaling)
        const r = s.baseR * (0.4 + t * 0.7);

        const base = s.warm ? "220,185,130" : "180,210,240";

        // ── STREAK (line from prev position to current) ──
        // Length is a fraction of current dist — grows as star moves out
        const streakLen = s.dist * (s.baseR < 0.3 ? 0.06 : s.baseR < 0.7 ? 0.11 : 0.17);
        const px = CX + Math.cos(s.angle) * (s.dist - streakLen);
        const py = CY + Math.sin(s.angle) * (s.dist - streakLen);

        const sg = ctx.createLinearGradient(px, py, x, y);
        sg.addColorStop(0, `rgba(${base},0)`);
        sg.addColorStop(1, `rgba(${base},${(opacity * 0.8).toFixed(3)})`);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(x, y);
        ctx.strokeStyle = sg;
        // Line width varies with star size — tiny ones leave hair-thin trails
        ctx.lineWidth = Math.max(0.2, r * 0.65);
        ctx.stroke();

        // ── GLOW BLOB (only for non-tiny stars) ──
        if (s.glowR > 0 && opacity > 0.05) {
          drawGlow(x, y, r + s.glowR * t, `rgba(${base},${(opacity * 0.35).toFixed(3)})`);
        }

        // ── STAR CORE dot ──
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.15, r), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${base},${opacity.toFixed(3)})`;
        ctx.fill();

        // Reset when off-screen
        if (x < -40 || x > W + 40 || y < -40 || y > H + 40) {
          const ns = mkStar();
          stars[i] = ns;
        }
      });

      raf = requestAnimationFrame(draw);
    };

    ctx.fillStyle = "#04060d";
    ctx.fillRect(0, 0, W, H);
    draw();
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={ref} className="td-canvas" />;
}

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
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      style={{ overflow: "visible", filter: "drop-shadow(0 0 30px rgba(100,160,220,0.12))" }}>

      {/* Faint outer rim circle — barely visible */}
      <circle cx={cx} cy={cy} r={rimR} fill="none" stroke="rgba(46,64,96,0.25)" strokeWidth="0.5" strokeDasharray="2 6"/>

      {/* Constellation connecting lines between hour clusters */}
      {constLines.map(([a, b], i) => {
        const ca = hourClusters[a].centre;
        const cb = hourClusters[b].centre;
        return (
          <line key={i}
            x1={ca.x} y1={ca.y} x2={cb.x} y2={cb.y}
            stroke="rgba(107,140,176,0.12)" strokeWidth="0.6"
          />
        );
      })}

      {/* Hour hand — faint dotted line to nearest cluster star */}
      <line x1={cx} y1={cy} x2={hEnd.x} y2={hEnd.y}
        stroke="rgba(184,201,224,0.35)" strokeWidth="1.2"
        strokeLinecap="round" strokeDasharray="3 5"
      />

      {/* Minute hand — slightly brighter */}
      <line x1={cx} y1={cy} x2={mEnd.x} y2={mEnd.y}
        stroke="rgba(240,160,80,0.45)" strokeWidth="0.9"
        strokeLinecap="round" strokeDasharray="1 4"
      />

      {/* Hour cluster stars */}
      {hourClusters.map((cluster, ci) =>
        cluster.stars.map((star, si) => (
          <circle key={`${ci}-${si}`}
            cx={star.x} cy={star.y} r={star.r}
            fill={`rgba(184,210,240,${star.brightness})`}
          />
        ))
      )}

      {/* Second indicator — a single amber star creeping around the rim */}
      <circle cx={sPos.x} cy={sPos.y} r={2.4}
        fill="rgba(240,160,80,0.9)"
        style={{ filter: "drop-shadow(0 0 4px rgba(240,160,80,0.8))" }}
      />
      {/* Tiny halo */}
      <circle cx={sPos.x} cy={sPos.y} r={4.5}
        fill="none" stroke="rgba(240,160,80,0.25)" strokeWidth="0.8"
      />

      {/* Centre star */}
      <circle cx={cx} cy={cy} r={2}
        fill="rgba(200,220,255,0.9)"
        style={{ filter: "drop-shadow(0 0 5px rgba(184,210,240,0.9))" }}
      />
    </svg>
  );
}

function LiveTime() {
  const [t,setT]=useState("");
  useEffect(()=>{const tick=()=>{const n=new Date();setT([n.getHours(),n.getMinutes(),n.getSeconds()].map(v=>String(v).padStart(2,"0")).join(":"));};tick();const id=setInterval(tick,1000);return()=>clearInterval(id);},[]);
  return <span className="td-live">{t}</span>;
}

function Reveal({children}) {
  const ref=useRef(null);
  useEffect(()=>{const el=ref.current;if(!el)return;const obs=new IntersectionObserver(e=>{e.forEach(x=>{if(x.isIntersecting){el.classList.add("visible");obs.unobserve(el);}});},{threshold:0.06});obs.observe(el);return()=>obs.disconnect();},[]);
  return <div className="td-reveal" ref={ref}>{children}</div>;
}

function LiveAge({dob,region,flightKey}) {
  const [d,setD]=useState(()=>calcDissonance(dob,region,flightKey));
  useEffect(()=>{const id=setInterval(()=>setD(calcDissonance(dob,region,flightKey)),1000);return()=>clearInterval(id);},[dob,region,flightKey]);
  if(!d) return null;
  const pad=v=>String(v).padStart(2,"0");
  return(
    <div className="td-age-display">
      You are precisely{" "}
      <strong>{d.years}y {d.months}m {d.days}d </strong>
      <span className="amber">{pad(d.hours)}:{pad(d.minutes)}:{pad(d.seconds)}</span> old.
      <br/>
      That is <strong>{d.totalHours.toLocaleString()}</strong> hours of existence and counting.
    </div>
  );
}

function DissonanceCalc() {
  const [step, setStep] = useState(1); // 1=inputs, 2=results
  const [dob, setDob] = useState("");
  const [region, setRegion] = useState("uk");
  const [flight, setFlight] = useState("annual");
  const [result, setResult] = useState(null);

  const calculate = useCallback(() => {
    const r = calcDissonance(dob, region, flight);
    if (r) { setResult(r); setStep(2); }
  }, [dob, region, flight]);

  const reset = () => { setStep(1); setResult(null); };

  const fmtDate = d => d.toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"});
  const flightOpt = FLIGHT_OPTIONS.find(o=>o.key===flight);

  return (
    <div className="td-calc-wrap">
      <div className="td-calc-inner">
        <div className="td-calc-header">
          <span className="td-calc-num">01 / Your time</span>
          <div className="td-calc-line"/>
        </div>
        <h2 className="td-calc-title">How Much Time Has <em>Slipped Past?</em></h2>
        <p className="td-calc-sub">
          Tell us a little about yourself and we'll calculate your personal time dissonance — how many clock-hours have simply not existed during your lifetime, and how flying has nudged your age away from the person who never left the ground.
        </p>

        {step === 1 && (
          <div className="td-steps">
            {/* Step 1: DOB */}
            <div>
              <div className="td-step-label" data-n="1">Date of birth</div>
              <div className="td-input-row">
                <div className="td-input-group">
                  <input type="date" className="td-input" value={dob}
                    max={new Date().toISOString().split("T")[0]} min="1900-01-01"
                    onChange={e=>setDob(e.target.value)}
                    onKeyDown={e=>e.key==="Enter"&&calculate()}
                  />
                </div>
              </div>
            </div>

            {/* Step 2: Region */}
            <div>
              <div className="td-step-label" data-n="2">Where did you grow up?</div>
              <div className="td-input-row">
                <div className="td-input-group">
                  <select className="td-select" value={region} onChange={e=>setRegion(e.target.value)}>
                    {Object.entries(DST_REGIONS).map(([k,v])=>(
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Step 3: Flights */}
            <div>
              <div className="td-step-label" data-n="3">How often do you take long-haul flights?</div>
              <div className="td-pills">
                {FLIGHT_OPTIONS.map(o=>(
                  <button key={o.key} className={`td-pill${flight===o.key?" active":""}`} onClick={()=>setFlight(o.key)}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <button className="td-calc-btn" onClick={calculate}>Show me my dissonance</button>
          </div>
        )}

        {step === 2 && result && (
          <div className="td-result">
            <LiveAge dob={dob} region={region} flightKey={flight}/>

            {result.regionNoDST ? (
              <div className="td-no-dst">
                <p>
                  <strong>You grew up somewhere without daylight saving time.</strong> While others lost an hour each spring and spent weeks feeling the wrongness of it, your clocks stayed still.
                  <br/><br/>
                  But time was never entirely yours to keep. The relativistic and solar sections below still apply — the universe has its own relationship with your clock, regardless of local policy.
                </p>
              </div>
            ) : (
              <div className="td-stolen-hero">
                <div className="td-stolen-num">{result.hoursStolen}</div>
                <div className="td-stolen-label">Hours that didn't exist during your lifetime</div>
                <div className="td-stolen-sub">
                  That is {result.minutesStolen.toLocaleString()} minutes. Each spring since you were born, a clock-hour was skipped entirely. You didn't sleep through it. There was nothing there to sleep through.
                </div>
              </div>
            )}

            <div className="td-metric-grid">
              {!result.regionNoDST && (
                <div className="td-metric">
                  <div className="td-metric-val amber">{result.hoursStolen}</div>
                  <div className="td-metric-lbl">hours that didn't exist</div>
                </div>
              )}
              {!result.regionNoDST && (
                <div className="td-metric">
                  <div className="td-metric-val">{result.pctStolen}%</div>
                  <div className="td-metric-lbl">of your life, uncounted</div>
                </div>
              )}
              <div className="td-metric">
                <div className="td-metric-val green">{result.nsYounger.toLocaleString()}ns</div>
                <div className="td-metric-lbl">younger than your grounded self</div>
              </div>
              <div className="td-metric">
                <div className="td-metric-val cold">{result.totalFlightHours.toLocaleString()}h</div>
                <div className="td-metric-lbl">estimated hours in the air</div>
              </div>
              {(result.regionNoDST) && (
                <div className="td-metric">
                  <div className="td-metric-val mist">{result.totalHours.toLocaleString()}</div>
                  <div className="td-metric-lbl">hours lived so far</div>
                </div>
              )}
              {(result.regionNoDST) && (
                <div className="td-metric">
                  <div className="td-metric-val amber">0</div>
                  <div className="td-metric-lbl">clock-hours skipped by DST</div>
                </div>
              )}
            </div>

            <div className="td-insight">
              {!result.regionNoDST && (
                <p>
                  Of your <strong>{result.totalHours.toLocaleString()} hours</strong> of existence, <span className="amber">{result.hoursStolen} of them ({result.pctStolen}%)</span> were clock-hours that simply weren't there. Each spring at 1:59am, the minute hand leapt forward to 3:00. The gap between wasn't lost time — it was absent time. A parenthesis in your life with nothing inside it.
                </p>
              )}
              {!result.regionNoDST && (
                <p>
                  When the clocks fall back each autumn, an hour reappears — but it isn't the one that vanished. That version of a Saturday morning in late March, the slow cup of tea at 2:15am that could have existed, is simply gone. What returns is a different hour, belonging to a different timeline.
                </p>
              )}
              {result.nsYounger > 0 && (
                <p>
                  Based on <strong>{flightOpt.label.toLowerCase()}</strong> long-haul travel, roughly <strong>{result.totalFlightHours.toLocaleString()} hours</strong> of your life have been spent at altitude. At cruising speed, velocity time dilation outpaces the gravitational effect — meaning you are approximately <span className="green">{result.nsYounger.toLocaleString()} nanoseconds younger</span> than the version of you who never boarded a plane. Somewhere, that other you is fractionally older.
                </p>
              )}
              {result.nsYounger === 0 && (
                <p>
                  You've barely flown, so your relativistic twin — the version of you who never left the ground — is aging at almost exactly your pace. You are, for now, the same person.
                </p>
              )}
            </div>

            {result.daysToNextSteal && (
              <div className="td-next-steal">
                <div>
                  <div className="td-next-label">Next hour that won't exist</div>
                  <div className="td-next-val">{fmtDate(result.nextSpring)}</div>
                </div>
                <div className="td-next-days">{result.daysToNextSteal} days away</div>
              </div>
            )}

            <button className="td-reset-btn" onClick={reset}>← Recalculate</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// COMBINED TIMELINE COMPONENT
// ─────────────────────────────────────────────────────────────
function CombinedTimeline() {
  const [filter, setFilter] = useState("all");

  const filtered = HISTORY_EVENTS.filter(e => {
    if (filter === "all") return true;
    if (filter === "solar") return e.type === "solar";
    if (filter === "history") return e.type === "history";
    return true;
  });

  const severityClass = (sev) => {
    if (!sev) return "";
    return sev.toLowerCase().replace("+","plus");
  };

  const sevColor = (sev) => SEVERITY_COLORS[sev] || "#2e4060";

  return (
    <section className="td-section">
      <Reveal>
        <div className="td-section-header">
          <span className="td-section-num">05 / Timeline</span>
          <div className="td-section-line"/>
        </div>
        <h2 className="td-section-title">History of <em>Disrupted Time</em></h2>
        <p className="td-section-intro">
          Every event below changed how time was experienced — sometimes by policy, sometimes by physics, sometimes by the sun. Solar storms are rated on the NOAA G-scale (G1 minor to G5 extreme).
        </p>

        {/* Legend */}
        <div className="td-legend">
          <div className="td-legend-item">
            <div className="td-legend-dot" style={{borderColor:"#2e4060",background:"#04060d"}}/>
            Historical event
          </div>
          <div className="td-legend-item">
            <div className="td-legend-dot" style={{borderColor:"#d4853a",background:"#0d1526"}}/>
            G3/G4 solar storm
          </div>
          <div className="td-legend-item">
            <div className="td-legend-dot" style={{borderColor:"#d4853a",background:"#0d1526",boxShadow:"0 0 5px rgba(212,133,58,0.4)"}}/>
            G5 extreme storm
          </div>
          <div className="td-legend-item">
            <div className="td-legend-dot" style={{borderColor:"#ff4444",background:"#0d1526",boxShadow:"0 0 5px rgba(255,68,68,0.5)"}}/>
            Carrington-class
          </div>
        </div>

        {/* Filter */}
        <div className="td-filter">
          {["all","solar","history"].map(f=>(
            <button key={f} className={`td-filter-btn${filter===f?" active":""}`} onClick={()=>setFilter(f)}>
              {f === "all" ? "All events" : f === "solar" ? "Solar storms only" : "Historical only"}
            </button>
          ))}
        </div>
      </Reveal>

      <Reveal>
        <div className="td-timeline">
          {filtered.map((item, i) => (
            <div className="td-titem" key={i}>
              <div className={`td-tdot ${item.type}${item.severity ? " "+severityClass(item.severity) : ""}`}/>
              <div className="td-titem-inner">
                <div className={`td-tdate${item.type==="solar"?" solar":""}`}>
                  {item.date.slice(0,7).replace("-","/")}
                </div>
                <div className="td-trow">
                  <div className="td-ttitle">{item.label}</div>
                  {item.severity && (
                    <span className="td-tseverity" style={{background:sevColor(item.severity)+"22",color:sevColor(item.severity),border:`1px solid ${sevColor(item.severity)}44`}}>
                      {item.severity}
                    </span>
                  )}
                </div>
                <div className="td-tbody">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// STATIC DATA
// ─────────────────────────────────────────────────────────────
const dstCards = [
  {tag:"Where it came from",title:"A joke that became policy",body:"Benjamin Franklin wrote satirically about waking Parisians at dawn to save candles. He didn't mean it seriously. A century later, Germany adopted the idea as wartime rationing. The whimsy became infrastructure.",link:"https://www.britannica.com/story/who-invented-daylight-saving-time",linkLabel:"Britannica"},
  {tag:"What it does to you",title:"Your body keeps the old time",body:"In the days after the spring change, rates of heart attacks, car accidents, and workplace injuries all rise measurably. Your body's internal clock doesn't reset on command. It holds on to the hour that vanished.",link:"https://www.sleepfoundation.org/sleep-hygiene/daylight-saving-time-and-sleep",linkLabel:"Sleep Foundation"},
  {tag:"The original reason",title:"It no longer does what it promised",body:"Daylight saving was meant to reduce energy use by shifting daylight into evenings. The evidence it ever worked is thin. Studies in some US states found electricity consumption went up — people just ran air conditioning in the brighter evenings.",link:"https://www.nber.org/papers/w14429",linkLabel:"NBER Research"},
  {tag:"The autumn return",title:"The hour you get back isn't yours",body:"In October, the clocks fall back and an hour reappears. But it isn't the same hour. The version of you who would have lived that hour without daylight saving — you can't recover them. You receive someone else's hour in their place.",link:"https://www.bbc.co.uk/news/uk-politics-49678133",linkLabel:"BBC"},
];

const relCards = [
  {num:"01",tag:"Moving clocks run slow",title:"Every flight makes you fractionally younger",body:"When you move quickly, time passes more slowly for you than for someone standing still. A passenger on a long-haul flight arrives slightly younger than a version of themselves who stayed home. The difference is nanoseconds — but it is real, measured, undeniable.",link:"https://www.bbc.co.uk/sciencefocus/article/does-time-pass-more-slowly-on-a-plane",linkLabel:"BBC Science",hl:true},
  {num:"02",tag:"Gravity bends time",title:"Altitude makes clocks run fast",body:"The further you are from a large mass, the faster time flows. GPS satellites orbit at 20,000km and their clocks run 38 microseconds fast per day without correction. If engineers ignored this, your maps would be wrong by about 10km. They don't ignore it.",link:"https://science.nasa.gov/learn/explainers/einsteins-theory-of-relativity/",linkLabel:"NASA"},
  {num:"03",tag:"Hafele-Keating, 1971",title:"It was tested on commercial flights",body:"In 1971, physicists flew atomic clocks around the world in both directions on commercial aircraft, then compared them to clocks on the ground. Einstein's predictions were confirmed precisely. Time dilation had been measured aboard a passenger jet.",link:"https://www.science.org/doi/10.1126/science.177.4044.166",linkLabel:"Science journal"},
  {num:"04",tag:"It's already built in",title:"Your phone quietly does all of this",body:"The relativity corrections to GPS are not optional. Without them, the system would be useless within hours. Every time you navigate somewhere, a computer is silently compensating for the fact that time runs differently in orbit than it does in your pocket.",link:"https://physicscentral.com/explore/writers/will.cfm",linkLabel:"Physics Central"},
];

const solarCards = [
  {tag:"The signal disappears",title:"GPS timing fails silently",body:"Solar storms compress and distort the ionosphere that GPS signals travel through. Timing errors creep in — tens of metres at first, then more. The system doesn't announce this. Your phone keeps showing a blue dot, just not quite in the right place.",link:"https://www.swpc.noaa.gov/impacts/gps-position-errors",linkLabel:"NOAA"},
  {tag:"A clock you didn't know you had",title:"Your oven runs on the power grid",body:"Many appliances keep time by counting the oscillations of the AC power supply — 50 cycles per second in the UK. When solar activity disrupts the grid, the frequency drifts. Ovens, microwaves, and older alarm clocks quietly accumulate minutes of error.",link:"https://www.newscientist.com/article/2239540-slow-clocks-why-your-oven-and-other-appliances-may-be-running-behind/",linkLabel:"New Scientist"},
  {tag:"The one that almost wasn't",title:"2012: a near-miss nobody felt",body:"A Carrington-class CME erupted in July 2012. It missed Earth by nine days. Scientists later modelled what would have happened if it had hit — months-long GPS failure, power outages across continents, satellite damage costing trillions to repair.",link:"https://science.nasa.gov/science-research/heliophysics/the-perfect-solar-superstorm-the-1859-carrington-event/",linkLabel:"NASA"},
  {tag:"May 2024",title:"The one you might have seen",body:"A G5 storm — the strongest in over two decades — lit up the sky across the UK and as far south as Florida. While people photographed auroras, automated farm tractors were silently drifting off their GPS-guided paths, and aviation radio briefly failed.",link:"https://www.bbc.co.uk/news/science-environment-69012972",linkLabel:"BBC News"},
];

// ─────────────────────────────────────────────────────────────
// APP
// ─────────────────────────────────────────────────────────────
export default function App() {
  return (
    <div className="td-root">
      <style>{styles}</style>
      <Starfield/>
      <div className="td-main">

        <div className="td-banner">
          <span>TIME DISSONANCE — on the strangeness of hours</span>
          <LiveTime/>
        </div>

        <section className="td-hero">
          <p className="td-eyebrow">On the strangeness of time</p>
          <h1 className="td-title">Time<br/><span className="td-title-em">Dissonance</span></h1>
          <p className="td-sub">Time doesn't flow evenly. It slips, stretches, and vanishes entirely. Some hours you'll never find again — not because you wasted them, but because they simply weren't there.</p>
          <div className="td-clock-wrap">
            <Clock size={200}/>
            <div className="td-clock-caption">hour · minute · second</div>
          </div>
          <p className="td-scroll-hint">Scroll to understand what's happened to your time</p>
        </section>

        <DissonanceCalc/>

        <Reveal>
          <div className="td-stats">
            <div><div className="td-stat-val">1h</div><div className="td-stat-label">Lost each spring, never returned</div></div>
            <div><div className="td-stat-val">38µs</div><div className="td-stat-label">GPS satellites drift daily without Einstein</div></div>
            <div><div className="td-stat-val">0.73ns</div><div className="td-stat-label">Younger per hour in the air</div></div>
            <div><div className="td-stat-val">$2tn</div><div className="td-stat-label">Cost if the 2012 near-miss had hit</div></div>
          </div>
        </Reveal>

        <section className="td-section">
          <Reveal>
            <div className="td-section-header">
              <span className="td-section-num">02 / Daylight Saving Time</span>
              <div className="td-section-line"/>
            </div>
            <h2 className="td-section-title">The Hour That <em>Wasn't There</em></h2>
            <p className="td-section-intro">Every spring, the clocks skip forward. One moment it is 1:59am, and then — without you doing anything, without any ceremony — it is 3am. The hour in between simply didn't happen. You didn't sleep through it. It wasn't there to sleep through.</p>
            <div className="td-dst">
              <div><div className="td-dst-big">01:59</div><div className="td-dst-label">Saturday night</div></div>
              <div className="td-dst-arrow"><span>becomes</span>→<strong>gone</strong></div>
              <div><div className="td-dst-big stolen">03:00</div><div className="td-dst-label">02:00 never existed</div></div>
            </div>
          </Reveal>
          <Reveal>
            <div className="td-cards">
              {dstCards.map((c,i)=>(
                <div className="td-card" key={i}>
                  <span className="td-card-tag">{c.tag}</span>
                  <h3 className="td-card-title">{c.title}</h3>
                  <p className="td-card-body">{c.body}</p>
                  <a className="td-card-link" href={c.link} target="_blank" rel="noopener noreferrer">{c.linkLabel} ↗</a>
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        <div className="td-divider"/>

        <Reveal>
          <div className="td-quote">
            <div className="td-quote-mark">"</div>
            <p>Time is an illusion. Daylight saving time is a reminder that even our illusions have fine print.</p>
            <cite>After Douglas Adams</cite>
          </div>
        </Reveal>

        <div className="td-divider"/>

        <section className="td-section">
          <Reveal>
            <div className="td-section-header">
              <span className="td-section-num">03 / Relativistic Time</span>
              <div className="td-section-line"/>
            </div>
            <h2 className="td-section-title">You Are Aging <em>at Your Own Rate</em></h2>
            <p className="td-section-intro">Every clock in the universe runs at a slightly different pace. This isn't philosophy — it's physics, confirmed repeatedly by experiment. The faster you move, the slower your clock runs. The further from Earth's gravity, the faster it goes. You are not the same age as your grounded self.</p>
          </Reveal>
          <Reveal>
            <div className="td-rel-grid">
              {relCards.map((c,i)=>(
                <div className={`td-rel-card${c.hl?" hl":""}`} key={i}>
                  <div className="td-rel-num">{c.num}</div>
                  <span className="td-card-tag">{c.tag}</span>
                  <h3 className="td-card-title">{c.title}</h3>
                  <p className="td-card-body">{c.body}</p>
                  <a className="td-card-link" href={c.link} target="_blank" rel="noopener noreferrer">{c.linkLabel} ↗</a>
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        <div className="td-divider"/>

        <section className="td-section">
          <Reveal>
            <div className="td-section-header">
              <span className="td-section-num">04 / Solar Weather</span>
              <div className="td-section-line"/>
            </div>
            <h2 className="td-section-title">When the Sun <em>Loses Track</em></h2>
            <p className="td-section-intro">Occasionally the sun releases a billion-tonne cloud of magnetised plasma that reaches Earth in a day or two. When it arrives, it doesn't just produce auroras — it distorts the invisible infrastructure that modern time-keeping depends on.</p>
          </Reveal>
          <Reveal>
            <div className="td-cards">
              {solarCards.map((c,i)=>(
                <div className="td-card" key={i}>
                  <span className="td-card-tag">{c.tag}</span>
                  <h3 className="td-card-title">{c.title}</h3>
                  <p className="td-card-body">{c.body}</p>
                  <a className="td-card-link" href={c.link} target="_blank" rel="noopener noreferrer">{c.linkLabel} ↗</a>
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        <div className="td-divider"/>

        <CombinedTimeline/>

        <Reveal>
          <div className="td-quote">
            <div className="td-quote-mark">"</div>
            <p>The hour that vanishes each spring isn't returned in autumn. What comes back is a different hour, from a different timeline. You meet it as a stranger.</p>
            <cite>On the irreversibility of absent time</cite>
          </div>
        </Reveal>

        <Reveal>
          <footer className="td-footer">
            <span className="td-footer-brand">Time <em>Dissonance</em></span>
            <span className="td-footer-note">A meditation on slipping hours</span>
          </footer>
        </Reveal>

      </div>
    </div>
  );
}
