/**
 * Geometry and path calculation utilities for graph nodes and edges.
 */
export function getCanvasGeometryScript(): string {
  return `
    function getNodeBorderPoint(cx, cy, w, h, targetX, targetY) {
      const dx = targetX - cx;
      const dy = targetY - cy;
      if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return { x: cx, y: cy };
      const hw = Math.max(10, w / 2);
      const hh = Math.max(10, h / 2);
      const scaleX = hw / Math.abs(dx);
      const scaleY = hh / Math.abs(dy);
      const scale = Math.min(scaleX, scaleY);
      return {
        x: cx + dx * scale,
        y: cy + dy * scale
      };
    }

    function calculateEdgeGeometry(e) {
      const a = findNode(e.source);
      const b = findNode(e.target);
      if (!a || !b) return null;

      const aEl = document.querySelector('#node-' + CSS.escape(a.id));
      const bEl = document.querySelector('#node-' + CSS.escape(b.id));

      const aw = aEl ? aEl.offsetWidth : (a.width || 140);
      const ah = aEl ? aEl.offsetHeight : (a.height || 48);
      const bw = bEl ? bEl.offsetWidth : (b.width || 140);
      const bh = bEl ? bEl.offsetHeight : (b.height || 48);

      const acx = a.x + aw / 2;
      const acy = a.y + ah / 2;
      const bcx = b.x + bw / 2;
      const bcy = b.y + bh / 2;

      const defaultP1 = getNodeBorderPoint(acx, acy, aw, ah, bcx, bcy);
      const defaultP2 = getNodeBorderPoint(bcx, bcy, bw, bh, acx, acy);
      const p1 = resolveEndpoint(e.endpoints?.source) || defaultP1;
      const p2 = resolveEndpoint(e.endpoints?.target) || defaultP2;
      const sourceDirection = endpointDirection(e.endpoints?.source) || endpointDirection({ kind: 'node', xRatio: (p1.x - a.x) / aw, yRatio: (p1.y - a.y) / ah });
      const targetDirection = endpointDirection(e.endpoints?.target) || endpointDirection({ kind: 'node', xRatio: (p2.x - b.x) / bw, yRatio: (p2.y - b.y) / bh });
      const route = calculateConnectorRoute(p1, sourceDirection, p2, targetDirection, a.id, b.id, e.endpoints?.guide);
      const midpoint = route[Math.floor(route.length / 2)] || { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      return { d: roundedOrthogonalPath(route), mx: midpoint.x, my: midpoint.y, p1, p2, route };
    }
  `;
}
