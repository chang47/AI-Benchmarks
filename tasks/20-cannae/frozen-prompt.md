# Cannae, 216 BC — a rule-based 3D battle re-enactment

Build a web page that re-enacts the **Battle of Cannae** (2 August 216 BC), where Hannibal's smaller army encircled and destroyed a much larger Roman army.

It must be a **simulation, not an animation**:
- Units follow movement and combat rules plus a fixed script of orders, and the famous battle must *emerge* from those rules.
- Do not keyframe positions.

Show it as a charming **cartoon 3D battlefield** that the viewer can play, pause and scrub through.

## Deliverable

- Everything lives in `src/`: `src/index.html` plus any of your own local `.js`/`.css` files it loads with relative paths.
- **Three.js is provided:** `inputs/vendor/three-r186.iife.js` is a classic script that defines `window.THREE` (extras on `THREE.addons`).
  - Copy it to `src/vendor/` and load it with `<script src="vendor/three-r186.iife.js"></script>`.
  - ES-module imports of local files do not work from `file://`.
- It must work opened directly from disk via `file://`, with **no network requests** of any kind.
- Zero console errors. It must work at 1440px and 390px wide.

## The battlefield (use these coordinates)

- **Map:** metres, **x = east, y = north**, origin at the centre of the field.
- **The river Aufidus** runs roughly north–south along the west edge, near x ≈ −1000.
- **The hill and town of Cannae** lie to the south-east.
- **Romans face south; Carthaginians face north.**
- **Units are rectangles:**
  - `x`, `y` = centre; `heading` in radians, 0 = facing north, π/2 = facing east.
  - `frontage` = width across the facing direction; `depth` = along it.
- **Depth** = men ÷ (frontage × density).
  - Density in men per m²: Roman and allied infantry 0.4 (very deep, as at Cannae); Gauls and Spaniards 1.2; Libyans 1.0; all cavalry 0.35; light troops 0.8.

**Order of battle.** The front edge is the edge the unit faces. Use exactly these ids and numbers:

| id | side | kind | contingent | men | centre x | front edge y | frontage | heading |
|---|---|---|---|---|---|---|---|---|
| `R-cav` | R | cav | romanCav (Paullus) | 2,400 | −705 | 300 | 360 | π |
| `R-inf-1` … `R-inf-10` | R | inf | roman (1–5), alliedInf (6–10) | 5,500 each | −472.5 + 105·(i−1) | 300 | 105 | π |
| `R-acav` | R | cav | alliedCav (Varro) | 3,600 | 795 | 300 | 540 | π |
| `R-vel` | R | light | velites | 15,000 | 0 | 240 | 1050 | π |
| `C-cav` | C | cav | hasdrubal | 6,500 | −705 | −300 | 360 | 0 |
| `C-lib-W` | C | inf | libyan | 5,000 | −600 | −380 | 150 | 0 |
| `C-cen-1` … `C-cen-10` | C | inf | gaul or spaniard | see below | −472.5 + 105·(i−1) | −150 − 150·(\|x\|/525)² | 105 | 0 |
| `C-lib-E` | C | inf | libyan | 5,000 | 600 | −380 | 150 | 0 |
| `C-num` | C | cav | numidian | 3,500 | 795 | −300 | 540 | 0 |
| `C-bal` | C | light | balearic | 8,000 | 0 | −90 | 1250 | 0 |

**The crescent:**
- `C-cen-2`, `-5` and `-8` are Spaniards with 1,666.67 men each.
- The other seven are Gauls with 2,571.43 men each.
- Its middle bulges forward (north) and its ends are drawn back.

## Rules

Use a fixed time step (e.g. 1 s) and make the simulation **deterministic**: the same time always gives the same state, whether reached by playing or by seeking. The battle lasts about 40 minutes of battle time; play it back fast (e.g. 30×).

1. **Contact and combat.**
   - Units stop when their front edge reaches an enemy.
   - A unit is **engaged** on a side (front, rear, left or right) when a meaningful share of that side is within a few metres of an enemy that faces it.
   - Men die only along engaged sides. The loss rate scales with the engaged length and the attacker's quality:
     - Libyans and Hasdrubal's cavalry are best.
     - Numidians barely kill; they harass.
   - Contact on a unit's **flank or rear multiplies its losses**.
   - A unit engaged on two or more sides is **trapped**. It hits back only feebly, and it shrinks as it dies.
   - No unit moves through an enemy, and infantry does not march through friendly units.
