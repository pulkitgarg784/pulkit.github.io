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

  function hexToRgb(hex) {
    const n = parseInt(hex.replace("#", ""), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

// Pallete and weights
  const BLOSSOM_COLORS = [
    hexToRgb("#f5b5a2"), // peach
    hexToRgb("#f0a888"), // deeper peach/pink
    hexToRgb("#f7d4c2"), // pale blossom pink
    hexToRgb("#e1ebbc"), // mint (sparse accent)
    hexToRgb("#e8b53a"), // gold (rare accent)
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

  const TRUNK_COLOR = hexToRgb("#7a5240"); // warm bark, distinct from ink/ui text

  let branches = [];
  let blossoms = [];

  function buildTree() {
    branches = [];
    blossoms = [];

    const MAX_DEPTH = 9;

    function grow(x, y, angle, length, depth, thickness) {
      const endX = x + Math.cos(angle) * length;
      const endY = y + Math.sin(angle) * length;

      const growStart = depth / (MAX_DEPTH + 1);
      const growEnd = (depth + 1) / (MAX_DEPTH + 1);
      branches.push({ x1: x, y1: y, x2: endX, y2: endY, thickness, depth, growStart, growEnd });

      if (depth >= MAX_DEPTH || length < 0.012) {
        const clusterCount = 1 + Math.floor(rng() * 3);
        for (let i = 0; i < clusterCount; i++) {
          const bx = endX + (rng() - 0.5) * 0.02;
          const by = endY + (rng() - 0.5) * 0.02;
          blossoms.push({
            x: bx,
            y: by,
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
        grow(endX, endY, childAngle, childLength, depth + 1, thickness * 0.68);
      }
    }

    grow(0, 0, -Math.PI / 2 + (rng() - 0.5) * 0.1, 0.32, 0, 0.018);
  }

  buildTree();

  let width = 0, height = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
  let originX = 0, originY = 0, scale = 1;

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
      // Returning to the tab: resume only if the hero is still on screen, and
      // reset frame timing so the paused gap doesn't trip the low-fps guard.
      isVisible = inViewport;
      lastFrameTime = performance.now();
    }
  });


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


  let rafId = null;
  let startTime = performance.now();
  let lastFrameTime = startTime;
  let lastSpawn = 0;
  let frameDrops = 0;

  const GROW_DURATION = 2.2;
  let growProgress = 0;

  function easeOut(x) { return 1 - Math.pow(1 - x, 3); }

  function drawBranch(b, t, dpiScale, swayAngle) {
    let g = 1;
    if (growProgress < 1) {
      g = (growProgress - b.growStart) / (b.growEnd - b.growStart);
      g = Math.max(0, Math.min(1, g));
      if (g <= 0) return; // not started drawing yet
    }

    const ex = b.x1 + (b.x2 - b.x1) * g;
    const ey = b.y1 + (b.y2 - b.y1) * g;

    const cos = Math.cos(swayAngle), sin = Math.sin(swayAngle);

    const rx1 = b.x1 * cos - b.y1 * sin;
    const ry1 = b.x1 * sin + b.y1 * cos;
    const rx2 = ex * cos - ey * sin;
    const ry2 = ex * sin + ey * cos;

    const x1 = originX + rx1 * scale;
    const y1 = originY + ry1 * scale;
    const x2 = originX + rx2 * scale;
    const y2 = originY + ry2 * scale;

    ctx.strokeStyle = `rgb(${TRUNK_COLOR.r}, ${TRUNK_COLOR.g}, ${TRUNK_COLOR.b})`;
    ctx.lineWidth = Math.max(1, b.thickness * scale * dpiScale);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function drawBlossom(bl, t, swayAngle) {
    const BLOSSOM_GROW_SPAN = 0.18;
    let g = (growProgress - bl.growStart) / BLOSSOM_GROW_SPAN;
    g = Math.max(0, Math.min(1, g));
    if (g <= 0) return;
    const grow = easeOut(g);

    const cos = Math.cos(swayAngle), sin = Math.sin(swayAngle);
    const rx = bl.x * cos - bl.y * sin;
    const ry = bl.x * sin + bl.y * cos;

    const wobble = Math.sin(t * bl.swaySpeed + bl.swayPhase) * 0.0015;

    let x = originX + (rx + wobble) * scale;
    let y = originY + ry * scale;

    const r = bl.r * scale * grow;
    if (r <= 0.2) return;

    ctx.beginPath();
    ctx.fillStyle = `rgb(${bl.color.r}, ${bl.color.g}, ${bl.color.b})`;
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPetal(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    const fade = 1 - Math.max(0, (p.life - p.maxLife * 0.7) / (p.maxLife * 0.3));
    ctx.globalAlpha = Math.max(0, Math.min(1, fade));
    ctx.fillStyle = `rgb(${p.color.r}, ${p.color.g}, ${p.color.b})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, p.r * dpr, p.r * 0.6 * dpr, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
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

    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < branches.length; i++) drawBranch(branches[i], t, dpr, swayAngle);
    for (let i = 0; i < blossoms.length; i++) drawBlossom(blossoms[i], t, swayAngle);

    if (growProgress >= 1) {
      if (t - lastSpawn > 0.1) {
        spawnPetal();
        lastSpawn = t;
      }
      for (let i = petals.length - 1; i >= 0; i--) {
        const p = petals[i];
        p.life += dt;
        p.x += p.vx * scale * 0.01 * dt * 20;
        p.y += p.vy * scale * 0.01 * dt * 20;
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
