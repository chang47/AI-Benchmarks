// Frozen answer key for the flagship Wordle task.
// Loads ../src/index.html headlessly and grades it through window.__wordle:
//   - all 9 canonical (answer,guess)->colors vectors (the core — AC5/AC3/AC4)
//   - AC2 (invalid/short guesses rejected, no row consumed)
//   - AC6 (keyboard best-state precedence: yellow->green upgrade, never a downgrade)
//   - AC7 (win locks the game)
// Prints JSON; exits 0 only if every gated check passes.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const INDEX = resolve(HERE, "..", "src", "index.html");
const VECTORS = JSON.parse(readFileSync(resolve(HERE, "vectors.json"), "utf8"));

async function launch() {
  try { return await chromium.launch({ channel: "chrome" }); }
  catch { return await chromium.launch(); } // fall back to bundled chromium
}

const eq = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i]);

const browser = await launch();
const page = await browser.newPage();
const results = { vectors: [], ac2: null, ac6: null, ac7: null };
try {
  await page.goto(pathToFileURL(INDEX).href);
  await page.waitForFunction(() => window.__wordle && typeof window.__wordle.evaluate === "function", { timeout: 10000 });

  // --- Core: the 9 canonical vectors (AC5, exercising AC3 greens-first + AC4 duplicate bounding)
  for (const v of VECTORS) {
    const got = await page.evaluate(([a, g]) => window.__wordle.evaluate(a, g), [v.answer, v.guess]);
    const pass = eq(got, v.expected);
    results.vectors.push({ answer: v.answer, guess: v.guess, expected: v.expected, got, pass });
  }

  // --- AC2: invalid + too-short guesses rejected, no row consumed
  results.ac2 = await page.evaluate(() => {
    window.__wordle.newGame("CRANE");
    const before = window.__wordle.state().rows.length;
    const badWord = window.__wordle.submitGuess("ZZZZZ"); // 5 letters, not in list
    const tooShort = window.__wordle.submitGuess("AB");
    const after = window.__wordle.state().rows.length;
    return { rejectedNotInList: badWord.accepted === false, rejectedShort: tooShort.accepted === false, rowUnchanged: before === after };
  });

  // --- AC6: keyboard precedence. answer ABBEY; BLAND makes A,B yellow; ABIDE upgrades them to green; BOARD must NOT downgrade.
  results.ac6 = await page.evaluate(() => {
    const w = window.__wordle;
    w.newGame("ABBEY");
    const r1 = w.submitGuess("BLAND");
    const afterBland = { A: w.keyboardState().A, B: w.keyboardState().B, accepted: r1.accepted };
    const r2 = w.submitGuess("ABIDE");
    const afterAbide = { A: w.keyboardState().A, B: w.keyboardState().B, accepted: r2.accepted };
    const r3 = w.submitGuess("BOARD");
    const afterBoard = { A: w.keyboardState().A, B: w.keyboardState().B, accepted: r3.accepted };
    return {
      afterBland, afterAbide, afterBoard,
      yellowFirst: afterBland.A === "yellow" && afterBland.B === "yellow",
      upgradeToGreen: afterAbide.A === "green" && afterAbide.B === "green",
      noDowngrade: afterBoard.A === "green" && afterBoard.B === "green",
    };
  });

  // --- AC7: win locks the game
  results.ac7 = await page.evaluate(() => {
    const w = window.__wordle;
    w.newGame("CRANE");
    const win = w.submitGuess("CRANE");
    const st = w.state();
    const afterWin = w.submitGuess("SLATE"); // should be refused once over
    return { win: win.win === true, over: st.over === true, won: st.won === true, lockedAfter: afterWin.accepted === false };
  });
} catch (err) {
  results.error = String(err);
} finally {
  await browser.close();
}

const vectorsPass = results.vectors.length === VECTORS.length && results.vectors.every((r) => r.pass);
const ac2Pass = !!results.ac2 && results.ac2.rejectedNotInList && results.ac2.rejectedShort && results.ac2.rowUnchanged;
const ac6Pass = !!results.ac6 && results.ac6.yellowFirst && results.ac6.upgradeToGreen && results.ac6.noDowngrade;
const ac7Pass = !!results.ac7 && results.ac7.win && results.ac7.over && results.ac7.lockedAfter;
const allPass = vectorsPass && ac2Pass && ac6Pass && ac7Pass && !results.error;

console.log(JSON.stringify({
  allPass,
  gates: { vectorsPass, ac2Pass, ac6Pass, ac7Pass },
  vectorsFailed: results.vectors.filter((r) => !r.pass),
  detail: results,
}, null, 2));
process.exit(allPass ? 0 : 1);
