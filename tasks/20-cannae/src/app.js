// App: scene + camera + playback + HUD + the test hook (window.__cannae).
(function () {
  "use strict";
  const THREE = window.THREE, Sim = window.CannaeSim, R = Sim.RULES, { buildWorld, Soldiers, terrainHeight, PALETTE } = window.CannaeRender;
  const $ = (s) => document.querySelector(s);

  // ---------------------------------------------------------------- scene
  const canvas = $("#scene");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa9c7de);
  scene.fog = new THREE.Fog(0xb9d0de, 2600, 6200);
  scene.add(new THREE.HemisphereLight(0xfff4dd, 0x5a6a3a, 1.35));
  const sun = new THREE.DirectionalLight(0xfff0d0, 2.1);
  sun.position.set(900, 1400, 1100); sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -1500, right: 1500, top: 1500, bottom: -1500, near: 100, far: 4000 });
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0008;
  scene.add(sun);
  const { water, grad } = buildWorld(scene);
  const soldiers = Soldiers(scene, grad);
  const camera = new THREE.PerspectiveCamera(40, 1, 5, 9000);

  // ---------------------------------------------------------------- camera: orbit / pan / zoom + presets
  const cam = { target: new THREE.Vector3(0, 0, 100), dist: 2600, theta: 0.35, phi: 0.95, goal: null };
  const VIEWS = {
    Overview: { target: [0, 0, 100], dist: 2600, theta: 0.35, phi: 0.95 },
    "Hannibal's view": { target: [0, 0, -150], dist: 1150, theta: 0, phi: 1.2 },
    "The river flank": { target: [-700, 0, -150], dist: 800, theta: -0.9, phi: 1.05 },
    "Roman rear": { target: [0, 0, 250], dist: 1100, theta: Math.PI, phi: 1.1 },
    "From above": { target: [0, 0, 150], dist: 2700, theta: 0, phi: 0.12 },
  };
  function applyCamera() {
    const sp = Math.sin(cam.phi), t = cam.target;
    camera.position.set(t.x + cam.dist * sp * Math.sin(cam.theta), t.y + cam.dist * Math.cos(cam.phi), t.z + cam.dist * sp * Math.cos(cam.theta));
    camera.lookAt(t);
  }
  function goView(name) {
    const v = VIEWS[name]; if (!v) return false;
    cam.goal = { target: new THREE.Vector3(...v.target), dist: v.dist, theta: v.theta, phi: v.phi };
    document.querySelectorAll("#cams button").forEach((b) => b.setAttribute("aria-pressed", String(b.textContent === name)));
    return true;
  }
  let drag = null;
  canvas.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, pan: e.button === 2 || e.shiftKey }; canvas.setPointerCapture(e.pointerId); cam.goal = null; });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
    if (drag.pan) {
      const k = cam.dist / 900, s = Math.sin(cam.theta), c = Math.cos(cam.theta);
      cam.target.x -= (dx * c + dy * s) * k; cam.target.z -= (-dx * s + dy * c) * k;
    } else { cam.theta -= dx * 0.005; cam.phi = Math.min(1.45, Math.max(0.08, cam.phi - dy * 0.005)); }
  });
  canvas.addEventListener("pointerup", () => (drag = null));
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("wheel", (e) => { e.preventDefault(); cam.goal = null; cam.dist = Math.min(5200, Math.max(250, cam.dist * Math.exp(e.deltaY * 0.001))); }, { passive: false });
  for (const name of Object.keys(VIEWS)) {
    const b = document.createElement("button"); b.textContent = name; b.setAttribute("aria-pressed", "false"); b.onclick = () => goView(name); $("#cams").append(b);
  }

  // ---------------------------------------------------------------- playback
  const battle = window.CannaeBattle.Battle();
  let t = 0, playing = false, speed = 30;
  const SPEEDS = [10, 30, 60];
  for (const s of SPEEDS) {
    const b = document.createElement("button"); b.textContent = `${s}×`; b.setAttribute("aria-pressed", String(s === speed));
    b.onclick = () => setSpeed(s); $("#speeds").append(b);
  }
  function setSpeed(s) { speed = s; document.querySelectorAll("#speeds button").forEach((b) => b.setAttribute("aria-pressed", String(b.textContent === `${s}×`))); }
  function setPlaying(p) { playing = p && t < R.duration; $("#play").textContent = playing ? "❚❚" : "▶"; $("#play").setAttribute("aria-label", playing ? "Pause" : "Play"); }
  $("#play").onclick = () => { if (t >= R.duration) seek(0); setPlaying(!playing); };
  $("#scrub").max = R.duration;
  $("#scrub").addEventListener("input", (e) => seek(Number(e.target.value)));
  addEventListener("keydown", (e) => { if (e.code === "Space" && e.target === document.body) { e.preventDefault(); $("#play").click(); } });
  function seek(nt) { t = Math.max(0, Math.min(R.duration, nt)); battle.stepTo(t); return snapshot(); }

  // ---------------------------------------------------------------- story: captions from events
  const CAPTIONS = [
    [(e) => e.t === 0, "Dawn. 86,000 Romans face 50,000 men under Hannibal on the plain by the river Aufidus."],
    [(e) => e.type === "order" && e.id === "R-vel", "Velites and Balearic slingers trade missiles between the lines."],
    [(e) => e.type === "order" && e.id === "C-cav" && e.order === "charge", "By the river, Hasdrubal's heavy horse crashes into the Roman cavalry."],
    [(e) => e.type === "rout" && e.id === "R-cav", "The Roman horse breaks and is cut down along the Aufidus."],
    [(e) => e.type === "order" && e.id === "R-inf-1" && e.order === "advance", "The Roman infantry, packed unusually deep, marches on Hannibal's bulging crescent."],
    [(e) => e.type === "rout" && e.id === "R-acav", "Hasdrubal rides around the Roman rear; Varro's allied cavalry flees before him."],
    [(e) => e.type === "concave", "The Gauls and Spaniards give ground. The crescent bends inward — the Romans push into a pocket."],
    [(e) => e.type === "libyans-turn", "Hannibal's signal: the Libyans, silent on both flanks, turn to face inward."],
    [(e) => e.type === "split", "Squadron after squadron, Hasdrubal strikes the Roman rear. The ring is closed."],
    [(e) => e.type === "encircled", "“The circle becoming more and more contracted.” — Polybius"],
  ];
  function caption(events) {
    let text = CAPTIONS[0][1];
    for (const e of events) for (const [test, c] of CAPTIONS) if (test(e)) text = c;
    return text;
  }
  const clock = (bt) => { const m = 9 * 60 + 30 + (bt / R.duration) * 7 * 60; return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(Math.floor(m % 60)).padStart(2, "0")} · battle time ${Math.floor(bt / 60)}:${String(Math.floor(bt % 60)).padStart(2, "0")}`; };

  // ---------------------------------------------------------------- HUD
  const NAMES = [["roman", "Roman legions"], ["alliedInf", "Allied infantry"], ["romanCav", "Roman cavalry"], ["alliedCav", "Allied cavalry"], ["velites", "Velites"],
    ["gaul", "Gauls"], ["spaniard", "Spaniards"], ["libyan", "Libyans"], ["hasdrubal", "Hasdrubal's horse"], ["numidian", "Numidian horse"], ["balearic", "Balearic slingers"]];
  $("#legend").innerHTML = NAMES.map(([k, n]) => `<div><i style="background:#${PALETTE[k].toString(16).padStart(6, "0")}"></i>${n}</div>`).join("");
  const s0 = battle.state, total = (side) => s0.units.filter((u) => u.side === side).reduce((a, u) => a + u.men0, 0);
  const menR = total("R"), menC = total("C");
  $("#menR").textContent = menR.toLocaleString("en-US"); $("#menC").textContent = menC.toLocaleString("en-US");
  const LABELS = { "R-inf-2": "Roman infantry", "R-cav": "Roman cavalry (Paullus)", "R-acav": "Allied cavalry (Varro)", "C-cav": "Hasdrubal", "C-cen-8": "Gauls & Spaniards",
    "C-lib-W": "Libyans", "C-lib-E": "Libyans", "C-num": "Numidians", "C-cav-1": "Hasdrubal's squadrons" };
  const labelEls = {};
  for (const [id, text] of Object.entries(LABELS)) { const d = document.createElement("div"); d.className = "label"; d.textContent = text; document.body.append(d); labelEls[id] = d; }
  let showLabels = true;
  $("#labels").onclick = (e) => { showLabels = !showLabels; e.target.setAttribute("aria-pressed", String(showLabels)); };

  let markersDrawn = false;
  function drawMarkers() {
    if (markersDrawn || battle.computedTo < R.duration) return;
    markersDrawn = true;
    const ev = battle.allEvents().filter((e) => ["rout", "libyans-turn", "split"].includes(e.type) && !/C-cav-/.test(e.id));
    for (const e of ev) { const m = document.createElement("div"); m.className = "mark"; m.style.left = `${(e.t / R.duration) * 100}%`; m.title = `${e.type} ${e.id}`; $("#track").insertBefore(m, $("#track .knob")); }
  }

  const deadOf = (s, side) => s.units.filter((u) => u.side === side).reduce((a, u) => a + (u.men0 - u.men), 0);
  function hud(s) {
    $("#caption").textContent = caption(derivedEvents(s));
    $("#clock").textContent = clock(s.t);
    const dR = deadOf(s, "R"), dC = deadOf(s, "C");
    $("#deadR").textContent = Math.round(dR).toLocaleString("en-US"); $("#deadC").textContent = Math.round(dC).toLocaleString("en-US");
    $("#barR").style.width = `${(dR / menR) * 100}%`; $("#barC").style.width = `${(dC / menC) * 100}%`;
    const f = (s.t / R.duration) * 100;
    $("#track .fill").style.width = `${f}%`; $("#track .knob").style.left = `${f}%`; $("#track .ahead").style.width = `${(battle.computedTo / R.duration) * 100}%`;
    if (document.activeElement !== $("#scrub")) $("#scrub").value = String(Math.round(s.t));
  }
  /** Sim events plus the two story beats the renderer derives from state (crescent bends; encirclement). */
  function derivedEvents(s) {
    const out = s.events.slice(), c = s.units.filter((u) => u.id.startsWith("C-cen-"));
    const fy = (u) => u.y + Math.cos(u.h) * u.d / 2, n = c.length;
    const bent = s.flags && s.events.some((e) => e.type === "libyans-turn");
    if (bent || (n >= 4 && (fy(c[n / 2 - 1]) + fy(c[n / 2])) / 2 - (fy(c[0]) + fy(c[n - 1])) / 2 < -20)) out.push({ t: s.t, type: "concave" });
    if (s.units.some((u) => u.id.startsWith("R-inf") && u.encircled)) out.push({ t: s.t, type: "encircled" });
    return out.sort((a, b) => a.t - b.t);
  }

  const V = new THREE.Vector3();
  function placeLabels(s) {
    for (const [id, el] of Object.entries(labelEls)) {
      const u = s.byId[id];
      const show = showLabels && u && !["destroyed", "left", "split"].includes(u.status);
      el.style.display = show ? "block" : "none";
      if (!show) continue;
      V.set(u.x, terrainHeight(u.x, -u.y) + 30, -u.y).project(camera);
      if (V.z > 1) { el.style.display = "none"; continue; }
      el.style.left = `${(V.x * 0.5 + 0.5) * innerWidth}px`; el.style.top = `${(-V.y * 0.5 + 0.5) * innerHeight}px`;
      el.style.setProperty("--c", `#${(PALETTE[u.contingent] || 0xffffff).toString(16).padStart(6, "0")}`);
    }
  }

  // ---------------------------------------------------------------- loop
  let last = performance.now(), rendered = {};
  function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < 700 ? 55 : 40; camera.updateProjectionMatrix(); }
  addEventListener("resize", resize); resize();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (playing) { t = Math.min(R.duration, t + dt * speed); battle.stepTo(t); if (t >= R.duration) setPlaying(false); }
    battle.precompute(playing ? 3 : 8);
    drawMarkers();
    if (cam.goal) { const g = cam.goal, k = 1 - Math.exp(-dt * 3); cam.target.lerp(g.target, k); cam.dist += (g.dist - cam.dist) * k; cam.theta += (g.theta - cam.theta) * k; cam.phi += (g.phi - cam.phi) * k; }
    applyCamera();
    const s = battle.state;
    water.uniforms.uT.value = now / 1000;
    soldiers.update(s, now / 1000);
    rendered = { ...soldiers.counts };
    hud(s); placeLabels(s);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---------------------------------------------------------------- test hook (the task's contract)
  function snapshot() { return Sim.snapshot(battle.state); }
  window.__cannae = {
    duration: R.duration, dt: R.dt, rules: R,
    seek, state: snapshot, time: () => t,
    play: () => setPlaying(true), pause: () => setPlaying(false), playing: () => playing,
    setSpeed, speed: () => speed,
    events: () => snapshot().events,
    figures: () => ({ ...soldiers.counts, menPerFigure: soldiers.MEN_PER_FIGURE }),
    view: goView, views: () => Object.keys(VIEWS),
  };
})();
