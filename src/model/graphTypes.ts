export const nodeShapes = ['rectangle', 'rounded-rectangle', 'circle', 'ellipse', 'diamond', 'triangle'] as const;
export const nodeColors = ['gray', 'blue', 'green', 'yellow', 'red', 'purple'] as const;
export const arrowTypes = ['forward', 'backward', 'both', 'none'] as const;
export const lineStyles = ['solid', 'dashed', 'dotted'] as const;
export const pathStyles = ['orthogonal'] as const;
export const ports = ['top', 'right', 'bottom', 'left'] as const;

export type NodeShape = (typeof nodeShapes)[number];
export type ArrowType = (typeof arrowTypes)[number];
export type LineStyle = (typeof lineStyles)[number];
export type PathStyle = (typeof pathStyles)[number];
export type Port = (typeof ports)[number];
export type LayoutDirection = 'top-to-bottom' | 'left-to-right';

export const defaultNodeWidth = 240;
export const defaultNodeHeight = 160;

export interface SourceRange { start: number; end: number; }
export interface GraphNode {
  id: string;
  title: string;
  content: string;
  shape: NodeShape;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  collapsed: boolean;
  locked: boolean;
  ghost: boolean;
  sourceRange?: SourceRange;
}
export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  arrow: ArrowType;
  line: LineStyle;
  path: PathStyle;
  color?: string;
  fromPort?: Port;
  toPort?: Port;
  sourceRange: SourceRange;
  endpoints?: CanvasEdgeEndpoints;
}
export interface CanvasNodeMeta { x: number; y: number; width?: number; height?: number; }
export type CanvasEdgeEndpoint =
  | { kind: 'node'; nodeId: string; xRatio: number; yRatio: number }
  | { kind: 'free'; x: number; y: number };
export interface CanvasEdgeGuide { axis: 'x' | 'y'; value: number; }
export interface CanvasEdgeEndpoints { source: CanvasEdgeEndpoint; target: CanvasEdgeEndpoint; guide?: CanvasEdgeGuide; }
export interface GraphGroup {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  members: string[];
}
export interface Viewport { x: number; y: number; zoom: number; }
export interface CanvasMeta {
  version: number;
  nodes: Record<string, CanvasNodeMeta>;
  groups: Record<string, GraphGroup>;
  edges?: Record<string, CanvasEdgeEndpoints>;
  viewport: Viewport;
}
export interface GraphDiagnostic { message: string; offset?: number; }
export interface GraphDocument {
  preamble: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  meta?: CanvasMeta;
  diagnostics: GraphDiagnostic[];
}
