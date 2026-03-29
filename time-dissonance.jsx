import { useState, useEffect, useRef, useCallback } from "react";

// ── DST LOGIC ────────────────────────────────────────────────
function lastSundayOf(y, m) { const d = new Date(y, m+1, 0); const dow = d.getDay(); return new Date(y, m, d.getDate()-(dow===0?0:dow)); }
function firstSundayOf(y, m) { const d = new Date(y, m, 1); const dow = d.getDay(); return new Date(y, m, 1+(dow===0?0:7-dow)); }
function secondSundayOf(y, m) { const f = firstSundayOf(y, m); return new Date(y, m, f.getDate()+7); }

function getDSTSprings(regionKey, birthDate, toDate) {
  const region = DST_REGIONS[regionKey];
  if (!region || region.noDST) return [];
  const springs = [];
  for (let y = birthDate.getFullYear(); y <= toDate.getFullYear(); y++) {
    const s = region.getSpring(y);
    if (s && s > birthDate && s <= toDate) springs.push(s);
  }
  return springs;
}

const DST_REGIONS = {
  uk:   { label:"United Kingdom", noDST:false, getSpring:(y)=>{ if(y<1916)return null; if(y===1916)return new Date(1916,4,21); if(y>=1917&&y<=1939)return lastSundayOf(y,2); if(y>=1940&&y<=1945)return null; if(y>=1946&&y<=1967)return lastSundayOf(y,2); if(y>=1968&&y<=1971)return null; if(y>=1972)return lastSundayOf(y,2); return null; }},
  eu:   { label:"Continental Europe", noDST:false, getSpring:(y)=>{ if(y<1916)return null; if(y>=1916&&y<=1939)return lastSundayOf(y,2); if(y>=1940&&y<=1945)return null; if(y>=1946)return lastSundayOf(y,2); return null; }},
  us:   { label:"United States", noDST:false, getSpring:(y)=>{ if(y<1918)return null; if(y>=1918&&y<=1919)return lastSundayOf(y,2); if(y>=1920&&y<=1941)return null; if(y>=1942&&y<=1945)return new Date(y,1,9); if(y>=1946&&y<=2006)return lastSundayOf(y,3); if(y>=2007)return secondSundayOf(y,2); return null; }},
  au:   { label:"Australia (SE)", noDST:false, getSpring:(y)=>{ if(y<1917)return null; if(y>=2008)return firstSundayOf(y,9); if(y>=1971)return lastSundayOf(y,9); return null; }},
  nz:   { label:"New Zealand", noDST:false, getSpring:(y)=>{ if(y<1927)return null; if(y>=2007)return lastSundayOf(y,8); if(y>=1974)return lastSundayOf(y,9); return null; }},
  ca:   { label:"Canada", noDST:false, getSpring:(y)=>{ if(y<1918)return null; if(y>=2007)return secondSundayOf(y,2); if(y>=1967)return lastSundayOf(y,3); return null; }},
  none: { label:"No DST (Japan, India, most of Africa)", noDST:true, getSpring:()=>null },
};

const FLIGHT_OPTIONS = [
  { key:"never",    label:"Never / almost never",                  hoursPerYear:0   },
  { key:"rare",     label:"Rarely — one long-haul every few years", hoursPerYear:5   },
  { key:"annual",   label:"Once or twice a year",                   hoursPerYear:20  },
  { key:"frequent", label:"Several times a year",                   hoursPerYear:60  },
  { key:"heavy",    label:"Very frequently — work travel etc",      hoursPerYear:120 },
];

function calcRelativisticNS(flightKey, ageYears) {
  const opt = FLIGHT_OPTIONS.find(o=>o.key===flightKey)||FLIGHT_OPTIONS[0];
  const adultYears = Math.max(0, ageYears-18);
  const totalFlightHours = adultYears * opt.hoursPerYear;
  return { nsYounger: Math.round(totalFlightHours*0.73), totalFlightHours: Math.round(totalFlightHours) };
}

function calcDissonance(dob, region, flightKey) {
  const now = new Date(), birth = new Date(dob);
  if (isNaN(birth)||birth>=now) return null;
  const springs = getDSTSprings(region, birth, now);
  const hoursSlipped = springs.length;
  const msAlive = now - birth;
  const totalHours = msAlive/3600000;
  const totalDays = msAlive/86400000;
  const years = Math.floor(totalDays/365.25);
  const rem = totalDays - years*365.25;
  const months = Math.floor(rem/30.44);
  const days = Math.floor(rem - months*30.44);
  const hours = Math.floor((msAlive%86400000)/3600000);
  const minutes = Math.floor((msAlive%3600000)/60000);
  const seconds = Math.floor((msAlive%60000)/1000);
  const pctSlipped = hoursSlipped>0?((hoursSlipped/totalHours)*100).toFixed(6):"0.000000";
  const { nsYounger, totalFlightHours } = calcRelativisticNS(flightKey, years);
  const reg = DST_REGIONS[region];
  let nextSpring = null;
  if (reg&&!reg.noDST) { for(let y=now.getFullYear();y<=now.getFullYear()+1;y++){const s=reg.getSpring(y);if(s&&s>now){nextSpring=s;break;}}}
  const daysToNext = nextSpring ? Math.ceil((nextSpring-now)/86400000) : null;
  return { years, months, days, hours, minutes, seconds, hoursSlipped, minutesSlipped:hoursSlipped*60, totalHours:Math.floor(totalHours), pctSlipped, nsYounger, totalFlightHours, daysToNext, nextSpring, regionNoDST:reg&&reg.noDST };
}

