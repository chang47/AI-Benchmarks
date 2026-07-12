# Research — Tennis Scoring Engine (task 01-tennis-scorekeeper)

Stage-1 research record. Every correctness rule in `spec.md` traces to a source below.
Meta-rule honored: no requirement was invented by the author; where sources leave a
display/recording choice open, the chosen convention is stated explicitly with its basis.

---

## 0. Second-brain sweep (STEP 1)

Grep of `C:/Users/iamjo/second-brain` for "tennis" (2026-07-11):

- `01_Projects/public-building/video-ideas.md` — tennis content is the **AI tennis coach
  flagship series** (stroke analysis via multimodal LLM, parked 2026-07-11). No scoring-rules
  research is banked there; it is about coaching, not scorekeeping. Not load-bearing for this task.
- `Projects/MyTennisCoach` exists on disk (separate project, coaching app) — not consulted; out of scope.
- The task definition itself comes from the Vetted Bench design doc
  (`C:/Users/iamjo/Projects/vetted-bench/docs/superpowers/specs/2026-07-11-vetted-bench-design.md`):
  task #1 = "Tennis scoring engine — 15/30/40, deuce/advantage, tiebreak at 6-6 (first-to-7,
  win-by-2), super-tiebreak, ad/no-ad, best-of-3/5", Type A, graded by vetted unit tests,
  built as a full small app (engine + scoreboard UI).

Conclusion: no pre-banked scoring rules in the vault; all correctness rules below are sourced
from external authorities (STEP 2).

---

## 1. Sources

| # | Source | Authority level | URL |
|---|--------|-----------------|-----|
| S1 | **ITF Rules of Tennis 2026** (official rulebook PDF; Rules 5, 6, 7 + Appendix VI read verbatim from the PDF) | PRIMARY — the governing body | https://www.itftennis.com/media/7221/2026-rules-of-tennis-english.pdf |
| S2 | ITF Rules & Regulations landing page (confirms S1 is the official current edition) | Primary index | https://www.itftennis.com/en/about-us/governance/rules-and-regulations/ |
| S3 | USTA — Tennis Scoring: Points, Sets & Games | National federation (US) | https://www.usta.com/en/home/improve/tips-and-instruction/national/tennis-scoring-rules.html |
| S4 | USTA — Friend at Court 2026 (Handbook of Rules and Regulations; match-tiebreak recording convention) | National federation (US) | https://www.usta.com/content/dam/usta/coach-organize/content-fragments/resource-library/assets/pdfs/friend-at-court.pdf |
| S5 | Wikipedia — Tennis scoring system (display conventions, community consensus summary) | Secondary / consensus | https://en.wikipedia.org/wiki/Tennis_scoring_system |
| S6 | RallyRef — Tennis Tiebreak Rules (7-point, 10-point, recording conventions) | Secondary explainer | https://rallyref.com/guides/tennis-tiebreak-rules |
| S7 | World In Sport — Tennis Tie-Break Rules Explained Across ATP, WTA and Grand Slams | Secondary explainer | https://worldinsport.com/tennis-tie-break-rules-explained/ |

Note on S1: WebFetch could not parse the PDF; it was downloaded and text-extracted locally
(PyMuPDF). Rules 5a, 5b, 6, 7 and Appendix VI ("Alternative Procedures and Scoring Methods")
were read verbatim. Key quotes are reproduced below.

---

## 2. Adopted correctness rules (each with citation)

### R1. Standard game scoring — 0/15/30/40, game (S1 Rule 5a)
ITF Rule 5a (verbatim): "A standard game is scored as follows with the server's score being
called first: No point – 'Love'; First point – '15'; Second point – '30'; Third point – '40';
Fourth point – 'Game' …". A player who reaches the fourth point (without the deuce exception
below) wins the game.

### R2. Deuce / advantage (S1 Rule 5a)
ITF Rule 5a (verbatim): "…except that if each player/team has won three points, the score is
'Deuce'. After 'Deuce', the score is 'Advantage' for the player/team who wins the next point.
If that same player/team also wins the next point, that player/team wins the 'Game'; if the
opposing player/team wins the next point, the score is again 'Deuce'. A player/team needs to
win two consecutive points immediately after 'Deuce' to win the 'Game'."
Consequence: deuce/advantage can cycle indefinitely; there is no cap.

