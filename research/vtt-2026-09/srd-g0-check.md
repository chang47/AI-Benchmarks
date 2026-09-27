# Gate G0 — SRD 5.2.1 rules check of the Task 22 VTT spec

- **Spec checked:** `design/2026-09-27-task22-vtt-spec.md`: §2.6–§2.13 in full, APP-14 and APP-30 (found along the way), §5.3 fixture, B03/B05/B07/B09/B10, and TST-05. Also `design/2026-09-27-task22-vtt-spec.holdout.md` H3.
- **Source:** `SRD_CC_v5.2.1.pdf` (364 pages), downloaded 2026-09-27 from `https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf` into `.bench-cache/srd/srd521.pdf`.
- **Extraction:** PyMuPDF. Class tables were read row by row from word coordinates.
- **Page numbers:** the PDF page index equals the printed page number on every page checked (e.g. index 13 prints "13"). All page numbers below are both.
- **Extraction failures:** none on any cited page.

## Summary

Counts are per row of the verdict table (66 rows).

| Verdict | Count |
|---|---|
| CONFIRMED | 58 |
| PARTLY | 7 |
| WRONG | 0 |
| NOT IN SRD | 1 |

Every page citation in APP-105 checks out: p.13, p.17, p.18 and pp.17–18. No number in the spec contradicts the SRD. The problems are house rules that aren't labelled as such, and omissions.

### Corrections the spec needs (every PARTLY / NOT IN SRD item)

1. **APP-86, NOT IN SRD.** The SRD has no untyped damage: *"Each instance of damage has a type, like Fire or Slashing."* (p.16).
   - Spec: "Untyped damage ignores resistances."
   - Corrected: "Untyped damage ignores resistances, vulnerabilities and immunities. **This is a house rule, documented as such in RULES.md:** the SRD gives every instance of damage a type (p.16)."
   - H3 step 4 depends on this house rule. As 60 fire, −60 would be halved to 30 on Oriel.

2. **APP-85, PARTLY.** The SRD lets the creature choose: *"you decide whether to keep the ones you have or to gain the new ones … you can have 12 or 10, not 22."* (p.18).
   - Spec: "it shall keep the higher of the two values; temporary HP never stack."
   - Corrected: "it shall keep the higher of the two values; temporary HP never stack. **Automatically keeping the higher value replaces the SRD's choice (p.18); this is documented as a simplification.**"
   - H3 step 1 (expected 6) stays valid.

3. **APP-64, Invisible row, PARTLY.** The SRD also gives Advantage on Initiative: *"Surprise. If you're Invisible when you roll Initiative, you have Advantage on the roll."* (p.184). APP-62 makes initiative a server-rolled d20 test.
   - Spec: `| Invisible | Advantage on attacks |`
   - Corrected: `| Invisible | Advantage on attacks and Initiative |`

4. **APP-64, table completeness, PARTLY.** Incapacitated gives Disadvantage on Initiative: *"Surprised. If you're Incapacitated when you roll Initiative, you have Disadvantage on the roll."* (p.184). Paralyzed, Stunned, Petrified and Unconscious all include Incapacitated (pp.186, 189, 191).
   - Add the row: `| Incapacitated (and Paralyzed, Stunned, Petrified, Unconscious, which include it) | Disadvantage on Initiative |`.
   - Alternatively, state explicitly that initiative is exempt as a house rule.
   - Grappled (*"Disadvantage on attack rolls against any target other than the grappler"*, p.182) is also a roller-side effect. It depends on the target, so either add it to "Effects that apply to the target are backlog" or name it as backlog.

5. **APP-84, healing from 0 HP, PARTLY.** Ending Unconscious leaves the creature Prone: *"Inert. You have the Incapacitated and Prone conditions … When this condition ends, you remain Prone."* (p.191).
   - Spec: "the system shall also remove Unconscious and reset both death-save tallies and Stable."
   - Corrected: "the system shall also remove Unconscious, **leave or add Prone (p.191)**, and reset both death-save tallies and Stable."
   - If you'd rather not model this, label it a house rule instead.
   - Affects the B05 sentinel "Dialog healing from 0 restores consciousness", the B09 repro ("Aldric wakes up"), and the natural 20 death save.

