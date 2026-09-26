// Turn each frozen grader's native output into the normalized check list:
//   [{ id, name, status: "pass"|"fail"|"skip", method: "scripted", detail }]

function crashed(proc, what) {
  return { checks: [], error: `${what} produced no parseable output (exit ${proc.code}${proc.timedOut ? ", timed out" : ""}) — see grade/grader-stderr.txt` };
}

export const NORMALIZERS = {
  // vitest --reporter=json
  vitest(raw, proc) {
    if (!raw) return crashed(proc, "vitest");
    const checks = [];
    for (const file of raw.testResults || []) {
      for (const a of file.assertionResults || []) {
        checks.push({
          id: a.fullName || a.title,
          name: a.title,
          status: a.status === "passed" ? "pass" : a.status === "failed" ? "fail" : "skip",
          method: "scripted",
          detail: (a.failureMessages || []).join("\n").split("\n").slice(0, 6).join("\n"),
        });
      }
      // A test FILE that failed to load (e.g. the candidate module is missing) has no assertions.
      if (!(file.assertionResults || []).length && file.status === "failed") {
        checks.push({ id: `load:${file.name.split(/[\\/]/).pop()}`, name: "test file loads", status: "fail", method: "scripted", detail: String(file.message || "").slice(0, 600) });
      }
    }
    return { checks };
  },

  // task 17 verify-reference.mjs: { allPass, total, passed, scenarios[{name, pass, consoleErrors, dialogFired, failedChecks}] }
  scenarios(raw, proc) {
    if (!raw || !Array.isArray(raw.scenarios)) return crashed(proc, "verify-reference.mjs");
    return {
      checks: raw.scenarios.map((s) => ({
        id: s.name.split(/[\s:—-]/)[0] || s.name,
        name: s.name,
        status: s.pass ? "pass" : "fail",
        method: "scripted",
        detail: s.pass ? "" : [
          ...(s.failedChecks || []).slice(0, 4).map((c) => `${c.step}: ${typeof c.detail === "string" ? c.detail : JSON.stringify(c.detail)}`),
          ...(s.consoleErrors || []).slice(0, 2).map((e) => `console: ${e}`),
          s.dialogFired ? "a native dialog fired" : "",
        ].filter(Boolean).join("\n").slice(0, 800),
      })),
    };
  },

  // points checklists (task 18 grade-wonders.mjs): { pointsPossible, checks[{id, group, name, points, earned, status, detail, frames?}], notes }
  points(raw, proc) {
    if (!raw || !Array.isArray(raw.checks)) return crashed(proc, "points grader");
    return {
      checks: raw.checks.map((c) => ({ id: c.id, name: c.name, group: c.group, points: c.points, earned: c.earned, status: c.status,
        method: c.method || "scripted", frames: c.frames, detail: String(c.detail ?? "").slice(0, 600) })),
      error: raw.notes?.filter((n) => /crash|error/i.test(n)).join("; ") || undefined,
      version: raw.version,
    };
  },

  // autochecks.mjs (tasks 12/13/15/16): { summary, results[{id, name?, status, detail}] }
  autochecks(raw, proc) {
    if (!raw || !Array.isArray(raw.results)) return crashed(proc, "autochecks.mjs");
    if (raw.fatal) return { checks: [], error: `autochecks fatal: ${raw.fatal}` };
    return {
      checks: raw.results.map((r) => ({
        id: r.id,
        name: r.name || r.label || r.id,
        status: r.status,
        method: "scripted",
        detail: String(r.detail ?? "").slice(0, 600),
      })),
    };
  },
};