### R3. No-Ad scoring (S1 Appendix VI, "NO-AD SCORING METHOD")
ITF Appendix VI (verbatim): "If each player/team has won three points, the score is 'Deuce'
and a deciding point shall be played. … The player/team who wins the deciding point wins the
'Game'." I.e., with no-ad the game is decided by a single point at deuce — there is never an
advantage state. (The receiver's choice of service side for the deciding point is a
serve-mechanics rule — out of scope, per the task's exclusion of serve/side rotation.)
No-ad is defined by the ITF as an alternative under "SCORE IN A GAME (Rule 5)" only — it does
**not** change tiebreak scoring (tiebreaks remain win-by-2; see R5).

### R4. Set — first to 6 games, win by 2; tiebreak at 6-6 (S1 Rule 6b)
ITF Rule 6b "Tie-break Set" (verbatim): "The first player/team to win six games wins that
'Set', provided there is a margin of two games over the opponent(s). If the score reaches six
games all, a tie-break game shall be played."
Consequences: 6-4 wins the set; 6-5 does NOT (play continues); 7-5 wins; 6-6 triggers a
tiebreak game. (ITF Rule 6a "Advantage Set" exists but the task scope pins the tie-break set.)

### R5. Tiebreak game — first to 7 points, win by 2, points counted numerically (S1 Rule 5b)
ITF Rule 5b (verbatim): "During a tie-break game, points are scored 'Zero', '1', '2', '3',
etc. The first player/team to win seven points wins the 'Game' and 'Set', provided there is a
margin of two points over the opponent(s). If necessary, the tie-break game shall continue
until this margin is achieved."
Consequences: 7-5 ends the tiebreak; 7-6 does not; play continues (8-6, 14-12, … no cap).
Confirmed by S6/S7 ("no point cap … 7-5, 8-6, 14-12").

### R6. Set won via tiebreak is recorded 7-6 (S1 Rule 5b + S5, S6, S7)
ITF Rule 5b: the tiebreak winner "wins the 'Game' and 'Set'" — the tiebreak counts as one
game, making the game score 7-6. S5/S6/S7 all confirm: "The set concludes 7-6 for the
winner" regardless of the tiebreak's internal point score (7-5, 8-6, 14-12 all record as 7-6).

### R7. Match — best of 3 / best of 5 (S1 Rule 7)
ITF Rule 7 (verbatim): "A match can be played to the best of 3 sets (a player/team needs to
win 2 sets to win the match) or to the best of 5 sets (a player/team needs to win 3 sets to
win the match)." The match ends at the instant the winning set is completed; remaining sets
are not played (a 2-0 best-of-3 has no third set).

### R8. 10-point match tiebreak ("super tiebreak") in place of the deciding set (S1 Appendix VI §4)
ITF Appendix VI, "MATCH TIE-BREAK (10 POINTS)" (verbatim): "When the score in a match is one
set all, or two sets all in best of five sets matches, one tie-break game may be played to
decide the match. This tie-break game replaces the deciding final set. The first player/team
to win ten points shall win the match tie-break and the match provided there is a margin of
two points over the opponent(s). If necessary, the match tie-break game shall continue until
this margin is achieved."
Consequences: triggers exactly at 1-1 sets (best-of-3) or 2-2 sets (best-of-5); it REPLACES
the final set entirely (no games are played in that set); first to 10, win by 2, no cap.
Widely used in pro doubles (S5, S7).

### R9. Match-tiebreak recording — the replaced set is recorded 1-0 (S4, S6)
USTA convention (Friend at Court / USTA league materials, corroborated by search results
against S4): "The final third set score in a match tiebreak should be entered as 1-0 for the
winning team." S6 confirms the display convention: "Displayed as set score 1-0 … with the
10-point score shown in brackets if needed (e.g., 10-8)."

### R10. Scoreboard display conventions (S5, S6)
- Game points display as numerals "0", "15", "30", "40" (the word "Love" is the spoken call;
  scoreboards display 0 — S5).
- Deuce displays as 40-40 (S5).
- Advantage displays as an "Ad" marker for the player holding it, opponent stays at "40"
  (S5: "advantage appears as 'ad in' or 'ad out'" — the in/out phrasing is server-relative;
  see Convention C3 below).
- Tiebreak points display numerically: "0", "1", "2", … (S1 Rule 5b, S5).
- Server's score is called first (S1 Rule 5a) — a verbal convention tied to serve tracking,
  which is out of scope; see Convention C4.

