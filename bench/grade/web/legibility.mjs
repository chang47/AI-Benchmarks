// Text legibility over LIVE backgrounds (canvas/WebGL/video), which axe-core cannot judge: axe compares
// text against the CSS background colour, so white text over a bright WebGL galaxy core still "passes".
// Caught 2026-09-26 by Josh on the task-18 hero ("the text makes it hard to see").
//
// Method, per visible text element: read its computed colour, hide just that element's text (colour
// transparent, no shadow), screenshot its box, then take the brightest 10% of background pixels
// (the worst case for light text; the darkest 10% for dark text). Compute the WCAG 2.x contrast
// ratio against the text colour. Pass = >= 4.5:1 for normal text, >= 3:1 for large text
// (>= 24px, or >= 18.66px bold). Text shadows are ignored (conservative). Scrims or overlays
// drawn by other elements DO count, since they are part of the background.
//
// Usage (inside a Playwright script):
//   import { measureLegibility } from "./legibility.mjs";
//   const rows = await measureLegibility(page, { selector: "h1, h2, h3, p, blockquote, .count, a.cta, button, label" });

const lum = ([r, g, b]) => {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => { const [hi, lo] = a > b ? [a, b] : [b, a]; return (hi + 0.05) / (lo + 0.05); };

export async function measureLegibility(page, { selector = "h1, h2, h3, p, blockquote, figcaption, .count, a.cta, button, label", maxElements = 40, samples = 3, sampleGapMs = 450 } = {}) {
  const targets = await page.evaluate(({ selector, maxElements }) => {
    const vw = innerWidth, vh = innerHeight, out = [];
    document.querySelectorAll(selector).forEach((el, i) => {
      if (out.length >= maxElements) return;
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      if (r.width < 4 || r.height < 4 || r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) return;
      // effective opacity: an element inside a transparent parent (e.g. a hidden carousel slide) is not visible text
      let op = 1; for (let a = el; a && a !== document.documentElement; a = a.parentElement) op *= Number(getComputedStyle(a).opacity);
      if (cs.visibility === "hidden" || op < 0.5 || !(el.textContent || "").trim()) return;
      // skip elements whose own box is opaque-backed (buttons with solid fills are judged by axe)
      const bg = cs.backgroundColor.match(/[\d.]+/g) || [];
      if (bg.length === 4 && Number(bg[3]) > 0.9) return;
      el.setAttribute("data-legibility-id", String(i));
      const x = Math.max(0, r.left), y = Math.max(0, r.top);
      out.push({ id: String(i), tag: el.tagName.toLowerCase(), text: el.textContent.trim().replace(/\s+/g, " ").slice(0, 60),
        color: cs.color, size: parseFloat(cs.fontSize), weight: Number(cs.fontWeight) || 400,
        clip: { x, y, width: Math.min(vw, r.right) - x, height: Math.min(vh, r.bottom) - y } });
    });
    return out;
  }, { selector, maxElements });

  const rows = [];
  // Hide ALL text while sampling, so the background is the live scene plus any scrims/boxes. Otherwise
  // unrelated text drifting through (a carousel's next quote fading in) is counted as "background".
  const HIDE = "*{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;caret-color:transparent!important}";
  const shots = [];
  await page.evaluate((css) => { const st = document.createElement("style"); st.id = "__legibility_hide"; st.textContent = css; document.head.appendChild(st); }, HIDE);
  for (let k = 0; k < samples; k++) {
    // Live backgrounds move (a rotating galaxy arm passes behind the text), so sample several moments; worst wins.
    await page.waitForTimeout(k ? sampleGapMs : 120);
    shots.push(await page.screenshot());
  }
  await page.evaluate(() => document.getElementById("__legibility_hide")?.remove());
  const dpr = await page.evaluate(() => devicePixelRatio);

  for (const t of targets) {
    const pngs = shots;
    // decode in-page (no native PNG decoder needed in Node); keep the worst sample
    const fg = (t.color.match(/[\d.]+/g) || [255, 255, 255]).slice(0, 3).map(Number);
    const Lf = lum(fg), light = Lf > 0.5;
    const large = t.size >= 24 || (t.size >= 18.66 && t.weight >= 700);
    let r = Infinity;
    for (const png of pngs) {
      const lums = await page.evaluate(async ({ b64, clip, dpr }) => {
        const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
        const c = document.createElement("canvas"); const w = (c.width = Math.max(1, Math.round(clip.width / 2))), h = (c.height = Math.max(1, Math.round(clip.height / 2)));
        const x = c.getContext("2d"); x.drawImage(img, clip.x * dpr, clip.y * dpr, clip.width * dpr, clip.height * dpr, 0, 0, w, h);
        const d = x.getImageData(0, 0, w, h).data, out = [];
        for (let i = 0; i < d.length; i += 4) out.push([d[i], d[i + 1], d[i + 2]]);
        return out;
      }, { b64: png.toString("base64"), clip: t.clip, dpr });
      const Ls = lums.map(lum).sort((a, b) => a - b);
      const worst = light ? Ls[Math.floor(Ls.length * 0.9)] : Ls[Math.floor(Ls.length * 0.1)];
      r = Math.min(r, ratio(Lf, worst));
    }
    rows.push({ tag: t.tag, text: t.text, size: t.size, large, ratio: Number(r.toFixed(2)), need: large ? 3 : 4.5, pass: r >= (large ? 3 : 4.5) });
  }
  await page.evaluate(() => document.querySelectorAll("[data-legibility-id]").forEach((e) => e.removeAttribute("data-legibility-id")));
  return rows;
}
