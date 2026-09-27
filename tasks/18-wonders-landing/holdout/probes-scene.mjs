// Task-18 probes, part 1: loads clean, content, scenes animate, scroll choreography (40 pts).
import { HIDE_TEXT_CSS, SCENES, SECTIONS, band, blockDiff, diff, scrollToY, sectionBox, showSection, snapChanged, stats, styleSnap, wait, withStyle, wonder } from "./lib/helpers.mjs";

const COPY = {
  C1: ["Galaxy", "Sky", "Volcano", "Waterfall", "Wonders", "Ocean", "Voices", "Join", "Wonders of the Universe",
    "A journey from the edge of the galaxy to the waves at your feet.", "Begin the journey", "Where the sky falls",
    "On the highest ridges the night opens up, and every few seconds a grain of ancient dust burns across it."],
  C2: ["The earth breathes fire", "Scroll to wake the mountain. Deep below, rock melts into rivers of light.",
    "Water that never stops", "A river leaps from the cliff and becomes mist, rain, and forest."],
  C3: ["More wonders", "Aurora", "Curtains of charged light over the poles.", "Nebula", "Clouds where new stars are born.",
    "Coral reef", "A city built by living stone.", "Singing dunes", "Sand that hums when the wind moves it.", "Lightning",
    "Five times hotter than the surface of the sun.", "Glowing bay", "Waves that shine blue when you touch them.",
    "The tide remembers the moon", "galaxies in the observable universe"],
  C4: ["What people felt", "I forgot I was looking at a screen.", "Mira, stargazer", "It felt like the night sky was breathing.",
    "Kenji, photographer", "I scrolled back up just to watch the volcano again.", "Ana, geologist",
    "Quiet, strange, and beautiful. Like the universe.", "Theo, student", "Get the wonder letter",
    "One strange and beautiful thing from the universe, every month.", "Email address", "Send me wonders",
    "Made with code, light, and curiosity."],
};
const NAV = ["Galaxy", "Sky", "Volcano", "Waterfall", "Wonders", "Ocean", "Voices", "Join"];
const norm = (s) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ");

export async function probeLoadAndContent(page, ctx) {
  const out = [];
  const present = await page.evaluate((ids) => {
    const all = [...document.querySelectorAll("[data-section]")].map((e) => e.getAttribute("data-section"));
    return { all, missing: ids.filter((id) => !all.includes(id)), ordered: ids.every((id, i) => !i || all.indexOf(ids[i - 1]) < all.indexOf(id)) };
  }, SECTIONS);
  out.push({ id: "L3", group: "Loads clean", name: "all 8 data-sections exist, in order", points: 2,
    earned: !present.missing.length && present.ordered ? 2 : 0, detail: present.missing.length ? `missing: ${present.missing.join(", ")}` : `found: ${present.all.join(", ")}${present.ordered ? "" : " (out of order)"}` });

  // Counter: scroll to the ocean and let it count, so the final value is in the text.
  await showSection(page, "ocean", 4500);
  const counter = await page.evaluate(() => document.querySelector("[data-counter]")?.textContent?.trim() ?? null);
  const text = norm(await page.evaluate(() => document.body.textContent));
  for (const [id, strings] of Object.entries(COPY)) {
    const miss = strings.filter((s) => !text.includes(norm(s)));
    const extra = id === "C3" && !(counter || "").replace(/\s/g, "").includes("2,000,000,000,000") ? [`counter shows "${counter}" (want 2,000,000,000,000)`] : [];
    const bad = [...miss.map((m) => `missing "${m.slice(0, 50)}"`), ...extra];
    out.push({ id, group: "Content", name: { C1: "copy: nav, hero, meteors", C2: "copy: volcano, waterfall", C3: "copy: wonders, ocean (+ counter reaches 2,000,000,000,000)", C4: "copy: voices, join, footer" }[id],
      points: 1, earned: bad.length ? 0 : 1, detail: bad.length ? bad.slice(0, 4).join("; ") : `${strings.length} strings present` });
  }

  // Nav links: click each (desktop) and see the page land on its section.
  const landed = [];
  for (const label of [...NAV.slice(1), NAV[0]]) {
    const id = SECTIONS[NAV.indexOf(label)];
    const link = page.locator("nav a, header a").filter({ hasText: new RegExp(`^\\s*${label}\\s*$`) }).first();
    if (!(await link.count()) || !(await link.isVisible().catch(() => false))) { landed.push(`${label}:no-link`); continue; }
    await link.click({ timeout: 3000 }).catch(() => {});
    let last = -1;
    for (let k = 0; k < 16; k++) { await wait(page, 250); const y = await page.evaluate(() => scrollY); if (y === last) break; last = y; }
    const ok = await page.evaluate((id) => {
      const r = document.querySelector(`[data-section="${id}"]`)?.getBoundingClientRect(); if (!r) return false;
      const vh = innerHeight, atBottom = scrollY + vh >= document.scrollingElement.scrollHeight - 4;
      return (r.top <= vh * 0.5 && r.bottom >= vh * 0.5) || Math.abs(r.top) <= vh * 0.15 || (atBottom && r.top < vh * 0.9 && r.bottom > 0);
    }, id);
    landed.push(`${label}:${ok ? "ok" : "MISSED"}`);
  }
  const good = landed.filter((l) => l.endsWith(":ok")).length;
  out.push({ id: "C5", group: "Content", name: "every nav link lands on its section", points: 2, earned: band(good, [[8, 2], [6, 1]]), detail: `${good}/8 — ${landed.join(" ")}` });
  return out;
}

