import { setState } from "./state.js";
import { hitTestNode } from "./layout.js";

export function attachCanvasInteractions(canvas, getLayout, model, handlers) {
  function getCanvasPoint(evt) {
    const rect = canvas.getBoundingClientRect();
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
  }

  canvas.addEventListener("mousemove", (evt) => {
    const layout = getLayout();
    if (!layout) return;
    const { x, y } = getCanvasPoint(evt);
    const id = hitTestNode(layout, x, y);
    setState({ hoveredNode: id });
    handlers.onHover?.(id);
  });

  canvas.addEventListener("mouseleave", () => {
    setState({ hoveredNode: null });
    handlers.onHover?.(null);
  });

  canvas.addEventListener("click", (evt) => {
    const layout = getLayout();
    if (!layout) return;
    const { x, y } = getCanvasPoint(evt);
    const id = hitTestNode(layout, x, y);
    if (!id) return;
    const node = model.nodeById.get(id);
    if (node?.layer === "event") {
      handlers.onSelectEvent?.(id);
    } else {
      handlers.onSelectNode?.(id);
    }
  });
}
