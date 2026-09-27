# VTT feature inventory, dice syntax, fog/LOS, size calibration (research 2026-09-27)

> ⚠ Feature-heavy — deliberately NOT given to the spec-fusion council (Josh wants the mixed models to derive the feature
> set themselves). Use afterwards to cross-check the council's spec. Roll20 help pages were read via r.jina.ai (403 direct).
> Items marked (judgment) are the research agent's inference.

## Agent's suggested split (judgment)
- **Core:** rooms with GM/player roles; square-grid maps; tokens (move/snap/size/owner); layers (map/token/GM); GM-painted
  fog + walls/doors/vision radius with **server-side** visibility filtering; dice engine (NdX, kh/kl/dh/dl, !, !!, r/ro,
  >/< success counting, cs/cf, floor/ceil/round/abs, `[[ ]]`, `{}`, `?{}`); chat with whispers + /gmroll; initiative
  tracker; minimal 5e sheet (abilities, saves, skills, HP, AC, rollable attacks); 15 condition markers; ruler with
  selectable diagonal rules + circle/cone(~53°)/line/cube templates; handouts shared to chosen players.
- **Backlog:** audio, macros/scripting API, compendium, rollable tables, card decks, dynamic lights, explorer mode, auras,
  drawing tools, weather/effects, pop-outs.
- **Bug sites:** dice precedence, keep/drop off-by-one, explosion runaway, "d" defaults; diagonal-rule arithmetic, cone
  math; hidden/fogged info leaking to players; client-only permission checks (Roll20 2014 pattern); initiative
  tie-breaks and round counter; concurrent token moves.

## Feature inventory (Roll20 / Foundry / Owlbear Rodeo 2)
- Maps/grid/tokens: all built-in — critical.
- GM-painted fog: Roll20 yes (+Explorer); Foundry NOT built-in (v14 vote candidate); Owlbear yes (primary) — high.
- Dynamic lighting/LOS: Roll20 paid tiers (lag complaints); Foundry built-in (walls, doors, lights, vision modes); Owlbear
  official GPU extension — medium-high, many groups skip.
- Dice: all (Owlbear via extension) — critical. Chat: Roll20/Foundry built-in — high.
- Initiative: Turn Tracker / Combat Tracker / extension — high in combat.
- Character sheets: Roll20 per-system; Foundry via systems (dnd5e deep); Owlbear community only — high for 5e.
- Handouts/journal — medium. Ruler + templates: Roll20 4 diagonal modes; Foundry circle/cone/ray/rect + 6 diagonal rules
  — high in combat. Conditions/status markers — medium-high. GM layer/hidden tokens — high. Permissions (Foundry ownership
  None/Limited/Observer/Owner) — high but invisible. Audio — low-medium. Macros/scripting — medium (power users).
  Compendium — medium.
- Diagonals: Roll20 5e (every diagonal 1), Pathfinder (5/10 alternating), Manhattan (2), Euclidean (√2). Foundry
  EQUIDISTANT (default), EXACT, APPROXIMATE, RECTILINEAR, ALTERNATING_1/_2. Foundry cone default ~53°.
- Sources: https://foundryvtt.com/article/measurement/ · https://wiki.roll20.net/Ruler · https://extensions.owlbear.rodeo/ ·
  https://docs.owlbear.rodeo/docs/fog/ · https://foundryvtt.com/article/v14-patreon-vote/

## Roll20 dice syntax (https://help.roll20.net/hc/en-us/articles/360037773133-Dice-Reference, mirror wiki.roll20.net/Dice_Reference)
- `NdX` (N≥0, X≥1); `NdF` Fate (−1/0/+1); computed `(2+3)d6`, `4d(6+2)` (count rounds to nearest).
- Math `+ - * / % **`; `floor ceil round abs`; precedence parens > functions > `**` > `* / %` > `+ -`.
- Compare points: `=N` default, `>N` means ≥N, `<N` means ≤N.
- Success `3d6>3`, `10d6<4`; failures `3d6>3f1`; exploding `3d6!`, `3d6!>5`; compounding `!!`; penetrating `!p` (−1 per
  extra); keep/drop `k4`/`kl4`/`dh4` (bare `k` = keep highest, bare `d` = drop lowest); reroll `r<2`, `8d6r` (default 1s);
  reroll once `ro<2`; crit/fumble `cs>10`, `cf<3` (multiple allowed); sort `s/sa/sd`; match `m`, `mt3>4`.
