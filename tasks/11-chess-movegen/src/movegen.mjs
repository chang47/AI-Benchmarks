// Chess legal-move generator with perft (Task 11).
//
// Plain modern JavaScript, ES module, no dependencies. Board is a 0x88
// mailbox (Int8Array[128]); legality is enforced by make/unmake + an
// "is my king attacked?" test, which correctly handles pins, checks,
// king-into-check, the retreat-along-the-ray case, and en-passant self-check
// without any dedicated pin logic.
//
// Rules authority: FIDE Laws of Chess (E012023), Art. 3.1-3.9.
// Perft authority: https://www.chessprogramming.org/Perft

// ---------------------------------------------------------------------------
// Piece encoding
//   0 = empty
//   White: P=1 N=2 B=3 R=4 Q=5 K=6
//   Black: p=7 n=8 b=9 r=10 q=11 k=12
// color(piece): piece<=6 -> white(0), else black(1)
// type(piece):  piece<=6 ? piece : piece-6   (1..6)
// ---------------------------------------------------------------------------

const EMPTY = 0;

// 0x88 movement offsets (one rank = +/-16, one file = +/-1).
const KNIGHT_OFFSETS = [33, 31, -31, -33, 18, 14, -14, -18];
const KING_OFFSETS = [16, -16, 1, -1, 17, 15, -15, -17];
const BISHOP_DIRS = [17, 15, -15, -17];
const ROOK_DIRS = [16, -16, 1, -1];

// Castling-rights bits: WK=1 WQ=2 BK=4 BQ=8.
// castleMask[sq] = the bits that SURVIVE when a piece moves from/to sq.
const castleMask = new Int8Array(128).fill(15);
castleMask[0] = 15 & ~2; //  a1 -> lose WQ
castleMask[4] = 15 & ~3; //  e1 -> lose WK|WQ
castleMask[7] = 15 & ~1; //  h1 -> lose WK
castleMask[112] = 15 & ~8; // a8 -> lose BQ
castleMask[116] = 15 & ~12; // e8 -> lose BK|BQ
castleMask[119] = 15 & ~4; // h8 -> lose BK

// Move packing: from(0-7) | to(8-15) | promo(16-19) | flag(20-23).
// promo: 0 none, else promoted TYPE (2=N 3=B 4=R 5=Q).
// flag: 0 normal, 1 double-push, 2 en-passant, 3 castle.
function mv(from, to, promo, flag) {
  return from | (to << 8) | (promo << 16) | (flag << 20);
}

const PROMO_CHAR = { 2: "n", 3: "b", 4: "r", 5: "q" };

function charToPiece(ch) {
  switch (ch) {
    case "P": return 1;
    case "N": return 2;
    case "B": return 3;
    case "R": return 4;
    case "Q": return 5;
    case "K": return 6;
    case "p": return 7;
    case "n": return 8;
    case "b": return 9;
    case "r": return 10;
    case "q": return 11;
    case "k": return 12;
    default: return 0;
  }
}

function sqToStr(sq) {
  const file = sq & 7;
  const rank = sq >> 4;
  return String.fromCharCode(97 + file) + String.fromCharCode(49 + rank);
}

// ---------------------------------------------------------------------------
// parseFen
// ---------------------------------------------------------------------------

export function parseFen(fen) {
  const parts = String(fen).trim().split(/\s+/);
  const placement = parts[0];
  const turnStr = parts[1] || "w";
  const castleStr = parts[2] || "-";
  const epStr = parts[3] || "-";
  const halfmove = parts.length >= 5 ? parseInt(parts[4], 10) : 0;
  const fullmove = parts.length >= 6 ? parseInt(parts[5], 10) : 1;

  const board = new Int8Array(128);
  const rows = placement.split("/");
  // rows[0] is rank 8 (top), rows[7] is rank 1 (bottom).
  for (let r = 0; r < 8; r++) {
    const row = rows[r];
    const rank = 7 - r; // rank index 0..7 == rank 1..8
    let file = 0;
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch >= "1" && ch <= "8") {
        file += ch.charCodeAt(0) - 48;
      } else {
        board[rank * 16 + file] = charToPiece(ch);
        file++;
      }
    }
  }

  const kings = [-1, -1];
  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) {
      sq += 7;
      continue;
    }
    const p = board[sq];
    if (p === 6) kings[0] = sq;
    else if (p === 12) kings[1] = sq;
  }

  let castling = 0;
  if (castleStr && castleStr !== "-") {
    if (castleStr.indexOf("K") !== -1) castling |= 1;
    if (castleStr.indexOf("Q") !== -1) castling |= 2;
    if (castleStr.indexOf("k") !== -1) castling |= 4;
    if (castleStr.indexOf("q") !== -1) castling |= 8;
  }

  let ep = -1;
  if (epStr && epStr !== "-") {
    const f = epStr.charCodeAt(0) - 97;
    const rk = epStr.charCodeAt(1) - 49;
    ep = rk * 16 + f;
  }

  return {
    board,
    turn: turnStr === "w" ? 0 : 1,
    castling,
    ep,
    halfmove,
    fullmove,
    kings,
  };
}

