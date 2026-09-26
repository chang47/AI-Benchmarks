// GLSL for the Wonders world. All scenes are procedural: no textures, no models.
// Full-screen scene shaders share COMMON (noise) and output LINEAR HDR colour; the final pass
// tone-maps (ACES), adds grain + vignette and converts to display gamma.
window.WONDER_GLSL = (() => {
  const COMMON = /* glsl */ `
  precision highp float;
  uniform vec2 uRes; uniform float uTime; uniform float uP; uniform vec2 uMouse;
  varying vec2 vUv;
  float hash12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
  vec2 hash22(vec2 p){ vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3+=dot(p3,p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
  float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
    return mix(mix(hash12(i),hash12(i+vec2(1,0)),u.x), mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),u.x), u.y); }
  const mat2 ROT = mat2(1.6,1.2,-1.2,1.6);
  float fbm(vec2 p){ float a=.5,s=0.; for(int i=0;i<6;i++){ s+=a*noise(p); p=ROT*p; a*=.5; } return s; }
  float fbm3(vec2 p){ float a=.5,s=0.; for(int i=0;i<3;i++){ s+=a*noise(p); p=ROT*p; a*=.5; } return s; }
  vec2 frag(){ return (vUv - .5) * vec2(uRes.x / uRes.y, 1.); }
  float stars(vec2 uv, float density, float t){
    vec2 g = uv*density; vec2 id=floor(g); vec2 f=fract(g)-.5; vec2 o=hash22(id)-.5;
    float h=hash12(id+7.); float d=length(f-o*.7);
    float tw = .6+.4*sin(t*(1.+h*3.)+h*40.);
    return smoothstep(.06*h+.01, 0., d) * step(.72, h) * tw * (h*h*3.);
  }`;

  const VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;

  // ---------------------------------------------------------------- meteors over mountains
  const SKY = COMMON + /* glsl */ `
  float ridge(float x, float seed, float base, float amp, float sharp){
    float h = fbm3(vec2(x*sharp+seed, seed*3.)) + .12*noise(vec2(x*sharp*8., seed)); return base + (h - .5)*amp;
  }
  void main(){
    vec2 uv = frag(); float t = uTime;
    vec2 m = uMouse*.02;
    vec3 col = mix(vec3(.002,.003,.01), vec3(.012,.016,.05), smoothstep(.55,-.3,uv.y));
    // milky way band
    vec2 r = mat2(.8,-.6,.6,.8)*(uv+m*.5);
    float band = exp(-pow(r.y*3.2,2.));
    float dust = fbm(r*3.+vec2(t*.003,0.));
    col += band * (vec3(.05,.045,.08)*dust + vec3(.012,.016,.035)) * (.5+.9*fbm3(r*9.));
    col *= 1. - band * smoothstep(.5,.72,fbm3(r*6.+3.)) * .7;                 // dark dust lanes
    col += vec3(.95,.97,1.) * (stars(uv+m, 70., t) + stars(uv+m*.6, 150., t*1.3)*.6 + band*stars(uv+m, 300., t)*1.5);
    // meteors: analytic streaks with bright heads
    for(int k=0;k<4;k++){
      float fk=float(k); float cyc = t*.32 + fk*.37; float n = floor(cyc); float ph = fract(cyc);
      vec2 s = vec2(hash12(vec2(n,fk))*1.8-.4, .25+hash12(vec2(fk,n))*.35);
      vec2 dir = normalize(vec2(-1., -.62)); vec2 head = s + dir*ph*1.4; float len = .35;
      vec2 pa = uv - head; float along = dot(pa, -dir); float across = length(pa + dir*along);
      float streak = smoothstep(.004, 0., across) * smoothstep(len, 0., along) * step(0., along);
      float fade = smoothstep(0., .1, ph) * smoothstep(1., .6, ph);
      col += vec3(.8,.9,1.2) * streak * fade * 3.5 + vec3(2.,2.,2.2)*smoothstep(.012,0.,length(pa))*fade;
    }
    // three mountain ranges with aerial perspective; scroll + mouse move them at different rates
    for(int k=0;k<3;k++){
      float fk=float(k); float par = (fk+1.)*.08;
      float x = uv.x + m.x*(fk+1.)*1.5 + uP*par;
      float h = ridge(x, 11.+fk*7., -.08-fk*.14, .55-fk*.1, 1.1+fk*.5);
      float inside = smoothstep(.002, -.002, uv.y - h);
      vec3 rock = mix(vec3(.012,.016,.04), vec3(.001,.0015,.004), fk/2.);
      float slope = fbm3(vec2(x*14., uv.y*14.));
      float snow = smoothstep(.09,.0, h-uv.y) * smoothstep(.42,.62,slope) * (1.-fk*.5);
      vec3 mc = rock + vec3(.32,.38,.55)*snow*.45 + vec3(.02,.025,.06)*slope*.35*(1.-fk*.4);
      mc = mix(mc, vec3(.02,.025,.06), (2.-fk)*.12);                  // gentle haze on far ranges
      col = mix(col, mc, inside);
    }
    col += vec3(.03,.035,.09)*smoothstep(.1,-.35,uv.y)*.25;             // faint horizon glow
    gl_FragColor = vec4(col, 1.);
  }`;

  // ---------------------------------------------------------------- volcano (uP = eruption, so scrolling up rewinds it)
  const VOLCANO = COMMON + /* glsl */ `
  // concave stratovolcano profile: steep near the summit, flaring out at the base
  float cone(float x){ float s = abs(x); float h = .1 - 1.25*s + .95*s*s; h = max(h, -.3); h += (fbm(vec2(x*7.,1.))-.5)*.035; float crater = smoothstep(.05,.0,s)*.025; return h - crater; }
  void main(){
    vec2 uv = frag(); float e = uP; float t = uTime;
    vec2 q = uv - vec2(.18, 0.); q.x += uMouse.x*.015;
    vec3 sky = mix(vec3(.006,.005,.018), vec3(.04,.02,.045), smoothstep(.6,-.2,uv.y));
    vec3 fire = mix(vec3(.03,.006,.004), vec3(.55,.12,.03), smoothstep(.15,-.3,uv.y));
    sky = mix(sky, fire, e*.9);
    vec3 col = sky + vec3(.9,.95,1.)*stars(uv, 80., t)*(1.-e);
    float peak = .08;
    // ash plume: domain-warped fbm rising from the crater, height grows with eruption
    vec2 pq = q - vec2(0., peak); float height = e*1.15;
    vec2 w = vec2(fbm(pq*3.+vec2(0.,-t*.08)), fbm(pq*3.+vec2(5.2,-t*.1)));
    float wide = .04 + max(pq.y,0.)*.9;
    float shape = smoothstep(wide, wide*.3, abs(pq.x + (w.x-.5)*.25*pq.y*3.)) * smoothstep(height, height*.55, pq.y) * step(0., pq.y);
    float dens = shape * smoothstep(.35,.75, fbm(pq*4.+w*1.5+vec2(0.,-t*.12)));
    vec3 ashc = mix(vec3(.012,.01,.012), vec3(.05,.042,.042), fbm(pq*7.));
    ashc += vec3(1.1,.32,.08) * exp(-pq.y*6.) * e;                      // lit from below by the lava
    col = mix(col, ashc, clamp(dens*1.3,0.,1.)*step(.001,e));
    // lava fountain glow + sparks (ballistic, deterministic in e)
    col += vec3(3.,1.,.25) * exp(-length(pq*vec2(4.,2.5))*6.) * e * 1.6;
    for(int i=0;i<60;i++){
      float fi=float(i); float t0 = .05 + hash12(vec2(fi,1.))*.8; if(e < t0) continue;
      float age = (e - t0)*3.; float ang = (hash12(vec2(fi,2.))-.5)*1.6; float sp = .45+hash12(vec2(fi,3.))*.6;
      vec2 pos = vec2(sin(ang)*sp*age, cos(ang)*sp*age - 1.1*age*age) + vec2(0., peak);
      float heat = clamp(1.-age*.9,0.,1.);
      col += vec3(3.,1.3,.3) * heat * smoothstep(.009, 0., length(q-pos)) * step(-.5, pos.y);
    }
    // the mountain: rough dark rock, lava rivers that grow down the slopes with e
    float h = cone(q.x);
    if(uv.y < h - .0){
      float depth = h - uv.y;
      vec3 rock = vec3(.006,.005,.006) + vec3(.02,.014,.013)*fbm(q*vec2(14.,22.));
      float rim = smoothstep(.0,.015, .015-depth) * .35;
      rock += vec3(.7,.2,.05) * rim * e;
      // three lava channels that snake down from the crater; their reach grows with the eruption
      float river = 0.;
      for(int c=0;c<3;c++){ float fc=float(c); float dist = peak - q.y;
        float dx = (fc-1.)*(.03 + dist*.42) + (fbm(vec2(q.y*9.+fc*9., fc*3.))-.5)*.22*(dist+.03) + sin(q.y*40.+fc*2.)*.006*dist*8.;
        float w = (.002 + dist*.009) * (.6 + .8*fbm(vec2(q.y*20.+fc, fc)));
        float reach = e*(.55 + .25*fc*.5);                                  // channels reach different lengths
        river += smoothstep(w, w*.15, abs(q.x - dx)) * smoothstep(peak - reach - .02, peak - reach + .03, q.y); }
      river = clamp(river,0.,1.) * step(q.y, peak + .01);
      float crust = smoothstep(.35,.7, fbm(vec2(q.x*60., q.y*60. + t*.5)));   // cooling crust breaks up the glow
      float pulse = .55 + .6*fbm(vec2(q.x*25., q.y*25. + t*.8));
      rock += vec3(3.2,.95,.18) * river * pulse * (1.-crust*.7) * smoothstep(.1,.45,e);
      rock += vec3(.4,.08,.02) * smoothstep(.05,.0,abs(q.x))*smoothstep(-.05,.1,q.y)*e*.15;

      col = mix(col, rock, smoothstep(0., .004, depth));
    }
    // distant ridge + ground glow
    float r2 = -.25 + (fbm(vec2(uv.x*2.+3.,0.))-.5)*.12;
    col = mix(col, vec3(.004,.003,.004) + vec3(.35,.08,.02)*e*.12*smoothstep(-.5,-.25,uv.y), step(uv.y, r2));
    gl_FragColor = vec4(col, 1.);
  }`;

  // ---------------------------------------------------------------- waterfall + forest (parallax layers move with uP)
  const FALLS = COMMON + /* glsl */ `
  // a row of conifers: tiered triangles with jittered spacing, heights and ragged edges
  float conifers(vec2 p, float seed, float scale, float y0){
    float cw = 1./scale; float id = floor(p.x*scale); float inside = 0.;
    for(int j=-1;j<=1;j++){
      float cid = id + float(j); float cx = (cid + .5 + (hash12(vec2(cid,seed))-.5)*.7)*cw;
      float H = cw*(2.4 + 2.2*hash12(vec2(cid,seed+1.)));
      float ly = (p.y - y0)/H;
      float tier = .72 + .28*fract(ly*6. + hash12(vec2(cid,seed+2.)));
      float hw = cw*.62*(1.-ly)*tier*(.85+.3*noise(p*scale*9.));
      inside = max(inside, step(0., ly)*step(ly, 1.)*step(abs(p.x-cx), hw));
    }
    return max(inside, step(p.y, y0));
  }
  void main(){
    vec2 uv = frag(); float t = uTime; vec2 m = uMouse*.02;
    vec3 col = mix(vec3(.03,.06,.07), vec3(.3,.34,.3), smoothstep(-.1,.7,uv.y));
    col += vec3(.9,.6,.3) * exp(-length(uv-vec2(-.75,.55))*2.2) * .35;        // low dawn sun behind the haze
    vec2 lp = vec2(-.9,.7); vec2 d = uv-lp; float ang = atan(d.y,d.x);
    col += vec3(.5,.42,.28) * pow(noise(vec2(ang*26., t*.04)), 4.) * smoothstep(1.7,.2,length(d)) * .3;
    // cliff with a notch; water falls through it
    float cx = -.28 + m.x;
    float edgeL = cx - .085 + (fbm3(vec2(uv.y*6.,1.))-.5)*.05, edgeR = cx + .085 + (fbm3(vec2(uv.y*6.,4.))-.5)*.05;
    float cliffTop = .36 + (fbm3(vec2(uv.x*3.,9.))-.5)*.1;
    float span = .55 + (fbm3(vec2(uv.y*4.,2.))-.5)*.25;                        // ragged outer edges of the rock face
    bool cliff = uv.y < cliffTop && (uv.x < edgeL || uv.x > edgeR) && uv.y > -.4 && abs(uv.x - cx) < span;
    if(cliff){
      float strata = fbm3(vec2(uv.x*6., uv.y*40.));
      vec3 rock = vec3(.035,.04,.042) + vec3(.09,.09,.085)*fbm3(uv*vec2(10.,30.))*strata;
      rock += vec3(.02,.06,.025) * smoothstep(.62,.85, fbm3(uv*vec2(30.,24.)));  // fine moss
      rock *= .55 + .6*smoothstep(-.4,.4,uv.y);
      float fog = .2 + .6*smoothstep(span-.2, span, abs(uv.x-cx));            // edges dissolve into the haze
      col = mix(rock, col, fog);
    }
    float inFall = smoothstep(edgeL-.005, edgeL+.01, uv.x) * smoothstep(edgeR+.005, edgeR-.01, uv.x) * step(uv.y, cliffTop) * step(-.36, uv.y);
    float streak = fbm(vec2((uv.x-cx)*60., uv.y*3. + t*2.2)) ;
    vec3 water = mix(vec3(.18,.3,.33), vec3(1.2,1.35,1.35), smoothstep(.38,.8,streak));
    water += vec3(.6,.7,.7) * smoothstep(.02,.0, cliffTop - uv.y) ;           // bright lip where it leaves the cliff
    col = mix(col, water, inFall*.92);
    // mist at the base
    float mist = fbm3(vec2(uv.x*3. - t*.08, uv.y*4. + t*.05)) * smoothstep(.2,-.3,uv.y) * smoothstep(.9,.0,abs(uv.x-cx));
    col += vec3(.75,.85,.85) * mist * .6;
    // forest layers, far to near; each moves at its own rate as you scroll (parallax) and fades into the mist
    for(int k=0;k<4;k++){
      float fk = float(k); float rate = (.15 + fk*.15);
      float y0 = -.12 - fk*.09 + uP*rate*.3;
      vec2 fp = vec2(uv.x + m.x*(fk+1.)*.5 + fk*1.7, uv.y);
      float inside = conifers(fp, 3.+fk*11., 26. - fk*5., y0);
      vec3 leaf = mix(vec3(.03,.07,.06), vec3(.002,.008,.006), fk/3.);
      leaf += vec3(.02,.05,.03) * noise(uv*vec2(40.,50.)+fk) * (1.-fk/3.);
      leaf = mix(leaf, col, (3.-fk)*.2);
      col = mix(col, leaf, inside);
    }
    gl_FragColor = vec4(col, 1.);
  }`;

  // ---------------------------------------------------------------- aurora (backdrop of the wonders strip)
  const AURORA = COMMON + /* glsl */ `
  vec3 aurora(vec2 uv, float t){
    vec3 acc = vec3(0.);
    for(int i=0;i<24;i++){
      float fi=float(i); float y = .05 + fi*.022;
      float wave = fbm3(vec2(uv.x*1.3 + fi*.05 + t*.03, fi*.1)) - .5;
      float d = uv.y - (y + wave*.35);
      float curtain = exp(-max(d,0.)*9.) * smoothstep(-.01, .01, d) * smoothstep(.4,.55, fbm3(vec2(uv.x*6.+fi*.3, t*.2)));
      acc += mix(vec3(.1,1.,.45), vec3(.6,.25,1.), fi/24.) * curtain * .09;
    }
    return acc;
  }
  void main(){
    vec2 uv = frag(); float t = uTime; vec2 m = uMouse*.02;
    vec3 col = mix(vec3(.004,.008,.02), vec3(.01,.03,.05), smoothstep(.5,-.3,uv.y));
    col += vec3(.9,.95,1.)*stars(uv+m, 90., t);
    col += aurora(uv + vec2(uP*.2,0.)+m, t) * .45;
    float h = -.22 + (fbm(vec2(uv.x*1.5+2.,5.))-.5)*.16;
    if(uv.y < h){ vec3 snow = vec3(.02,.03,.05) + vec3(.06,.12,.12)*fbm(uv*9.); col = snow + aurora(vec2(uv.x, -uv.y), t)*.25; }
    gl_FragColor = vec4(col, 1.);
  }`;

  // ---------------------------------------------------------------- ocean at sunset: height-field raymarch (Seascape-style)
  const OCEAN = COMMON + /* glsl */ `
  const float SEA_H = .6, SEA_CHOP = 4., SEA_FREQ = .16;
  float sn(vec2 p){ return -1. + 2.*noise(p); }
  float octave(vec2 uv, float choppy){ uv += sn(uv); vec2 wv = 1.-abs(sin(uv)); vec2 swv = abs(cos(uv)); wv = mix(wv, swv, wv); return pow(1.-pow(wv.x*wv.y, .65), choppy); }
  float seaT(){ return 1. + uTime*.8; }
  float mapG(vec3 p){ float f=SEA_FREQ, a=SEA_H, c=SEA_CHOP, h=0.; vec2 uv=p.xz; uv.x*=.75;
    for(int i=0;i<3;i++){ float d = octave((uv+seaT())*f, c) + octave((uv-seaT())*f, c); h += d*a; uv = ROT*uv; f*=1.9; a*=.22; c=mix(c,1.,.2); } return p.y - h; }
  float mapD(vec3 p){ float f=SEA_FREQ, a=SEA_H, c=SEA_CHOP, h=0.; vec2 uv=p.xz; uv.x*=.75;
    for(int i=0;i<5;i++){ float d = octave((uv+seaT())*f, c) + octave((uv-seaT())*f, c); h += d*a; uv = ROT*uv; f*=1.9; a*=.22; c=mix(c,1.,.2); } return p.y - h; }
  vec3 sunDir(){ return normalize(vec3(0., .06, 1.)); }
  vec3 skyCol(vec3 e){
    float y = max(e.y, 0.);
    vec3 c = mix(vec3(1.6,.62,.3), vec3(.16,.08,.3), pow(y, .45));
    c = mix(c, vec3(.03,.02,.08), smoothstep(.25, .9, y));
    float s = max(dot(e, sunDir()), 0.);
    c += vec3(6.,3.4,1.6)*pow(s, 900.) + vec3(1.2,.5,.2)*pow(s, 12.)*.6;
    return c;
  }
  vec3 seaCol(vec3 p, vec3 n, vec3 l, vec3 eye, vec3 dist){
    float fres = clamp(1.-dot(n,-eye), 0., 1.); fres = pow(fres, 3.)*.65;
    vec3 refl = skyCol(reflect(eye, n));
    vec3 refr = vec3(.0,.05,.09) + pow(dot(n,l)*.4+.6, 80.)*vec3(.6,.4,.3)*.12;
    vec3 c = mix(refr, refl, fres);
    float atten = max(1. - dot(dist,dist)*.001, 0.);
    c += vec3(.5,.3,.2)*.1*(p.y - SEA_H)*.18*atten;
    c += vec3(4.,2.2,1.1)*pow(max(dot(reflect(eye,n),l),0.), 90.)*.8;
    return c;
  }
  vec3 normalAt(vec3 p, float eps){ vec3 n; n.y = mapD(p); n.x = mapD(vec3(p.x+eps,p.y,p.z)) - n.y; n.z = mapD(vec3(p.x,p.y,p.z+eps)) - n.y; n.y = eps; return normalize(n); }
  float trace(vec3 ori, vec3 dir, out vec3 p){
    float tm = 0., tx = 1000.; float hx = mapG(ori + dir*tx); if(hx > 0.){ p = ori + dir*tx; return tx; }
    float hm = mapG(ori + dir*tm); float tmid = 0.;
    for(int i=0;i<8;i++){ tmid = mix(tm, tx, hm/(hm-hx)); p = ori + dir*tmid; float hmid = mapG(p); if(hmid < 0.){ tx = tmid; hx = hmid; } else { tm = tmid; hm = hmid; } }
    return tmid;
  }
  void main(){
    vec2 uv = frag();
    float camY = 3.6 - uP*1.8;
    vec3 ori = vec3(0., camY, uTime*3.);
    vec3 dir = normalize(vec3(uv.x + uMouse.x*.03, uv.y - .1 + uMouse.y*.02, 1.6));
    vec3 p; trace(ori, dir, p);
    vec3 dist = p - ori; vec3 n = normalAt(p, dot(dist,dist)*.1/uRes.x);
    vec3 sky = skyCol(dir);
    vec3 sea = seaCol(p, n, sunDir(), dir, dist);
    vec3 col = mix(sky, sea, pow(smoothstep(0., -.02, dir.y), .2));
    gl_FragColor = vec4(col * .32, 1.);
  }`;

  // ---------------------------------------------------------------- wonder-card stills (uKind selects the scene)
  const CARDS = COMMON + /* glsl */ `
  uniform int uKind;
  vec3 aces(vec3 x){ return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14), 0., 1.); }
  void main(){
    vec2 uv = frag(); float t = 3.7; vec3 col = vec3(0.);
    if(uKind == 0){ // aurora over a still lake
      col = mix(vec3(.005,.01,.03), vec3(.01,.04,.06), smoothstep(.5,-.3,uv.y)) + stars(uv, 60., t);
      for(int i=0;i<30;i++){ float fi=float(i); float y=.0+fi*.016; float w=fbm3(vec2(uv.x*1.1+fi*.04, fi*.13))-.5; float d=uv.y-(y+w*.4);
        col += mix(vec3(.08,.9,.4), vec3(.55,.25,.9), fi/30.) * exp(-max(d,0.)*10.)*smoothstep(-.01,.01,d)*smoothstep(.35,.55,fbm3(vec2(uv.x*5.+fi*.2,1.)))*.075; }
      if(uv.y < -.18){ col *= .15; col += vec3(.1,.6,.3)*.12*fbm(vec2(uv.x*3., uv.y*40.)); }
    } else if(uKind == 1){ // nebula
      vec2 w = vec2(fbm(uv*2.), fbm(uv*2.+5.));
      float d = fbm(uv*2.5 + w*2.);
      col = vec3(.004,.003,.012) + vec3(1.1,.28,.4)*pow(d,4.)*1.4 + vec3(.15,.35,.9)*pow(fbm(uv*3.+w*3.+9.),4.)*1.3;
      col *= 1. - .8*smoothstep(.5,.75,fbm(uv*5.+w));                    // dark dust pillars
      col = max(col, 0.) + stars(uv, 90., t)*1.5 + vec3(3.,2.5,2.)*smoothstep(.02,0.,length(uv-vec2(.1,.05)));
    } else if(uKind == 2){ // coral reef under caustics
      col = mix(vec3(.0,.08,.14), vec3(.1,.5,.6), smoothstep(-.4,.5,uv.y));
      float c = pow(abs(sin(noise(uv*9.+t)*6.)), 8.); col += vec3(.3,.6,.6)*c*.25*smoothstep(-.2,.5,uv.y);
      for(int k=0;k<3;k++){ float fk=float(k); float top = -.15 - fk*.08 + (fbm(vec2(uv.x*4.+fk*3.,fk))-.5)*.3;
        float in_ = smoothstep(.01,-.01, uv.y-top); vec3 cc = mix(vec3(1.3,.35,.4), vec3(1.,.6,.2), hash12(vec2(floor(uv.x*6.+fk),fk)));
        cc *= .4 + .8*fbm(uv*25.+fk); cc = mix(cc, vec3(.0,.1,.15), fk*.25); col = mix(col, cc, in_); }
      col += vec3(.8,1.,1.)*smoothstep(.01,.0,length(fract(uv*vec2(4.,3.)+vec2(0.,t*.1))-.5)-.02)*.4*step(-.1,uv.y);
    } else if(uKind == 3){ // singing dunes at golden hour
      col = mix(vec3(1.4,.7,.35), vec3(.35,.3,.6), smoothstep(-.1,.5,uv.y));
      col += vec3(3.,1.8,.8)*exp(-length(uv-vec2(.35,.02))*9.);
      for(int k=0;k<4;k++){ float fk=float(k); float top = -.02 - fk*.11 + sin(uv.x*(2.+fk)+fk*2.)*.06 + (fbm(vec2(uv.x*2.,fk))-.5)*.08;
        if(uv.y < top){ float slope = cos(uv.x*(2.+fk)+fk*2.); vec3 sand = mix(vec3(.9,.45,.18), vec3(.35,.12,.06), fk/3.);
          sand *= .7 + .5*smoothstep(-.3,.6,slope); sand += vec3(.2,.1,.05)*sin((uv.x+uv.y*.3)*160.)*.05; col = sand; } }
    } else if(uKind == 4){ // lightning in a storm cloud
      col = vec3(.03,.03,.06) + vec3(.15,.14,.25)*fbm(uv*3.) * smoothstep(-.4,.4,uv.y);
      float x = .1; float glow = 0.;
      for(int i=0;i<24;i++){ float fi=float(i); float y0 = .5 - fi*.045; float x1 = x + (hash12(vec2(fi,2.))-.5)*.12;
        vec2 a = vec2(x, y0), b = vec2(x1, y0-.045); vec2 pa = uv-a, ba = b-a; float h = clamp(dot(pa,ba)/dot(ba,ba),0.,1.);
        float dd = length(pa-ba*h); glow += .0012/(dd+.001); x = x1; }
      col += vec3(.8,.75,1.4)*glow*.6 + vec3(.3,.25,.6)*exp(-length(uv-vec2(.1,.5))*3.);
    } else { // glowing bay: bioluminescent surf under stars
      col = mix(vec3(.0,.01,.03), vec3(.01,.03,.07), smoothstep(.4,-.2,uv.y)) + stars(uv, 80., t)*step(0.,uv.y);
      if(uv.y < 0.){ float wv = fbm(vec2(uv.x*6., uv.y*30.)); float crest = smoothstep(.62,.75, fbm(vec2(uv.x*3.+uv.y*8., uv.y*18.)));
        col = vec3(.0,.02,.05) + vec3(.1,1.,1.8)*crest*1.2*(1.+uv.y) + vec3(.0,.2,.4)*wv*.2; }
    }
    col = aces(col * .9);
    col *= .8 + .2*smoothstep(.95,.3,length(uv));
    gl_FragColor = vec4(pow(col, vec3(1./2.2)), 1.);
  }`;

  // ---------------------------------------------------------------- galaxy particles (rendered as THREE.Points)
  const GALAXY_VERT = /* glsl */ `
  uniform float uTime; uniform float uSize; attribute float aR; attribute float aAng; attribute float aY; attribute float aSeed; attribute vec3 aColor;
  varying vec3 vColor; varying float vA;
  void main(){
    float ang = aAng + uTime * .08 / (.15 + aR);
    vec3 pos = vec3(cos(ang)*aR, aY, sin(ang)*aR);
    vec4 mv = modelViewMatrix * vec4(pos, 1.);
    gl_Position = projectionMatrix * mv;
    float tw = .75 + .25*sin(uTime*2. + aSeed*60.);
    gl_PointSize = uSize * (0.4 + aSeed) * tw / -mv.z;
    vColor = aColor; vA = tw;
  }`;
  const GALAXY_FRAG = /* glsl */ `
  varying vec3 vColor; varying float vA;
  void main(){ vec2 c = gl_PointCoord - .5; float d = dot(c,c); if(d > .25) discard; float a = exp(-d*18.); gl_FragColor = vec4(vColor * a * vA, 1.); }`;

  // ---------------------------------------------------------------- composite: dissolve between two scenes with a noise mask
  const MIX = /* glsl */ `
  precision highp float; uniform sampler2D tA; uniform sampler2D tB; uniform float uMix; uniform float uTime; varying vec2 vUv;
  float hash12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
  float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f); return mix(mix(hash12(i),hash12(i+vec2(1,0)),u.x), mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),u.x), u.y); }
  void main(){
    float n = noise(vUv*4.) * .6 + noise(vUv*11.) * .3 + noise(vUv*29.) * .1;
    float k = mix(-.2, 1.25, uMix);                        // threshold sweeps past both ends so 0 = all A, 1 = all B
    float edge = smoothstep(k - .18, k + .18, n * .64 + .18 + (1. - vUv.y) * .2);
    vec3 a = texture2D(tA, vUv).rgb, b = texture2D(tB, vUv).rgb;
    vec3 c = mix(b, a, edge);
    float rim = smoothstep(.16, 0., abs(edge - .5)) * step(.001, uMix) * step(uMix, .999);
    gl_FragColor = vec4(c + vec3(1.2,.8,1.6) * rim * .35, 1.);
  }`;

  // ---------------------------------------------------------------- final grade: ACES, grain, vignette, slight chromatic fringe
  const GRADE = /* glsl */ `
  precision highp float; uniform sampler2D tDiffuse; uniform float uTime; uniform vec2 uRes; varying vec2 vUv;
  float hash12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
  vec3 aces(vec3 x){ return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14), 0., 1.); }
  void main(){
    vec2 d = vUv - .5; float r = dot(d,d);
    vec3 c; c.r = texture2D(tDiffuse, vUv - d*r*.012).r; c.g = texture2D(tDiffuse, vUv).g; c.b = texture2D(tDiffuse, vUv + d*r*.012).b;
    c = aces(c * 1.05);
    c *= 1. - r * .9;
    c = pow(c, vec3(1./2.2));
    c += (hash12(vUv * uRes + fract(uTime) * 91.7) - .5) * .06;
    gl_FragColor = vec4(c, 1.);
  }`;

  return { VERT, SKY, VOLCANO, FALLS, AURORA, OCEAN, CARDS, GALAXY_VERT, GALAXY_FRAG, MIX, GRADE };
})();
