// Claude Code → normalized steps. Handles BOTH:
//   - headless `claude -p --output-format stream-json --verbose` (system/init … result), and
//   - interactive session files (~/.claude/projects/**/<session>.jsonl), which carry the
//     same message shapes but no init/result events.
// Assistant events arrive one content block per line, repeating the message id; usage is
// per message, so context is attributed to the FIRST step of each message id.
import { countTools, emptyMetrics, firstLine, makeSteps, peakContext, pretty, summarizeTool, textOf } from "./common.mjs";

export const PARSER_ID = "claude@1";

export function parseClaude(events) {
  const { steps, push } = makeSteps();
  const m = emptyMetrics();
  const info = { modelReported: null, sessionId: null, finalText: null, isError: null, stopReason: null, errorDetail: null, init: null };
  const seenMsg = new Set();
  const lastUsage = new Map(); // message id → last usage seen (for sessions with no result event)
  const allUsage = new Map(); // same, but including sub-agent messages (their tokens are real spend too)
  let firstT = null, lastT = null;
  const toolNames = new Map();

  for (const e of events) {
    const t = e.timestamp || null;
    if (t) { firstT = firstT || t; lastT = t; }
    const sub = e.parent_tool_use_id || (e.isSidechain ? "sidechain" : null);

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
      if (msg.id && msg.usage) allUsage.set(msg.id, msg.usage);
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
        m.usageScope = "all-agents";
      } else m.usageScope = "main-thread";
      const basis = mu.map((x) => x.costBasis).find(Boolean) || null;
      m.costBasis = basis;
      // Only a list-price basis is a meaningful API-equivalent estimate (GLM via claude-glm reports "unknown").
      m.costUsdEstimate = basis === "list" ? e.total_cost_usd ?? null : null;
      push({ t, kind: "final", isError: !!e.is_error, summary: `${e.subtype}${e.is_error ? " (error)" : ""} · ${e.num_turns} turns · ${((e.duration_ms || 0) / 1000).toFixed(1)}s`, body: info.finalText || "" });
    }
  }

  // Interactive session files have no result event: derive what we can, and say so via costBasis.
  // A headless run killed by the time limit has no result event either. Tokens are summed over every message,
  // sub-agents included; cost stays null (never estimated from a price table).
  if (m.numTurns == null && lastUsage.size) {
    const us = [...allUsage.values()];
    const sum = (k) => us.reduce((a, u) => a + (u[k] || 0), 0);
    m.numTurns = lastUsage.size;
    m.inputTokens = sum("input_tokens"); m.outputTokens = sum("output_tokens");
    m.cacheReadTokens = sum("cache_read_input_tokens"); m.cacheCreationTokens = sum("cache_creation_input_tokens");
    m.mainThreadOutputTokens = [...lastUsage.values()].reduce((a, u) => a + (u.output_tokens || 0), 0);
    m.usageScope = "all-agents-derived-from-messages";
    m.costBasis = "derived-from-session-messages";
    // Headless stream-json logs a message's usage before it finishes streaming, so a killed run's output counts
    // are partial (a 2-hour run summed to ~1.3k). Input/cache counts are known up front and stay; output → null.
    if (info.init) { m.outputTokens = null; m.mainThreadOutputTokens = null; m.usageScope += "; output unknown (run killed)"; }
    if (firstT && lastT) m.harnessDurationMs = new Date(lastT) - new Date(firstT);
  }
  if (info.finalText == null) {
    const last = [...steps].reverse().find((s) => s.kind === "assistant-text" && !s.subagent);
    info.finalText = last ? last.body : null;
  }
  Object.assign(m, countTools(steps));
  m.peakContextTokens = peakContext(steps);
  return { steps, metrics: m, info };
}
