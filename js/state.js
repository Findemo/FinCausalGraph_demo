/** @type {{
 * hoveredNode: string | null,
 * selectedEvent: string | null,
 * activePath: {nodes:Set<string>, edges:Set<string>},
 * filteredEventIds: Set<string>,
 * selectedPolicy: string | "all",
 * selectedYear: string | "all",
 * selectedMarket: string | "all",
 * timelineOffset: number,
 * newsModalEventId: string | null
 * }} */
const state = {
  hoveredNode: null,
  selectedEvent: null,
  activePath: { nodes: new Set(), edges: new Set() },
  filteredEventIds: new Set(),
  selectedPolicy: "all",
  selectedYear: "all",
  selectedMarket: "all",
  timelineOffset: 0,
  newsModalEventId: null,
};

const listeners = new Set();

export function getState() {
  return state;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setState(patch) {
  Object.assign(state, patch);
  if (patch.activePath != null) {
    state.activePath = {
      nodes:
        patch.activePath.nodes instanceof Set
          ? patch.activePath.nodes
          : new Set(patch.activePath.nodes || []),
      edges:
        patch.activePath.edges instanceof Set
          ? patch.activePath.edges
          : new Set(patch.activePath.edges || []),
    };
  }
  if (patch.filteredEventIds != null) {
    state.filteredEventIds =
      patch.filteredEventIds instanceof Set
        ? patch.filteredEventIds
        : new Set(patch.filteredEventIds || []);
  }
  listeners.forEach((fn) => fn(state));
}

export function resetActivePath() {
  state.activePath = { nodes: new Set(), edges: new Set() };
  state.hoveredNode = null;
  state.selectedEvent = null;
}
