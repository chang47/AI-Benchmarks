# Normalized trajectory schema (v1)

Every parser (`parse-claude.mjs`, `parse-codex.mjs`, `parse-pi.mjs`) turns a harness's raw JSONL
into the same shape. The renderer, and later a hosted platform, reads only this.

```
raw.jsonl  ──parse (versioned: claude@1, codex@1, pi@1)──▶  steps.json + meta.metrics  ──render──▶  HTML
(immutable)                                                 (re-derive: bench reparse)             (throwaway)
```

## Step

```json
{ "i": 12, "t": "2026-…", "kind": "user|assistant-text|thinking|tool-call|tool-result|system|final",
  "tool": "Write", "toolId": "…", "summary": "Write ./src/bowling.mjs (4.1 KB)", "body": "…full content…",
  "isError": false, "usage": { … }, "contextTokens": 48147, "contextDelta": 15831, "subagent": null }
```

- Workspace paths are rewritten relative to the agent's workspace (`./src/…`).
- `contextTokens` = input + cache_creation + cache_read for the model call that produced the step
  (CtxMap's formula), attached to the first step of each call; `null` when the harness doesn't say.
  `contextDelta` > 5K is 🔥, > 1K is ⚠️.
- `subagent` = parent tool-use id (or `"sidechain"`), so sub-agent work is shown indented, not dropped.

## Metrics (meta.json → metrics)

`durationMs` (runner's wall clock) · `harnessDurationMs` · `numTurns` · `inputTokens` · `outputTokens` ·
`cacheReadTokens` · `cacheCreationTokens` · `reasoningTokens` · `peakContextTokens` · `toolCalls{}` ·
`toolErrors` · `costUsdEstimate` + `costBasis` · `artifactProduced`.

**Null means "the harness did not report it" — never a guess.**

| Harness | per-step context | cost | model reported |
|---|---|---|---|
| Claude Code | yes | list-price estimate (`costBasis: list`) | yes |
| claude-glm | no (GLM streams zeroed usage) | no | yes |
| Codex CLI | no (usage per turn only) | no | no |
| pi | yes | provider-price estimate; `null` when pi prices at 0 (claude-bridge) | yes |
| Claude Code interactive session (`bench view`) | yes | no; totals derived from messages (`costBasis: derived-from-session-messages`) | yes |
