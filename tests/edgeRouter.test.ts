import { describe, expect, it } from 'vitest';
import { getCanvasEdgeRouterScript } from '../src/webview/canvasEdgeRouter';
import { getCanvasEdgeSegmentsScript } from '../src/webview/canvasEdgeSegments';
import { getCanvasGeometryScript } from '../src/webview/canvasGeometry';
import { getCanvasEdgeEndpointsScript } from '../src/webview/canvasEdgeEndpoints';

type Point = { x: number; y: number };
type Box = { left: number; right: number; top: number; bottom: number };
type Endpoint = { point: Point; direction: 'top' | 'right' | 'bottom' | 'left' | null };

const router = new Function(`${getCanvasEdgeRouterScript()}${getCanvasEdgeSegmentsScript()}; return { calculateOrthogonalRoute, calculateGuidedOrthogonalRoute, normalizedEdgeGuide, roundedOrthogonalPath };`)() as {
  calculateOrthogonalRoute: (source: Endpoint, target: Endpoint, obstacles: Box[]) => Point[];
  calculateGuidedOrthogonalRoute: (source: Endpoint, target: Endpoint, guide: { axis: 'x' | 'y'; value: number }) => Point[];
  normalizedEdgeGuide: (edge: { endpoints: { guide?: { axis: 'x' | 'y'; value: number } } }, geometry: { p1: Point; p2: Point }) => { axis: 'x' | 'y'; value: number } | null;
  roundedOrthogonalPath: (points: Point[]) => string;
};

if (typeof (globalThis as unknown as { CSS?: unknown }).CSS === 'undefined') {
  (globalThis as unknown as { CSS: { escape: (s: string) => string } }).CSS = { escape: (s: string) => s };
}
if (typeof (globalThis as unknown as { document?: unknown }).document === 'undefined') {
  (globalThis as unknown as { document: { querySelector: () => null } }).document = { querySelector: () => null };
}

const geometryHelper = new Function('findNode', 'graph', `${getCanvasEdgeRouterScript()}${getCanvasEdgeEndpointsScript()}${getCanvasGeometryScript()}; return { calculateEdgeGeometry, endpointForNode };`);

function isOrthogonal(points: Point[]): boolean {
  return points.slice(1).every((point, index) => point.x === points[index].x || point.y === points[index].y);
}

function crossesBox(a: Point, b: Point, box: Box): boolean {
  if (a.y === b.y) return a.y > box.top && a.y < box.bottom && Math.max(a.x, b.x) > box.left && Math.min(a.x, b.x) < box.right;
  return a.x > box.left && a.x < box.right && Math.max(a.y, b.y) > box.top && Math.min(a.y, b.y) < box.bottom;
}