// ---------------------------------------------------------------------------
// Attack test: is `sq` attacked by any piece of color `byColor`?
// ---------------------------------------------------------------------------

function isSquareAttacked(board, sq, byColor) {
  if (byColor === 0) {
    // White pawns attack up-diagonally, so they sit one rank below.
    let s = sq - 15;
    if ((s & 0x88) === 0 && board[s] === 1) return true;
    s = sq - 17;
    if ((s & 0x88) === 0 && board[s] === 1) return true;
  } else {
    let s = sq + 15;
    if ((s & 0x88) === 0 && board[s] === 7) return true;
    s = sq + 17;
    if ((s & 0x88) === 0 && board[s] === 7) return true;
  }

  const knight = byColor === 0 ? 2 : 8;
  for (let i = 0; i < 8; i++) {
    const s = sq + KNIGHT_OFFSETS[i];
    if ((s & 0x88) === 0 && board[s] === knight) return true;
  }

  const king = byColor === 0 ? 6 : 12;
  for (let i = 0; i < 8; i++) {
    const s = sq + KING_OFFSETS[i];
    if ((s & 0x88) === 0 && board[s] === king) return true;
  }

  const bishop = byColor === 0 ? 3 : 9;
  const queen = byColor === 0 ? 5 : 11;
  for (let i = 0; i < 4; i++) {
    const d = BISHOP_DIRS[i];
    let s = sq + d;
    while ((s & 0x88) === 0) {
      const p = board[s];
      if (p !== 0) {
        if (p === bishop || p === queen) return true;
        break;
      }
      s += d;
    }
  }

  const rook = byColor === 0 ? 4 : 10;
  for (let i = 0; i < 4; i++) {
    const d = ROOK_DIRS[i];
    let s = sq + d;
    while ((s & 0x88) === 0) {
      const p = board[s];
      if (p !== 0) {
        if (p === rook || p === queen) return true;
        break;
      }
      s += d;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Pseudo-legal move generation
// ---------------------------------------------------------------------------

function genPawn(pos, sq, us, out) {
  const board = pos.board;
  if (us === 0) {
    const one = sq + 16;
    if (board[one] === 0) {
      if ((one >> 4) === 7) {
        out.push(mv(sq, one, 5, 0));
        out.push(mv(sq, one, 4, 0));
        out.push(mv(sq, one, 3, 0));
        out.push(mv(sq, one, 2, 0));
      } else {
        out.push(mv(sq, one, 0, 0));
        if ((sq >> 4) === 1) {
          const two = sq + 32;
          if (board[two] === 0) out.push(mv(sq, two, 0, 1));
        }
      }
    }
    // captures (left/right up-diagonal)
    let to = sq + 15;
    if ((to & 0x88) === 0) {
      if (pos.ep === to) out.push(mv(sq, to, 0, 2));
      else if (board[to] > 6) {
        if ((to >> 4) === 7) {
          out.push(mv(sq, to, 5, 0));
          out.push(mv(sq, to, 4, 0));
          out.push(mv(sq, to, 3, 0));
          out.push(mv(sq, to, 2, 0));
        } else out.push(mv(sq, to, 0, 0));
      }
    }
    to = sq + 17;
    if ((to & 0x88) === 0) {
      if (pos.ep === to) out.push(mv(sq, to, 0, 2));
      else if (board[to] > 6) {
        if ((to >> 4) === 7) {
          out.push(mv(sq, to, 5, 0));
          out.push(mv(sq, to, 4, 0));
          out.push(mv(sq, to, 3, 0));
          out.push(mv(sq, to, 2, 0));
        } else out.push(mv(sq, to, 0, 0));
      }
    }
  } else {
    const one = sq - 16;
    if (board[one] === 0) {
      if ((one >> 4) === 0) {
        out.push(mv(sq, one, 5, 0));
        out.push(mv(sq, one, 4, 0));
        out.push(mv(sq, one, 3, 0));
        out.push(mv(sq, one, 2, 0));
      } else {
        out.push(mv(sq, one, 0, 0));
        if ((sq >> 4) === 6) {
          const two = sq - 32;
          if (board[two] === 0) out.push(mv(sq, two, 0, 1));
        }
      }
    }
    let to = sq - 15;
    if ((to & 0x88) === 0) {
      if (pos.ep === to) out.push(mv(sq, to, 0, 2));
      else {
        const tp = board[to];
        if (tp !== 0 && tp <= 6) {
          if ((to >> 4) === 0) {
            out.push(mv(sq, to, 5, 0));
            out.push(mv(sq, to, 4, 0));
            out.push(mv(sq, to, 3, 0));
            out.push(mv(sq, to, 2, 0));
          } else out.push(mv(sq, to, 0, 0));
        }
      }
    }
    to = sq - 17;
    if ((to & 0x88) === 0) {
      if (pos.ep === to) out.push(mv(sq, to, 0, 2));
      else {
        const tp = board[to];
        if (tp !== 0 && tp <= 6) {
          if ((to >> 4) === 0) {
            out.push(mv(sq, to, 5, 0));
            out.push(mv(sq, to, 4, 0));
            out.push(mv(sq, to, 3, 0));
            out.push(mv(sq, to, 2, 0));
          } else out.push(mv(sq, to, 0, 0));
        }
      }
    }
  }
}

function genCastling(pos, us, out) {
  const board = pos.board;
  const cr = pos.castling;
  const them = 1 - us;
  if (us === 0) {
    if (board[4] !== 6) return;
    if (cr & 1) {
      if (board[5] === 0 && board[6] === 0 && board[7] === 4) {
        if (
          !isSquareAttacked(board, 4, them) &&
          !isSquareAttacked(board, 5, them) &&
          !isSquareAttacked(board, 6, them)
        ) {
          out.push(mv(4, 6, 0, 3));
        }
      }
    }
    if (cr & 2) {
      if (board[3] === 0 && board[2] === 0 && board[1] === 0 && board[0] === 4) {
        if (
          !isSquareAttacked(board, 4, them) &&
          !isSquareAttacked(board, 3, them) &&
          !isSquareAttacked(board, 2, them)
        ) {
          out.push(mv(4, 2, 0, 3));
        }
      }
    }
  } else {
    if (board[116] !== 12) return;
    if (cr & 4) {
      if (board[117] === 0 && board[118] === 0 && board[119] === 10) {
        if (
          !isSquareAttacked(board, 116, them) &&
          !isSquareAttacked(board, 117, them) &&
          !isSquareAttacked(board, 118, them)
        ) {
          out.push(mv(116, 118, 0, 3));
        }
      }
    }
    if (cr & 8) {
      if (
        board[115] === 0 &&
        board[114] === 0 &&
        board[113] === 0 &&
        board[112] === 10
      ) {
        if (
          !isSquareAttacked(board, 116, them) &&
          !isSquareAttacked(board, 115, them) &&
          !isSquareAttacked(board, 114, them)
        ) {
          out.push(mv(116, 114, 0, 3));
        }
      }
    }
  }
}

function generatePseudoLegal(pos) {
  const out = [];
  const board = pos.board;
  const us = pos.turn;
  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) {
      sq += 7;
      continue;
    }
    const piece = board[sq];
    if (piece === 0) continue;
    const color = piece <= 6 ? 0 : 1;
    if (color !== us) continue;
    const type = piece <= 6 ? piece : piece - 6;

    if (type === 1) {
      genPawn(pos, sq, us, out);
    } else if (type === 2) {
      for (let i = 0; i < 8; i++) {
        const to = sq + KNIGHT_OFFSETS[i];
        if (to & 0x88) continue;
        const tp = board[to];
        if (tp === 0 || (tp <= 6 ? 0 : 1) !== us) out.push(mv(sq, to, 0, 0));
      }
    } else if (type === 6) {
      for (let i = 0; i < 8; i++) {
        const to = sq + KING_OFFSETS[i];
        if (to & 0x88) continue;
        const tp = board[to];
        if (tp === 0 || (tp <= 6 ? 0 : 1) !== us) out.push(mv(sq, to, 0, 0));
      }
    } else {
      // sliders: bishop(3)=BISHOP_DIRS, rook(4)=ROOK_DIRS, queen(5)=all 8
      const dirs = type === 3 ? BISHOP_DIRS : type === 4 ? ROOK_DIRS : KING_OFFSETS;
      const ndirs = type === 5 ? 8 : 4;
      for (let i = 0; i < ndirs; i++) {
        const d = dirs[i];
        let to = sq + d;
        while (!(to & 0x88)) {
          const tp = board[to];
          if (tp === 0) {
            out.push(mv(sq, to, 0, 0));
          } else {
            if ((tp <= 6 ? 0 : 1) !== us) out.push(mv(sq, to, 0, 0));
            break;
          }
          to += d;
        }
      }
    }
  }
  genCastling(pos, us, out);
  return out;
}

// ---------------------------------------------------------------------------
// make / unmake (mutating; unmake exactly reverses make).
// halfmove/fullmove are irrelevant to move generation and perft, so they are
// intentionally left untouched here.
//
// undo is packed into one int:
//   captured(0-3) | capturedSq+1 (4-11) | castling (12-15) | ep+1 (16-23)
// ---------------------------------------------------------------------------

function makeMove(pos, m) {
  const board = pos.board;
  const from = m & 0xff;
  const to = (m >>> 8) & 0xff;
  const promo = (m >>> 16) & 0xf;
  const flag = (m >>> 20) & 0xf;
  const us = pos.turn;
  const piece = board[from];
  const type = piece <= 6 ? piece : piece - 6;

  let captured = 0;
  let capturedSq = -1;

  board[from] = EMPTY;

  if (flag === 2) {
    // en passant: captured pawn sits behind the target square.
    const capSq = us === 0 ? to - 16 : to + 16;
    captured = board[capSq];
    capturedSq = capSq;
    board[capSq] = EMPTY;
    board[to] = piece;
  } else {
    const tp = board[to];
    if (tp !== 0) {
      captured = tp;
      capturedSq = to;
    }
    board[to] = promo !== 0 ? (us === 0 ? promo : promo + 6) : piece;
  }

  if (flag === 3) {
    if (to === 6) {
      board[7] = EMPTY;
      board[5] = 4;
    } else if (to === 2) {
      board[0] = EMPTY;
      board[3] = 4;
    } else if (to === 118) {
      board[119] = EMPTY;
      board[117] = 10;
    } else if (to === 114) {
      board[112] = EMPTY;
      board[115] = 10;
    }
  }

  if (type === 6) pos.kings[us] = to;

  const undo =
    captured | ((capturedSq + 1) << 4) | (pos.castling << 12) | ((pos.ep + 1) << 16);

  pos.castling = pos.castling & castleMask[from] & castleMask[to];
  pos.ep = flag === 1 ? (from + to) >> 1 : -1;
  pos.turn = 1 - us;

  return undo;
}

function unmakeMove(pos, m, undo) {
  const board = pos.board;
  const from = m & 0xff;
  const to = (m >>> 8) & 0xff;
  const promo = (m >>> 16) & 0xf;
  const flag = (m >>> 20) & 0xf;
  const us = 1 - pos.turn;

  pos.turn = us;
  pos.castling = (undo >>> 12) & 0xf;
  pos.ep = ((undo >>> 16) & 0xff) - 1;
  const captured = undo & 0xf;
  const capturedSq = ((undo >>> 4) & 0xff) - 1;

  let movedPiece;
  if (promo !== 0) movedPiece = us === 0 ? 1 : 7;
  else movedPiece = board[to];

  board[from] = movedPiece;

  if (flag === 2) {
    board[to] = EMPTY;
    board[capturedSq] = captured;
  } else if (capturedSq === to) {
    board[to] = captured;
  } else {
    board[to] = EMPTY;
  }

  if (flag === 3) {
    if (to === 6) {
      board[7] = 4;
      board[5] = EMPTY;
    } else if (to === 2) {
      board[0] = 4;
      board[3] = EMPTY;
    } else if (to === 118) {
      board[119] = 10;
      board[117] = EMPTY;
    } else if (to === 114) {
      board[112] = 10;
      board[115] = EMPTY;
    }
  }

  if ((movedPiece <= 6 ? movedPiece : movedPiece - 6) === 6) pos.kings[us] = from;
}

// ---------------------------------------------------------------------------
// Public: legal moves as UCI strings (does not mutate `position`).
// ---------------------------------------------------------------------------

export function moves(position) {
  const pseudo = generatePseudoLegal(position);
  const legal = [];
  const us = position.turn;
  const them = 1 - us;
  for (let i = 0; i < pseudo.length; i++) {
    const m = pseudo[i];
    const undo = makeMove(position, m);
    if (!isSquareAttacked(position.board, position.kings[us], them)) {
      const from = m & 0xff;
      const to = (m >>> 8) & 0xff;
      const promo = (m >>> 16) & 0xf;
      let s = sqToStr(from) + sqToStr(to);
      if (promo !== 0) s += PROMO_CHAR[promo];
      legal.push(s);
    }
    unmakeMove(position, m, undo);
  }
  return legal;
}

// ---------------------------------------------------------------------------
// Perft
// ---------------------------------------------------------------------------

function perftInner(pos, depth) {
  const us = pos.turn;
  const them = 1 - us;
  const pseudo = generatePseudoLegal(pos);
  let nodes = 0;
  for (let i = 0; i < pseudo.length; i++) {
    const m = pseudo[i];
    const undo = makeMove(pos, m);
    if (!isSquareAttacked(pos.board, pos.kings[us], them)) {
      nodes += depth === 1 ? 1 : perftInner(pos, depth - 1);
    }
    unmakeMove(pos, m, undo);
  }
  return nodes;
}

export function perft(fen, depth) {
  const pos = parseFen(fen);
  if (depth <= 0) return 1;
  return perftInner(pos, depth);
}
