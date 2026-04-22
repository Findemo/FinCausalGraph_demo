import { loadGraphBundle } from "./data-loader.js";
import { buildGraphModel } from "./graph-model.js";
import { computeLayout } from "./layout.js";
import { renderGraphSvg, applyHighlight } from "./render-svg.js";
import { getState, setState, subscribe } from "./state.js";
import {
  renderDetail,
  renderChain,
  bindPanelClicks,
  bindDrawerClose,
  bindNewsModal,
  bindNewsButton,
  setNewsModalOpen,
  setTimeDrawerOpen,
} from "./panels.js";
import { attachSvgClickHandler, focusEvent } from "./interactions.js";

async function main() {
  const bundle = await loadGraphBundle();
  const model = buildGraphModel(bundle);
  const layout = computeLayout(model);
  const svg = document.getElementById("layer-graph");
  renderGraphSvg(svg, model, layout);

  attachSvgClickHandler(svg, model);

  bindPanelClicks((eventId) => {
    focusEvent(model, svg, eventId);
  });

  bindDrawerClose(() => {
    setTimeDrawerOpen(false);
    setState({ timeDrawerOpen: false });
  });

  bindNewsModal(() => {
    setNewsModalOpen(false, model, null);
    setState({ newsModalEventId: null });
  });

  bindNewsButton(() => {
    const st = getState();
    const eid = st.focusedEventId || st.selectedNodeId;
    const n = eid && model.nodeById.get(eid);
    if (n && n.layer === 0) {
      setNewsModalOpen(true, model, eid);
      setState({ ...getState(), newsModalEventId: eid });
    }
  });

  subscribe(() => {
    applyHighlight(svg, getState());
  });

  renderDetail(model, null);
  renderChain(model, null);
  applyHighlight(svg, getState());
}

main().catch((err) => {
  console.error(err);
  document.getElementById("detail-content").innerHTML = `<p class="muted">加载失败：${err.message}。请用本地静态服务器打开（见 viz/README.md）。</p>`;
});
