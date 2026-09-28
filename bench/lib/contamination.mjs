// Contamination scan — a READ-ONLY diagnostic over a run's raw.jsonl (never edited). It flags:
//   web-tool            the agent called a web tool (WebFetch / WebSearch / codex web_search / any *fetch*/*browse* tool)
//   network-command     a shell command that reaches the network: curl / wget / Invoke-WebRequest / iwr / irm /
//                       fetch( / git clone|fetch|pull / gh / npm view|install / pip download|install / … — requests
//                       whose every URL is loopback (curl localhost:3000) are counted, not flagged
//   benchmark-reference the agent wrote, ran or read a string naming this benchmark (github.com/chang47,
//                       AI-Benchmarks, ai-benchmark, vetted-bench, + bench.json contamination.extraTerms)
// The flag is UNSCORED: it is shown next to the score, never folded into it.
import { readJsonl, parseEvents } from "../trajectory/index.mjs";

export const SCANNER_ID = "contamination@1";

export const BENCHMARK_TERMS = ["github.com/chang47", "AI-Benchmarks", "ai-benchmark", "vetted-bench", "vetted bench"];

const SHELL_TOOL = /^(bash|powershell|pwsh|shell|sh|cmd|terminal|exec|exec_command|run_command|run_shell_command|local_shell)$/i;
const WEB_TOOL = /web|fetch|browse|browser|http_request|url_open|open_url/i;

