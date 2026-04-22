function nodeClass(model, id) {
  const n = model.nodeById.get(id);
  if (!n) return "l0";
  if (n.type === "abstraction") return "root";
  if (n.layer === 2 || n.type === "policy") return "l2";
  if (n.layer === 1 || n.type === "mechanism") return "l1";
  return "l0";
}

function fillFor(cls) {
  if (cls === "root") return "rgba(56,189,248,0.32)";
  if (cls === "l2") return "rgba(96,165,250,0.28)";
  if (cls === "l1") return "rgba(167,139,250,0.26)";
  return "rgba(251,146,60,0.2)";
}

function strokeFor(cls) {
  if (cls === "root") return "#38bdf8";
  if (cls === "l2") return "#60a5fa";
  if (cls === "l1") return "#a78bfa";
  return "#fb923c";
}

function outerAnchor(layout, dcx, dcy) {
  const dx = layout.cx - dcx;
  const dy = layout.cy - dcy;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  return {
    x: layout.cx + ux * (layout.w * 0.45),
    y: layout.cy + uy * (layout.h * 0.45),
  };
}

function innerAnchor(layout, dcx, dcy) {
  const dx = layout.cx - dcx;
  const dy = layout.cy - dcy;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  return {
    x: layout.cx - ux * (layout.w * 0.45),
    y: layout.cy - uy * (layout.h * 0.45),
  };
}

/**
 * @param {ReturnType<import('./layout.js').computeLayout>} layoutInfo
 */
function edgePathD(edge, layouts, layoutInfo) {
  const a = layouts.get(edge.source);
  const b = layouts.get(edge.target);
  if (!a || !b) return null;
  const { t1, t2, t3 } = layoutInfo.discs;
  const { type } = edge;

  if (type === "abstract_link") {
    const p1 = { x: a.cx, y: a.y + a.h };
    const p2 = { x: b.cx, y: b.y };
    const c1x = p1.x;
    const c1y = (p1.y + p2.y) / 2;
    return `M ${p1.x} ${p1.y} C ${c1x} ${c1y} ${p2.x} ${c1y} ${p2.x} ${p2.y}`;
  }

  if (type === "support_link") {
    const p1 = outerAnchor(a, t2.cx, t2.cy);
    const p2 = innerAnchor(b, t3.cx, t3.cy);
    const mx = (p1.x + p2.x) / 2;
    const midDy = layoutInfo.supportLinkMidDy ?? 28;
    const my = (p1.y + p2.y) / 2 + midDy;
    return `M ${p1.x} ${p1.y} Q ${mx} ${my} ${p2.x} ${p2.y}`;
  }

  if (type === "causal") {
    return `M ${a.cx} ${a.cy} L ${b.cx} ${b.cy}`;
  }

  if (type === "instance_of") {
    const p1 = { x: a.x + a.w, y: a.cy };
    const p2 = { x: b.x, y: b.cy };
    const midX = (p1.x + p2.x) / 2;
    return `M ${p1.x} ${p1.y} C ${midX} ${p1.y} ${midX} ${p2.y} ${p2.x} ${p2.y}`;
  }

  if (type === "triggers") {
    const p1 = { x: a.x, y: a.cy };
    const p2 = { x: b.x + b.w, y: b.cy };
    const midX = (p1.x + p2.x) / 2;
    return `M ${p1.x} ${p1.y} C ${midX} ${p1.y} ${midX} ${p2.y} ${p2.x} ${p2.y}`;
  }

  return `M ${a.cx} ${a.cy} L ${b.cx} ${b.cy}`;
}

function edgeTierClass(type) {
  if (type === "abstract_link") return "edge-tier tier-hub";
  if (type === "support_link") return "edge-tier tier-ring";
  if (type === "instance_of" || type === "triggers") return "edge-tier tier-bridge";
  if (type === "causal") return "edge-tier tier-intra";
  return "edge-tier";
}

function inferRelation(sourceName, targetName) {
  const s = String(sourceName || "");
  const t = String(targetName || "");
  if (/[先于|随后|之后|进一步|再度]/.test(`${s}${t}`)) {
    return { key: "temporal", label: "时序 before/after" };
  }
  if (/[预期|情绪|风险溢价|担忧]/.test(`${s}${t}`)) {
    return { key: "explain", label: "解释/支撑 ⇒" };
  }
  if (/[与|及|叠加|共同|同时]/.test(s)) {
    return { key: "co_cause", label: "并行驱动 A+B→C" };
  }
  return { key: "causal", label: "因果 A→B" };
}

