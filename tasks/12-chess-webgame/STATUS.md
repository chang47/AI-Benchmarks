RESEARCH: spec frozen from WebDev Arena canonical prompt ('Build a game of chess', #3 most-asked) + FIDE Laws E012023; 18 checkable criteria incl. verified Fool's-mate and Loyd-stalemate test lines; spec.md/frozen-prompt.md/metadata.json/research written.
HOLDOUT: answer key complete — 18 equal-weight criteria + 4 gates; autochecks.mjs (50 checks) validated end-to-end against a chess.js-inlined reference (49 pass, 1 visual-only manual R3, all gates pass) and against a trivial placeholder (graceful all-fail); every chess sequence pre-verified move-by-move with chess.js; FREEZE_MANIFEST.json written.

BUILD r0: CLAIMED DONE=yes, self-checks 40/40 hook criteria + click-to-move PASS, 0 console errors, screenshot verified
VERIFY r0: PASS — untampered (3/3 hashes match); autochecks exit 0 (49/50, gates 4/4); independent playwright pass all-true; criterion-2 visual + a1-dark/h1-light + selection/check/mate confirmed from screenshots; passRate 1.00; fakeConvergence=false.
