// Vetted Bench report — renders the scoreboard and run pages from the embedded JSON.
(function () {
  "use strict";
  const D = JSON.parse(document.getElementById("data").textContent);
  const app = document.getElementById("app");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (n) => (n == null ? "—" : n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e4 ? Math.round(n / 1e3) + "k" : n >= 1e3 ? (n / 1e3).toFixed(1) + "k" : String(n));
  const dur = (ms) => {
    if (ms == null) return "—";
    const s = Math.round(ms / 1000);
    return s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s` : `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}m`;
  };
  const day = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
  const HARNESS = { claude: "Claude Code", "claude-glm": "Claude Code → GLM", codex: "Codex CLI", pi: "pi" };

  // ================================================================ scoreboard
  function renderIndex() {
    const { board, rows, versions, dateRange } = D;
    const nFake = rows.filter((r) => r.fakeConvergence).length;
    let h = `<div class="wrap">
      <header class="mast"><div>
        <h1>Vetted Bench</h1>
        <p>${rows.length} run${rows.length === 1 ? "" : "s"} of ${board.tasks.length} frozen coding task${board.tasks.length === 1 ? "" : "s"} across ${board.arms.length} harness and model setups. Every score comes from a frozen answer key, not from the agent's own word.</p>
      </div><div class="sub">${dateRange[0] ? `${day(dateRange[0])} to ${day(dateRange[1])}` : ""}</div></header>`;

    if (!rows.length) {
      h += `<p class="empty">No runs yet. Start one with <code>node bench/cli.mjs run --task 07 --harness claude --model claude-sonnet-5 --grade</code>.</p></div>`;
      app.innerHTML = h;
      return;
    }

    h += `<div class="board-scroll"><table class="board"><thead><tr><th scope="col">Task</th>`;
    for (const a of board.arms) h += `<th scope="col"><span class="h">${esc(HARNESS[a.harness] || a.harness)}${a.profile !== "clean-room" ? ` · ${esc(a.profile)}` : ""}</span><span class="m">${esc(a.model)}</span></th>`;
    h += `</tr></thead><tbody>`;
    for (const t of board.tasks) {
      h += `<tr><th scope="row">${esc(t.title)}<small>${esc(t.slug)}${t.difficulty ? `, ${esc(t.difficulty)}` : ""}</small></th>`;
      for (const a of board.arms) {
        const c = board.cells[`${t.slug}::${a.key}`];
        if (!c) { h += `<td><span class="empty">not run</span></td>`; continue; }
        const target = c.runs.length === 1 ? `runs/${c.runs[0].id}.html` : `#runs-${encodeURIComponent(t.slug + "::" + a.key)}`;
        h += `<td><a class="cell" href="${target}"><span class="ticks">${c.runs.map(tick).join("")}</span>
          ${c.runs.some((r) => r.graded) ? `<span class="frac">${c.passedRuns}<span class="of">/${c.n}</span></span>
          <span class="sub"> fully passed</span><br>` : `<span class="sub">awaiting grade</span><br>`}
          <span class="sub">${c.medianScore != null ? Math.round(c.medianScore * 100) + (c.points ? "% of points, " : "% of checks, ") : ""}${dur(c.medianMs)}, ${num(c.medianOut)} out</span>
          ${c.fake ? `<br><span class="flag fake">${c.fake} false “done”</span>` : ""}
          ${c.judged ? `<br><span class="flag judged">AI-judged checks</span>` : ""}</a></td>`;
      }
      h += `</tr>`;
    }
    h += `</tbody><tfoot><tr><th scope="row">All tasks</th>`;
    for (const a of board.arms) {
      const t = board.totals[a.key];
      h += `<td><b>${t.passedRuns}/${t.n}</b> runs fully passed<br>${dur(t.medianMs)} median${t.fake ? `<br><span class="flag fake">${t.fake} false “done”</span>` : ""}</td>`;
    }
    h += `</tr></tfoot></table></div>
      <div class="legend">
        <span><i class="tick pass"></i> one run, every check passed</span>
        <span><i class="tick partial"></i> some checks failed</span>
        <span><i class="tick fail"></i> most checks failed or no output</span>
        <span><i class="tick"></i> not graded</span>
        <span><b class="flag fake">false “done”</b> agent said it finished, answer key disagreed</span>
      </div>`;

    h += `<section id="runs"><h2>Every run</h2><div class="filters">
      <select id="f-task" aria-label="Filter by task"><option value="">All tasks</option>${board.tasks.map((t) => `<option value="${esc(t.slug)}">${esc(t.title)}</option>`).join("")}</select>
      <select id="f-arm" aria-label="Filter by setup"><option value="">All setups</option>${board.arms.map((a) => `<option value="${esc(a.key)}">${esc((HARNESS[a.harness] || a.harness) + " / " + a.model)}</option>`).join("")}</select>
    </div><div class="runs-scroll"><table class="runs"><thead><tr>
      <th>Started</th><th>Task</th><th>Harness</th><th>Model</th><th>Result</th><th>Agent said</th><th class="num">Time</th><th class="num">Output tokens</th><th class="num">Peak context</th><th class="num">Tool calls</th>
    </tr></thead><tbody id="runs-body"></tbody></table></div></section>`;
    h += `<footer><p>Cost: every run used a flat-rate subscription. Dollar figures, where a harness reports one, are API-list-price estimates, not money spent. Token counts are as reported by each harness; blank means the harness did not report it.</p>
      <p>Harness versions: ${versions.map(esc).join("; ")}.</p></footer></div>`;
    app.innerHTML = h;

    const fTask = document.getElementById("f-task"), fArm = document.getElementById("f-arm");
    const draw = () => {
      const armOf = (r) => `${r.harness}|${r.model}|${r.profile}`;
      const list = rows.filter((r) => (!fTask.value || r.task === fTask.value) && (!fArm.value || armOf(r) === fArm.value)).slice().reverse();
      document.getElementById("runs-body").innerHTML = list.map((r) => {
        const tools = Object.values(r.toolCalls || {}).reduce((a, b) => a + b, 0);
        return `<tr><td><a href="runs/${esc(r.id)}.html">${day(r.startedAt)}</a></td><td>${esc(r.task)}</td><td>${esc(HARNESS[r.harness] || r.harness)}</td><td>${esc(r.model)}</td>
          <td>${resultPill(r)}${r.contamination ? ` <span class="flag contam" title="unscored: web / network use or a benchmark reference in the transcript">contamination</span>` : ""}</td><td>${esc(r.claim || "—")}${r.fakeConvergence ? ` <span class="flag fake">false</span>` : ""}</td>
          <td class="num">${dur(r.durationMs)}</td><td class="num">${num(r.outputTokens)}</td><td class="num">${num(r.peakContextTokens)}</td><td class="num">${tools || "—"}</td></tr>`;
      }).join("") || `<tr><td colspan="10" class="empty">No runs match these filters.</td></tr>`;
    };
    fTask.onchange = fArm.onchange = draw;
    const hash = decodeURIComponent(location.hash.replace(/^#runs-/, ""));
    if (hash.includes("::")) { const [t, k] = hash.split("::"); fTask.value = t; fArm.value = k; }
    draw();
    if (hash.includes("::")) document.getElementById("runs").scrollIntoView();
  }

  function tick(r) {
    let cls = "";
    if (r.graded && r.score != null) cls = r.score >= 0.9 ? "pass" : r.score >= 0.5 ? "partial" : "fail";
    else if (r.graded) cls = r.allPass ? "pass" : r.total && r.passed / r.total >= 0.5 ? "partial" : "fail";
    else if (r.status && r.status !== "ok") cls = "fail";
    return `<i class="tick ${cls}" title="${esc(r.id)}: ${r.graded ? (r.score != null ? `${r.pointsEarned}/${r.pointsPossible} pts` : `${r.passed}/${r.total}`) : esc(r.status)}"></i>`;
  }
  function resultPill(r) {
    if (!r.graded) return `<span class="pill muted">${esc(r.status === "ok" ? "ungraded" : r.status)}</span>`;
    if (r.score != null) return `<span class="pill ${r.score >= 0.9 ? "pass" : "fail"}">${r.pointsEarned}/${r.pointsPossible} pts</span>`;
    return `<span class="pill ${r.allPass ? "pass" : "fail"}">${r.passed}/${r.total}</span>${r.unresolved ? ` <span class="sub">(${r.unresolved} unresolved)</span>` : ""}`;
  }

  // ================================================================ run page
  function renderRun() {
    const { meta, result, steps, outputs, shots, task, prompt, viewOnly } = D;
    const x = meta.metrics || {};
    const tools = Object.entries(x.toolCalls || {}).map(([k, v]) => `${k} ${v}`).join(", ");
    let verdict;
    if (!result) verdict = `<div class="verdict none"><span class="score">${viewOnly ? "Transcript" : "Not graded"}</span>${meta.status && meta.status !== "ok" ? `<span class="said">run status: ${esc(meta.status)}${meta.errorDetail ? ` (${esc(meta.errorDetail)})` : ""}</span>` : ""}</div>`;
    else {
      const said = result.claim ? { claimed: "The agent said it was done.", hedged: "The agent delivered with caveats.", blocked: "The agent said it could not finish." }[result.claim.label] : "";
      const pts = result.pointsPossible != null;
      verdict = `<div class="verdict ${(pts ? result.score >= 0.9 : result.allPass) ? "pass" : "fail"}"><span class="score">${pts ? `${result.pointsEarned}/${result.pointsPossible} points (${Math.round(result.score * 100)}%)` : `${result.passed}/${result.total} checks passed`}</span>
        ${pts && result.groups ? `<span class="said">${Object.entries(result.groups).map(([g, v]) => `${esc(g)} ${v.earned}/${v.possible}`).join(" · ")}</span>` : ""}
        <span class="said ${result.fakeConvergence ? "fake" : ""}">${esc(said)}${result.fakeConvergence ? " The answer key disagrees: this is a false “done”." : ""}${result.unresolved ? ` ${result.unresolved} check(s) unresolved.` : ""}</span></div>`;
    }
    let h = `<div class="wrap">
      ${viewOnly ? "" : `<a class="crumb" href="../index.html">← Scoreboard</a>`}
      <header class="runhead"><h1>${esc(task ? task.title : D.source || meta.runId)}</h1>
        <p class="arm">${esc(HARNESS[meta.harness] || meta.harness)} running <b>${esc(meta.model)}</b>${meta.profile ? `, ${esc(meta.profile.name)} profile` : ""}${meta.attempt ? `, attempt ${meta.attempt} of ${meta.of}` : ""}${meta.modelReported && meta.modelReported !== meta.model ? ` (harness reported ${esc(meta.modelReported)})` : ""}</p>
        ${verdict}</header>
      <div class="stats">
        ${stat(dur(x.durationMs), "wall-clock time")}
        ${stat(num(x.outputTokens), "output tokens")}
        ${stat(num(x.peakContextTokens), "peak context")}
        ${stat(x.numTurns ?? "—", "model turns")}
        ${stat(Object.values(x.toolCalls || {}).reduce((a, b) => a + b, 0) || "—", `tool calls${x.toolErrors ? `, ${x.toolErrors} errored` : ""}`)}
        ${stat(x.costUsdEstimate != null ? "$" + x.costUsdEstimate.toFixed(2) : "—", "list-price estimate")}
      </div>
      <section class="gauge" aria-label="Context window over the run" id="gauge"></section>
      <div class="cols"><main>
        <div class="tl-tools"><strong>What the agent did</strong>
          <label><input type="checkbox" id="t-think"> show thinking</label>
          <label><input type="checkbox" id="t-sys"> show system events</label>
          <button type="button" id="t-open">Expand all</button></div>
        <ol class="tl" id="tl"></ol>
      </main><aside class="side">`;

    if (result) {
      const sorted = result.checks.slice().sort((a, b) => rank(a.status) - rank(b.status));
      h += `<section class="panel"><h3>Answer-key checks</h3>
        ${result.notes?.length ? result.notes.map((n) => `<p class="sub">${esc(n)}</p>`).join("") : ""}
        <ul class="checks">${sorted.map((c) => `<li class="${esc(c.status)}"><span class="mark">${c.status === "pass" ? "pass" : c.status === "fail" ? "fail" : "?"}</span>${typeof c.points === "number" ? `<b>${c.earned ?? 0}/${c.points}</b> ` : ""}${esc(c.name)}${c.flaky ? `<span class="by">flaky: ${esc(c.flaky.join("/"))}</span>` : ""}${c.method === "judged" || c.method === "judge-checklist" ? `<span class="by">AI judge</span>` : c.method === "judge-text" ? `<span class="by">AI judge (text)</span>` : c.method === "resolver" || c.method === "bench-probe" ? `<span class="by">bench probe${c.frozenStatus ? `, frozen said ${esc(c.frozenStatus)}` : ""}</span>` : c.method === "bench-check" ? `<span class="by">added check</span>` : ""}
          ${c.detail ? `<details><summary>detail</summary><pre>${esc(c.detail)}</pre></details>` : ""}</li>`).join("")}</ul>
        ${result.judge ? `<p class="sub">Judge: ${esc(result.judge.model)}, blind to which model built this.</p>` : ""}
        ${result.judgeText ? `<p class="sub">Text judge: ${esc(result.judgeText.model)} read only ${esc(result.judgeText.file)} as the run left it (${result.judgeText.snapshot === "present" ? `${num(result.judgeText.textChars)} characters` : "file missing: every answer is no"}), ${result.judgeText.votes} votes per question.</p>` : ""}</section>`;
    }
    const cz = meta.contamination;
    if (cz && cz.scanner) {
      const kinds = { "web-tool": "web tool", "network-command": "network command", "benchmark-reference": "benchmark reference" };
      h += `<section class="panel"><h3>Contamination check <span class="sub">(not scored)</span></h3>
        <p class="sub">${cz.flagged ? `<span class="flag contam">${cz.flags.length} flag${cz.flags.length === 1 ? "" : "s"}</span> ${Object.entries(cz.counts).map(([k, v]) => `${v} ${esc(kinds[k] || k)}`).join(", ")}` : "No web tools, network commands or references to this benchmark in the transcript."}
        ${cz.loopbackRequests ? ` ${cz.loopbackRequests} request(s) to localhost not counted.` : ""}
        Web tools offered: ${meta.webToolsAvailable === true ? "yes" : meta.webToolsAvailable === false ? "no" : esc(meta.webToolsAvailable ?? "unknown")}${Array.isArray(cz.webToolsInInit) ? ` (harness listed: ${esc(cz.webToolsInInit.join(", ") || "none")})` : ""}.</p>
        ${cz.flagged ? `<ul class="checks">${cz.flags.slice(0, 40).map((f) => `<li class="unclear"><span class="mark">${esc(kinds[f.kind] || f.kind)}</span>${esc(f.category)} · step ${f.step}${f.tool ? ` · ${esc(f.tool)}` : ""}<details><summary>${esc(f.match)}</summary><pre>${esc(f.excerpt)}</pre></details></li>`).join("")}</ul>` : ""}</section>`;
    }
    if (outputs?.length) {
      h += `<section class="panel"><h3>What it produced</h3>${outputs.map((o, i) => `<div class="outfile"><div class="row"><code>${esc(o.rel)}</code><span class="sub">${(o.size / 1024).toFixed(1)} KB</span></div>
        ${(meta.artifacts || []).filter((a) => a.path === o.rel && a.source && a.source !== "file").map((a) => `<p class="sub">collected from: ${esc(a.source)}</p>`).join("")}
        <div class="row" style="margin-top:6px">${o.isHtml ? `<button type="button" data-preview="${i}">Run it here</button><a href="${esc(meta.runId)}/output/${esc(o.rel)}" target="_blank" rel="noopener">Open full page</a>` : ""}${o.text != null ? `<button type="button" data-code="${i}">Show code</button>` : ""}</div>
        <div id="out-${i}"></div></div>`).join("")}</section>`;
    }
    if (shots?.length) h += `<section class="panel"><h3>Grader screenshots</h3><div class="shots">${shots.map((s) => `<a href="${esc(meta.runId)}/grade/${esc(s)}" target="_blank" rel="noopener"><img src="${esc(meta.runId)}/grade/${esc(s)}" alt="${esc(s.replace(/\.png$/, "").replace(/-/g, " "))}" loading="lazy"></a>`).join("")}</div></section>`;
    h += `<section class="panel"><h3>Run details</h3><dl class="kv">
      ${kv("run", meta.runId)}${kv("status", meta.status)}${kv("harness", meta.harnessVersion)}${kv("parser", meta.parserVersion)}
      ${meta.init ? kv("setup", `${meta.init.tools ?? "?"} tools, ${meta.init.skills ?? 0} skills, ${meta.init.mcp ?? 0} MCP servers, plugins: ${(meta.init.plugins || []).join(", ") || "none"}`) : ""}
      ${kv("input tokens", num(x.inputTokens))}${kv("cache read", num(x.cacheReadTokens))}${kv("cache write", num(x.cacheCreationTokens))}${kv("reasoning", num(x.reasoningTokens))}
      ${meta.workspacePrep ? kv("workspace", `prepared copy: ${num(meta.workspacePrep.files)} files, ${(meta.workspacePrep.bytes / 1e6).toFixed(1)} MB in ${dur(meta.workspacePrep.copyMs)}`) : ""}
      ${meta.artifactSize ? kv("collected", `${num(meta.artifactSize.files)} files, ${(meta.artifactSize.bytes / 1024).toFixed(1)} KB${meta.artifactSize.exclude ? ` (excluding ${meta.artifactSize.exclude.join(", ")})` : ""}`) : ""}
      ${meta.command ? kv("command", meta.command.join(" ")) : ""}${meta.promptSha256 ? kv("prompt sha256", meta.promptSha256.slice(0, 16) + "…") : ""}
      </dl>${prompt ? `<details style="margin-top:8px"><summary>Prompt given to the agent</summary><pre>${esc(prompt)}</pre></details>` : ""}</section>`;
    h += `</aside></div></div>`;
    app.innerHTML = h;

    drawTimeline(steps);
    drawGauge(steps);
    app.querySelectorAll("[data-preview]").forEach((b) => (b.onclick = () => {
      const o = outputs[+b.dataset.preview];
      document.getElementById("out-" + b.dataset.preview).innerHTML = `<iframe class="preview" sandbox="allow-scripts" src="${esc(meta.runId)}/output/${esc(o.rel)}" title="Preview of ${esc(o.rel)}"></iframe>`;
    }));
    app.querySelectorAll("[data-code]").forEach((b) => (b.onclick = () => {
      const o = outputs[+b.dataset.code];
      const box = document.getElementById("out-" + b.dataset.code);
      box.innerHTML = box.innerHTML ? "" : `<pre class="mono" style="max-height:360px;overflow:auto;white-space:pre">${esc(o.text)}</pre>`;
    }));
  }

  const rank = (s) => ({ fail: 0, unclear: 1, skip: 1, pass: 2 }[s] ?? 1);
  const stat = (v, l) => `<div class="stat"><b>${esc(v)}</b><span>${esc(l)}</span></div>`;
  const kv = (k, v) => (v == null || v === "" ? "" : `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`);
  const KIND = { user: "prompt", "assistant-text": "said", thinking: "thinking", "tool-call": "tool", "tool-result": "result", system: "system", final: "finished" };

  function drawTimeline(steps) {
    const tl = document.getElementById("tl");
    tl.innerHTML = steps.map((s) => {
      const d = s.contextDelta;
      const deltaCls = d > 5000 ? "hot" : d > 1000 ? "warm" : "";
      const delta = typeof d === "number" && d > 0 ? `<span class="delta ${deltaCls}" title="context grew by ${d} tokens">+${num(d)}${d > 5000 ? " 🔥" : ""}</span>` : `<span class="delta"></span>`;
      const hide = s.kind === "thinking" ? "k-hide-think hidden-kind" : s.kind === "system" && !s.isError ? "k-hide-sys hidden-kind" : "";
      const label = s.kind === "tool-call" || s.kind === "tool-result" ? `${KIND[s.kind]} · ${s.tool || ""}` : KIND[s.kind] || s.kind;
      const trunc = s.truncated ? `<p class="sub">Showing the first ${num(s.body.length)} of ${num(s.truncated)} characters.</p>` : "";
      const cls = `st k-${s.kind} ${s.isError ? "err" : ""} ${s.subagent ? "sub" : ""} ${hide}`;
      if (s.kind === "assistant-text") {
        // What the agent said is the story: show it in full, inline, no expander.
        return `<li class="${cls}" id="s${s.i}"><details open><summary><span class="kind">${esc(label)}</span><span class="sum prose">${esc(s.body || s.summary)}</span>${delta}</summary>${trunc}</details></li>`;
      }
      const body = s.body && s.body !== s.summary ? `<pre>${esc(s.body)}</pre>` : "";
      return `<li class="${cls}" id="s${s.i}">
        <details ${s.kind === "final" ? "open" : ""}><summary><span class="kind">${esc(label)}</span><span class="sum">${esc(s.summary)}</span>${delta}</summary>${body}${trunc}</details></li>`;
    }).join("");
    const tog = (id, cls) => (document.getElementById(id).onchange = (e) => tl.querySelectorAll("." + cls).forEach((n) => n.classList.toggle("hidden-kind", !e.target.checked)));
    tog("t-think", "k-hide-think"); tog("t-sys", "k-hide-sys");
    const btn = document.getElementById("t-open");
    btn.onclick = () => {
      const open = btn.textContent === "Expand all";
      tl.querySelectorAll("details").forEach((d) => (d.open = open));
      btn.textContent = open ? "Collapse all" : "Expand all";
    };
  }

  function jumpTo(i) {
    const el = document.getElementById("s" + i);
    if (!el) return;
    el.classList.remove("hidden-kind");
    el.querySelector("details").open = true;
    el.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
  }

  // The gauge: how full the context window got, step by step. Click to jump to that step.
  function drawGauge(steps) {
    const g = document.getElementById("gauge");
    const pts = steps.filter((s) => typeof s.contextTokens === "number");
    const peak = pts.length ? Math.max(...pts.map((s) => s.contextTokens)) : null;
    const hot = steps.filter((s) => s.contextDelta > 5000).length;
    g.innerHTML = `<header><span><strong>Context window</strong> over ${steps.length} steps</span><span>${peak != null ? `peak ${num(peak)} tokens${hot ? `, ${hot} jump${hot === 1 ? "" : "s"} over 5k` : ""}` : ""}</span></header>`;
    if (pts.length < 2) {
      g.innerHTML += `<div class="nodata">This harness did not report per-step context size, so there is nothing to plot. Totals are in the run details.</div>`;
      return;
    }
    const W = 1000, H = 150, padL = 4, padB = 18, n = steps.length - 1 || 1;
    const top = niceMax(peak);
    const X = (i) => padL + (i / n) * (W - padL - 6);
    const Y = (v) => (H - padB) - (v / top) * (H - padB - 8);
    // step-hold line: context only changes at model calls
    let d = `M${X(pts[0].i)},${Y(pts[0].contextTokens)}`;
    for (let k = 1; k < pts.length; k++) d += ` H${X(pts[k].i)} V${Y(pts[k].contextTokens)}`;
    d += ` H${X(n)}`;
    const area = `${d} V${H - padB} H${X(pts[0].i)} Z`;
    const grid = [0, 0.5, 1].map((f) => `<line class="grid" x1="${padL}" x2="${W - 6}" y1="${Y(top * f)}" y2="${Y(top * f)}"/>`).join("");
    // Axis labels live in HTML (the SVG stretches non-uniformly, which would distort text).
    const labels = [1, 0.5, 0].map((f) => `<span style="top:${(Y(top * f) / H) * 100}%">${num(Math.round(top * f))}</span>`).join("");
    const marks = steps.filter((s) => s.kind === "tool-call" || (s.kind === "tool-result" && s.isError))
      .map((s) => `<line class="toolmark ${s.isError ? "err" : ""}" x1="${X(s.i)}" x2="${X(s.i)}" y1="${H - padB + 3}" y2="${H - 3}"/>`).join("");
    const hots = steps.filter((s) => s.contextDelta > 5000).map((s) => `<line class="hotmark" x1="${X(s.i)}" x2="${X(s.i)}" y1="${Y(s.contextTokens)}" y2="${Y(s.contextTokens - s.contextDelta)}"><title>+${s.contextDelta} tokens at step ${s.i}</title></line>`).join("");
    g.insertAdjacentHTML("beforeend", `<div class="plot"><div class="ylab">${labels}</div><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Context tokens by step, peaking at ${peak}">
      ${grid}<path class="area" d="${area}"/><path class="line" d="${d}"/>${marks}${hots}<line class="cursor" id="g-cur" y1="0" y2="${H - padB}" x1="-10" x2="-10"/></svg></div>
      <div class="sub" id="g-read">Hover to read a step, click to jump to it. Ticks along the bottom are tool calls; red ones errored.</div>`);
    const svg = g.querySelector("svg"), cur = g.querySelector("#g-cur"), read = g.querySelector("#g-read");
    const stepAt = (ev) => {
      const r = svg.getBoundingClientRect();
      const fx = ((ev.clientX - r.left) / r.width) * W;
      return Math.max(0, Math.min(n, Math.round(((fx - padL) / (W - padL - 6)) * n)));
    };
    const ctxAt = (i) => { let c = null; for (const p of pts) { if (p.i <= i) c = p.contextTokens; else break; } return c; };
    svg.onmousemove = (ev) => {
      const i = stepAt(ev); const s = steps[i];
      cur.setAttribute("x1", X(i)); cur.setAttribute("x2", X(i));
      read.textContent = `Step ${i}: ${KIND[s.kind] || s.kind}${s.tool ? " " + s.tool : ""}, context ${num(ctxAt(i))} tokens. ${s.summary.slice(0, 90)}`;
    };
    svg.onclick = (ev) => jumpTo(stepAt(ev));
  }

  function niceMax(v) {
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
    return 10 * p;
  }

  if (app.dataset.page === "index") renderIndex(); else renderRun();
})();
