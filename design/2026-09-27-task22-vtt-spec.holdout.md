# Task 22 "Broken Tabletop" — holdout validation scenarios

For the **independent validator only**. The implementer and the spec never see or reference this file.
Each scenario uses inputs that differ from the spec's own repros and F2P tests (other creatures, numbers, cells),
so passing it shows the behaviour is general and not fitted to the examples in the spec.

All scenarios run against the **clean** build unless the scenario says otherwise. Use only documented surfaces:
the wire protocol in `docs/PROTOCOL.md`, the test-mode hooks in `docs/TESTING.md`, the non-test-mode setup path
(import → invite join → display name → claim), and the rendered UI by role/label. Never import internal modules.

---

## H1 — A player never learns about a token they may not see, on any path

**Setup**
- Non-test-mode server (no hook secret, test mode off). Create a game, upload an original map, set a 10×10 grid.
- Place: a party token "Kestrel" owned by player P1; a Wolf (non-hidden) at cell (8,8); a hidden Bandit at (2,7).
- Enable fog (all cells fogged), then reveal the rectangle (0,0)–(4,4) inclusive.
- Two players join via the invite link: P1 (claims Kestrel) and P2 (spectator, claims nothing). Attach a raw
  WebSocket sniffer to P2's authenticated socket that records every inbound frame from the moment of auth.

**Sequence**
1. P2 reconnects (close socket, reopen, first-message auth) and receives a snapshot.
2. GM streams a 3-second drag of the hidden Bandit from (2,7) to (3,8), then releases.
3. GM streams a drag of the Wolf from (8,8) to (7,8) (both cells fogged), then releases.
4. GM sends `/w P1 the bandit carries a map`. P2 then refreshes (full reconnect) and receives chat history.
5. GM makes a GM-only roll (`/gmr 3d6`) and a GM-only monster attack from the Wolf's stat block against Kestrel.
6. P2 requests an asset ticket for the Bandit's token image; separately, P2 requests a ticket for the active map.
7. GM reveals the single cell (7,8).

**Expected behaviour**
- Steps 1–6: no frame on P2's socket contains the Bandit's id, name, image reference or an asset ticket for its
  image; none contains the Wolf's id while all of its cells are fogged; none contains the whisper's text or id;
  none contains the GM-only roll's faces/total or the Wolf's AC or HP numbers.
- Step 6: the Bandit-image ticket request is refused with an error indistinguishable from the one returned for a
  made-up asset id. The map ticket is granted; fetching it by URL path succeeds; the response is marked not storable
  by shared caches; the ticket does not appear in any URL query string.
- Owner-only visibility (OQ-5): Kestrel is present in P1's state throughout, even while its cell is fogged. In P2's
  state Kestrel appears only while at least one of its cells is revealed.
- Step 7: P2 receives the Wolf at (7,8) without a refresh, showing a name and a coarse health state
  (Healthy/Bloodied/Down) — never exact HP.