/** Pixel activity of the scene (text + cursor hidden) over `ms`. */
async function activity(page, ms = 1000) {
  return withStyle(page, HIDE_TEXT_CSS, async () => {
    await wait(page, 150);
    const a = await page.screenshot(); await wait(page, ms); const b = await page.screenshot();
    return { ...diff(a, b), sd: stats(b).sd };
  });
}

export async function probeScenes(page, ctx) {
  const out = [];
  await page.mouse.move(5, 5);
  for (const [scene, sec] of Object.entries(SCENES)) {
    await showSection(page, sec, 1200);
    const a = await activity(page, 1000);
    const pass = a.changed >= 0.0015 && a.sd > 4; // 0.15%: a sparse meteor sky moves few pixels (Opus 5.5: 0.49%, clearly animating); frozen ≈ 0
    out.push({ id: `S-${scene}`, group: "Scenes animate", name: `${scene} scene animates while visible`, points: 2, earned: pass ? 2 : 0,
      detail: `${(a.changed * 100).toFixed(2)}% of pixels changed in 1 s (need >= 0.15%), mean Δ ${a.mean.toFixed(2)}, image spread ${a.sd.toFixed(1)}` });
  }

  // Galaxy reacts to the mouse: pixel change while the mouse sweeps vs. while it is parked.
  await showSection(page, "hero", 1200);
  const vw = ctx.vw, vh = ctx.vh;
  // Corner-to-corner sweeps vs. equally long parked windows (the scene keeps animating either way).
  const r = await withStyle(page, HIDE_TEXT_CSS, async () => {
    const still = [], moved = [], corners = [[vw * 0.07, vh * 0.9], [vw * 0.93, vh * 0.1]];
    for (let k = 0; k < 2; k++) {
      await page.mouse.move(...corners[k], { steps: 6 }); await wait(page, 1500);
      const a = await page.screenshot(); await wait(page, 1000); const b = await page.screenshot();
      await page.mouse.move(...corners[1 - k], { steps: 10 }); await wait(page, 1000); const c = await page.screenshot();
      still.push(blockDiff(a, b)); moved.push(blockDiff(b, c)); // block averages: grain/twinkle cancel, a camera or particle shift does not
    }
    // Best sweep counts: the reference reacts strongly in one direction and weakly in the other.
    return { still: Math.max(...still), moved: Math.max(...moved) };
  });
  const react = r.moved >= r.still * 1.25 + 0.3; // calibrated 2026-09-26: no-mouse mutation 1.08-1.09×, reference 1.5-2.0×
  out.push({ id: "S-mouse", group: "Scenes animate", name: "galaxy responds to mouse movement", points: 2, earned: react ? 2 : 0,
    detail: `best 8×8-block Δ over 1 s after a corner-to-corner mouse sweep ${r.moved.toFixed(2)} vs worst 1 s parked ${r.still.toFixed(2)} (need >= 1.25× + 0.3)` });

  out.push(ctx.titleAnim);
  return out;
}

/** Title animates on load: measured on a fresh page from the very first frame. */
export async function probeTitleOnLoad(page, url) {
  await page.goto(url, { waitUntil: "commit" });
  await page.waitForSelector('[data-anim="hero-title"]', { timeout: 10000 }).catch(() => {});
  const early = await styleSnap(page, '[data-anim="hero-title"]');
  const anims = await page.evaluate(() => {
    const t = document.querySelector('[data-anim="hero-title"]'); if (!t) return 0;
    return document.getAnimations().filter((a) => a.effect?.target && (t === a.effect.target || t.contains(a.effect.target))).length;
  }).catch(() => 0);
  await wait(page, 3000);
  const late = await styleSnap(page, '[data-anim="hero-title"]');
  const ok = !!early && (anims > 0 || snapChanged(early, late));
  return { id: "S-title", group: "Scenes animate", name: "title animates on load", points: 2, earned: ok ? 2 : 0,
    detail: !early ? 'no [data-anim="hero-title"] element' : `${anims} running animation(s) on the title at first paint; style changed first-paint→3 s: ${snapChanged(early, late)}` };
}

