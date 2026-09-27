#!/usr/bin/env node
// Export a task's graded results as a committable summary: scores only, no local paths / usernames.
// runs/ stays local (meta.json holds absolute paths); this is what goes in git so results survive.
//   node bench/export-results.mjs 18   → reports/results/<slug>.json + .md
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, RUNS_DIR, readJson, resolveTask, sha256File, taskDir } from "./lib/util.mjs";

const slug = resolveTask(process.argv[2] || "18");
const rows = [];
for (const id of readdirSync(RUNS_DIR).filter((d) => !d.startsWith("_")).sort()) {
  const m = readJson(join(RUNS_DIR, id, "meta.json"), null), r = readJson(join(RUNS_DIR, id, "result.json"), null);
  if (!m || m.task !== slug) continue;
  const scripted = r?.checks?.filter((c) => c.method !== "judge-checklist" && typeof c.points === "number") || [];
  rows.push({
    runId: id, harness: m.harness, model: m.model, profile: m.profile?.name, startedAt: m.startedAt, status: m.status,
    promptSha256: m.promptSha256, durationMin: m.metrics?.durationMs != null ? Number((m.metrics.durationMs / 60000).toFixed(1)) : null,
    outputTokens: m.metrics?.outputTokens ?? null,
    graded: r?.status === "graded", graderManifest: r?.graderManifestSha256?.slice(0, 12) ?? null,
    points: r?.pointsEarned ?? null, possible: r?.pointsPossible ?? null, score: r?.score ?? null,
    scripted: scripted.length ? `${scripted.reduce((a, c) => a + (c.earned || 0), 0)}/${scripted.reduce((a, c) => a + c.points, 0)}` : null,
    groups: r?.groups ? Object.fromEntries(Object.entries(r.groups).map(([g, v]) => [g, `${v.earned}/${v.possible}`])) : null,
    claim: r?.claim?.label ?? null, falseDone: m.status === "timeout" ? null : r?.fakeConvergence ?? null,
    lost: r?.checks?.filter((c) => (c.earned || 0) < c.points).map((c) => c.id) ?? null,
  });
}
rows.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
const out = join(ROOT, "reports", "results");
mkdirSync(out, { recursive: true });
writeFileSync(join(out, `${slug}.json`), JSON.stringify({ task: slug, exportedAt: new Date().toISOString(), runs: rows }, null, 1) + "\n");
const man = join(taskDir(slug), "holdout", "FREEZE_MANIFEST.json");
const current = existsSync(man) ? sha256File(man).slice(0, 12) : null;
const md = [`# ${slug} — results`, "", `Exported ${new Date().toISOString().slice(0, 10)} from runs/*/result.json (scores only; raw runs stay local).`,
  `Current grader: holdout FREEZE_MANIFEST sha256 ${current}. Runs graded before manifests were recorded show "—"; all rows below were graded on the same grader in one pass unless marked.`, "",
  "| Harness / model | Points | Scripted | Judge | Claimed done | False done | Build time | Lost checks |", "|---|---|---|---|---|---|---|---|",
  ...rows.map((r) => `| ${r.harness} / ${r.model} | ${r.graded ? `${r.points}/${r.possible} (${Math.round(r.score * 100)}%)` : r.status} | ${r.scripted ?? "—"} | ${r.groups?.["Judge checklist"] ?? "—"} | ${r.status === "timeout" ? "— (hit time limit)" : r.claim ?? "—"} | ${r.falseDone ? "yes" : r.falseDone === false ? "no" : "—"} | ${r.durationMin ?? "—"} min | ${(r.lost || []).join(", ")} |`),
  ""].join("\n");
writeFileSync(join(out, `${slug}.md`), md);
console.log(md);
if (!existsSync(join(out, `${slug}.json`))) process.exitCode = 1;
