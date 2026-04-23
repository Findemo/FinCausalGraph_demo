const detailContent = () => document.getElementById("detail-content");
const impactContent = () => document.getElementById("impact-content");
const chainContent = () => document.getElementById("chain-content");
const sourceContent = () => document.getElementById("sources-content");
const newsActions = () => document.getElementById("news-actions");
const newsModal = () => document.getElementById("news-modal");
const newsModalBody = () => document.getElementById("news-modal-body");
const newsModalTitle = () => document.getElementById("news-modal-title");

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s ?? "";
  return d.innerHTML;
}

function highlightImpact(text = "") {
  return esc(text)
    .replaceAll("上涨", '<span class="highlight">上涨</span>')
    .replaceAll("下跌", '<span class="highlight">下跌</span>')
    .replaceAll("回调", '<span class="highlight">回调</span>')
    .replaceAll("收紧", '<span class="highlight">收紧</span>');
}

export function renderDetail(model, nodeId) {
  const el = detailContent();
  const impactEl = impactContent();
  const sourceEl = sourceContent();
  if (!nodeId || !model.nodeById.has(nodeId)) {
    el.className = "muted";
    impactEl.className = "muted";
    sourceEl.className = "muted";
    el.innerHTML = "点击事件或时间轴节点查看详情";
    impactEl.innerHTML = "将自动提取影响描述并高亮关键词";
    sourceEl.innerHTML = "来源信息将在事件选中后展示";
    return;
  }
  const n = model.nodeById.get(nodeId);
  el.className = "";
  const layerLabel = n.layer;

  let html = `
    <div class="detail-row"><strong>名称</strong>${esc(n.name || n.title)}</div>
    <div class="detail-row"><strong>层级</strong>${esc(layerLabel)}</div>
  `;
  if (n.layer === "event") {
    html += `
      <div class="detail-row"><strong>日期</strong>${esc(n.date)}</div>
      <div class="detail-row"><strong>政策类型</strong>${esc(n.policy_type)}</div>
      <div class="detail-row"><strong>溯源</strong>${esc(n.text_ref)}</div>
    `;
  }
  el.innerHTML = html;

  if (n.layer === "event") {
    impactEl.className = "";
    sourceEl.className = "";
    impactEl.innerHTML = highlightImpact(n.summary || "暂无市场影响描述");
    sourceEl.innerHTML = `
      <div class="detail-row"><strong>机构</strong>${esc(n.source_org || "-")}</div>
      <div class="detail-row"><strong>发布时间</strong>${esc(n.source_published_at_raw || n.date || "-")}</div>
      <div class="detail-row"><strong>标题</strong>${esc(n.source_title || n.title || "-")}</div>
    `;
  } else {
    impactEl.className = "muted";
    sourceEl.className = "muted";
    impactEl.innerHTML = "请选择具体事件查看市场影响";
    sourceEl.innerHTML = "请选择具体事件查看来源信息";
  }
}

/**
 * @param {ReturnType<import('./graph-model.js').buildGraphModel>} model
 * @param {string | null} eventId
 */
export function renderChain(model, eventId) {
  const el = chainContent();
  const btnBlock = newsActions();
  if (!eventId || !model.nodeById.get(eventId) || model.nodeById.get(eventId).layer !== "event") {
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
  if (!ev || ev.layer !== "event") {
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

export function bindPanelClicks(onPickEvent) {
  document.getElementById("sources-content")?.addEventListener("click", (e) => {
    const t = e.target.closest(".js-pick-ev");
    if (!t) return;
    const id = t.getAttribute("data-ev");
    if (id) onPickEvent(id);
  });
}

export function bindNewsModal(onClose) {
  document.getElementById("news-modal-close")?.addEventListener("click", onClose);
  document.getElementById("news-modal-backdrop")?.addEventListener("click", onClose);
}

export function bindNewsButton(onOpen) {
  document.getElementById("btn-news")?.addEventListener("click", onOpen);
}
