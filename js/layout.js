const ROOT_W = 168;
const ROOT_H = 52;
const L2_W = 124;
const L2_H = 42;
/** 机制层：小框紧包文字，packInDisc 保证间距 */
const L1_FONT_PX = 11;
const L1_MAX_CHARS = 15;
/** 右侧事件条：更窄、每行 3 个、整体贴右 */
const EV_COLS = 3;
const EV_W = 108;
const EV_H = 36;
const EV_GAP_X = 6;
const EV_GAP_Y = 6;
const EVENTS_MARGIN_LEFT = 10;
const EVENTS_MARGIN_RIGHT = 0;

/** 事件条在设计宽度中的占位（与 GRAPH_CORE 相加 = 总参考宽） */
const EVENTS_BLOCK_INNER_W =
  EV_COLS * EV_W + (EV_COLS - 1) * EV_GAP_X;
const EVENTS_STRIP_W_DESIGN =
  EVENTS_MARGIN_LEFT + EVENTS_BLOCK_INNER_W + EVENTS_MARGIN_RIGHT;
/** 设计总宽：运行时按 `clientWidth / 此值` 整体缩放，避免固定像素与视口脱节 */
const REF_TOTAL_W = 1686;
/** 左侧图区宽度 = 总宽 − 事件条（比例随 REF_TOTAL_W 自洽） */
const GRAPH_CORE_W = REF_TOTAL_W - EVENTS_STRIP_W_DESIGN;

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function truncate(str, max) {
  if (!str) return "";
  return str.length <= max ? str : `${str.slice(0, max - 1)}…`;
}

function buildDiscs(discCx) {
  return {
    canvasCx: discCx,
    /** 顶盘 */
    t1: { cx: discCx, cy: 78, rx: 138, ry: 52 },
    /** 中盘（九类政策）— 扩大，与底盘拉开竖直间距避免椭圆重叠 */
    t2: { cx: discCx, cy: 302, rx: 432, ry: 176 },
    /** 底盘（机制 L1）— 覆盖整圈区域，尽量全盘分布 */
    t3: { cx: discCx, cy: 920, rx: 760, ry: 500 },
  };
}

function ellipseClamp(cx, cy, disc, rxScale, ryScale) {
  const dx = cx - disc.cx;
  const dy = cy - disc.cy;
  const nx = dx / (disc.rx * rxScale);
  const ny = dy / (disc.ry * ryScale);
  const n2 = nx * nx + ny * ny;
  if (n2 <= 1) return { cx, cy };
  const s = 1 / Math.sqrt(n2);
  return { cx: disc.cx + dx * s, cy: disc.cy + dy * s };
}

function rectsOverlap(A, B, pad) {
  return !(
    A.x + A.w + pad <= B.x ||
    B.x + B.w + pad <= A.x ||
    A.y + A.h + pad <= B.y ||
    B.y + B.h + pad <= A.y
  );
}

function layoutRect(cx, cy, w, h) {
  return { cx, cy, x: cx - w / 2, y: cy - h / 2, w, h };
}

/**
 * 黄金角螺旋初始点 + 迭代推开重叠，并约束在椭圆内
 */
/**
 * 从 layouts 读取每个节点的 w/h（可异宽），迭代推开重叠。
 */