describe('orthogonal edge router', () => {
  it('collapses an aligned route to a straight connector', () => {
    const route = router.calculateOrthogonalRoute({ point: { x: 0, y: 0 }, direction: 'right' }, { point: { x: 200, y: 0 }, direction: null }, []);
    expect(route).toEqual([{ x: 0, y: 0 }, { x: 200, y: 0 }]);
    expect(router.roundedOrthogonalPath(route)).toBe('M 0 0 L 200 0');
  });

  it('creates a clean rounded S topology for opposing ports', () => {
    const route = router.calculateOrthogonalRoute({ point: { x: 0, y: 0 }, direction: 'right' }, { point: { x: 200, y: 80 }, direction: 'left' }, []);
    expect(isOrthogonal(route)).toBe(true);
    expect(route.length).toBeLessThanOrEqual(6);
    expect(router.roundedOrthogonalPath(route)).toContain(' Q ');
  });

  it('keeps the source-axis leg extended before turning', () => {
    const route = router.calculateOrthogonalRoute({ point: { x: 0, y: 0 }, direction: 'top' }, { point: { x: 120, y: -200 }, direction: null }, []);
    expect(route).toEqual([{ x: 0, y: 0 }, { x: 0, y: -200 }, { x: 120, y: -200 }]);
  });

  it('keeps a dragged segment guide until it folds near an endpoint', () => {
    const guide = { axis: 'y' as const, value: 120 };
    const route = router.calculateGuidedOrthogonalRoute({ point: { x: 0, y: 0 }, direction: 'right' }, { point: { x: 200, y: 80 }, direction: 'left' }, guide);
    expect(route.some((point) => point.y === 120)).toBe(true);
    expect(router.normalizedEdgeGuide({ endpoints: { guide } }, { p1: { x: 0, y: 0 }, p2: { x: 200, y: 80 } })).toEqual(guide);
    expect(router.normalizedEdgeGuide({ endpoints: { guide: { axis: 'y', value: 10 } } }, { p1: { x: 0, y: 0 }, p2: { x: 200, y: 80 } })).toBeNull();
  });

  it('routes around a padded obstacle', () => {
    const obstacle = { left: 80, right: 120, top: -30, bottom: 30 };
    const route = router.calculateOrthogonalRoute({ point: { x: 0, y: 0 }, direction: 'right' }, { point: { x: 200, y: 0 }, direction: null }, [obstacle]);
    expect(isOrthogonal(route)).toBe(true);
    expect(route.slice(1).every((point, index) => !crossesBox(route[index], point, obstacle))).toBe(true);
  });

  it('goes around the source when the pointer moves behind its port', () => {
    const sourceBox = { left: -18, right: 118, top: -18, bottom: 118 };
    const route = router.calculateOrthogonalRoute({ point: { x: 100, y: 50 }, direction: 'right' }, { point: { x: -80, y: 50 }, direction: null }, [sourceBox]);
    expect(route[1].x).toBeGreaterThan(100);
    expect(route.slice(2).every((point, index) => !crossesBox(route[index + 1], point, sourceBox))).toBe(true);
  });

  it('depends only on current geometry, not earlier pointer routes', () => {
    const source: Endpoint = { point: { x: 0, y: 0 }, direction: 'right' };
    const first = router.calculateOrthogonalRoute(source, { point: { x: 180, y: -90 }, direction: null }, []);
    router.calculateOrthogonalRoute(source, { point: { x: -120, y: 100 }, direction: null }, []);
    const repeated = router.calculateOrthogonalRoute(source, { point: { x: 180, y: -90 }, direction: null }, []);
    expect(repeated).toEqual(first);
  });

  it('calculateEdgeGeometry falls back to fromPort and toPort positions when endpoints are undefined', () => {
    const nodes = [
      { id: 'nodeA', x: 0, y: 0, width: 100, height: 60 },
      { id: 'nodeB', x: 300, y: 0, width: 100, height: 60 },
    ];
    const findNode = (id: string) => nodes.find((n) => n.id === id);
    const { calculateEdgeGeometry } = geometryHelper(findNode, { nodes });

    const edgeWithPorts = {
      id: 'nodeA>nodeB#0',
      source: 'nodeA',
      target: 'nodeB',
      fromPort: 'right',
      toPort: 'left',
    };
    const geom = calculateEdgeGeometry(edgeWithPorts);
    expect(geom).toBeDefined();
    // nodeA right port: x = 0 + 100 = 100, y = 0 + 30 = 30
    expect(geom.p1).toEqual({ x: 100, y: 30 });
    // nodeB left port: x = 300, y = 0 + 30 = 30
    expect(geom.p2).toEqual({ x: 300, y: 30 });
  });

  it('endpointForNode snaps to middle 0.5 when cursor is near port center', () => {
    const { endpointForNode } = geometryHelper(() => null, { nodes: [] });

    const node = { id: 'test', x: 100, y: 100, width: 200, height: 100 };
    // Near the left edge (x=101), slightly below middle (y=155 vs 150)
    const ep = endpointForNode({ x: 101, y: 155 }, node);
    expect(ep.xRatio).toBe(0);
    expect(ep.yRatio).toBe(0.5);
  });
});
