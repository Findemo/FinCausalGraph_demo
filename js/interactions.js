import { setState, getState } from "./state.js";
import {
  renderDetail,
  renderChain,
  setTimeDrawerOpen,
  fillTimeDrawer,
  setNewsModalOpen,
} from "./panels.js";
import { applyHighlight } from "./render-svg.js";

/**
 * @param {ReturnType<import('./graph-model.js').buildGraphModel>} model
 * @param {SVGSVGElement} svg
 */
export function handleNodeClick(model, svg, nodeId) {
  const n = model.nodeById.get(nodeId);
  if (!n) return;

  if (n.type === "abstraction" || n.layer === 3) {
    const p = model.getPathForRoot();
    setState({
      selectedNodeId: nodeId,
      highlightNodes: p.nodes,
      highlightEdgeKeys: p.edgeKeys,
      focusedEventId: null,
      timeDrawerOpen: true,
      timeDrawerContextId: nodeId,
      timeDrawerMode: "root",
    });
    fillTimeDrawer(model, "root", null);
    setTimeDrawerOpen(true);
    renderDetail(model, nodeId);
    renderChain(model, null);
    applyHighlight(svg, getState());
    return;
  }

  if (n.layer === 2) {
    const p = model.getPathForL2Only(nodeId);
    setState({
      selectedNodeId: nodeId,
      highlightNodes: p.nodes,
      highlightEdgeKeys: p.edgeKeys,
      focusedEventId: null,
      timeDrawerOpen: true,
      timeDrawerContextId: nodeId,
      timeDrawerMode: "l2",
    });
    fillTimeDrawer(model, "l2", nodeId);
    setTimeDrawerOpen(true);
    renderDetail(model, nodeId);
    renderChain(model, null);
    applyHighlight(svg, getState());
    return;
  }

  if (n.layer === 1) {
    const events = model.getEventsUsingMechanism(nodeId);
    const p = model.unionPathsForEvents(events.map((e) => e.id));
    setState({
      selectedNodeId: nodeId,
      highlightNodes: p.nodes,
      highlightEdgeKeys: p.edgeKeys,
      focusedEventId: null,
      timeDrawerOpen: false,
      timeDrawerContextId: null,
      timeDrawerMode: null,
    });
    setTimeDrawerOpen(false);
    renderDetail(model, nodeId, { events, pickMode: events.length > 1 });
    renderChain(model, events.length === 1 ? events[0].id : null);
    applyHighlight(svg, getState());
    return;
  }

  if (n.layer === 0) {
    focusEvent(model, svg, nodeId);
  }
}

/**
 * @param {ReturnType<import('./graph-model.js').buildGraphModel>} model
 * @param {SVGSVGElement} svg
 */
export function focusEvent(model, svg, eventId) {
  const p = model.getPathForEvent(eventId);
  setState({
    selectedNodeId: eventId,
    highlightNodes: p.nodes,
    highlightEdgeKeys: p.edgeKeys,
    focusedEventId: eventId,
    timeDrawerOpen: false,
    timeDrawerContextId: null,
    timeDrawerMode: null,
  });
  setTimeDrawerOpen(false);
  renderDetail(model, eventId);
  renderChain(model, eventId);
  applyHighlight(svg, getState());
}

/**
 * @param {ReturnType<import('./graph-model.js').buildGraphModel>} model
 * @param {SVGSVGElement} svg
 */
export function attachSvgClickHandler(svg, model) {
  svg.addEventListener("click", (e) => {
    const g = e.target.closest(".graph-node");
    if (!g) return;
    const id = g.dataset.nodeId;
    if (id) handleNodeClick(model, svg, id);
  });
}
