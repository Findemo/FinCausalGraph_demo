const detailContent = () => document.getElementById("detail-content");
const chainContent = () => document.getElementById("chain-content");
const newsActions = () => document.getElementById("news-actions");
const timeDrawer = () => document.getElementById("time-drawer");
const timeDrawerTitle = () => document.getElementById("time-drawer-title");
const timeDrawerBody = () => document.getElementById("time-drawer-body");
const newsModal = () => document.getElementById("news-modal");
const newsModalBody = () => document.getElementById("news-modal-body");
const newsModalTitle = () => document.getElementById("news-modal-title");

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s ?? "";
  return d.innerHTML;
}

/**
 * @param {ReturnType<import('./graph-model.js').buildGraphModel>} model
 * @param {string | null} nodeId
 * @param {{ events?: unknown[], pickMode?: boolean }} opts
 */
export function renderDetail(model, nodeId, opts = {}) {
  const el = detailContent();
  if (!nodeId || !model.nodeById.has(nodeId)) {
    el.className = "muted";
    el.innerHTML = "点击图中任意节点";
    return;
  }
  const n = model.nodeById.get(nodeId);
  el.className = "";
  const layerLabel =
    n.type === "abstraction"
      ? "抽象层（顶层）"
      : n.layer === 2
        ? "政策类型（Level 2）"
        : n.layer === 1
          ? "传导机制（Level 1）"
          : "具体事件（Level 0）";

  let html = `
    <div class="detail-row"><strong>名称</strong>${esc(n.name || n.title)}</div>
    <div class="detail-row"><strong>层级</strong>${esc(layerLabel)}</div>
  `;
  if (n.layer === 0) {
    html += `
      <div class="detail-row"><strong>日期</strong>${esc(n.date)}</div>
      <div class="detail-row"><strong>政策类型</strong>${esc(n.policy_type)}</div>
      <div class="detail-row"><strong>溯源</strong>${esc(n.text_ref)}</div>
    `;
  }
  el.innerHTML = html;

  if (opts.pickMode && opts.events?.length) {
    el.innerHTML += `<div class="event-pick"><h3>相关具体事件（点击收窄高亮）</h3>`;
    for (const ev of opts.events) {
      el.innerHTML += `<button type="button" class="js-pick-ev" data-ev="${esc(ev.id)}">${esc(ev.date)} · ${esc(ev.title)}</button>`;
    }
    el.innerHTML += `</div>`;
  }
}

/**
 * @param {ReturnType<import('./graph-model.js').buildGraphModel>} model
 * @param {string | null} eventId
 */
export function renderChain(model, eventId) {
  const el = chainContent();
  const btnBlock = newsActions();
  if (!eventId || !model.nodeById.get(eventId) || model.nodeById.get(eventId).layer !== 0) {
    el.className = "muted";
    el.textContent = "选中具体事件后显示";
    btnBlock.classList.add("hidden");
    return;
  }
  const names = model.getChainNames(eventId);
  const ids = model.getChainL1Ids(eventId);
  if (!names.length) {
    el.className = "muted";
    el.textContent = "无机制链数据";
    btnBlock.classList.remove("hidden");
    return;
  }
  el.className = "chain-steps";
  el.innerHTML = names
    .map((name, i) => {
      const step = `<span class="chain-step" data-l1-id="${esc(ids[i] || "")}">${esc(name)}</span>`;
      const arr = i < names.length - 1 ? `<span class="chain-arrow">→</span>` : "";
      return step + arr;
    })
    .join("");
  btnBlock.classList.remove("hidden");
}

export function setNewsModalOpen(open, model, eventId) {
  const modal = newsModal();
  if (!open || !eventId) {
    modal.setAttribute("aria-hidden", "true");
    return;
  }
  const ev = model.nodeById.get(eventId);
  if (!ev || ev.layer !== 0) {
    modal.setAttribute("aria-hidden", "true");
    return;
  }
  modal.setAttribute("aria-hidden", "false");
  newsModalTitle().textContent = ev.source_title || "原始新闻";
  newsModalBody().innerHTML = `
    <p><strong>发布时间</strong>：${esc(ev.source_published_at_raw || ev.date)}</p>
    <p><strong>来源</strong>：${esc(ev.source_org)}</p>
    <p><strong>摘要</strong></p>
    <p>${esc(ev.summary)}</p>
    <p><a href="${String(ev.source_link).replace(/"/g, "&quot;")}" target="_blank" rel="noopener">打开原文链接</a></p>
  `;
}

export function setTimeDrawerOpen(open) {
  timeDrawer().setAttribute("aria-hidden", open ? "false" : "true");
}

/**
 * @param {ReturnType<import('./graph-model.js').buildGraphModel>} model
 * @param {'root' | 'l2'} mode
 * @param {string | null} l2Id
 */
export function fillTimeDrawer(model, mode, l2Id) {
  const title = timeDrawerTitle();
  const body = timeDrawerBody();
  let events = [];
  if (mode === "root") {
    title.textContent = "货币政策 — 全部实例（按时间）";
    events = [...model.l0Nodes].sort((a, b) => a.date.localeCompare(b.date));
  } else if (l2Id) {
    const l2 = model.nodeById.get(l2Id);
    title.textContent = `${l2?.name || ""} — 时间线`;
    events = [...(model.l2IdToEvents.get(l2Id) || [])].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  }
  const byDate = new Map();
  for (const ev of events) {
    if (!byDate.has(ev.date)) byDate.set(ev.date, []);
    byDate.get(ev.date).push(ev);
  }
  const dates = [...byDate.keys()].sort();
  body.innerHTML = dates
    .map((d) => {
      const items = byDate
        .get(d)
        .map((ev) => {
          const chain = model.getChainNames(ev.id).join(" → ");
          return `<button type="button" class="time-item js-time-pick" data-ev="${esc(ev.id)}">
            <div class="time-item-title">${esc(ev.title)}</div>
            <div class="time-item-meta">${esc(ev.policy_type)} · ${esc(ev.text_ref)}</div>
            <div class="time-item-chain">${esc(chain)}</div>
          </button>`;
        })
        .join("");
      return `<div class="time-group"><h4>${esc(d)}</h4>${items}</div>`;
    })
    .join("");
}

export function bindPanelClicks(onPickEvent) {
  document.getElementById("detail-content")?.addEventListener("click", (e) => {
    const t = e.target.closest(".js-pick-ev");
    if (!t) return;
    const id = t.getAttribute("data-ev");
    if (id) onPickEvent(id);
  });
  document.getElementById("time-drawer-body")?.addEventListener("click", (e) => {
    const t = e.target.closest(".js-time-pick");
    if (!t) return;
    const id = t.getAttribute("data-ev");
    if (id) onPickEvent(id);
  });
}

export function bindDrawerClose(onClose) {
  document.getElementById("time-drawer-close")?.addEventListener("click", onClose);
  document.getElementById("time-drawer-backdrop")?.addEventListener("click", onClose);
}

export function bindNewsModal(onClose) {
  document.getElementById("news-modal-close")?.addEventListener("click", onClose);
  document.getElementById("news-modal-backdrop")?.addEventListener("click", onClose);
}

export function bindNewsButton(onOpen) {
  document.getElementById("btn-news")?.addEventListener("click", onOpen);
}
