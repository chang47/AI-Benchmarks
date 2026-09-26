// Codex CLI (`codex exec --json`) → normalized steps.
// Events: thread.started · turn.started · item.started/item.updated/item.completed ·
// turn.completed{usage} · turn.failed · error. Only item.completed is rendered (started/
// updated are progress duplicates). Codex reports usage per TURN (summed over its model
// calls), not per call, so per-step context growth is unknown → contextTokens stays null
// and peakContextTokens is null (never estimated).
import { countTools, emptyMetrics, firstLine, makeSteps, pretty } from "./common.mjs";

export const PARSER_ID = "codex@1";

export function parseCodex(events) {
  const { steps, push } = makeSteps();
  const m = emptyMetrics();
  const info = { modelReported: null, sessionId: null, finalText: null, isError: false, stopReason: null, errorDetail: null, init: null };
  const tot = { in: 0, cached: 0, out: 0, reasoning: 0, turns: 0 };

  for (const e of events) {
    if (e.type === "thread.started") {
      info.sessionId = e.thread_id;
      push({ kind: "system", summary: `thread start · ${e.thread_id}` });
    } else if (e.type === "item.completed" && e.item) {
      const it = e.item;
      if (it.type === "agent_message") {
        push({ kind: "assistant-text", summary: firstLine(it.text), body: it.text });
        info.finalText = it.text;
      } else if (it.type === "reasoning") {
        push({ kind: "thinking", summary: firstLine(it.text) || "(reasoning)", body: it.text || "" });
      } else if (it.type === "command_execution") {
        push({ kind: "tool-call", tool: "shell", toolId: it.id, summary: `shell: ${firstLine(stripShell(it.command))}`, body: it.command });
        const failed = it.exit_code != null && it.exit_code !== 0;
        push({ kind: "tool-result", tool: "shell", toolId: it.id, isError: failed || it.status === "failed",
          summary: `${failed ? `exit ${it.exit_code} · ` : ""}${firstLine(it.aggregated_output) || "(no output)"}`, body: it.aggregated_output || "" });
      } else if (it.type === "file_change") {
        const files = (it.changes || []).map((c) => `${c.kind} ${c.path}`);
        push({ kind: "tool-call", tool: "apply_patch", toolId: it.id, summary: `apply_patch ${files.join(", ")}`, body: pretty(it.changes) });
        push({ kind: "tool-result", tool: "apply_patch", toolId: it.id, isError: it.status === "failed", summary: it.status || "", body: "" });
      } else if (it.type === "mcp_tool_call") {
        push({ kind: "tool-call", tool: `${it.server}.${it.tool}`, toolId: it.id, summary: `${it.server}.${it.tool}`, body: pretty(it.arguments) });
        push({ kind: "tool-result", tool: `${it.server}.${it.tool}`, toolId: it.id, isError: it.status === "failed", summary: firstLine(pretty(it.result)), body: pretty(it.result ?? it.error) });
      } else if (it.type === "web_search") {
        push({ kind: "tool-call", tool: "web_search", toolId: it.id, summary: `web_search ${it.query || ""}`, body: pretty(it) });
      } else if (it.type === "todo_list") {
        push({ kind: "system", summary: `plan: ${(it.items || []).length} items`, body: (it.items || []).map((x) => `${x.completed ? "[x]" : "[ ]"} ${x.text}`).join("\n") });
      } else if (it.type === "error") {
        push({ kind: "system", isError: true, summary: firstLine(it.message), body: it.message });
      }
    } else if (e.type === "turn.completed") {
      const u = e.usage || {};
      tot.turns++;
      tot.in += u.input_tokens || 0;
      tot.cached += u.cached_input_tokens || 0;
      tot.out += u.output_tokens || 0;
      tot.reasoning += u.reasoning_output_tokens || 0;
      push({ kind: "system", summary: `turn complete · in ${u.input_tokens} (cached ${u.cached_input_tokens}) · out ${u.output_tokens}`, usage: u });
    } else if (e.type === "turn.failed" || e.type === "error") {
      info.isError = true;
      info.errorDetail = e.error?.message || e.message || "error";
      push({ kind: "system", isError: true, summary: firstLine(info.errorDetail), body: pretty(e) });
    }
  }

  if (tot.turns) {
    // input_tokens INCLUDES cached tokens in Codex's accounting; split them so totals are comparable.
    m.inputTokens = tot.in - tot.cached;
    m.cacheReadTokens = tot.cached;
    m.cacheCreationTokens = null;
    m.outputTokens = tot.out;
    m.reasoningTokens = tot.reasoning;
  }
  push({ kind: "final", isError: info.isError, summary: info.isError ? `failed · ${info.errorDetail}` : "completed", body: info.finalText || "" });
  m.numTurns = null; // codex does not report model-call count

  Object.assign(m, countTools(steps));
  return { steps, metrics: m, info };
}

function stripShell(cmd) {
  // "C:\…\powershell.exe" -Command "…" → the inner command, for a readable summary.
  const m = /-Command\s+(["'])([\s\S]*)\1\s*$/.exec(cmd || "");
  return m ? m[2] : cmd;
}
