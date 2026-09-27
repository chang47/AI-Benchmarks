// Cannae 216 BC — deterministic, rule-based battle simulation (no rendering).
// Map: metres, x = east, y = north. Heading: 0 = facing north, PI/2 = facing east.
// A unit is a rectangle: centre (x, y), heading h, frontage w (across), depth d (along the facing).
// Every rule lives in RULES / SCENARIO so the frozen prompt and this file say the same thing.
(function (root) {
  "use strict";
  const hyp = (a, b) => Math.sqrt(a * a + b * b); // Math.hypot is slow in V8 and this is the hot path

  const RULES = {
    dt: 1,                   // fixed step, seconds of battle time
    duration: 2400,          // seconds of battle time
    slot: 5,                 // perimeter slot length (m) — the unit of fighting frontage
    contact: 6,              // a slot is engaged when an enemy rectangle is within this distance (m)
    stopGap: 1,              // moving units stop when their front edge would come within this distance of an enemy
    K: 0.016,                // men killed per metre of engaged frontage per second, before modifiers
    sideMult: { front: 1, left: 6, right: 6, rear: 6 },
    giveGroundLossMult: 0.3, // the crescent (yielding or holding) fights defensively: it trades ground for lives
    compressedAttackMult: 0.01, // a unit engaged on >= 2 sides is being crushed and can barely fight back
    windRomanMult: 0.95,     // Volturnus dust in Roman faces
    rangedK: 0.004,          // skirmisher missiles: men per metre of frontage per second, within range
    rangedRange: 70,
    density: { roman: 0.4, alliedInf: 0.4, gaul: 1.2, spaniard: 1.2, libyan: 1.0, cav: 0.35, light: 0.8 }, // men per m^2 — depth = men / (frontage × density); the Roman maniples stood ~50-70 ranks deep
    minDepth: { inf: 6, cav: 6, light: 4 },
    speed: { press: 0.5, advance: 1.0, giveGround: 0.45, libyan: 1.1, cavTrot: 4, cavCharge: 5, numidian: 6, light: 1.5, rout: 4, turnDegPerSec: 4.5 },
    cavRoutMorale: 0.35,     // cavalry routs when morale falls below this, or instantly when charged in the rear
    moraleLossPerCasualtyFrac: 1.6, // morale -= this × (fraction of the unit's starting men lost)
    libyanTriggerConcave: 30, // Libyans turn inward once the crescent's centre has fallen 30 m behind its ends (Hannibal's signal)
    maxGiveGround: 380,
    pressure: [0.7, 1.4],    // CAVALRY kill multiplier = sqrt(attacker men-per-metre-of-front ÷ defender's), clamped: weight of horse tells
    sideShare: 0.25,         // a side counts as engaged (for flank/encircled/compressed status) when >= 25% of its length is in contact
    harassPeriod: 40,
    reformRate: 8,           // m/s: how fast a unit changes its frontage when it re-forms (line <-> column)
    columnWidth: 60,         // m: cavalry riding a route (not charging) moves as a column this wide
    endsPressIn: 80,         // m: once the trap closes, the crescent's ends may advance this far to keep contact
    pursueSeconds: 40,       // s: Hasdrubal's horse rides into the broken allied cavalry before re-forming
    squadronMinWidth: 40,    // m: a squadron never narrows below this, even on a crushed block        // s: Numidians ride in and out on this cycle
    flankAngleDeg: 45,
    cohesion: 40,            // m: a Roman block never gets further than this ahead of an adjacent Roman block
    closeRanks: 0.4,         // m/s: Roman blocks slide sideways to close gaps with their neighbours (the line stays shoulder to shoulder)       // contact on a flank/rear counts as a FLANK ATTACK only if the enemy faces >45° away from head-on      // the centre never falls back further than this from where it started (m)
  };

  // Quality multipliers (the attacker's): how well a contingent kills.
  const QUALITY = { roman: 1.0, alliedInf: 1.0, gaul: 0.7, spaniard: 0.9, libyan: 1.15, romanCav: 0.9, alliedCav: 0.8, hasdrubal: 1.3, numidian: 0.35, velites: 1, balearic: 1 };

  function scenario() {
    const u = [];
    const add = (o) => u.push({ status: "formed", morale: 1, engagedSides: [], order: { type: "hold" }, history: [], ...o, men0: o.men });
    // --- Rome (facing south, heading = PI). Front edge at y = 300.
    add({ id: "R-cav", side: "R", kind: "cav", contingent: "romanCav", name: "Roman cavalry (Paullus)", men: 2400, x: -705, w: 360, frontY: 300, h: Math.PI });
    for (let i = 0; i < 10; i++) add({ id: `R-inf-${i + 1}`, side: "R", kind: "inf", contingent: i < 5 ? "roman" : "alliedInf", name: `${i < 5 ? "Legion" : "Allied"} infantry ${i + 1}`, men: 5500, x: -525 + 52.5 + i * 105, w: 105, frontY: 300, h: Math.PI });
    add({ id: "R-acav", side: "R", kind: "cav", contingent: "alliedCav", name: "Allied cavalry (Varro)", men: 3600, x: 795, w: 540, frontY: 300, h: Math.PI });
    add({ id: "R-vel", side: "R", kind: "light", contingent: "velites", name: "Velites", men: 15000, x: 0, w: 1050, frontY: 240, h: Math.PI });
    // --- Carthage (facing north, heading = 0). Crescent apex front at y = -150, ends at y = -300.
    // Hasdrubal's heavy cavalry: one body until the rear attack, when it splits into one squadron per Roman block.
    add({ id: "C-cav", side: "C", kind: "cav", contingent: "hasdrubal", name: "Hasdrubal's cavalry", men: 6500, x: -705, w: 360, frontY: -300, h: 0 });
    add({ id: "C-lib-W", side: "C", kind: "inf", contingent: "libyan", name: "Libyans (west)", men: 5000, x: -600, w: 150, frontY: -380, h: 0 });
    // The crescent: 10 companies opposite the 10 Roman blocks, Gauls and Spaniards alternating, bulging forward in the middle.
    const kinds = ["gaul", "spaniard", "gaul", "gaul", "spaniard", "gaul", "gaul", "spaniard", "gaul", "gaul"];
    for (let i = 0; i < 10; i++) {
      const xc = -525 + 52.5 + i * 105, k = kinds[i];
      add({ id: `C-cen-${i + 1}`, side: "C", kind: "inf", contingent: k, name: `${k === "gaul" ? "Gauls" : "Spaniards"} ${i + 1}`, men: k === "gaul" ? 18000 / 7 : 5000 / 3, x: xc, w: 105, frontY: -150 - 150 * (Math.abs(xc) / 525) ** 2, h: 0 });
    }
    add({ id: "C-lib-E", side: "C", kind: "inf", contingent: "libyan", name: "Libyans (east)", men: 5000, x: 600, w: 150, frontY: -380, h: 0 });
    add({ id: "C-num", side: "C", kind: "cav", contingent: "numidian", name: "Numidian cavalry", men: 3500, x: 795, w: 540, frontY: -300, h: 0 });
    add({ id: "C-bal", side: "C", kind: "light", contingent: "balearic", name: "Balearic slingers", men: 8000, x: 0, w: 1250, frontY: -90, h: 0 });
    for (const x of u) {
      x.d = Math.max(RULES.minDepth[x.kind], x.men / (x.w * dens(x)));
      const f = fwd(x.h);
      x.y = x.frontY - f[1] * x.d / 2; // centre sits half a depth behind the front edge
      delete x.frontY;
      x.x0 = x.x; x.y0 = x.y;
    }
    return u;
  }

  // The order script: fixed times plus event-driven orders (see step()).
  const SCRIPT = [
    { t: 0, ids: ["R-vel", "C-bal"], order: { type: "skirmish" } },
    { t: 30, ids: ["C-cav"], order: { type: "charge", target: "R-cav", speed: "cavCharge" } },
    { t: 30, ids: ["R-cav"], order: { type: "charge", target: "C-cav", speed: "cavTrot" } },
    { t: 30, ids: ["C-num"], order: { type: "harass", target: "R-acav" } },
    { t: 120, ids: ["R-vel", "C-bal"], order: { type: "leave" } },
    { t: 150, ids: "R-inf", order: { type: "advance" } },
    { t: 150, ids: ["C-cen-3", "C-cen-4", "C-cen-5", "C-cen-6", "C-cen-7", "C-cen-8"], order: { type: "giveGround" } }, // the centre yields…
    { t: 150, ids: ["C-cen-1", "C-cen-2", "C-cen-9", "C-cen-10"], order: { type: "holdLine" } }, // …the ends of the crescent hold
    { t: 150, ids: ["C-lib-W", "C-lib-E"], order: { type: "ambush" } },
  ];

  // ---------------------------------------------------------------- geometry
  const fwd = (h) => [Math.sin(h), Math.cos(h)];
  const right = (h) => [Math.cos(h), -Math.sin(h)];
  function corners(u) {
    const f = fwd(u.h), r = right(u.h), a = u.w / 2, b = u.d / 2;
    return [[u.x + f[0] * b - r[0] * a, u.y + f[1] * b - r[1] * a], [u.x + f[0] * b + r[0] * a, u.y + f[1] * b + r[1] * a],
      [u.x - f[0] * b + r[0] * a, u.y - f[1] * b + r[1] * a], [u.x - f[0] * b - r[0] * a, u.y - f[1] * b - r[1] * a]];
  }
  /** Distance from a point to a unit's rectangle (0 inside). */
  function distToRect(px, py, u) {
    const f = fwd(u.h), r = right(u.h), dx = px - u.x, dy = py - u.y;
    const lf = dx * f[0] + dy * f[1], lr = dx * r[0] + dy * r[1];
    const ef = Math.max(0, Math.abs(lf) - u.d / 2), er = Math.max(0, Math.abs(lr) - u.w / 2);
    return hyp(ef, er);
  }
  /** Contact test for a perimeter point with outward normal (nx, ny): the enemy rectangle must be within `range`
   *  AND lie out along the normal (≥ 45° cone) — a diagonal neighbour touching a corner is not contact. */
  function axes(u) { // cached facing/right vectors (recomputed only when the heading changes)
    if (u._ah !== u.h) { u._ah = u.h; u._f = fwd(u.h); u._r = right(u.h); }
    return u;
  }
  function touches(px, py, nx, ny, u, range) {
    axes(u);
    const f = u._f, r = u._r, dx = px - u.x, dy = py - u.y;
    const lf = Math.max(-u.d / 2, Math.min(u.d / 2, dx * f[0] + dy * f[1])), lr = Math.max(-u.w / 2, Math.min(u.w / 2, dx * r[0] + dy * r[1]));
    const cx = u.x + f[0] * lf + r[0] * lr - px, cy = u.y + f[1] * lf + r[1] * lr - py, dist = hyp(cx, cy);
    if (dist > range) return false;
    return dist < 0.5 || (cx * nx + cy * ny) / dist >= Math.SQRT1_2;
  }
  /** Perimeter slots: points every RULES.slot metres, each tagged with its side. */
  function slots(u) {
    const out = [], f = fwd(u.h), r = right(u.h), a = u.w / 2, b = u.d / 2, s = RULES.slot;
    const edge = (side, cx, cy, dirx, diry, len, nx, ny) => {
      const n = Math.max(1, Math.round(len / s));
      for (let i = 0; i < n; i++) { const k = (i + 0.5) / n - 0.5; out.push({ side, x: cx + dirx * k * len, y: cy + diry * k * len, len: len / n, nx, ny }); }
    };
    edge("front", u.x + f[0] * b, u.y + f[1] * b, r[0], r[1], u.w, f[0], f[1]);
    edge("rear", u.x - f[0] * b, u.y - f[1] * b, r[0], r[1], u.w, -f[0], -f[1]);
    edge("right", u.x + r[0] * a, u.y + r[1] * a, f[0], f[1], u.d, r[0], r[1]);
    edge("left", u.x - r[0] * a, u.y - r[1] * a, f[0], f[1], u.d, -r[0], -r[1]);
    return out;
  }
  /** Axis-aligned bounds of a unit's rectangle, grown by pad (a cheap pre-check before exact distances). */
  function bounds(u, pad = 0) {
    const c = corners(u), xs = c.map((p) => p[0]), ys = c.map((p) => p[1]);
    return [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad];
  }
  const inB = (b, x, y) => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3];
  const overlapB = (a, b) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
  const alive = (u) => u.status !== "destroyed" && u.status !== "left" && u.status !== "split";
  const fights = (u) => alive(u) && u.status !== "routing" && u.kind !== "light" && u.order.type !== "harass"; // harassers skirmish, they do not lock in melee
  const near = (a, b, pad) => hyp(a.x - b.x, a.y - b.y) < (hyp(a.w, a.d) + hyp(b.w, b.d)) / 2 + pad;

  // ---------------------------------------------------------------- the simulation
  function create() {
    const s = { t: 0, step: 0, units: scenario(), events: [], fallen: [], script: SCRIPT.map((e) => ({ ...e, done: false })), flags: {} };
    s.byId = Object.fromEntries(s.units.map((u) => [u.id, u]));
    return s;
  }
  const ev = (s, type, id, extra) => s.events.push({ t: s.t, type, id, ...extra });
  const idsOf = (s, sel) => (Array.isArray(sel) ? sel : s.units.filter((u) => u.id.startsWith(sel)).map((u) => u.id));

  function setOrder(s, u, order) { u.order = { ...order, since: s.t, prev: u.order?.type }; ev(s, "order", u.id, { order: order.type }); }

  /** Do two unit rectangles overlap by more than `tol` metres? (separating-axis test on the 4 edge normals) */
  function rectsOverlap(a, b, tol = 1) {
    const axesList = [fwd(a.h), right(a.h), fwd(b.h), right(b.h)];
    for (const [ax, ay] of axesList) {
      const proj = (u) => { const f = fwd(u.h), r = right(u.h), c = u.x * ax + u.y * ay, e = Math.abs(f[0] * ax + f[1] * ay) * u.d / 2 + Math.abs(r[0] * ax + r[1] * ay) * u.w / 2; return [c - e, c + e]; };
      const [a0, a1] = proj(a), [b0, b1] = proj(b);
      if (Math.min(a1, b1) - Math.max(a0, b0) <= tol) return false;
    }
    return true;
  }
  /** Would moving u by (dx, dy) push it into a friendly unit it is not already overlapping? (no marching through friends) */
  function blockedByFriend(s, u, dx, dy) {
    const g = { x: u.x + dx, y: u.y + dy, w: u.w, d: u.d, h: u.h };
    for (const e of s.units) {
      if (e === u || e.side !== u.side || !alive(e) || e.kind === "light" || e.status === "routing" || u.kind === "light") continue;
      if (rectsOverlap(g, e) && !rectsOverlap(u, e)) return e;
    }
    return null;
  }
  /** Would moving u by (dx, dy) bring its front edge within RULES.stopGap of a fighting enemy? (units stop at contact) */
  function blocked(s, u, dx, dy) {
    if (u.kind === "light") return false;
    const g = { x: u.x + dx, y: u.y + dy, w: u.w, d: u.d, h: u.h };
    const f = fwd(u.h), r = right(u.h), fx = g.x + f[0] * g.d / 2, fy = g.y + f[1] * g.d / 2, n = Math.max(2, Math.round(u.w / RULES.slot));
    const gb = bounds(g, RULES.stopGap); // front points are slot centres, never the exact corners
    for (const e of s.units) {
      if (e.side === u.side || !alive(e) || e.status === "routing" || e.kind === "light") continue;
      const eb = bounds(e, RULES.stopGap);
      if (!overlapB(gb, eb)) continue;
      for (let i = 0; i < n; i++) { const k = (i + 0.5) / n - 0.5, px = fx + r[0] * k * u.w, py = fy + r[1] * k * u.w; if (inB(eb, px, py) && touches(px, py, f[0], f[1], e, RULES.stopGap)) return true; }
    }
    return false;
  }
  function moveToward(s, u, tx, ty, speed, { turn = true, stopAtContact = true } = {}) {
    const dx = tx - u.x, dy = ty - u.y, dist = hyp(dx, dy);
    if (dist < 1) return true;
    if (turn) turnTo(u, Math.atan2(dx, dy));
    const step = Math.min(dist, speed * RULES.dt), mx = (dx / dist) * step, my = (dy / dist) * step;
    if (stopAtContact && blocked(s, u, mx, my)) return false;
    u.x += mx; u.y += my; return false;
  }
  function turnTo(u, h) {
    let d = ((h - u.h + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    const m = (RULES.speed.turnDegPerSec * Math.PI / 180) * RULES.dt;
    u.h += Math.max(-m, Math.min(m, d));
    return Math.abs(d) <= m;
  }
  const angDiff = (a, b) => Math.abs(((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
  /** Engaged on a flank or rear by an enemy that is not facing head-on (the Libyans' turn, Hasdrubal behind). */
  function flankAttacked(s, u) {
    return (u.engagedBy || []).some(([id, side]) => side !== "front" && u.engagedSides.includes(side) && angDiff(s.byId[id].h, u.h + Math.PI) > RULES.flankAngleDeg * Math.PI / 180);
  }
  /** The adjacent surviving blocks of the same line (sorted by x). */
  function neighbours(line, u) {
    const sorted = line.slice().sort((a, b) => a.x - b.x), i = sorted.indexOf(u);
    return [sorted[i - 1], sorted[i + 1]].filter(Boolean);
  }
  const frontY = (u) => u.y + fwd(u.h)[1] * u.d / 2;
  /** Crescent curvature: mean front-y of the two middle companies minus that of the two end companies.
   *  > 0 convex (middle ahead, north), < 0 concave (middle bent back). */
  function crescentCurve(s) {
    const c = s.units.filter((u) => u.id.startsWith("C-cen-")), fy = (u) => frontY(u);
    const n = c.length; if (n < 4) return 0;
    return (fy(c[Math.floor(n / 2) - 1]) + fy(c[Math.floor(n / 2)])) / 2 - (fy(c[0]) + fy(c[n - 1])) / 2;
  }

  function applyOrders(s) {
    const S = RULES.speed;
    for (const e of s.script) if (!e.done && s.t >= e.t) { e.done = true; for (const id of idsOf(s, e.ids)) if (alive(s.byId[id]) && s.byId[id].status !== "routing") setOrder(s, s.byId[id], e.order); }
    const romanInf = s.units.filter((u) => u.id.startsWith("R-inf") && alive(u));
    for (const u of s.units) {
      if (!alive(u)) continue;
      const o = u.order;
      if (u.status === "routing") { // flee straight back towards the own side's map edge, then leave
        const away = u.side === "R" ? 1 : -1;
        u.h = away > 0 ? 0 : Math.PI; u.y += away * S.rout * RULES.dt;
        if (Math.abs(u.y) > 1300) { u.status = "left"; ev(s, "left", u.id, { men: Math.round(u.men) }); }
        continue;
      }
      if (o.type === "skirmish") {
        const foe = s.units.find((e) => e.kind === "light" && e.side !== u.side && alive(e));
        if (foe && Math.abs(frontY(u) - frontY(foe)) > RULES.rangedRange - 10) u.y += fwd(u.h)[1] * S.light * RULES.dt;
      } else if (o.type === "leave") { // skirmishers fall back through the intervals of their own line and are gone behind it
        u.y += (u.side === "R" ? 1 : -1) * S.light * 3 * RULES.dt;
        const own = s.units.filter((e) => e.side === u.side && e.kind === "inf" && alive(e));
        const line = u.side === "R" ? Math.min(...own.map(frontY)) : Math.max(...own.map(frontY));
        const back = u.side === "R" ? u.y - u.d / 2 >= line : u.y + u.d / 2 <= line;
        if (!own.length || back) { u.status = "left"; ev(s, "left", u.id, { men: Math.round(u.men) }); }
      } else if (o.type === "charge") {
        const tg = s.byId[o.target];
        if (!tg || !alive(tg) || tg.status === "routing") { setOrder(s, u, { type: "hold" }); continue; }
        const [cx, cy] = o.at === "rear" ? [tg.x - fwd(tg.h)[0] * (tg.d / 2 + u.d / 2), tg.y - fwd(tg.h)[1] * (tg.d / 2 + u.d / 2)] : [tg.x, tg.y];
        moveToward(s, u, cx, cy, S[o.speed || "cavCharge"]);
      } else if (o.type === "path") { // follow waypoints, then take the next order (cavalry rides it in column)
        if (u.id === "C-cav") march(u);
        const wp = o.points[o.i || 0];
        if (moveToward(s, u, wp[0], wp[1], S[o.speed || "cavTrot"], { stopAtContact: false })) {
          o.i = (o.i || 0) + 1;
          if (o.i >= o.points.length) { deploy(u); setOrder(s, u, o.then); }
        }
      } else if (o.type === "harass") { // Numidians: hover 40 m off the target's front, pinning it
        const tg = s.byId[o.target];
        if (!tg || !alive(tg)) { setOrder(s, u, { type: "hold" }); continue; }
        if (tg.status === "routing") { setOrder(s, u, { type: "pursue", target: tg.id }); continue; }
        // Dash in and out: the stand-off distance cycles between 15 and 95 m every RULES.harassPeriod seconds.
        const off = 55 - 40 * Math.cos((2 * Math.PI * s.t) / RULES.harassPeriod);
        const f = fwd(tg.h), gx = tg.x + f[0] * (tg.d / 2 + u.d / 2 + off), gy = tg.y + f[1] * (tg.d / 2 + u.d / 2 + off);
        moveToward(s, u, gx, gy, S.numidian, { turn: false }); turnTo(u, Math.atan2(tg.x - u.x, tg.y - u.y));
      } else if (o.type === "pursue") {
        const tg = s.byId[o.target];
        if (!tg || !alive(tg)) { // target gone: light horse chase the fugitives off the field; others stand
          setOrder(s, u, u.contingent === "numidian" ? { type: "chaseOff" } : { type: "hold" }); continue;
        }
        moveToward(s, u, tg.x, tg.y, S.numidian, { stopAtContact: false });
      } else if (o.type === "face") { // halted: wheel to face the given heading
        turnTo(u, o.h);
      } else if (o.type === "chaseOff") { // ride north after the fugitives until off the map
        turnTo(u, 0); u.y += S.numidian * RULES.dt;
        if (u.y > 1300) { u.status = "left"; ev(s, "left", u.id, { men: Math.round(u.men) }); }
      } else if (o.type === "advance") { // Roman infantry: push south; stop while flanked; drift toward a yielding enemy
        if (flankAttacked(s, u) || u.compressed || s.flags.trapClosing) continue; // flanked or trapped men do not march; once the ring closes they fight where they stand
        const f = fwd(u.h);
        // Cohesion: a block never gets more than RULES.cohesion ahead of an adjacent block's front.
        // Cohesion: never more than RULES.cohesion ahead of an adjacent surviving block (the line bends, it does not break).
        const nb = neighbours(romanInf, u);
        if (nb.length && frontY(u) + f[1] * S.advance * RULES.dt < Math.max(...nb.map(frontY)) - RULES.cohesion) continue;
        const mx = f[0] * S.advance * RULES.dt, my = f[1] * S.advance * RULES.dt;
        if (!blocked(s, u, mx, my)) { u.x += mx; u.y += my; }
      } else if (o.type === "giveGround") { // the crescent: fall back in order while pressed from the front by advancing infantry
        const pressed = u.engagedSides.includes("front") && s.units.some((e) => e.side !== u.side && e.kind === "inf" && alive(e) && e.order.type === "advance"
          && !flankAttacked(s, e) && e.engagedWith?.includes(u.id));
        const back = hyp(u.x - u.x0, u.y - u.y0);
        u.moving = pressed && back < RULES.maxGiveGround;
        const f = fwd(u.h);
        if (u.moving) { u.x -= f[0] * S.giveGround * RULES.dt; u.y -= f[1] * S.giveGround * RULES.dt; }
        else if (s.flags.trapClosing && fwd(u.h)[1] * (u.y0 - u.y) > 0) { // the ring contracts: press right up to the enemy, never past the start line
          const mx = f[0] * S.giveGround * RULES.dt, my = f[1] * S.giveGround * RULES.dt;
          if (!blocked(s, u, mx, my) && !blockedByFriend(s, u, mx, my)) { u.x += mx; u.y += my; }
        }
      } else if (o.type === "holdLine") { // ends of the crescent: stand; once the trap closes, press forward (≤ RULES.endsPressIn) into contact
        const f0 = fwd(u.h), foeAhead = s.units.some((e) => e.side !== u.side && alive(e) && e.kind === "inf" && distToRect(u.x + f0[0] * (u.d / 2 + 30), u.y + f0[1] * (u.d / 2 + 30), e) < 40);
        if (s.flags.trapClosing && foeAhead && fwd(u.h)[1] * (u.y - u.y0) < RULES.endsPressIn) { // only press toward an enemy actually in front
          const f = fwd(u.h), mx = f[0] * S.giveGround * RULES.dt, my = f[1] * S.giveGround * RULES.dt;
          if (!blocked(s, u, mx, my) && !blockedByFriend(s, u, mx, my)) { u.x += mx; u.y += my; }
        }
      } else if (o.type === "ambush") { // Libyans: wait, then face inward and charge the Roman flank
        if (crescentCurve(s) <= -RULES.libyanTriggerConcave) { setOrder(s, u, { type: "faceAndAdvance", h: u.x < 0 ? Math.PI / 2 : -Math.PI / 2 }); ev(s, "libyans-turn", u.id); }
      } else if (o.type === "faceAndAdvance") { // turn to face inward, then march onto the flank of the outermost Roman block
        if (!turnTo(u, o.h)) continue;
        if (!romanInf.length) continue;
        const west = u.x < 0, tgt = romanInf.reduce((a, b) => ((west ? b.x < a.x : b.x > a.x) ? b : a));
        const gx = tgt.x + (west ? -1 : 1) * (tgt.w / 2 + u.d / 2), gy = tgt.y;
        const dx = gx - u.x, dy = gy - u.y, dist = hyp(dx, dy);
        if (dist < 0.5) continue;
        if (u.engagedSides.length) o.contacted = true;
        const sp = o.contacted || s.flags.trapClosing ? S.press : S.libyan; // charge in once; afterwards only press to keep contact
        const st = Math.min(dist, sp * RULES.dt), mx = (dx / dist) * st, my = (dy / dist) * st;
        const friend = blockedByFriend(s, u, mx, my);
        if (!friend && !blocked(s, u, mx, my)) { u.x += mx; u.y += my; o.detour = null; }
        else if (friend && !o.contacted) { // before first contact: detour round the friendly unit; afterwards hold — they are part of the ring
          const sx = Math.abs(dx) >= Math.abs(dy), st2 = sp * RULES.dt;
          o.detour = o.detour || (sx ? [0, Math.sign(u.y - friend.y) || 1] : [Math.sign(u.x - friend.x) || 1, 0]); // pick a side once
          const ddx = o.detour[0] * st2, ddy = o.detour[1] * st2;
          if (!blockedByFriend(s, u, ddx, ddy) && !blocked(s, u, ddx, ddy)) { u.x += ddx; u.y += ddy; }
          else o.detour = [-o.detour[0], -o.detour[1]]; // that side is blocked too: go round the other way
        }
      }
    }

    // Close ranks: each Roman infantry block slides sideways toward the line's centre of mass to close any gap to its neighbour.
    const line = romanInf.slice().sort((a, b) => a.x - b.x), mid = line.reduce((a, r) => a + r.x, 0) / (line.length || 1);
    for (let i = 0; i < line.length; i++) {
      const u = line[i], inner = u.x < mid ? line[i + 1] : line[i - 1];
      // A block pinned on its outer flank (the Libyans) stays put; everyone else closes toward the centre.
      const outerSide = u.x < mid ? "right" : "left"; // Romans face south: their right is west
      if (!inner || flankAttacked(s, u) && u.engagedSides.includes(outerSide)) continue;
      const gap = Math.abs(inner.x - u.x) - (inner.w + u.w) / 2;
      if (gap > 1) {
        const dx = Math.sign(inner.x - u.x) * Math.min(gap - 1, RULES.closeRanks * RULES.dt), g = { x: u.x + dx, y: u.y, w: u.w, d: u.d, h: u.h };
        if (!s.units.some((e) => e.side !== u.side && alive(e) && e.kind !== "light" && rectsOverlap(g, e, 0.5))) u.x += dx; // never slide onto an enemy
      }
    }

    // Event-driven orders (the "commanders"): Hasdrubal's ride around the Roman army, the wait, then the rear attack.
    const hc = s.byId["C-cav"], rc = s.byId["R-cav"], ac = s.byId["R-acav"];
    const rearOf = (list) => Math.max(...list.map((r) => r.y + r.d / 2));
    if (!s.flags.ride && alive(hc) && hc.status !== "routing" && (rc.status === "routing" || !alive(rc))) {
      s.flags.ride = true;
      const y = rearOf(romanInf) + 140;
      setOrder(s, hc, { type: "path", speed: "cavTrot", points: [[-780, y], [ac.x, y]], then: { type: "charge", target: "R-acav", at: "rear", speed: "cavCharge" } });
      ev(s, "hasdrubal-ride", hc.id);
    }
    // When the allied cavalry breaks, Hasdrubal's horse first rides into the fleeing mass for RULES.pursueSeconds…
    if (!s.flags.pursue && s.flags.ride && alive(hc) && hc.status !== "routing" && ac.status === "routing") {
      s.flags.pursue = s.t;
      setOrder(s, hc, { type: "pursue", target: "R-acav" });
      ev(s, "hasdrubal-pursues", hc.id);
    }
    // …then leaves the chase to the Numidians and waits 400 m behind the Roman army until the Libyans are on its flanks.
    const pursuitOver = s.flags.pursue != null && (s.t - s.flags.pursue >= RULES.pursueSeconds || !alive(ac));
    if (!s.flags.wait && s.flags.ride && alive(hc) && hc.status !== "routing" && (pursuitOver || (!alive(ac) && s.flags.pursue == null))) {
      s.flags.wait = true;
      setOrder(s, hc, { type: "path", speed: "cavTrot", points: [[0, rearOf(romanInf) + 400]], then: { type: "face", h: Math.PI } }); // halt facing the Roman rear
      ev(s, "hasdrubal-waits", hc.id);
    }
    const libyansIn = s.units.some((u) => u.id.startsWith("C-lib") && u.order.type === "faceAndAdvance" && u.engagedSides.includes("front"));
    if (libyansIn && !s.flags.trapClosing) { s.flags.trapClosing = true; ev(s, "trap-closing", "C-lib"); }
    if (!s.flags.rear && s.flags.wait && libyansIn && alive(hc) && (hc.order.type === "hold" || hc.order.type === "face")) {
      s.flags.rear = true;
      // Split into one squadron per surviving Roman block; each re-forms to its block's width and charges its rear.
      const blocks = romanInf.slice().sort((a, b) => a.x - b.x), men = hc.men / blocks.length;
      blocks.forEach((r, i) => {
        const q = { id: `C-cav-${i + 1}`, side: "C", kind: "cav", contingent: "hasdrubal", name: `Hasdrubal's squadron ${i + 1}`, men, men0: men, status: "formed", morale: hc.morale,
          engagedSides: [], engagedWith: [], engagedBy: [], history: [], x: hc.x, y: hc.y, h: hc.h, w: r.w, d: 0, parent: hc.id, order: { type: "hold" } };
        reform(q, r.w, true); q.x0 = q.x; q.y0 = q.y;
        s.units.push(q); s.byId[q.id] = q;
        setOrder(s, q, { type: "path", speed: "cavTrot", points: [[r.x, r.y + r.d / 2 + q.d / 2 + 60]], then: { type: "advanceRear", target: r.id } });
      });
      hc.men0 -= hc.men; hc.men = 0; hc.status = "split"; ev(s, "split", hc.id, { into: blocks.length }); // its men live on in the squadrons (men0 keeps only its own dead)
    }
    for (const u of s.units) if (u.order.type === "advanceRear" && alive(u) && u.status !== "routing") {
      // Stay on the assigned block as it contracts: match its x and width, and keep pressing onto its rear.
      let tg = s.byId[u.order.target];
      if (!tg || !alive(tg)) { tg = romanInf.length ? romanInf.reduce((a, b) => (Math.abs(b.x - u.x) < Math.abs(a.x - u.x) ? b : a)) : null; if (tg) u.order.target = tg.id; }
      turnTo(u, Math.PI);
      if (!tg) continue;
      if (u.engagedSides.length) u.order.contacted = true;
      const v = (u.order.contacted ? RULES.speed.press : RULES.speed.cavTrot) * RULES.dt; // after the first shock, horsemen press, they don't gallop
      const slide = Math.max(-v, Math.min(v, tg.x - u.x));
      u.x += slide; const w = Math.max(RULES.squadronMinWidth, tg.w); if (Math.abs(u.w - w) > 0.5) reform(u, w);
      // Close onto the block's rear edge — never ride past it.
      const room = frontY(u) - (tg.y + tg.d / 2) - RULES.stopGap;
      if (room > 0) { const my = -Math.min(room, v); if (!blocked(s, u, 0, my)) u.y += my; } // press right up (to stopGap), not just into contact range
    }
  }
  function pressure(a, d) {
    const r = Math.sqrt((a.men / a.w) / Math.max(1e-6, d.men / d.w));
    return Math.min(RULES.pressure[1], Math.max(RULES.pressure[0], r));
  }
  function dens(u) { return RULES.density[u.kind === "inf" ? u.contingent : u.kind]; }
  /** Cavalry marches in a narrow column and deploys into a wide line when it halts. */
  function march(u) { if (u.kind === "cav" && !u.column) { u.lineW = u.w; u.column = true; reform(u, RULES.columnWidth); } }
  function deploy(u) { if (u.column) { u.column = false; reform(u, u.lineW || u.w); } }
  /** Change frontage: gradually (RULES.reformRate m/s) unless instant — units re-form, they do not teleport into shape. */
  function reform(u, w, instant = false) { if (instant) { u.w = w; u.wTarget = null; u.d = Math.max(RULES.minDepth[u.kind], u.men / (u.w * dens(u))); } else u.wTarget = w; }
  function reformStep(u) {
    if (u.wTarget == null) return;
    const dw = u.wTarget - u.w, m = RULES.reformRate * RULES.dt;
    u.w = Math.abs(dw) <= m ? u.wTarget : u.w + Math.sign(dw) * m;
    if (u.w === u.wTarget) u.wTarget = null;
    u.d = Math.max(RULES.minDepth[u.kind], u.men / (u.w * dens(u)));
  }

  function combat(s) {
    const loss = new Map();
    for (const u of s.units) { u.engagedSides = []; u.engagedWith = []; u.engagedBy = []; u._bb = alive(u) ? bounds(u, RULES.contact) : null; }
    for (const d of s.units) {
      if (!alive(d)) continue;
      const sides = new Set(), foes = new Set(), by = new Set(), sideLen = {}, sideHit = {}, pm = new Map();
      let dLoss = 0;
      const enemies = s.units.filter((e) => e.side !== d.side && fights(e) && overlapB(d._bb, e._bb));
      if (enemies.length && d.kind !== "light") for (const p of slots(d)) {
        sideLen[p.side] = (sideLen[p.side] || 0) + p.len;
        let hit = null;
        for (const e of enemies) if (inB(e._bb, p.x, p.y) && touches(p.x, p.y, p.nx, p.ny, e, RULES.contact)) { hit = e; break; }
        if (!hit) continue;
        sideHit[p.side] = (sideHit[p.side] || 0) + p.len; foes.add(hit.id); by.add(`${hit.id}|${p.side}`);
        if (!pm.has(hit.id)) pm.set(hit.id, hit.kind === "cav" ? pressure(hit, d) : 1); // depth adds push, not kills: pressure is a cavalry (mass) effect
        let k = RULES.K * p.len * QUALITY[hit.contingent] * RULES.sideMult[p.side] * pm.get(hit.id);
        if (hit.side === "R") k *= RULES.windRomanMult;
        if (hit.compressed) k *= RULES.compressedAttackMult;
        if (d.order.type === "giveGround" || d.order.type === "holdLine") k *= RULES.giveGroundLossMult; // the whole crescent fights a defensive fight throughout
        if (d.status === "routing") k *= 2;
        dLoss += k * RULES.dt;
      }
      // Numidians harassing a unit throw javelins at it: light damage, but it stays pinned.
      for (const e of s.units) if (e.order.type === "harass" && e.order.target === d.id && alive(e) && hyp(e.x - d.x, e.y - d.y) < 250) dLoss += RULES.rangedK * d.w * QUALITY.numidian * RULES.dt;
      // Skirmisher missiles: light troops shoot the enemy light troops (or anything) in front, within range.
      for (const e of s.units) if (e.kind === "light" && e.side !== d.side && alive(e) && e.order.type === "skirmish" && d.status !== "routing") {
        const gap = Math.abs(frontY(e) - frontY(d)), overlap = Math.max(0, Math.min(e.x + e.w / 2, d.x + d.w / 2) - Math.max(e.x - e.w / 2, d.x - d.w / 2));
        if (gap <= RULES.rangedRange && overlap > 0) dLoss += RULES.rangedK * overlap * (e.side === "R" ? 0.7 : 1) * RULES.dt;
      }
      for (const k of Object.keys(sideHit)) if (sideHit[k] >= RULES.sideShare * sideLen[k]) sides.add(k);
      d.engagedSides = [...sides]; d.engagedWith = [...foes]; d.engagedBy = [...by].map((k) => k.split("|"));
      loss.set(d.id, dLoss);
    }
    for (const u of s.units) {
      if (!alive(u)) continue;
      u.encircled = u.engagedSides.length >= 3;
      u.compressed = u.engagedSides.length >= 2;
      const l = Math.min(u.men, loss.get(u.id) || 0);
      u.men -= l;
      // No morale loss while every enemy in contact is itself compressed (trapped men are no threat to the ring).
      // …nor while it is striking every enemy it touches in the flank or rear (the hammer does not break).
      const hitsFlankOrRear = (e) => (e.engagedBy || []).some(([id, side]) => id === u.id && side !== "front");
      const threatened = u.engagedWith.some((id) => !s.byId[id].compressed && !hitsFlankOrRear(s.byId[id]));
      if (threatened || !u.engagedWith.length) u.morale = Math.max(0, u.morale - RULES.moraleLossPerCasualtyFrac * (l / u.men0));
      if (u.men < 1) { u.men = 0; u.status = "destroyed"; ev(s, "destroyed", u.id); continue; }
      // Depth follows strength (frontage kept), so a shrinking block visibly thins; a trapped block also narrows.
      // Losses thin the unit from the REAR: the front edge stays where it is (so contact is not broken by shrinking).
      const ff = fwd(u.h);
      if (u.compressed && u.kind === "inf") {
        // A trapped block is crushed together: it shrinks in width AND depth (same shape), so the whole mass contracts.
        const k = Math.sqrt(u.men / (u.w * u.d * dens(u)));
        const nw = Math.max(RULES.minDepth.inf, u.w * k), nd = Math.max(RULES.minDepth.inf, u.d * k);
        u.x += ff[0] * (u.d - nd) / 2; u.y += ff[1] * (u.d - nd) / 2; u.w = nw; u.d = nd;
      } else {
        const nd = Math.max(RULES.minDepth[u.kind], u.men / (u.w * dens(u)));
        u.x += ff[0] * (u.d - nd) / 2; u.y += ff[1] * (u.d - nd) / 2; u.d = nd;
      }
      if (u.kind === "cav" && u.status !== "routing" && (u.morale < RULES.cavRoutMorale || (u.engagedSides.includes("rear") && u.side === "R"))) {
        u.status = "routing"; ev(s, "rout", u.id, { men: Math.round(u.men) });
      }
      if (u.status === "formed" && u.engagedSides.length) u.status = "engaged";
      else if (u.status === "engaged" && !u.engagedSides.length) u.status = "formed";
    }
  }

  function step(s) {
    for (const u of s.units) if (u.wTarget != null && alive(u)) reformStep(u);
    applyOrders(s);
    combat(s);
    s.step++; s.t = Number((s.step * RULES.dt).toFixed(3));
    // Where men fell: every 10 s, each unit that lost men logs its footprint (drawn as the fallen on the field).
    if (s.t % 10 === 0) for (const u of s.units) {
      const lost = Math.floor(u.men0 - u.men) - (u._logged || 0);
      if (lost >= 20 && (alive(u) || u.status === "destroyed")) { s.fallen.push([s.t, u.id, +u.x.toFixed(1), +u.y.toFixed(1), +u.h.toFixed(3), +u.w.toFixed(1), +Math.max(u.d, 8).toFixed(1), lost]); u._logged = (u._logged || 0) + lost; }
    }
  }

  /** Public state snapshot (the test contract shape). */
  function snapshot(s) {
    return {
      t: s.t, duration: RULES.duration,
      units: s.units.map((u) => ({ id: u.id, side: u.side, kind: u.kind, contingent: u.contingent, name: u.name,
        men: Math.round(u.men), men0: u.men0, x: +u.x.toFixed(2), y: +u.y.toFixed(2), heading: +u.h.toFixed(4), frontage: +u.w.toFixed(2), depth: +u.d.toFixed(2),
        status: u.status, morale: +u.morale.toFixed(3), order: u.order.type, engagedSides: [...u.engagedSides].sort(), encircled: !!u.encircled })),
      events: s.events.slice(),
    };
  }

  root.CannaeSim = { RULES, QUALITY, SCRIPT, create, step, snapshot, corners, fwd, _dev: { blocked, touches, flankAttacked, blockedByFriend } };
})(typeof window !== "undefined" ? window : globalThis);
