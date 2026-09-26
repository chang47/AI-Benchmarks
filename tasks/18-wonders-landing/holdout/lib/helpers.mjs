// Shared helpers for the task-18 grader: page geometry, scrolling, pixel diffs, style snapshots.
import { PNG } from "pngjs";

export const SECTIONS = ["hero", "meteors", "volcano", "waterfall", "wonders", "ocean", "voices", "join"];
export const SCENES = { galaxy: "hero", meteors: "meteors", waterfall: "waterfall", ocean: "ocean" };
export const wait = (page, ms) => page.waitForTimeout(ms);

// Everything that is text or the custom cursor becomes invisible, so pixel diffs see only the scene.
export const HIDE_TEXT_CSS = "*{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;caret-color:transparent!important}[data-cursor],[data-cursor-trail]{visibility:hidden!important}";

export async function withStyle(page, css, fn) {
  const id = `__g${Math.random().toString(36).slice(2, 8)}`;
  await page.evaluate(({ id, css }) => { const s = document.createElement("style"); s.id = id; s.textContent = css; document.head.appendChild(s); }, { id, css });
  try { return await fn(); } finally { await page.evaluate((id) => document.getElementById(id)?.remove(), id).catch(() => {}); }
}

/** Document-space box of a section: top, height, and the viewport height. */
export const sectionBox = (page, id) => page.evaluate((id) => {
  const s = document.querySelector(`[data-section="${id}"]`);
  if (!s) return null;
  const r = s.getBoundingClientRect();
  return { top: r.top + scrollY, height: r.height, vh: innerHeight, vw: innerWidth, max: document.scrollingElement.scrollHeight - innerHeight };
}, id);

export async function scrollToY(page, y, settleMs = 0) {
  await page.evaluate((y) => window.scrollTo({ top: y, left: 0, behavior: "instant" }), Math.max(0, Math.round(y)));
  if (settleMs) await wait(page, settleMs);
  return page.evaluate(() => scrollY);
}

/** Scroll so a section's scene is the thing on screen (a little way in; tall/pinned sections go 30% of a viewport in). */
export async function showSection(page, id, settleMs = 900) {
  const b = await sectionBox(page, id);
  if (!b) return null;
  const inset = id === "hero" ? 0 : b.height > b.vh ? Math.min(b.height - b.vh, b.vh * 0.3) : 0;
  return scrollToY(page, b.top + inset, settleMs);
}

export const decode = (buf) => PNG.sync.read(buf);

/** Mean absolute channel difference and the fraction of pixels that changed by > 24 in any channel, inside an optional rect. */
export function diff(a, b, rect) {
  const A = decode(a), B = decode(b);
  const x0 = rect ? Math.max(0, Math.round(rect.x)) : 0, y0 = rect ? Math.max(0, Math.round(rect.y)) : 0;
  const x1 = rect ? Math.min(A.width, Math.round(rect.x + rect.width)) : A.width, y1 = rect ? Math.min(A.height, Math.round(rect.y + rect.height)) : A.height;
  let sum = 0, changed = 0, n = 0;
  for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) {
    const i = (y * A.width + x) * 4;
    const d = Math.max(Math.abs(A.data[i] - B.data[i]), Math.abs(A.data[i + 1] - B.data[i + 1]), Math.abs(A.data[i + 2] - B.data[i + 2]));
    sum += d; if (d > 24) changed++; n++;
  }
  return { mean: n ? sum / n : 0, changed: n ? changed / n : 0 };
}

/** Mean luminance-ish brightness and its spread (a blank page has spread ~0). */
export function stats(buf) {
  const P = decode(buf); let s = 0, s2 = 0, n = 0;
  for (let i = 0; i < P.data.length; i += 16) { const v = (P.data[i] + P.data[i + 1] + P.data[i + 2]) / 3; s += v; s2 += v * v; n++; }
  const m = s / n; return { mean: m, sd: Math.sqrt(Math.max(0, s2 / n - m * m)) };
}

