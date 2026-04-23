import { setState } from "./state.js";

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s ?? "";
  return d.innerHTML;
}

const TIMELINE_WINDOW_SIZE = 10;
const timelineState = {
  events: [],
  offset: 0,
  selectedId: null,
  onHover: null,
  onLeave: null,
  onSelect: null,
  isDragging: false,
  dragMoved: false,
  dragStartX: 0,
  dragStartOffset: 0,
  downEventId: null,
};

function clampOffset(offset) {
  const maxOffset = Math.max(0, timelineState.events.length - TIMELINE_WINDOW_SIZE);
  return Math.max(0, Math.min(offset, maxOffset));
}

function updateWindowIndicator() {
  const el = document.getElementById("timeline-window-indicator");
  if (!el) return;
  const start = Math.floor(timelineState.offset) + 1;
  const end = Math.min(
    timelineState.events.length,
    Math.floor(timelineState.offset) + TIMELINE_WINDOW_SIZE,
  );
  el.textContent = `${start}-${end}`;
}

function renderTimelineWindow() {
  const root = document.getElementById("timeline-nodes");
  const tooltip = document.getElementById("timeline-tooltip");
  const activeDate = document.getElementById("timeline-active-date");
  if (!root || !tooltip || !activeDate) return;

  root.innerHTML = "";
  const width = root.clientWidth || 1;
  const minPx = width * 0.22;
  const maxPx = width * 0.78;
  const zoneWidth = Math.max(1, maxPx - minPx);
  const step = zoneWidth / Math.max(1, TIMELINE_WINDOW_SIZE - 1);

  timelineState.events.forEach((ev, idx) => {
    const x = minPx + (idx - timelineState.offset) * step;
    if (x < minPx - step || x > maxPx + step) return;
    const node = document.createElement("button");
    node.type = "button";
    node.className = "timeline-node";
    node.style.left = `${x}px`;
    node.dataset.eventId = ev.id;
    node.dataset.eventDate = ev.date || "";
    node.dataset.eventTitle = ev.title || ev.name || "";
    node.classList.toggle("active", timelineState.selectedId === ev.id);
    node.addEventListener("mouseenter", () => {
      node.classList.add("active");
      tooltip.setAttribute("aria-hidden", "false");
      tooltip.style.left = `${x}px`;
      tooltip.innerHTML = `<strong>${esc(ev.date || "-")}</strong><br/>${esc(ev.title || ev.name)}`;
      timelineState.onHover?.(ev.id);
    });
    node.addEventListener("mouseleave", () => {
      node.classList.toggle("active", timelineState.selectedId === ev.id);
      tooltip.setAttribute("aria-hidden", "true");
      timelineState.onLeave?.();
    });
    node.addEventListener("click", () => {
      activeDate.textContent = ev.date || "-";
      setTimelineActive(ev.id);
      timelineState.onSelect?.(ev.id);
    });
    root.appendChild(node);

    const label = document.createElement("div");
    label.className = "timeline-node-label";
    label.style.left = `${x}px`;
    const shortDate = String(ev.date || "-").slice(0, 10);
    const cleanTitle = String(ev.title || ev.name || "")
      .replace(/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\s*/, "")
      .replace(/^\d{4}[-/.]\d{1,2}\s*/, "");
    const shortTitle = cleanTitle.slice(0, 14);
    label.innerHTML = `<div class="timeline-label-date">${esc(shortDate)}</div><div class="timeline-label-title">${esc(shortTitle)}</div>`;
    root.appendChild(label);
  });
  updateWindowIndicator();
  setState({ timelineOffset: timelineState.offset });
}

export function initTimeline(model, { onHover, onLeave, onSelect }) {
  const timelineEl = document.getElementById("timeline");
  const prevBtn = document.getElementById("timeline-prev");
  const nextBtn = document.getElementById("timeline-next");
  timelineState.events = [...model.eventNodes].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  timelineState.offset = 0;
  timelineState.selectedId = null;
  timelineState.onHover = onHover;
  timelineState.onLeave = onLeave;
  timelineState.onSelect = onSelect;
  renderTimelineWindow();

  // Keep buttons but turn into small nudge controls.
  prevBtn?.addEventListener("click", () => {
    timelineState.offset = clampOffset(timelineState.offset - 1);
    renderTimelineWindow();
  });
  nextBtn?.addEventListener("click", () => {
    timelineState.offset = clampOffset(timelineState.offset + 1);
    renderTimelineWindow();
  });

  timelineEl?.addEventListener(
    "wheel",
    (e) => {
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      timelineState.offset = clampOffset(timelineState.offset + delta * 0.012);
      renderTimelineWindow();
      e.preventDefault();
    },
    { passive: false },
  );

  timelineEl?.addEventListener("pointerdown", (e) => {
    timelineState.isDragging = true;
    timelineState.dragMoved = false;
    timelineState.dragStartX = e.clientX;
    timelineState.dragStartOffset = timelineState.offset;
    const node = e.target.closest(".timeline-node");
    timelineState.downEventId = node?.dataset?.eventId || null;
  });
  timelineEl?.addEventListener("pointermove", (e) => {
    if (!timelineState.isDragging) return;
    const width = timelineEl.clientWidth || 1;
    const zoneWidth = Math.max(1, width * 0.56);
    const stepPx = zoneWidth / Math.max(1, TIMELINE_WINDOW_SIZE - 1);
    const deltaItems = (timelineState.dragStartX - e.clientX) / Math.max(1, stepPx);
    if (Math.abs(timelineState.dragStartX - e.clientX) > 4) timelineState.dragMoved = true;
    timelineState.offset = clampOffset(timelineState.dragStartOffset + deltaItems);
    renderTimelineWindow();
  });
  const endDrag = (e) => {
    if (!timelineState.dragMoved) {
      const targetNode = e?.target?.closest?.(".timeline-node");
      const id = targetNode?.dataset?.eventId || timelineState.downEventId;
      if (id) {
        const ev = timelineState.events.find((x) => x.id === id);
        const activeDate = document.getElementById("timeline-active-date");
        if (activeDate) activeDate.textContent = ev?.date || "-";
        setTimelineActive(id);
        timelineState.onSelect?.(id);
      }
    }
    timelineState.isDragging = false;
    timelineState.dragMoved = false;
    timelineState.downEventId = null;
  };
  timelineEl?.addEventListener("pointerup", endDrag);
  timelineEl?.addEventListener("pointercancel", endDrag);
  timelineEl?.addEventListener("pointerleave", endDrag);

  window.addEventListener("resize", () => renderTimelineWindow());
}

export function setTimelineEvents(events, opts = {}) {
  const { preserveOffset = false } = opts;
  const sorted = [...events].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  timelineState.events = sorted;
  timelineState.offset = clampOffset(preserveOffset ? timelineState.offset : 0);
  if (timelineState.selectedId && !sorted.some((e) => e.id === timelineState.selectedId)) {
    timelineState.selectedId = null;
    const activeDate = document.getElementById("timeline-active-date");
    if (activeDate) activeDate.textContent = "-";
  }
  renderTimelineWindow();
}

export function setTimelineActive(eventId) {
  timelineState.selectedId = eventId;
  const idx = timelineState.events.findIndex((e) => e.id === eventId);
  if (idx >= 0) {
    const targetOffset = idx - (TIMELINE_WINDOW_SIZE - 1) / 2;
    timelineState.offset = clampOffset(targetOffset);
  }
  renderTimelineWindow();
}
