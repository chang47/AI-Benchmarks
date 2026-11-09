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

`durationMs` (runner's wall clock) · `harnessDurationMs` · `numTurns` · `inputTokens` (uncached) · `outputTokens` ·
`cacheReadTokens` · `cacheCreationTokens` (+ `cacheWrite5mTokens` / `cacheWrite1hTokens` when the log splits the TTL) ·
`totalTokens` (input + cache write + cache read + output; null if input or output is unknown) · `reasoningTokens` ·
`peakContextTokens` · `toolCalls{}` · `toolErrors` · `costUsdEstimate` + `costBasis` + `costSource` (+ `costNote`) ·
`costPriceTable` · `usageScope` · `artifactProduced`.

### Cost (2026-11-08, parser `claude@2`)

| `costBasis` | `costSource` | meaning | page shows |
|---|---|---|---|
| `list` | `result-event` | headless run: `result.total_cost_usd` (Claude Code's list-price figure) | `$X (reported by Claude Code)` |
| `list` | `session-cost-state` | interactive session file: the last `cost-state` event's `totalCostUSD`; token totals come from its `modelUsage` too (`usageScope: all-agents-session-cost-state`: main thread + sub-agents saved in separate files + compaction) | `$X (reported by Claude Code)` |
| `estimated-from-price-table` | `price-table` | session file with no usable `cost-state`: every model call (one per message id, last usage seen) priced by its own model from `prices.json` | `≈ $X (estimate, list prices <date>)` |
| `pi-provider-price` | — | pi's per-message `cost.total` | `$X (reported by pi)` |
| `unknown` / `null` | — | not reported (GLM via claude-glm, Codex) or a killed headless run (`costNote` says why) | `—` |

- **`cost-state` must cover the file.** It is written periodically; if it counts fewer input/output/cache tokens than the
  file's own messages it is stale (`costNote` names it) and the price-table estimate is used. `hasUnknownModelCost` → not used.
- **`costPriceTable`** (session files only) = `{ usd, basis, pricesRead, source, calls, byModel{model: {calls, usd, tokens}},
  unknownModels[], scope: "this file's messages" }`, the cross-check shown in Run details. Any model missing from
  `prices.json` → `usd: null` and the model listed in `unknownModels`: never a guess. Not computed for headless stream-json,
  whose per-message output counts are logged before the message finishes streaming (partial).
- **Pricing rules applied per call** (from the pricing page): cache writes by TTL (`cache_creation.ephemeral_5m/1h_input_tokens`;
  no split logged = 5 minutes, the API default); Claude Haiku 5.5's higher tier when the call's prompt (input + cache write +
  cache read) is over 100,000 tokens; `usage.speed: "fast"` → fast-mode prices; `inference_geo: "us"` → 1.1x on 4.6+ models;
  `server_tool_use.web_search_requests` at $10 / 1,000. A dated pre-4.6 id (`claude-haiku-4-5-20251001`) uses its alias's row.
- Verified 2026-11-08: the table reproduces Claude Code's own `cost-state` figure to the cent-fraction on three Opus 5.5
  session files and a Haiku 5.5 one (e.g. $2.2973636 both ways).
- **Wall clock for a session file** = latest − earliest timestamp (a resumed or forked file replays inherited history
  after a newer queue event, so file order is not time order).

**Null means "the harness did not report it" — never a guess.**

**Token totals include sub-agents** (2026-10-01). Claude Code's `result.usage` covers the main thread only; the parser
sums `result.modelUsage` instead, so a run that fans out to sub-agents reports the tokens behind its full cost
(`mainThreadOutputTokens` keeps the main-thread figure; `usageScope` says which). A headless run killed by the time
limit has no result event: input/cache tokens are summed over every message, output tokens and cost stay `null`
(stream-json logs a message's usage before it finishes streaming, so summed output counts are partial).

| Harness | per-step context | cost | model reported |
|---|---|---|---|
| Claude Code | yes | reported list price (`costBasis: list`, `costSource: result-event`) | yes |
| claude-glm | no (GLM streams zeroed usage) | no | yes |
| Codex CLI | no (usage per turn only) | no | no |
| pi | yes | provider-price estimate; `null` when pi prices at 0 (claude-bridge) | yes |
| Claude Code interactive session (`bench view`) | yes | reported via the `cost-state` event (`costBasis: list`); else a price-table estimate (`costBasis: estimated-from-price-table`) | yes |
