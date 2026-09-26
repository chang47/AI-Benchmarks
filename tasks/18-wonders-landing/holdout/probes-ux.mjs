// Task-18 probes, part 2: cursor, interaction, quality & performance, legibility, judge frames.
import { readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { HIDE_TEXT_CSS, SCENES, SECTIONS, band, busy, diff, scrollToY, sectionBox, showSection, wait, withStyle, wonder } from "./lib/helpers.mjs";
import { measureLegibility } from "./lib/legibility.mjs";

const require = createRequire(import.meta.url);

const cursorState = (page) => page.evaluate(() => {
  const c = document.querySelector("[data-cursor]"); if (!c) return null;
  const s = getComputedStyle(c), r = c.getBoundingClientRect();
  const kids = [...c.querySelectorAll("*")].map((e) => `${e.className}|${getComputedStyle(e).opacity}|${e.textContent.trim()}`).join(";");
  return { cls: c.className, w: Math.round(r.width), h: Math.round(r.height), cx: r.left + r.width / 2, cy: r.top + r.height / 2,
    t: s.transform, bg: s.backgroundColor, bd: s.borderColor, sh: s.boxShadow, o: s.opacity, kids,
    shown: s.display !== "none" && s.visibility !== "hidden" && Number(s.opacity) > 0.05 && r.width > 0 };
});
// Scale out of a transform matrix, so "grows on hover" via transform counts.
const scaleOf = (t) => { const m = (t || "").match(/-?[\d.e]+/g); return t && t !== "none" && m ? Math.hypot(Number(m[0]), Number(m[1])) : 1; };

/** A point over the page that is not a link/button/input (for "cursor at rest"). */
const restPoint = (page) => page.evaluate(() => {
  for (const [fx, fy] of [[0.15, 0.8], [0.85, 0.8], [0.5, 0.92], [0.1, 0.5], [0.9, 0.5], [0.5, 0.6]]) {
    const x = innerWidth * fx, y = innerHeight * fy;
    const hit = document.elementsFromPoint(x, y).filter((e) => !e.matches("[data-cursor],[data-cursor] *,[data-cursor-trail]"))[0];
    if (hit && !hit.closest("a,button,input,label,select,textarea,[role=button],[data-carousel],[data-cursor-label]")) return [x, y];
  }
  return [innerWidth * 0.15, innerHeight * 0.8];
});

export async function probeCursor(page, browser, url, ctx) {
  const out = [];
  await showSection(page, "hero", 800);
  await page.mouse.move(300, 300); await page.mouse.move(700, 500, { steps: 20 }); await wait(page, 600);
  const c1 = await cursorState(page);
  const dist = c1 ? Math.hypot(c1.cx - 700, c1.cy - 500) : Infinity;
  out.push({ id: "K-follow", group: "Cursor", name: "custom cursor follows the mouse (within 20px)", points: 2, earned: c1?.shown && dist <= 20 ? 2 : 0,
    detail: !c1 ? "no [data-cursor] element" : `cursor centre ${Math.round(dist)}px from the mouse 600 ms after a move; visible: ${c1.shown}` });

  // Trail: along a fresh sweep, the pixels in the swept band differ with the trail element shown vs hidden.
  const trail = await (async () => {
    if (!(await page.$("[data-cursor-trail]"))) return { ok: false, detail: "no [data-cursor-trail] element" };
    // Everything but the trail is made invisible, so the swept band holds only trail pixels (or nothing).
    return withStyle(page, "*{visibility:hidden!important}[data-cursor-trail],[data-cursor-trail] *{visibility:visible!important}", async () => {
      const y = Math.round(ctx.vh * 0.5);
      await page.mouse.move(ctx.vw * 0.2, y); await wait(page, 1500);
      await page.mouse.move(ctx.vw * 0.8, y, { steps: 30 });
      const shot = await page.screenshot();
      const path = busy(shot, { x: ctx.vw * 0.2, y: y - 40, width: ctx.vw * 0.6, height: 80 });
      const ctrl = busy(shot, { x: ctx.vw * 0.2, y: ctx.vh * 0.85 - 40, width: ctx.vw * 0.6, height: 80 });
      return { ok: path >= 15 && path >= ctrl * 3, detail: `${path} lit trail pixels along the swept path vs ${ctrl} in a control band (only the trail element visible)` };
    });
  })();
  out.push({ id: "K-trail", group: "Cursor", name: "trail appears along the mouse path", points: 1, earned: trail.ok ? 1 : 0, detail: trail.detail });

  // Hover state over a link or button.
  const [rx, ry] = await restPoint(page);
  await page.mouse.move(rx, ry, { steps: 5 }); await wait(page, 500);
  const rest = await cursorState(page);
  const target = page.locator("[data-section='hero'] a, [data-section='hero'] button, nav a").filter({ visible: true }).first();
  let hov = null;
  if (await target.count()) { const bb = await target.boundingBox(); if (bb) { await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 8 }); await wait(page, 500); hov = await cursorState(page); } }
  const changed = rest && hov && (rest.cls !== hov.cls || Math.abs(rest.w - hov.w) >= 4 || Math.abs(rest.h - hov.h) >= 4 || Math.abs(scaleOf(rest.t) - scaleOf(hov.t)) >= 0.08
    || rest.bg !== hov.bg || rest.bd !== hov.bd || rest.sh !== hov.sh || rest.o !== hov.o || rest.kids !== hov.kids);
  out.push({ id: "K-hover", group: "Cursor", name: "cursor changes over a link or button", points: 1, earned: changed ? 1 : 0,
    detail: !rest ? "no cursor" : !hov ? "no visible link/button in the hero or nav" : `rest {class "${rest.cls}", ${rest.w}×${rest.h}, scale ${scaleOf(rest.t).toFixed(2)}} → hover {class "${hov.cls}", ${hov.w}×${hov.h}, scale ${scaleOf(hov.t).toFixed(2)}}` });

  // Reduced motion and touch: no custom cursor; the native cursor is used.
  for (const [id, name, opts] of [
    ["K-reduced", "no custom cursor under reduced motion", { viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" }],
    ["K-touch", "no custom cursor on touch devices", { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }],
  ]) {
    const p = await browser.newPage(opts);
    await p.goto(url); await wait(p, 1200);
    if (opts.hasTouch) await p.touchscreen.tap(200, 500).catch(() => {}); else await p.mouse.move(700, 500, { steps: 10 });
    await wait(p, 500);
    const st = await cursorState(p);
    const native = await p.evaluate(() => { const e = document.elementFromPoint(innerWidth / 2, innerHeight * 0.6); return e ? getComputedStyle(e).cursor : "auto"; });
    const coarse = await p.evaluate(() => matchMedia("(pointer: coarse)").matches);
    await p.close();
    const ok = (!st || !st.shown) && native !== "none";
    out.push({ id, group: "Cursor", name, points: 1, earned: ok ? 1 : 0, detail: `custom cursor ${st ? (st.shown ? "SHOWN" : "hidden") : "absent"}; native cursor "${native}"${opts.hasTouch ? `; (pointer: coarse) = ${coarse}` : ""}` });
  }
  return out;
}

const slideIdx = (page) => page.evaluate(() => [...document.querySelectorAll("[data-carousel] [data-slide], [data-slide]")].findIndex((s) => s.getAttribute("aria-hidden") === "false"));

export async function probeInteraction(page, browser, url, ctx) {
  const out = [];
  await showSection(page, "voices", 1000);
  const has = await page.$("[data-carousel]");
  const n = await page.evaluate(() => document.querySelectorAll("[data-slide]").length);
  const click = async (sel) => { const l = page.locator(sel).first(); if (!(await l.count())) return false; await l.scrollIntoViewIfNeeded().catch(() => {}); await l.click({ timeout: 3000 }).catch(() => {}); await wait(page, 700); return true; };
  const i0 = await slideIdx(page);
  const nextOk = has && n > 1 && (await click("[data-next]")) && (await slideIdx(page)) === (i0 + 1) % n;
  const i1 = await slideIdx(page);
  const prevOk = has && n > 1 && (await click("[data-prev]")) && (await slideIdx(page)) === (i1 - 1 + n) % n;
  out.push({ id: "I-next", group: "Interaction", name: "carousel next", points: 1, earned: nextOk ? 1 : 0, detail: `${n} slides; shown ${i0} → ${i1} after next` });
  out.push({ id: "I-prev", group: "Interaction", name: "carousel previous", points: 1, earned: prevOk ? 1 : 0, detail: `shown after prev: ${await slideIdx(page)}` });

  // Auto-advance (mouse away from the carousel), then hover-pause.
  const [rx, ry] = [4, ctx.vh - 4];
  await page.mouse.move(rx, ry); await wait(page, 300);
  let t0 = Date.now(), a0 = await slideIdx(page), advancedAt = null;
  while (Date.now() - t0 < 8000) { await wait(page, 250); if ((await slideIdx(page)) !== a0) { advancedAt = Date.now() - t0; break; } }
  out.push({ id: "I-auto", group: "Interaction", name: "carousel auto-advances within 8 s", points: 1, earned: advancedAt != null ? 1 : 0, detail: advancedAt != null ? `advanced after ${advancedAt} ms` : "no change in 8 s" });
  let pause = { ok: false, detail: "cannot test pause: carousel never auto-advanced" };
  if (advancedAt != null && has) {
    const bb = await page.locator("[data-carousel]").first().boundingBox();
    await page.mouse.move(bb.x + bb.width / 2, bb.y + Math.min(bb.height / 2, 60), { steps: 5 });
    const h0 = await slideIdx(page), hold = Math.min(Math.max(advancedAt * 2.5, 6000), 12000);
    await wait(page, hold);
    const h1 = await slideIdx(page);
    pause = { ok: h0 === h1, detail: `hovered ${hold} ms: slide ${h0} → ${h1}` };
    await page.mouse.move(rx, ry);
  }
  out.push({ id: "I-pause", group: "Interaction", name: "carousel pauses while hovered", points: 1, earned: pause.ok ? 1 : 0, detail: pause.detail });

  // Form validation: empty, invalid, valid — without a reload.
  await showSection(page, "join", 800);
  await page.evaluate(() => { window.__noReload = 1; });
  const input = page.locator("[data-form] input[type=email], [data-form] input").first();
  const submit = page.locator("[data-form] [type=submit], [data-form] button").first();
  const msg = () => page.evaluate(() => { const m = document.querySelector("[data-form-message]"); return m ? { state: m.getAttribute("data-state"), text: m.textContent.trim().replace(/[‘’]/g, "'") } : null; });
  const trySubmit = async (val) => {
    if (!(await input.count()) || !(await submit.count())) return null;
    await input.fill(val).catch(() => {});
    await submit.click({ timeout: 3000 }).catch(() => {}); await wait(page, 500);
    return msg();
  };
  const forms = [["I-empty", "empty submit shows the error", 2, "", "error", "Please enter your email."],
    ["I-bad", "invalid email shows the error", 1, "nope", "error", "That email doesn't look right."],
    ["I-good", "valid email shows success, no reload", 1, "stardust@example.com", "success", "Welcome aboard. Your first wonder letter is on its way."]];
  for (const [id, name, pts, val, state, text] of forms) {
    const m = await trySubmit(val);
    const noReload = await page.evaluate(() => window.__noReload === 1).catch(() => false);
    const ok = m && m.state === state && m.text.includes(text) && noReload;
    out.push({ id, group: "Interaction", name, points: pts, earned: ok ? pts : 0, detail: m ? `data-state="${m.state}" text "${m.text.slice(0, 70)}"${noReload ? "" : " — PAGE RELOADED"}` : "no [data-form] input/button or no [data-form-message]" });
  }

  // Mobile menu at 375px.
  const mp = await browser.newPage({ viewport: { width: 375, height: 800 } });
  await mp.goto(url); await wait(mp, 1000);
  const linkVisible = () => mp.evaluate(() => [...document.querySelectorAll("nav a, header a")].some((a) => /^\s*(Sky|Volcano|Ocean)\s*$/.test(a.textContent) && a.getBoundingClientRect().width > 0 && getComputedStyle(a).visibility !== "hidden" && a.checkVisibility?.({ opacityProperty: true, visibilityProperty: true }) !== false && (() => { const r = a.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; })()));
  const btn = mp.locator("[data-menu-button]").first();
  let menu = { pts: 0, detail: "no [data-menu-button]" };
  if (await btn.count()) {
    const closed0 = !(await linkVisible());
    await btn.click({ timeout: 3000 }).catch(() => {}); await wait(mp, 600);
    const open = (await linkVisible()) && (await btn.getAttribute("aria-expanded")) === "true";
    await btn.click({ timeout: 3000 }).catch(() => {}); await wait(mp, 600);
    const closed = !(await linkVisible()) && (await btn.getAttribute("aria-expanded")) === "false";
    menu = { pts: closed0 && open && closed ? 2 : closed0 && open ? 1 : 0, detail: `links hidden at start: ${closed0}; opens (links visible + aria-expanded=true): ${open}; closes again: ${closed}` };
  }
  await mp.close();
  out.push({ id: "I-menu", group: "Interaction", name: "mobile menu opens and closes at 375px", points: 2, earned: menu.pts, detail: menu.detail });
  return out;
}

export async function probeQuality(page, browser, url, ctx) {
  const out = [];
  // Horizontal overflow, checked at the top and at several scroll depths.
  for (const w of [375, 768, 1440]) {
    const p = await browser.newPage({ viewport: { width: w, height: 900 } });
    await p.goto(url); await wait(p, 1200);
    let worst = 0;
    for (const f of [0, 0.25, 0.5, 0.75, 1]) {
      await p.evaluate((f) => scrollTo({ top: (document.scrollingElement.scrollHeight - innerHeight) * f, behavior: "instant" }), f); await wait(p, 350);
      worst = Math.max(worst, await p.evaluate(() => document.scrollingElement.scrollWidth - innerWidth));
    }
    await p.close();
    out.push({ id: `Q-overflow-${w}`, group: "Quality & performance", name: `no horizontal overflow at ${w}px`, points: 1, earned: worst <= 1 ? 1 : 0, detail: `max overflow ${worst}px` });
  }

  // axe-core serious + critical, after scrolling through the page so revealed content is in its final state.
  for (let f = 0; f <= 1.001; f += 0.1) { await page.evaluate((f) => scrollTo({ top: (document.scrollingElement.scrollHeight - innerHeight) * f, behavior: "instant" }), f); await wait(page, 250); }
  await scrollToY(page, 0, 800);
  await page.addScriptTag({ content: readFileSync(require.resolve("axe-core/axe.min.js"), "utf8") });
  const axe = await page.evaluate(async () => { const r = await window.axe.run(document, { resultTypes: ["violations"] }); return r.violations.filter((v) => ["serious", "critical"].includes(v.impact)).map((v) => `${v.id}(${v.nodes.length})`); });
  out.push({ id: "Q-axe", group: "Quality & performance", name: "axe-core: serious + critical violations", points: 3, earned: band(-axe.length, [[0, 3], [-2, 2], [-5, 1]]), detail: `${axe.length} rule(s): ${axe.join(", ") || "none"}` });

  // CLS over the first 3 s of a fresh load, no input.
  const cp = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await cp.goto(url); await wait(cp, 3000);
  const cls = await cp.evaluate(() => new Promise((res) => { let s = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) s += e.value; }).observe({ type: "layout-shift", buffered: true }); setTimeout(() => res(s), 100); }));
  await cp.close();
  out.push({ id: "Q-cls", group: "Quality & performance", name: "CLS < 0.1 during load", points: 1, earned: cls < 0.1 ? 1 : 0, detail: `CLS ${cls.toFixed(3)}` });

  // Frame time while wheel-scrolling top → bottom.
  await scrollToY(page, 0, 1000);
  await page.mouse.move(ctx.vw * 0.5, ctx.vh * 0.5);
  await page.evaluate(() => { window.__ft = []; let last = performance.now(); const tick = (t) => { window.__ft.push(t - last); last = t; if (!window.__ftStop) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  const max = await page.evaluate(() => document.scrollingElement.scrollHeight - innerHeight);
  const step = Math.max(80, Math.round(max / 250)), t0 = Date.now();
  while ((await page.evaluate(() => scrollY)) < max - 5 && Date.now() - t0 < 45000) { await page.mouse.wheel(0, step); await wait(page, 16); }
  await wait(page, 500);
  const ft = await page.evaluate(() => { window.__ftStop = 1; const f = window.__ft.slice(2).sort((a, b) => a - b); return { n: f.length, p95: f[Math.floor(f.length * 0.95)] || 999, med: f[Math.floor(f.length / 2)] || 999 }; });
  out.push({ id: "Q-frames", group: "Quality & performance", name: "frame-time p95 during a full-page scroll", points: 3, earned: band(-ft.p95, [[-20, 3], [-33, 2], [-50, 1]]),
    detail: `p95 ${ft.p95.toFixed(1)} ms, median ${ft.med.toFixed(1)} ms over ${ft.n} frames (bands <= 20 / 33 / 50 ms → 3 / 2 / 1)` });

  // Off-screen scenes pause: playing(x) true at home, false far away.
  const away = { galaxy: "ocean", meteors: "ocean", waterfall: "hero", ocean: "hero" };
  const rows = [];
  for (const [scene, home] of Object.entries(SCENES)) {
    await showSection(page, home, 900); const at = await wonder(page, "playing", scene);
    await showSection(page, away[scene], 900); const off = await wonder(page, "playing", scene);
    rows.push({ scene, ok: at.v === true && off.v === false, s: `${scene}: home=${at.err || at.v} away=${off.err || off.v}` });
  }
  const paused = rows.filter((r) => r.ok).length;
  out.push({ id: "Q-pause", group: "Quality & performance", name: "off-screen scenes are paused", points: 2, earned: band(paused, [[3, 2], [2, 1]]), detail: `${paused}/4 — ${rows.map((r) => r.s).join("; ")}` });

  // Reduced motion: reveals visible at load, volcano static, hero pixels static.
  const rp = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  await rp.goto(url); await wait(rp, 1800);
  const reveals = await rp.evaluate(() => [...document.querySelectorAll("[data-anim]")].map((e) => { let o = 1; for (let a = e; a && a !== document.documentElement; a = a.parentElement) o *= Number(getComputedStyle(a).opacity); return o; }));
  const visible = reveals.length >= 8 && reveals.every((o) => o >= 0.99);
  const hero = await withStyle(rp, HIDE_TEXT_CSS, async () => { const a = await rp.screenshot(); await wait(rp, 1000); return diff(a, await rp.screenshot()); });
  const vb = await sectionBox(rp, "volcano"); const vps = [];
  if (vb) for (const f of [0, 0.5, 1]) { await scrollToY(rp, vb.top + Math.max(0, vb.height - vb.vh) * f, 600); vps.push((await wonder(rp, "progress", "volcano")).v); }
  await rp.close();
  const volcanoStatic = vps.length === 3 && vps.every((p) => typeof p === "number") && Math.max(...vps) - Math.min(...vps) <= 0.05;
  const still = hero.changed < 0.005;
  const rmN = [visible, volcanoStatic, still].filter(Boolean).length;
  out.push({ id: "Q-reduced", group: "Quality & performance", name: "reduced motion: static, everything visible", points: 2, earned: band(rmN, [[3, 2], [2, 1]]),
    detail: `data-anim all visible at load: ${visible} (${reveals.length} found, min opacity ${Math.min(...reveals, 1).toFixed(2)}); volcano progress ${vps.map((p) => (typeof p === "number" ? p.toFixed(2) : p)).join("/")} static: ${volcanoStatic}; hero pixels changed ${(hero.changed * 100).toFixed(2)}%/s static: ${still}` });
  return out;
}

export async function probeLegibility(browser, url) {
  const all = [];
  for (const [w, h] of [[1440, 900], [2000, 1000], [390, 844]]) {
    const p = await browser.newPage({ viewport: { width: w, height: h } });
    await p.goto(url); await wait(p, 2500);
    for (const id of SECTIONS) {
      const b = await sectionBox(p, id); if (!b) continue;
      await scrollToY(p, b.top + (id === "hero" ? 0 : b.vh * 0.35), 1800);
      for (const r of await measureLegibility(p).catch(() => [])) all.push({ vp: w, sec: id, ...r });
    }
    await p.close();
  }
  const pass = all.filter((r) => r.pass).length, frac = all.length ? pass / all.length : 0;
  const fails = all.filter((r) => !r.pass).slice(0, 6).map((f) => `${f.vp}/${f.sec} ${f.tag} ${f.ratio}:1 "${f.text.slice(0, 30)}"`);
  return { id: "T-legibility", group: "Legibility", name: "text contrast over the live background", points: 4, earned: all.length ? band(frac, [[1, 4], [0.9, 3], [0.75, 2], [0.5, 1]]) : 0,
    detail: `${pass}/${all.length} text blocks pass WCAG over the live scene${fails.length ? ` — worst: ${fails.join("; ")}` : ""}` };
}

/** Fixed frames for the yes/no judge. */
export async function captureFrames(browser, url, dir) {
  mkdirSync(dir, { recursive: true });
  const shots = [];
  const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(url); await wait(p, 3000);
  await p.mouse.move(5, 5);
  const snap = async (pg, name) => { await pg.screenshot({ path: join(dir, name) }); shots.push(name); };
  // Frame a section on its own text: the heading block sits ~22% down the viewport (clear of a sticky nav),
  // kept inside the section's own scroll range. Pinned sections are framed by how far through them we are.
  const textY = (pg, id) => pg.evaluate((id) => { const e = document.querySelector(`[data-anim="${id}-text"]`); return e ? e.getBoundingClientRect().top + scrollY : null; }, id);
  const frameAt = async (pg, id, frac) => {
    const b = await sectionBox(pg, id); if (!b) return false;
    const span = Math.max(0, b.height - b.vh), ty = await textY(pg, id);
    const y = id === "hero" ? 0 : frac != null ? b.top + span * frac : ty != null ? Math.min(Math.max(ty - b.vh * 0.22, b.top), b.top + span) : b.top;
    await scrollToY(pg, y, 1800); return true;
  };
  const at = async (id, name, frac) => { if (await frameAt(p, id, frac)) await snap(p, name); };
  await at("hero", "d-hero.png"); await at("meteors", "d-meteors.png");
  await at("volcano", "d-volcano-start.png", 0); await at("volcano", "d-volcano-80.png", 0.8);
  await at("waterfall", "d-waterfall.png");
  for (const f of [0, 0.25, 0.5, 0.75, 1]) await at("wonders", `d-wonders-${Math.round(f * 100)}.png`, f);
  await at("ocean", "d-ocean.png"); await at("voices", "d-voices.png"); await at("join", "d-join.png");
  await p.close();
  const m = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await m.goto(url); await wait(m, 2500);
  for (const id of ["hero", "volcano", "wonders", "join"]) if (await frameAt(m, id, id === "volcano" ? 0.5 : null)) await snap(m, `m-${id}.png`);
  await m.close();
  return shots;
}