function relationLabelPos(edge, layouts) {
  const a = layouts.get(edge.source);
  const b = layouts.get(edge.target);
  if (!a || !b) return null;
  return { x: (a.cx + b.cx) / 2, y: (a.cy + b.cy) / 2 };
}

function ensureDiscStyles(defs) {
  if (defs.querySelector("#discPlateGrad")) return;
  const lg = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
  lg.id = "discPlateGrad";
  lg.setAttribute("x1", "0");
  lg.setAttribute("y1", "0");
  lg.setAttribute("x2", "0");
  lg.setAttribute("y2", "1");
  const s0 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
  s0.setAttribute("offset", "0%");
  s0.setAttribute("stop-color", "#475569");
  s0.setAttribute("stop-opacity", "0.45");
  const s1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
  s1.setAttribute("offset", "38%");
  s1.setAttribute("stop-color", "#1e293b");
  s1.setAttribute("stop-opacity", "0.72");
  const s2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
  s2.setAttribute("offset", "100%");
  s2.setAttribute("stop-color", "#020617");
  s2.setAttribute("stop-opacity", "0.88");
  lg.appendChild(s0);
  lg.appendChild(s1);
  lg.appendChild(s2);
  defs.appendChild(lg);

  const f = document.createElementNS("http://www.w3.org/2000/svg", "filter");
  f.id = "discPlateShadow";
  f.setAttribute("x", "-35%");
  f.setAttribute("y", "-35%");
  f.setAttribute("width", "170%");
  f.setAttribute("height", "170%");
  const blur = document.createElementNS("http://www.w3.org/2000/svg", "feGaussianBlur");
  blur.setAttribute("in", "SourceAlpha");
  blur.setAttribute("stdDeviation", "7");
  blur.setAttribute("result", "b");
  const off = document.createElementNS("http://www.w3.org/2000/svg", "feOffset");
  off.setAttribute("in", "b");
  off.setAttribute("dy", "14");
  off.setAttribute("result", "o");
  const flood = document.createElementNS("http://www.w3.org/2000/svg", "feFlood");
  flood.setAttribute("flood-color", "#000");
  flood.setAttribute("flood-opacity", "0.42");
  flood.setAttribute("result", "f");
  const comp = document.createElementNS("http://www.w3.org/2000/svg", "feComposite");
  comp.setAttribute("in", "f");
  comp.setAttribute("in2", "o");
  comp.setAttribute("operator", "in");
  comp.setAttribute("result", "sh");
  const merge = document.createElementNS("http://www.w3.org/2000/svg", "feMerge");
  const m1 = document.createElementNS("http://www.w3.org/2000/svg", "feMergeNode");
  m1.setAttribute("in", "sh");
  const m2 = document.createElementNS("http://www.w3.org/2000/svg", "feMergeNode");
  m2.setAttribute("in", "SourceGraphic");
  merge.appendChild(m1);
  merge.appendChild(m2);
  f.appendChild(blur);
  f.appendChild(off);
  f.appendChild(flood);
  f.appendChild(comp);
  f.appendChild(merge);
  defs.appendChild(f);

  const rg = document.createElementNS("http://www.w3.org/2000/svg", "radialGradient");
  rg.id = "discRimGlow";
  rg.setAttribute("cx", "50%");
  rg.setAttribute("cy", "35%");
  rg.setAttribute("r", "55%");
  const r0 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
  r0.setAttribute("offset", "0%");
  r0.setAttribute("stop-color", "#94a3b8");
  r0.setAttribute("stop-opacity", "0.22");
  const r1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
  r1.setAttribute("offset", "100%");
  r1.setAttribute("stop-color", "#0f172a");
  r1.setAttribute("stop-opacity", "0");
  rg.appendChild(r0);
  rg.appendChild(r1);
  defs.appendChild(rg);
}

