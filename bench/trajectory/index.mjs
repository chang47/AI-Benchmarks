// Format detection + dispatch. `parseFile(path)` works on ANY supported transcript:
// a bench run's raw.jsonl, a headless session, or an interactive Claude Code session file.
import { readFileSync } from "node:fs";
import { PARSER_SCHEMA_VERSION } from "./common.mjs";
import { PARSER_ID as CLAUDE_ID, parseClaude } from "./parse-claude.mjs";
import { PARSER_ID as CODEX_ID, parseCodex } from "./parse-codex.mjs";
import { PARSER_ID as PI_ID, parsePi } from "./parse-pi.mjs";

export function readJsonl(path) {
  const out = [];
  const bad = [];
  readFileSync(path, "utf8").split(/\r?\n/).forEach((line, n) => {
    if (!line.trim()) return;
    try { out.push(JSON.parse(line)); } catch { bad.push(n + 1); }
  });
  return { events: out, badLines: bad };
}

export function detectFormat(events) {
  for (const e of events.slice(0, 50)) {
    if (e.type === "thread.started" || (typeof e.type === "string" && e.type.startsWith("item."))) return "codex";
    if (e.type === "session" && e.version != null && e.cwd) return "pi";
    if (e.type === "message_end" || e.type === "agent_start") return "pi";
    if (e.type === "system" && (e.subtype === "init" || e.subtype?.startsWith("hook"))) return "claude";
    if ((e.type === "user" || e.type === "assistant") && e.message && (e.sessionId || e.session_id || e.uuid)) return "claude";
  }
  return null;
}

const PARSERS = {
  claude: { id: CLAUDE_ID, fn: parseClaude },
  codex: { id: CODEX_ID, fn: parseCodex },
  pi: { id: PI_ID, fn: parsePi },
};

export function parseEvents(events, format = detectFormat(events), { cwd } = {}) {
  const p = PARSERS[format];
  if (!p) throw new Error(`unrecognized transcript format (not Claude Code / Codex / pi JSONL)`);
  const r = p.fn(events);
  relativize(r.steps, cwd || r.info.init?.cwd || events.find((e) => e.type === "session")?.cwd);
  return { format, parserVersion: p.id, schemaVersion: PARSER_SCHEMA_VERSION, ...r };
}

export function parseFile(path, format, opts) {
  const { events, badLines } = readJsonl(path);
  const r = parseEvents(events, format, opts);
  return { ...r, rawEventCount: events.length, badLines };
}

/** Show paths inside the agent's workspace relative to it ("./src/x.mjs"), in every escaping. */
function relativize(steps, cwd) {
  if (!cwd) return;
  const variants = [cwd, cwd.split("\\").join("/"), cwd.split("\\").join("\\\\")]
    .flatMap((v) => [v + "\\", v + "/", v + "\\\\", v]).sort((a, b) => b.length - a.length);
  for (const s of steps) for (const k of ["summary", "body"]) {
    if (typeof s[k] !== "string") continue;
    for (const v of variants) if (v.length > 3) s[k] = s[k].split(v).join(/[\\/]$/.test(v) ? "./" : ".");
  }
}
