# Battle of Cannae (216 BC) — research brief for task 20

_Compiled 2026-09-27 by a research sub-agent from Polybius 3.107–118 (Shuckburgh), Livy 22.44–52 (Foster, Loeb),
Goldsworthy "Cannae", Hanson, Wikipedia. Tags: [P] Polybius, [L] Livy, [G] Goldsworthy, [W] Wikipedia,
[M] modelling suggestion (not attested). The sim's numbers are chosen from these ranges; see ../spec.md._

## Setting
- River Aufidus (Ofanto). Battle on the right (south) bank per Kromayer / Connolly / Goldsworthy (disputed).
- Roman right and Carthaginian left rest on the river [P 3.113; L 22.47]; Roman left towards the hill/town of Cannae [G].
- Romans face south, Carthaginians north [P 3.113–114; L 22.46].
- Frontage ≈ 2 km [G]: 360 m Roman cavalry, ≈1,050 m infantry, ≈540 m allied cavalry (cavalry ~40 m deep).
- Sun neutral [P 3.114]; the Volturnus wind blew dust into Roman faces [L 22.46] (Polybius silent).
- Fighting from mid-morning until dark [P, Hanson].

## Order of battle (west → east)
| Side | Contingent | Men (sim) | Range in sources | Notes |
|---|---|---|---|---|
| Rome | Roman cavalry (Paullus) | 2,400 | 2,400 | by the river |
| Rome | Legions + allied heavy infantry | 55,000 | ~50k on field [G] | maniples "several times deeper than their front" [P 3.113], ~50–70 ranks |
| Rome | Allied cavalry (Varro) | 3,600 | 3,600–4,000 | left wing |
| Rome | Velites | 15,000 | 15–20k | ahead of the line |
| Carthage | Spanish & Gallic cavalry (Hasdrubal) | 6,500 | 6–7k [G] | river flank, 2–3:1 over the Roman cavalry |
| Carthage | Libyans ×2 blocks | 2 × 5,000 | 8–10k total | Roman arms taken as spoils [P 3.114]; drawn back behind the crescent's ends [G, L 22.47] |
| Carthage | Gauls & Spaniards (Hannibal, Mago) | 18,000 + 5,000 | Gauls 16–21k, Spaniards 3–6k | forward crescent, thinning towards the ends [P 3.113]; companies alternate [P 3.114] |
| Carthage | Numidian light cavalry (Hanno/Maharbal) | 3,500 | 3–4k | right wing |
| Carthage | Balearic slingers & light troops | 8,000 | ~8k | ahead of the line |

## Sequence (sources agree on order; durations are [M])
1. Skirmish of light troops, indecisive [P 3.115; L 22.47].
2. River-flank cavalry: head-on melee (no room to go round) [L 22.47]; Roman cavalry destroyed/pursued [P 3.115].
3. Numidians skirmish and pin the allied cavalry without much harm [P 3.116].
4. Roman infantry hit the crescent apex first; the Celts/Spaniards give ground; the line becomes concave;
   Romans crowd inward towards the centre, deepening further [P 3.115; L 22.47].
5. Hasdrubal rides behind the Roman army to the allied cavalry, which breaks as he approaches; Numidians pursue [P 3.116].
6. The Libyans face inward (a facing movement, not a wheel [G]) and charge the Roman flanks [P 3.115].
7. Hasdrubal charges the Roman rear repeatedly [P 3.116] → encirclement; "the circle becoming more and more contracted".
8. Varro escapes with 50–70 riders [P 3.117; L 22.49]; Paullus dies [P 3.116].

## Outcome
- Roman dead on the field ~45–70k (sim target ≈ 48k); Carthaginian dead 5,700 [P] – 8,000 [L] (sim target ≈ 6k),
  of which ~4,000 Celts [P 3.117] — i.e. most Carthaginian losses fall on the Gallic/Spanish centre.
- Loss ratio roughly 8:1 – 12:1 against Rome, despite Rome outnumbering Carthage ≈1.4–1.6:1 in infantry.

## Beats a grader can test (source-attested)
1. Roman cavalry on the river flank routs before the Libyans engage the Roman infantry.
2. The Carthaginian centre starts convex (midpoint ahead of its ends) and becomes concave before the encirclement.
3. The Gallic/Spanish centre never fully breaks.
4. The Libyans start out of contact and turn ~90° to face inward.
5. The allied cavalry routs only after Hasdrubal's cavalry reaches it.
6. Hasdrubal's cavalry passes behind (north of) the Roman infantry's rear.
7. The Roman infantry ends in contact with enemies on all four sides.
8. Roman infantry strength keeps falling after encirclement.
9. Carthaginian dead ≤ 20% of Roman dead.
10. Most Carthaginian dead are Gallic/Spanish infantry.

## Sources
- Polybius 3.107–118: https://www.gutenberg.org/cache/epub/44125/pg44125.txt
- Livy 22.44–52: https://www.perseus.tufts.edu/hopper/text?doc=Perseus:text:1999.02.0152:book%3D22:chapter%3D46
- Goldsworthy, Cannae: https://erenow.org/ww/cannae-fields-of-battle/13.php
- Location debate: http://thethirstygargoyle.blogspot.com/2013/07/armageddon-on-aufidus-locating-battle.html
- https://en.wikipedia.org/wiki/Battle_of_Cannae · https://historynet.com/cannae/
