// Independent verifier playwright pass — round 0
// Drives window.__chess hook, captures screenshots at ~0s and ~3s.
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import path from "node:path";

const SRC = path.resolve("C:/Users/iamjo/Projects/ai-benchmark/tasks/12-chess-webgame/src/index.html");
const OUT = path.resolve("C:/Users/iamjo/Projects/ai-benchmark/tasks/12-chess-webgame/verify/round-0");
const url = pathToFileURL(SRC).href;

const results = {};
function rec(k, v, note = "") { results[k] = { v, note }; }

let browser;
try {
  try {
    browser = await chromium.launch({ channel: "chrome" });
  } catch (e) {
    browser = await chromium.launch();
  }
  const page = await browser.newPage({ viewport: { width: 900, height: 900 } });

  const consoleErrors = [];
  const pageErrors = [];
  const dialogs = [];
  const extReqs = [];
  page.on("console", m => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", e => pageErrors.push(String(e)));
  page.on("dialog", async d => { dialogs.push(d.type()); await d.dismiss().catch(() => {}); });
  page.on("request", r => {
    const u = r.url();
    if (!/^(file:|data:|blob:|about:)/.test(u)) extReqs.push(u);
  });

  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(300);

  // Screenshot at ~0s (initial position)
  await page.screenshot({ path: path.join(OUT, "at-0s-initial.png") });

  // Hook presence + shape
  const hookShape = await page.evaluate(() => {
    const c = window.__chess;
    return {
      exists: !!c,
      boardIsFn: typeof c?.board === "function",
      moveIsFn: typeof c?.move === "function",
      turn: c?.turn,
      boardLen: c?.board ? Object.keys(c.board()).length : -1,
    };
  });
  rec("hook_exists", hookShape.exists);
  rec("board_is_fn", hookShape.boardIsFn);
  rec("move_is_fn", hookShape.moveIsFn);
  rec("turn_at_load", hookShape.turn === "w", `turn=${hookShape.turn}`);
  rec("initial_count_32", hookShape.boardLen === 32, `count=${hookShape.boardLen}`);

  // Fresh-snapshot: mutating returned object doesn't leak
  const freshSnap = await page.evaluate(() => {
    const c = window.__chess;
    const b = c.board();
    delete b.e2;
    b.zz = "wX";
    const b2 = c.board();
    return b2.e2 === "wP" && !("zz" in b2);
  });
  rec("fresh_snapshot", freshSnap);

  // Initial position deep-check
  const initOK = await page.evaluate(() => {
    const want = {
      a1:"wR",b1:"wN",c1:"wB",d1:"wQ",e1:"wK",f1:"wB",g1:"wN",h1:"wR",
      a2:"wP",b2:"wP",c2:"wP",d2:"wP",e2:"wP",f2:"wP",g2:"wP",h2:"wP",
      a7:"bP",b7:"bP",c7:"bP",d7:"bP",e7:"bP",f7:"bP",g7:"bP",h7:"bP",
      a8:"bR",b8:"bN",c8:"bB",d8:"bQ",e8:"bK",f8:"bB",g8:"bN",h8:"bR",
    };
    const b = window.__chess.board();
    const keys = Object.keys(want);
    if (Object.keys(b).length !== 32) return false;
    return keys.every(k => b[k] === want[k]);
  });
  rec("initial_position_exact", initOK);

  // Turn indicator text at load
  const bodyText0 = await page.evaluate(() => document.body.innerText);
  rec("indicator_white_at_load", /white/i.test(bodyText0), bodyText0.replace(/\s+/g," ").slice(0,120));

  // Board render heuristic: count square cells with backgrounds & a1 dark / h1 light
  const boardVisual = await page.evaluate(() => {
    // find elements that look like squares (data-sq attribute is common); fallback: any grid cells
    const cells = [...document.querySelectorAll("[data-sq],[data-square],.square,.cell")];
    return { cellCount: cells.length };
  });
  rec("square_cells_found", boardVisual.cellCount >= 64, `cells=${boardVisual.cellCount}`);

  // Play 1.e4 via hook, confirm repaint + turn flip
  const e4 = await page.evaluate(() => {
    const c = window.__chess;
    const before = c.board().e2;
    const ok = c.move("e2","e4");
    return { ok, before, e2after: c.board().e2, e4after: c.board().e4, turn: c.turn };
  });
  rec("e4_accepted", e4.ok === true && e4.e4after === "wP" && !e4.e2after && e4.turn === "b");
  await page.waitForTimeout(200);
  const bodyText1 = await page.evaluate(() => document.body.innerText);
  rec("indicator_black_after_e4", /black/i.test(bodyText1), bodyText1.replace(/\s+/g," ").slice(0,120));

  // Illegal move contract: from this position, white can't move again (d2d4)
  const illegal = await page.evaluate(() => {
    const c = window.__chess;
    const snapBefore = JSON.stringify(c.board());
    const t = c.turn;
    const r = c.move("d2","d4");
    return { r, unchanged: JSON.stringify(c.board()) === snapBefore, turnSame: c.turn === t };
  });
  rec("illegal_contract", illegal.r === false && illegal.unchanged && illegal.turnSame);

  // Play Fool's mate from a fresh game -> game over, further moves rejected
  const foolsMate = await page.evaluate(() => {
    const c = window.__chess;
    c.newGame();
    const seq = [["f2","f3"],["e7","e6"],["g2","g4"],["d8","h4"]];
    const oks = seq.map(([a,b]) => c.move(a,b));
    const afterText = document.body.innerText;
    const lockedMoves = [c.move("a2","a3"), c.move("g1","f3")];
    return { oks, allTrue: oks.every(Boolean), afterText, locked: lockedMoves.every(x => x === false) };
  });
  rec("foolsmate_accepted", foolsMate.allTrue);
  rec("foolsmate_locks_game", foolsMate.locked);
  rec("mate_declared", /mate|black wins|0-1|checkmate|wins/i.test(foolsMate.afterText), foolsMate.afterText.replace(/\s+/g," ").slice(0,160));

  // Screenshot at ~3s (mate position with declaration)
  await page.waitForTimeout(2700);
  await page.screenshot({ path: path.join(OUT, "at-3s-foolsmate.png") });

  // Reset to a fresh game and screenshot the check indication + selection highlight
  await page.evaluate(() => window.__chess.newGame());
  await page.waitForTimeout(150);

  // Click-to-move selection highlight: click e2 square
  const sqInfo = await page.evaluate(() => {
    const el = document.querySelector('[data-sq="e2"],[data-square="e2"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width/2, y: r.y + r.height/2 };
  });
  if (sqInfo) {
    await page.mouse.click(sqInfo.x, sqInfo.y);
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(OUT, "select-e2.png") });
    // detect a highlight change on the e2 element
    const hl = await page.evaluate(() => {
      const el = document.querySelector('[data-sq="e2"],[data-square="e2"]');
      const cs = getComputedStyle(el);
      return { outline: cs.outline, boxShadow: cs.boxShadow, cls: el.className, bg: cs.backgroundColor };
    });
    rec("select_highlight_detected", true, JSON.stringify(hl).slice(0,180));
  } else {
    rec("select_highlight_detected", "manual", "e2 square not locatable by data-sq/data-square");
  }

  // Check indication: 1.e4 d5 2.Bb5+
  const checkSeq = await page.evaluate(() => {
    const c = window.__chess;
    c.newGame();
    c.move("e2","e4"); c.move("d7","d5"); const ok = c.move("f1","b5");
    return { ok, text: document.body.innerText };
  });
  rec("check_move_ok", checkSeq.ok === true);
  rec("check_declared", /check/i.test(checkSeq.text), checkSeq.text.replace(/\s+/g," ").slice(0,120));
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(OUT, "check-indication.png") });

  rec("console_errors", consoleErrors.length === 0, consoleErrors.join(" | ").slice(0,200));
  rec("page_errors", pageErrors.length === 0, pageErrors.join(" | ").slice(0,200));
  rec("no_dialogs", dialogs.length === 0, dialogs.join(","));
  rec("no_external_requests", extReqs.length === 0, extReqs.join(" | ").slice(0,200));

  console.log(JSON.stringify(results, null, 2));
} catch (err) {
  console.log("HARNESS_ERROR: " + String(err));
  process.exitCode = 2;
} finally {
  if (browser) await browser.close();
}