const HISTORY_EVENTS = [
  { date:"1784-01-01", label:"Franklin's Satire", type:"history", desc:"Benjamin Franklin writes a tongue-in-cheek essay suggesting Parisians could save candles by waking at dawn. He meant it as a joke. It was later used, without irony, to justify daylight saving time." },
  { date:"1859-09-01", label:"Carrington Event", type:"solar", severity:"G5+", desc:"The most powerful geomagnetic storm on record. Telegraph systems worldwide caught fire. Operators received electric shocks. Auroras visible at the equator." },
  { date:"1884-01-01", label:"GMT Standardised", type:"history", desc:"The International Meridian Conference establishes Greenwich Mean Time as the global baseline. Before this, every town kept its own local solar time. Trains made this unworkable." },
  { date:"1905-01-01", label:"Special Relativity", type:"history", desc:"Einstein shows time is not a fixed background. It bends, stretches, and slows depending on speed and gravity. Every clock in the universe runs at its own pace." },
  { date:"1916-01-01", label:"DST First Adopted", type:"history", desc:"Germany and Britain introduce Daylight Saving Time to reduce wartime coal consumption. The argument has not meaningfully improved since." },
  { date:"1921-05-15", label:"New York Railroad Storm", type:"solar", severity:"G5+", desc:"One of the largest geomagnetic storms of the 20th century. Telegraph and telephone systems across North America and Europe severely disrupted." },
  { date:"1938-01-21", label:"Great Aurora Storm", type:"solar", severity:"G5", desc:"Visible as far south as Portugal. Disrupted radio and early aviation navigation. One of the largest storms of the pre-Space Age era." },
  { date:"1958-02-10", label:"Feb 1958 Superstorm", type:"solar", severity:"G5", desc:"One of the largest storms of the Space Age. Widespread power and communications disruptions across Canada and the northern US." },
  { date:"1971-01-01", label:"Hafele-Keating Experiment", type:"history", desc:"Atomic clocks flown around the world confirm relativistic time dilation. Moving clocks really do run slow. The universe doesn't care about your schedule." },
  { date:"1972-08-04", label:"Aug 1972 Storm", type:"solar", severity:"G5", desc:"Caused accidental detonation of US naval mines off Vietnam due to magnetic field disruption. Also knocked out AT&T long-lines communications across the US." },
  { date:"1989-03-13", label:"Quebec Blackout", type:"solar", severity:"G5", desc:"Knocked out power across Quebec for 9 hours. 6 million people without electricity. Auroras visible in Texas. Transformer damage took months to repair." },
  { date:"1998-01-01", label:"Leap Second Disputes Begin", type:"history", desc:"Atomic clocks now so precise they outpace Earth's irregular rotation. Leap seconds are added intermittently. The internet finds this extremely inconvenient." },
  { date:"2000-07-14", label:"Bastille Day Event", type:"solar", severity:"G5", desc:"X5.7 flare launched a CME directly at Earth. Disrupted satellites, caused radio blackouts, and produced auroras across Europe. Observed by both Voyager spacecraft." },
  { date:"2003-10-29", label:"Halloween Storms", type:"solar", severity:"G5", desc:"17 major flares over two weeks. Two G5 events. The X28 flare on Nov 4 may be the largest ever measured. Power grid fluctuations across Europe and North America." },
  { date:"2012-07-23", label:"Near Miss — Carrington-Class", type:"solar", severity:"G5+", desc:"A CME erupted but missed Earth by 9 days. Scientists estimate it would have caused $2 trillion in damage to global infrastructure if it had hit." },
  { date:"2015-03-17", label:"St Patrick's Day Storm", type:"solar", severity:"G4", desc:"The strongest storm of Solar Cycle 24. Disrupted GPS signals globally and produced auroras visible across the UK and northern US." },
  { date:"2017-09-06", label:"X9.3 Flare", type:"solar", severity:"G3", desc:"Largest solar flare of Solar Cycle 24. Significant radio blackouts across Europe, Africa, and the Atlantic. GPS and navigation affected." },
  { date:"2024-05-10", label:"Gannon Storm", type:"solar", severity:"G5", desc:"Strongest geomagnetic storm since 2003. Auroras across the UK and as far south as Florida. GPS errors disrupted automated farm equipment. Radio blackouts affected aviation." },
];

const SEV_COLOR = { "G5+":"#c0390a", "G5":"#c8520d", "G4":"#b07a10", "G3":"#7a6030", "G2":"#5a4a25" };

