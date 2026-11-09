// Claude Code → normalized steps. Handles BOTH:
//   - headless `claude -p --output-format stream-json --verbose` (system/init … result), and
//   - interactive session files (~/.claude/projects/**/<session>.jsonl), which carry the
//     same message shapes but no init/result events.
// Assistant events arrive one content block per line, repeating the message id; usage is
// per message, so context is attributed to the FIRST step of each message id.
import { countTools, emptyMetrics, firstLine, makeSteps, peakContext, pretty, summarizeTool, textOf } from "./common.mjs";
import { estimateCost } from "./cost.mjs";

export const PARSER_ID = "claude@2"; // @2 (2026-11-08): session cost-state + price-table estimate + cache-write TTL split

export function parseClaude(events) {
  const { steps, push } = makeSteps();
  const m = emptyMetrics();
  const info = { modelReported: null, sessionId: null, finalText: null, isError: null, stopReason: null, errorDetail: null, init: null };
  const seenMsg = new Set();
  const lastUsage = new Map(); // message id → last usage seen (for sessions with no result event)
  const allUsage = new Map(); // same, but including sub-agent messages (their tokens are real spend too)
  const callModel = new Map(); // message id → model that served it (priced per call: a session can switch models)
  let costState = null; // interactive session files: Claude Code's own running cost total (last one wins)
  let firstT = null, lastT = null;
  const toolNames = new Map();

  for (const e of events) {
    const t = e.timestamp || null;
    // Earliest/latest, not first/last in file order: a resumed or forked session file starts with a new queue event,
    // then replays the inherited history with its original (earlier) timestamps.
    if (t) { if (!firstT || new Date(t) < new Date(firstT)) firstT = t; if (!lastT || new Date(t) > new Date(lastT)) lastT = t; }
    const sub = e.parent_tool_use_id || (e.isSidechain ? "sidechain" : null);

    if (e.type === "cost-state") { costState = e; continue; }

    if (e.type === "system") {
      if (e.subtype === "init") {
        info.init = { cwd: e.cwd, tools: e.tools?.length, mcp: e.mcp_servers?.length, skills: e.skills?.length,
          plugins: (e.plugins || []).map((p) => p.name), agents: e.agents?.length, version: e.claude_code_version,
          permissionMode: e.permissionMode, apiKeySource: e.apiKeySource };
        info.modelReported = info.modelReported || e.model;
        info.sessionId = e.session_id;
        push({ t, kind: "system", summary: `session start · model ${e.model} · ${e.tools?.length ?? "?"} tools · ${e.skills?.length ?? 0} skills · ${(e.plugins || []).length} plugins · ${e.mcp_servers?.length ?? 0} MCP`, body: pretty(info.init) });
      } else if (e.subtype === "hook_response" || e.subtype === "hook_started") {
        if (e.subtype === "hook_response") push({ t, kind: "system", summary: `hook ${e.hook_name}`, body: String(e.output ?? e.stdout ?? "") });
      } else if (e.subtype === "api_retry") {
        push({ t, kind: "system", isError: true, summary: `API retry ${e.attempt}/${e.max_retries}: ${e.error_status} ${e.error}` });
      } else if (e.subtype === "compact_boundary") {
        push({ t, kind: "system", summary: "context compacted", body: pretty(e) });
      }
      continue;
    }

    if (e.type === "assistant" && e.message) {
      const msg = e.message;
      if (msg.model && msg.model !== "<synthetic>") info.modelReported = info.modelReported || msg.model;
      if (msg.id && msg.usage && !e.parent_tool_use_id && !e.isSidechain) lastUsage.set(msg.id, msg.usage);
      if (msg.id && msg.usage && msg.model !== "<synthetic>") { allUsage.set(msg.id, msg.usage); callModel.set(msg.id, msg.model); }
      let ctx;
      if (msg.id && !seenMsg.has(msg.id) && msg.usage) {
        seenMsg.add(msg.id);
        const u = msg.usage;
        ctx = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
        if (ctx === 0) ctx = undefined; // some providers (GLM via claude-glm) stream zeroed usage: unknown, not 0
      }
      for (const b of msg.content || []) {
        const base = { t, subagent: sub, contextTokens: ctx ?? null, usage: ctx != null ? msg.usage : null };
        ctx = undefined;
        if (b.type === "text") {
          if (msg.model === "<synthetic>") push({ ...base, kind: "system", isError: true, summary: firstLine(b.text), body: b.text });
          else push({ ...base, kind: "assistant-text", summary: firstLine(b.text), body: b.text });
        } else if (b.type === "thinking" || b.type === "redacted_thinking") {
          const body = b.thinking || "";
          push({ ...base, kind: "thinking", summary: body ? firstLine(body) : "(thinking — content not exposed)", body });
        } else if (b.type === "tool_use") {
          toolNames.set(b.id, b.name);
          push({ ...base, kind: "tool-call", tool: b.name, toolId: b.id, summary: summarizeTool(b.name, b.input), body: pretty(b.input) });
        }
      }
      continue;
    }

    if (e.type === "user" && e.message) {
      const c = e.message.content;
      if (typeof c === "string") {
        push({ t, subagent: sub, kind: "user", summary: firstLine(c), body: c });
        continue;
      }
      for (const b of c || []) {
        if (b.type === "tool_result") {
          const body = textOf(b.content);
          push({ t, subagent: sub, kind: "tool-result", tool: toolNames.get(b.tool_use_id) || null, toolId: b.tool_use_id,
            isError: !!b.is_error, summary: `${b.is_error ? "error · " : ""}${firstLine(body)}`, body });
        } else if (b.type === "text") {
          push({ t, subagent: sub, kind: "user", summary: firstLine(b.text), body: b.text });
        }
      }
      continue;
    }

    if (e.type === "result") {
      info.finalText = typeof e.result === "string" ? e.result : null;
      info.isError = !!e.is_error;
      info.stopReason = e.terminal_reason || e.subtype;
      if (e.is_error) info.errorDetail = e.api_error_status || e.subtype;
      const u = e.usage || {};
      m.harnessDurationMs = e.duration_ms ?? null;
      m.numTurns = e.num_turns ?? null;
      m.inputTokens = u.input_tokens ?? null;
      m.outputTokens = u.output_tokens ?? null;
      m.cacheReadTokens = u.cache_read_input_tokens ?? null;
      m.cacheCreationTokens = u.cache_creation_input_tokens ?? null;
      m.reasoningTokens = u.output_tokens_details?.thinking_tokens ?? null;
      const mu = Object.values(e.modelUsage || {});
      // result.usage covers the main thread only; modelUsage sums every model call, sub-agents included
      // (a run that fans out to sub-agents otherwise reports a fraction of its tokens next to its full cost).
      if (mu.length) {
        const sumMu = (k) => mu.reduce((a, x) => a + (x[k] || 0), 0);
        m.mainThreadOutputTokens = m.outputTokens;
        m.inputTokens = sumMu("inputTokens");
        m.outputTokens = sumMu("outputTokens");
        m.cacheReadTokens = sumMu("cacheReadInputTokens");
        m.cacheCreationTokens = sumMu("cacheCreationInputTokens");
        if (mu.some((x) => x.thinkingTokens != null)) m.reasoningTokens = sumMu("thinkingTokens");
        if (mu.some((x) => x.cacheCreationEphemeral1hInputTokens != null)) {
          m.cacheWrite5mTokens = sumMu("cacheCreationEphemeral5mInputTokens"); m.cacheWrite1hTokens = sumMu("cacheCreationEphemeral1hInputTokens");
        }
        m.usageScope = "all-agents";
      } else m.usageScope = "main-thread";
      const basis = mu.map((x) => x.costBasis).find(Boolean) || null;
      m.costBasis = basis;
      // Only a list-price basis is a meaningful API-equivalent estimate (GLM via claude-glm reports "unknown").
      m.costUsdEstimate = basis === "list" ? e.total_cost_usd ?? null : null;
      if (m.costUsdEstimate != null) m.costSource = "result-event";
      push({ t, kind: "final", isError: !!e.is_error, summary: `${e.subtype}${e.is_error ? " (error)" : ""} · ${e.num_turns} turns · ${((e.duration_ms || 0) / 1000).toFixed(1)}s`, body: info.finalText || "" });
    }
  }

  // A price-table estimate over this file's model calls (main thread + any sidechain messages in this file), kept as a
  // cross-check next to a reported cost and used as the cost when nothing was reported. Session files only: headless
  // stream-json logs each message's usage before it finishes streaming, so its per-message output counts are partial.
  const calls = [...allUsage.entries()].map(([id, usage]) => ({ model: callModel.get(id), usage }));
  const killed = m.numTurns == null && !!info.init; // headless run with no result event = stopped by the time limit
  if (calls.length && !info.init) m.costPriceTable = { ...estimateCost(calls), scope: "this file's messages" };

  // Interactive session files have no result event: derive what we can, and say so via costBasis.
  // A headless run killed by the time limit has no result event either. Tokens are summed over every message,
  // sub-agents included.
  if (m.numTurns == null && lastUsage.size) {
    const us = [...allUsage.values()];
    const sum = (k) => us.reduce((a, u) => a + (u[k] || 0), 0);
    m.numTurns = lastUsage.size;
    m.inputTokens = sum("input_tokens"); m.outputTokens = sum("output_tokens");
    m.cacheReadTokens = sum("cache_read_input_tokens"); m.cacheCreationTokens = sum("cache_creation_input_tokens");
    m.cacheWrite1hTokens = us.reduce((a, u) => a + (u.cache_creation?.ephemeral_1h_input_tokens || 0), 0);
    m.cacheWrite5mTokens = m.cacheCreationTokens - m.cacheWrite1hTokens; // no TTL split logged = the API default, 5 minutes
    m.mainThreadOutputTokens = [...lastUsage.values()].reduce((a, u) => a + (u.output_tokens || 0), 0);
    m.usageScope = "all-agents-derived-from-messages";
    // Headless stream-json logs a message's usage before it finishes streaming, so a killed run's output counts
    // are partial (a 2-hour run summed to ~1.3k). Input/cache counts are known up front and stay; output → null.
    if (killed) { m.outputTokens = null; m.mainThreadOutputTokens = null; m.usageScope += "; output unknown (run killed)"; }
    if (firstT && lastT) m.harnessDurationMs = new Date(lastT) - new Date(firstT);

    const cs = costState && sessionCost(costState, us);
    if (cs?.ok) {
      // Claude Code's own running total for the session: every model call it made (main thread, sub-agents whose
      // transcripts live in separate files, compaction), priced by Claude Code. Reported, so it wins.
      Object.assign(m, cs.tokens);
      m.costUsdEstimate = costState.totalCostUSD; m.costBasis = "list"; m.costSource = "session-cost-state";
      m.usageScope = "all-agents-session-cost-state";
    } else if (killed) {
      m.costNote = "no result event (run killed): output tokens unknown, so no cost and no estimate";
    } else {
      m.costUsdEstimate = m.costPriceTable?.usd ?? null;
      m.costBasis = "estimated-from-price-table"; m.costSource = "price-table";
      if (cs) m.costNote = `Claude Code's session cost-state ($${Number(costState.totalCostUSD || 0).toFixed(2)}) ${cs.why}; estimated from this file's messages instead`;
    }
  }
  const t = [m.inputTokens, m.cacheCreationTokens, m.cacheReadTokens, m.outputTokens];
  m.totalTokens = m.inputTokens != null && m.outputTokens != null ? t.reduce((a, x) => a + (x || 0), 0) : null;
  if (info.finalText == null) {
    const last = [...steps].reverse().find((s) => s.kind === "assistant-text" && !s.subagent);
    info.finalText = last ? last.body : null;
  }
  Object.assign(m, countTools(steps));
  m.peakContextTokens = peakContext(steps);
  return { steps, metrics: m, info };
}

