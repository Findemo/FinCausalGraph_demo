// js/ 与仓库根目录下的 graph_data/ 同级
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