function drawDiscPlate(bgLayer, disc, zIndexStroke, scale = 1) {
  const sw = Math.max(0.35, zIndexStroke * scale);
  const el = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
  el.setAttribute("cx", String(disc.cx));
  el.setAttribute("cy", String(disc.cy));
  el.setAttribute("rx", String(disc.rx));
  el.setAttribute("ry", String(disc.ry));
  el.setAttribute("fill", "url(#discPlateGrad)");
  el.setAttribute("stroke", "rgba(148,163,184,0.38)");
  el.setAttribute("stroke-width", String(sw));
  el.setAttribute("filter", "url(#discPlateShadow)");
  el.setAttribute("pointer-events", "none");
  bgLayer.appendChild(el);

  const rim = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
  rim.setAttribute("cx", String(disc.cx));
  rim.setAttribute("cy", String(disc.cy));
  rim.setAttribute("rx", String(disc.rx * 0.92));
  rim.setAttribute("ry", String(disc.ry * 0.88));
  rim.setAttribute("fill", "url(#discRimGlow)");
  rim.setAttribute("stroke", "none");
  rim.setAttribute("pointer-events", "none");
  bgLayer.appendChild(rim);
}

/**
 * @param {ReturnType<import('./graph-model.js').buildGraphModel>} model
 * @param {ReturnType<import('./layout.js').computeLayout>} layoutInfo
 */
export function renderGraphSvg(svg, model, layoutInfo) {
  const {
    width,
    height,
    layouts,
    discs,
    graphCoreW,
    eventsLeftX,
    stripTitleY,
    scale: layoutScale = 1,
  } = layoutInfo;
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  /**
   * viewBox 宽已与中间栏 clientWidth 一致（layout 按宽等比缩放），用 100% 宽 + height:auto
   * 避免视口比例与 viewBox 不一致产生假空白。
   */
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.setAttribute("width", "100%");
  svg.removeAttribute("height");
  svg.style.setProperty("--layout-scale", String(layoutScale));

  const defs = svg.querySelector("defs");
  if (defs) {
    ensureDiscStyles(defs);
    const mk = defs.querySelector("#arrow-end");
    if (mk) {
      const mz = Math.max(3, 7 * layoutScale);
      mk.setAttribute("markerWidth", String(mz));
      mk.setAttribute("markerHeight", String(mz));
    }
  }

  let bgLayer = svg.querySelector("#bg-layer");
  if (!bgLayer) {
    bgLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
    bgLayer.id = "bg-layer";
    svg.insertBefore(bgLayer, svg.querySelector("#edges-layer"));
  }
  bgLayer.innerHTML = "";

  const wash = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  wash.setAttribute("width", String(width));
  wash.setAttribute("height", String(height));
  wash.setAttribute("fill", "#0a0e14");
  wash.setAttribute("pointer-events", "none");
  bgLayer.appendChild(wash);

  const strip = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  strip.setAttribute("x", String(graphCoreW));
  strip.setAttribute("y", "0");
  strip.setAttribute("width", String(width - graphCoreW));
  strip.setAttribute("height", String(height));
  strip.setAttribute("fill", "rgba(15,20,28,0.55)");
  strip.setAttribute("pointer-events", "none");
  bgLayer.appendChild(strip);

  const vsep = document.createElementNS("http://www.w3.org/2000/svg", "line");
  vsep.setAttribute("x1", String(graphCoreW));
  vsep.setAttribute("y1", "0");
  vsep.setAttribute("x2", String(graphCoreW));
  vsep.setAttribute("y2", String(height));
  vsep.setAttribute("stroke", "rgba(100,116,139,0.35)");
  vsep.setAttribute("stroke-width", String(Math.max(0.5, layoutScale)));
  vsep.setAttribute("pointer-events", "none");
  bgLayer.appendChild(vsep);

  const { t1, t2, t3 } = discs;
  drawDiscPlate(bgLayer, t3, 1.35, layoutScale);
  drawDiscPlate(bgLayer, t2, 1.45, layoutScale);
  drawDiscPlate(bgLayer, t1, 1.55, layoutScale);

  const edgesLayer = svg.querySelector("#edges-layer");
  const nodesLayer = svg.querySelector("#nodes-layer");
  edgesLayer.innerHTML = "";
  nodesLayer.innerHTML = "";

  for (const edge of model.allEdges) {
    if (edge.type !== "causal") continue;
    const d = edgePathD(edge, layouts, layoutInfo);
    if (!d) continue;
    const k = model.edgeKey(edge.source, edge.target, edge.type);
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    path.setAttribute("class", `graph-edge ${edgeTierClass(edge.type)}`);
    path.setAttribute("marker-end", "url(#arrow-end)");
    path.dataset.edgeKey = k;
    edgesLayer.appendChild(path);

    if (edge.type === "causal") {
      const src = model.nodeById.get(edge.source);
      const tgt = model.nodeById.get(edge.target);
      const rel = inferRelation(src?.name, tgt?.name);
      const p = relationLabelPos(edge, layouts);
      if (p) {
        const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        bg.setAttribute("x", String(p.x - 50));
        bg.setAttribute("y", String(p.y - 10));
        bg.setAttribute("width", "100");
        bg.setAttribute("height", "18");
        bg.setAttribute("rx", "4");
        bg.setAttribute("ry", "4");
        bg.setAttribute("class", `edge-rel-bg rel-${rel.key}`);
        bg.dataset.edgeKey = k;
        edgesLayer.appendChild(bg);

        const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
        label.setAttribute("x", String(p.x));
        label.setAttribute("y", String(p.y + 2));
        label.setAttribute("class", `edge-rel-label rel-${rel.key}`);
        label.setAttribute("text-anchor", "middle");
        label.dataset.edgeKey = k;
        label.textContent = rel.label;
        edgesLayer.appendChild(label);
      }
    }
  }

  const orderedIds = [
    model.rootId,
    ...model.l2Nodes.map((n) => n.id),
    ...model.l1Nodes.map((n) => n.id),
    ...model.l0Nodes.map((n) => n.id),
  ];

  for (const id of orderedIds) {
    const pos = layouts.get(id);
    if (!pos) continue;
    const n = model.nodeById.get(id);
    const cls = nodeClass(model, id);
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", `graph-node node-${cls}`);
    g.dataset.nodeId = id;
    g.setAttribute("transform", `translate(${pos.x},${pos.y})`);

    const rx = cls === "l1"
      ? Math.max(2, 5 * layoutScale)
      : Math.max(2, 8 * layoutScale);
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("width", String(pos.w));
    rect.setAttribute("height", String(pos.h));
    rect.setAttribute("rx", String(rx));
    rect.setAttribute("fill", fillFor(cls));
    rect.setAttribute("stroke", strokeFor(cls));

    const ty = pos.h / 2 + Math.max(2, 4 * layoutScale);
    const fs =
      cls === "l1" || cls === "l2"
        ? Math.max(7, 11 * layoutScale)
        : cls === "l0"
          ? Math.max(6, 9 * layoutScale)
          : Math.max(8, 12 * layoutScale);
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", String(pos.w / 2));
    text.setAttribute("y", String(ty));
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("font-size", String(fs));
    text.textContent = pos.label;

    const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent = pos.longLabel;

    g.appendChild(rect);
    g.appendChild(text);
    g.appendChild(title);
    nodesLayer.appendChild(g);
  }

  const stripTitle = document.createElementNS("http://www.w3.org/2000/svg", "text");
  stripTitle.setAttribute("x", String(eventsLeftX ?? graphCoreW + 12));
  stripTitle.setAttribute("y", String(stripTitleY ?? 28));
  stripTitle.setAttribute("fill", "#cbd5e1");
  stripTitle.setAttribute("font-size", String(Math.max(8, 12 * layoutScale)));
  stripTitle.setAttribute("font-weight", "600");
  stripTitle.setAttribute("pointer-events", "none");
  stripTitle.textContent = "具体事件 · 每行 3 个";
  nodesLayer.appendChild(stripTitle);

  return {};
}

