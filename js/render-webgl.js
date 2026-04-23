const LAYER_COLORS = {
  policy: [59 / 255, 130 / 255, 246 / 255, 1],
  action: [34 / 255, 211 / 255, 238 / 255, 0.92],
  mechanism: [168 / 255, 85 / 255, 247 / 255, 0.9],
  event: [249 / 255, 115 / 255, 22 / 255, 0.95],
};

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) || "Shader compile error");
  }
  return shader;
}

function createProgram(gl, vertSrc, fragSrc) {
  const p = gl.createProgram();
  gl.attachShader(p, compileShader(gl, gl.VERTEX_SHADER, vertSrc));
  gl.attachShader(p, compileShader(gl, gl.FRAGMENT_SHADER, fragSrc));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(p) || "Program link error");
  }
  return p;
}

function normalizePos(x, y, w, h) {
  return [(x / w) * 2 - 1, 1 - (y / h) * 2];
}

export function createWebGLRenderer(canvas) {
  const gl = canvas.getContext("webgl", { antialias: true, alpha: true });
  if (!gl) throw new Error("浏览器不支持 WebGL");

  const lineProgram = createProgram(
    gl,
    `
attribute vec2 a_pos;
attribute vec4 a_color;
varying vec4 v_color;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
  v_color = a_color;
}
`,
    `
precision mediump float;
varying vec4 v_color;
uniform float u_time;
uniform float u_flow;
void main() {
  float pulse = 0.74 + 0.26 * sin(u_time * 4.0 + gl_FragCoord.x * 0.05);
  gl_FragColor = vec4(v_color.rgb, v_color.a * mix(1.0, pulse, u_flow));
}
`,
  );

  const nodeProgram = createProgram(
    gl,
    `
attribute vec2 a_pos;
attribute float a_size;
attribute vec4 a_color;
varying vec4 v_color;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
  gl_PointSize = a_size;
  v_color = a_color;
}
`,
    `
precision mediump float;
varying vec4 v_color;
void main() {
  vec2 c = gl_PointCoord - vec2(0.5);
  float dist = dot(c, c);
  if (dist > 0.25) discard;
  float glow = smoothstep(0.25, 0.0, dist) * 0.65;
  gl_FragColor = vec4(v_color.rgb + glow * 0.25, v_color.a);
}
`,
  );

  const linePosBuffer = gl.createBuffer();
  const lineColorBuffer = gl.createBuffer();
  const nodePosBuffer = gl.createBuffer();
  const nodeSizeBuffer = gl.createBuffer();
  const nodeColorBuffer = gl.createBuffer();

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.floor(canvas.clientWidth * dpr);
    const h = Math.floor(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function render({ model, layout, state, timeMs }) {
    resize();
    const width = layout.width;
    const height = layout.height;

    const activeLinePositions = [];
    const activeLineColors = [];
    const showVertical = Boolean(state.selectedEvent);
    for (const e of model.renderEdges) {
      // Remove all event-upward links and trigger links as requested.
      if (
        e.type === "action_event" ||
        e.type === "mechanism_event" ||
        e.type === "action_mechanism"
      ) {
        continue;
      }
      const a = layout.nodes.get(e.source);
      const b = layout.nodes.get(e.target);
      if (!a || !b) continue;
      const isVerticalEdge =
        e.type === "policy_action" ||
        e.type === "action_event" ||
        e.type === "mechanism_event" ||
        e.type === "action_mechanism";
      if (isVerticalEdge && !showVertical) continue;
      if ((e.type === "action_event" || e.type === "mechanism_event") && !layout.nodes.has(e.target)) {
        continue;
      }
      const active = state.activePath.edges.has(e.key);
      const [x1, y1] = normalizePos(a.x, a.y, width, height);
      const [x2, y2] = normalizePos(b.x, b.y, width, height);

      if (!active) continue;
      const ac = [1, 1, 1, 1];
      activeLinePositions.push(x1, y1, x2, y2);
      activeLineColors.push(...ac, ...ac);
    }

    const nodePositions = [];
    const nodeSizes = [];
    const nodeColors = [];
    for (const [id, n] of layout.nodes) {
      const layer = model.nodeById.get(id)?.layer;
      if (layer === "event") continue;
      const [nx, ny] = normalizePos(n.x, n.y, width, height);
      const active = state.activePath.nodes.has(id) || state.hoveredNode === id;
      const color = layer ? LAYER_COLORS[layer] || [1, 1, 1, 0.9] : [1, 1, 1, 0.9];
      const size = (n.r || 10) * 2 + (active ? 8 : 0);
      nodePositions.push(nx, ny);
      nodeSizes.push(size);
      nodeColors.push(color[0], color[1], color[2], active ? 1 : color[3]);
    }

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.useProgram(lineProgram);
    const linePosLoc = gl.getAttribLocation(lineProgram, "a_pos");
    gl.enableVertexAttribArray(linePosLoc);
    const lineColorLoc = gl.getAttribLocation(lineProgram, "a_color");
    gl.enableVertexAttribArray(lineColorLoc);

    if (activeLinePositions.length) {
      gl.bindBuffer(gl.ARRAY_BUFFER, linePosBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(activeLinePositions), gl.DYNAMIC_DRAW);
      gl.vertexAttribPointer(linePosLoc, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, lineColorBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(activeLineColors), gl.DYNAMIC_DRAW);
      gl.vertexAttribPointer(lineColorLoc, 4, gl.FLOAT, false, 0, 0);
      gl.uniform1f(gl.getUniformLocation(lineProgram, "u_flow"), 1);
      gl.lineWidth(3);
      gl.drawArrays(gl.LINES, 0, activeLinePositions.length / 2);
    }

    gl.useProgram(nodeProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, nodePosBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(nodePositions), gl.DYNAMIC_DRAW);
    const nodePosLoc = gl.getAttribLocation(nodeProgram, "a_pos");
    gl.enableVertexAttribArray(nodePosLoc);
    gl.vertexAttribPointer(nodePosLoc, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, nodeSizeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(nodeSizes), gl.DYNAMIC_DRAW);
    const nodeSizeLoc = gl.getAttribLocation(nodeProgram, "a_size");
    gl.enableVertexAttribArray(nodeSizeLoc);
    gl.vertexAttribPointer(nodeSizeLoc, 1, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, nodeColorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(nodeColors), gl.DYNAMIC_DRAW);
    const nodeColorLoc = gl.getAttribLocation(nodeProgram, "a_color");
    gl.enableVertexAttribArray(nodeColorLoc);
    gl.vertexAttribPointer(nodeColorLoc, 4, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.POINTS, 0, nodePositions.length / 2);
  }

  return { render, resize };
}

export function renderOverlayLabels(overlayEl, model, layout, state) {
  const truncate = (text, max = 10) => (text && text.length > max ? `${text.slice(0, max - 1)}…` : text || "");
  const addLayerTitle = (x, y, text) => {
    const title = document.createElement("div");
    title.className = "overlay-layer-title";
    title.style.left = `${x}px`;
    title.style.top = `${y}px`;
    title.textContent = text;
    overlayEl.appendChild(title);
  };

  overlayEl.innerHTML = "";
  addLayerTitle(96, layout.layerY.policy - 10, "Policy Layer");
  addLayerTitle(96, layout.layerY.action - 8, "Action Layer");
  addLayerTitle(114, layout.layerY.mechanism - 6, "Mechanism Layer");

  const labelBoxes = [];
  const canPlace = (x, y) => {
    for (const b of labelBoxes) {
      if (Math.abs(x - b.x) < 54 && Math.abs(y - b.y) < 16) return false;
    }
    return true;
  };

  for (const [id, p] of layout.nodes) {
    const node = model.nodeById.get(id);
    if (!node) continue;
    const isHovered = state.hoveredNode === id;
    if (node.layer === "event") continue;
    const show = node.layer === "policy" || node.layer === "action" || node.layer === "mechanism" || state.activePath.nodes.has(id) || isHovered;
    if (!show) continue;
    const div = document.createElement("div");
    div.className = `overlay-label overlay-chip ${node.layer === "event" ? "event" : ""} ${node.layer}`;
    if (node.layer === "policy") {
      div.textContent = "货币政策 / Monetary Policy";
    } else {
      const shortName = truncate(node.name, 10);
      div.textContent = isHovered ? node.name : shortName;
      if (shortName !== node.name) div.classList.add("truncated");
    }
    div.title = node.name || "";
    let labelX = p.x;
    let labelY = p.y;
    if (node.layer === "mechanism") {
      if (!canPlace(labelX, labelY)) labelY -= 16;
      if (!canPlace(labelX, labelY)) labelY += 32;
    }
    div.style.left = `${labelX}px`;
    div.style.top = `${labelY}px`;
    labelBoxes.push({ x: labelX, y: labelY });
    overlayEl.appendChild(div);
  }

  // Mechanism chain relation labels placed above active lines.
  if (state.selectedEvent && state.activePath?.edges?.size) {
    for (const e of model.renderEdges) {
      if (!state.activePath.edges.has(e.key)) continue;
      if (e.type !== "causal") continue;
      const a = layout.nodes.get(e.source);
      const b = layout.nodes.get(e.target);
      if (!a || !b) continue;
      const mid = document.createElement("div");
      mid.className = "edge-rel-overlay";
      mid.textContent = "causal";
      mid.style.left = `${(a.x + b.x) / 2}px`;
      mid.style.top = `${(a.y + b.y) / 2 - 10}px`;
      overlayEl.appendChild(mid);
    }
  }
}
