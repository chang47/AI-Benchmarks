# D&D SRD data + licensing (research 2026-09-27)

_Research-agent report; the agent downloaded and read the SRD 5.1 and 5.2.1 PDFs directly. Not legal advice._

## Verdict
Target **SRD 5.2.1 (2024 rules)** — CC-BY-4.0 only (no OGL), maintained by WotC. Vendor a small content subset from
**5e-bits 2024 JSON**; hand-write the small rules tables (~100 lines of JSON, checked against the PDF) since they must be
exactly right as the bug-free reference.

## Licensing
- SRD 5.1 (2014 rules): OGL 1.0a **or** CC-BY-4.0. SRD 5.2 / 5.2.1 (2024 rules): CC-BY-4.0 only
  (https://www.dndbeyond.com/srd, updated 2026-03-02). 5.2.1 = 5.2 + 15 magic items + corrections.
- **Required attribution (5.2.1)** (https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf):
  > This work includes material from the System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards of the Coast LLC,
  > available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0
  > International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.
- **Required attribution (5.1)** (https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf):
  > This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") by Wizards of the Coast LLC and
  > available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative
  > Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode.
- Both: include no other attribution to WotC; may say "compatible with fifth edition" / "5E compatible".
- **Avoid (Product Identity, from SRD-OGL 5.1):** Dungeons & Dragons, D&D, Player's Handbook, Dungeon Master, Monster Manual,
  d20 System, Wizards of the Coast; Forgotten Realms, Faerûn, Underdark, Red Wizard of Thay, Sigil, Lady of Pain, named
  planes; beholder, gauth, carrion crawler, tanar'ri, baatezu, displacer beast, githyanki, githzerai, mind flayer/illithid,
  umber hulk, yuan-ti; proper-named spells/items (Tasha's, Bigby's → SRD uses generic names). 5.2 also omits Artificer,
  Aasimar, Beholder, Strahd, Orcus, Tiamat (a few stray mentions remain in SRD text — scrub).
- Uncertain: CC-BY covers text, not trademarks. Don't use "D&D" in the app name/branding; "5E-compatible VTT" is safe.
  Narration saying "a D&D-style tabletop" is probably nominative use (unverified). WotC Fan Content Policy not researched.

## Datasets
- **5e-bits** (now `packages/5e-database` in https://github.com/5e-bits/5e-srd-api; old repo archived 2026-09-23). Repo MIT;
  README still says OGL (stale for 2024 data — add CC attribution ourselves). Flat JSON `src/2024/en/5e-SRD-*.json`.
  2024: 341 monsters, 339 spells, 12 classes, 287 level rows (spell_slots_level_N, prof_bonus), 15 conditions, 18 skills,
  182 equipment, weapon mastery. Agent spot-checked slots/PB/warlock/exhaustion against the PDF: correct. Caveats: 2024
  monsters only finalized 2026-09-22 (v5.12.0, lightly tested); strip `image` (art hosted by the API, license unclear) and
  `url` fields.
- **Open5e** (https://github.com/open5e/open5e-api): "Modified MIT" excluding SRD content + art; art is CC-BY-NC-4.0 (unsafe
  for a monetized channel). Django fixtures, heavily normalized, mixes in third-party publishers — harder to subset. Skip.

## Rules tables (both SRDs unless noted)
- Proficiency bonus: `2 + floor((level − 1) / 4)` (+2 L1–4 … +6 L17–20).
- Hit die: Barbarian d12; Fighter/Paladin/Ranger d10; Bard/Cleric/Druid/Monk/Rogue/Warlock d8; Sorcerer/Wizard d6.
- Full caster slots (L1–9 by caster level): 1: 2 · 2: 3 · 3: 4,2 · 4: 4,3 · 5: 4,3,2 · 6: 4,3,3 · 7: 4,3,3,1 · 8: 4,3,3,2 ·
  9: 4,3,3,3,1 · 10: 4,3,3,3,2 · 11–12: 4,3,3,3,2,1 · 13–14: +1 (7th) · 15–16: +1 (8th) · 17: 4,3,3,3,2,1,1,1,1 ·
  18: 4,3,3,3,3,1,1,1,1 · 19: 4,3,3,3,3,2,1,1,1 · 20: 4,3,3,3,3,2,2,1,1.
- Half caster (Paladin/Ranger), 2024: 1: 2 · 2: 2 · 3–4: 3 · 5–6: 4,2 · 7–8: 4,3 · 9–10: 4,3,2 · 11–12: 4,3,3 ·
  13–14: 4,3,3,1 · 15–16: 4,3,3,2 · 17–18: 4,3,3,3,1 · 19–20: 4,3,3,3,2. (2014: no slots at L1.) Multiclass half-caster
  levels round UP in 2024, DOWN in 2014.
- Third casters: not in either SRD (only Champion/Thief subclasses) — leave out.
- Warlock Pact Magic: 1: 1×L1 · 2: 2×L1 · 3–4: 2×L2 · 5–6: 2×L3 · 7–8: 2×L4 · 9–10: 2×L5 · 11–16: 3×L5 · 17–20: 4×L5.
  Recover on a Short Rest.
- Conditions (15): Blinded, Charmed, Deafened, Exhaustion, Frightened, Grappled, Incapacitated, Invisible, Paralyzed,
  Petrified, Poisoned, Prone, Restrained, Stunned, Unconscious. (2024 text changes, e.g. Incapacitated breaks Concentration.)
- Skills: STR Athletics · DEX Acrobatics, Sleight of Hand, Stealth · INT Arcana, History, Investigation, Nature, Religion ·
  WIS Animal Handling, Insight, Medicine, Perception, Survival · CHA Deception, Intimidation, Performance, Persuasion.
- 2024 changes that matter for a sheet: Exhaustion = −2 per level to every d20 Test and −5 ft Speed per level, death at 6,
  Long Rest removes 1 level. Long Rest restores ALL Hit Point Dice (2014: half). Short Rest: spend HD at die + CON each, min 1
  HP per die (2024), interrupted by rolling Initiative / casting a non-cantrip / taking damage. Casters "prepare" spells.
  Monster stat blocks add Initiative bonus.

## Suggested content subset (agent's pick; < ~200 KB)
~25–30 monsters CR 0–10 (several types, some multiattack/legendary, some condition immunities); ~30–40 spells (mostly
cantrips–3rd; concentration, ritual, attack-roll and saving-throw types); all 12 classes' core data; 15 conditions;
18 skills. Hygiene: strip image/url, attribution in README + `data/LICENSE-SRD.md`, brand "5E-compatible", grep for the
Product Identity list before publishing.
