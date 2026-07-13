// Self-check for the Wordle clone. Local playwright, chrome channel with
// chromium fallback, file:// load, exercises window.__wordle, screenshots.
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, "index.html");
const fileUrl = pathToFileURL(htmlPath).href;

function deepEq(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function launch() {
  try {
    return await chromium.launch({ channel: "chrome" });
  } catch (e) {
    console.log("chrome channel failed, falling back to bundled chromium:", e.message);
    return await chromium.launch();
  }
}

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail: detail || "" });
  console.log((pass ? "PASS" : "FAIL") + "  " + name + (detail ? "  -> " + detail : ""));
}

const browser = await launch();
const page = await browser.newPage();

const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("pageerror", (err) => consoleErrors.push("pageerror: " + err.message));

await page.goto(fileUrl, { waitUntil: "load" });

// --- A1: board is 6x5 ---
const boardDims = await page.evaluate(() => {
  const rows = document.querySelectorAll("#board .row");
  const cols = rows.length ? rows[0].querySelectorAll(".tile").length : 0;
  return { rows: rows.length, cols };
});
check("A1 board 6x5", boardDims.rows === 6 && boardDims.cols === 5, JSON.stringify(boardDims));

// --- A2: keyboard has 26 letters + enter + back ---
const kb = await page.evaluate(() => {
  const keys = Array.from(document.querySelectorAll("#keyboard .key"));
  const labels = keys.map((k) => k.getAttribute("data-key"));
  const letters = labels.filter((l) => /^[A-Z]$/.test(l));
  return {
    total: keys.length,
    letters: new Set(letters).size,
    hasEnter: labels.includes("ENTER"),
    hasBack: labels.includes("BACK"),
  };
});
check("A2 keyboard 26+enter+back", kb.letters === 26 && kb.hasEnter && kb.hasBack, JSON.stringify(kb));

// --- Hook presence ---
const hookOk = await page.evaluate(() => {
  return !!(window.__wordle && typeof window.__wordle.setAnswer === "function" &&
    typeof window.__wordle.guess === "function" && typeof window.__wordle.state === "function");
});
check("hook window.__wordle present", hookOk);

// --- E3: answer hidden before end, status playing at load ---
const loadState = await page.evaluate(() => {
  const s = window.__wordle.state();
  return { status: s.status, answer: s.answer, bodyHasAnswer: document.body.innerText.includes(s.answer) };
});
check("F1 default answer set, playing", loadState.status === "playing" && loadState.answer.length === 5, JSON.stringify({ status: loadState.status, len: loadState.answer.length }));
check("E3 answer not visible in page text", !loadState.bodyHasAnswer);

// --- C4 concrete duplicate-letter cases ---
const cases = [
  { answer: "HOTEL", guess: "LEVEL", want: ["gray", "gray", "gray", "green", "green"] },
  { answer: "EATEN", guess: "LEVER", want: ["gray", "yellow", "gray", "green", "gray"] },
  { answer: "ERASE", guess: "SPEED", want: ["yellow", "gray", "yellow", "yellow", "gray"] },
  { answer: "CREPE", guess: "SPEED", want: ["gray", "yellow", "green", "yellow", "gray"] },
  { answer: "THOSE", guess: "GEESE", want: ["gray", "gray", "gray", "green", "green"] },
  { answer: "ROBOT", guess: "FLOOR", want: ["gray", "gray", "yellow", "green", "yellow"] },
];
for (const c of cases) {
  const got = await page.evaluate((cc) => {
    window.__wordle.setAnswer(cc.answer);
    return window.__wordle.guess(cc.guess);
  }, c);
  check("C4 " + c.answer + "/" + c.guess, deepEq(got, c.want), "got=" + JSON.stringify(got));
}

// --- B2: rendered tile classes agree with guess() return ---
const tileAgree = await page.evaluate(() => {
  window.__wordle.setAnswer("CREPE");
  const ev = window.__wordle.guess("SPEED");
  const rowTiles = document.querySelectorAll('#board .row')[0].querySelectorAll('.tile');
  const rendered = Array.from(rowTiles).map((t) => {
    if (t.classList.contains("green")) return "green";
    if (t.classList.contains("yellow")) return "yellow";
    if (t.classList.contains("gray")) return "gray";
    return "none";
  });
  return { ev, rendered };
});
check("B2 tiles match eval array", deepEq(tileAgree.ev, tileAgree.rendered), JSON.stringify(tileAgree));

