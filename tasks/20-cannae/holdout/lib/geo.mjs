// Geometry + history helpers for the Cannae grader. Map: x east, y north; heading 0 = north.
export const REQUIRED = ["R-cav", ...Array.from({ length: 10 }, (_, i) => `R-inf-${i + 1}`), "R-acav", "R-vel", "C-cav", "C-lib-W",
  ...Array.from({ length: 10 }, (_, i) => `C-cen-${i + 1}`), "C-lib-E", "C-num", "C-bal"];

const SPANIARD = new Set([2, 5, 8]);
/** The frozen order of battle: [men, centre x, front-edge y, frontage, heading]. */
export function spec(id) {
  let m;
  if (id === "R-cav") return [2400, -705, 300, 360, Math.PI];
  if ((m = /^R-inf-(\d+)$/.exec(id))) return [5500, -472.5 + 105 * (m[1] - 1), 300, 105, Math.PI];
  if (id === "R-acav") return [3600, 795, 300, 540, Math.PI];
  if (id === "R-vel") return [15000, 0, 240, 1050, Math.PI];
  if (id === "C-cav") return [6500, -705, -300, 360, 0];
  if (id === "C-lib-W") return [5000, -600, -380, 150, 0];
  if (id === "C-lib-E") return [5000, 600, -380, 150, 0];
  if ((m = /^C-cen-(\d+)$/.exec(id))) { const x = -472.5 + 105 * (m[1] - 1); return [SPANIARD.has(+m[1]) ? 5000 / 3 : 18000 / 7, x, -150 - 150 * (Math.abs(x) / 525) ** 2, 105, 0]; }
  if (id === "C-num") return [3500, 795, -300, 540, 0];
  if (id === "C-bal") return [8000, 0, -90, 1250, 0];
  return null;
}

export const fwd = (h) => [Math.sin(h), Math.cos(h)];
export const right = (h) => [Math.cos(h), -Math.sin(h)];
export const frontY = (u) => u.y + Math.cos(u.heading) * u.depth / 2;
export function corners(u) {
  const f = fwd(u.heading), r = right(u.heading), a = u.frontage / 2, b = u.depth / 2;
  return [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([i, j]) => [u.x + f[0] * b * i + r[0] * a * j, u.y + f[1] * b * i + r[1] * a * j]);
}
const segDist = (p, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};
/** Penetration depth of two rectangles along the best separating axis (≤ 0 when apart). */
export function overlapDepth(a, b) {
  let best = Infinity;
  for (const [ax, ay] of [fwd(a.heading), right(a.heading), fwd(b.heading), right(b.heading)]) {
    const proj = (u) => { const c = u.x * ax + u.y * ay, f = fwd(u.heading), r = right(u.heading); const e = Math.abs(f[0] * ax + f[1] * ay) * u.depth / 2 + Math.abs(r[0] * ax + r[1] * ay) * u.frontage / 2; return [c - e, c + e]; };
    const [a0, a1] = proj(a), [b0, b1] = proj(b);
    best = Math.min(best, Math.min(a1, b1) - Math.max(a0, b0));
  }
  return best;
}
/** Gap between two rectangles (0 when they touch or overlap). */
export function rectDist(a, b) {
  if (overlapDepth(a, b) > 0) return 0;
  const ca = corners(a), cb = corners(b);
  let d = Infinity;
  for (let i = 0; i < 4; i++) for (const p of cb) d = Math.min(d, segDist(p, ca[i], ca[(i + 1) % 4]));
  for (let i = 0; i < 4; i++) for (const p of ca) d = Math.min(d, segDist(p, cb[i], cb[(i + 1) % 4]));
  return d;
}
export const alive = (u) => u && !["destroyed", "left", "split"].includes(u.status) && u.men > 0.5;
export const angDiff = (a, b) => Math.abs(((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
export const dead = (units, side) => units.filter((u) => u.side === side).reduce((a, u) => a + Math.max(0, (u.men0 ?? 0) - (u.men ?? 0)), 0);
export const band = (x, bands) => { for (const [min, pts] of bands) if (x >= min) return pts; return 0; };
