// Cost estimate from the committed list-price table (prices.json), used only when a harness reported
// no cost. Priced per model call by THAT call's model (a session can switch models). A model the table
// doesn't have makes the whole estimate unknown (usd null) and is named, never guessed.
import { readFileSync } from "node:fs";

const PRICE_KEYS = ["input", "cacheWrite5m", "cacheWrite1h", "cacheRead", "output"];
let cached = null;

export function loadPrices() {
  if (cached) return cached;
  const t = JSON.parse(readFileSync(new URL("./prices.json", import.meta.url), "utf8"));
  for (const [id, p] of Object.entries(t.models || {})) {
    const missing = PRICE_KEYS.filter((k) => typeof p[k] !== "number");
    if (missing.length || !p.source || !/^\d{4}-\d{2}-\d{2}$/.test(p.read || "")) throw new Error(`prices.json ${id}: missing ${missing.join(", ") || "source/read date"}`);
  }
  return (cached = t);
}

/** The table entry for a model id: exact, else a pre-4.6 dated snapshot's alias (claude-haiku-4-5-20251001 → claude-haiku-4-5). */
export function priceFor(model, table = loadPrices()) {
  if (!model) return null;
  const id = String(model).replace(/\[1m\]$/i, "");
  return table.models[id] || table.models[id.replace(/-\d{8}$/, "")] || null;
}

/** Split one API usage object into the token categories the price table prices. */
export function usageParts(u) {
  const cw = u.cache_creation_input_tokens || 0;
  const cw1h = u.cache_creation?.ephemeral_1h_input_tokens || 0;
  // No TTL split logged (or a remainder): the API's default cache TTL is 5 minutes.
  const cw5m = Math.max(cw - cw1h, u.cache_creation?.ephemeral_5m_input_tokens || 0);
  return { input: u.input_tokens || 0, cacheWrite5m: cw5m, cacheWrite1h: cw1h, cacheRead: u.cache_read_input_tokens || 0,
    output: u.output_tokens || 0, webSearches: u.server_tool_use?.web_search_requests || 0 };
}

/** USD for one model call, or null when the model isn't in the table. */
export function callCost(model, u, table = loadPrices()) {
  const p = priceFor(model, table);
  if (!p) return null;
  const t = usageParts(u);
  let rate = p;
  const prompt = t.input + t.cacheWrite5m + t.cacheWrite1h + t.cacheRead;
  if (p.longContext && prompt > p.longContext.overPromptTokens) rate = p.longContext;
  let mult = { input: 1, cacheWrite5m: 1, cacheWrite1h: 1, cacheRead: 1, output: 1 };
  if (u.speed === "fast" && p.fast) {
    const k = p.fast.input / p.input; // cache multipliers stack on the fast input price
    mult = { input: k, cacheWrite5m: k, cacheWrite1h: k, cacheRead: k, output: p.fast.output / p.output };
  }
  const geo = u.inference_geo === "us" && p.usGeo ? table.usGeoMultiplier : 1;
  let usd = 0;
  for (const k of PRICE_KEYS) usd += (t[k] * rate[k] * mult[k] * geo) / 1e6;
  usd += (t.webSearches * table.webSearchPerThousand) / 1000;
  return usd;
}

/**
 * Estimate over a list of model calls [{ model, usage }]. Returns
 * { usd | null, basis, pricesRead, source, calls, byModel: { model: { calls, usd, tokens } }, unknownModels }.
 */
export function estimateCost(calls, table = loadPrices()) {
  const byModel = {};
  const unknown = new Set();
  let usd = 0;
  for (const c of calls) {
    const t = usageParts(c.usage || {});
    const b = (byModel[c.model] ||= { calls: 0, usd: 0, tokens: { input: 0, cacheWrite5m: 0, cacheWrite1h: 0, cacheRead: 0, output: 0 }, price: null });
    b.calls++;
    for (const k of PRICE_KEYS) b.tokens[k] += t[k];
    const x = callCost(c.model, c.usage || {}, table);
    if (x == null) { unknown.add(c.model); b.usd = null; continue; }
    if (b.usd != null) b.usd += x;
    usd += x;
    b.price = priceFor(c.model, table).name;
  }
  return { usd: unknown.size ? null : usd, basis: "estimated-from-price-table", pricesRead: table.read, source: table.source,
    calls: calls.length, byModel, unknownModels: [...unknown] };
}