// --- D4: excess-duplicate gray must not leave key gray (LEVEL vs HOTEL -> L green) ---
const keyColors = await page.evaluate(() => {
  window.__wordle.setAnswer("HOTEL");
  window.__wordle.guess("LEVEL");
  function keyCls(letter) {
    const el = document.querySelector('#keyboard .key[data-key="' + letter + '"]');
    if (el.classList.contains("green")) return "green";
    if (el.classList.contains("yellow")) return "yellow";
    if (el.classList.contains("gray")) return "gray";
    return "none";
  }
  return { L: keyCls("L"), E: keyCls("E"), V: keyCls("V") };
});
check("D4 L key green (not gray) after LEVEL/HOTEL", keyColors.L === "green", JSON.stringify(keyColors));
check("D3 E key green when yellow+green in row", keyColors.E === "green");
check("D1 V key gray", keyColors.V === "gray");

// --- D2: no downgrade. yellow then gray for same letter stays yellow-or-better ---
const noDowngrade = await page.evaluate(() => {
  window.__wordle.setAnswer("ROBOT");
  window.__wordle.guess("OXXXX"); // O yellow
  function keyCls(letter) {
    const el = document.querySelector('#keyboard .key[data-key="' + letter + '"]');
    if (el.classList.contains("green")) return "green";
    if (el.classList.contains("yellow")) return "yellow";
    if (el.classList.contains("gray")) return "gray";
    return "none";
  }
  const afterYellow = keyCls("O");
  window.__wordle.guess("XOXXX"); // O green at index1 (ROBOT) -> upgrade
  const afterGreen = keyCls("O");
  return { afterYellow, afterGreen };
});
check("D2 O yellow then green (upgrade, no downgrade)", noDowngrade.afterYellow === "yellow" && noDowngrade.afterGreen === "green", JSON.stringify(noDowngrade));

// --- Invalid guesses return null, no row consumed ---
const invalid = await page.evaluate(() => {
  window.__wordle.setAnswer("CRANE");
  const short = window.__wordle.guess("ABC");
  const nonletter = window.__wordle.guess("AB1CD");
  const longw = window.__wordle.guess("ABCDEF");
  const s = window.__wordle.state();
  return { short, nonletter, longw, guessCount: s.guesses.length };
});
check("invalid guesses -> null, no row consumed", invalid.short === null && invalid.nonletter === null && invalid.longw === null && invalid.guessCount === 0, JSON.stringify(invalid));

// --- E1: win ends game, further guesses ignored ---
const win = await page.evaluate(() => {
  window.__wordle.setAnswer("CRANE");
  const ev = window.__wordle.guess("CRANE");
  const s1 = window.__wordle.state();
  const after = window.__wordle.guess("SLATE");
  const s2 = window.__wordle.state();
  const msg = document.getElementById("message").textContent;
  return { ev, status: s1.status, after, guessCountAfter: s2.guesses.length, msg };
});
check("E1 win all-green ends game", win.ev.every((x) => x === "green") && win.status === "won" && win.after === null && win.guessCountAfter === 1, JSON.stringify(win));
check("E1 win message visible", win.msg && win.msg.length > 0, win.msg);

// --- E2/E4: lose after 6 non-winning; and win on 6th is a win ---
const lose = await page.evaluate(() => {
  window.__wordle.setAnswer("CRANE");
  for (let i = 0; i < 6; i++) window.__wordle.guess("SLOTH");
  const s = window.__wordle.state();
  const msg = document.getElementById("message").textContent;
  const answerShown = msg.includes(s.answer);
  return { status: s.status, guesses: s.guesses.length, answerShown };
});
check("E2 lose after 6 reveals answer", lose.status === "lost" && lose.guesses === 6 && lose.answerShown, JSON.stringify(lose));

const win6 = await page.evaluate(() => {
  window.__wordle.setAnswer("CRANE");
  for (let i = 0; i < 5; i++) window.__wordle.guess("SLOTH");
  const ev = window.__wordle.guess("CRANE"); // 6th guess correct
  const s = window.__wordle.state();
  return { status: s.status, ev };
});
check("E4 win on 6th guess is a win", win6.status === "won" && win6.ev.every((x) => x === "green"), JSON.stringify(win6));

