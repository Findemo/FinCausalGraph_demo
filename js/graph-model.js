const POLICY_ID = "POLICY_ROOT";

/** @param {Awaited<ReturnType<typeof import('./data-loader.js').loadGraphBundle>>} bundle */
export function buildGraphModel(bundle) {
  const { nodesLevel2, nodesLevel1, nodesLevel0, edges, extractionLog } = bundle;

  const policyNode = { id: POLICY_ID, name: "货币政策", type: "policy", layer: "policy" };
  const actionNodes = nodesLevel2.map((n) => ({
    id: `ACT_${n.id}`,
    name: n.name,
    type: "action",
    layer: "action",
    policyType: n.name,
    sourceL2Id: n.id,
  }));
  const mechanismNodes = nodesLevel1.map((n) => ({ ...n, layer: "mechanism" }));
  const eventNodes = nodesLevel0.map((n) => ({ ...n, name: n.title || n.id, layer: "event" }));

  const nodeById = new Map([policyNode, ...actionNodes, ...mechanismNodes, ...eventNodes].map((n) => [n.id, n]));
  const l1NameToId = new Map(mechanismNodes.map((n) => [n.name, n.id]));
  const eventIdToLog = new Map((extractionLog.events || []).map((r) => [r.event_node_id, r]));
  const policyTypeToActionId = new Map(actionNodes.map((n) => [n.policyType, n.id]));

  /** @type {Map<string, string>} */
  const eventToAction = new Map();
  /** @type {Map<string, string[]>} */
  const eventToMechanisms = new Map();

  for (const ev of eventNodes) {
    const aid = policyTypeToActionId.get(ev.policy_type) || actionNodes[0]?.id || null;
    if (aid) eventToAction.set(ev.id, aid);
    const chainNames = eventIdToLog.get(ev.id)?.mechanism_chain || [];
    const mids = chainNames.map((n) => l1NameToId.get(n)).filter(Boolean);
    eventToMechanisms.set(ev.id, mids);
  }

  const renderEdges = [];
  const edgeKey = (source, target, type) => `${source}|${target}|${type}`;
  const pushEdge = (source, target, type, strength = 0.1) => {
    renderEdges.push({ source, target, type, key: edgeKey(source, target, type), strength });
  };

  for (const action of actionNodes) pushEdge(policyNode.id, action.id, "policy_action", 0.22);
  for (const ev of eventNodes) {
    const aid = eventToAction.get(ev.id);
    if (aid) pushEdge(aid, ev.id, "action_event", 0.16);
  }

  for (const ev of eventNodes) {
    const aid = eventToAction.get(ev.id);
    for (const mid of eventToMechanisms.get(ev.id) || []) {
      if (aid) pushEdge(aid, mid, "action_mechanism", 0.12);
      pushEdge(mid, ev.id, "mechanism_event", 0.08);
    }
  }

  for (const e of edges) {
    if (e.type === "causal" && nodeById.has(e.source) && nodeById.has(e.target)) {
      pushEdge(e.source, e.target, "causal", 0.1);
    }
  }

  function getChainNames(eventId) {
    return eventIdToLog.get(eventId)?.mechanism_chain || [];
  }

  function getChainL1Ids(eventId) {
    return (eventToMechanisms.get(eventId) || []).slice();
  }

  function getPathForEvent(eventId) {
    const nodes = new Set();
    const edgesInPath = new Set();
    const ev = nodeById.get(eventId);
    if (!ev || ev.layer !== "event") return { nodes, edges: edgesInPath };
    const aid = eventToAction.get(eventId);
    const mids = eventToMechanisms.get(eventId) || [];

    nodes.add(policyNode.id);
    nodes.add(eventId);
    if (aid) {
      nodes.add(aid);
      edgesInPath.add(edgeKey(policyNode.id, aid, "policy_action"));
      edgesInPath.add(edgeKey(aid, eventId, "action_event"));
    }
    for (const mid of mids) {
      nodes.add(mid);
      if (aid) edgesInPath.add(edgeKey(aid, mid, "action_mechanism"));
      edgesInPath.add(edgeKey(mid, eventId, "mechanism_event"));
    }
    for (let i = 0; i < mids.length - 1; i++) {
      edgesInPath.add(edgeKey(mids[i], mids[i + 1], "causal"));
    }
    return { nodes, edges: edgesInPath };
  }

  function getEventsByFilter({ policy = "all", year = "all" }) {
    return eventNodes.filter((ev) => {
      const yearOk = year === "all" ? true : String(ev.date || "").startsWith(`${year}`);
      const policyOk = policy === "all" ? true : ev.policy_type === policy;
      return yearOk && policyOk;
    });
  }

  return {
    policyNode,
    actionNodes,
    mechanismNodes,
    eventNodes,
    nodeById,
    renderEdges,
    edgeKey,
    getChainNames,
    getChainL1Ids,
    getPathForEvent,
    getEventsByFilter,
    eventToAction,
    eventToMechanisms,
    eventIdToLog,
  };
}