/** Progress + pin sampling through a scroll-driven section. */
async function sweep(page, id, trackSel) {
  const b = await sectionBox(page, id);
  if (!b) return null;
  const from = b.top - b.vh * 0.25, to = b.top + Math.max(b.height - b.vh, 0) + b.vh * 0.1, rows = [];
  for (let k = 0; k <= 10; k++) {
    const y = await scrollToY(page, from + ((to - from) * k) / 10, 650);
    const p = await wonder(page, "progress", id);
    const geo = await page.evaluate(({ id, trackSel }) => {
      const s = document.querySelector(`[data-section="${id}"]`), r = s.getBoundingClientRect();
      const h = document.querySelector(`[data-anim="${id}-text"]`)?.getBoundingClientRect();
      const t = trackSel ? [...s.querySelectorAll("*")].filter((e) => e.children.length < 8 && /Aurora/.test(e.textContent) && /Curtains of charged light/.test(e.textContent)).sort((a, c) => a.textContent.length - c.textContent.length)[0]?.getBoundingClientRect() : null;
      return { top: r.top, bottom: r.bottom, head: h ? [h.top, h.bottom] : null, card: t ? [t.left, t.top, t.width] : null };
    }, { id, trackSel });
    rows.push({ y, p: typeof p.v === "number" ? p.v : null, err: p.err, ...geo });
  }
  return { b, rows };
}

const fmt = (rows) => rows.map((r) => (r.p == null ? "–" : r.p.toFixed(2))).join(" ");

