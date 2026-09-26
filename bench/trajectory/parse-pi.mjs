// pi (`pi -p --mode json`) → normalized steps.
// Renders from message_end events (complete messages: user / assistant / toolResult) and
// ignores the message_update streaming deltas. Usage is per assistant message:
// {input, output, cacheRead, cacheWrite, reasoning, cost.total}.
import { countTools, emptyMetrics, firstLine, makeSteps, peakContext, pretty, summarizeTool, textOf } from "./common.mjs";

export const PARSER_ID = "pi@1";

export function parsePi(events) {
  const { steps, push } = makeSteps();
  const m = emptyMetrics();
  const info = { modelReported: null, sessionId: null, finalText: null, isError: false, stopReason: null, errorDetail: null, init: null };
  const tot = { in: 0, out: 0, cr: 0, cw: 0, reasoning: 0, cost: 0, calls: 0, hasCost: false };
  const toolNames = new Map();

  for (const e of events) {
    if (e.type === "session") {
      info.sessionId = e.id;
      push({ t: e.timestamp, kind: "system", summary: `session start · pi v${e.version}`, body: pretty(e) });
      continue;
    }
    if (e.type !== "message_end" || !e.message) continue;
    const msg = e.message;
    const t = msg.timestamp ? new Date(msg.timestamp).toISOString() : null;

    if (msg.role === "user") {
      const body = textOf(msg.content);
      push({ t, kind: "user", summary: firstLine(body), body });
    } else if (msg.role === "assistant") {
      if (msg.model) info.modelReported = info.modelReported || `${msg.provider}/${msg.model}`;
      const u = msg.usage || {};
      let ctx = (u.input || 0) + (u.cacheRead || 0) + (u.cacheWrite || 0);
      tot.calls++;
      tot.in += u.input || 0; tot.out += u.output || 0; tot.cr += u.cacheRead || 0; tot.cw += u.cacheWrite || 0;
      tot.reasoning += u.reasoning || 0;
      // pi prices some providers at 0 (e.g. claude-bridge): that is "not reported", not "free".
      if (u.cost && typeof u.cost.total === "number" && u.cost.total > 0) { tot.cost += u.cost.total; tot.hasCost = true; }
      if (msg.stopReason === "error" || msg.errorMessage) {
        info.isError = true;
        info.errorDetail = msg.errorMessage || "error";
        push({ t, kind: "system", isError: true, summary: firstLine(info.errorDetail), body: msg.errorMessage || pretty(msg) });
      }
      for (const b of msg.content || []) {
        const base = { t, contextTokens: ctx || null, usage: ctx ? u : null };
        ctx = 0;
        if (b.type === "text") {
          push({ ...base, kind: "assistant-text", summary: firstLine(b.text), body: b.text });
          info.finalText = b.text;
        } else if (b.type === "thinking") {
          push({ ...base, kind: "thinking", summary: firstLine(b.thinking) || "(thinking)", body: b.thinking || "" });
        } else if (b.type === "toolCall") {
          toolNames.set(b.id, b.name);
          push({ ...base, kind: "tool-call", tool: b.name, toolId: b.id, summary: summarizeTool(b.name, b.arguments), body: pretty(b.arguments) });
        }
      }
      info.stopReason = msg.stopReason;
    } else if (msg.role === "toolResult") {
      const body = textOf(msg.content);
      push({ t, kind: "tool-result", tool: msg.toolName || toolNames.get(msg.toolCallId), toolId: msg.toolCallId,
        isError: !!msg.isError, summary: `${msg.isError ? "error · " : ""}${firstLine(body)}`, body });
    }
  }

  if (tot.calls) {
    m.numTurns = tot.calls;
    m.inputTokens = tot.in; m.outputTokens = tot.out; m.cacheReadTokens = tot.cr; m.cacheCreationTokens = tot.cw;
    m.reasoningTokens = tot.reasoning;
    m.costUsdEstimate = tot.hasCost ? Number(tot.cost.toFixed(6)) : null;
    m.costBasis = tot.hasCost ? "pi-provider-price" : null;
  }
  push({ kind: "final", isError: info.isError, summary: info.isError ? `failed · ${info.errorDetail}` : `completed · ${info.stopReason || ""}`, body: info.finalText || "" });
  Object.assign(m, countTools(steps));
  m.peakContextTokens = peakContext(steps);
  return { steps, metrics: m, info };
}
