import type { CanvasEdgeEndpoint, CanvasEdgeEndpoints, CanvasMeta, CanvasNodeMeta, GraphGroup, Viewport } from '../model/graphTypes';

export type SidecarNaming = 'dot-md-graph-json' | 'dot-graph-json';

export interface FileUriLike {
  fsPath: string;
  toString(): string;
}

export interface FileSystemAdapter {
  readFile(uri: FileUriLike): Promise<Uint8Array>;
  writeFile(uri: FileUriLike, content: Uint8Array): Promise<void>;
  rename(source: FileUriLike, target: FileUriLike, options?: { overwrite?: boolean }): Promise<void>;
  delete(uri: FileUriLike, options?: { useTrash?: boolean }): Promise<void>;
}

export interface ReadSidecarResult {
  meta: CanvasMeta | null;
  error?: string;
}

// Tạo đối tượng FileUri thích hợp cho môi trường VS Code hoặc Node.js thuần
export function toFileUri(fsPath: string): FileUriLike {
  try {
    const vscode = require('vscode');
    return vscode.Uri.file(fsPath);
  } catch {
    return {
      fsPath,
      toString: () => fsPath,
    };
  }
}

// Tạo URI file sidecar dựa trên tài liệu Markdown và quy ước đặt tên
export function computeSidecarUri(docUri: FileUriLike, naming: SidecarNaming = 'dot-md-graph-json'): FileUriLike {
  const fsPath = docUri.fsPath;
  const targetPath = naming === 'dot-graph-json' && fsPath.endsWith('.md')
    ? fsPath.slice(0, -3) + '.graph.json'
    : fsPath + '.graph.json';
  return toFileUri(targetPath);
}

export class SidecarStorageManager {
  private writeQueues = new Map<string, Promise<boolean>>();
  private recentWriteHashes = new Map<string, string>();

  constructor(private fsAdapter?: FileSystemAdapter) {}

  // Lấy adapter tương tác hệ thống tệp
  public getFs(): FileSystemAdapter {
    if (this.fsAdapter) return this.fsAdapter;
    try {
      const vscode = require('vscode');
      return vscode.workspace.fs;
    } catch {
      throw new Error('FileSystemAdapter is required when running outside VS Code');
    }
  }

  // Lấy URI file sidecar cho tài liệu Markdown
  public getSidecarUri(docUri: FileUriLike, naming: SidecarNaming = 'dot-md-graph-json'): FileUriLike {
    return computeSidecarUri(docUri, naming);
  }

  /**
   * Xác thực cấu trúc dữ liệu CanvasMeta theo schema version 1.
   */
  public validateSidecar(data: unknown): CanvasMeta | null {
    if (typeof data !== 'object' || data === null) return null;
    const candidate = data as Partial<CanvasMeta>;
    if (candidate.version !== 1) return null;
    if (candidate.revision !== undefined && (!Number.isInteger(candidate.revision) || candidate.revision < 0)) return null;
    if (typeof candidate.nodes !== 'object' || candidate.nodes === null) return null;
    for (const [nodeId, nodeMeta] of Object.entries(candidate.nodes)) {
      if (!nodeId || typeof nodeMeta !== 'object' || nodeMeta === null) return null;
      const meta = nodeMeta as Partial<CanvasNodeMeta>;
      if (typeof meta.x !== 'number' || !Number.isFinite(meta.x)) return null;
      if (typeof meta.y !== 'number' || !Number.isFinite(meta.y)) return null;
      if (meta.width !== undefined && (!Number.isFinite(meta.width) || meta.width <= 0)) return null;
      if (meta.height !== undefined && (!Number.isFinite(meta.height) || meta.height <= 0)) return null;
      if (meta.collapsed !== undefined && typeof meta.collapsed !== 'boolean') return null;
      if (meta.locked !== undefined && typeof meta.locked !== 'boolean') return null;
      if (meta.layer !== undefined && !Number.isFinite(meta.layer)) return null;
    }
    const vp = candidate.viewport;
    if (!vp || typeof vp.x !== 'number' || typeof vp.y !== 'number' || typeof vp.zoom !== 'number') return null;
    if (!Number.isFinite(vp.x) || !Number.isFinite(vp.y) || !Number.isFinite(vp.zoom) || vp.zoom <= 0) return null;

    const viewport: Viewport = { x: vp.x, y: vp.y, zoom: vp.zoom };
    const groups = validateGroups(candidate.groups);
    if (!groups) return null;
    const edges = validateEdges(candidate.edges);
    if (candidate.edges !== undefined && !edges) return null;

    return {
      version: 1,
      ...(candidate.revision !== undefined ? { revision: candidate.revision } : {}),
      nodes: candidate.nodes,
      groups,
      edges: edges ?? undefined,
      viewport,
    };
  }

  /**
   * Chuyển đổi dữ liệu CanvasMeta thành chuỗi JSON với thứ tự key ổn định.
   */
  public canonicalStringify(meta: CanvasMeta): string {
    const sortedNodes = Object.keys(meta.nodes).sort().reduce<CanvasMeta['nodes']>((acc, key) => {
      acc[key] = meta.nodes[key];
      return acc;
    }, {});
    const sortedGroups = Object.keys(meta.groups || {}).sort().reduce<CanvasMeta['groups']>((acc, key) => {
      acc[key] = meta.groups[key];
      return acc;
    }, {});
    const sortedEdges = meta.edges ? Object.keys(meta.edges).sort().reduce<NonNullable<CanvasMeta['edges']>>((acc, key) => {
      acc[key] = meta.edges![key];
      return acc;
    }, {}) : undefined;

    const canonicalObj = {
      version: 1,
      ...(meta.revision !== undefined ? { revision: meta.revision } : {}),
      nodes: sortedNodes,
      groups: sortedGroups,
      ...(sortedEdges ? { edges: sortedEdges } : {}),
      viewport: meta.viewport,
    };
    return JSON.stringify(canonicalObj, null, 2);
  }