// ── STYLES ───────────────────────────────────────────────────
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=IBM+Plex+Mono:ital,wght@0,300;0,400;0,500;1,300&family=IBM+Plex+Serif:ital,wght@0,300;0,400;1,300;1,400&display=swap');
  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }

  :root {
    --cream:   #f2ead8;
    --parchment: #e8dcc0;
    --tan:     #d4c4a0;
    --rust:    #c84b0a;
    --orange:  #e06020;
    --amber:   #c87820;
    --brown:   #3a2410;
    --mahogany:#5a3418;
    --walnut:  #7a4828;
    --dim:     #a08060;
    --grid:    rgba(40,30,100,0.1);
  }

  html { scroll-behavior: smooth; }

  body {
    background: var(--cream);
    color: var(--brown);
    font-family: 'IBM Plex Serif', Georgia, serif;
    font-weight: 300;
    overflow-x: hidden;
  }

  /* canvas sits behind everything */
  .td-canvas {
    position: fixed; inset: 0;
    pointer-events: none; z-index: 0;
  }

  .td-root { position: relative; z-index: 1; }

  /* ── GRID OVERLAY ── faint ruled-paper feel */
  .td-root::before {
    content:'';
    position:fixed; inset:0; z-index:0; pointer-events:none;
    background-image:
      repeating-linear-gradient(0deg, transparent, transparent 39px, var(--grid) 39px, var(--grid) 40px),
      repeating-linear-gradient(90deg, transparent, transparent 79px, var(--grid) 79px, var(--grid) 80px);
  }

  /* ── BANNER ── */
  .td-banner {
    position: sticky; top:0; z-index:100;
    background: var(--brown);
    color: var(--cream);
    display: flex; justify-content:space-between; align-items:center;
    padding: 0.55rem 1.5rem;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.6rem; letter-spacing: 0.18em; text-transform: uppercase;
    border-bottom: 3px solid var(--rust);
  }
  .td-banner-left { display:flex; align-items:center; gap:1.5rem; }
  .td-banner-blip {
    width:0.5rem; height:0.5rem; border-radius:50%;
    background:var(--rust);
    animation: blip 1.8s ease-in-out infinite;
  }
  @keyframes blip { 0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(200,75,10,0.5)} 50%{opacity:0.4;box-shadow:0 0 0 4px rgba(200,75,10,0)} }
  .td-live { color:var(--amber); letter-spacing:0.1em; }

  /* ── HERO ── */
  .td-hero {
    min-height: 100svh;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    text-align: center;
    padding: 5rem 1.5rem 4rem;
    position: relative;
    border-bottom: 2px solid var(--tan);
  }

  .td-mission-badge {
    display: inline-flex; align-items:center; gap:0.6rem;
    border: 1px solid var(--walnut);
    padding: 0.35rem 0.9rem;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.55rem; letter-spacing: 0.25em; text-transform:uppercase;
    color: var(--walnut);
    margin-bottom: 3rem;
    animation: fadeUp 0.8s ease 0.2s both;
  }
  .td-mission-badge::before { content:'◈'; color:var(--rust); font-size:0.5rem; }

  .td-title {
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(5rem, 22vw, 13rem);
    line-height: 0.85;
    letter-spacing: 0.04em;
    color: var(--brown);
    animation: fadeUp 0.8s ease 0.4s both;
  }
  .td-title-em {
    display: block;
    color: var(--rust);
    letter-spacing: 0.06em;
  }

  .td-hero-rule {
    width: 60px; height: 2px;
    background: var(--rust);
    margin: 2.5rem auto;
    animation: fadeUp 0.8s ease 0.6s both;
  }

  .td-sub {
    font-size: clamp(1rem, 3vw, 1.2rem);
    color: var(--walnut);
    max-width: 480px;
    line-height: 1.8;
    font-style: italic;
    animation: fadeUp 0.8s ease 0.7s both;
  }

  .td-clock-wrap {
    margin-top: 3.5rem;
    animation: fadeUp 0.8s ease 0.9s both;
  }
  .td-clock-caption {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.48rem; letter-spacing: 0.22em;
    text-transform: uppercase; color: var(--dim);
    text-align: center; margin-top: 0.6rem;
  }

  .td-scroll-hint {
    position: absolute; bottom: 1.8rem; left:50%; transform:translateX(-50%);
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.5rem; letter-spacing: 0.22em; text-transform:uppercase;
    color: var(--dim);
    animation: fadeUp 0.8s ease 1.4s both, pulse 3s ease-in-out 2.2s infinite;
    white-space: nowrap;
  }

  @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
  @keyframes pulse { 0%,100%{opacity:0.35} 50%{opacity:0.9} }

  /* ── READOUT BAND ── */
  .td-readout {
    background: var(--brown);
    color: var(--cream);
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    border-bottom: 2px solid var(--rust);
  }
  @media(min-width:600px){ .td-readout { grid-template-columns: repeat(4,1fr); } }
  .td-readout-cell {
    padding: 2rem 1.5rem;
    border-right: 1px solid rgba(242,234,216,0.1);
    text-align: center;
  }
  .td-readout-cell:last-child { border-right:none; }
  .td-readout-val {
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(2.2rem,7vw,3.5rem);
    letter-spacing: 0.04em;
    color: var(--orange);
    line-height: 1;
  }
  .td-readout-lbl {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.48rem; letter-spacing: 0.18em; text-transform:uppercase;
    color: rgba(242,234,216,0.55);
    margin-top: 0.4rem; line-height:1.5;
  }

  /* ── SECTION ── */
  .td-section {
    padding: clamp(3rem,8vh,6rem) clamp(1.2rem,5vw,4rem);
    max-width: 960px; margin: 0 auto;
    border-bottom: 1px solid var(--tan);
  }

  .td-section-eyebrow {
    display: flex; align-items:center; gap:1rem;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.55rem; letter-spacing: 0.22em; text-transform:uppercase;
    color: var(--rust);
    margin-bottom: 1.2rem;
  }
  .td-section-eyebrow::after {
    content:''; flex:1; height:1px; background:var(--tan);
  }

  .td-section-title {
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(2.5rem,8vw,5rem);
    letter-spacing: 0.04em;
    color: var(--brown);
    line-height: 0.95;
    margin-bottom: 1.2rem;
  }
  .td-section-title em { color:var(--rust); font-style:normal; }

  .td-section-intro {
    font-size: clamp(1rem,3vw,1.12rem);
    color: var(--walnut);
    line-height: 1.85;
    max-width: 620px;
    margin-bottom: 2.5rem;
    font-style: italic;
  }

  /* ── CALCULATOR ── */
  .td-calc-wrap {
    background: var(--parchment);
    border-bottom: 2px solid var(--tan);
  }
  .td-calc-inner {
    max-width: 960px; margin:0 auto;
    padding: clamp(3rem,8vh,5rem) clamp(1.2rem,5vw,4rem);
  }

  .td-steps { display:flex; flex-direction:column; gap:2rem; margin-bottom:2rem; }

  .td-step-label {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.55rem; letter-spacing: 0.2em; text-transform:uppercase;
    color: var(--walnut); margin-bottom:0.6rem;
    display:flex; align-items:center; gap:0.6rem;
  }
  .td-step-label::before {
    content: attr(data-n);
    display:inline-flex; align-items:center; justify-content:center;
    width:1.4rem; height:1.4rem;
    border:1px solid var(--walnut); border-radius:50%;
    font-size:0.5rem; color:var(--rust); flex-shrink:0;
  }

  .td-input {
    background: var(--cream);
    border: 1px solid var(--tan);
    border-bottom: 2px solid var(--walnut);
    color: var(--brown);
    font-family: 'IBM Plex Serif', Georgia, serif;
    font-size: 1.1rem; font-weight:300;
    padding: 0.75rem 1rem;
    outline: none; width:100%;
    transition: border-color 0.2s;
    -webkit-appearance:none; appearance:none; color-scheme:light;
  }
  .td-input:focus { border-bottom-color:var(--rust); }
  .td-input::-webkit-calendar-picker-indicator { opacity:0.4; }

  .td-select {
    background: var(--cream);
    border: 1px solid var(--tan);
    border-bottom: 2px solid var(--walnut);
    color: var(--brown);
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.65rem; letter-spacing:0.04em;
    padding: 0.75rem 1rem;
    outline:none; width:100%;
    -webkit-appearance:none; appearance:none; cursor:pointer;
    transition: border-color 0.2s;
  }
  .td-select:focus { border-bottom-color:var(--rust); }

  .td-pills { display:flex; flex-wrap:wrap; gap:0.5rem; }
  .td-pill {
    background: transparent;
    border: 1px solid var(--tan);
    color: var(--walnut);
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.55rem; letter-spacing:0.08em;
    padding: 0.5rem 0.9rem; cursor:pointer;
    transition: all 0.15s; line-height:1.4; text-align:left;
  }
  .td-pill:hover { border-color:var(--walnut); color:var(--brown); }
  .td-pill.active { border-color:var(--rust); color:var(--rust); background:rgba(200,75,10,0.06); }

  .td-calc-btn {
    background: var(--brown);
    border: none; color: var(--cream);
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.62rem; letter-spacing:0.2em; text-transform:uppercase;
    padding: 0.9rem 2.2rem; cursor:pointer;
    transition: background 0.2s; margin-top:0.5rem;
  }
  .td-calc-btn:hover { background:var(--rust); }

  /* ── RESULTS ── */
  .td-result { animation: fadeUp 0.5s ease both; }

  .td-age-display {
    font-family: 'IBM Plex Mono', monospace;
    font-size: clamp(0.75rem,2vw,0.85rem);
    letter-spacing: 0.04em;
    color: var(--walnut);
    line-height: 2.4; margin-bottom:2rem;
  }
  .td-age-display strong { color:var(--brown); font-weight:500; }
  .td-age-display .hi { color:var(--rust); }

  .td-big-number-wrap {
    background: var(--brown);
    color: var(--cream);
    padding: 2.5rem 2rem;
    margin-bottom: 2px;
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 2rem; align-items:center;
  }
  @media(max-width:500px){ .td-big-number-wrap { grid-template-columns:1fr; } }
  .td-big-num {
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(5rem,20vw,9rem);
    color: var(--orange); line-height:1;
    letter-spacing: 0.02em;
  }
  .td-big-num-right {}
  .td-big-num-label {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.58rem; letter-spacing:0.2em; text-transform:uppercase;
    color: rgba(242,234,216,0.6);
    margin-bottom: 0.8rem;
  }
  .td-big-num-sub {
    font-size: clamp(1rem,3vw,1.15rem);
    color: rgba(242,234,216,0.85);
    line-height:1.75; font-style:italic;
  }

  .td-no-dst-wrap {
    background: var(--parchment);
    border: 1px solid var(--tan);
    border-left: 4px solid var(--amber);
    padding: 1.5rem; margin-bottom:2px;
  }
  .td-no-dst-wrap p { font-size:1.05rem; color:var(--walnut); line-height:1.8; font-style:italic; }
  .td-no-dst-wrap strong { color:var(--brown); font-style:normal; }

  .td-metrics {
    display:grid; grid-template-columns:1fr 1fr; gap:2px; margin-bottom:2px;
  }
  @media(min-width:600px){ .td-metrics { grid-template-columns:repeat(4,1fr); } }
  .td-metric {
    background: var(--cream); border:1px solid var(--tan);
    padding: 1.2rem; text-align:center;
  }
  .td-metric-val {
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(1.6rem,5vw,2.4rem);
    letter-spacing:0.03em; line-height:1;
    color: var(--brown);
  }
  .td-metric-val.hi { color:var(--rust); }
  .td-metric-val.mid { color:var(--amber); }
  .td-metric-val.lo { color:var(--walnut); }
  .td-metric-lbl {
    font-family: 'IBM Plex Mono', monospace;
    font-size:0.48rem; letter-spacing:0.15em; text-transform:uppercase;
    color:var(--dim); margin-top:0.4rem; line-height:1.5;
  }

  .td-insight-box {
    background: var(--cream); border:1px solid var(--tan);
    border-top: 3px solid var(--amber);
    padding: 1.8rem; margin-bottom:2px;
  }
  .td-insight-box p {
    font-size:clamp(1rem,3vw,1.08rem);
    color:var(--walnut); line-height:1.9;
  }
  .td-insight-box p+p { margin-top:0.9rem; }
  .td-insight-box strong { color:var(--brown); font-weight:400; }
  .td-insight-box .hi { color:var(--rust); }
  .td-insight-box .mid { color:var(--amber); }

  .td-next-box {
    background: var(--brown); color:var(--cream);
    padding: 1.2rem 1.5rem;
    display:flex; justify-content:space-between; align-items:center;
    gap:1rem; flex-wrap:wrap;
  }
  .td-next-label {
    font-family:'IBM Plex Mono',monospace;
    font-size:0.5rem; letter-spacing:0.18em; text-transform:uppercase;
    color:rgba(242,234,216,0.55);
  }
  .td-next-val { font-size:1.2rem; color:var(--cream); margin-top:0.2rem; }
  .td-next-days {
    font-family:'IBM Plex Mono',monospace;
    font-size: 0.55rem; letter-spacing:0.1em;
    color:var(--orange); text-align:right;
  }

  .td-reset-btn {
    background:none; border:none; color:var(--dim);
    font-family:'IBM Plex Mono',monospace;
    font-size:0.52rem; letter-spacing:0.15em; text-transform:uppercase;
    cursor:pointer; margin-top:1.5rem; padding:0;
    transition:color 0.2s;
  }
  .td-reset-btn:hover { color:var(--brown); }

  /* ── DST VISUAL ── */
  .td-dst-visual {
    display:grid; grid-template-columns:1fr auto 1fr;
    align-items:center; gap:1.5rem;
    background: var(--brown); color:var(--cream);
    padding: 2rem 1.5rem; margin-bottom:2.5rem;
  }
  .td-dst-time { text-align:center; }
  .td-dst-time-big {
    font-family:'Bebas Neue',sans-serif;
    font-size:clamp(2.5rem,9vw,5rem);
    letter-spacing:0.04em; line-height:1;
    color:var(--cream);
  }
  .td-dst-time-big.gone { color:var(--orange); }
  .td-dst-time-lbl {
    font-family:'IBM Plex Mono',monospace;
    font-size:0.48rem; letter-spacing:0.18em; text-transform:uppercase;
    color:rgba(242,234,216,0.5); margin-top:0.3rem;
  }
  .td-dst-arrow {
    display:flex; flex-direction:column; align-items:center; gap:0.3rem;
    color:var(--orange); font-size:1.5rem;
    font-family:'IBM Plex Mono',monospace;
  }
  .td-dst-arrow-lbl {
    font-size:0.45rem; letter-spacing:0.12em; text-transform:uppercase;
    color:rgba(242,234,216,0.4);
  }

  /* ── CARDS ── */
  .td-cards {
    display:grid; grid-template-columns:1fr; gap:2px;
  }
  @media(min-width:600px){ .td-cards { grid-template-columns:1fr 1fr; } }
  .td-card {
    background:var(--cream); border:1px solid var(--tan);
    border-top:3px solid var(--tan);
    padding:1.8rem;
    transition: border-top-color 0.2s;
  }
  .td-card:hover { border-top-color:var(--rust); }
  .td-card-tag {
    font-family:'IBM Plex Mono',monospace;
    font-size:0.5rem; letter-spacing:0.2em; text-transform:uppercase;
    color:var(--rust); margin-bottom:0.6rem; display:block;
  }
  .td-card-title {
    font-family:'Bebas Neue',sans-serif;
    font-size:clamp(1.4rem,4vw,1.9rem);
    letter-spacing:0.03em; color:var(--brown);
    margin-bottom:0.7rem; line-height:1.1;
  }
  .td-card-body {
    font-size:clamp(0.95rem,2.8vw,1rem);
    line-height:1.8; color:var(--walnut);
  }
  .td-card-link {
    display:inline-flex; align-items:center; gap:0.3rem;
    margin-top:1rem;
    font-family:'IBM Plex Mono',monospace;
    font-size:0.52rem; letter-spacing:0.12em; text-transform:uppercase;
    color:var(--rust); text-decoration:none;
    border-bottom:1px solid transparent;
    transition:border-color 0.2s;
  }
  .td-card-link:hover { border-bottom-color:var(--rust); }

  /* ── REL GRID ── */
  .td-rel-grid { display:grid; grid-template-columns:1fr; gap:2px; }
  @media(min-width:600px){ .td-rel-grid { grid-template-columns:1fr 1fr; } }
  .td-rel-card {
    background:var(--cream); border:1px solid var(--tan);
    padding:1.8rem; position:relative;
  }
  .td-rel-card.hl { border-top:3px solid var(--rust); }
  .td-rel-num {
    font-family:'Bebas Neue',sans-serif;
    font-size:5rem; color:var(--tan); line-height:1;
    position:absolute; top:0.5rem; right:1rem; pointer-events:none;
  }

  /* ── QUOTE ── */
  .td-quote {
    padding: clamp(4rem,8vh,6rem) clamp(1.5rem,6vw,5rem);
    max-width:800px; margin:0 auto; text-align:center;
    position:relative;
  }
  .td-quote-mark {
    font-family:'Bebas Neue',sans-serif;
    font-size:10rem; line-height:0.6;
    color:var(--tan); position:absolute;
    top:2.5rem; left:0; pointer-events:none;
    letter-spacing:-0.02em;
  }
  .td-quote p {
    font-size:clamp(1.3rem,4.5vw,2.2rem);
    line-height:1.55; color:var(--brown);
    font-style:italic; position:relative; z-index:1;
  }
  .td-quote cite {
    display:block; margin-top:1.5rem;
    font-family:'IBM Plex Mono',monospace;
    font-size:0.52rem; letter-spacing:0.2em;
    color:var(--dim); font-style:normal; text-transform:uppercase;
  }

  /* ── TIMELINE ── */
  .td-timeline-wrap { position:relative; }
  .td-tl-legend {
    display:flex; gap:1.5rem; flex-wrap:wrap;
    margin-bottom:2rem;
  }
  .td-tl-legend-item {
    display:flex; align-items:center; gap:0.5rem;
    font-family:'IBM Plex Mono',monospace;
    font-size:0.5rem; letter-spacing:0.1em; color:var(--walnut);
  }
  .td-tl-legend-dot {
    width:0.6rem; height:0.6rem; border-radius:50%; border:1px solid;
  }

  .td-tl-filter {
    display:flex; gap:0.5rem; margin-bottom:2rem; flex-wrap:wrap;
  }
  .td-tl-filter-btn {
    background:transparent; border:1px solid var(--tan);
    color:var(--walnut);
    font-family:'IBM Plex Mono',monospace;
    font-size:0.52rem; letter-spacing:0.1em;
    padding:0.4rem 0.8rem; cursor:pointer; transition:all 0.15s;
  }
  .td-tl-filter-btn:hover { border-color:var(--walnut); color:var(--brown); }
  .td-tl-filter-btn.active { border-color:var(--rust); color:var(--rust); background:rgba(200,75,10,0.05); }

  .td-timeline { position:relative; padding-left:1.4rem; }
  .td-timeline::before {
    content:''; position:absolute;
    left:0; top:0; bottom:0; width:1px;
    background:linear-gradient(to bottom, transparent, var(--tan) 8%, var(--walnut) 50%, var(--tan) 92%, transparent);
  }
  .td-titem { position:relative; padding:0 0 2rem 1.5rem; }
  .td-tdot {
    position:absolute; left:-0.32rem; top:0.4rem;
    width:0.62rem; height:0.62rem; border-radius:50%;
    background:var(--cream); border:1px solid var(--tan);
  }
  .td-tdot.solar { border-color:var(--rust); background:var(--parchment); }
  .td-tdot.solar.g5plus { border-color:#c0390a; box-shadow:0 0 5px rgba(192,57,10,0.4); }
  .td-tdot.solar.g5 { border-color:var(--rust); box-shadow:0 0 4px rgba(200,75,10,0.3); }
  .td-tdot.solar.g4 { border-color:var(--amber); }
  .td-tdot.solar.g3 { border-color:var(--dim); }
  .td-tdot.history { border-color:var(--walnut); }

  .td-tdate {
    font-family:'IBM Plex Mono',monospace;
    font-size:0.52rem; letter-spacing:0.15em;
    color:var(--dim); margin-bottom:0.2rem;
  }
  .td-tdate.solar { color:var(--rust); }
  .td-trow { display:flex; align-items:center; gap:0.6rem; margin-bottom:0.3rem; }
  .td-ttitle {
    font-family:'Bebas Neue',sans-serif;
    font-size:clamp(1.1rem,3.5vw,1.4rem);
    letter-spacing:0.03em; color:var(--brown); line-height:1.1;
  }
  .td-tsev {
    font-family:'IBM Plex Mono',monospace;
    font-size:0.42rem; letter-spacing:0.1em;
    padding:0.15rem 0.4rem; font-weight:500;
    border:1px solid;
  }
  .td-tbody {
    font-size:clamp(0.9rem,2.5vw,0.98rem);
    color:var(--walnut); line-height:1.8;
  }

  /* ── FOOTER ── */
  .td-footer {
    background:var(--brown); color:var(--cream);
    padding:2.5rem 1.5rem;
    display:flex; justify-content:space-between;
    align-items:center; flex-wrap:wrap; gap:1rem;
    border-top:3px solid var(--rust);
  }
  .td-footer-brand {
    font-family:'Bebas Neue',sans-serif;
    font-size:1.8rem; letter-spacing:0.06em;
    color:var(--cream);
  }
  .td-footer-brand span { color:var(--orange); }
  .td-footer-note {
    font-family:'IBM Plex Mono',monospace;
    font-size:0.5rem; letter-spacing:0.15em; text-transform:uppercase;
    color:rgba(242,234,216,0.4);
  }

  .td-divider {
    height:1px;
    background:var(--tan);
    margin:0;
  }

  .td-reveal { opacity:0; transform:translateY(20px); transition:opacity 0.6s ease, transform 0.6s ease; }
  .td-reveal.visible { opacity:1; transform:translateY(0); }
`;

// ── STARFIELD ─────────────────────────────────────────────────
// Warm-tinted warp stars on a dark brown background — shows
// through the cream page only in the hero section via mix-blend
function Starfield() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current, ctx = canvas.getContext("2d");
    let W, H, CX, CY, raf;
    const mkStar = () => {
      const sz = Math.random(); const baseR = sz<0.72?0.15+Math.random()*0.25:sz<0.95?0.4+Math.random()*0.55:0.9+Math.random()*1.0;
      return { angle:Math.random()*Math.PI*2, dist:2+Math.random()*8, speed:0.03+Math.pow(Math.random(),1.7)*0.45, baseR, glowR:baseR<0.3?0:baseR*(1.8+Math.random()*2.5), warm:Math.random()<0.15 };
    };
    let stars = Array.from({length:650}, mkStar);
    const resize = () => { W=canvas.width=window.innerWidth; H=canvas.height=window.innerHeight; CX=W/2; CY=H/2; };
    const drawGlow = (x,y,r,col) => { const g=ctx.createRadialGradient(x,y,0,x,y,r); g.addColorStop(0,col); g.addColorStop(0.4,col); g.addColorStop(1,col.replace(/[\d.]+\)$/,"0)")); ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fillStyle=g; ctx.fill(); };
    resize();
    const maxD0 = Math.sqrt(CX*CX+CY*CY);
    stars.forEach(s=>{s.dist=4+Math.random()*maxD0*1.05;});
    ctx.fillStyle="#080618"; ctx.fillRect(0,0,W,H);
    const draw = () => {
      ctx.fillStyle="rgba(8,6,24,0.22)"; ctx.fillRect(0,0,W,H);
      const maxDist=Math.sqrt(CX*CX+CY*CY);
      stars.forEach((s,i)=>{ s.dist+=s.speed*(1+s.dist*0.005);
        const x=CX+Math.cos(s.angle)*s.dist, y=CY+Math.sin(s.angle)*s.dist;
        const t=Math.min(s.dist/maxDist,1);
        const maxOpac=s.baseR>0.8?0.65:s.baseR>0.35?0.4:0.25;
        const opacity=Math.min(t*2.8,1)*maxOpac;
        const r=s.baseR*(0.4+t*0.65);
        const base=s.warm?"230,160,80":"180,195,240";
        const sLen=s.dist*(s.baseR<0.3?0.06:s.baseR<0.7?0.1:0.16);
        const px=CX+Math.cos(s.angle)*(s.dist-sLen), py=CY+Math.sin(s.angle)*(s.dist-sLen);
        const sg=ctx.createLinearGradient(px,py,x,y); sg.addColorStop(0,`rgba(${base},0)`); sg.addColorStop(1,`rgba(${base},${(opacity*0.7).toFixed(3)})`);
        ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(x,y); ctx.strokeStyle=sg; ctx.lineWidth=Math.max(0.2,r*0.6); ctx.stroke();
        if(s.glowR>0&&opacity>0.05) drawGlow(x,y,r+s.glowR*t,`rgba(${base},${(opacity*0.3).toFixed(3)})`);
        ctx.beginPath(); ctx.arc(x,y,Math.max(0.15,r),0,Math.PI*2); ctx.fillStyle=`rgba(${base},${opacity.toFixed(3)})`; ctx.fill();
        if(x<-40||x>W+40||y<-40||y>H+40){stars[i]=mkStar();}
      });
      raf=requestAnimationFrame(draw);
    };
    draw(); window.addEventListener("resize",resize);
    return ()=>{cancelAnimationFrame(raf);window.removeEventListener("resize",resize);};
  },[]);
  // Canvas is positioned fixed behind everything, tinted dark brown
  // Hero section uses a semi-transparent overlay so stars show through
  return <canvas ref={ref} className="td-canvas" style={{background:"#080618"}}/>;
}

// ── CONSTELLATION CLOCK ───────────────────────────────────────
function Clock({size=200}) {
  const [hands,setHands]=useState({h:0,m:0,s:0});
  useEffect(()=>{const tick=()=>{const n=new Date(),s=n.getSeconds(),m=n.getMinutes()+s/60,hr=(n.getHours()%12)+m/60;setHands({h:hr*30,m:m*6,s:s*6});};tick();const id=setInterval(tick,1000);return()=>clearInterval(id);},[]);
  const cx=size/2,cy=size/2,r=size/2-8;
  const polar=(deg,rr)=>{const rad=(deg-90)*Math.PI/180;return{x:cx+Math.cos(rad)*rr,y:cy+Math.sin(rad)*rr};};
  const seed=n=>{let x=Math.sin(n*127.1)*43758.5453;return x-Math.floor(x);};
  const clusters=Array.from({length:12},(_,i)=>{
    const deg=i*30,centre=polar(deg,r*0.78);
    const count=3+Math.floor(seed(i*3)*3);
    const stars=Array.from({length:count},(_,j)=>{const spread=8;return{x:centre.x+(seed(i*13+j*7)-0.5)*spread*2,y:centre.y+(seed(i*17+j*5)-0.5)*spread*2,rr:0.7+seed(i*9+j)*1.3,br:0.35+seed(i*11+j*3)*0.65};});
    return{deg,centre,stars:[{x:centre.x,y:centre.y,rr:2,br:1},...stars]};
  });
  const constLines=[[0,4],[4,8],[8,0],[1,5],[5,9],[2,6],[3,7],[11,3]];
  const hEnd=polar(hands.h,r*0.5),mEnd=polar(hands.m,r*0.75),sPos=polar(hands.s,r*0.88);
  // Use amber/brown palette for cream background
  return(
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{overflow:"visible"}}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(80,60,140,0.25)" strokeWidth="0.5" strokeDasharray="2 6"/>
      {constLines.map(([a,b],i)=>{const ca=clusters[a].centre,cb=clusters[b].centre;return<line key={i} x1={ca.x} y1={ca.y} x2={cb.x} y2={cb.y} stroke="rgba(80,60,140,0.15)" strokeWidth="0.6"/>;} )}
      <line x1={cx} y1={cy} x2={hEnd.x} y2={hEnd.y} stroke="rgba(40,30,80,0.55)" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="3 5"/>
      <line x1={cx} y1={cy} x2={mEnd.x} y2={mEnd.y} stroke="rgba(200,75,10,0.6)" strokeWidth="0.9" strokeLinecap="round" strokeDasharray="1 4"/>
      {clusters.map((cl,ci)=>cl.stars.map((st,si)=><circle key={`${ci}-${si}`} cx={st.x} cy={st.y} r={st.rr} fill={`rgba(50,35,100,${st.br*0.75})`}/>))}
      <circle cx={sPos.x} cy={sPos.y} r={2.2} fill="rgba(200,75,10,0.95)"/>
      <circle cx={sPos.x} cy={sPos.y} r={4} fill="none" stroke="rgba(200,75,10,0.3)" strokeWidth="0.8"/>
      <circle cx={cx} cy={cy} r={2} fill="rgba(40,30,80,0.9)"/>
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
      SUBJECT AGE — <strong>{d.years}Y {d.months}M {d.days}D</strong>{" "}
      <span className="hi">{pad(d.hours)}:{pad(d.minutes)}:{pad(d.seconds)}</span>
      <br/>
      TOTAL HOURS LOGGED — <strong>{d.totalHours.toLocaleString()}</strong> and counting
    </div>
  );
}

function DissonanceCalc() {
  const [step,setStep]=useState(1);
  const [dob,setDob]=useState("");
  const [region,setRegion]=useState("uk");
  const [flight,setFlight]=useState("annual");
  const [result,setResult]=useState(null);

  const calculate=useCallback(()=>{const r=calcDissonance(dob,region,flight);if(r){setResult(r);setStep(2);}},[dob,region,flight]);
  const reset=()=>{setStep(1);setResult(null);};
  const fmtDate=d=>d.toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"});
  const flightOpt=FLIGHT_OPTIONS.find(o=>o.key===flight);

  return(
    <div className="td-calc-wrap">
      <div className="td-calc-inner">
        <div className="td-section-eyebrow">01 / Personal Log</div>
        <h2 className="td-section-title">HOW MUCH TIME<br/><em>HAS SLIPPED PAST?</em></h2>
        <p className="td-section-intro">
          Enter your details for a precise, personal calculation — accounting for where you grew up, how often you fly, and the relativistic cost of motion through space.
        </p>

        {step===1&&(
          <div className="td-steps">
            <div>
              <div className="td-step-label" data-n="1">Date of birth</div>
              <input type="date" className="td-input" value={dob}
                max={new Date().toISOString().split("T")[0]} min="1900-01-01"
                onChange={e=>setDob(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&calculate()}
              />
            </div>
            <div>
              <div className="td-step-label" data-n="2">Where did you grow up?</div>
              <select className="td-select" value={region} onChange={e=>setRegion(e.target.value)}>
                {Object.entries(DST_REGIONS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <div className="td-step-label" data-n="3">How often do you take long-haul flights?</div>
              <div className="td-pills">
                {FLIGHT_OPTIONS.map(o=><button key={o.key} className={`td-pill${flight===o.key?" active":""}`} onClick={()=>setFlight(o.key)}>{o.label}</button>)}
              </div>
            </div>
            <button className="td-calc-btn" onClick={calculate}>Run calculation ↗</button>
          </div>
        )}

        {step===2&&result&&(
          <div className="td-result">
            <LiveAge dob={dob} region={region} flightKey={flight}/>

            {result.regionNoDST?(
              <div className="td-no-dst-wrap">
                <p><strong>No DST in your region.</strong> While others lost an hour each spring and spent days feeling the wrongness of it, your clocks stayed still. Time was never entirely yours to keep though — the relativistic and solar sections below still apply.</p>
              </div>
            ):(
              <div className="td-big-number-wrap">
                <div className="td-big-num">{result.hoursSlipped}</div>
                <div className="td-big-num-right">
                  <div className="td-big-num-label">Hours that didn't exist during your lifetime</div>
                  <div className="td-big-num-sub">That is {result.minutesSlipped.toLocaleString()} minutes. Each spring since you were born, a clock-hour was skipped entirely. You didn't sleep through it. There was nothing there to sleep through.</div>
                </div>
              </div>
            )}

            <div className="td-metrics">
              {!result.regionNoDST&&<div className="td-metric"><div className="td-metric-val hi">{result.hoursSlipped}</div><div className="td-metric-lbl">Hours absent</div></div>}
              {!result.regionNoDST&&<div className="td-metric"><div className="td-metric-val">{result.pctSlipped}%</div><div className="td-metric-lbl">Of life uncounted</div></div>}
              <div className="td-metric"><div className="td-metric-val mid">{result.nsYounger.toLocaleString()}ns</div><div className="td-metric-lbl">Younger than grounded self</div></div>
              <div className="td-metric"><div className="td-metric-val lo">{result.totalFlightHours.toLocaleString()}h</div><div className="td-metric-lbl">Est. hours in air</div></div>
              {result.regionNoDST&&<div className="td-metric"><div className="td-metric-val lo">{result.totalHours.toLocaleString()}</div><div className="td-metric-lbl">Total hours lived</div></div>}
              {result.regionNoDST&&<div className="td-metric"><div className="td-metric-val hi">0</div><div className="td-metric-lbl">Hours absent (DST)</div></div>}
            </div>

            <div className="td-insight-box">
              {!result.regionNoDST&&<p>Of your <strong>{result.totalHours.toLocaleString()} hours</strong> of existence, <span className="hi">{result.hoursSlipped} of them ({result.pctSlipped}%)</span> were clock-hours that simply weren't there. Each spring at 1:59am, the minute hand leapt to 3:00. The gap between wasn't lost time — it was absent time. A parenthesis in your life with nothing inside it.</p>}
              {!result.regionNoDST&&<p>When the clocks fall back each autumn, an hour reappears — but it isn't the one that vanished. The version of a Saturday morning in late March that could have existed is simply gone. What returns is a different hour, from a different timeline.</p>}
              {result.nsYounger>0&&<p>Based on <strong>{flightOpt.label.toLowerCase()}</strong>, roughly <strong>{result.totalFlightHours.toLocaleString()} hours</strong> of your life have been spent at altitude. Velocity time dilation outpaces the gravitational effect — meaning you are approximately <span className="mid">{result.nsYounger.toLocaleString()} nanoseconds younger</span> than the version of you who never boarded a plane.</p>}
              {result.nsYounger===0&&<p>You've barely flown, so your relativistic twin — the version of you who never left the ground — is aging at almost exactly your pace. You are, for now, the same person.</p>}
            </div>

            {result.daysToNext&&(
              <div className="td-next-box">
                <div>
                  <div className="td-next-label">Next hour that won't exist</div>
                  <div className="td-next-val">{fmtDate(result.nextSpring)}</div>
                </div>
                <div className="td-next-days">{result.daysToNext} days away</div>
              </div>
            )}

            <button className="td-reset-btn" onClick={reset}>← New calculation</button>
          </div>
        )}
      </div>
    </div>
  );
}

function CombinedTimeline() {
  const [filter,setFilter]=useState("all");
  const filtered=HISTORY_EVENTS.filter(e=>filter==="all"||e.type===filter);
  const sevClass=s=>s?s.toLowerCase().replace("+","plus"):"";
  const sevCol=s=>SEV_COLOR[s]||"#7a6030";
  return(
    <section className="td-section">
      <Reveal>
        <div className="td-section-eyebrow">05 / Record</div>
        <h2 className="td-section-title">HISTORY OF<br/><em>DISRUPTED TIME</em></h2>
        <p className="td-section-intro">Every event below changed how time was experienced — sometimes by policy, sometimes by physics, sometimes by the sun. Solar storms rated on the NOAA G-scale: G1 minor to G5 extreme.</p>
        <div className="td-tl-legend">
          <div className="td-tl-legend-item"><div className="td-tl-legend-dot" style={{borderColor:"#7a4828",background:"#f2ead8"}}/> Historical event</div>
          <div className="td-tl-legend-item"><div className="td-tl-legend-dot" style={{borderColor:"#c87820",background:"#e8dcc0"}}/> G3/G4 solar storm</div>
          <div className="td-tl-legend-item"><div className="td-tl-legend-dot" style={{borderColor:"#c84b0a",background:"#e8dcc0",boxShadow:"0 0 4px rgba(200,75,10,0.4)"}}/> G5 extreme</div>
          <div className="td-tl-legend-item"><div className="td-tl-legend-dot" style={{borderColor:"#c0390a",background:"#e8dcc0",boxShadow:"0 0 5px rgba(192,57,10,0.5)"}}/> Carrington-class</div>
        </div>
        <div className="td-tl-filter">
          {["all","solar","history"].map(f=>(
            <button key={f} className={`td-tl-filter-btn${filter===f?" active":""}`} onClick={()=>setFilter(f)}>
              {f==="all"?"All events":f==="solar"?"Solar storms":"Historical"}
            </button>
          ))}
        </div>
      </Reveal>
      <Reveal>
        <div className="td-timeline">
          {filtered.map((item,i)=>(
            <div className="td-titem" key={i}>
              <div className={`td-tdot ${item.type}${item.severity?" "+sevClass(item.severity):""}`}/>
              <div className={`td-tdate${item.type==="solar"?" solar":""}`}>{item.date.slice(0,7).replace("-","/")}</div>
              <div className="td-trow">
                <div className="td-ttitle">{item.label}</div>
                {item.severity&&<span className="td-tsev" style={{color:sevCol(item.severity),borderColor:sevCol(item.severity)+"66",background:sevCol(item.severity)+"11"}}>{item.severity}</span>}
              </div>
              <div className="td-tbody">{item.desc}</div>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

const dstCards=[
  {tag:"Origin",title:"A Joke That Became Policy",body:"Benjamin Franklin wrote satirically about waking Parisians at dawn to save candles. He didn't mean it seriously. A century later, Germany adopted the idea as wartime rationing. The whimsy became infrastructure.",link:"https://www.britannica.com/story/who-invented-daylight-saving-time",linkLabel:"Britannica"},
  {tag:"What it does to you",title:"Your Body Keeps the Old Time",body:"In the days after the spring change, rates of heart attacks, car accidents, and workplace injuries all rise measurably. Your body's internal clock doesn't reset on command. It holds on to the hour that vanished.",link:"https://www.sleepfoundation.org/sleep-hygiene/daylight-saving-time-and-sleep",linkLabel:"Sleep Foundation"},
  {tag:"The original reason",title:"It No Longer Does What It Promised",body:"Daylight saving was meant to reduce energy use by shifting daylight into evenings. The evidence it ever worked is thin. Some US states found electricity consumption went up — people just ran air conditioning in the brighter evenings.",link:"https://www.nber.org/papers/w14429",linkLabel:"NBER Research"},
  {tag:"The autumn return",title:"The Hour You Get Back Isn't Yours",body:"In autumn, the clocks fall back and an hour reappears. But it isn't the same hour. The version of you who would have lived that hour without daylight saving — you can't recover them. You receive someone else's hour in their place.",link:"https://www.bbc.co.uk/news/uk-politics-49678133",linkLabel:"BBC"},
];

const relCards=[
  {num:"01",tag:"Moving Clocks Run Slow",title:"Every Flight Makes You Fractionally Younger",body:"When you move quickly, time passes more slowly for you than for someone standing still. A passenger on a long-haul flight arrives slightly younger than a version of themselves who stayed home. Nanoseconds — but real, measured, undeniable.",link:"https://www.bbc.co.uk/sciencefocus/article/does-time-pass-more-slowly-on-a-plane",linkLabel:"BBC Science",hl:true},
  {num:"02",tag:"Gravity Bends Time",title:"Altitude Makes Clocks Run Fast",body:"The further you are from a large mass, the faster time flows. GPS satellites orbit at 20,000km and their clocks run 38 microseconds fast per day without correction. Without this fix, your maps would be wrong by 10km.",link:"https://science.nasa.gov/learn/explainers/einsteins-theory-of-relativity/",linkLabel:"NASA"},
  {num:"03",tag:"Hafele-Keating, 1971",title:"It Was Tested on Commercial Flights",body:"Physicists flew atomic clocks around the world in both directions on passenger aircraft, then compared them to ground clocks. Einstein's predictions were confirmed precisely. Time dilation measured aboard a commercial jet.",link:"https://www.science.org/doi/10.1126/science.177.4044.166",linkLabel:"Science"},
  {num:"04",tag:"Already Built In",title:"Your Phone Quietly Does All of This",body:"GPS relativity corrections are not optional. Without them the system would be useless within hours. Every time you navigate somewhere, a computer is compensating for the fact that time runs differently in orbit than in your pocket.",link:"https://physicscentral.com/explore/writers/will.cfm",linkLabel:"Physics Central"},
];

const solarCards=[
  {tag:"The Signal Disappears",title:"GPS Timing Fails Silently",body:"Solar storms compress and distort the ionosphere that GPS signals travel through. Timing errors creep in — tens of metres at first, then more. The system doesn't announce this. Your phone keeps showing a blue dot, just not quite in the right place.",link:"https://www.swpc.noaa.gov/impacts/gps-position-errors",linkLabel:"NOAA"},
  {tag:"A Clock You Didn't Know You Had",title:"Your Oven Runs on the Power Grid",body:"Many appliances keep time by counting AC power oscillations — 50 cycles per second in the UK. When solar activity disrupts the grid, the frequency drifts. Ovens, microwaves, older alarm clocks quietly accumulate minutes of error.",link:"https://www.newscientist.com/article/2239540-slow-clocks-why-your-oven-and-other-appliances-may-be-running-behind/",linkLabel:"New Scientist"},
  {tag:"The One That Almost Wasn't",title:"2012: A Near-Miss Nobody Felt",body:"A Carrington-class CME erupted in July 2012 and missed Earth by nine days. Scientists modelled what would have happened: months-long GPS failure, continent-wide power outages, satellite damage costing trillions.",link:"https://science.nasa.gov/science-research/heliophysics/the-perfect-solar-superstorm-the-1859-carrington-event/",linkLabel:"NASA"},
  {tag:"May 2024",title:"The One You Might Have Seen",body:"A G5 storm — the strongest in over two decades — lit up the sky across the UK and as far south as Florida. Automated farm tractors were silently drifting off GPS-guided paths. Aviation radio briefly failed.",link:"https://www.bbc.co.uk/news/science-environment-69012972",linkLabel:"BBC News"},
];

export default function App() {
  return(
    <>
      <style>{styles}</style>
      {/* Dark space background fixed behind everything */}
      <Starfield/>
      {/* Hero has a semi-transparent cream overlay so stars show through */}
      <div className="td-root">
        {/* ── BANNER ── */}
        <div className="td-banner">
          <div className="td-banner-left">
            <div className="td-banner-blip"/>
            <span>TIME DISSONANCE — on the strangeness of hours</span>
          </div>
          <LiveTime/>
        </div>

        {/* ── HERO — transparent bg lets starfield show ── */}
        <section className="td-hero" style={{background:"rgba(232,220,195,0.82)"}}>
          <div className="td-mission-badge">Mission briefing — temporal log</div>
          <h1 className="td-title">TIME<br/><span className="td-title-em">DISSONANCE</span></h1>
          <div className="td-hero-rule"/>
          <p className="td-sub">Time doesn't flow evenly. It slips, stretches, and vanishes entirely. Some hours you'll never find again — not because you wasted them, but because they simply weren't there.</p>
          <div className="td-clock-wrap">
            <Clock size={180}/>
            <div className="td-clock-caption">hour · minute · second</div>
          </div>
          <p className="td-scroll-hint">Scroll to understand what's happened to your time ↓</p>
        </section>

        {/* ── READOUT BAND ── */}
        <Reveal>
          <div className="td-readout">
            <div className="td-readout-cell"><div className="td-readout-val">1H</div><div className="td-readout-lbl">Lost each spring, unreturned</div></div>
            <div className="td-readout-cell"><div className="td-readout-val">38µS</div><div className="td-readout-lbl">GPS drift daily without Einstein</div></div>
            <div className="td-readout-cell"><div className="td-readout-val">0.73ns</div><div className="td-readout-lbl">Younger per hour in the air</div></div>
            <div className="td-readout-cell"><div className="td-readout-val">$2TN</div><div className="td-readout-lbl">2012 near-miss cost estimate</div></div>
          </div>
        </Reveal>

        {/* ── CALCULATOR ── */}
        <DissonanceCalc/>

        {/* ── DST SECTION ── */}
        <section className="td-section">
          <Reveal>
            <div className="td-section-eyebrow">02 / Temporal Anomaly</div>
            <h2 className="td-section-title">THE HOUR THAT<br/><em>WASN'T THERE</em></h2>
            <p className="td-section-intro">Every spring, the clocks skip forward. One moment it is 1:59am, and then — without you doing anything, without any ceremony — it is 3am. The hour in between simply didn't happen. You didn't sleep through it. It wasn't there to sleep through.</p>
            <div className="td-dst-visual">
              <div className="td-dst-time"><div className="td-dst-time-big">01:59</div><div className="td-dst-time-lbl">Saturday night</div></div>
              <div className="td-dst-arrow"><div className="td-dst-arrow-lbl">becomes</div>→</div>
              <div className="td-dst-time"><div className="td-dst-time-big gone">03:00</div><div className="td-dst-time-lbl">02:00 never existed</div></div>
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

        {/* ── QUOTE 1 ── */}
        <Reveal>
          <div className="td-quote">
            <div className="td-quote-mark">"</div>
            <p>Time is an illusion. Daylight saving time is a reminder that even our illusions have fine print.</p>
            <cite>After Douglas Adams</cite>
          </div>
        </Reveal>

        <div className="td-divider"/>

        {/* ── RELATIVITY ── */}
        <section className="td-section">
          <Reveal>
            <div className="td-section-eyebrow">03 / Relativistic Effects</div>
            <h2 className="td-section-title">YOU ARE AGING<br/><em>AT YOUR OWN RATE</em></h2>
            <p className="td-section-intro">Every clock in the universe runs at a slightly different pace. This isn't philosophy — it's physics, confirmed repeatedly by experiment. The faster you move, the slower your clock. The further from gravity, the faster it goes.</p>
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

        {/* ── SOLAR ── */}
        <section className="td-section">
          <Reveal>
            <div className="td-section-eyebrow">04 / Solar Interference</div>
            <h2 className="td-section-title">WHEN THE SUN<br/><em>LOSES TRACK</em></h2>
            <p className="td-section-intro">Occasionally the sun releases a billion-tonne cloud of magnetised plasma that reaches Earth in a day or two. It doesn't just produce auroras — it distorts the invisible infrastructure that modern time-keeping depends on.</p>
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

        {/* ── TIMELINE ── */}
        <CombinedTimeline/>

        {/* ── QUOTE 2 ── */}
        <Reveal>
          <div className="td-quote">
            <div className="td-quote-mark">"</div>
            <p>The hour that vanishes each spring isn't returned in autumn. What comes back is a different hour, from a different timeline. You meet it as a stranger.</p>
            <cite>On the irreversibility of absent time</cite>
          </div>
        </Reveal>

        {/* ── FOOTER ── */}
        <Reveal>
          <footer className="td-footer">
            <div className="td-footer-brand">TIME <span>DISSONANCE</span></div>
            <div className="td-footer-note">A meditation on slipping hours</div>
          </footer>
        </Reveal>
      </div>
    </>
  );
}
