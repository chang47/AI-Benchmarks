// Wonders of the Universe — one continuous WebGL world behind the page.
// Scroll position picks a "stage" (a procedural scene); at the end of each chapter the next stage
// dissolves in through a noise mask, so scenes bleed into each other instead of stacking.
(() => {
  "use strict";
  const THREE = window.THREE, G = window.WONDER_GLSL, A = THREE.addons;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(pointer: fine)").matches;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

  // ---------------------------------------------------------------- renderer
  const canvas = $("#world");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // the GRADE pass does tone mapping + gamma itself
  const scale = () => Math.min(devicePixelRatio || 1, 1.5) * (innerWidth < 700 ? 0.6 : 0.75);
  const size = new THREE.Vector2();
  const rtOpts = { type: THREE.HalfFloatType, depthBuffer: true };
  const rtA = new THREE.WebGLRenderTarget(4, 4, rtOpts), rtB = new THREE.WebGLRenderTarget(4, 4, rtOpts);
  const quad = new THREE.PlaneGeometry(2, 2), ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mouse = { x: 0, y: 0, sx: 0, sy: 0, px: innerWidth / 2, py: innerHeight / 2 };

  function fullscreen(frag, extra = {}) {
    const mat = new THREE.ShaderMaterial({
      vertexShader: G.VERT, fragmentShader: frag, depthTest: false, depthWrite: false,
      uniforms: { uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 }, uP: { value: 0 }, uMouse: { value: new THREE.Vector2() }, ...extra },
    });
    const scene = new THREE.Scene(); scene.add(new THREE.Mesh(quad, mat));
    return {
      mat,
      render(rt, t, p) {
        const u = mat.uniforms; u.uRes.value.set(rt.width, rt.height); u.uTime.value = t; u.uP.value = p; u.uMouse.value.set(mouse.sx, mouse.sy);
        renderer.setRenderTarget(rt); renderer.render(scene, ortho);
      },
    };
  }

  // ---------------------------------------------------------------- galaxy: ~140k GPU-animated particles
  function galaxyStage(far) {
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
    const N = innerWidth < 700 ? 60000 : 140000;
    const aR = new Float32Array(N), aAng = new Float32Array(N), aY = new Float32Array(N), aSeed = new Float32Array(N), aColor = new Float32Array(N * 3);
    const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2832 * v); };
    for (let i = 0; i < N; i++) {
      const bulge = Math.random() < 0.18;
      let r, ang, y, c;
      if (bulge) {
        r = Math.abs(gauss()) * 0.16; ang = Math.random() * 6.2832; y = gauss() * 0.05 * (1 - r * 2);
        c = [1.0, 0.72, 0.42];
      } else {
        r = 0.08 + Math.pow(Math.random(), 0.75) * 1.25;
        const arm = i % 2;
        ang = arm * Math.PI + Math.log(r + 0.05) * 2.3 + gauss() * (0.1 + 0.18 * (1 - r / 1.35));
        y = gauss() * 0.018 * (1 + r);
        const knot = Math.random() < 0.05;
        c = knot ? [1.3, 0.35, 0.75] : Math.random() < 0.7 ? [0.55, 0.72, 1.25] : [1.0, 0.9, 0.95];
        const fade = 1 - r / 1.6; c = c.map((v) => v * (0.5 + fade * 0.7));
      }
      const b = bulge ? 0.24 : 0.11;
      aR[i] = r; aAng[i] = ang; aY[i] = y; aSeed[i] = Math.random();
      aColor[i * 3] = c[0] * b; aColor[i * 3 + 1] = c[1] * b; aColor[i * 3 + 2] = c[2] * b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    for (const [k, v, n] of [["aR", aR, 1], ["aAng", aAng, 1], ["aY", aY, 1], ["aSeed", aSeed, 1], ["aColor", aColor, 3]]) geo.setAttribute(k, new THREE.BufferAttribute(v, n));
    const mat = new THREE.ShaderMaterial({
      vertexShader: G.GALAXY_VERT, fragmentShader: G.GALAXY_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uSize: { value: 10 } },
    });
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.rotation.x = 0.35; scene.add(pts);
    // background stars
    const S = 4000, sp = new Float32Array(S * 3);
    for (let i = 0; i < S; i++) { const v = new THREE.Vector3(gauss(), gauss(), gauss()).normalize().multiplyScalar(20 + Math.random() * 20); sp.set([v.x, v.y, v.z], i * 3); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0x9aa6d8, size: 1.3, sizeAttenuation: false, transparent: true, opacity: 0.8, depthWrite: false })));
    return {
      render(rt, t, p) {
        cam.aspect = rt.width / rt.height; cam.updateProjectionMatrix();
        const d = far ? 4.6 - p * 0.6 : 4.1 - p * 2.0;          // the hero slowly falls toward the galaxy as you scroll
        const tilt = far ? 1.0 : 0.95 - p * 0.45;
        cam.position.set(Math.sin(t * 0.03) * 0.3 + mouse.sx * 0.25, Math.sin(tilt) * d + mouse.sy * 0.15, Math.cos(tilt) * d);
        cam.lookAt(0, 0, 0);
        mat.uniforms.uTime.value = t; mat.uniforms.uSize.value = 11 * renderer.getPixelRatio() * (rt.height / 700);
        renderer.setRenderTarget(rt); renderer.setClearColor(0x010208, 1); renderer.clear(); renderer.render(scene, cam);
      },
    };
  }

  const STAGES = {
    galaxy: galaxyStage(false), galaxyFar: galaxyStage(true),
    meteors: fullscreen(G.SKY), volcano: fullscreen(G.VOLCANO), waterfall: fullscreen(G.FALLS),
    aurora: fullscreen(G.AURORA), ocean: fullscreen(G.OCEAN),
  };
  // which stage sits behind each chapter (contract ids for playing(): galaxy, meteors, waterfall, ocean)
  const CHAPTERS = [["hero", "galaxy"], ["meteors", "meteors"], ["volcano", "volcano"], ["waterfall", "waterfall"],
    ["wonders", "aurora"], ["ocean", "ocean"], ["voices", "galaxyFar"], ["join", "galaxyFar"]].map(([id, stage]) => ({ id, stage, el: $(`[data-section="${id}"]`) }));
  const CONTRACT_ID = { galaxy: "galaxy", galaxyFar: "galaxy", meteors: "meteors", waterfall: "waterfall", ocean: "ocean" };

  // ---------------------------------------------------------------- composite + post
  const mixMat = new THREE.ShaderMaterial({ vertexShader: G.VERT, fragmentShader: G.MIX, depthTest: false, depthWrite: false,
    uniforms: { tA: { value: rtA.texture }, tB: { value: rtB.texture }, uMix: { value: 0 }, uTime: { value: 0 } } });
  const mixScene = new THREE.Scene(); mixScene.add(new THREE.Mesh(quad, mixMat));
  const composer = new A.EffectComposer(renderer);
  composer.addPass(new A.RenderPass(mixScene, ortho));
  const bloom = new A.UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.55, 0.82);
  composer.addPass(bloom);
  const grade = new A.ShaderPass(new THREE.ShaderMaterial({ vertexShader: G.VERT, fragmentShader: G.GRADE,
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2() } } }));
  composer.addPass(grade);

  function resize() {
    renderer.setPixelRatio(scale());
    renderer.setSize(innerWidth, innerHeight, false);
    renderer.getDrawingBufferSize(size);
    rtA.setSize(size.x, size.y); rtB.setSize(size.x, size.y);
    composer.setPixelRatio(1); composer.setSize(size.x, size.y);
    grade.uniforms.uRes.value.copy(size);
  }

  // ---------------------------------------------------------------- scroll story
  const progress = { volcano: 0, wonders: 0 };
  const playing = new Set();
  const sectionProgress = (el) => clamp(-el.getBoundingClientRect().top / Math.max(1, el.offsetHeight - innerHeight));
  function story() {
    const mid = innerHeight * 0.5;
    let i = CHAPTERS.findIndex((c) => { const r = c.el.getBoundingClientRect(); return r.top <= mid && r.bottom > mid; });
    if (i < 0) i = CHAPTERS[0].el.getBoundingClientRect().top > mid ? 0 : CHAPTERS.length - 1;
    const r = CHAPTERS[i].el.getBoundingClientRect();
    const local = clamp((mid - r.top) / r.height);
    const next = CHAPTERS[Math.min(i + 1, CHAPTERS.length - 1)];
    const blend = next.stage !== CHAPTERS[i].stage ? smooth(0.72, 1, local) : 0;
    return { cur: CHAPTERS[i], next, local, blend };
  }
  function stageP(ch, local) {
    if (ch.id === "volcano") return reduce ? 0.6 : progress.volcano;
    return local;
  }

  // ---------------------------------------------------------------- wonders strip: short pin + drag
  const track = $("#track"), wonders = $('[data-section="wonders"]');
  let drag = 0, dragging = false, dragX = 0;
  const maxShift = () => Math.max(0, track.scrollWidth - innerWidth);
  function placeTrack() {
    const base = reduce ? 0 : progress.wonders * maxShift();
    const x = clamp(base + drag, 0, maxShift());
    track.style.transform = `translate3d(${-x}px,0,0)`;
  }
  track.addEventListener("pointerdown", (e) => { dragging = true; dragX = e.clientX; track.setPointerCapture(e.pointerId); });
  track.addEventListener("pointermove", (e) => { if (!dragging) return; drag -= e.clientX - dragX; dragX = e.clientX; placeTrack(); });
  const endDrag = () => { dragging = false; };
  track.addEventListener("pointerup", endDrag); track.addEventListener("pointercancel", endDrag);

  // ---------------------------------------------------------------- waterfall DOM parallax (firefly layers over the shader forest)
  const depthLayers = $$("[data-depth]");
  depthLayers.forEach((el, k) => {
    Object.assign(el.style, { position: "absolute", inset: "0", pointerEvents: "none", zIndex: "1",
      background: Array.from({ length: 14 }, (_, j) => { const x = (j * 37 + k * 13) % 100, y = (j * 53 + k * 29) % 100, s = 2 + k * 1.5;
        return `radial-gradient(${s}px ${s}px at ${x}% ${y}%, rgba(255,240,170,${0.8 - k * 0.2}), transparent)`; }).join(",") });
  });
  const falls = $('[data-section="waterfall"]');

  function onScroll() {
    progress.volcano = reduce ? 0 : sectionProgress(CHAPTERS[2].el);
    progress.wonders = reduce ? 0 : sectionProgress(wonders);
    placeTrack();
    if (!reduce) { const off = -falls.getBoundingClientRect().top; depthLayers.forEach((el) => (el.style.transform = `translate3d(0,${off * Number(el.dataset.depth)}px,0)`)); }
    if (reduce) render(2.0);
  }

  // ---------------------------------------------------------------- render loop
  let t0 = performance.now();
  function render(t) {
    const s = story();
    const a = STAGES[s.cur.stage], b = STAGES[s.next.stage];
    playing.clear();
    a.render(rtA, t, stageP(s.cur, s.local));
    if (!reduce) playing.add(CONTRACT_ID[s.cur.stage]);
    if (s.blend > 0.001) {
      b.render(rtB, t, stageP(s.next, 0));
      if (!reduce) playing.add(CONTRACT_ID[s.next.stage]);
    }
    mixMat.uniforms.uMix.value = reduce ? (s.blend > 0.5 ? 1 : 0) : s.blend;
    grade.uniforms.uTime.value = t;
    renderer.setRenderTarget(null);
    composer.render();
  }
  function loop(now) {
    mouse.sx += (mouse.x - mouse.sx) * 0.05; mouse.sy += (mouse.y - mouse.sy) * 0.05;
    render((now - t0) / 1000);
    requestAnimationFrame(loop);
  }

  // ---------------------------------------------------------------- wonder cards: baked once from the CARDS shader
  function bakeCards() {
    const W = 1120, H = 600, rt = new THREE.WebGLRenderTarget(W, H), buf = new Uint8Array(W * H * 4);
    const card = fullscreen(G.CARDS, { uKind: { value: 0 } });
    for (const c of $$("canvas[data-art]")) {
      card.mat.uniforms.uKind.value = Number(c.dataset.art);
      card.render(rt, 3.7, 0);
      renderer.readRenderTargetPixels(rt, 0, 0, W, H, buf);
      c.width = W; c.height = H;
      const img = c.getContext("2d").createImageData(W, H);
      for (let y = 0; y < H; y++) img.data.set(buf.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4); // flip Y
      c.getContext("2d").putImageData(img, 0, 0);
    }
    rt.dispose(); renderer.setRenderTarget(null);
  }

  // ---------------------------------------------------------------- page UI
  const reveal = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && e.target.classList.add("in")), { threshold: 0.15 });
  $$("[data-anim]").forEach((el) => (reduce ? el.classList.add("in") : reveal.observe(el)));

  const counter = $("[data-counter]"), TARGET = 2e12;
  new IntersectionObserver(([e], obs) => {
    if (!e.isIntersecting) return; obs.disconnect();
    if (reduce) { counter.textContent = TARGET.toLocaleString("en-US"); return; }
    const s = performance.now();
    const step = (now) => { const k = clamp((now - s) / 2400); counter.textContent = Math.round(TARGET * (1 - (1 - k) ** 4)).toLocaleString("en-US"); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }, { threshold: 0.4 }).observe(counter);

  const slides = $$("[data-slide]"); let cur = 0, hover = false;
  const show = (i) => { cur = (i + slides.length) % slides.length; slides.forEach((s, k) => s.setAttribute("aria-hidden", String(k !== cur))); };
  $("[data-next]").addEventListener("click", () => show(cur + 1));
  $("[data-prev]").addEventListener("click", () => show(cur - 1));
  const car = $("[data-carousel]");
  for (const [ev, v] of [["mouseenter", true], ["mouseleave", false], ["focusin", true], ["focusout", false]]) car.addEventListener(ev, () => (hover = v));
  setInterval(() => { if (!hover) show(cur + 1); }, 5000);

  const form = $("[data-form]"), msg = $("[data-form-message]"), email = $("#email");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = email.value.trim();
    const [state, text] = !v ? ["error", "Please enter your email."] : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? ["error", "That email doesn't look right."]
      : ["success", "Welcome aboard. Your first wonder letter is on its way."];
    msg.dataset.state = state; msg.textContent = text; email.setAttribute("aria-invalid", String(state === "error"));
  });

  const nav = $(".nav"), menuBtn = $("[data-menu-button]");
  menuBtn.addEventListener("click", () => { const open = !nav.classList.contains("open"); nav.classList.toggle("open", open); menuBtn.setAttribute("aria-expanded", String(open)); });
  $$(".nav ul a").forEach((a) => a.addEventListener("click", () => { nav.classList.remove("open"); menuBtn.setAttribute("aria-expanded", "false"); }));

  // ---------------------------------------------------------------- magical cursor: glow + stardust + context labels
  const cursorOn = finePointer && !reduce;
  const cur$ = $("[data-cursor]"), label = $(".label", cur$), trail = $("[data-cursor-trail]"), dust = [];
  const dot = { x: mouse.px, y: mouse.py };
  addEventListener("mousemove", (e) => {
    mouse.px = e.clientX; mouse.py = e.clientY; mouse.x = e.clientX / innerWidth * 2 - 1; mouse.y = -(e.clientY / innerHeight * 2 - 1);
    if (cursorOn) for (let i = 0; i < 3; i++) dust.push({ x: e.clientX, y: e.clientY, vx: (Math.random() - 0.5) * 50, vy: (Math.random() - 0.3) * 50, life: 0, max: 0.5 + Math.random() * 0.7, hue: 20 + Math.random() * 260 });
  });
  if (cursorOn) {
    document.body.classList.add("has-cursor");
    document.addEventListener("mouseover", (e) => {
      const lab = e.target.closest("[data-cursor-label]"), hot = e.target.closest("a, button, input");
      cur$.classList.toggle("labelled", !!lab); label.textContent = lab ? lab.dataset.cursorLabel : "";
      cur$.classList.toggle("hover", !!hot && !lab);
    });
    const ctx = trail.getContext("2d"); let lt = performance.now();
    const fitTrail = () => { trail.width = innerWidth; trail.height = innerHeight; };
    fitTrail(); addEventListener("resize", fitTrail);
    const tick = (now) => {
      const dt = Math.min(0.05, (now - lt) / 1000); lt = now;
      dot.x += (mouse.px - dot.x) * 0.3; dot.y += (mouse.py - dot.y) * 0.3;
      cur$.style.transform = `translate3d(${dot.x}px,${dot.y}px,0)`;
      ctx.clearRect(0, 0, trail.width, trail.height); ctx.globalCompositeOperation = "lighter";
      for (const d of dust) { d.life += dt; d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 26 * dt; const k = Math.max(0, 1 - d.life / d.max), s = 1 + k * 2.4;
        ctx.fillStyle = `hsla(${d.hue},100%,80%,${k})`; ctx.fillRect(d.x - s / 2, d.y - s / 2, s, s); }
      for (let i = dust.length - 1; i >= 0; i--) if (dust[i].life > dust[i].max) dust.splice(i, 1);
      if (dust.length > 400) dust.splice(0, dust.length - 400);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // ---------------------------------------------------------------- test hook (see the task's test contract)
  window.__wonder = {
    progress: (id) => (id in progress ? progress[id] : null),
    playing: (id) => playing.has(id),
  };

  // ---------------------------------------------------------------- boot
  resize(); bakeCards(); onScroll();
  addEventListener("resize", () => { resize(); onScroll(); });
  addEventListener("scroll", onScroll, { passive: true });
  if (reduce) render(2.0); else requestAnimationFrame(loop);
})();
