// data-loader.js lives in js/ — graph_data/ is sibling directory at project root.
const GRAPH_BASE = new URL("../graph_data/", import.meta.url);

export async function loadGraphBundle() {
  const [nodesLevel2, nodesLevel1, nodesLevel0, edges, extractionLog] =
    await Promise.all([
      fetchJson("nodes_level2.json"),
      fetchJson("nodes_level1.json"),
      fetchJson("nodes_level0.json"),
      fetchJson("edges.json"),
      fetchJson("extraction_log.json"),
    ]);
  return {
    nodesLevel2,
    nodesLevel1,
    nodesLevel0,
    edges,
    extractionLog,
  };
}

async function fetchJson(name) {
  const res = await fetch(new URL(name, GRAPH_BASE));
  if (!res.ok) throw new Error(`Failed to load ${name}: ${res.status}`);
  return res.json();
}
