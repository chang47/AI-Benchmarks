// Cartoon Three.js renderer for the Cannae sim. Map (x east, y north) → three (X = x, Z = -y, Y up).
// Every soldier figure stands for MEN_PER_FIGURE men; figures are laid out on a grid inside their unit's rectangle
// and drop out from the rear rows as the unit loses men. All figures of a kind share one InstancedMesh.
(function (root) {
  "use strict";
  const THREE = root.THREE;
  const MEN_PER_FIGURE = 20, SCALE = 3.2;

  const PALETTE = {
    roman: 0xb3121f, alliedInf: 0x7d0f1a, romanCav: 0xe8364a, alliedCav: 0xd96a78, velites: 0xf0a3a8,
    gaul: 0x1f6fc2, spaniard: 0xf5f3ee, libyan: 0x5f7a2a, hasdrubal: 0x6b3fa0, numidian: 0xe0b44c, balearic: 0x9ab7c9,
  };
  const SHIELD = { R: 0x7a0d12, C: 0x2b3440 }; // Roman shields dark red so the legions read red, not orange, from afar

  // Deterministic hash → [0, 1)
  const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const idHash = (id) => { let h = 7; for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0; return h; };

  function toonGradient() {
    const d = new Uint8Array([90, 160, 255]);
    const t = new THREE.DataTexture(d, 3, 1, THREE.RedFormat);
    t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true;
    return t;
  }

  function terrainHeight(x, z) {
    const hill = 70 * Math.exp(-(((x - 1350) / 330) ** 2 + ((z - 780) / 300) ** 2));
    const roll = 6 * Math.sin(x / 310) * Math.cos(z / 270) + 4 * Math.sin((x + z) / 190);
    const riverX = -1010 + 70 * Math.sin(z / 420);
    const bank = Math.max(0, 1 - Math.abs(x - riverX) / 90);
    return hill + roll * (1 - bank) - 9 * bank;
  }

  function buildWorld(scene) {
    const grad = toonGradient();
    // Ground with baked, banded grass colours.
    const g = new THREE.PlaneGeometry(5200, 4600, 208, 184); g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), h = terrainHeight(x, z);
      pos.setY(i, h);
      const n = 0.5 + 0.5 * Math.sin(x / 97 + Math.sin(z / 131) * 2) * Math.cos(z / 83);
      c.setHSL(0.24 - 0.04 * n + h / 2000, 0.38, 0.36 + 0.06 * n + h / 1000);
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
    const ground = new THREE.Mesh(g, new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: grad }));
    ground.receiveShadow = true; scene.add(ground);

    // The Aufidus: a winding ribbon of animated water along the western edge.
    const pts = []; for (let z = -2300; z <= 2300; z += 40) pts.push([-1010 + 70 * Math.sin(z / 420), z]);
    const rg = new THREE.BufferGeometry(), rv = [], ru = [];
    for (const [x, z] of pts) { rv.push(x - 55, -4, z, x + 55, -4, z); ru.push(0, z / 200, 1, z / 200); }
    const idx = []; for (let i = 0; i < pts.length - 1; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    rg.setAttribute("position", new THREE.Float32BufferAttribute(rv, 3)); rg.setAttribute("uv", new THREE.Float32BufferAttribute(ru, 2)); rg.setIndex(idx);
    const water = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 } }, transparent: true,
      vertexShader: "varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }",
      fragmentShader: `uniform float uT; varying vec2 vU;
        void main(){ float w = sin(vU.y*18. - uT*2. + sin(vU.x*9.)*1.5)*.5+.5; float edge = smoothstep(0.,.18,vU.x)*smoothstep(1.,.82,vU.x);
          vec3 c = mix(vec3(.16,.45,.62), vec3(.55,.82,.9), step(.82, w)*edge); gl_FragColor = vec4(c, .92*edge + .08); }` });
    scene.add(new THREE.Mesh(rg, water));

    // Trees along the river and on the hill; the town of Cannae on its hill; the two camps.
    const tree = new THREE.InstancedMesh(new THREE.ConeGeometry(9, 26, 6).translate(0, 17, 0), new THREE.MeshToonMaterial({ color: 0x3f7d3a, gradientMap: grad }), 260);
    const m = new THREE.Matrix4(); let n = 0;
    for (let i = 0; i < 260; i++) {
      const onHill = i % 3 === 0, z = onHill ? 780 + (hash(i, 1) - 0.5) * 700 : (hash(i, 2) - 0.5) * 4200;
      const x = onHill ? 1350 + (hash(i, 3) - 0.5) * 800 : -1010 + 70 * Math.sin(z / 420) + (hash(i, 4) < 0.5 ? -1 : 1) * (70 + hash(i, 5) * 120);
      if (!onHill && x > -880) continue;
      const s = 0.7 + hash(i, 6) * 0.8; m.compose(new THREE.Vector3(x, terrainHeight(x, z), z), new THREE.Quaternion(), new THREE.Vector3(s, s, s));
      tree.setMatrixAt(n++, m);
    }
    tree.count = n; tree.castShadow = true; scene.add(tree);
    const house = new THREE.MeshToonMaterial({ color: 0xf1e3c6, gradientMap: grad }), roof = new THREE.MeshToonMaterial({ color: 0xb4553a, gradientMap: grad });
    for (let i = 0; i < 16; i++) {
      const x = 1330 + (hash(i, 7) - 0.5) * 160, z = 770 + (hash(i, 8) - 0.5) * 140, y = terrainHeight(x, z);
      const b = new THREE.Mesh(new THREE.BoxGeometry(18, 12, 14), house); b.position.set(x, y + 6, z); b.castShadow = true; scene.add(b);
      const r = new THREE.Mesh(new THREE.ConeGeometry(14, 9, 4), roof); r.position.set(x, y + 16.5, z); r.rotation.y = Math.PI / 4; scene.add(r);
    }
    const camp = (x, y, color) => {
      const z = -y, mat = new THREE.MeshToonMaterial({ color, gradientMap: grad });
      for (const [dx, dz, w, d] of [[0, -110, 220, 6], [0, 110, 220, 6], [-110, 0, 6, 220], [110, 0, 6, 220]]) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 9, d), mat); wall.position.set(x + dx, terrainHeight(x + dx, z + dz) + 4, z + dz); scene.add(wall);
      }
      for (let i = 0; i < 12; i++) { const t = new THREE.Mesh(new THREE.ConeGeometry(8, 12, 4), new THREE.MeshToonMaterial({ color: 0xefe6d2, gradientMap: grad }));
        const tx = x - 80 + (i % 4) * 53, tz = z - 60 + Math.floor(i / 4) * 60; t.position.set(tx, terrainHeight(tx, tz) + 6, tz); scene.add(t); }
    };
    camp(-350, 1150, 0x8e5b3a); camp(150, -1250, 0x5b4a3a);
    return { water, grad };
  }

  /** Merge simple parts into one non-indexed geometry, translated/scaled. */
  function part(geo, x, y, z, sx = 1, sy = 1, sz = 1) { const g = geo.toNonIndexed(); g.scale(sx, sy, sz); g.translate(x, y, z); return g; }
  function merge(list) {
    const pos = [], nor = [];
    for (const g of list) { pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); }
    const out = new THREE.BufferGeometry();
    out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    return out.scale(SCALE, SCALE, SCALE);
  }

  function Soldiers(scene, grad, max = 9000) {
    const mk = (geo, color) => {
      const mesh = new THREE.InstancedMesh(geo, new THREE.MeshToonMaterial({ color: color ?? 0xffffff, gradientMap: grad }), max);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.castShadow = true; mesh.frustumCulled = false; mesh.count = 0;
      scene.add(mesh); return mesh;
    };
    // Infantry: tunic body (contingent colour), head (skin), shield + spear (side colour).
    const infBody = mk(merge([part(new THREE.CylinderGeometry(0.42, 0.55, 1.2, 7), 0, 0.6, 0), part(new THREE.BoxGeometry(0.28, 0.5, 0.28), -0.18, 0.1, 0), part(new THREE.BoxGeometry(0.28, 0.5, 0.28), 0.18, 0.1, 0)]));
    const infHead = mk(merge([part(new THREE.SphereGeometry(0.34, 8, 6), 0, 1.48, 0)]), 0xf0c7a0);
    const infGear = mk(merge([part(new THREE.BoxGeometry(0.95, 1.0, 0.12), 0, 0.85, 0.46), part(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 4), 0.55, 1.25, 0.1)]));
    // Cavalry: horse (brown), rider (contingent colour).
    const horse = mk(merge([part(new THREE.BoxGeometry(0.7, 0.7, 1.9), 0, 1.15, 0), part(new THREE.BoxGeometry(0.4, 0.75, 0.55), 0, 1.65, 1.05), part(new THREE.BoxGeometry(0.2, 0.8, 0.2), 0.25, 0.4, 0.7), part(new THREE.BoxGeometry(0.2, 0.8, 0.2), -0.25, 0.4, 0.7), part(new THREE.BoxGeometry(0.2, 0.8, 0.2), 0.25, 0.4, -0.7), part(new THREE.BoxGeometry(0.2, 0.8, 0.2), -0.25, 0.4, -0.7)]), 0x7a4f30);
    const rider = mk(merge([part(new THREE.CylinderGeometry(0.34, 0.4, 0.9, 7), 0, 1.95, -0.1), part(new THREE.SphereGeometry(0.3, 8, 6), 0, 2.6, -0.1)]));
    const fallen = mk(merge([part(new THREE.BoxGeometry(1.1, 0.12, 0.45), 0, 0.06, 0)]), 0x7d4a3a);
    fallen.castShadow = false;

    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1), E = new THREE.Euler(), C = new THREE.Color();
    const counts = {};

    function update(state, clock) {
      let ni = 0, nc = 0, nf = 0;
      for (const k in counts) delete counts[k];
      const routT = {};
      for (const e of state.events) if (e.type === "rout" && routT[e.id] == null) routT[e.id] = e.t;
      for (const u of state.units) {
        if (u.status === "destroyed" || u.status === "left" || u.status === "split") continue;
        const n = Math.ceil(u.men / MEN_PER_FIGURE);
        counts[u.id] = n;
        const cav = u.kind === "cav", sp = Math.sqrt((MEN_PER_FIGURE / (u.kind === "light" ? 0.8 : cav ? 0.35 : u.contingent === "roman" || u.contingent === "alliedInf" ? 0.4 : u.contingent === "libyan" ? 1 : 1.2)));
        const cols = Math.max(1, Math.round(u.w / sp)), rows = Math.max(1, Math.ceil(n / cols));
        const f = [Math.sin(u.h), Math.cos(u.h)], r = [Math.cos(u.h), -Math.sin(u.h)], rot = Math.PI - u.h, hid = idHash(u.id);
        const ot = u.order?.type ?? u.order; // live sim state holds order objects; snapshots hold the type string
        const routing = u.status === "routing", fighting = u.status === "engaged", moving = !fighting && !["hold", "ambush", "holdLine", "giveGround"].includes(ot);
        C.setHex(PALETTE[u.contingent] || 0xffffff);
        for (let i = 0; i < n; i++) {
          const row = Math.floor(i / cols), colI = i % cols;
          const lx = ((colI + 0.5) / cols - 0.5) * u.w + (hash(hid, i) - 0.5) * sp * 0.5;
          const lf = u.d / 2 - ((row + 0.5) / rows) * u.d + (hash(i, hid) - 0.5) * sp * 0.4;
          let x = u.x + r[0] * lx + f[0] * lf, y = u.y + r[1] * lx + f[1] * lf;
          const ph = hash(hid + 3, i) * 6.28, rnd = hash(hid + 7, i);
          let turn = 0;
          if (routing) { // the formation dissolves into a fleeing cloud that spreads with time since the rout
            const spread = Math.min(170, (state.t - (routT[u.id] ?? state.t)) * 3.5 + 10) * (0.3 + rnd);
            x += Math.cos(ph) * spread; y += Math.sin(ph) * spread * 0.6; turn = (rnd - 0.5) * 0.9;
          } else if (u.kind === "light") { // open order: a loose, wandering screen
            x += (rnd - 0.5) * sp * 1.6 + Math.sin(clock * 0.6 + ph) * 3; y += (hash(i, hid + 11) - 0.5) * sp * 1.6 + Math.cos(clock * 0.5 + ph) * 3;
          } else if (ot === "harass") { // Numidians: riders dart in and out individually
            const dart = Math.sin(clock * 1.1 + ph) * 28;
            x += f[0] * dart + r[0] * Math.sin(clock * 0.7 + ph * 2) * 10; y += f[1] * dart + r[1] * Math.sin(clock * 0.7 + ph * 2) * 10; turn = Math.cos(clock * 1.1 + ph) > 0 ? 0 : Math.PI;
          } else if (cav && (fighting || ot === "pursue")) { // melee / pursuit: the rows break up, riders circle, surge and mix
            const rad = ot === "pursue" ? 14 + rnd * 30 : 6 + rnd * 10;
            x += Math.cos(clock * 1.7 + ph) * rad + f[0] * rnd * 25; y += Math.sin(clock * 2.1 + ph) * rad + f[1] * rnd * 25; turn = Math.sin(clock * 1.3 + ph) * 1.1;
          } else if (cav && (ot === "charge" || ot === "path")) { // on the move: a loose, strung-out mass, riders surging and drifting
            const rnd2 = hash(hid + 13, i);
            x += f[0] * ((rnd2 - 0.5) * sp * 2.2 + Math.sin(clock * 0.9 + ph) * 12) + r[0] * (rnd - 0.5) * sp * 1.8;
            y += f[1] * ((rnd2 - 0.5) * sp * 2.2 + Math.sin(clock * 0.9 + ph) * 12) + r[1] * (rnd - 0.5) * sp * 1.8;
            turn = (rnd - 0.5) * 0.5;
          }
          const bob = routing ? Math.abs(Math.sin(clock * 11 + ph)) * 1.4 : moving ? Math.abs(Math.sin(clock * 8 + ph)) * 0.9 : fighting ? Math.abs(Math.sin(clock * 13 + ph)) * 0.7 : 0.05 * Math.sin(clock + ph);
          const lunge = fighting ? Math.sin(clock * 6.5 + ph) * 1.2 : 0;
          x += f[0] * lunge; y += f[1] * lunge;
          const X = x, Z = -y, Yb = terrainHeight(X, Z) + bob;
          E.set(0, rot + (routing ? Math.PI : 0) + turn + (hash(i, hid + 9) - 0.5) * 0.3, 0); Q.setFromEuler(E);
          M.compose(V.set(X, Yb, Z), Q, S);
          if (cav) { horse.setMatrixAt(nc, M); rider.setMatrixAt(nc, M); rider.setColorAt(nc, C); nc++; }
          else { infBody.setMatrixAt(ni, M); infBody.setColorAt(ni, C); infHead.setMatrixAt(ni, M); infGear.setMatrixAt(ni, M); infGear.setColorAt(ni, C.setHex(SHIELD[u.side])); C.setHex(PALETTE[u.contingent] || 0xffffff); ni++; }
          if (ni >= max || nc >= max) break;
        }
      }
      // The fallen: every 20 men lost, one figure lies where its unit stood when they fell.
      for (const [t, id, fx, fy, fh, fw, fd, lost] of state.fallen) {
        const hid = idHash(id) + t, k = Math.floor(lost / MEN_PER_FIGURE), f = [Math.sin(fh), Math.cos(fh)], r = [Math.cos(fh), -Math.sin(fh)];
        for (let i = 0; i < k && nf < max; i++) {
          const lx = (hash(hid, i) - 0.5) * fw, lf = (hash(i, hid) - 0.5) * (fd + 30);
          const X = fx + r[0] * lx + f[0] * lf, Z = -(fy + r[1] * lx + f[1] * lf);
          E.set(0, hash(i + 5, hid) * 6.28, 0); Q.setFromEuler(E);
          fallen.setMatrixAt(nf++, M.compose(V.set(X, terrainHeight(X, Z) + 0.2, Z), Q, S));
        }
      }
      for (const [mesh, c] of [[infBody, ni], [infHead, ni], [infGear, ni], [horse, nc], [rider, nc], [fallen, nf]]) {
        mesh.count = c; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
      return { infantry: ni, cavalry: nc, fallen: nf };
    }
    return { update, counts, MEN_PER_FIGURE };
  }

  root.CannaeRender = { buildWorld, Soldiers, terrainHeight, PALETTE, MEN_PER_FIGURE };
})(typeof window !== "undefined" ? window : globalThis);
