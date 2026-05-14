export function edgeGeometry(from, to, options = {}) {
  const nodeWidth = options.nodeWidth || 154;
  const nodeHeight = options.nodeHeight || 82;
  const source = { x: from.x, y: from.y + nodeHeight / 2 };
  const target = { x: to.x, y: to.y + nodeHeight / 2 };
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.hypot(dx, dy) || 1;
  const unit = { x: dx / distance, y: dy / distance };
  const start = rectEdgePoint(source, unit, nodeWidth, nodeHeight);
  const end = rectEdgePoint(target, { x: -unit.x, y: -unit.y }, nodeWidth, nodeHeight);
  const arrowGap = options.hasArrow === false ? 0 : 9;
  const edgeDistance = Math.hypot(end.x - start.x, end.y - start.y);
  const appliedArrowGap = Math.min(arrowGap, Math.max(0, edgeDistance - 2));
  const x1 = start.x;
  const y1 = start.y;
  const x2 = end.x - unit.x * appliedArrowGap;
  const y2 = end.y - unit.y * appliedArrowGap;

  return {
    x: Number(x1.toFixed(1)),
    y: Number(y1.toFixed(1)),
    x1: Number(x1.toFixed(1)),
    y1: Number(y1.toFixed(1)),
    x2: Number(x2.toFixed(1)),
    y2: Number(y2.toFixed(1)),
    length: Number(Math.hypot(x2 - x1, y2 - y1).toFixed(1)),
    angle: Number((Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI)).toFixed(2)),
  };
}

function rectEdgePoint(center, direction, width, height) {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  if (!direction.x && !direction.y) return center;
  const scaleX = direction.x ? halfWidth / Math.abs(direction.x) : Infinity;
  const scaleY = direction.y ? halfHeight / Math.abs(direction.y) : Infinity;
  const scale = Math.min(scaleX, scaleY);
  return {
    x: center.x + direction.x * scale,
    y: center.y + direction.y * scale,
  };
}
