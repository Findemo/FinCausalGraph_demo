import { loadGraphBundle } from "./data-loader.js";
import { buildGraphModel } from "./graph-model.js";
import { computeLayout } from "./layout.js";
import { getState, setState, subscribe } from "./state.js";
import { createWebGLRenderer, renderOverlayLabels } from "./render-webgl.js";
import { initTimeline, setTimelineActive, setTimelineEvents } from "./timeline.js";
import {
  renderDetail,
  renderChain,
  bindPanelClicks,
  bindNewsModal,
  bindNewsButton,
  setNewsModalOpen,
} from "./panels.js";
import { attachCanvasInteractions } from "./interactions.js";

async function main() {
  const bundle = await loadGraphBundle();
  const model = buildGraphModel(bundle);
  const canvas = document.getElementById("graph-canvas");
  const stage = document.getElementById("graph-stage");
  const overlay = document.getElementById("graph-overlay");
  const stats = document.getElementById("graph-stats");
  const yearFilter = document.getElementById("filter-year");
  const policyFilter = document.getElementById("filter-policy");
  const prevBtn = document.getElementById("event-prev");
  const nextBtn = document.getElementById("event-next");
  const windowIndicator = document.getElementById("event-window-indicator");
  const bandEls = {
    policy: document.getElementById("band-policy"),
    action: document.getElementById("band-action"),
    mechanism: document.getElementById("band-mechanism"),
    event: document.getElementById("band-event"),
  };
  if (!canvas || !stage || !overlay || !yearFilter || !policyFilter || !stats) return;

  const renderer = createWebGLRenderer(canvas);
  let layout = null;
  let targetLayout = null;
  let transition = 1;
  let eventWindowStart = 0;
  let lastTimelineOffset = 0;
  let frame = 0;

  const years = [...new Set(model.eventNodes.map((e) => String(e.date || "").slice(0, 4)).filter(Boolean))].sort();
  years.forEach((y) => yearFilter.insertAdjacentHTML("beforeend", `<option value="${y}">${y}</option>`));
  const policies = [...new Set(model.eventNodes.map((e) => e.policy_type).filter(Boolean))].sort();
  policies.forEach((p) => policyFilter.insertAdjacentHTML("beforeend", `<option value="${p}">${p}</option>`));

  function getFilteredEvents() {
    const st = getState();
    return model.getEventsByFilter({
      year: st.selectedYear,
      policy: st.selectedPolicy,
    });
  }

  function setActiveEvent(eventId) {
    const p = model.getPathForEvent(eventId);
    const filtered = getFilteredEvents();
    const idx = filtered.findIndex((e) => e.id === eventId);
    if (idx >= 0) {
      const pageSize = Math.min(6, Math.max(5, filtered.length >= 6 ? 6 : filtered.length || 1));
      const newStart = Math.floor(idx / pageSize) * pageSize;
      if (newStart !== eventWindowStart) {
        eventWindowStart = newStart;
        model.eventWindowStart = eventWindowStart;
        targetLayout = computeLayout(model, stage.clientWidth, stage.clientHeight, filtered);
        transition = 0;
      }
    }
    setState({
      selectedEvent: eventId,
      activePath: p,
      newsModalEventId: null,
    });
    setTimelineActive(eventId);
    renderDetail(model, eventId);
    renderChain(model, eventId);
  }

  function selectNode(nodeId) {
    const node = model.nodeById.get(nodeId);
    if (!node) return;
    if (node.layer === "event") {
      setActiveEvent(nodeId);
      return;
    }
    renderDetail(model, nodeId);
    renderChain(model, null);
  }

  initTimeline(model, {
    onHover: (eventId) => {
      if (!eventId) {
        if (!getState().selectedEvent) setState({ activePath: { nodes: new Set(), edges: new Set() } });
        return;
      }
      if (getState().selectedEvent) return;
      setState({ activePath: model.getPathForEvent(eventId) });
    },
    onLeave: () => {
      if (!getState().selectedEvent) setState({ activePath: { nodes: new Set(), edges: new Set() } });
    },
    onSelect: setActiveEvent,
  });

  bindPanelClicks((eventId) => {
    setActiveEvent(eventId);
  });

  bindNewsModal(() => {
    setNewsModalOpen(false, model, null);
    setState({ newsModalEventId: null });
  });

  bindNewsButton(() => {
    const st = getState();
    const eid = st.selectedEvent;
    const n = eid ? model.nodeById.get(eid) : null;
    if (n && n.layer === "event") {
      setNewsModalOpen(true, model, eid);
      setState({ newsModalEventId: eid });
    }
  });

  attachCanvasInteractions(canvas, () => layout, model, {
    onHover: (id) => {
      const selected = getState().selectedEvent;
      if (!selected && id && model.nodeById.get(id)?.layer === "event") {
        setState({ activePath: model.getPathForEvent(id) });
      }
      if (!selected && !id) {
        setState({ activePath: { nodes: new Set(), edges: new Set() } });
      }
    },
    onSelectEvent: setActiveEvent,
    onSelectNode: selectNode,
  });

  function applyFilters(opts = {}) {
    const { preserveTimelineOffset = false } = opts;
    const events = getFilteredEvents();
    setTimelineEvents(events, { preserveOffset: preserveTimelineOffset });
    const pageSize = Math.min(6, Math.max(5, events.length >= 6 ? 6 : events.length || 1));
    const maxStart = Math.max(0, events.length - pageSize);
    eventWindowStart = Math.min(eventWindowStart, maxStart);
    model.eventWindowStart = eventWindowStart;
    setState({ filteredEventIds: new Set(events.map((e) => e.id)) });
    targetLayout = computeLayout(model, stage.clientWidth, stage.clientHeight, events);
    if (!layout) layout = targetLayout;
    transition = 0;
    const page = Math.floor(eventWindowStart / pageSize) + 1;
    const total = Math.max(1, Math.ceil(events.length / pageSize));
    if (windowIndicator) windowIndicator.textContent = `${page} / ${total}`;
    if (prevBtn) {
      prevBtn.disabled = !targetLayout.hasPrevWindow;
      prevBtn.style.opacity = targetLayout.hasPrevWindow ? "1" : "0.45";
    }
    if (nextBtn) {
      nextBtn.disabled = !targetLayout.hasNextWindow;
      nextBtn.style.opacity = targetLayout.hasNextWindow ? "1" : "0.45";
    }
  }

  function syncLayerBands(layoutInfo) {
    if (!layoutInfo?.layerBands) return;
    for (const [k, b] of Object.entries(layoutInfo.layerBands)) {
      const el = bandEls[k];
      if (!el || !b) continue;
      el.style.left = `${b.x - b.rx}px`;
      el.style.top = `${b.y - b.ry}px`;
      el.style.width = `${b.rx * 2}px`;
      el.style.height = `${b.ry * 2}px`;
    }
  }

  yearFilter.addEventListener("change", (e) => {
    setState({ selectedYear: e.target.value });
    applyFilters();
  });
  policyFilter.addEventListener("change", (e) => {
    setState({ selectedPolicy: e.target.value });
    eventWindowStart = 0;
    applyFilters();
  });
  prevBtn?.addEventListener("click", () => {
    const events = getFilteredEvents();
    const pageSize = Math.min(6, Math.max(5, events.length >= 6 ? 6 : events.length || 1));
    eventWindowStart = Math.max(0, eventWindowStart - pageSize);
    applyFilters();
  });
  nextBtn?.addEventListener("click", () => {
    const events = getFilteredEvents();
    const pageSize = Math.min(6, Math.max(5, events.length >= 6 ? 6 : events.length || 1));
    const maxStart = Math.max(0, events.length - pageSize);
    eventWindowStart = Math.min(maxStart, eventWindowStart + pageSize);
    applyFilters();
  });

  subscribe(() => {
    if (!layout) return;
    const st = getState();
    if (Math.abs((st.timelineOffset || 0) - lastTimelineOffset) > 0.0001) {
      lastTimelineOffset = st.timelineOffset || 0;
      model.timelineOffset = lastTimelineOffset;
      applyFilters({ preserveTimelineOffset: true });
    }
    renderOverlayLabels(overlay, model, layout, getState());
    syncLayerBands(layout);
  });

  renderDetail(model, null);
  renderChain(model, null);
  applyFilters();
  stats.innerHTML = `
    <div class="detail-row"><strong>事件数量</strong>${model.eventNodes.length}</div>
    <div class="detail-row"><strong>机制数量</strong>${model.mechanismNodes.length}</div>
    <div class="detail-row"><strong>关系数量</strong>${model.renderEdges.length}</div>
  `;

  const ro = new ResizeObserver(() => {
    applyFilters({ preserveTimelineOffset: true });
    renderer.resize();
  });
  ro.observe(stage);

  function tick(ts) {
    frame += 1;
    if (layout && targetLayout) {
      if (transition < 1) {
        transition = Math.min(1, transition + 0.16);
        const blendedNodes = new Map();
        for (const [id, b] of targetLayout.nodes) {
          const a = layout.nodes.get(id) || b;
          blendedNodes.set(id, {
            ...b,
            x: a.x + (b.x - a.x) * transition,
            y: a.y + (b.y - a.y) * transition,
          });
        }
        layout = { ...targetLayout, nodes: blendedNodes };
      } else {
        layout = targetLayout;
      }
      renderer.render({ model, layout, state: getState(), timeMs: ts });
      syncLayerBands(layout);
      if (frame % 3 === 0) renderOverlayLabels(overlay, model, layout, getState());
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

main().catch((err) => {
  console.error(err);
  document.getElementById("detail-content").innerHTML = `<p class="muted">加载失败：${err.message}。请用本地静态服务器打开（见 viz/README.md）。</p>`;
});