- Negative: the participant key never appears in any HTTP request line, header or cookie captured during the run
  (inspect the server's request log or a proxy capture). The server sets no cookies at all.

**Satisfaction criteria**
- Zero forbidden identifiers across the entire P2 capture (automated substring scan for the Bandit id, name, image
  ref; the Wolf id before step 7; the whisper text; the GM roll id).
- Step 6 errors are byte-identical apart from any request-correlation id.
- Step 7 delivery happens within 1 s of the GM's acknowledgement.

---

## H2 — Tracker order and turn survive typed values, removals and a restart

**Setup**
- Test mode with hook secret; load a fresh game (not the "Sunken Tavern" fixture). Create six tokens: two Wolves
  (W1, W2), a Bandit, and three PCs (Pell, Quill, Rook), each owned by a different player.
- Start combat.

**Sequence**
1. GM **types** initiative in the UI: W1 = 3, W2 = 110, Bandit = 25, Pell = 9, Quill = 17, Rook = 25.
   Give Rook a higher initiative modifier than the Bandit via their sheets/stat blocks beforehand.
2. Press Next until Quill is current.
3. Remove W2 (above the current creature), then remove Pell (below it).
4. Remove Quill (the current creature).
5. Press Next repeatedly until the round wraps once.
6. Restart the server process (kill the full process tree, start it again), reconnect all windows.

**Expected behaviour**
- After step 1, every participant's tracker reads, top to bottom: W2 110, Rook 25, Bandit 25, Quill 17, Pell 9, W1 3
  (Rook before Bandit by the higher-modifier tie-break). Never a text order such as 110, 17, 25 …
- On the wire, every initiative value the GM's client sent is a JSON number, not a string.
- After step 3, Quill is still current and the round is unchanged.
- After step 4, the turn passes to the next creature in order (W1) — not skipped past it, not back to Rook.
- Step 5: wrapping from the last row to the first increments the round counter by exactly 1.
- Step 6: order, current turn and round are exactly as before the restart.
- Negative: no participant ever sees two combatants highlighted, a duplicated row, or a round decrement.

**Satisfaction criteria**
- The displayed order and highlight match the expected values in both the GM and a player browser context at every
  step, read from rendered rows by role/label.
- Post-restart state equals pre-restart state field-for-field on the documented tracker message.

---

## H3 — HP, temp HP, death saves and healing follow one pipeline on every route

**Setup**
- Test mode. A level 5 PC "Oriel" with max HP 42, CON +2, owned by player P1; Oriel has fire resistance and is
  concentrating on a spell. A hit-die pool of 5.

**Sequence**
1. Grant 6 temp HP, then grant 4 temp HP.
2. Apply 19 fire damage (typed).
3. Queue a forced d20 face of 2 for the concentration save Oriel is prompted for; roll it.
4. Apply 60 untyped damage via the HP quick-edit (−60).
5. From 0 HP: roll death saves with forced faces 1, then 12. Then apply 5 damage from a critical hit.
6. Heal 7 through the heal dialog.
7. Drop Oriel to 0 again with −20, then enter +100 in the quick-edit.
8. Apply −10, then take a Short Rest and spend two hit dice one at a time with forced faces 1 and 1.

**Expected behaviour**
- Step 1: temp HP = 6 (higher value kept, never 10).
- Step 2: 19 fire → 9 after resistance (rounds down); temp absorbs 6; HP 42 → 39. The GM sees the arithmetic;
  P1 sees the result but other players see only the coarse state.
- Step 3: DC = max(10, floor(9/2)) = 10; the forced 2 + CON save modifier (at most +5 with proficiency) fails →
  concentration ends.
- Step 4: HP 0, Unconscious, death saves start. Leftover damage (60 − 39 = 21) is below max 42 → not dead.
- Step 5: natural 1 → 2 failures; 12 → 1 success; crit damage at 0 → +2 failures → 4 failures ≥ 3 → **Dead**.
- Step 6: a Dead PC regains nothing; HP stays 0.
- Re-run steps 4–5 on a fresh copy of Oriel but with only the natural 1 and the 12 (1 success / 2 failures), then
  step 6 heal 7 → HP 7, Unconscious removed, **Prone present**, **both tallies 0/0 and not Stable**.
- Step 7 (on the fresh copy): −20 from 7 HP → 0 HP, Unconscious, not dead (leftover 13 < 42); quick-edit +100
  → HP 42, not 142; Unconscious removed; tallies 0/0.
- Step 8: HP 42 → 32; each spend heals max(1, 1 + 2) = 3 → HP 38; hit-die pool 5 → 3.
- Negative: no route (dialog, quick-edit, spell, rest, natural 20) ever produces HP above max or leaves stale
  death-save marks after regaining HP from 0. Starting a Short or Long Rest at 0 HP is refused.

**Satisfaction criteria**
- Every intermediate HP / temp HP / tally / condition value equals the expected value, read from the GM's view of
  the documented character state.
- The non-test-mode variant (import → join → claim; GM sets 2 failure marks directly, then heals 3) also ends at
  tallies 0/0.

---

## H4 — Export/import round trip keeps state but carries no credentials or private recipients

**Setup**
- A game with two scenes (one with an uploaded map and a hidden token), fog partially revealed, a running combat at
  round 3 with the third combatant current, two claimed characters, and chat containing: a public message, a
  `/gmr` roll, and a player-to-player whisper.

**Sequence**
1. GM obtains a single-use export ticket over the socket and downloads the export JSON.
2. Try to reuse the same export ticket.
3. A player socket requests an export ticket.
4. Import the JSON as a new game from a request carrying a foreign `Origin` header; then from a same-origin request.
5. Join the imported game with a new player via its fresh invite link and claim a character.

**Expected behaviour**
- Step 1: one self-contained JSON file; uploaded images are embedded, not referenced by path.
- Step 2: refused. Step 3: refused for a player.
- Step 4: foreign Origin rejected; same-origin import succeeds and returns **fresh** GM and invite credentials.
- The imported game matches the original on: scenes and map images, tokens (including the hidden flag and character
  links), fog cells, sheets, tracker round 3 and current turn, and chat order.
- Every character in the imported game is unclaimed. The old GM key, invite link and rejoin links do not admit
  anyone to the imported game.
- The formerly private whisper and the GM-only roll are visible to the GM only in the imported game; the new player's
  history contains the public message only.
- Negative: the export file contains no participant keys, rejoin tokens or tickets (scan for the original keys).

**Satisfaction criteria**
- Field-by-field equality on the listed state; zero credential strings from the original game in the export file;
  the new player's history equals exactly `[public message]`.

---

## H5 — Grading controls behave as the scoring table promises (22a packaging)

**Setup**
- The frozen bugged repo and the packaged grader. Prepare these candidate workspaces by hand:
  - (a) untouched bugged repo;
  - (b) bugged repo + a correct server-side fix for the nudge-ownership bug only;
  - (c) bugged repo + a client-only fix for the nudge-ownership bug (the keyboard handler refuses non-owned tokens;
    the server is unchanged);
  - (d) bugged repo + a fix for the missing-dice-count bug that is active only when the test-mode flag is set;
  - (e) bugged repo + correct fixes for the drag-stream leak and the tracker-removal bug + nudge deleted entirely
    (command and key binding removed);
  - (f) clean app + a FINDINGS.md written by a third party (not the spec author) describing each unreported bug in
    player terms with different wording from the spec;
  - (g) bugged repo whose agent also edited `package.json` to add a dependency and changed a vendored stat block in
    `data/`.

**Sequence**
- Grade each workspace with the frozen grader, serially, on the target Windows machine.

**Expected behaviour**
- (a) 0. (b) exactly 8. (c) 0 for B02 and no group penalty. (d) 0 for B10 and no group penalty.
  (e) 10 + 8 − 4 = 14: B01 and B03 score, B02 scores 0, the tokens group costs −4.
  (f) 69, with each unreported bug receiving ≥ 2 of 3 "yes" votes.
  (g) the manifest change and the data edit are ignored; the grade equals the grade of the same repo without them,
  or "did not build" if the source relies on the added package — never a crash of the grader.
- Each scripted grade (excluding the judge phase) finishes within the frozen grader timeout; no orphan node or
  Chromium processes remain afterwards.
- Negative: the grader never reads tests, configs or node_modules from the agent workspace; no grade produces a
  negative total.

**Satisfaction criteria**
- All seven totals match exactly across two independent grading passes.
- Process list after each grade shows no leftover processes started by the grader.

---

## H6 — A real evening: two windows, a phone, and a Funnel link

**Setup**
- Clean build, test mode **off**, served on one port and shared through `tailscale funnel`. GM on a desktop browser;
  player "Tam" on a phone over mobile data; a second player "Uli" in a second window of the GM's own browser.

**Sequence**
1. GM creates a game, uploads a map, places tokens (including one with an uploaded image), sends the invite link.
2. Tam and Uli join with display names and claim characters. Uli's window shares the browser with the GM's.
3. Play ~10 minutes: move tokens by drag and arrow keys, roll `/r d8+2`, `/r 4d6kh3`, `/r d%`, attack a monster
   from a sheet, apply damage, measure a diagonal with the ruler (3 diagonal cells).
4. Toggle Tam's phone into airplane mode for 20 s, then back.
5. GM regenerates the invite link, then removes Uli.
6. Refresh the GM window.

**Expected behaviour**
- The GM and Uli remain distinct participants in the same browser (different names in the presence list).
- Map and token images load on the phone through the Funnel URL.
- `/r d8+2` rolls exactly one d8; `/r d%` one value 1–100; `4d6kh3` shows the dropped die. The ruler reads 15 ft.
- Step 4: Tam sees "Reconnecting…", then rejoins automatically with correct, non-duplicated state.
- Step 5: the old invite link no longer admits anyone; Tam's rejoin link still works; Uli's socket closes, Uli's
  rejoin link and any asset tickets stop working, and Uli's character becomes unclaimed.
- Step 6: the GM is still the GM after refresh.
- Negative: the GM key is never visible in the URL bar of any player device, in any HTTP request log, or on screen
  in the player windows; the browser devtools network tab on the phone shows no request to any origin other than the
  app's own.

**Satisfaction criteria**
- An operator completes the checklist above without restarting the server or clearing browser data, and records
  pass/fail per step with a timestamp. Any step failing = scenario fail.
