import { useEffect, useRef } from "react";

// ── WARP STARFIELD ────────────────────────────────────────────
// Radial warp: stars born near centre, stream outward.
// Key properties matching the reference image:
//  - Hugely varied sizes: most are sub-pixel pinpricks, a few larger
//  - Soft glow/blur via radial gradient (no sharp uniform circles)
//  - Streaks that are LINES not stretched circles — thin & directional
//  - Speed varies a lot so motion feels organic not mechanical
//  - Overall very dark — glow is blue-white, mostly dim
/* Canvas takes colour strings, not custom properties, so a token has to be
   resolved to real channel values before it can be drawn with. Setting the
   token on a throwaway element's `color` and reading it back is the reliable
   way: the browser resolves var() and color-mix() on a real property, where
   getPropertyValue on the custom property itself would hand back the
   unresolved expression. */
function readChannels(token, fallback) {
  const probe = document.createElement("span");
  probe.style.cssText = `position:absolute;visibility:hidden;color:var(${token})`;
  document.documentElement.appendChild(probe);
  const raw = getComputedStyle(probe).color;
  probe.remove();
  const parts = raw.match(/-?[\d.]+/g);
  if (!parts || parts.length < 3) return fallback;
  /* Two serialisations, and the difference is not cosmetic. A plain colour
     comes back as an sRGB triple on 0-255. A color-mix() result comes back
     from Chromium as `color(srgb 0.71 0.83 0.90)` on 0-1 — and both star
     colours are mixes. Rounding those floats without rescaling gives
     1,1,1, which is black: the whole field draws and is invisible. */
  const scale = raw.startsWith("color(") ? 255 : 1;
  return parts.slice(0, 3).map((n) => Math.round(Number(n) * scale)).join(",");
}

export default function Starfield() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx    = canvas.getContext("2d");
    let W, H, CX, CY, raf;

    /* Read once at mount rather than per star per frame — 700 stars at 60fps
       would be 42,000 style resolutions a second for two values that do not
       change. */
    const COLD = readChannels("--star-cold", "180,210,240");
    const WARM = readChannels("--star-warm", "220,185,130");
    const VOID = readChannels("--ds-color-bg", "4,6,13");

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
      ctx.fillStyle = `rgba(${VOID},0.20)`;
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

        const base = s.warm ? WARM : COLD;

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

    ctx.fillStyle = `rgb(${VOID})`;
    ctx.fillRect(0, 0, W, H);
    // Respect reduced-motion: paint one static field instead of a
    // perpetual rAF warp — a full-screen zooming starfield is exactly
    // the kind of motion that preference exists to suppress.
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      stars.forEach(s => { s.dist = Math.random() * Math.sqrt(CX * CX + CY * CY); });
      draw();
      cancelAnimationFrame(raf);
    } else {
      draw();
    }
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={ref} className="td-canvas" />;
}