/** Visual state of an element and its direct children (opacity, transform, clip, filter), for before/after comparisons. */
export const styleSnap = (page, sel) => page.evaluate((sel) => {
  const el = document.querySelector(sel);
  if (!el) return null;
  const one = (e) => { const c = getComputedStyle(e), r = e.getBoundingClientRect();
    return { o: Number(c.opacity), t: c.transform, clip: c.clipPath, f: c.filter, v: c.visibility, x: r.left, y: r.top + scrollY, w: r.width, h: r.height }; };
  return [one(el), ...[...el.children].slice(0, 6).map(one)];
}, sel);

/** Did an element (or one of its direct children) visibly change: opacity by >= 0.25, or moved/scaled/clipped? */
export function snapChanged(a, b) {
  if (!a || !b) return false;
  return a.some((p, i) => {
    const q = b[i]; if (!q) return false;
    if (Math.abs(p.o - q.o) >= 0.25 || p.v !== q.v || p.clip !== q.clip || p.f !== q.f) return true;
    if (p.t !== q.t) {
      const m = (t) => (t === "none" ? [1, 0, 0, 1, 0, 0] : (t.match(/-?[\d.e]+/g) || []).map(Number));
      const A = m(p.t), B = m(q.t);
      if (A.length === 6 && B.length === 6) return Math.abs(A[4] - B[4]) >= 6 || Math.abs(A[5] - B[5]) >= 6 || Math.abs(A[0] - B[0]) >= 0.04 || Math.abs(A[3] - B[3]) >= 0.04;
      return true; // 3d matrices that differ
    }
    return Math.abs(p.w - q.w) >= 6 || Math.abs(p.h - q.h) >= 6;
  });
}

/** Call window.__wonder safely. */
export const wonder = (page, fn, id) => page.evaluate(({ fn, id }) => {
  try { const w = window.__wonder; if (!w || typeof w[fn] !== "function") return { err: `window.__wonder.${fn} missing` }; return { v: w[fn](id) }; }
  catch (e) { return { err: String(e).slice(0, 160) }; }
}, { fn, id });

export const band = (x, bands) => { for (const [min, pts] of bands) if (x >= min) return pts; return 0; };

/** Pixels (sampled every 2px) inside rect that differ by > 40 from the image's most common colour. */
export function busy(buf, rect) {
  const P = decode(buf), hist = new Map();
  for (let i = 0; i < P.data.length; i += 64) { const k = `${P.data[i] >> 3},${P.data[i + 1] >> 3},${P.data[i + 2] >> 3}`; hist.set(k, (hist.get(k) || 0) + 1); }
  const mode = [...hist.entries()].sort((a, b) => b[1] - a[1])[0][0].split(",").map((v) => Number(v) * 8 + 4);
  let n = 0;
  for (let y = Math.max(0, Math.round(rect.y)); y < Math.min(P.height, rect.y + rect.height); y += 2) for (let x = Math.max(0, Math.round(rect.x)); x < Math.min(P.width, rect.x + rect.width); x += 2) {
    const i = (y * P.width + x) * 4;
    if (Math.max(Math.abs(P.data[i] - mode[0]), Math.abs(P.data[i + 1] - mode[1]), Math.abs(P.data[i + 2] - mode[2])) > 40) n++;
  }
  return n;
}

/** Mean absolute difference of 8×8 block averages: film grain and single-pixel twinkle cancel out, camera moves don't. */
export function blockDiff(a, b, block = 8) {
  const A = decode(a), B = decode(b);
  let sum = 0, n = 0;
  for (let by = 0; by + block <= A.height; by += block) for (let bx = 0; bx + block <= A.width; bx += block) {
    let sa = 0, sb = 0;
    for (let y = by; y < by + block; y += 2) for (let x = bx; x < bx + block; x += 2) {
      const i = (y * A.width + x) * 4;
      sa += A.data[i] + A.data[i + 1] + A.data[i + 2]; sb += B.data[i] + B.data[i + 1] + B.data[i + 2];
    }
    sum += Math.abs(sa - sb) / (3 * (block / 2) ** 2); n++;
  }
  return n ? sum / n : 0;
}