// --- setAnswer resets board (D fresh state) ---
const resetOk = await page.evaluate(() => {
  window.__wordle.setAnswer("CRANE");
  window.__wordle.guess("SLOTH");
  window.__wordle.setAnswer("MOUND");
  const s = window.__wordle.state();
  const anyColoredTile = !!document.querySelector('#board .tile.green, #board .tile.yellow, #board .tile.gray');
  const anyColoredKey = !!document.querySelector('#keyboard .key.green, #keyboard .key.yellow, #keyboard .key.gray');
  return { status: s.status, guesses: s.guesses.length, evals: s.evaluations.length, anyColoredTile, anyColoredKey };
});
check("setAnswer resets to fresh state", resetOk.status === "playing" && resetOk.guesses === 0 && resetOk.evals === 0 && !resetOk.anyColoredTile && !resetOk.anyColoredKey, JSON.stringify(resetOk));

// --- A3/A4: physical typing fills tiles; short Enter does not consume ---
const typing = await page.evaluate(() => {
  window.__wordle.setAnswer("CRANE");
  return null;
});
// type 3 letters then Enter (should not submit), then complete + Enter
await page.keyboard.press("A");
await page.keyboard.press("B");
await page.keyboard.press("C");
const afterThree = await page.evaluate(() => {
  const rowTiles = document.querySelectorAll('#board .row')[0].querySelectorAll('.tile');
  return Array.from(rowTiles).map((t) => t.textContent).join("");
});
await page.keyboard.press("Enter"); // only 3 letters -> no submit
const afterShortEnter = await page.evaluate(() => window.__wordle.state().guesses.length);
await page.keyboard.press("Backspace");
const afterBack = await page.evaluate(() => {
  const rowTiles = document.querySelectorAll('#board .row')[0].querySelectorAll('.tile');
  return Array.from(rowTiles).map((t) => t.textContent).join("");
});
await page.keyboard.press("D");
await page.keyboard.press("E");
await page.keyboard.press("F");
await page.keyboard.press("Enter"); // now ABDEF (5) -> submit
const afterFullEnter = await page.evaluate(() => window.__wordle.state().guesses);
check("A3 typing fills tiles (ABC)", afterThree === "ABC", afterThree);
check("A4 short Enter does not consume", afterShortEnter === 0, String(afterShortEnter));
check("A3 backspace removes last (AB)", afterBack === "AB", afterBack);
check("A2/A4 full physical Enter submits ABDEF", afterFullEnter.length === 1 && afterFullEnter[0] === "ABDEF", JSON.stringify(afterFullEnter));

// --- D5: clicking on-screen keys inputs letters like physical ---
const clickOk = await page.evaluate(() => {
  window.__wordle.setAnswer("CRANE");
  return null;
});
for (const L of ["S", "L", "A", "T", "E"]) {
  await page.click('#keyboard .key[data-key="' + L + '"]');
}
await page.click('#keyboard .key[data-key="ENTER"]');
const afterClickSubmit = await page.evaluate(() => window.__wordle.state().guesses);
check("D5 clicking keys types + Enter submits (SLATE)", afterClickSubmit.length === 1 && afterClickSubmit[0] === "SLATE", JSON.stringify(afterClickSubmit));

// --- Screenshot a played game for visual inspection ---
await page.evaluate(() => {
  window.__wordle.setAnswer("CREPE");
  window.__wordle.guess("SPEED");
  window.__wordle.guess("LEVER");
});
await page.screenshot({ path: path.join(__dirname, "selfcheck.png"), fullPage: true });

// --- F3: no console errors ---
check("F3 no console errors", consoleErrors.length === 0, consoleErrors.join(" | "));

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log("\n=== SUMMARY: " + (results.length - failed.length) + "/" + results.length + " passed ===");
if (consoleErrors.length) {
  console.log("Console errors:\n" + consoleErrors.join("\n"));
}
if (failed.length) {
  console.log("FAILURES: " + failed.map((f) => f.name).join(", "));
  process.exit(1);
}
console.log("ALL CHECKS PASSED");