/**
 * Is a session file's last `cost-state` event usable as the reported cost? It is Claude Code's cumulative total and
 * must cover at least every token this file's own messages show (it is written periodically, so a session that kept
 * going after the last write has a stale one). Returns { ok, tokens } or { ok: false, why }.
 */
function sessionCost(cs, usages) {
  const mu = Object.values(cs.modelUsage || {});
  if (typeof cs.totalCostUSD !== "number" || !mu.length) return { ok: false, why: "has no per-model usage" };
  if (cs.hasUnknownModelCost) return { ok: false, why: "says it could not price a model" };
  const s = (k) => mu.reduce((a, x) => a + (x[k] || 0), 0);
  const u = (k) => usages.reduce((a, x) => a + (x[k] || 0), 0);
  const pairs = [["inputTokens", "input_tokens"], ["outputTokens", "output_tokens"], ["cacheReadInputTokens", "cache_read_input_tokens"], ["cacheCreationInputTokens", "cache_creation_input_tokens"]];
  const short = pairs.filter(([a, b]) => s(a) < u(b));
  if (short.length) return { ok: false, why: `is stale (counts fewer ${short.map(([a]) => a.replace(/InputTokens|Tokens/, "")).join("/")} tokens than this file's messages)` };
  const split = mu.some((x) => x.cacheCreationEphemeral1hInputTokens != null);
  return { ok: true, tokens: {
    inputTokens: s("inputTokens"), outputTokens: s("outputTokens"), cacheReadTokens: s("cacheReadInputTokens"),
    cacheCreationTokens: s("cacheCreationInputTokens"),
    cacheWrite5mTokens: split ? s("cacheCreationEphemeral5mInputTokens") : null, cacheWrite1hTokens: split ? s("cacheCreationEphemeral1hInputTokens") : null,
    reasoningTokens: mu.some((x) => x.thinkingTokens != null) ? s("thinkingTokens") : null,
  } };
}