export async function probeChoreography(page, ctx) {
  const out = [];
  // Volcano: progress rises, rewinds, and the section is pinned while it runs.
  const v = await sweep(page, "volcano", false);
  const ps = v?.rows.map((r) => r.p) || [];
  const valid = ps.length && ps.every((p) => p != null);
  const mono = valid && ps.every((p, i) => !i || p >= ps[i - 1] - 0.02);
  const lo = valid ? Math.min(...ps) : 0, hi = valid ? Math.max(...ps) : 0;
  const rise = valid && mono ? (ps[0] <= 0.1 && ps.at(-1) >= 0.9 ? 3 : hi - lo >= 0.5 ? 2 : hi - lo >= 0.2 ? 1 : 0) : 0;
  out.push({ id: "V-rise", group: "Scroll choreography", name: "volcano progress rises with scroll", points: 3, earned: rise,
    detail: v ? `progress over 11 scroll steps: ${fmt(v.rows)}${v.rows[0].err ? ` (${v.rows[0].err})` : ""}${valid && !mono ? " — not monotonic" : ""}` : "no volcano section" });

  let back = 0, backDetail = "no progress readings";
  if (valid && hi - lo >= 0.2) {
    const mid = v.rows[5];
    await scrollToY(page, v.rows[10].y, 600); await scrollToY(page, mid.y, 800);
    const pm = (await wonder(page, "progress", "volcano")).v;
    await scrollToY(page, v.rows[0].y, 800);
    const p0 = (await wonder(page, "progress", "volcano")).v;
    back = Math.abs(pm - mid.p) <= 0.15 && p0 <= lo + 0.1 ? 2 : 0;
    backDetail = `scrolling back up: mid ${pm?.toFixed(2)} (down-pass ${mid.p.toFixed(2)}), start ${p0?.toFixed(2)}`;
  }
  out.push({ id: "V-rewind", group: "Scroll choreography", name: "volcano rewinds when scrolling up", points: 2, earned: back, detail: backDetail });

  const pinned = (sw, what) => {
    const mid = sw?.rows.filter((r) => r.p != null && r.p > 0.05 && r.p < 0.95) || [];
    if (mid.length < 2) return { ok: false, why: `only ${mid.length} samples with ${what} progress strictly between 0.05 and 0.95` };
    const dist = mid.at(-1).y - mid[0].y;
    const covers = mid.every((r) => r.top <= 2 && r.bottom >= sw.b.vh - 2);
    const headStays = mid.every((r) => r.head && r.head[1] > 0 && r.head[0] < sw.b.vh);
    const cardStill = mid.every((r) => r.card) ? Math.max(...mid.map((r) => r.card[1])) - Math.min(...mid.map((r) => r.card[1])) : null;
    return { ok: dist >= sw.b.vh * 0.3 && covers && (cardStill == null ? headStays : cardStill <= 30), dist, covers, headStays, cardStill, mid };
  };
  const vp = pinned(v, "volcano");
  out.push({ id: "V-pin", group: "Scroll choreography", name: "volcano stays pinned while its progress runs", points: 2, earned: vp.ok ? 2 : 0,
    detail: vp.why || `pinned over ${Math.round(vp.dist)}px of scroll; section fills viewport: ${vp.covers}; heading stays on screen: ${vp.headStays}` });

  // Wonders strip: pinned, and its cards move on X with scroll.
  const w = await sweep(page, "wonders", true);
  const wp = pinned(w, "wonders");
  out.push({ id: "W-pin", group: "Scroll choreography", name: "wonders strip pins", points: 2, earned: wp.ok ? 2 : 0,
    detail: wp.why || `pinned over ${Math.round(wp.dist)}px of scroll; section fills viewport: ${wp.covers}; card vertical drift ${wp.cardStill == null ? "n/a (no Aurora card found)" : Math.round(wp.cardStill) + "px"}` });
  const xs = (wp.mid || w?.rows || []).filter((r) => r.card).map((r) => r.card[0]);
  const dx = xs.length >= 2 ? xs.at(-1) - xs[0] : 0;
  const monoX = xs.every((x, i) => !i || Math.sign(x - xs[i - 1]) !== -Math.sign(dx) || Math.abs(x - xs[i - 1]) < 4);
  out.push({ id: "W-move", group: "Scroll choreography", name: "wonder cards move on X with scroll", points: 2, earned: Math.abs(dx) >= ctx.vw * 0.5 && monoX ? 2 : 0,
    detail: `Aurora card x across the pinned stretch: ${xs.map((x) => Math.round(x)).join(" → ") || "not found"} (need a one-way move of >= 50% of the viewport width); progress ${fmt(w?.rows || [])}` });

  // Forest parallax: data-depth layers in the waterfall move by different amounts over the same scroll.
  const wb = await sectionBox(page, "waterfall");
  let par = { ok: false, detail: "no waterfall section" };
  if (wb) {
    const pos = async (y) => { await scrollToY(page, y, 500); return page.evaluate(() => [...document.querySelectorAll('[data-section="waterfall"] [data-depth]')].map((e) => e.getBoundingClientRect().top + scrollY)); };
    const y0 = wb.top - wb.vh * 0.3, y1 = wb.top + wb.vh * 0.3;
    const a = await pos(y0), b2 = await pos(y1);
    const moves = a.map((t, i) => b2[i] - t);
    const spread = moves.length >= 2 ? Math.max(...moves) - Math.min(...moves) : 0;
    par = { ok: moves.length >= 2 && spread >= 10, detail: `${moves.length} [data-depth] layer(s); document-space shift over ${Math.round(y1 - y0)}px of scroll: ${moves.map((m) => Math.round(m)).join(", ") || "none"} (need two differing by >= 10px)` };
  }
  out.push({ id: "P-parallax", group: "Scroll choreography", name: "forest parallax: layers move at different speeds", points: 2, earned: par.ok ? 2 : 0, detail: par.detail });
  return out;
}

/** Reveal-on-scroll: each non-hero data-anim changes between "not yet scrolled to" and "scrolled into view". Fresh page. */
export async function probeReveals(page, titleEarned) {
  await scrollToY(page, 0, 800);
  const ids = SECTIONS.filter((s) => s !== "hero").map((s) => `[data-anim="${s}-text"]`);
  const before = {};
  for (const sel of ids) before[sel] = await styleSnap(page, sel);
  const res = [];
  for (const sel of ids) {
    if (!before[sel]) { res.push(`${sel.slice(12, -7)}:missing`); continue; }
    await page.evaluate((sel) => document.querySelector(sel).scrollIntoView({ block: "center", behavior: "instant" }), sel);
    let changed = false; // poll: under load an observer callback or a long transition can land late
    for (let k = 0; k < 6 && !changed; k++) { await wait(page, 500); changed = snapChanged(before[sel], await styleSnap(page, sel)); }
    res.push(`${sel.slice(12, -7)}:${changed ? "ok" : "static"}`);
  }
  res.push(`hero:${titleEarned ? "ok" : "static"}`);
  const n = res.filter((r) => r.endsWith(":ok")).length;
  return { id: "R-reveal", group: "Scroll choreography", name: "reveal-on-scroll in every section", points: 3, earned: band(n, [[8, 3], [6, 2], [4, 1]]), detail: `${n}/8 — ${res.join(" ")}` };
}
