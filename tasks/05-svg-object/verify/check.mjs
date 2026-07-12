// Independent verifier round 0 — task 05-svg-object
// Checks spec acceptance criteria programmatically where possible.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const svgPath = path.join(here, '..', 'src', 'object.svg');
const outDir = path.join(here, 'round-0');
const results = { checks: {}, consoleErrors: [], pageErrors: [], notes: {} };

const svgText = readFileSync(svgPath, 'utf8');

// ---------- static text-level contract checks ----------
results.checks.file_exists = svgText.length > 0;

// Build the minimal host page with the SVG inlined
const html = `<!doctype html><html><head><meta charset="utf-8"><title>svg-verify</title></head><body style="margin:0;background:#fff">${svgText}</body></html>`;
const pagePath = path.join(outDir, 'page.html');
writeFileSync(pagePath, html);

let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
} catch (e) {
  console.error('chrome channel failed: ' + e.message);
  browser = await chromium.launch({ headless: true });
}
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
page.on('console', (msg) => { if (msg.type() === 'error') results.consoleErrors.push(msg.text()); });
page.on('pageerror', (err) => results.pageErrors.push(String(err)));

await page.goto(pathToFileURL(pagePath).href);
const shot0 = await page.screenshot({ path: path.join(outDir, 'shot-0s.png') });
await page.waitForTimeout(3000);
const shot3 = await page.screenshot({ path: path.join(outDir, 'shot-3s.png') });

// static image => screenshots should be (near-)identical; also proves no animation running
let diffBytes = 0;
if (shot0.length === shot3.length) {
  for (let i = 0; i < shot0.length; i++) if (shot0[i] !== shot3[i]) diffBytes++;
} else diffBytes = -1;
results.notes.screenshotDiffBytes = diffBytes;

