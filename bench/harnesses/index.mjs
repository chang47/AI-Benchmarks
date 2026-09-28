// Harness adapters. Each one knows how to launch its CLI headlessly, reproducibly,
// in a "clean" setup (no user CLAUDE.md/AGENTS.md, skills, hooks, plugins, MCP) or
// in Josh's real setup ("josh"). All emit JSONL on stdout; `rawFormat` names the parser.
//
// Verified 2026-09-26 against: Claude Code 2.1.283, codex-cli 0.155.1, pi 0.85.x.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { HOME, capture } from "../lib/util.mjs";

const CLAUDE_CLEAN = ["--setting-sources", "", "--strict-mcp-config", "--disable-slash-commands", "--no-chrome"];

function claudeArgs({ model, profile }) {
  const a = ["-p", "--model", model, "--output-format", "stream-json", "--verbose",
    "--dangerously-skip-permissions", "--no-session-persistence"];
  if (profile.harnessSetup === "clean") a.push(...CLAUDE_CLEAN);
  if (profile.tools?.deny?.length) a.push("--disallowed-tools", ...profile.tools.deny);
  if (profile.tools?.allow?.length) a.push("--allowed-tools", ...profile.tools.allow);
  if (profile.skill) a.push("--append-system-prompt-file", profile.skill);
  if (profile.effort) a.push("--effort", profile.effort);
  return a;
}

// claude-glm = Claude Code pointed at a different config dir whose settings.json `env`
// carries the GLM endpoint + token. With --setting-sources "" that env would be dropped,
// so for the clean setup we inject it into the process env ourselves (never logged).
function glmEnv(profile) {
  const dir = join(HOME, ".claude-glm");
  const env = { ...process.env, CLAUDE_CONFIG_DIR: dir };
  if (profile.harnessSetup === "clean") {
    const s = JSON.parse(readFileSync(join(dir, "settings.json"), "utf8"));
    Object.assign(env, s.env || {});
  }
  return env;
}

const PI_CLI = join(process.env.APPDATA || "", "npm", "node_modules", "@earendil-works", "pi-coding-agent", "dist", "bundle", "cli.js");
const PI_CLAUDE_BRIDGE = join(HOME, ".pi", "agent", "npm", "node_modules", "pi-claude-bridge", "src", "index.ts");

export const HARNESSES = {
  claude: {
    id: "claude",
    rawFormat: "claude",
    command: ({ model, profile }) => ({ cmd: "claude", args: claudeArgs({ model, profile }), env: { ...process.env } }),
    version: () => capture("claude", ["--version"]),
  },

  "claude-glm": {
    id: "claude-glm",
    rawFormat: "claude",
    defaultModel: "glm-5.3",
    command: ({ model, profile }) => ({ cmd: "claude", args: claudeArgs({ model, profile }), env: glmEnv(profile) }),
    version: async () => `${await capture("claude", ["--version"])} (CLAUDE_CONFIG_DIR=~/.claude-glm)`,
  },

  codex: {
    id: "codex",
    rawFormat: "codex",
    defaultModel: "gpt-6-astra",
    command: ({ model, profile }) => {
      const a = ["exec", "--json", "--skip-git-repo-check", "--ephemeral",
        "--dangerously-bypass-approvals-and-sandbox", "-m", model];
      // Clean: skip ~/.codex/config.toml + execpolicy rules. Auth still comes from CODEX_HOME.
      if (profile.harnessSetup === "clean") a.push("--ignore-user-config", "--ignore-rules");
      a.push("-c", `model_reasoning_effort=${profile.effort || "high"}`);
      // Codex has one web tool, its native `web_search` (search + open page). tools.deny naming WebSearch/web_search
      // turns it off via the top-level config key (0.155.1 accepts disabled|cached|indexed|live; verified 2026-09-28).
      // Codex has no per-tool deny list otherwise; shell network access (curl) is untouched by this.
      if ((profile.tools?.deny || []).some((t) => /^(websearch|web_search)$/i.test(t))) a.push("-c", 'web_search="disabled"');
      // Skill-under-test for codex = an AGENTS.md dropped into the workspace (see run.mjs).
      a.push("-"); // prompt on stdin
      return { cmd: "codex", args: a, env: { ...process.env }, cwdFlag: "-C" };
    },
    version: () => capture("codex", ["--version"]),
  },

  pi: {
    id: "pi",
    rawFormat: "pi",
    defaultModel: "zai/glm-5.3",
    command: ({ model, profile, prompt }) => {
      const [provider, ...rest] = model.includes("/") ? model.split("/") : [null, model];
      const a = [PI_CLI, "-p", "--mode", "json", "--no-session"];
      if (provider) a.push("--provider", provider);
      a.push("--model", rest.join("/"));
      if (profile.harnessSetup === "clean") {
        a.push("--no-skills", "--no-prompt-templates", "--no-context-files", "--no-themes", "--no-approve", "--no-extensions");
        // Claude models in pi route through the claude-bridge extension; load only that one.
        if (provider === "claude-bridge") a.push("-e", PI_CLAUDE_BRIDGE);
      }
      if (profile.effort) a.push("--thinking", profile.effort);
      // pi's built-ins (read, bash, powershell, edit, write, grep, find, ls) include no web tool, so denying
      // WebFetch/WebSearch is a no-op in clean mode; it matters only for extensions loaded in josh mode.
      if (profile.tools?.deny?.length) a.push("--exclude-tools", profile.tools.deny.join(","));
      if (profile.skill) a.push("--skill", profile.skill);
      a.push(prompt); // pi takes the prompt as an argument
      return { cmd: process.execPath, args: a, env: { ...process.env }, promptInArgs: true };
    },
    version: async () => {
      const p = join(process.env.APPDATA || "", "npm", "node_modules", "@earendil-works", "pi-coding-agent", "package.json");
      return existsSync(p) ? `pi ${JSON.parse(readFileSync(p, "utf8")).version}` : "pi (unknown)";
    },
  },
};

export function getHarness(id) {
  const h = HARNESSES[id];
  if (!h) throw new Error(`unknown harness "${id}" (have: ${Object.keys(HARNESSES).join(", ")})`);
  return h;
}

/** Short, filesystem-safe alias for run ids: "claude-opus-5-5" → "opus55", "zai/glm-5.3" → "glm53". */
export function modelAlias(model) {
  const m = model.split("/").pop().replace(/^claude-/, "").replace(/\[.*\]$/, "");
  return m.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 14);
}
