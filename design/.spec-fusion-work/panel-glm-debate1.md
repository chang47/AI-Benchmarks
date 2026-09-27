# Round 2 — GLM panelist, targeted critique of spec v1

**Verdict:** v1 is close to freeze-ready. It landed every round-1 settlement faithfully (B11 protocol-graded with bug-orthogonal sentinels, A10 as one invariant across messages and assets, the parity group plus hook secret, frozen-once packaging with a directory allow-list, judges built first, R6, the calibration run). I found one genuine internal contradiction (B07), two enforcement gaps that leave existing controls unfalsifiable, and a few smaller items. Nothing else needs churn.

## 1. B07 is internally contradictory (fix before blind authoring)

APP-91 says "The server shall store and order **every** value numerically," and the protocol "accepts a number or a numeric string." That is a normative server-side requirement. Yet B07 is browser-graded, "Parse in the client" is listed as an equally legitimate fix, and a display-only client re-sort "is accepted."

A blind protocol author reading APP-91 will — correctly — write a group-10 test that sends `"21"` on a raw socket and asserts the snapshot order. Under a client-parse fix the server still stores text, that test fails, and the agent earns 5 points for B07 minus −4 for group 10. Under a display-only fix the server's broadcast order stays wrong, violating APP-91 outright. The spec cannot hold all three of: normative APP-91, browser grading, and client-side fixes as complete fixes.

Also: a naive display-only re-sort breaks B07's own "Drag-reorder persists" sentinel (any server echo re-sorts the display), so "that is accepted" oversells — CAT-03 would score it 0 anyway.

Pick one:
- **(a) My round-1 position:** protocol-grade B07; client-parse and display-only score 0. Cost: a genuinely reasonable client fix earns nothing (GPT's objection).
- **(b) Keep browser grading, fix the doc:** rewrite APP-91 as an observable — "the tracker every participant sees is ordered numerically; the wire accepts a number or a numeric string, and where the string is parsed is an implementation detail the tests do not constrain" — and add one line to TST-04: hidden protocol tests must not assert ordering of numeric strings sent by raw sockets. Blind authoring follows the rewritten doc and the contradiction disappears.

I'd take (b): it keeps every legitimate fix site live and costs one sentence of documentation.

## 2. No rule for regression-group tests that a planted bug breaks

TST-06 item 3 requires the all-bugs build to fail "every F2P test and nothing else," which silently demands that the 14 groups contain no behaviour any bug breaks. Nothing tells the blind author this, and APP-53 makes violation inevitable: its single normative sentence covers whispers "both live and in every history replay," so the group-5 author will naturally write the B06 F2P. Same pressure at group 10 (B07, if item 1 goes unresolved) and group 4 (B01 drag-stream visibility, B11 rectangle edges).

Add the explicit rule and the remedy: any group test that fails on the all-bugs build at step 9 is reclassified into that bug's F2P set (strengthening it) or narrowed — never silently deleted — and PKG-04 freezes the final lists, so the post-blinding edit is bounded and recorded. Expect B06/whisper-history to be the first reclassification.

## 3. Test-mode parity does not cover the browser-graded bugs

CAT-02's dual run ("where an F2P needs no forced dice, it also runs against a non-test-mode server") doesn't say whether browser F2Ps are included, and the parity group (group 14) is protocol-only, sampling groups 3/4/5/8/10. So a fix gated on test mode for B04, B07 or B08 passes its browser F2P and nothing catches it — which also makes the §7.4 control row "a fix active only in test mode → 0 for that bug, −4 (parity group)" unfalsifiable for exactly those three bugs, because the parity group never exercises a browser behaviour.

Fix: one sentence in CAT-02 — every F2P, protocol or browser, that needs no forced dice runs in both modes. That covers B01, B02, B03, B05, B06, B07, B08 and B11 (~17 protocol plus up to 6 browser tests), each dual costing one extra import-set-up server boot. If that is too expensive, the honest alternative is to drop the §7.4 control row for browser bugs and declare test-mode gating of client code an accepted residual risk — but don't leave a control in the table that nothing can reproduce.

## 4. "Ignore vendored data" is unimplementable as written

TST-07 copies whole directory trees (`shared/src`, `server/src`, `client/src` plus client static assets) and separately "ignores the agent's changes to … vendored data." Those coexist only if the data lives outside the copied trees. Pin it: game data lives in e.g. `server/data/` and `shared/data/`, never under `src/`, so the ignore rule is structural rather than a filter the grader doesn't have. Otherwise an agent's edit to a stat block or rules table inside `server/src/data/` ships into the graded build and rule-editing "fixes" come straight back (my C13).

## 5. The non-test-mode setup path needs two pins

The dual runs and the parity group boot a non-test-mode server "set up through the import API." Two things must be stated or they will be discovered late:

- **Browser dual runs need participant identity.** Import returns fresh GM and invite credentials and carries no participants, so a browser dual run must join via the invite, enter a name, and claim the character to recreate "Sam owns Mira." Confirm that flow suffices for B07/B08 setup (it appears to) and that claim-then-rejoin is documented in PROTOCOL/TESTING.
- **APP-111 must say export/import round-trips every persisted field the parity group needs** — tracker round and current turn, whisper recipients in chat history, hidden flags, fog state — not just "a game." Group 12 tests persistence directly; the parity twins of groups 5 and 10 depend on the import path reconstructing identical state.

## 6. The ≤10-minute grade now carries more machinery

Dual runs, the parity group, sentinels and the separated judge phase all sit inside TST-09's 10 minutes, on top of build plus 120–180 protocol tests plus 12–15 browser scenarios. TST-09 is measured, not estimated, and PKG-03 freezes the timeout after measurement — good — but pre-decide the fallback order if it overshoots (sample fewer behaviours in the parity group → trim browser dual runs to one per bug → raise the budget to 15 min) so the trade isn't negotiated under deadline pressure.

## 7. Small items

- **B05's F2P states (11/37, 36/37) have no setup hook.** Test mode exposes reset / fixture / seed / forced faces — no set-HP. The tests must reach those states through documented damage/heal commands (workable: apply 26 typed damage). Confirm that is intended, or add an HP variant to a fixture; don't leave the test author to discover it at reconciliation.
- **OQ-5 and OQ-6 gate build-plan step 6, not G1.** Blind authoring starts at step 6; the A10 default (OQ-5) changes APP-12, one B01 sentinel and the fog tests, and G0 (OQ-6) must precede authoring per A7. Only G0's ordering is currently stated — say both close before step 6.

## What I am not re-litigating

The round-1 settlements all hold in v1 and need no churn: B11 protocol-graded with sentinels the bug cannot touch; the single A10 invariant across messages, assets and exports; first-message auth with fragment identity; the parity group and hook secret; the frozen-once bugged repo with a directory-based allow-list; text judges first, with snapshot, quorum and retry; the visible suite diagnostic-only over 14 penalty groups; the masked GM link; R6 as first-choice promotion; the calibration run; exact 5.2.1 creature names. The six remaining OQs are genuinely human decisions, and apart from item 1 I have no objection to any rejected position standing. With items 1–5 landed, I'd freeze this spec.
