function positionOnEllipse(centerX, centerY, rx, ry, index, total, offset = -Math.PI / 2) {
  const angle = offset + (index / Math.max(1, total)) * Math.PI * 2;
  return { x: centerX + rx * Math.cos(angle), y: centerY + ry * Math.sin(angle) };
}

export function computeLayout(model, stageWidth, stageHeight, filteredEvents = null) {
  const width = Math.max(stageWidth || 1200, 760);
  const height = Math.max(stageHeight || 760, 620);
  const centerX = width * 0.5;

  const policyY = height * 0.1;
  const actionY = height * 0.29;
  const mechanismY = height * 0.58;
  const eventBaseY = height * 0.9;

  const actionRx = Math.min(width, 1060) * 0.45;
  const actionRy = Math.min(height, 860) * 0.09;
  const mechRx = Math.min(width, 1060) * 0.5;
  const mechRy = Math.min(height, 860) * 0.26;

  const nodes = new Map();
  nodes.set(model.policyNode.id, { x: centerX, y: policyY, r: 26, layer: "policy" });

  // Action layer: strict single horizontal row (no ring).
  const actionCount = model.actionNodes.length;
  model.actionNodes.forEach((n, i) => {
    const t = actionCount <= 1 ? 0.5 : i / (actionCount - 1);
    const x = centerX - actionRx + t * (actionRx * 2);
    const y = actionY;
    nodes.set(n.id, { x, y, r: 19, layer: "action" });
  });

  // Mechanism layer: maximize spacing via golden-angle fill over full ellipse.
  const golden = Math.PI * (3 - Math.sqrt(5));
  const mCount = Math.max(1, model.mechanismNodes.length);
  model.mechanismNodes.forEach((n, i) => {
    const rNorm = Math.sqrt((i + 0.5) / mCount); // spread from center to boundary
    const angle = i * golden;
    const x = centerX + mechRx * rNorm * Math.cos(angle);
    const y = mechanismY + mechRy * rNorm * Math.sin(angle);
    nodes.set(n.id, { x, y, r: 13, layer: "mechanism" });
  });

  const visibleEvents = filteredEvents || model.eventNodes;
  const windowSize = Math.min(6, Math.max(5, visibleEvents.length >= 6 ? 6 : visibleEvents.length || 1));
  const windowStart = Math.max(0, Math.min(model.eventWindowStart || 0, Math.max(0, visibleEvents.length - windowSize)));
  const eventWindow = visibleEvents.slice(windowStart, windowStart + windowSize);
  // Keep event anchors for path lines (event layer visuals removed, anchors hidden).
  const timelineOffset = Number.isFinite(model.timelineOffset) ? model.timelineOffset : 0;
  const anchorEvents = visibleEvents;
  const anchorMinX = width * 0.22;
  const anchorZoneW = width * 0.56;
  const anchorStep = anchorZoneW / Math.max(1, 10 - 1);
  anchorEvents.forEach((ev, i) => {
    const x = anchorMinX + (i - timelineOffset) * anchorStep;
    const y = height - 4;
    nodes.set(ev.id, { x, y, r: 9, layer: "event", hidden: true });
  });

  return {
    width,
    height,
    centerX,
    centerY: mechanismY,
    layerY: {
      policy: policyY,
      action: actionY,
      mechanism: mechanismY,
      event: eventBaseY,
    },
    layerBands: {
      policy: { x: centerX, y: policyY, rx: 120, ry: 34 },
      action: { x: centerX, y: actionY, rx: actionRx + 56, ry: 52 },
      mechanism: { x: centerX, y: mechanismY, rx: mechRx + 16, ry: mechRy + 16 },
    },
    nodes,
    visibleEvents,
    eventWindow,
    eventWindowStart: windowStart,
    eventWindowSize: windowSize,
    visibleEventIds: new Set(eventWindow.map((e) => e.id)),
    hasPrevWindow: windowStart > 0,
    hasNextWindow: windowStart + windowSize < visibleEvents.length,
  };
}

export function hitTestNode(layout, x, y) {
  for (const [id, n] of layout.nodes) {
    const dx = x - n.x;
    const dy = y - n.y;
    const limit = (n.r || 10) + 8;
    if (dx * dx + dy * dy <= limit * limit) return id;
  }
  return null;
}