function packInDisc(
  ids,
  layouts,
  disc,
  rxInset,
  ryInset,
  pad,
  maxIter = 280,
  spiralFill = 0.82,
  pushEarly = 6,
  pushLate = 2.5,
  radialPower = 0.5,
) {
  const n = ids.length;
  for (let i = 0; i < n; i++) {
    const L = layouts.get(ids[i]);
    const w = L.w;
    const h = L.h;
    const r = Math.pow((i + 0.5) / n, radialPower) * spiralFill;
    const theta = i * GOLDEN_ANGLE;
    let cx = disc.cx + disc.rx * rxInset * r * Math.cos(theta);
    let cy = disc.cy + disc.ry * ryInset * r * Math.sin(theta);
    const c = ellipseClamp(cx, cy, disc, rxInset * 0.98, ryInset * 0.98);
    const rect = layoutRect(c.cx, c.cy, w, h);
    layouts.set(ids[i], {
      ...rect,
      label: L.label,
      longLabel: L.longLabel,
      disc: L.disc,
    });
  }

  for (let iter = 0; iter < maxIter; iter++) {
    let moved = false;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const A = layouts.get(ids[i]);
        const B = layouts.get(ids[j]);
        if (!rectsOverlap(A, B, pad)) continue;
        let dx = A.cx - B.cx;
        let dy = A.cy - B.cy;
        const len = Math.hypot(dx, dy) || 1;
        dx /= len;
        dy /= len;
        const push = iter < maxIter * 0.45 ? pushEarly : pushLate;
        A.cx += dx * push;
        A.cy += dy * push;
        B.cx -= dx * push;
        B.cy -= dy * push;
        const cA = ellipseClamp(A.cx, A.cy, disc, rxInset * 0.94, ryInset * 0.94);
        const cB = ellipseClamp(B.cx, B.cy, disc, rxInset * 0.94, ryInset * 0.94);
        Object.assign(A, layoutRect(cA.cx, cA.cy, A.w, A.h));
        Object.assign(B, layoutRect(cB.cx, cB.cy, B.w, B.h));
        moved = true;
      }
    }
    if (!moved) break;
  }
}

/** 机制节点：单行紧包标签（按字符数估算宽度） */
function estimateL1Box(fullName) {
  const chars = [...fullName];
  let label = fullName;
  if (chars.length > L1_MAX_CHARS) {
    label = chars.slice(0, L1_MAX_CHARS - 1).join("") + "…";
  }
  const n = [...label].length;
  const charW = L1_FONT_PX * 0.62;
  const w = Math.max(40, Math.ceil(n * charW) + 14);
  const h = 24;
  return { label, w, h };
}

/**
 * @param {ReturnType<typeof computeLayoutReference>} ref
 * @param {number} s
 */
function scaleLayoutInfo(ref, s) {
  const layouts = new Map();
  for (const [id, pos] of ref.layouts) {
    layouts.set(id, {
      ...pos,
      x: pos.x * s,
      y: pos.y * s,
      w: pos.w * s,
      h: pos.h * s,
      cx: pos.cx * s,
      cy: pos.cy * s,
    });
  }
  const sd = (d) => ({
    cx: d.cx * s,
    cy: d.cy * s,
    rx: d.rx * s,
    ry: d.ry * s,
  });
  return {
    width: ref.width * s,
    height: ref.height * s,
    layouts,
    discs: {
      canvasCx: ref.discs.canvasCx * s,
      t1: sd(ref.discs.t1),
      t2: sd(ref.discs.t2),
      t3: sd(ref.discs.t3),
    },
    graphCoreW: ref.graphCoreW * s,
    eventsTop: ref.eventsTop * s,
    eventsLeftX: ref.eventsLeftX * s,
    supportLinkMidDy: ref.supportLinkMidDy * s,
    stripTitleY: ref.stripTitleY * s,
    /** 相对参考宽度的缩放系数（字体、描边等） */
    scale: s,
    refWidth: ref.width,
  };
}

/**
 * 在固定「设计稿」坐标下排版（内部参考分辨率）。
 * @param {ReturnType<import('./graph-model.js').buildGraphModel>} model
 */
