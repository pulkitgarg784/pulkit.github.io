(function () {
  "use strict";

  const mount = document.getElementById("heroField");
  if (!mount) return;

  function showStaticFallback(reason) {
    mount.classList.add("is-static");
    if (reason) mount.dataset.fallbackReason = reason;
  }

  const canvas = mount.querySelector("canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    showStaticFallback("no-canvas-2d");
    return;
  }


  function makeRng(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function () {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }
  const rng = makeRng(20240517);

  const BLOSSOM_COLORS = [
    "#f5b5a2",
    "#f0a888",
    "#f7d4c2",
    "#e1ebbc",
    "#e8b53a",
  ];
  const BLOSSOM_WEIGHTS = [0.34, 0.3, 0.24, 0.08, 0.04];

  function pickBlossomColor(r) {
    let acc = 0;
    for (let i = 0; i < BLOSSOM_WEIGHTS.length; i++) {
      acc += BLOSSOM_WEIGHTS[i];
      if (r < acc) return BLOSSOM_COLORS[i];
    }
    return BLOSSOM_COLORS[0];
  }

  const TRUNK_COLOR = "#7a5240";

  let branches = [];
  let blossoms = [];

  const MAX_DEPTH = 9;
  const WIND_MIN_DEPTH = MAX_DEPTH - 2;
  const WIND_DEPTH_SPAN = MAX_DEPTH - WIND_MIN_DEPTH + 1;

  function buildTree() {
    branches = [];
    blossoms = [];

    function grow(x, y, angle, length, depth, thickness, parentIndex) {
      const endX = x + Math.cos(angle) * length;
      const endY = y + Math.sin(angle) * length;

      const growStart = depth / (MAX_DEPTH + 1);
      const growEnd = (depth + 1) / (MAX_DEPTH + 1);
      const isTip = depth >= MAX_DEPTH || length < 0.012;
      const windy = depth >= WIND_MIN_DEPTH;
      const branch = {
        x1: x, y1: y, x2: endX, y2: endY, thickness, depth, growStart, growEnd,
        parentIndex: parentIndex === undefined ? -1 : parentIndex,
        windy,
        windFactor: windy ? (depth - WIND_MIN_DEPTH + 1) / WIND_DEPTH_SPAN : 0,
        rustle: 0,
        bendX: 0,
        bendY: 0,
        sox: 0, soy: 0, eox: 0, eoy: 0,
        rustlePhase: rng() * Math.PI * 2,
        rustleSpeed: 0.75 + rng() * 0.55,
        rustleGain: 0.6 + rng() * 0.7,
      };
      const branchIndex = branches.length;
      branches.push(branch);

      if (isTip) {
        const clusterCount = 1 + Math.floor(rng() * 3);
        for (let i = 0; i < clusterCount; i++) {
          const bx = endX + (rng() - 0.5) * 0.006;
          const by = endY + (rng() - 0.5) * 0.006;
          blossoms.push({
            x: bx,
            y: by,
            branchIndex,
            r: 0.006 + rng() * 0.01,
            color: pickBlossomColor(rng()),
            swayPhase: rng() * Math.PI * 2,
            swaySpeed: 0.4 + rng() * 0.5,
            growStart: Math.min(0.8, growStart + (Math.abs(bx * 53.17 + by * 71.31) % 0.06)),
          });
        }
        return;
      }

      const numChildren = rng() < 0.22 ? 3 : 2;
      for (let i = 0; i < numChildren; i++) {
        const spread = (rng() * 0.5 + 0.35) * (i % 2 === 0 ? 1 : -1) * (numChildren === 3 ? 0.75 : 1);
        const childAngle = angle + spread + (rng() - 0.5) * 0.15;
        const childLength = length * (0.72 + rng() * 0.14);
        grow(endX, endY, childAngle, childLength, depth + 1, thickness * 0.68, branchIndex);
      }
    }

    grow(0, 0, -Math.PI / 2 + (rng() - 0.5) * 0.1, 0.32, 0, 0.018, -1);
  }

  buildTree();

  const WIND_FALLOFF = 3.2;
  const GUST_ATTACK = 10;
  const GUST_DECAY = 2.2;
  const RUSTLE_FREQ = 15;
  const PETAL_WIND = 260;

  let width = 0, height = 0;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let originX = 0, originY = 0, scale = 1;

  let windRef = 0;
  let gustRadius = 0;
  let rustleAmp = 0;
  let bendAmp = 0;

  function resize() {
    const rect = mount.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width * dpr));
    height = Math.max(1, Math.round(rect.height * dpr));
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = rect.width + "px";
    canvas.style.height = rect.height + "px";

    const isNarrow = rect.width < 780;
    if (isNarrow) {
      originX = width * 0.86;
      originY = height * 1.01;
      scale = height * 0.45;
    } else {
      originX = width * 0.9;
      originY = height * 1.01;
      scale = height * 0.9;
    }

    windRef = 900 * dpr;
    gustRadius = Math.max(90 * dpr, height * 0.22);
    rustleAmp = Math.max(2.5 * dpr, height * 0.009);
    bendAmp = Math.max(5 * dpr, height * 0.02);
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(mount);
  resize();

  let isVisible = true;
  let inViewport = true;
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        inViewport = e.isIntersecting;
        isVisible = inViewport && !document.hidden;
      });
    },
    { threshold: 0.05 }
  );
  io.observe(mount);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      isVisible = false;
    } else {
      isVisible = inViewport;
      lastFrameTime = performance.now();
    }
  });

  const pointer = { x: 0, y: 0, vx: 0, vy: 0, active: false, seen: false, lastMove: 0 };

  function updatePointer(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const nx = (clientX - rect.left) * (width / rect.width);
    const ny = (clientY - rect.top) * (height / rect.height);
    const now = performance.now();

    if (pointer.seen) {
      const dtMove = Math.max(0.004, Math.min(0.1, (now - pointer.lastMove) / 1000));
      const ivx = (nx - pointer.x) / dtMove;
      const ivy = (ny - pointer.y) / dtMove;
      pointer.vx += (ivx - pointer.vx) * 0.35;
      pointer.vy += (ivy - pointer.vy) * 0.35;
    }

    pointer.x = nx;
    pointer.y = ny;
    pointer.lastMove = now;
    pointer.seen = true;
    pointer.active = true;
  }

  window.addEventListener("pointermove", (e) => updatePointer(e.clientX, e.clientY), { passive: true });
  window.addEventListener("pointerdown", (e) => updatePointer(e.clientX, e.clientY), { passive: true });
  document.addEventListener("pointerleave", () => { pointer.active = false; });
  window.addEventListener("blur", () => { pointer.active = false; });

  // petals
  const MAX_PETALS = 40;
  const petals = [];

  function spawnPetal() {
    if (petals.length >= MAX_PETALS || blossoms.length === 0) return;
    const source = blossoms[Math.floor(rng() * blossoms.length)];
    petals.push({
      x: originX + source.x * scale,
      y: originY + source.y * scale,
      vx: (rng() - 0.5) * 0.15,
      vy: 0.25 + rng() * 0.25,
      rot: rng() * Math.PI * 2,
      rotSpeed: (rng() - 0.5) * 1.2,
      r: 2.5 + rng() * 2,
      color: pickBlossomColor(rng()),
      life: 0,
      maxLife: 8 + rng() * 6,
    });
  }

  function smoothstep(x) {
    const c = Math.max(0, Math.min(1, x));
    return c * c * (3 - 2 * c);
  }

  const windVec = { dx: 0, dy: 0, strength: 0 };

  function stepWind(dt, t, cos, sin) {
    const fade = Math.exp(-WIND_FALLOFF * dt);
    pointer.vx *= fade;
    pointer.vy *= fade;

    const speed = Math.hypot(pointer.vx, pointer.vy);
    const gustStrength = pointer.active ? Math.min(1, speed / windRef) : 0;
    const wdx = speed > 1 ? pointer.vx / speed : 0;
    const wdy = speed > 1 ? pointer.vy / speed : 0;

    windVec.dx = wdx;
    windVec.dy = wdy;
    windVec.strength = gustStrength;

    for (let i = 0; i < branches.length; i++) {
      const b = branches[i];

      const parent = b.parentIndex >= 0 ? branches[b.parentIndex] : null;
      b.sox = parent ? parent.eox : 0;
      b.soy = parent ? parent.eoy : 0;

      if (!b.windy) {
        b.eox = b.sox;
        b.eoy = b.soy;
        continue;
      }

      let gust = 0;
      if (gustStrength > 0.001) {
        const rx = b.x2 * cos - b.y2 * sin;
        const ry = b.x2 * sin + b.y2 * cos;
        const sx = originX + rx * scale + b.sox;
        const sy = originY + ry * scale + b.soy;
        const dx = sx - pointer.x;
        const dy = sy - pointer.y;
        const dist = Math.hypot(dx, dy);
        if (dist < gustRadius) {
          const reach = smoothstep(1 - dist / gustRadius);
          const along = dist > 0.001 ? (dx / dist) * wdx + (dy / dist) * wdy : 0;
          const bias = 0.65 + 0.45 * Math.max(0, along);
          gust = reach * gustStrength * bias * b.rustleGain;
        }
      }

      const rate = gust > b.rustle ? GUST_ATTACK : GUST_DECAY;
      b.rustle += (gust - b.rustle) * Math.min(1, rate * dt);
      if (b.rustle < 0.0005) b.rustle = 0;

      const lean = b.rustle * bendAmp * b.windFactor;
      b.bendX += (wdx * lean - b.bendX) * Math.min(1, 6 * dt);
      b.bendY += (wdy * lean - b.bendY) * Math.min(1, 6 * dt);

      let jx = 0, jy = 0;
      if (b.rustle > 0.001) {
        const intensity = b.rustle * (0.45 + 0.55 * b.rustle);
        const amp = rustleAmp * intensity * b.windFactor;
        const w = RUSTLE_FREQ * b.rustleSpeed;
        const p = b.rustlePhase;
        jx = (Math.sin(t * w + p) * 0.65 + Math.sin(t * w * 2.37 + p * 1.7) * 0.35) * amp;
        jy = (Math.sin(t * w * 1.19 + p * 1.3) * 0.6 + Math.sin(t * w * 2.71 + p * 0.6) * 0.4) * amp * 0.6;
      }

      b.eox = b.sox + b.bendX + jx;
      b.eoy = b.soy + b.bendY + jy;
    }
  }


  let rafId = null;
  let startTime = performance.now();
  let lastFrameTime = startTime;
  let lastSpawn = 0;
  let frameDrops = 0;

  const GROW_DURATION = 2.2;
  let growProgress = 0;

  function easeOut(x) { return 1 - Math.pow(1 - x, 3); }

  function drawBranch(b, cos, sin) {
    let g = 1;
    if (growProgress < 1) {
      g = (growProgress - b.growStart) / (b.growEnd - b.growStart);
      g = Math.max(0, Math.min(1, g));
      if (g <= 0) return; // not started drawing yet
    }

    const ex = b.x1 + (b.x2 - b.x1) * g;
    const ey = b.y1 + (b.y2 - b.y1) * g;

    const rx1 = b.x1 * cos - b.y1 * sin;
    const ry1 = b.x1 * sin + b.y1 * cos;
    const rx2 = ex * cos - ey * sin;
    const ry2 = ex * sin + ey * cos;

    const x1 = originX + rx1 * scale + b.sox;
    const y1 = originY + ry1 * scale + b.soy;

    const x2 = originX + rx2 * scale + (b.sox + (b.eox - b.sox) * g);
    const y2 = originY + ry2 * scale + (b.soy + (b.eoy - b.soy) * g);

    ctx.lineWidth = Math.max(1, b.thickness * scale * dpr);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function drawBlossom(bl, t, cos, sin) {
    const BLOSSOM_GROW_SPAN = 0.18;
    let g = (growProgress - bl.growStart) / BLOSSOM_GROW_SPAN;
    g = Math.max(0, Math.min(1, g));
    if (g <= 0) return;
    const grow = easeOut(g);

    const r = bl.r * scale * grow;
    if (r <= 0.2) return;

    const rx = bl.x * cos - bl.y * sin;
    const ry = bl.x * sin + bl.y * cos;

    const wobble = Math.sin(t * bl.swaySpeed + bl.swayPhase) * 0.0015;

    let x = originX + (rx + wobble) * scale;
    let y = originY + ry * scale;

    const parent = branches[bl.branchIndex];
    if (parent) {
      x += parent.eox;
      y += parent.eoy;
    }

    ctx.beginPath();
    ctx.fillStyle = bl.color;
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPetal(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    const fade = 1 - Math.max(0, (p.life - p.maxLife * 0.7) / (p.maxLife * 0.3));
    ctx.globalAlpha = Math.max(0, Math.min(1, fade));
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, p.r * dpr, p.r * 0.6 * dpr, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function frame(now) {
    rafId = requestAnimationFrame(frame);
    if (!isVisible) return;

    const dt = (now - lastFrameTime) / 1000;
    if (now - lastFrameTime > 40) {
      frameDrops++;
      if (frameDrops > 90) {
        showStaticFallback("sustained-low-fps");
        cancelAnimationFrame(rafId);
        return;
      }
    } else if (frameDrops > 0) {
      frameDrops = Math.max(0, frameDrops - 1);
    }
    lastFrameTime = now;

    const t = (now - startTime) / 1000;

    if (growProgress < 1) {
      growProgress = Math.min(1, easeOut(t / GROW_DURATION));
    }

    const swayAngle = Math.sin(t * 0.35) * 0.025;
    const cos = Math.cos(swayAngle), sin = Math.sin(swayAngle);

    stepWind(Math.min(dt, 0.05), t, cos, sin);

    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = TRUNK_COLOR;
    ctx.lineCap = "round";
    for (let i = 0; i < branches.length; i++) drawBranch(branches[i], cos, sin);
    for (let i = 0; i < blossoms.length; i++) drawBlossom(blossoms[i], t, cos, sin);

    if (growProgress >= 1) {
      if (t - lastSpawn > 0.1) {
        spawnPetal();
        lastSpawn = t;
      }
      const petalReach = gustRadius * 1.6;
      for (let i = petals.length - 1; i >= 0; i--) {
        const p = petals[i];
        p.life += dt;
        p.x += p.vx * scale * 0.01 * dt * 20;
        p.y += p.vy * scale * 0.01 * dt * 20;

        if (windVec.strength > 0.01) {
          const gd = Math.hypot(p.x - pointer.x, p.y - pointer.y);
          if (gd < petalReach) {
            const w = smoothstep(1 - gd / petalReach) * windVec.strength;
            const drift = PETAL_WIND * w * dt;
            p.x += windVec.dx * drift;
            p.y += windVec.dy * drift;
            p.rot += w * dt * 2.5;
          }
        }

        p.rot += p.rotSpeed * dt;
        if (p.life >= p.maxLife || p.y > height + 40) {
          petals.splice(i, 1);
          continue;
        }
        drawPetal(p);
      }
    }
  }

  const startObserver = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          startTime = performance.now();
          lastFrameTime = startTime;
          rafId = requestAnimationFrame(frame);
          obs.disconnect();
        }
      });
    },
    { threshold: 0 }
  );
  startObserver.observe(mount);

  window.addEventListener("beforeunload", () => {
    if (rafId) cancelAnimationFrame(rafId);
  });
})();
