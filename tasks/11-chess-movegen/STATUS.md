RESEARCH: spec + holdout frozen — 6 CPW positions (+mirrored Pos4), 30 graded (fen,depth) pairs totaling ~16.5M nodes under a 120s bound, FIDE E012023 + CPW Perft cited; no implementation or tests written.
HOLDOUT: answer key frozen - 44 vitest tests (30 canonical perft pairs verbatim from RESEARCH.md + FIDE legality cases), all FENs/counts cross-validated vs chess.js, per-pair + 120s total time bounds, FREEZE_MANIFEST.json sha256-pinned.

BUILD r0: 0x88 make/unmake movegen + perft — all 6 CPW positions + Pos4 mirror match canonical counts (initial d5=4865609, Kiwipete d4=4085603); ~12M nodes/sec.
BUILD r0: CLAIMED DONE=yes, self-checks 54/54 vitest passing (30 canonical perft pairs to d5 + 24 legality/notation/EP-pin/castle-through-check/promotion/mate/stalemate cases), perf ~45x over target.

VERIFY r0: PASS — tamper check clean (5/5 sha256 match), holdout 44/44 passed (~5s, under 120s bound), fakeConvergence=false.