function computeLayoutReference(model) {
  const { l2Nodes, l1Nodes, l0Nodes, rootId } = model;
  const layouts = new Map();

  const eventsBlockInnerW = EVENTS_BLOCK_INNER_W;
  const fullW = REF_TOTAL_W;
  const discCx = GRAPH_CORE_W * 0.5;
  const discs = buildDiscs(discCx);
  const { t1, t2, t3 } = discs;

  const root = model.nodeById.get(rootId);
  layouts.set(rootId, {
    ...layoutRect(t1.cx, t1.cy, ROOT_W, ROOT_H),
    label: root.name,
    longLabel: root.name,
    disc: "t1",
  });

  const l2Sorted = [...l2Nodes].sort((a, b) => a.id.localeCompare(b.id));
  const l2Ids = l2Sorted.map((n) => n.id);
  for (const node of l2Sorted) {
    layouts.set(node.id, {
      cx: 0,
      cy: 0,
      x: 0,
      y: 0,
      w: L2_W,
      h: L2_H,
      label: truncate(node.name, 10),
      longLabel: node.name,
      disc: "t2",
    });
  }
  packInDisc(l2Ids, layouts, t2, 0.76, 0.76, 12);

  const l1Sorted = [...l1Nodes].sort((a, b) => a.name.localeCompare(b.name));
  const l1Ids = l1Sorted.map((n) => n.id);
  for (const node of l1Sorted) {
    const box = estimateL1Box(node.name);
    layouts.set(node.id, {
      cx: 0,
      cy: 0,
      x: 0,
      y: 0,
      w: box.w,
      h: box.h,
      label: box.label,
      longLabel: node.name,
      disc: "t3",
    });
  }
  // Max spread for L1 causal nodes: outer-ring bias + stronger repulsion
  packInDisc(l1Ids, layouts, t3, 0.86, 0.86, 72, 820, 1.02, 11.5, 4.8, 0.34);

  const eventsSorted = [...l0Nodes].sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    return d !== 0 ? d : a.id.localeCompare(b.id);
  });

  const eventsLeftX =
    fullW - EVENTS_MARGIN_RIGHT - eventsBlockInnerW;
  const eventsTopY = 48;

  eventsSorted.forEach((node, i) => {
    const col = i % EV_COLS;
    const row = Math.floor(i / EV_COLS);
    const x = eventsLeftX + col * (EV_W + EV_GAP_X);
    const y = eventsTopY + row * (EV_H + EV_GAP_Y);
    layouts.set(node.id, {
      x,
      y,
      w: EV_W,
      h: EV_H,
      cx: x + EV_W / 2,
      cy: y + EV_H / 2,
      label: truncate(node.title || node.id, 14),
      longLabel: `${node.date} ${node.title}`,
      disc: "events",
    });
  });

  const rows = Math.ceil(eventsSorted.length / EV_COLS);
  const eventsBlockH = eventsTopY + rows * (EV_H + EV_GAP_Y) + 48;
  const discBottom = t3.cy + t3.ry + 60;
  const height = Math.max(discBottom, eventsBlockH);

  return {
    width: fullW,
    height,
    layouts,
    discs,
    graphCoreW: GRAPH_CORE_W,
    eventsTop: eventsTopY,
    eventsLeftX,
    supportLinkMidDy: 28,
    stripTitleY: 28,
  };
}

/**
 * @param {ReturnType<import('./graph-model.js').buildGraphModel>} model
 * @param {number} [containerWidthPx] 中间栏 `.svg-scroll` 的 clientWidth；不传则仅用参考宽度（不缩放）
 */
export function computeLayout(model, containerWidthPx) {
  const ref = computeLayoutReference(model);
  const minW = 320;
  if (containerWidthPx == null || containerWidthPx < 1) {
    return { ...ref, scale: 1, refWidth: ref.width };
  }
  const w = Math.max(minW, containerWidthPx);
  const s = w / ref.width;
  return scaleLayoutInfo(ref, s);
}

export function edgeEndpoints(model, layouts, edge) {
  const a = layouts.get(edge.source);
  const b = layouts.get(edge.target);
  if (!a || !b) return null;
  return { x1: a.cx, y1: a.cy, x2: b.cx, y2: b.cy };
}