// [category, regex, codeLevel] — matched against shell commands only (agent-written file contents may legitimately
// call fetch()). codeLevel patterns (fetch( / http.get( inside `node -e`, or a grep for "fetch(") only count when the
// command also holds a non-loopback URL; CLI clients (curl, wget, iwr…) count unless every target is loopback.
// Calibrated 2026-09-28 on the 72 local runs: the only remaining hits were real `npm install`s.
const NET_PATTERNS = [
  ["http-client", /\bcurl(?:\.exe)?\s/i],
  ["http-client", /\bwget(?:\.exe)?\s/i],
  ["http-client", /\bInvoke-WebRequest\b/i],
  ["http-client", /(^|[\s;|&(])iwr\s/i],
  ["http-client", /\bInvoke-RestMethod\b/i],
  ["http-client", /(^|[\s;|&(])irm\s/i],
  ["http-client", /\bfetch\s*\(/, true],
  ["http-client", /\bNet\.WebClient\b|\bStart-BitsTransfer\b|\bcertutil\b.*-urlcache/i],
  ["http-client", /\brequests\.(get|post)\s*\(|\burllib\.request\b|\bhttps?\.get\s*\(/, true],
  ["git-remote", /\bgit\s+(clone|fetch|pull|ls-remote|push|submodule\s+update|remote\s+add)\b/i],
  ["gh-cli", /(^|[\s;|&(])gh(?:\.exe)?\s+(api|repo|search|pr|issue|release|gist|browse|run)\b/i],
  ["package-registry", /\bnpm(?:\.cmd)?\s+(view|v|info|show|search|pack|install|i|add|ci|update|exec)\b/i],
  ["package-registry", /\b(pnpm|yarn)\s+(add|install|dlx|info|view|search)\b/i],
  ["package-registry", /\b(pip3?|python3?\s+-m\s+pip|uv\s+pip)\s+(download|install)\b/i],
  ["package-registry", /\bcargo\s+(add|install|fetch)\b|\bgo\s+(get|install)\s|\bgem\s+install\b/i],
];
const URL_RE = /\bhttps?:\/\/[a-z0-9[][^\s'"`)<>\\]*/gi; // needs a host char: grep patterns like "http://\|" are not URLs
const LOOPBACK = /^https?:\/\/(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[::1\])([:/?#]|$)/i;
const LOOPBACK_HOST = /\b(localhost|127\.0\.0\.1|0\.0\.0\.0)\b|\[::1\]/i;

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const excerpt = (text, idx, len = 160) => {
  const a = Math.max(0, idx - 60);
  return (a ? "…" : "") + text.slice(a, a + len).replace(/\s+/g, " ").trim() + (a + len < text.length ? "…" : "");
};

/** The shell command inside a tool-call body (JSON input with a `command`), or the body itself. */
function commandOf(body) {
  try {
    const j = JSON.parse(body);
    if (typeof j === "string") return j;
    if (j && typeof j.command === "string") return j.command;
    if (j && Array.isArray(j.command)) return j.command.join(" ");
    if (j && typeof j.cmd === "string") return j.cmd;
  } catch { /* plain text body (codex) */ }
  return body || "";
}

/** Scan normalized steps. Pure; `steps` come from the parsers (raw is only read). */
export function scanSteps(steps, { extraTerms = [] } = {}) {
  const flags = [];
  let loopbackRequests = 0;
  const terms = [...BENCHMARK_TERMS, ...extraTerms].filter(Boolean);
  const termRe = new RegExp(terms.map(esc).join("|"), "gi");
  for (const s of steps) {
    const tool = s.tool || "";
    if (s.kind === "tool-call") {
      if (WEB_TOOL.test(tool) && !SHELL_TOOL.test(tool)) {
        const urls = String(s.body || "").match(URL_RE) || [];
        if (urls.length && urls.every((u) => LOOPBACK.test(u))) loopbackRequests++; // e.g. a browser tool on localhost
        else flags.push({ kind: "web-tool", category: "web-tool", step: s.i, tool, match: tool, excerpt: (s.summary || "").slice(0, 200) });
      }
      if (SHELL_TOOL.test(tool)) {
        const cmd = commandOf(s.body);
        const urls = cmd.match(URL_RE) || [];
        const remoteUrls = urls.filter((u) => !LOOPBACK.test(u));
        // every URL is loopback, or there is no URL but the command names a loopback host (http.get({host: "127.0.0.1"}))
        const loopbackOnly = !remoteUrls.length && (urls.length > 0 || LOOPBACK_HOST.test(cmd));
        const seen = new Set();
        for (const [category, re, codeLevel] of NET_PATTERNS) {
          const m = re.exec(cmd);
          if (!m || seen.has(category)) continue;
          if (category === "http-client" && loopbackOnly) { seen.add(category); loopbackRequests++; continue; }
          if (codeLevel && !remoteUrls.length) continue; // "fetch(" in a grep pattern or a script with no remote target
          seen.add(category);
          flags.push({ kind: "network-command", category, step: s.i, tool, match: m[0].trim(), excerpt: excerpt(cmd, m.index),
            urls: urls.filter((u) => !LOOPBACK.test(u)).slice(0, 5) });
        }
        if (!seen.size) {
          const remote = urls.filter((u) => !LOOPBACK.test(u));
          if (remote.length) flags.push({ kind: "network-command", category: "remote-url", step: s.i, tool, match: remote[0], excerpt: excerpt(cmd, cmd.indexOf(remote[0])), urls: remote.slice(0, 5) });
        }
      }
    }
    // Benchmark references: anything the agent wrote, ran, thought or read back (never the prompt itself).
    if (["tool-call", "tool-result", "assistant-text", "thinking"].includes(s.kind) && terms.length) {
      for (const text of [s.body, s.summary]) {
        if (typeof text !== "string" || !text) continue;
        termRe.lastIndex = 0;
        const m = termRe.exec(text);
        if (m) {
          flags.push({ kind: "benchmark-reference", category: s.kind === "tool-result" ? "seen-in-tool-output" : "agent-authored",
            step: s.i, tool: tool || null, match: m[0], excerpt: excerpt(text, m.index) });
          break;
        }
      }
    }
  }
  return { flags, loopbackRequests };
}

/** Web tools the harness actually offered, from Claude Code's init event (null when the harness doesn't list tools). */
export function webToolsInInit(events) {
  const init = events.find((e) => e.type === "system" && e.subtype === "init" && Array.isArray(e.tools));
  return init ? init.tools.filter((t) => /^(WebFetch|WebSearch)$/.test(t) || (/^mcp__/.test(t) && WEB_TOOL.test(t))) : null;
}

/** Scan a run's raw.jsonl (read-only). */
export function scanRaw(rawPath, format, { extraTerms = [] } = {}) {
  const { events } = readJsonl(rawPath);
  let steps = [];
  try { steps = parseEvents(events, format).steps; } catch { /* unparseable raw: no flags, noted */ }
  const { flags, loopbackRequests } = scanSteps(steps, { extraTerms });
  const counts = {};
  for (const f of flags) counts[f.kind] = (counts[f.kind] || 0) + 1;
  return {
    scanner: SCANNER_ID, scannedSteps: steps.length, flagged: flags.length > 0, counts, loopbackRequests,
    webToolsInInit: webToolsInInit(events), terms: [...BENCHMARK_TERMS, ...extraTerms], flags: flags.slice(0, 200), truncated: flags.length > 200,
  };
}

/**
 * Whether the run's harness offered web tools, from the harness + effective profile (declared, not observed).
 *   claude / claude-glm: WebFetch + WebSearch unless both are in tools.deny ("partial" if one is).
 *   codex: its native web_search tool unless tools.deny names WebSearch/web_search (→ -c web_search="disabled").
 *   pi: no built-in web tool; clean mode loads no extensions → false; josh mode may load extensions → null (unknown).
 * Shell network access (curl etc.) is NOT covered by any of these — that is what the scan above is for.
 */
export function webToolsAvailable(harness, profile = {}) {
  const deny = new Set((profile.tools?.deny || []).map((t) => t.toLowerCase()));
  if (harness === "claude" || harness === "claude-glm") {
    const denied = ["webfetch", "websearch"].filter((t) => deny.has(t)).length;
    return denied === 2 ? false : denied === 1 ? "partial" : true;
  }
  if (harness === "codex") return !(deny.has("websearch") || deny.has("web_search"));
  if (harness === "pi") return profile.harnessSetup === "clean" ? false : null;
  return null;
}
