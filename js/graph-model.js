const L3_ID = "L3_MONETARY";

/** @param {Awaited<ReturnType<typeof import('./data-loader.js').loadGraphBundle>>} bundle */
export function buildGraphModel(bundle) {
  const { nodesLevel2, nodesLevel1, nodesLevel0, edges, extractionLog } =
    bundle;

  const rootNode = {
    id: L3_ID,
    name: "货币政策",
    type: "abstraction",
    layer: 3,
  };

  const l2Nodes = nodesLevel2.map((n) => ({ ...n, layer: 2 }));
  const l1Nodes = nodesLevel1.map((n) => ({ ...n, layer: 1 }));
  const l0Nodes = nodesLevel0.map((n) => ({ ...n, layer: 0 }));

  const nodeById = new Map();
  for (const n of [rootNode, ...l2Nodes, ...l1Nodes, ...l0Nodes]) {
    nodeById.set(n.id, n);
  }

  const l1NameToId = new Map(l1Nodes.map((n) => [n.name, n.id]));

  const virtualEdges = l2Nodes.map((n) => ({
    source: L3_ID,
    target: n.id,
    type: "abstract_link",
  }));

  const edgeKey = (s, t, ty) => `${s}|${t}|${ty}`;

  const eventIdToLog = new Map();
  for (const row of extractionLog.events || []) {
    eventIdToLog.set(row.event_node_id, row);
  }

  const l2IdToEvents = new Map();
  for (const l2 of l2Nodes) {
    l2IdToEvents.set(
      l2.id,
      l0Nodes.filter((e) => e.policy_type === l2.name),
    );
  }

  /** @type {Map<string, string>} eventId -> L2 id */
  const eventToL2 = new Map();
  for (const e of edges) {
    if (e.type === "instance_of") {
      eventToL2.set(e.target, e.source);
    }
  }

  /** 每个机制节点主要归属的政策类型（按共现事件数），用于径向分簇与 support_link */
  const l1PrimaryL2 = new Map();
  const l1L2Counts = new Map();
  for (const ev of l0Nodes) {
    const l2id = eventToL2.get(ev.id);
    if (!l2id) continue;
    const log = eventIdToLog.get(ev.id);
    const names = log?.mechanism_chain || [];
    for (const name of names) {
      const l1id = l1NameToId.get(name);
      if (!l1id) continue;
      if (!l1L2Counts.has(l1id)) l1L2Counts.set(l1id, new Map());
      const m = l1L2Counts.get(l1id);
      m.set(l2id, (m.get(l2id) || 0) + 1);
    }
  }
  for (const l1 of l1Nodes) {
    const m = l1L2Counts.get(l1.id);
    if (!m || m.size === 0) {
      l1PrimaryL2.set(l1.id, l2Nodes[0].id);
      continue;
    }
    let best = l2Nodes[0].id;
    let bestc = -1;
    for (const [l2id, c] of m) {
      if (c > bestc) {
        bestc = c;
        best = l2id;
      }
    }
    l1PrimaryL2.set(l1.id, best);
  }

  const syntheticEdges = [];
  for (const l1 of l1Nodes) {
    const src = l1PrimaryL2.get(l1.id);
    if (src)
      syntheticEdges.push({
        source: src,
        target: l1.id,
        type: "support_link",
      });
  }

  const allEdges = [...edges, ...virtualEdges, ...syntheticEdges];

  const edgeSet = new Set(allEdges.map((e) => edgeKey(e.source, e.target, e.type)));

  function getChainL1Ids(eventId) {
    const log = eventIdToLog.get(eventId);
    if (!log || !log.mechanism_chain) return [];
    return log.mechanism_chain
      .map((name) => l1NameToId.get(name))
      .filter(Boolean);
  }

  function getChainNames(eventId) {
    const log = eventIdToLog.get(eventId);
    return log?.mechanism_chain || [];
  }

  /**
   * Collect node ids and edge keys for one event's vertical slice (L3→L2→E→L1 chain).
   */
  function getPathForEvent(eventId) {
    const nodes = new Set();
    const eKeys = new Set();
    const l2id = eventToL2.get(eventId);
    if (!l2id) return { nodes, edgeKeys: eKeys };

    nodes.add(l2id);
    nodes.add(eventId);

    const chain = getChainL1Ids(eventId);
    if (chain.length === 0) return { nodes, edgeKeys: eKeys };

    // Event focus highlights only mechanism chain internals to avoid
    // large cross-layer white lines from hub/instance/trigger edges.
    for (const id of chain) {
      nodes.add(id);
    }

    for (let i = 0; i < chain.length - 1; i++) {
      const a = chain[i];
      const b = chain[i + 1];
      const k = edgeKey(a, b, "causal");
      if (edgeSet.has(k)) eKeys.add(k);
    }

    return { nodes, edgeKeys: eKeys };
  }

  function getEventsUsingMechanism(l1Id) {
    const name = nodeById.get(l1Id)?.name;
    if (!name) return [];
    return l0Nodes.filter((ev) => {
      const chain = getChainNames(ev.id);
      return chain.includes(name);
    });
  }

  function unionPathsForEvents(eventIds) {
    const nodes = new Set();
    const edgeKeys = new Set();
    for (const eid of eventIds) {
      const p = getPathForEvent(eid);
      p.nodes.forEach((n) => nodes.add(n));
      p.edgeKeys.forEach((k) => edgeKeys.add(k));
    }
    return { nodes, edgeKeys };
  }

  function getPathForL2Only(l2id) {
    const nodes = new Set([L3_ID, l2id]);
    const eKeys = new Set([edgeKey(L3_ID, l2id, "abstract_link")]);
    return { nodes, edgeKeys: eKeys };
  }

  function getPathForRoot() {
    const nodes = new Set([L3_ID, ...l2Nodes.map((n) => n.id)]);
    const eKeys = new Set(
      l2Nodes.map((n) => edgeKey(L3_ID, n.id, "abstract_link")),
    );
    return { nodes, edgeKeys: eKeys };
  }

  return {
    rootId: L3_ID,
    nodeById,
    l2Nodes,
    l1Nodes,
    l0Nodes,
    allEdges,
    edgeSet,
    edgeKey,
    l2IdToEvents,
    eventToL2,
    eventIdToLog,
    getChainL1Ids,
    getChainNames,
    getPathForEvent,
    getEventsUsingMechanism,
    unionPathsForEvents,
    getPathForL2Only,
    getPathForRoot,
    l1PrimaryL2,
    syntheticEdges,
  };
}
