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
      : visible + " of " + rows.length + " events";
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
  const timeline = document.getElementById("timeline");
  const passTabs = document.getElementById("passTabs");
  const railPasses = Array.from(document.querySelectorAll("#passList .event"));
  const channelBtns = Array.from(document.querySelectorAll(".channel"));

  const PASSES = [
    { name: "Depth", eid: 12 },
    { name: "Normals", eid: 18 },
    { name: "Albedo", eid: 24 },
    { name: "Ambient occlusion", eid: 31 },
    { name: "Lighting (HDR)", eid: 38 },
    { name: "Final (tonemapped)", eid: 45 }
  ];

  let pass = 5;
  const mask = [1, 1, 1, 0];

  // mobile pass tabs mirror the rail
  railPasses.forEach((b) => {
    const clone = b.cloneNode(true);
    passTabs.appendChild(clone);
  });
  const allPassBtns = Array.from(document.querySelectorAll("[data-pass]"));

  // timeline ticks
  const tlBar = document.createElement("div");
  tlBar.className = "timeline__bar";
  timeline.appendChild(tlBar);
  const minE = 10, maxE = 47;
  const ticks = PASSES.map((p, i) => {
    const t = document.createElement("button");
    t.type = "button";
    t.className = "timeline__tick";
    t.tabIndex = -1;
    t.style.left = "calc(12px + (100% - 24px) * " + ((p.eid - minE) / (maxE - minE)).toFixed(4) + ")";
    t.addEventListener("click", () => setPass(i));
    timeline.appendChild(t);
    return t;
  });
  const tlLabel = document.createElement("span");
  tlLabel.className = "timeline__label";
  timeline.appendChild(tlLabel);

  let requestRender = function () {};

  function setPass(i) {
    pass = i;
    allPassBtns.forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.pass === i)));
    ticks.forEach((t, k) => t.classList.toggle("is-current", k === i));
    tlLabel.style.left = ticks[i].style.left;
    tlLabel.textContent = "EID " + PASSES[i].eid;
    updateResLabel();
    requestRender();
  }

  allPassBtns.forEach((b) => b.addEventListener("click", () => setPass(+b.dataset.pass)));

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
    "float shadow(vec3 ro, vec3 rd){ float r=1.0, t=0.03; for(int i=0;i<40;i++){ float h=map(ro+rd*t).x; r=min(r,10.0*h/t); t+=clamp(h,0.02,0.25); if(r<0.002||t>8.0) break; } return clamp(r,0.0,1.0); }",
    "vec3 albedo(vec3 p, float m){",
    "  if(m<1.5){ float c = mod(floor(p.x*1.5)+floor(p.z*1.5),2.0); return mix(vec3(0.42,0.43,0.45), vec3(0.52,0.53,0.55), c); }",
    "  if(m<2.5) return vec3(0.86,0.36,0.24);",
    "  if(m<3.5) return vec3(0.18,0.62,0.58);",
    "  return vec3(0.85,0.80,0.70);",
    "}",
    "vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }",
    "void main(){",
    "  vec2 uv = (2.0*gl_FragCoord.xy-uRes)/uRes.y;",
    "  float a = 0.75 + uTime*0.07;",
    "  vec3 ta = vec3(0.05,0.55,0.15);",
    "  vec3 ro = ta + vec3(4.6*cos(a), 1.75, 4.6*sin(a));",
    "  vec3 ww = normalize(ta-ro); vec3 uu = normalize(cross(ww, vec3(0.0,1.0,0.0))); vec3 vv = cross(uu,ww);",
    "  vec3 rd = normalize(uv.x*uu + uv.y*vv + 2.1*ww);",
    "  vec2 h = march(ro, rd);",
    "  float hit = h.y > 0.0 ? 1.0 : 0.0;",
    "  vec3 bg = mix(vec3(0.055,0.06,0.07), vec3(0.11,0.12,0.135), clamp(uv.y*0.5+0.6,0.0,1.0));",
    "  vec3 col = vec3(0.0);",
    "  vec3 p = ro + rd*h.x;",
    "  vec3 n = hit > 0.5 ? calcNormal(p) : vec3(0.0);",
    "  if(uPass < 0.5){ col = vec3(hit * (1.0 - clamp(h.x/14.0,0.0,1.0))); }",
    "  else if(uPass < 1.5){ col = hit * (n*0.5+0.5); }",
    "  else if(uPass < 2.5){ col = hit * albedo(p, h.y); }",
    "  else if(uPass < 3.5){ col = vec3(hit > 0.5 ? calcAO(p,n) : 0.0); }",
    "  else {",
    "    vec3 lit = vec3(0.0);",
    "    if(hit > 0.5){",
    "      vec3 alb = albedo(p, h.y);",
    "      vec3 L = normalize(vec3(-0.55,0.75,-0.35));",
    "      float dif = clamp(dot(n,L),0.0,1.0) * shadow(p+n*0.002, L);",
    "      float ao = calcAO(p,n);",
    "      vec3 H = normalize(L-rd);",
    "      float spe = pow(clamp(dot(n,H),0.0,1.0), 48.0) * dif * (h.y < 1.5 ? 0.15 : 0.9);",
    "      float sky = clamp(0.5+0.5*n.y,0.0,1.0);",
    "      float rim = pow(clamp(1.0+dot(n,rd),0.0,1.0),3.0);",
    "      lit = alb*(vec3(3.2,2.85,2.4)*dif + vec3(0.30,0.38,0.52)*sky*ao + vec3(0.55,0.32,0.22)*rim*ao*0.6) + vec3(3.0,2.8,2.5)*spe;",
    "      float fog = 1.0-exp(-0.0035*h.x*h.x*h.x);",
    "      lit = mix(lit, bg, clamp(fog,0.0,1.0));",
    "    } else { lit = bg; }",
    "    if(uPass < 4.5){ col = lit; }",
    "    else {",
    "      col = aces(lit*0.9);",
    "      col = pow(col, vec3(1.0/2.2));",
    "      vec2 q = gl_FragCoord.xy/uRes; col *= 0.55 + 0.45*pow(16.0*q.x*q.y*(1.0-q.x)*(1.0-q.y), 0.18);",
    "    }",
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
