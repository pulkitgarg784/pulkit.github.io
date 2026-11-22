(function () {
  "use strict";

  const canvas = document.getElementById("networkCanvas");
  const wiresSvg = document.getElementById("networkWires");
  const network = document.getElementById("network");
  const paramsIcon = document.getElementById("paramsIcon");
  const paramsType = document.getElementById("paramsType");
  const paramsName = document.getElementById("paramsName");
  const paramsBody = document.getElementById("paramsBody");
  const statusRegion = document.getElementById("projectsStatus");
  const emptyState = document.getElementById("projectsEmpty");
  const rows = Array.from(document.querySelectorAll("#projectsList .row"));
  const filters = Array.from(document.querySelectorAll(".filter"));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!canvas || !wiresSvg) return;

  const SVG_NS = "http://www.w3.org/2000/svg";
  const ICONS = {
    out: '<circle cx="10" cy="10" r="6.5"/><circle cx="10" cy="10" r="2.2"/>',
    merge: '<path d="M4 3.5v3.2c0 2.2 1.6 3.3 3.2 3.9L10 11.7V17M16 3.5v3.2c0 2.2-1.6 3.3-3.2 3.9L10 11.7"/>',
    exp: '<rect x="3" y="6.5" width="14" height="10" rx="1.5"/><path d="M7.5 6.5V4.3h5v2.2M3 10.5h14"/>',
    project: '<path d="M10 2.8l6.5 3.7v7L10 17.2l-6.5-3.7v-7z"/><path d="M3.5 6.5L10 10.2l6.5-3.7M10 10.2v7"/>'
  };

  /* ---------- data model: one source for graph, pane, and list ---------- */

  const experience = [
    {
      id: "sidefx_viewport", title: "SideFX", role: "Graphics Programming Intern", when: "Now",
      stack: "Vulkan",
      text: "Performance-critical, cross-platform rendering for Houdini. Built core Vulkan viewport functionality, including multiple Vulkan libraries and a GPU text-rendering pipeline using bitmap fonts and texture atlases.",
      links: [{ label: "sidefx.com", href: "https://www.sidefx.com" }]
    },
    {
      id: "sidefx_rnd", title: "SideFX R&D",
      text: "Improved high-precision data imports, mesh-decimation algorithms, and real-time modeling workflows.",
      links: [{ label: "sidefx.com", href: "https://www.sidefx.com" }]
    },
    {
      id: "liftwerx", title: "Liftwerx",
      text: "Built VR training software for wind-turbine technicians.",
      links: [{ label: "liftwerx.com", href: "https://liftwerx.com" }]
    },
    {
      id: "ford", title: "Ford Motor Company",
      stack: "C++, Kotlin, Google Filament",
      text: "Worked on Android Automotive OS and real-time 3D vehicle visualization."
    },
    {
      id: "sojourn", title: "Sojourn Interactive", role: "Founder and lead", when: "2019-2023",
      stack: "Unity",
      text: "Founded and led a game studio in high school, focused on socially impactful games.",
      links: [{ label: "sojourngames.xyz", href: "https://sojourngames.xyz" }]
    }
  ];

  const groups = [
    { id: "experience", kind: "exp" },
    { id: "graphics", kind: "graphics" },
    { id: "games", kind: "games" },
    { id: "apps", kind: "apps" }
  ];

  const nodes = new Map();
  const edges = [];

  function addNode(n) { nodes.set(n.id, n); return n; }

  experience.forEach((e) => addNode({ ...e, type: "exp", group: "experience", label: e.id }));

  rows.forEach((row) => {
    const linkEls = Array.from(row.querySelectorAll(".row__links a"));
    addNode({
      id: row.dataset.node,
      type: "project",
      group: row.dataset.group,
      label: row.dataset.node,
      title: row.querySelector(".row__select").textContent.trim(),
      tags: (row.dataset.tags || "").split(" ").filter(Boolean),
      text: row.querySelector(".row__desc").textContent.trim(),
      links: linkEls.map((a) => ({ label: a.textContent.trim(), href: a.getAttribute("href") })),
      row
    });
  });

  groups.forEach((g) => addNode({ id: g.id, type: "merge", group: g.id, kind: g.kind, label: g.id }));
  addNode({ id: "pulkit_garg", type: "out", label: "pulkit_garg" });

  nodes.forEach((n) => {
    if (n.type === "exp" || n.type === "project") edges.push({ from: n.id, to: n.group });
  });
  groups.forEach((g) => edges.push({ from: g.id, to: "pulkit_garg" }));

  const leafOrder = [];
  groups.forEach((g) => nodes.forEach((n) => {
    if ((n.type === "exp" || n.type === "project") && n.group === g.id) leafOrder.push(n.id);
  }));
  const mergeOrder = groups.map((g) => g.id);

  function inputsOf(id) { return edges.filter((e) => e.to === id).map((e) => e.from); }
  function outputOf(id) { const e = edges.find((x) => x.from === id); return e ? e.to : null; }
  function kindOf(n) {
    if (n.type === "out") return "out";
    if (n.type === "merge") return "merge";
    const g = groups.find((x) => x.id === n.group);
    return g ? g.kind : "exp";
  }

  /* ---------- DOM ---------- */

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) Object.entries(attrs).forEach(([k, v]) => {
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else if (k === "html") node.innerHTML = v;
      else node.setAttribute(k, v);
    });
    (children || []).forEach((c) => c && node.appendChild(c));
    return node;
  }
  function icon(name) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 20 20");
    svg.innerHTML = ICONS[name];
    return svg;
  }

  const typeName = { out: "Output", merge: "Merge", exp: "Experience", project: "Project" };

  nodes.forEach((n) => {
    const kind = kindOf(n);
    const btn = el("button", {
      type: "button",
      class: "node node--" + kind,
      "data-id": n.id,
      "aria-label": typeName[n.type] + ": " + (n.title || n.label)
    }, [
      el("span", { class: "node__flag", "aria-hidden": "true" }),
      el("span", { class: "node__icon", "aria-hidden": "true" }, [icon(n.type === "out" ? "out" : n.type === "merge" ? "merge" : n.type === "exp" ? "exp" : "project")]),
      el("span", { class: "node__label", text: n.label }),
      el("span", { class: "node__flag node__flag--end", "aria-hidden": "true" })
    ]);
    if (n.type !== "exp" && n.type !== "project") btn.appendChild(el("span", { class: "node__port node__port--in", "aria-hidden": "true" }));
    if (n.type !== "out") btn.appendChild(el("span", { class: "node__port node__port--out", "aria-hidden": "true" }));
    n.el = btn;
    n.x = 0; n.y = 0; n.fx = null; n.fy = null;
    canvas.appendChild(btn);
  });

  edges.forEach((e, i) => {
    const p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("class", "wire");
    e.el = p;
    e.i = i;
    wiresSvg.appendChild(p);
  });

  /* ---------- layout ---------- */

  const NODE_H = 34;
  let W = 0, H = 0;

  function layout() {
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    const leafW = 200, mergeW = 150, outW = 150;
    const gapUnits = 0.6;
    const slots = leafOrder.length + (groups.length - 1) * gapUnits;
    const pitch = Math.max(38, Math.min(46, (H - 90) / slots));
    const total = pitch * slots;
    let y = Math.max(20, (H - total) / 2 - 6);

    const leafX = 28;
    const outX = W - outW - 36;
    const mergeX = Math.round(leafX + leafW + (outX - leafX - leafW - mergeW) * 0.42);

    let prevGroup = null;
    leafOrder.forEach((id) => {
      const n = nodes.get(id);
      if (prevGroup && n.group !== prevGroup) y += pitch * gapUnits;
      n.x = leafX; n.y = Math.round(y);
      y += pitch;
      prevGroup = n.group;
    });

    mergeOrder.forEach((id) => {
      const n = nodes.get(id);
      const ins = inputsOf(id).map((x) => nodes.get(x).y);
      n.x = mergeX + (mergeOrder.indexOf(id) % 2 ? 18 : 0);
      n.y = Math.round(ins.reduce((a, b) => a + b, 0) / ins.length);
    });

    const out = nodes.get("pulkit_garg");
    const my = mergeOrder.map((id) => nodes.get(id).y);
    out.x = outX;
    out.y = Math.round(my.reduce((a, b) => a + b, 0) / my.length);

    nodes.forEach((n) => {
      if (n.fx !== null) { n.x = n.fx * W; n.y = n.fy * H; }
      place(n);
    });
    drawWires();
  }

  function place(n) {
    n.el.style.transform = "translate(" + Math.round(n.x) + "px," + Math.round(n.y) + "px)";
  }

  function nodeWidth(n) { return n.el.offsetWidth; }

  function drawWires() {
    edges.forEach((e) => {
      const a = nodes.get(e.from), b = nodes.get(e.to);
      const x1 = a.x + nodeWidth(a) + 2, y1 = a.y + NODE_H / 2;
      const x2 = b.x - 2, y2 = b.y + NODE_H / 2;
      const c = Math.max(36, Math.abs(x2 - x1) * 0.5);
      e.el.setAttribute("d", "M" + x1 + " " + y1 + " C" + (x1 + c) + " " + y1 + " " + (x2 - c) + " " + y2 + " " + x2 + " " + y2);
    });
  }

  new ResizeObserver(layout).observe(canvas);

  /* ---------- selection + parameter pane ---------- */

  const outPaneHTML = paramsBody.innerHTML;
  let selected = "pulkit_garg";

  function wireButton(id) {
    const n = nodes.get(id);
    const b = el("button", { type: "button", class: "wire-btn", "data-go": id }, [
      el("i", { "aria-hidden": "true" }),
      document.createTextNode(n.label)
    ]);
    b.style.setProperty("--chip", "var(--c-" + (kindOf(n) === "out" ? "exp" : kindOf(n) === "merge" ? "merge" : kindOf(n)) + ")");
    if (kindOf(n) === "out") b.style.setProperty("--chip", "var(--display)");
    return b;
  }

  function parmRow(label, value, mono) {
    if (!value) return null;
    return el("div", null, [el("dt", { text: label }), el("dd", { class: mono ? "is-mono" : "", text: value })]);
  }

  function renderPane(n) {
    const kind = kindOf(n);
    paramsIcon.innerHTML = "";
    paramsIcon.appendChild(icon(n.type === "out" ? "out" : n.type === "merge" ? "merge" : n.type === "exp" ? "exp" : "project"));
    paramsIcon.style.setProperty("--chip", kind === "out" ? "var(--display)" : "var(--c-" + kind + ")");
    paramsType.textContent = typeName[n.type];
    paramsName.textContent = n.label;

    if (n.type === "out") {
      paramsBody.innerHTML = outPaneHTML;
    } else {
      paramsBody.innerHTML = "";
      const title = n.type === "merge" ? n.label : n.title;
      paramsBody.appendChild(el("p", { class: "display display--sm", text: title }));

      if (n.type === "project") {
        paramsBody.appendChild(el("dl", { class: "parms" }, [
          parmRow("Category", n.tags.join(", "), true),
          parmRow("Feeds", n.group, true)
        ]));
      } else if (n.type === "exp") {
        paramsBody.appendChild(el("dl", { class: "parms" }, [
          parmRow("Role", n.role),
          parmRow("When", n.when),
          parmRow("Stack", n.stack, true)
        ]));
      }

      if (n.text) paramsBody.appendChild(el("p", { class: "params__text", text: n.text }));

      if (n.links && n.links.length) {
        paramsBody.appendChild(el("div", { class: "actions" }, n.links.map((l, i) =>
          el("a", { class: "btn ext" + (i === 0 ? " btn--primary" : ""), href: l.href, target: "_blank", rel: "noopener", text: l.label })
        )));
      }

      const ins = inputsOf(n.id);
      const out = outputOf(n.id);
      const wires = el("div", { class: "params__wires" });
      if (ins.length) {
        wires.appendChild(el("span", { text: "Inputs" }));
        ins.forEach((id) => wires.appendChild(wireButton(id)));
      }
      if (out) {
        wires.appendChild(el("span", { text: ins.length ? "· Output" : "Output" }));
        wires.appendChild(wireButton(out));
      }
      paramsBody.appendChild(wires);
    }

    if (!reduceMotion) {
      paramsBody.classList.remove("is-swapping");
      void paramsBody.offsetWidth;
      paramsBody.classList.add("is-swapping");
    }
    paramsBody.scrollTop = 0;
  }

  function select(id, opts) {
    const n = nodes.get(id);
    if (!n) return;
    selected = id;
    nodes.forEach((m) => m.el.setAttribute("aria-current", m.id === id ? "true" : "false"));
    edges.forEach((e) => e.el.classList.toggle("is-hot", e.from === id || e.to === id));
    renderPane(n);
    if (opts && opts.focus) n.el.focus({ preventScroll: true });
  }

  paramsBody.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-go]");
    if (b) select(b.dataset.go, { focus: true });
  });

  /* ---------- drag ---------- */

  let drag = null;
  let suppressClick = false;

  canvas.addEventListener("pointerdown", (ev) => {
    const btn = ev.target.closest(".node");
    if (!btn || ev.button !== 0) return;
    const n = nodes.get(btn.dataset.id);
    drag = { n, sx: ev.clientX, sy: ev.clientY, ox: n.x, oy: n.y, moved: false, id: ev.pointerId };
    btn.setPointerCapture(ev.pointerId);
  });

  canvas.addEventListener("pointermove", (ev) => {
    if (!drag || ev.pointerId !== drag.id) return;
    const dx = ev.clientX - drag.sx, dy = ev.clientY - drag.sy;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    if (!drag.moved) { drag.moved = true; drag.n.el.classList.add("is-dragging"); }
    const n = drag.n;
    n.x = Math.max(4, Math.min(W - nodeWidth(n) - 4, drag.ox + dx));
    n.y = Math.max(4, Math.min(H - NODE_H - 4, drag.oy + dy));
    n.fx = n.x / W; n.fy = n.y / H;
    place(n);
    drawWires();
  });

  function endDrag(ev) {
    if (!drag || ev.pointerId !== drag.id) return;
    if (drag.moved) {
      suppressClick = true;
      drag.n.el.classList.remove("is-dragging");
      select(drag.n.id);
    }
    drag = null;
  }
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  canvas.addEventListener("click", (ev) => {
    const btn = ev.target.closest(".node");
    if (!btn) return;
    if (suppressClick) { suppressClick = false; return; }
    select(btn.dataset.id);
  });

  /* ---------- keyboard: follow the wires ---------- */

  canvas.addEventListener("keydown", (ev) => {
    const btn = ev.target.closest(".node");
    if (!btn) return;
    const id = btn.dataset.id;
    const n = nodes.get(id);
    let next = null;
    const column = n.type === "merge" ? mergeOrder : n.type === "out" ? ["pulkit_garg"] : leafOrder;
    const idx = column.indexOf(id);
    if (ev.key === "ArrowDown") next = column[Math.min(column.length - 1, idx + 1)];
    else if (ev.key === "ArrowUp") next = column[Math.max(0, idx - 1)];
    else if (ev.key === "ArrowRight") next = outputOf(id);
    else if (ev.key === "ArrowLeft") next = inputsOf(id)[0] || null;
    else return;
    ev.preventDefault();
    if (next && next !== id) select(next, { focus: true });
  });

  /* ---------- filters bypass nodes and rows ---------- */

  function applyFilter(filter) {
    let visible = 0;
    nodes.forEach((n) => {
      if (n.type !== "project") return;
      const on = filter === "all" || n.tags.includes(filter);
      n.bypassed = !on;
      n.el.classList.toggle("is-bypassed", !on);
      n.row.classList.toggle("is-bypassed", !on);
      if (on) visible++;
    });
    groups.forEach((g) => {
      const m = nodes.get(g.id);
      const ins = inputsOf(g.id).map((id) => nodes.get(id));
      m.bypassed = ins.length > 0 && ins.every((x) => x.bypassed);
      m.el.classList.toggle("is-bypassed", m.bypassed);
    });
    edges.forEach((e) => e.el.classList.toggle("is-bypassed", !!nodes.get(e.from).bypassed));

    if (emptyState) emptyState.classList.toggle("is-visible", visible === 0);
    statusRegion.textContent = visible === 0
      ? "No projects match this filter."
      : visible + " project" + (visible === 1 ? "" : "s") + " cooking";
  }

  filters.forEach((btn) => {
    btn.addEventListener("click", () => {
      filters.forEach((f) => f.setAttribute("aria-pressed", "false"));
      btn.setAttribute("aria-pressed", "true");
      applyFilter(btn.dataset.filter);
    });
  });

  /* ---------- list rows select their node ---------- */

  rows.forEach((row) => {
    row.querySelector(".row__select").addEventListener("click", () => {
      select(row.dataset.node);
      network.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      const n = nodes.get(row.dataset.node);
      setTimeout(() => n.el.focus({ preventScroll: true }), reduceMotion ? 0 : 450);
    });
  });

  /* ---------- first cook ---------- */

  layout();
  select("pulkit_garg");

  const out = nodes.get("pulkit_garg");
  if (reduceMotion) {
    out.el.classList.add("is-display");
  } else {
    edges.forEach((e) => {
      const fromLeaf = nodes.get(e.from).type !== "merge";
      const delay = fromLeaf ? leafOrder.indexOf(e.from) * 45 : 650 + mergeOrder.indexOf(e.from) * 90;
      e.el.setAttribute("pathLength", "1");
      e.el.style.setProperty("--d", delay + "ms");
    });
    network.classList.add("is-cooking");
    setTimeout(() => {
      network.classList.remove("is-cooking");
      edges.forEach((e) => { e.el.removeAttribute("pathLength"); e.el.style.removeProperty("--d"); });
      out.el.classList.add("is-display");
    }, 1750);
  }
})();
