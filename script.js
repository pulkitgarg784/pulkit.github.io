(function () {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- project filters ---------- */

  const filters = Array.from(document.querySelectorAll(".filter"));
  const rows = Array.from(document.querySelectorAll("#projectsList .trow"));
  const statusRegion = document.getElementById("projectsStatus");
  const emptyState = document.getElementById("projectsEmpty");

  function applyFilter(filter) {
    let visible = 0;
    rows.forEach((row) => {
      const tags = (row.dataset.tags || "").split(" ");
      const show = filter === "all" || tags.includes(filter);
      row.classList.toggle("is-hidden", !show);
      if (show) visible++;
    });
    emptyState.classList.toggle("is-visible", visible === 0);
    statusRegion.textContent = visible === 0
      ? "No projects match this filter."
      : visible + " of " + rows.length + " projects";
  }

  filters.forEach((btn) => {
    btn.addEventListener("click", () => {
      filters.forEach((f) => f.setAttribute("aria-pressed", "false"));
      btn.setAttribute("aria-pressed", "true");
      applyFilter(btn.dataset.filter);
    });
  });

  /* ---------- document markers follow the scroll ---------- */

  const markers = Array.from(document.querySelectorAll("#markerList .event"));
  const sections = markers.map((a) => document.querySelector(a.getAttribute("href"))).filter(Boolean);

  if ("IntersectionObserver" in window && sections.length) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const id = "#" + entry.target.id;
        markers.forEach((m) => m.setAttribute("aria-current", m.getAttribute("href") === id ? "true" : "false"));
      });
    }, { rootMargin: "-40% 0px -55% 0px" });
    sections.forEach((s) => spy.observe(s));
  }

  /* ---------- texture viewer: a real ray-marched frame ---------- */

  const viewer = document.querySelector(".viewer");
  const canvas = document.getElementById("gl");
  const resLabel = document.getElementById("viewerRes");
  const pixelPos = document.getElementById("pixelPos");
  const pixelVal = document.getElementById("pixelVal");
  const pixelSwatch = document.getElementById("pixelSwatch");
  const frameTimeEl = document.getElementById("frameTime");
  const channelBtns = Array.from(document.querySelectorAll(".channel"));

  const PASSES = [
    { name: "Depth" },
    { name: "Normals" },
    { name: "Albedo" },
    { name: "Ambient occlusion" },
    { name: "Lighting" }
  ];

  let pass = 4;
  const mask = [1, 1, 1, 0];

  // pass scrubber: a range input that snaps to each pass
  const scrub = document.getElementById("passScrub");
  const scrubTicks = document.getElementById("scrubTicks");
  const SHORT = ["Depth", "Normals", "Albedo", "AO", "Lighting"];
  scrub.max = String(PASSES.length - 1);
  const ticks = SHORT.map((label, i) => {
    const li = document.createElement("li");
    li.style.setProperty("--i", String(i / (PASSES.length - 1)));
    li.textContent = label;
    li.addEventListener("click", () => setPass(i));
    scrubTicks.appendChild(li);
    return li;
  });

  scrub.addEventListener("input", () => setPass(+scrub.value));
  scrub.addEventListener("pointerdown", () => scrub.classList.add("is-dragging"));
  window.addEventListener("pointerup", () => scrub.classList.remove("is-dragging"));

  let requestRender = function () {};

  function setPass(i) {
    pass = i;
    ticks.forEach((t, k) => t.classList.toggle("is-current", k === i));
    if (+scrub.value !== i) scrub.value = String(i);
    scrub.setAttribute("aria-valuetext", PASSES[i].name);
    scrub.style.setProperty("--p", String(i / (PASSES.length - 1)));
    updateResLabel();
    requestRender();
  }

  channelBtns.forEach((b) => {
    b.addEventListener("click", () => {
      const ch = +b.dataset.ch;
      mask[ch] = mask[ch] ? 0 : 1;
      b.setAttribute("aria-pressed", String(!!mask[ch]));
      requestRender();
    });
  });

  let rw = 0, rh = 0;
  function updateResLabel() {
    resLabel.textContent = PASSES[pass].name + (rw ? " · " + rw + "×" + rh : "");
  }

  setPass(pass);

  const gl = canvas && canvas.getContext("webgl", { antialias: false, alpha: false, preserveDrawingBuffer: false, powerPreference: "low-power" });
  if (!gl) { viewer.classList.add("is-nogl"); return; }

  const VS = "attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }";
  const FS = [
    "precision highp float;",
    "uniform vec2 uRes; uniform float uTime; uniform float uPass; uniform vec4 uMask;",
    "mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }",
    "float sdBox(vec3 p, vec3 b, float r){ vec3 q=abs(p)-b; return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0)-r; }",
    "float sdTorus(vec3 p, vec2 t){ vec2 q=vec2(length(p.xz)-t.x,p.y); return length(q)-t.y; }",
    "vec2 map(vec3 p){",
    "  vec2 res = vec2(p.y, 1.0);",
    "  float s = length(p-vec3(-1.25,0.72,0.1))-0.72; if(s<res.x) res=vec2(s,2.0);",
    "  vec3 q = p-vec3(0.25,0.62,1.15); q.yz = rot(1.25)*q.yz; q.xy = rot(uTime*0.35)*q.xy;",
    "  float t = sdTorus(q, vec2(0.48,0.17)); if(t<res.x) res=vec2(t,3.0);",
    "  vec3 b = p-vec3(1.35,0.52,-0.55); b.xz = rot(0.6+uTime*0.2)*b.xz;",
    "  float bx = sdBox(b, vec3(0.42), 0.09); if(bx<res.x) res=vec2(bx,4.0);",
    "  return res;",
    "}",
    "vec2 march(vec3 ro, vec3 rd){ float t=0.02; float m=-1.0; for(int i=0;i<96;i++){ vec2 h=map(ro+rd*t); if(h.x<0.0008*t){ m=h.y; break;} t+=h.x; if(t>24.0) break; } return vec2(t,m); }",
    "vec3 calcNormal(vec3 p){ vec2 e=vec2(1.0,-1.0)*0.0006; return normalize(e.xyy*map(p+e.xyy).x+e.yyx*map(p+e.yyx).x+e.yxy*map(p+e.yxy).x+e.xxx*map(p+e.xxx).x); }",
    "float calcAO(vec3 p, vec3 n){ float o=0.0, s=1.0; for(int i=0;i<5;i++){ float h=0.02+0.12*float(i); o+=(h-map(p+n*h).x)*s; s*=0.85; } return clamp(1.0-2.2*o,0.0,1.0); }",
    "float shadow(vec3 ro, vec3 rd){ float r=1.0, t=0.03; for(int i=0;i<48;i++){ float h=map(ro+rd*t).x; r=min(r,8.0*h/t); t+=clamp(h,0.02,0.25); if(r<0.002||t>8.0) break; } return smoothstep(0.0,1.0,clamp(r,0.0,1.0)); }",
    "vec2 marchRefl(vec3 ro, vec3 rd){ float t=0.02; float m=-1.0; for(int i=0;i<48;i++){ vec2 h=map(ro+rd*t); if(h.x<0.002*t){ m=h.y; break;} t+=h.x; if(t>12.0) break; } return vec2(t,m); }",
    "vec3 albedo(vec3 p, float m){",
    "  if(m<1.5){ float c = mod(floor(p.x*1.25)+floor(p.z*1.25),2.0); return mix(vec3(0.30,0.29,0.28), vec3(0.37,0.36,0.345), c); }",
    "  if(m<2.5) return vec3(0.78,0.24,0.13);",
    "  if(m<3.5) return vec3(0.04,0.48,0.46);",
    "  return vec3(0.80,0.76,0.68);",
    "}",
    "float roughness(float m){ return m<1.5 ? 0.38 : m<2.5 ? 0.42 : m<3.5 ? 0.18 : 0.75; }",
    "const vec3 SUN_DIR = vec3(-0.5345, 0.7483, -0.3926);",
    "const vec3 SUN = vec3(2.9, 2.6, 2.25);",
    "vec3 env(vec3 d){ return mix(vec3(0.045,0.045,0.05), vec3(0.62,0.66,0.72), smoothstep(-0.25, 1.0, d.y)); }",
    "vec3 cheapShade(vec3 p, vec3 n, float m){",
    "  vec3 alb = albedo(p, m);",
    "  return alb * (SUN*clamp(dot(n,SUN_DIR),0.0,1.0) + env(n)*0.6);",
    "}",
    "vec3 shade(vec3 p, vec3 n, vec3 rd, float m){",
    "  vec3 alb = albedo(p, m);",
    "  float r = roughness(m); float a = r*r; float a2 = a*a;",
    "  vec3 V = -rd; vec3 L = SUN_DIR; vec3 H = normalize(L+V);",
    "  float NdL = clamp(dot(n,L),0.0,1.0); float NdV = clamp(dot(n,V),0.001,1.0);",
    "  float NdH = clamp(dot(n,H),0.0,1.0); float VdH = clamp(dot(V,H),0.0,1.0);",
    "  float F0 = 0.04;",
    "  float F = F0 + (1.0-F0)*pow(1.0-VdH, 5.0);",
    "  float dn = NdH*NdH*(a2-1.0)+1.0; float D = a2/(3.14159*dn*dn);",
    "  float k = (r+1.0)*(r+1.0)/8.0; float G = (NdL/(NdL*(1.0-k)+k))*(NdV/(NdV*(1.0-k)+k));",
    "  float spec = D*G*F/(4.0*NdL*NdV+0.001);",
    "  float sh = NdL > 0.0 ? shadow(p+n*0.003, L) : 0.0;",
    "  vec3 direct = (alb*(1.0-F) + vec3(spec)*3.14159) * SUN * NdL * sh;",
    "  float ao = calcAO(p, n);",
    "  vec3 ambient = alb * (env(n)*0.85 + vec3(0.22,0.18,0.15)*clamp(-n.y*0.5+0.5,0.0,1.0)*0.35) * ao;",
    "  float Fr = F0 + (1.0-F0)*pow(1.0-NdV, 5.0)*(1.0-r)*(1.0-r);",
    "  vec3 R = reflect(rd, n);",
    "  vec3 refl = env(R);",
    "  if(r < 0.5){",
    "    vec2 rh = marchRefl(p + n*0.01, R);",
    "    if(rh.y > 0.0){ vec3 rp = p + n*0.01 + R*rh.x; refl = cheapShade(rp, calcNormal(rp), rh.y); }",
    "  }",
    "  return direct + ambient + refl*Fr*mix(1.0, ao, 0.6);",
    "}",
    "// AgX tone mapping and contrast curve",
    "vec3 agxContrast(vec3 x){ vec3 x2=x*x; vec3 x4=x2*x2; return 15.5*x4*x2 - 40.14*x4*x + 31.96*x4 - 6.868*x2*x + 0.4298*x2 + 0.1191*x - 0.00232; }",
    "vec3 agx(vec3 v){",
    "  const mat3 m = mat3(0.842479062253094, 0.0423282422610123, 0.0423756549057051, 0.0784335999999992, 0.878468636469772, 0.0784336, 0.0792237451477643, 0.0791661274605434, 0.879142973793104);",
    "  v = m*v;",
    "  v = clamp(log2(max(v, vec3(1e-10))), -12.47393, 4.026069);",
    "  v = (v + 12.47393) / 16.5;",
    "  return agxContrast(v);",
    "}",
    "vec3 agxLook(vec3 v){",
    "  v = pow(max(v, 0.0), vec3(1.15));",
    "  float l = dot(v, vec3(0.2126, 0.7152, 0.0722));",
    "  return l + 1.2*(v - l);",
    "}",
    "vec3 agxEotf(vec3 v){",
    "  const mat3 mi = mat3(1.19687900512017, -0.0528968517574562, -0.0529716355144438, -0.0980208811401368, 1.15190312990417, -0.0980434501171241, -0.0990297440797205, -0.0989611768448433, 1.15107367264116);",
    "  return mi*v;",
    "}",
    "void main(){",
    "  vec2 uv = (2.0*gl_FragCoord.xy-uRes)/uRes.y;",
    "  float a = 0.75 + uTime*0.07;",
    "  vec3 ta = vec3(0.05,0.55,0.15);",
    "  vec3 ro = ta + vec3(4.6*cos(a), 1.75, 4.6*sin(a));",
    "  vec3 ww = normalize(ta-ro); vec3 uu = normalize(cross(ww, vec3(0.0,1.0,0.0))); vec3 vv = cross(uu,ww);",
    "  vec3 rd = normalize(uv.x*uu + uv.y*vv + 2.1*ww);",
    "  vec2 h = march(ro, rd);",
    "  float hit = h.y > 0.0 ? 1.0 : 0.0;",
    "  vec3 bg = env(rd)*0.28;",
    "  vec3 col = vec3(0.0);",
    "  vec3 p = ro + rd*h.x;",
    "  vec3 n = hit > 0.5 ? calcNormal(p) : vec3(0.0);",
    "  if(uPass < 0.5){ col = vec3(hit * (1.0 - clamp(h.x/14.0,0.0,1.0))); }",
    "  else if(uPass < 1.5){ col = hit * (n*0.5+0.5); }",
    "  else if(uPass < 2.5){ col = hit * albedo(p, h.y); }",
    "  else if(uPass < 3.5){ col = vec3(hit > 0.5 ? calcAO(p,n) : 0.0); }",
    "  else {",
    "    vec3 lit = bg;",
    "    if(hit > 0.5){",
    "      lit = shade(p, n, rd, h.y);",
    "      float fog = 1.0-exp(-0.0025*h.x*h.x*h.x);",
    "      lit = mix(lit, bg, clamp(fog,0.0,1.0));",
    "    }",
    "    col = agxEotf(agxLook(agx(lit*1.35)));",
    "    col = clamp(col, 0.0, 1.0);",
    "    vec2 q = gl_FragCoord.xy/uRes; col *= 0.82 + 0.18*pow(16.0*q.x*q.y*(1.0-q.x)*(1.0-q.y), 0.25);",
    "  }",
    "  vec4 c = vec4(col, hit);",
    "  float nm = dot(uMask, vec4(1.0));",
    "  vec2 cell = floor(gl_FragCoord.xy/8.0);",
    "  vec3 checker = vec3(mod(cell.x+cell.y,2.0) < 1.0 ? 0.16 : 0.22);",
    "  vec3 outc;",
    "  if(nm < 0.5) outc = vec3(0.0);",
    "  else if(nm < 1.5) outc = vec3(dot(c, uMask));",
    "  else { outc = c.rgb*uMask.rgb; if(uMask.a > 0.5) outc = mix(checker, outc, c.a); }",
    "  gl_FragColor = vec4(outc, 1.0);",
    "}"
  ].join("\n");

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  const vs = compile(gl.VERTEX_SHADER, VS);
  const fs = compile(gl.FRAGMENT_SHADER, FS);
  const prog = gl.createProgram();
  if (!vs || !fs) { viewer.classList.add("is-nogl"); return; }
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { viewer.classList.add("is-nogl"); return; }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, "uRes");
  const uTime = gl.getUniformLocation(prog, "uTime");
  const uPass = gl.getUniformLocation(prog, "uPass");
  const uMask = gl.getUniformLocation(prog, "uMask");

  let scale = 0.85;
  function resize() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    rw = Math.max(1, Math.round(r.width * dpr * scale));
    rh = Math.max(1, Math.round(r.height * dpr * scale));
    canvas.width = rw;
    canvas.height = rh;
    gl.viewport(0, 0, rw, rh);
    updateResLabel();
    requestRender();
  }
  new ResizeObserver(resize).observe(canvas);

  // pixel picking
  let pick = null;
  const px = new Uint8Array(4);
  canvas.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    pick = {
      x: Math.floor((e.clientX - r.left) / r.width * rw),
      y: Math.floor((e.clientY - r.top) / r.height * rh)
    };
    requestRender();
  });
  canvas.addEventListener("pointerleave", () => {
    pick = null;
    pixelPos.textContent = "Hover the image to read a pixel";
    pixelVal.textContent = "";
    pixelSwatch.style.background = "transparent";
  });

  function readPick() {
    if (!pick) return;
    const x = Math.min(rw - 1, Math.max(0, pick.x));
    const y = Math.min(rh - 1, Math.max(0, pick.y));
    gl.readPixels(x, rh - 1 - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    pixelPos.textContent = "x " + x + "  y " + y;
    pixelVal.textContent = [px[0], px[1], px[2]].map((v) => (v / 255).toFixed(3)).join("  ");
    pixelSwatch.style.background = "rgb(" + px[0] + "," + px[1] + "," + px[2] + ")";
  }

  const t0 = performance.now();
  let frozenTime = 3.0;
  function draw(now) {
    const t = reduceMotion ? frozenTime : (now - t0) / 1000;
    gl.uniform2f(uRes, rw, rh);
    gl.uniform1f(uTime, t);
    gl.uniform1f(uPass, pass);
    gl.uniform4f(uMask, mask[0], mask[1], mask[2], mask[3]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    readPick();
  }

  // animation loop, paused when hidden; static when reduced motion
  let visible = true;
  let raf = 0;
  let last = 0, avg = 16.7, slow = 0;

  function loop(now) {
    raf = 0;
    if (!visible || document.hidden) return;
    if (last) {
      const dt = now - last;
      avg += (dt - avg) * 0.05;
      if (avg > 45) slow++; else slow = Math.max(0, slow - 1);
      if (slow > 120 && scale > 0.45) { scale = 0.45; slow = 0; resize(); }
    }
    last = now;
    draw(now);
    frameTimeEl.textContent = "frame " + avg.toFixed(1) + " ms";
    raf = requestAnimationFrame(loop);
  }

  if (reduceMotion) {
    requestRender = function () { if (!raf) raf = requestAnimationFrame((n) => { raf = 0; draw(n); }); };
    frameTimeEl.textContent = "static frame";
  } else {
    requestRender = function () { if (!raf && visible && !document.hidden) { last = 0; raf = requestAnimationFrame(loop); } };
  }

  new IntersectionObserver((entries) => {
    entries.forEach((e) => { visible = e.isIntersecting; });
    requestRender();
  }).observe(canvas);
  document.addEventListener("visibilitychange", requestRender);

  resize();
  requestRender();
})();