---

## 3. Disagreements / open conventions — and the explicit picks

### C1. Two different 10-point mechanisms exist — we adopt the "replaces the deciding set" one
The ITF defines BOTH (a) Appendix VI §4 "Match tie-break (10 points)" — replaces the deciding
set entirely, played at 1-1 / 2-2 sets — and (b) Appendix VI §5 "Final set tie-break
(10 points)" — a normal deciding set is played, with a 10-point tiebreak at 6-6 (this is the
Grand Slam format since 2022, S7). **PICK: (a)**, because the task scope says "optional
10-point match tiebreak (super-tiebreak) *in place of the deciding set*" and (a) is the
standard club/doubles format (S5, S7). The `superTiebreak` config flag means (a) only. When
`superTiebreak` is false, the deciding set is an ordinary tie-break set (tiebreak at 6-6,
first to 7) — same as every other set.

### C2. How to record the match-tiebreak "set" — we record 1-0
Broadcast scorelines sometimes show the bracket form (e.g., 6-4 4-6 [10-7]); USTA records the
set as 1-0 (R9). **PICK: record it in `sets` as a 1-0 set** (`[1,0]` or `[0,1]` in [p1,p2]
order), the USTA convention, because the artifact contract's `sets` field is a list of
game-count pairs and 1-0 keeps the type uniform. The internal tiebreak points are visible
live via the `points` field while the match tiebreak is in progress.

### C3. Advantage display string — we pin "Ad"
Sources vary: "Ad in"/"Ad out" (server-relative, S5), "AD", "A", "ADV". Since the engine
tracks no server, server-relative phrasing is impossible. **PICK: the player holding
advantage displays exactly `"Ad"`, the opponent displays `"40"`.** Deuce displays as
`"40"` / `"40"`.

### C4. Score ordering — player-ordered, not server-ordered
ITF calls the server's score first (R1), but serve tracking is explicitly out of scope for
this engine. **PICK: all scoreboard arrays are `[p1, p2]` ordered, always.**

### C5. Zero display — "0", not "Love"
"Love" is the spoken call; scoreboards display numerals (S5). **PICK: `"0"`.**

### C6. Post-game/post-set display reset
No authority mandates what a scoreboard shows the instant after a game/set concludes (live
scoreboards immediately show the next game at 0-0). **PICK (for determinism/testability):
winning a game resets `points` to `["0","0"]` and increments `games`; winning a set appends
the completed set to `sets` and resets `games` to `[0,0]`; this applies uniformly, including
the match-winning set (final state: `points ["0","0"]`, `games [0,0]`, completed sets all in
`sets`, `over: true`).**

### C7. No-ad does not alter tiebreaks
The ITF files no-ad under "SCORE IN A GAME (Rule 5)" alternatives only (R3); the 7-point and
10-point tiebreaks keep their win-by-2 requirement regardless of `noAd`. (The ITF's 5-point
"short set tie-break" with a deciding point at 4-4 exists but belongs to Short Sets — out of
scope.) **PICK: `noAd` affects standard games only.**

---

## 4. Edge cases pinned (traceable to rules above)

| Edge case | Behavior | Rule |
|---|---|---|
| 6-5 in games | Set NOT over; play continues (7-5 or 6-6 next) | R4 |
| 6-6 in games | Tiebreak game begins | R4 |
| Tiebreak 6-6 (points) | Continues until 2-point margin; no cap | R5 |
| Tiebreak concluded 12-10 | Set recorded 7-6 (not 12-10) | R6 |
| Deuce → Ad → Deuce → Ad → … | Unbounded cycling allowed | R2 |
| No-ad at deuce | Next point wins the game; no Ad state ever | R3 |
| Best-of-3 at 1-1, superTiebreak on | Next "game" is the 10-point match tiebreak; no games in that set | R8 |
| Best-of-5 at 2-2, superTiebreak on | Same trigger | R8 |
| Match tiebreak 9-9 (points) | Continues until 2-point margin | R8 |
| Match tiebreak concluded 10-8 | `sets` records the deciding set as 1-0 | R9/C2 |
| Match won 2-0 (best-of-3) | No third set exists; match over | R7 |
| Point fed to a finished match | State unchanged (contract requirement, consistent with R7 — the match is decided) | R7 |