- Order: explode/compound/penetrate/reroll during rolling; keep/drop/success/failure/sort after.
- Groups `{3d6+3d4+5, 2d8+4}`; single sub-roll → keep/drop per die; multiple → per sub-roll total; success likewise.
- Inline `[[ ]]`, nestable `[[3d6>[[1+3]]]]`; crit green / fumble red / both blue.
- Queries `?{Prompt}`, `?{Prompt|default}`, `?{Prompt|Label,val|…}`, same text asked once per roll.
- Resolution: abilities/macros/attributes expand (≤99 deep) → queries → inline rolls (innermost first) → dice → floor/ceil
  → math. Secret `/gmroll`, `/sr`, `/ssr`; `&{tracker}`; templates `&{template:x} {{k=v}}`; labels `2d20[Fire]`.
- Most used in 5e (judgment): `1d20+N`, `2d20kh1`/`kl1`, `NdX+M`, `4d6dl1`, `ro<2` (Great Weapon Fighting), `ro1`
  (Halfling Lucky), `3d20kh1` (Elven Accuracy), `[[ ]]`, `?{}`, `/gmroll`. Rare: `!!`, `!p`, `dF`, `mt`, `f`.
  (cybersphere.me swaps `!!`/`!p` — official page is authoritative.)

## Fog / line of sight / leak cases
- GM-painted fog (polygons/brush mask) vs dynamic lighting (wall segments + doors + one-way; per-token vision radius;
  visible = union of owned tokens' visibility polygons clipped to radius; Roll20 Explorer keeps explored areas greyscale).
- Algorithms: rays at wall endpoints ±ε or angle sweep with nearest-wall tracking (https://www.redblobgames.com/articles/visibility/,
  https://ncase.me/sight-and-light/); Foundry `ClockwiseSweepPolygon`; Owlbear dynamic fog on GPU.
- Leak cases: Roll20 2014 userscript flipped `is_gm` → edit initiative, bypass fog, draw on GM layer ("permissions … not set
  server side"), patched (https://allglorytothecryptotoad.wordpress.com/2014/04/03/roll20-exploitation/). Foundry "GM
  Secret Block" admits tech-savvy bypass (hidden token payload to players unverified). **Owlbear 1.0 sends full token state
  to all clients and hides only at render** (`src/components/konva/Token.tsx:406`). **dungeon-revealer** filters hidden
  tokens server-side correctly (`server/graphql/modules/map.ts:587`) BUT serves the unfogged map image to players
  (`GET /map/:id/map`; fog is only an overlay mask) — both patterns in one repo.

## Feature requests (creativity backlog raw material)
Sourced: foreground layer; custom compendium; scene/page organization; printable sheets; one-way walls; token lock; dark
mode; pop-out windows; token-attached templates blocked by walls; tags + search; better drawing tools; items on the map;
region-based effects; performance with dynamic lighting. Inferred: auras; pings; concentration tracking with auto-prompt on
damage; HP bars + quick damage/heal; weather/ambient effects; roll log export / session recap; encounter builder (CR/XP
budget); turn timer; elevation / multi-level maps; undo.
Sources: https://blog.roll20.net/posts/tactfully-tackling-the-top-ten-list/ · https://foundryvtt.com/article/v14-patreon-vote/

## Size calibration (source lines, shallow clones)
owlbear-rodeo-legacy ~35k (React + Konva, socket.io + WebRTC, IndexedDB, babylon dice) · dungeon-revealer ~31k (React +
Relay + three.js, GraphQL live queries over socket.io, Express, SQLite) · improved-initiative ~29k (initiative only) ·
tarrasqueapp ~15k (WIP; Next.js + Pixi + Supabase) · ogres ~12k (ClojureScript). → 15–25k ≈ "OBR 1.0 / dungeon-revealer
minus extras": maps, tokens, fog, dice, notes, sync — not full dynamic lighting + sheets + compendium.