2. **Speeds (m/s), never exceeded:**
   - Infantry: 1.0 advancing, 0.45 giving ground.
   - Libyans: 1.1.
   - Cavalry: 4 trot, 5 charge; Numidians 6.
   - Routing troops: 4.
   - Units wheel at most ~5° per second.
3. **Rout.**
   - Cavalry routs when it has lost about 40% of its men, or at once when charged in the rear.
   - Routed units flee straight away from the enemy and leave the map.
   - Infantry does not rout; it fights where it stands.
4. **Skirmishers.** Velites and Balearic slingers trade missiles between the lines, then fall back through their own line and leave the field. They never melee.

## Orders (fixed script, plus Hannibal's commanders)

- **t = 0:** skirmishers skirmish.
- **t = 30:** `C-cav` charges `R-cav` and `R-cav` counter-charges. `C-num` harasses `R-acav`, riding in and out and pinning it.
- **t = 120:** skirmishers withdraw.
- **t = 150:**
  - The Roman infantry advances south as one line: a block never gets more than ~40 m ahead of its neighbours, and blocks close ranks sideways.
  - The six central crescent companies (`C-cen-3`…`8`) **give ground** while pressed from the front, up to ~380 m.
  - The four end companies **hold**.
  - The Libyans wait.
- **When `R-cav` breaks:** `C-cav` rides behind the whole Roman army (north of its rear) to the east and charges `R-acav` **from behind**. It pursues briefly, then halts behind the Roman army facing it. The Numidians chase the fugitives off the field.
- **When the crescent has bent concave:** its middle has fallen back behind its ends. This is Hannibal's signal: the Libyans turn ~90° to face inward and march onto the flanks of the outermost Roman blocks.
- **When the Libyans are on the Roman flanks:**
  - `C-cav` splits into squadrons `C-cav-1`…`C-cav-n` (one per surviving Roman block) and charges the Roman rear.
  - From then on the Romans fight where they stand, and every Carthaginian unit presses in to keep contact. The circle contracts.

**Outcome.** If the rules work, the Romans end encircled on all four sides, with roughly 45,000–55,000 Roman dead against roughly 5,000–8,000 Carthaginian dead, most of them Gauls and Spaniards.

## What the viewer sees

- A cartoon 3D field: the river, the hill, and simple low-poly soldiers.
  - One figure per ~20 men, with colours that tell the contingents apart (Romans red).
  - Figures disappear as units lose men.
  - The fallen are left on the field.
- Formations move and fight visibly:
  - Cavalry melees look loose and swirling.
  - Routed units scatter.
  - Units re-form gradually, never teleporting into shape.
- Controls:
  - A play/pause button and a timeline slider to scrub the whole battle.
  - Playback speed buttons.
  - A few camera views with drag-to-orbit and wheel zoom.
  - A casualty counter for each side and a caption that tells the story as it happens.

## Test contract (automated checks rely on this — follow it exactly)

```js
window.__cannae = {
  duration,          // seconds of battle time (≥ 1800)
  seek(t),           // jump to battle time t (seconds); returns state(); must be exact and deterministic
  state(),           // { t, units: [...], events: [...] } for the current time
  play(), pause(), playing(),
  setSpeed(x),       // playback multiplier
};
```

- **Each unit in `state().units`:** `{ id, side: "R"|"C", kind: "inf"|"cav"|"light", contingent, men, men0, x, y, heading, frontage, depth, status, engagedSides }`.
  - `status` is one of `"formed" | "engaged" | "routing" | "destroyed" | "left" | "split"`.
  - `engagedSides` lists any of `"front" | "rear" | "left" | "right"`.
- **Units never disappear from the list:** destroyed, departed or split units stay with that status.
- **The squadrons** `C-cav-1…n` appear when `C-cav` splits (it then has status `"split"`, and its men pass to them).
- **`events`** is `[{ t, type, id }]` and includes at least `rout` events (`id` = the unit that routed).
- **Page elements:** the timeline slider is an `<input type="range">` with `data-timeline`; the play button has `data-play`.
