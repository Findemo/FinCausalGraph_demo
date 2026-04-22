/**
 * @typedef {Object} AppState
 * @property {string | null} selectedNodeId
 * @property {Set<string>} highlightNodes
 * @property {Set<string>} highlightEdgeKeys
 * @property {string | null} focusedEventId
 * @property {boolean} timeDrawerOpen
 * @property {string | null} timeDrawerContextId
 * @property {'l2' | 'root' | null} timeDrawerMode
 * @property {string | null} newsModalEventId
 */

/** @type {AppState} */
const state = {
  selectedNodeId: null,
  highlightNodes: new Set(),
  highlightEdgeKeys: new Set(),
  focusedEventId: null,
  timeDrawerOpen: false,
  timeDrawerContextId: null,
  timeDrawerMode: null,
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

/**
 * @param {Partial<AppState>} patch
 */
export function setState(patch) {
  Object.assign(state, patch);
  if (patch.highlightNodes != null) {
    state.highlightNodes =
      patch.highlightNodes instanceof Set
        ? patch.highlightNodes
        : new Set(patch.highlightNodes);
  }
  if (patch.highlightEdgeKeys != null) {
    state.highlightEdgeKeys =
      patch.highlightEdgeKeys instanceof Set
        ? patch.highlightEdgeKeys
        : new Set(patch.highlightEdgeKeys);
  }
  listeners.forEach((fn) => fn(state));
}

export function resetHighlight() {
  state.highlightNodes = new Set();
  state.highlightEdgeKeys = new Set();
  state.selectedNodeId = null;
  state.focusedEventId = null;
}