  /**
   * Đọc và xác thực nội dung file sidecar của một tài liệu Markdown.
   */
  public async readSidecar(docUri: FileUriLike, naming: SidecarNaming = 'dot-md-graph-json'): Promise<ReadSidecarResult> {
    const sidecarUri = this.getSidecarUri(docUri, naming);
    try {
      const buffer = await this.getFs().readFile(sidecarUri);
      const text = new TextDecoder('utf-8').decode(buffer);
      const parsed = JSON.parse(text);
      const validated = this.validateSidecar(parsed);
      if (!validated) {
        return { meta: null, error: 'Invalid sidecar schema' };
      }
      this.recentWriteHashes.set(sidecarUri.toString(), this.canonicalStringify(validated));
      return { meta: validated };
    } catch (err: unknown) {
      return { meta: null, error: String(err) };
    }
  }

  // Ghi dữ liệu CanvasMeta trực tiếp vào file sidecar mà không xóa hay tạo lại file
  public async writeSidecar(docUri: FileUriLike, meta: CanvasMeta, naming: SidecarNaming = 'dot-md-graph-json'): Promise<boolean> {
    const uriKey = docUri.toString();
    const prevTask = this.writeQueues.get(uriKey) || Promise.resolve(true);

    const currentTask = prevTask.then(async () => {
      const sidecarUri = this.getSidecarUri(docUri, naming);
      const canonicalText = this.canonicalStringify(meta);
      if (this.recentWriteHashes.get(sidecarUri.toString()) === canonicalText) return true;
      const bytes = new TextEncoder().encode(canonicalText);
      const fs = this.getFs();

      try {
        await fs.writeFile(sidecarUri, bytes);
        this.recentWriteHashes.set(sidecarUri.toString(), canonicalText);
        return true;
      } catch (err) {
        console.error('SidecarStorageManager write error:', err);
        return false;
      }
    });

    this.writeQueues.set(uriKey, currentTask);
    return currentTask;
  }

  /**
   * Xóa file sidecar của một tài liệu Markdown nếu tồn tại.
   */
  public async deleteSidecar(docUri: FileUriLike, naming: SidecarNaming = 'dot-md-graph-json'): Promise<boolean> {
    const sidecarUri = this.getSidecarUri(docUri, naming);
    try {
      await this.getFs().delete(sidecarUri, { useTrash: false });
      this.recentWriteHashes.delete(sidecarUri.toString());
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Kiểm tra chuỗi dữ liệu vừa thay đổi có trùng khớp với lần ghi gần nhất của extension không.
   */
  public isSelfTriggeredWrite(sidecarUri: FileUriLike, content: string): boolean {
    const key = sidecarUri.toString();
    const lastContent = this.recentWriteHashes.get(key);
    return Boolean(lastContent && lastContent === content);
  }
}

function validateGroups(value: unknown): CanvasMeta['groups'] | null {
  if (value === undefined) return {};
  if (typeof value !== 'object' || value === null) return null;
  for (const [id, raw] of Object.entries(value)) {
    if (!id || typeof raw !== 'object' || raw === null) return null;
    const group = raw as Partial<GraphGroup>;
    if (![group.x, group.y, group.width, group.height].every((item) => typeof item === 'number' && Number.isFinite(item))) return null;
    if (typeof group.color !== 'string' || !Array.isArray(group.members) || !group.members.every((member) => typeof member === 'string')) return null;
  }
  return value as CanvasMeta['groups'];
}

function validateEdges(value: unknown): CanvasMeta['edges'] | null {
  if (value === undefined) return undefined;
  if (typeof value !== 'object' || value === null) return null;
  for (const [id, raw] of Object.entries(value)) {
    if (!id || !isEdgeEndpoints(raw)) return null;
  }
  return value as CanvasMeta['edges'];
}

function isEdgeEndpoints(value: unknown): value is CanvasEdgeEndpoints {
  if (typeof value !== 'object' || value === null) return false;
  const endpoints = value as Partial<CanvasEdgeEndpoints>;
  if (!isEdgeEndpoint(endpoints.source) || !isEdgeEndpoint(endpoints.target)) return false;
  return endpoints.guide === undefined
    || ((endpoints.guide.axis === 'x' || endpoints.guide.axis === 'y') && Number.isFinite(endpoints.guide.value));
}

function isEdgeEndpoint(value: unknown): value is CanvasEdgeEndpoint {
  if (typeof value !== 'object' || value === null) return false;
  const endpoint = value as Partial<CanvasEdgeEndpoint> & Record<string, unknown>;
  if (endpoint.kind === 'free') return Number.isFinite(endpoint.x) && Number.isFinite(endpoint.y);
  return endpoint.kind === 'node'
    && typeof endpoint.nodeId === 'string' && endpoint.nodeId.length > 0
    && Number.isFinite(endpoint.xRatio) && Number.isFinite(endpoint.yRatio)
    && (endpoint.xRatio as number) >= 0 && (endpoint.xRatio as number) <= 1
    && (endpoint.yRatio as number) >= 0 && (endpoint.yRatio as number) <= 1;
}