6. **APP-100 / APP-101 (and APP-84's "a rest" route), PARTLY.** Neither rest can start at 0 HP:
   - Short Rest: *"To start a Short Rest, you must have at least 1 Hit Point."* (p.187).
   - Long Rest: *"To start a Long Rest, you must have at least 1 Hit Point."* (p.185).
   - Add to APP-100 and APP-101: "A creature at 0 HP can't start a Short or Long Rest (SRD pp.185, 187); the system refuses it."
   - Or label resting at 0 HP a house rule.
   - As written, APP-84 counts "a rest" as a way to regain HP from 0, which the SRD doesn't allow.

7. **APP-101 "end … death saves", PARTLY.** This can never do anything under the SRD. A Long Rest needs ≥ 1 HP to start (p.185), and the tallies already reset to zero whenever HP is regained (p.17).
   - Corrected: "end temporary HP (p.18) and concentration (sleeping is Unconscious → Incapacitated, pp.185, 179); death-save tallies are already 0 because a Long Rest requires at least 1 HP (p.185)."

8. **APP-30 (§2.4, found along the way), PARTLY.** A Tiny creature's space is a quarter square: *"Tiny | 2½ by 2½ feet | 4 per square"* (p.14). Large 2×2, Huge 3×3 and Gargantuan 4×4 are exact.
   - Spec: "Tiny/Small/Medium 1 cell".
   - Corrected: "Tiny/Small/Medium 1 cell (Tiny is drawn as one cell, a simplification of the SRD's 4 per square, p.14)".

## Verdict table

| # | Spec requirement + claim | Verdict | SRD quote (short) | PDF page |
|---|---|---|---|---|
| 1 | APP-61: PB = 2 + floor((level − 1) / 4) | CONFIRMED | Table: "Up to 4 +2 / 5–8 +3 / 9–12 +4 / 13–16 +5 / 17–20 +6". Character Advancement: L1–4 +2, L5 +3 … L17 +6. The formula reproduces every row for levels 1–20. | 8, 23 |
| 2 | TST-05: PB at levels 4, 5, 16, 17 | CONFIRMED | Character Advancement: 4 → +2, 5 → +3, 16 → +5, 17 → +6 | 23 |
| 3 | APP-61: expertise doubles proficiency | CONFIRMED (note) | "your Proficiency Bonus is doubled for that check unless the bonus is doubled by another feature"; "it can be multiplied only once". Expertise applies only to ability checks with a proficient skill, never saves. | 182, 8 |
| 4 | APP-61: passive Perception derived | CONFIRMED (gap) | "Passive Perception = 10 + Wisdom (Perception) check modifier"; "If the creature has Advantage on such checks, increase the score by 5 … Disadvantage … decrease the score by 5." The spec doesn't say whether Poisoned/Frightened (Disadvantage on checks) apply −5. | 22, 186 |
| 5 | APP-61: spell save DC | CONFIRMED | "Spell save DC = 8 + spellcasting ability modifier + Proficiency Bonus" | 23, 106 |
| 6 | APP-61: spell attack bonus | CONFIRMED | "Spell attack bonus = spellcasting ability modifier + Proficiency Bonus" | 23, 106 |
| 7 | APP-61: full-caster slot table | CONFIRMED | Bard, Cleric, Druid, Sorcerer and Wizard tables are identical, as is the Multiclass Spellcaster table. Rows below. | 31, 36, 41, 65, 77; 26 |
| 8 | APP-61: half-caster table; Paladin/Ranger get slots at level 1 | CONFIRMED | Paladin L1 row: "Lay On Hands, Spellcasting, Weapon Mastery … 2" slots; the Ranger table is identical. Rows below. | 53, 58 |
| 9 | APP-61/APP-100: Warlock Pact Magic table; recovers on Short Rest | CONFIRMED | "You regain all expended Pact Magic spell slots when you finish a Short or Long Rest." Rows below. | 71 |
| 10 | APP-61: cantrip damage dice at 5 / 11 / 17 | CONFIRMED (note) | e.g. Acid Splash: "The damage increases by 1d6 when you reach levels 5 (2d6), 11 (3d6), and 17 (4d6)." Upgrades are per spell. Eldritch Blast gains **beams**, not dice ("two beams at level 5, three … 11, four … 17"). | 107, 127 |
| 11 | APP-63: natural 20 hits and is a Critical Hit | CONFIRMED | "the attack hits regardless of any modifiers or the target's AC. This is called a Critical Hit" | 7, 179 |
| 12 | APP-63 / TST-05: crit rolls the dice twice, modifiers once | CONFIRMED | "Roll the attack's damage dice twice, add them together, and add any relevant modifiers as normal." | 16, 179 |
| 13 | APP-63: natural 1 always misses | CONFIRMED | "the attack misses regardless of any modifiers or the target's AC" | 7 |
| 14 | APP-64: advantage and disadvantage cancel regardless of count | CONFIRMED | "This is true even if multiple circumstances impose Disadvantage and only one grants Advantage or vice versa." | 8 (also 176, 181) |
| 15 | APP-64 Poisoned: Disadvantage on attacks and ability checks | CONFIRMED | "You have Disadvantage on attack rolls and ability checks." | 186 |
| 16 | APP-64 Blinded: Disadvantage on attacks | CONFIRMED (note) | "your attack rolls have Disadvantage". The SRD also auto-fails "any ability check that requires sight", which can't be automated. | 177 |
| 17 | APP-64 Prone: Disadvantage on attacks | CONFIRMED | "You have Disadvantage on attack rolls." | 186 |
| 18 | APP-64 Restrained: Disadvantage on attacks and Dex saves | CONFIRMED | "your attack rolls have Disadvantage … Disadvantage on Dexterity saving throws" | 187 |
| 19 | APP-64 Frightened: Disadvantage on attacks and checks (assumes source in sight) | CONFIRMED | "Disadvantage on ability checks and attack rolls while the source of fear is within line of sight". The assumption is disclosed. | 182 |
| 20 | APP-64 Invisible: Advantage on attacks | **PARTLY** | "your attack rolls have Advantage" ✓, but also "If you're Invisible when you roll Initiative, you have Advantage on the roll", which is missing. | 184 |
| 21 | APP-64 Exhaustion: −2 × level on every d20 test | CONFIRMED | "When you make a D20 Test, the roll is reduced by 2 times your Exhaustion level." | 181 |
| 22 | APP-64: Paralyzed, Stunned, Petrified, Unconscious auto-fail Str/Dex saves | CONFIRMED | Each entry: "You automatically fail Strength and Dexterity saving throws." | 186, 189, 191 |
| 23 | APP-64: table covers the roller's own d20 tests | **PARTLY** | Omits Incapacitated's "Disadvantage on the roll" for Initiative (also inherited by Paralyzed, Stunned, Petrified, Unconscious), and Grappled's attack Disadvantage. | 184, 182 |
| 24 | APP-65: slot of at least the spell's level | CONFIRMED (gap) | "you expend a slot of that spell's level or higher". Gaps: Pact slots are one fixed level ("you cast it as a level 3 spell", p.71), and a Ritual "doesn't expend a spell slot" (p.104). | 104, 71 |
| 25 | APP-65: a new concentration spell ends the previous one | CONFIRMED | "You lose Concentration on an effect the moment you start casting a spell that requires Concentration" | 179 |
| 26 | APP-80: immunity makes damage 0 | CONFIRMED | "Immunity to a damage type means you don't take damage of that type" | 17 |
| 27 | APP-80 / TST-05: resistance halves, rounding down, before vulnerability | CONFIRMED | "Resistance is applied second; and Vulnerability is applied third"; "halved for the creature's Resistance (and rounded down to 11), then doubled". The SRD's first step (other adjustments) doesn't arise in the VTT. | 17 |
| 28 | APP-80: temp HP absorb damage first | CONFIRMED | "those points are lost first, and any leftover damage carries over to your Hit Points" | 18 |
| 29 | APP-80: HP floor 0 | CONFIRMED | "down to 0, which is the lowest Hit Points can go" | 16 (also 183) |
| 30 | APP-81: 0 HP → Unconscious and death saves | CONFIRMED | "you have the Unconscious condition … until you regain any Hit Points, and you now face making Death Saving Throws" | 17 |
| 31 | APP-81 / TST-05: dies if leftover ≥ HP max | CONFIRMED | "the character dies if the remainder equals or exceeds their Hit Point maximum" | 17 |
| 32 | APP-81: monster at 0 HP shown as Down | CONFIRMED (display) | "A monster dies the instant it drops to 0 Hit Points, although a Game Master can ignore this rule". "Down" is a display label compatible with either reading. | 17 |
| 33 | APP-82: damage at 0 HP = 1 failure, 2 on a crit; dies if ≥ HP max | CONFIRMED | "you suffer a Death Saving Throw failure. If the damage is from a Critical Hit, you suffer two failures instead. If the damage equals or exceeds your Hit Point maximum, you die." | 18 |
| 34 | APP-83: ≥ 10 success, < 10 failure | CONFIRMED | "If the roll is 10 or higher, you succeed. Otherwise, you fail." | 17 |
| 35 | APP-83: natural 1 = two failures; natural 20 = regain 1 HP | CONFIRMED | "When you roll a 1 … you suffer two failures. If you roll a 20 on the d20, you regain 1 Hit Point." Waking follows from "Unconscious … until you regain any Hit Points" (p.17). | 18 |
| 36 | APP-83: 3 successes = Stable, 3 failures = dead | CONFIRMED | "On your third success, you become Stable … On your third failure, you die." | 17 |
| 37 | APP-83 / TST-05: tallies reset on becoming Stable | CONFIRMED | "The number of both is reset to zero when you regain any Hit Points or become Stable." | 17 |
| 38 | APP-84: HP capped at max | CONFIRMED | "Your Hit Points can't exceed your Hit Point maximum, so any Hit Points regained in excess of the maximum are lost." | 17 |
| 39 | APP-84 / B09: regaining HP from 0 removes Unconscious, resets tallies and Stable | CONFIRMED | Reset: p.17 sentence above. Stable: "has 0 Hit Points but isn't required to make Death Saving Throws" (p.188), so HP > 0 ends it. | 17, 188 |
| 40 | APP-84: resulting conditions after waking | **PARTLY** | "When this condition ends, you remain Prone." The spec only says "remove Unconscious". | 191 |
| 41 | APP-84 / B09 sentinel: a dead PC can't regain HP | CONFIRMED | "A dead creature has no Hit Points and can't regain them unless it is first revived by magic" | 180 |
| 42 | APP-85 / TST-05: temp HP don't stack; keep the higher | **PARTLY** | "can't be added together … you decide whether to keep the ones you have or to gain the new ones" | 18 |
| 43 | APP-86: untyped damage ignores resistances | **NOT IN SRD** | "Each instance of damage has a type" | 16 |
| 44 | APP-87 / TST-05: Con save DC = max(10, floor(dmg / 2)), cap 30 | CONFIRMED | "The DC equals 10 or half the damage taken (round down), whichever number is higher, up to a maximum DC of 30." | 179 |
| 45 | APP-87: ends when Incapacitated (or a condition that includes it) | CONFIRMED (gap) | "Your Concentration ends if you have the Incapacitated condition or you die." Incapacitated: "Your Concentration is broken." Death (massive damage, exhaustion 6) isn't listed in APP-87. | 179, 184 |
| 46 | APP-88 / APP-72: 15 conditions | CONFIRMED | Blinded, Charmed, Deafened, Exhaustion, Frightened, Grappled, Incapacitated, Invisible, Paralyzed, Petrified, Poisoned, Prone, Restrained, Stunned, Unconscious | 179 |
| 47 | APP-88: Exhaustion 6 = death | CONFIRMED | "You die if your Exhaustion level is 6." | 181 |
| 48 | APP-100: each hit die heals roll + Con, minimum 1; one at a time | CONFIRMED | "roll the die and add your Constitution modifier … (minimum of 1 Hit Point). You can decide to spend an additional Hit Point Die after each roll." | 187 |
| 49 | APP-100 / APP-101: resting at 0 HP (unstated) | **PARTLY** | "To start a Short Rest, you must have at least 1 Hit Point." / "To start a Long Rest, you must have at least 1 Hit Point." | 187, 185 |
| 50 | APP-101: Long Rest restores all HP and ALL hit dice | CONFIRMED | "You regain all lost Hit Points and all spent Hit Point Dice." | 185 |
| 51 | APP-101: Long Rest restores all spell slots | CONFIRMED | "Finishing a Long Rest restores any expended spell slots." Classes: "You regain all expended slots when you finish a Long Rest." | 104, 54, 78 |
| 52 | APP-101: Long Rest removes one exhaustion level | CONFIRMED | "Exhaustion Reduced. If you have the Exhaustion condition, its level decreases by 1." | 185, 181 |
| 53 | APP-101: temp HP end on a Long Rest (spec cites p.18) | CONFIRMED | "Temporary Hit Points last until they're depleted or you finish a Long Rest" | 18 |
| 54 | APP-101: Long Rest ends concentration | CONFIRMED (derived) | "During sleep, you have the Unconscious condition" → Incapacitated → Concentration ends | 185, 191, 179 |
| 55 | APP-101: Long Rest ends death saves | **PARTLY** | Can never do anything: a Long Rest needs ≥ 1 HP (p.185), and the tallies reset whenever HP is regained (p.17). | 185, 17 |
| 56 | APP-91: tie-break is a house rule | CONFIRMED (label honest) | "If a tie occurs, the GM decides the order among tied monsters, and the players decide the order among tied characters. The GM decides … between a monster and a player character." | 13 |
| 57 | APP-45: 5 ft squares; a diagonal costs one square (cites p.13) | CONFIRMED | "Each square represents 5 feet." "It costs 1 square of movement to enter an unoccupied square that's adjacent … (orthogonally or diagonally adjacent)." Ranges: "Count by the shortest route." | 13 |
| 58 | APP-70: Goblin Warrior, a Fey | CONFIRMED | "Goblin Warrior / Small Fey (Goblinoid), Chaotic Neutral / AC 15 / HP 10 (3d6) / CR 1/4 (XP 50; PB +2)" | 290 |
| 59 | APP-70: Bandit | CONFIRMED | "Bandit / Medium or Small Humanoid, Neutral / AC 12 / HP 11 (2d8 + 2) / CR 1/8 (XP 25; PB +2)" | 261 |
| 60 | APP-70: Wolf | CONFIRMED | "Wolf / Medium Beast, Unaligned / AC 12 / HP 11 (2d8 + 2) / Speed 40 ft. / CR 1/4 (XP 50; PB +2)" | 364 |
| 61 | APP-105: the four cited pages | CONFIRMED (precision) | p.13 diagonal ✓; p.17 order and rounding ✓; p.18 temp HP on Long Rest ✓. For "pp.17–18": the reset sentence itself is on **p.17**, while natural 1/20 and damage at 0 are on p.18. | 13, 17, 18 |
| 62 | APP-14: Bloodied at ≤ half HP | CONFIRMED | "If you have half your Hit Points or fewer, you're Bloodied" | 16, 178 |
| 63 | APP-30 (§2.4): Tiny = 1 cell; Large 2×2, Huge 3×3, Gargantuan 4×4 | **PARTLY** | "Tiny 2½ by 2½ feet 4 per square … Large … 4 squares (2 by 2) … Huge … 9 squares (3 by 3) … Gargantuan … 16 squares (4 by 4)" | 14 |
| 64 | H3 steps 1–8 arithmetic | CONFIRMED | 19 fire → 9 (p.17 round down); temp 6 absorbs → HP 39 (p.18); DC 10 (p.179); +5 = PB +3 at L5 (p.23) + Con +2; leftover 21 < 42 (p.17); natural 1 → 2 failures, crit at 0 → +2, dead at ≥ 3 (pp.17–18); dead can't heal (p.180); tallies reset (p.17); +100 capped at 42 (p.17); 2 dice × max(1, 1 + 2) = 6 → 38 (p.187). Steps 1 and 4 rely on the APP-85 and APP-86 house rules (#42, #43). | 16–18, 23, 179, 180, 187 |
| 65 | §5.3: Aldric, level 3 cleric, max 24 HP | CONFIRMED (consistent) | Level 1: "8 + Con. modifier"; per level: "5 + Con. modifier". 8 + 2 + 2 × (5 + 2) = 24 with Con +2. | 22, 23 |
| 66 | B05 sentinel: −8 with 5 temp → temp 0, HP −3 | CONFIRMED | "if you have 5 Temporary Hit Points and take 7 damage, you lose those points and then lose 2 Hit Points" (same rule) | 18 |

**Count check** (66 rows):
- PARTLY (7): #20, #23, #40, #42, #49, #55, #63.
- NOT IN SRD (1): #43.
- WRONG: 0.
- CONFIRMED: the other 58, some with a note or gap.

### Slot tables as printed (so RULES.md and the tests can copy them)

**Full caster** (Bard p.31, Cleric p.36, Druid p.41, Sorcerer p.65, Wizard p.77, Multiclass p.26 — identical). Slot levels 1–9 per character level:

```
1: 2            6: 4 3 3            11: 4 3 3 3 2 1        16: 4 3 3 3 2 1 1 1
2: 3            7: 4 3 3 1          12: 4 3 3 3 2 1        17: 4 3 3 3 2 1 1 1 1
3: 4 2          8: 4 3 3 2          13: 4 3 3 3 2 1 1      18: 4 3 3 3 3 1 1 1 1
4: 4 3          9: 4 3 3 3 1        14: 4 3 3 3 2 1 1      19: 4 3 3 3 3 2 1 1 1
5: 4 3 2       10: 4 3 3 3 2        15: 4 3 3 3 2 1 1 1    20: 4 3 3 3 3 2 2 1 1
```

**Half caster** (Paladin p.53, Ranger p.58 — identical). Slot levels 1–5:

```
1–2: 2      5–6: 4 2      9–10: 4 3 2      13–14: 4 3 3 1      17–18: 4 3 3 3 1
3–4: 3      7–8: 4 3     11–12: 4 3 3      15–16: 4 3 3 2      19–20: 4 3 3 3 2
```

**Pact Magic** (Warlock p.71). Slots × slot level:

| Levels | Slots × slot level |
|---|---|
| 1 | 1 × L1 |
| 2 | 2 × L1 |
| 3–4 | 2 × L2 |
| 5–6 | 2 × L3 |
| 7–8 | 2 × L4 |
| 9–10 | 2 × L5 |
| 11–16 | 3 × L5 |
| 17–20 | 4 × L5 |

## Rules the spec should cite but doesn't

These matter for the planted bugs, the on-camera repros or the hidden tests.

1. **B09 / APP-82: taking damage while Stable.** *"If the creature takes damage, it stops being Stable and starts making Death Saving Throws again."* (p.18).
   - APP-82 is silent about Stable.
   - B09 F2P 2 ("a later drop to 0 starts fresh") and the "Three successes make the PC Stable" sentinel both touch this state.
   - Cite p.18 and say whether damage while Stable also adds a failure. The SRD's damage-at-0 rule (p.18) says it does.
2. **B09 / B05 / APP-84: waking leaves the creature Prone** (p.191; correction 5). This affects what the "after" state shows on camera for Aldric.
3. **APP-83: death saves are D20 Tests.** Exhaustion's *"When you make a D20 Test, the roll is reduced by 2 times your Exhaustion level"* (p.181) applies to them, because a death save is a saving throw (p.17: "Unlike other saving throws…"; D20 Test = checks, attacks and saves, p.180).
   - State whether the 10 threshold uses the reduced roll. Natural 1 and 20 are unaffected.
   - Otherwise implementations will split on this and hidden tests could flake by design.
4. **APP-87: death ends concentration.** *"Your Concentration ends if you have the Incapacitated condition or you die."* (p.179). Add "or dies", which covers massive damage and exhaustion 6. A PC reduced to 0 HP is covered anyway, since Unconscious includes Incapacitated.
5. **APP-65: ritual and Pact casting.**
   - A Ritual *"doesn't expend a spell slot"* (p.104). APP-72 includes ritual spells, but APP-65 refuses a cast when no slots remain.
   - Pact slots are all one level (p.71), so "the chosen level" is fixed for a Warlock.
   - Say which behaviour applies in each case.
6. **APP-61: passive Perception ±5** for Advantage or Disadvantage on Perception checks (p.186). Say whether Poisoned/Frightened lower the derived passive score. The SRD says they should.
7. **B03 / B07 / APP-91: identical monsters share one initiative roll.** *"For a group of identical creatures, the GM makes a single roll, so each member of the group has the same Initiative."* (p.13). The fixture has three hidden Goblin Warriors. If they join a tracker with one shared roll, ties among identical monsters become the normal case, and the house-rule tie-break (modifier, then name) decides them. The B03/B07 sentinels already cover the documented tie-break for rolled values. The SRD's own tie rule (GM/players decide, p.13) confirms the "house rule" label is honest.
8. **APP-100/101: rests can't start at 0 HP** (pp.185, 187; correction 6). This is relevant to the H3 negative clause, which lists "rest" as a route that must never leave stale marks.
9. **APP-105: missing page numbers for the creature-name citation.** Goblin Warrior p.290, Bandit p.261, Wolf p.364.
10. **B10:** no SRD rule applies. Dice notation (`d20`, `d%`, `kh`/`dl`) is app syntax. B03 and B07 are tracker mechanics with no SRD rule beyond p.13's ordering ("from highest to lowest Initiative").

## Residual risks

- Cited verdicts depend on PyMuPDF's text layer. Class tables were rebuilt from word coordinates. Every row was cross-checked across the five identical full-caster tables and the two identical half-caster tables, so a transcription error would have to repeat identically in 5 (or 2) places.
- I checked §2.6–§2.13 in full plus the named items. Other spec sections weren't audited line by line; I grepped them for rules keywords only.
