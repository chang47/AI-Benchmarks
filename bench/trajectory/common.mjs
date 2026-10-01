// Normalized trajectory Step schema (v1) — the contract every parser emits and the
// renderer reads. Documented in bench/trajectory/SCHEMA.md.
//
// Context-growth math is ported from CtxMap (github.com/chang47/CtxMap,
// src/core/attribution.ts): context tokens for a model call = input + cache_creation +
// cache_read; a step that grows context by > 5K is 🔥, > 1K is ⚠️.

export const PARSER_SCHEMA_VERSION = 1;
export const HOT_DELTA = 5000;
export const WARN_DELTA = 1000;

export function makeSteps() {
  const steps = [];
  let lastCtx = 0;
  return {
    steps,
    push(step) {
      const s = { i: steps.length, t: null, kind: "system", tool: null, summary: "", body: "", isError: false,
        usage: null, contextTokens: null, contextDelta: null, subagent: null, ...step };
      if (typeof s.contextTokens === "number") {
        s.contextDelta = s.contextTokens - lastCtx;
        lastCtx = s.contextTokens;
      }
      steps.push(s);
      return s;
    },
  };
}

const kb = (s) => `${(Buffer.byteLength(s || "", "utf8") / 1024).toFixed(1)} KB`;
const firstLine = (s, n = 110) => {
  const l = String(s ?? "").split(/\r?\n/).find((x) => x.trim()) || "";
  return l.length > n ? l.slice(0, n - 1) + "…" : l;
};

/** One-line human summary for a tool call, harness-agnostic. */
export function summarizeTool(name, input) {
  const i = input || {};
  const path = i.file_path || i.path || i.filePath || i.notebook_path;
  const n = String(name || "").toLowerCase();
  if ((n === "write" || n === "create") && path) return `${name} ${path} (${kb(i.content)})`;
  if ((n === "edit" || n === "multiedit" || n === "str_replace") && path) return `${name} ${path}`;
  if (n === "read" && path) return `${name} ${path}`;
  if (n === "bash" || n === "powershell" || n === "shell") return `${name}: ${firstLine(i.command)}`;
  if (n === "grep" || n === "glob") return `${name} ${i.pattern ?? ""}`.trim();
  if (n === "task" || n === "agent") return `${name} (${i.subagent_type || "subagent"}): ${firstLine(i.description || i.prompt, 80)}`;
  if (n === "webfetch" || n === "websearch") return `${name} ${i.url || i.query || ""}`.trim();
  const j = JSON.stringify(i);
  return `${name} ${j.length > 100 ? j.slice(0, 99) + "…" : j}`;
}

export function textOf(content) {
  if (content == null) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((c) => (typeof c === "string" ? c : c.text ?? (c.type === "image" ? "[image]" : JSON.stringify(c)))).join("\n");
  return content.text ?? JSON.stringify(content);
}

export const pretty = (v) => (typeof v === "string" ? v : JSON.stringify(v, null, 2));
export { firstLine };

/** Metrics every parser returns (null = the harness did not report it; never guessed). */
export function emptyMetrics() {
  return {
    harnessDurationMs: null, numTurns: null,
    inputTokens: null, outputTokens: null, cacheReadTokens: null, cacheCreationTokens: null,
    reasoningTokens: null, peakContextTokens: null, toolCalls: {}, toolErrors: 0,
    costUsdEstimate: null, costBasis: null, usageScope: null, mainThreadOutputTokens: null,
  };
}

export function countTools(steps) {
  const toolCalls = {};
  let toolErrors = 0;
  for (const s of steps) {
    if (s.kind === "tool-call") toolCalls[s.tool] = (toolCalls[s.tool] || 0) + 1;
    if (s.kind === "tool-result" && s.isError) toolErrors++;
  }
  return { toolCalls, toolErrors };
}

export function peakContext(steps) {
  const v = steps.map((s) => s.contextTokens).filter((x) => typeof x === "number");
  return v.length ? Math.max(...v) : null;
}