// ---------- in-page checks ----------
const inPage = await page.evaluate((src) => {
  const out = { contract: {}, geom: {}, notes: {} };

  // XML well-formedness of the raw file
  const doc = new DOMParser().parseFromString(src, 'image/svg+xml');
  out.contract.wellFormedXML = doc.getElementsByTagName('parsererror').length === 0;

  const svg = document.querySelector('svg');
  out.contract.rootNamespace = svg && svg.namespaceURI === 'http://www.w3.org/2000/svg';
  out.contract.hasViewBox = !!(svg && svg.getAttribute('viewBox'));

  const all = [...svg.querySelectorAll('*')];
  out.contract.noScript = svg.querySelectorAll('script').length === 0 && !/<script/i.test(src);
  out.contract.noEventHandlers = ![svg, ...all].some((el) => [...el.attributes].some((a) => /^on/i.test(a.name)));
  out.contract.noSMIL = all.every((el) => !['animate', 'animateTransform', 'animateMotion', 'set'].includes(el.tagName));
  const styleTexts = [...svg.querySelectorAll('style')].map((s) => s.textContent).join(' ') +
    ' ' + [svg, ...all].map((el) => el.getAttribute('style') || '').join(' ');
  out.contract.noCSSAnimation = !/animation|transition/i.test(styleTexts);
  out.contract.noImageElements = all.every((el) => el.tagName.toLowerCase() !== 'image');
  // external refs: any non-xmlns attribute containing a URL, any href, any data: raster
  const badAttrs = [];
  for (const el of [svg, ...all]) {
    for (const a of el.attributes) {
      if (/^xmlns(:|$)/.test(a.name)) continue;
      if (/https?:\/\//i.test(a.value)) badAttrs.push(el.tagName + '@' + a.name);
      if (/^(xlink:)?href$/i.test(a.name)) badAttrs.push(el.tagName + '@' + a.name);
      if (/data:image|;base64,/i.test(a.value)) badAttrs.push(el.tagName + '@' + a.name + ':data-uri');
    }
  }
  out.contract.noExternalRefs = badAttrs.length === 0;
  out.notes.badAttrs = badAttrs;

  const vb = svg.viewBox.baseVal;
  out.geom.viewBox = { x: vb.x, y: vb.y, w: vb.width, h: vb.height };

  // wheels = two largest circles at distinct centers
  const circles = [...svg.querySelectorAll('circle')].map((c) => ({
    cx: c.cx.baseVal.value, cy: c.cy.baseVal.value, r: c.r.baseVal.value,
  })).sort((a, b) => b.r - a.r);
  const w1 = circles[0];
  const w2 = circles.find((c) => Math.hypot(c.cx - w1.cx, c.cy - w1.cy) > w1.r);
  out.geom.wheels = [w1, w2];
  out.geom.wheelSizeRatioOK = Math.abs(w1.r - w2.r) / Math.max(w1.r, w2.r) <= 0.25;
  const b1 = w1.cy + w1.r, b2 = w2.cy + w2.r;
  out.geom.wheelBottoms = [b1, b2];
  out.geom.groundLineOK = Math.abs(b1 - b2) <= 0.05 * vb.height;

  // frame connection: thick lines with an endpoint near each hub
  const lines = [...svg.querySelectorAll('line')].map((l) => ({
    x1: l.x1.baseVal.value, y1: l.y1.baseVal.value, x2: l.x2.baseVal.value, y2: l.y2.baseVal.value,
    sw: parseFloat(getComputedStyle(l).strokeWidth) || 0,
  }));
  const near = (x, y, hub, tol) => Math.hypot(x - hub.cx, y - hub.cy) <= tol;
  const hubTol = 15;
  out.geom.frameToRearHub = lines.filter((l) => l.sw >= 6 && (near(l.x1, l.y1, w1.cx < w2.cx ? w1 : w2, hubTol) || near(l.x2, l.y2, w1.cx < w2.cx ? w1 : w2, hubTol))).length;
  out.geom.frameToFrontHub = lines.filter((l) => l.sw >= 6 && (near(l.x1, l.y1, w1.cx < w2.cx ? w2 : w1, hubTol) || near(l.x2, l.y2, w1.cx < w2.cx ? w2 : w1, hubTol))).length;

  // chainring/bottom bracket: mid-size circle between the wheels
  const bb = circles.find((c) => c.r > 10 && c.r < 40 && c.cy > vb.height * 0.55 && c.cx > Math.min(w1.cx, w2.cx) && c.cx < Math.max(w1.cx, w2.cx));
  out.geom.bottomBracket = bb || null;
  // pedals: rects near the bottom bracket
  const rects = [...svg.querySelectorAll('rect')].map((r) => ({
    x: r.x.baseVal.value, y: r.y.baseVal.value, w: r.width.baseVal.value, h: r.height.baseVal.value,
  }));
  out.geom.pedalRects = bb ? rects.filter((r) => Math.hypot(r.x + r.w / 2 - bb.cx, r.y + r.h / 2 - bb.cy) < 120).length : 0;
  // cranks: lines from bottom bracket
  out.geom.crankLines = bb ? lines.filter((l) => near(l.x1, l.y1, bb, 8) || near(l.x2, l.y2, bb, 8)).length : 0;

  // containment: every drawn element's bbox (+stroke/2) inside the viewBox
  const shapes = [...svg.querySelectorAll('rect,circle,ellipse,line,path,polygon,polyline')];
  const overflows = [];
  for (const el of shapes) {
    const b = el.getBBox();
    const sw = (parseFloat(getComputedStyle(el).strokeWidth) || 0) / 2;
    const over = Math.max(
      (vb.x - (b.x - sw)), (vb.y - (b.y - sw)),
      ((b.x + b.width + sw) - (vb.x + vb.width)), ((b.y + b.height + sw) - (vb.y + vb.height)), 0,
    );
    if (over > 0.5) overflows.push({ tag: el.tagName, over: Math.round(over * 10) / 10, bbox: [b.x, b.y, b.width, b.height], sw: sw * 2 });
  }
  out.geom.overflows = overflows;
  out.geom.shapeCount = shapes.length;

  // legs on opposite sides: paths stroked in the two leg colors, one before the wheels in
  // document order (behind) and one after the frame (in front)
  const paths = [...svg.querySelectorAll('path,line')];
  const wheelEl = [...svg.querySelectorAll('circle')].find((c) => c.r.baseVal.value === w1.r);
  const order = (el) => all.indexOf(el);
  const legLike = paths.filter((p) => {
    const cs = getComputedStyle(p);
    const swv = parseFloat(cs.strokeWidth) || 0;
    return swv >= 10 && /rgb\(2?\d?\d, 1[0-5]\d, \d+\)|rgb\(176, 106, 30\)|rgb\(232, 145, 45\)/.test(cs.stroke);
  }).map((p) => ({ order: order(p), stroke: getComputedStyle(p).stroke, d: p.getAttribute('d') || 'line' }));
  out.geom.legStrokes = legLike;
  out.geom.wheelOrder = order(wheelEl);

  // pelican body position: largest ellipse; must sit horizontally between hubs and above them
  const ell = [...svg.querySelectorAll('ellipse')].map((e) => ({
    cx: e.cx.baseVal.value, cy: e.cy.baseVal.value, rx: e.rx.baseVal.value, ry: e.ry.baseVal.value,
  })).sort((a, b) => b.rx * b.ry - a.rx * a.ry)[0];
  out.geom.body = ell;
  out.geom.bodyBetweenWheels = ell && ell.cx > Math.min(w1.cx, w2.cx) && ell.cx < Math.max(w1.cx, w2.cx) && ell.cy < Math.min(w1.cy, w2.cy) - Math.max(w1.r, w2.r) * 0.5;

  // beak vs head: head = circle r 15..40 above the frame; beak = the wide orange path
  const head = circles.find((c) => c.r >= 15 && c.r <= 40 && c.cy < 250);
  out.geom.head = head || null;
  const beakEl = [...svg.querySelectorAll('path')].find((p) => {
    const f = getComputedStyle(p).fill;
    return /rgb\(245, 166, 35\)/.test(f);
  });
  if (beakEl && head) {
    const bb2 = beakEl.getBBox();
    out.geom.beak = { w: bb2.width, h: bb2.height, x: bb2.x, y: bb2.y };
    out.geom.beakLongerThanHead = bb2.width > 2 * head.r;
  }

  // distinguishable colors: count distinct fill/stroke colors
  const colors = new Set();
  for (const el of shapes) {
    const cs = getComputedStyle(el);
    if (cs.fill && cs.fill !== 'none') colors.add(cs.fill);
    if (cs.stroke && cs.stroke !== 'none') colors.add(cs.stroke);
  }
  out.geom.distinctColors = colors.size;

  return out;
}, svgText);

results.inPage = inPage;

// element-level render check: svg has non-zero rendered size
results.checks.svgRendered = await page.evaluate(() => {
  const r = document.querySelector('svg').getBoundingClientRect();
  return r.width > 100 && r.height > 100;
});

await browser.close();
writeFileSync(path.join(outDir, 'results.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
