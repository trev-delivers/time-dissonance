# ds-proposals

Design system work that belongs in [trev-delivers/obvious](https://github.com/trev-delivers/obvious)
but is staged here until it lands there.

`ds/` is not the place for it. `scripts/sync-ds.mjs` deletes and re-copies that
folder on every run, so anything written into it survives exactly until the next
`node scripts/sync-ds.mjs` and then vanishes without a word. Staging here keeps
the app's own imports honest about which parts of its styling the system does
not yet provide.

Each file loads after `ds/css/components.css` and before the app's own styles,
so it patches or extends the system without the app having to know the
difference. `src/main.jsx` has the import order.

## What's here

| File | What it is | Lands upstream as |
| --- | --- | --- |
| `fixes.css` | Bugs in the vendored components | edits to existing `src/components/*.css` |
| `tilt.css` | New component, `t-tilt` | `src/components/tilt.css` |
| `digit.css` | New component, `t-digit` | `src/components/digit.css` |

## The bugs, and why they matter

`obvious` ships eleven components. Before this pass the app used three and
hand-rolled equivalents of four more. That was not laziness in the app — it was
a reasonable response to the state of the components.

The docs site demos nine of the eleven under "The interaction layer", labelled
*All working*. The two it does not demo are `t-tt` and `t-badge`. Those are
exactly the two that are broken. Not in this app specifically — everywhere.
Nothing was looking at them.

**The tooltip can never be shown.** `tooltip.css` sets `.t-tt` to `opacity:0`
and no rule anywhere sets it back. No `:hover`, no `.is-open`, no
`data-state` — it is the last rule in the built `components.css` and the
trigger half was never written. The component already has the shape for one:
`.t-tt-wrap` is the positioning parent and `--tt-scale:.98` is a from-state
implying a to-state. Only the rule is missing.

**Four references resolve to nothing.** `tooltip.css` reads `--line2`, `--dim`
and `--mono`; `badge.css` reads `--mono` and `--bg`. Nothing in
`primitives.css` or any theme declares them, so `border:1px solid var(--line2)`
is a border with no colour and the badge's 2px ring around the dot is a ring of
nothing.

**Two greys are fixed where they should be derived.** `--think-base:#9A9A9A`
with `--think-highlight:#F5F5F5` is a near-white sweep over mid-grey: legible
on near-black, close to invisible on parchment. Same shape in `boot-ring.css`.
The intent is right and documented — `t-think` uses "greys rather than the
accent, so it stays quiet" — but fixed values only deliver that intent on a
dark theme.

`stagger.css` is a milder case: correct and themed, but carrying the recipe's
literal `500ms` and raw easing curve where `--ds-duration-*` and
`--ds-ease-out` exist. Fixing it is not a no-op — the system has no 500ms step,
so the entrance lands on `--ds-duration-slow` and gets 100ms quicker. That is
the trade the tokens are for. It also stops at `.t-stagger-line--2`, so a
third line needs a hand-written modifier; the delay is a function of position,
so `nth-child` derives it and any number of lines works.

### Two more, outside the CSS

**`mountConfetti` throws on mount.** `ds/js/behaviours.js` declares
`mountConfetti({ stage, canvas, trigger })` and then uses `btn` twice in the
body — at line 319 inside `buttonRect()` and at line 487, `btn.addEventListener('click', burst)`,
which runs during mount. A rename that missed two references. The behaviour
cannot work in any app; it raises `ReferenceError: btn is not defined` the
moment it is called. Both should be `trigger`. It also documents
`components/confetti.css`, which the vendored `dist/` does not contain.

This one cannot be shimmed from here — it is JS, and `ds/` is overwritten on
every sync — so `ds` is now in this app's eslint ignores. That is the right
scope for lint either way (vendored generated code is not the app's to hold
to the app's rules), but it means the error is recorded here rather than
caught by CI. Fixing it upstream is the only fix.

**`--max` never worked.** `scripts/audit-ds.mjs` is described in its own
header as the canonical copy each consuming app vendors, and documents
`node scripts/audit-ds.mjs --max 60` as the CI gate. It parsed roots as
`args.filter(a => !a.startsWith("--"))`, so the value after `--max` — a bare
number — was taken as a directory to audit. `--max 60` reported on a folder
called `60`: no files, no tokens, zero bypasses, comfortably within budget.
The one invocation whose whole job is to fail a build was the one that could
never fail. Fixed in this app's copy; the same one-line change is owed to
every other app that vendors it, and to the source.

### What is deliberate and left alone

Two components carry literal colours on purpose, and the docs site says so.
`t-check-badge` is green and white in every theme because "a tick that changes
colour stops reading as a tick". `t-gradient-text` is "not themed: it is the
same spectrum everywhere it appears". An audit that only counts hex codes flags
both. Neither is a bug, and neither is touched here.

## The new components

Both come from free-tier transitions.dev recipes, vendored in `transitions/`,
adapted the way the existing components should have been: tokenised onto
`--ds-*` where the system has a scale, left literal where it does not, and with
the decision written down either way.

`t-tilt` needed one change beyond tokenising. The recipe's glare is white with
`mix-blend-mode:screen`, which is a dark-theme assumption — a white screen-blend
on parchment is invisible. Colour and blend mode are both variables here, so a
light theme sets `multiply` and a dark one tints the light to its accent.

## Landing them

1. Copy each file into `src/components/` in `obvious`, and apply `fixes.css`'s
   changes to the component sources it names rather than copying it across.
2. Register the two new components wherever `components.css` is assembled.
3. `npm run build` there, then `node scripts/sync-ds.mjs` here.
4. Delete the file from this folder and drop its import from `src/main.jsx`.
5. `npm run ds:audit` should show the component count rise and the bypass
   count hold.

Nothing here is meant to outlive its upstream landing. A file still sitting in
this folder six months from now is a contribution that was never made, not a
local override that earned its place.