/**
 * @param {SVGSVGElement} svg
 * @param {import('./state.js').AppState} st
 */
export function applyHighlight(svg, st) {
  const hn = st.highlightNodes;
  const he = st.highlightEdgeKeys;
  const sel = st.selectedNodeId;

  svg.querySelectorAll(".graph-node").forEach((g) => {
    const id = g.dataset.nodeId;
    g.classList.remove("dim", "highlight", "selected");
    if (hn.size === 0) return;
    if (!hn.has(id)) g.classList.add("dim");
    else {
      g.classList.add("highlight");
      if (id === sel) g.classList.add("selected");
    }
  });

  svg.querySelectorAll(".graph-edge").forEach((p) => {
    const k = p.dataset.edgeKey;
    p.classList.remove("dim", "highlight");
    if (he.size === 0) return;
    if (!he.has(k)) p.classList.add("dim");
    else p.classList.add("highlight");
  });

  svg.querySelectorAll(".edge-rel-bg, .edge-rel-label").forEach((el) => {
    const k = el.dataset.edgeKey;
    el.classList.remove("dim", "hidden-rel");
    if (he.size === 0) {
      el.classList.add("hidden-rel");
      return;
    }
    if (!he.has(k)) {
      el.classList.add("hidden-rel");
    }
  });
}
