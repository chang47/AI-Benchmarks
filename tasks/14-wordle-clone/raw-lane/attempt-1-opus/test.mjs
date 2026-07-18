import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import path from 'path';

const url = pathToFileURL(path.resolve('index.html')).href;

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  -> ' + JSON.stringify(extra) : '')); }
}

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));
await page.goto(url);
await page.waitForFunction(() => !!window.__wordle && Array.isArray(window.ANSWERS) && window.ANSWERS.length > 0);

console.log('--- evaluate() coloring ---');
// straightforward
ok('CRANE vs CRANE all green',
  JSON.stringify(await page.evaluate(() => window.__wordle.evaluate('CRANE','CRANE'))) ===
  JSON.stringify(['green','green','green','green','green']));
// no overlap
ok('MOUND vs CRYPT all gray',
  JSON.stringify(await page.evaluate(() => window.__wordle.evaluate('MOUND','CRYPT'))) ===
  JSON.stringify(['gray','gray','gray','gray','gray']));
// yellow/green mix: answer ROBOT (R,O,B,O,T), guess ABOUT (A,B,O,U,T)
// A gray; B present in ROBOT -> yellow; O present -> yellow; U gray; T pos4 -> green
ok('ROBOT vs ABOUT',
  JSON.stringify(await page.evaluate(() => window.__wordle.evaluate('ROBOT','ABOUT'))) ===
  JSON.stringify(['gray','yellow','yellow','gray','green']),
  await page.evaluate(() => window.__wordle.evaluate('ROBOT','ABOUT')));

// duplicate handling: answer ABBEY, guess KEBAB
// answer A B B E Y ; guess K E B A B
// pos0 K vs A no; pos1 E vs B no; pos2 B vs B green (consume one B, remaining B:1); pos3 A vs E no; pos4 B vs Y no
// pass2: K gray; E in answer? yes(1) -> yellow (consume E); B(pos4) remaining B:1 -> yellow (consume); A(pos3) remaining A? A:1 -> yellow
// order pass2 left->right: pos0 K gray; pos1 E yellow; pos3 A yellow; pos4 B yellow
ok('ABBEY vs KEBAB (dupes)',
  JSON.stringify(await page.evaluate(() => window.__wordle.evaluate('ABBEY','KEBAB'))) ===
  JSON.stringify(['gray','yellow','green','yellow','yellow']),
  await page.evaluate(() => window.__wordle.evaluate('ABBEY','KEBAB')));

// classic duplicate trap: answer ALLAY, guess LLAMA
// answer A L L A Y ; guess L L A M A
// pos0 L vs A no; pos1 L vs L green (consume L rem L:1); pos2 A vs L no; pos3 M vs A no; pos4 A vs Y no
// pass2: pos0 L rem L:1 -> yellow(consume, L:0); pos2 A rem A:2 -> yellow(A:1); pos3 M gray; pos4 A rem A:1 -> yellow(A:0)
ok('ALLAY vs LLAMA (dupes)',
  JSON.stringify(await page.evaluate(() => window.__wordle.evaluate('ALLAY','LLAMA'))) ===
  JSON.stringify(['yellow','green','yellow','gray','yellow']),
  await page.evaluate(() => window.__wordle.evaluate('ALLAY','LLAMA')));

// answer has single S, guess has two S: only one should color, extra gray
// answer BASIC, guess SASSY
// answer B A S I C ; guess S A S S Y
// pos0 S vs B no; pos1 A vs A green (consume A); pos2 S vs S green (consume S, S rem 0); pos3 S vs I no; pos4 Y no
// pass2: pos0 S rem 0 -> gray; pos3 S rem 0 -> gray; pos4 Y gray
ok('BASIC vs SASSY (single S only one colors)',
  JSON.stringify(await page.evaluate(() => window.__wordle.evaluate('BASIC','SASSY'))) ===
  JSON.stringify(['gray','green','green','gray','gray']),
  await page.evaluate(() => window.__wordle.evaluate('BASIC','SASSY')));

console.log('--- submitGuess + state + keyboard ---');
// Set a known answer that is guaranteed valid
await page.evaluate(() => window.__wordle.newGame('CRANE'));

// invalid: wrong length
ok('reject bad length', await page.evaluate(() => window.__wordle.submitGuess('CRAN').accepted) === false);
// invalid: not in list (gibberish)
let notInList = await page.evaluate(() => window.__wordle.submitGuess('ZZZZZ'));
ok('reject gibberish not in list', notInList.accepted === false && notInList.reason === 'not_in_list', notInList);
// guess-count not consumed by rejects
ok('rejects do not consume a guess', await page.evaluate(() => window.__wordle.state().rows.length) === 0);

// a valid guess that is in VALID_GUESSES
let valid = await page.evaluate(() => window.__wordle.submitGuess('SLATE'));
ok('accept valid guess SLATE', valid.accepted === true && Array.isArray(valid.colors), valid);
ok('state has 1 row', await page.evaluate(() => window.__wordle.state().rows.length) === 1);
ok('not won yet', await page.evaluate(() => window.__wordle.state().won) === false);

// keyboard reflects best-known
let kb = await page.evaluate(() => window.__wordle.keyboardState());
ok('keyboard has entries after guess', Object.keys(kb).length > 0, kb);

// winning guess
let win = await page.evaluate(() => window.__wordle.submitGuess('CRANE'));
ok('winning guess all green + win flag', win.accepted && win.win === true && win.over === true &&
  JSON.stringify(win.colors) === JSON.stringify(['green','green','green','green','green']), win);
ok('state won=true over=true', await page.evaluate(() => { const s = window.__wordle.state(); return s.won && s.over; }));
// no further guesses accepted
ok('no guess after game over', await page.evaluate(() => window.__wordle.submitGuess('SLATE').accepted) === false);

// loss path
await page.evaluate(() => window.__wordle.newGame('CRANE'));
const wrongs = ['SLATE','MOUND','PLUMB','GHOST','WHISK','FJORD'];
let lastLoss = null;
for (const w of wrongs) {
  lastLoss = await page.evaluate((word) => window.__wordle.submitGuess(word), w);
}
ok('6 wrong -> over, not won', lastLoss && lastLoss.over === true && lastLoss.win === false, lastLoss);
ok('loss state: over true won false', await page.evaluate(() => { const s = window.__wordle.state(); return s.over === true && s.won === false; }));

// keyboard priority: green beats yellow beats gray (E in CRANE at pos4)
await page.evaluate(() => window.__wordle.newGame('CRANE'));
await page.evaluate(() => window.__wordle.submitGuess('EERIE')); // E appears; answer CRANE has one E at pos4
let kb2 = await page.evaluate(() => window.__wordle.keyboardState());
ok('keyboard E is green (present at correct pos in a later slot)', kb2.E === 'green', kb2);

console.log('--- console errors ---');
ok('no page/console errors', errors.length === 0, errors);

// random answer is a real answer word
await page.evaluate(() => window.__wordle.newGame());
let rndOk = await page.evaluate(() => window.ANSWERS.includes(window.__wordle.state().answer));
ok('random answer is from ANSWERS', rndOk);

await browser.close();
console.log('\n== RESULT: ' + pass + ' passed, ' + fail + ' failed ==');
process.exit(fail === 0 ? 0 : 1);
