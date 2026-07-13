# VERIFY — 12-chess-webgame

## Round 0

Independent verifier (round 0). Builder role and verifier role are separate; the verifier did not
build `src/`.

### Step 0 — Tamper check (PASS)

Recomputed sha256 (PowerShell `Get-FileHash`) of every file in `holdout/FREEZE_MANIFEST.json`.
All three match the frozen manifest exactly:

| File | Manifest sha256 (prefix) | Recomputed | Match |
|---|---|---|---|
| `autochecks.mjs` | `87222632…d1de5b7` | `87222632…d1de5b7` | ✅ |
| `rubric.md` | `ef71f6f4…ba0289aa` | `ef71f6f4…ba0289aa` | ✅ |
| `package.json` | `c820d647…110e59e2` | `c820d647…110e59e2` | ✅ |

No holdout tampering. Proceeded to grading.

### Step 1a — Holdout autochecks (`node autochecks.mjs ../src/index.html`)

- Exit code **0**. Aggregate: **autochecks 49 PASS / 0 FAIL / 1 SKIP** (skip = R3, the visual-only
  placeholder for criterion 2, resolved by human screenshot judgment below).
- **Gates: 4/4 PASS** — G1 hook shape (`window.__chess` with `board()`/`turn`/`move()`, fresh
  snapshot), G2 no blocking dialogs, G3 fully self-contained (0 external requests; `src/` is one
  file), G4 zero console/page errors.
- **Criteria: 17/18 PASS programmatically, 1 MANUAL** (criterion 2 visual half).
- Raw output saved to `verify/round-0/autochecks-output.json`.

### Step 1b — Independent playwright pass (verifier's own script)

`verify/round-0/verify_pass.mjs` (chromium `channel:"chrome"`, `file://` load) drove the hook
independently of the holdout harness. Every assertion returned true:

- Hook present; `board()`/`move()` are functions; `turn==="w"` at load; initial snapshot exactly
  32 entries and deep-equals the FIDE Art. 2 start position; mutating a returned snapshot does not
  leak (fresh copy each call).
- Turn indicator reads "White to move" at load, "Black to move" after 1.e4; `move("e2","e4")`
  accepted, pawn on e4, turn flipped; second white move `d2d4` rejected with snapshot+turn
  unchanged (illegal-move contract).
- Fool's mate (`f2f3 e7e6 g2g4 d8h4`) all accepted, game locks (subsequent moves rejected),
  page declares mate.
- Click path: clicking e2 adds a `sel` class + outline (visible selection); check line
  1.e4 d5 2.Bb5+ accepted and page shows "Check".
- 0 console errors, 0 uncaught page errors, 0 dialogs, 0 non-`file:`/`data:` requests.

### Step 1c — Visual confirmation of MANUAL / human-judgment items (screenshots in `verify/round-0/`)

- `at-0s-initial.png` — **criterion 1 & 2**: 8×8 alternating board; **a1 (bottom-left) DARK,
  h1 (bottom-right) LIGHT** (FIDE 2.1 ✓); all 32 pieces drawn; White (outlined/light) vs Black
  (solid) clearly distinguishable; every piece type (R/N/B/Q/K/P) identifiable. Criterion 2 MANUAL
  → **resolved PASS**.
- `select-e2.png` — **criterion 4**: e2 square highlighted yellow with legal-target dots (e3/e4)
  after a click. Visible selection ✓.
- `at-3s-foolsmate.png` — **criterion 14**: "Black wins / Checkmate" declared; mated king square
  highlighted red.
- `check-indication.png` — **criterion 13/14**: "Check" shown in gold; checked king highlighted red.

### Per-criterion rollup

Gates G1–G4: PASS. Criteria 1–18: all PASS (criterion 2's visual half confirmed from
`at-0s-initial.png`). No FAIL, no unresolved MANUAL.

- **passRate = 18/18 = 1.00** (weighted rubric fraction; equal-weight criteria, all gates pass).
- **fakeConvergence = false** — builder's latest `BUILD r0` line claims DONE=yes and the verdict is
  pass, so the claim is corroborated.
- **verdict = PASS** (passRate ≥ 0.8, all hard gates pass).

No FEEDBACK section — nothing failed.
