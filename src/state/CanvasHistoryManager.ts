import type { CanvasMeta } from '../model/graphTypes';

export interface CanvasSnapshot {
  text: string;
  meta: CanvasMeta | null;
}

// So sánh sâu hai bản chụp trạng thái của canvas để xác định nội dung hoặc bố cục có thay đổi không
export function snapshotsEqual(a: CanvasSnapshot | null | undefined, b: CanvasSnapshot | null | undefined): boolean {
  if (!a || !b) return a === b;
  if (a.text !== b.text) return false;
  const aMeta = a.meta;
  const bMeta = b.meta;
  if (!aMeta || !bMeta) return aMeta === bMeta;

  const aNodeKeys = Object.keys(aMeta.nodes ?? {});
  const bNodeKeys = Object.keys(bMeta.nodes ?? {});
  if (aNodeKeys.length !== bNodeKeys.length) return false;
  for (const key of aNodeKeys) {
    const na = aMeta.nodes[key];
    const nb = bMeta.nodes[key];
    if (!nb) return false;
    if (na.x !== nb.x || na.y !== nb.y || na.width !== nb.width || na.height !== nb.height || na.layer !== nb.layer) {
      return false;
    }
  }

  const aEdgeKeys = Object.keys(aMeta.edges ?? {});
  const bEdgeKeys = Object.keys(bMeta.edges ?? {});
  if (aEdgeKeys.length !== bEdgeKeys.length) return false;
  for (const key of aEdgeKeys) {
    const ea = JSON.stringify(aMeta.edges?.[key]);
    const eb = JSON.stringify(bMeta.edges?.[key]);
    if (ea !== eb) return false;
  }

  return true;
}

export class CanvasHistoryManager {
  private undoStack: CanvasSnapshot[] = [];
  private redoStack: CanvasSnapshot[] = [];
  private current: CanvasSnapshot | null = null;
  private readonly maxDepth: number = 50;

  // Khởi tạo bản chụp ban đầu của tài liệu để làm điểm mốc cơ sở cho các thao tác hoàn tác
  public init(snapshot: CanvasSnapshot): void {
    if (!this.current) {
      this.current = this.cloneSnapshot(snapshot);
    }
  }

  // Đẩy bản chụp mới vào lịch sử hoàn tác nếu có sự khác biệt so với trạng thái hiện tại
  public push(snapshot: CanvasSnapshot): boolean {
    if (!this.current) {
      this.current = this.cloneSnapshot(snapshot);
      return false;
    }
    if (snapshotsEqual(this.current, snapshot)) {
      return false;
    }
    this.undoStack.push(this.current);
    if (this.undoStack.length > this.maxDepth) {
      this.undoStack.shift();
    }
    this.current = this.cloneSnapshot(snapshot);
    this.redoStack = [];
    return true;
  }

  // Lấy trạng thái trước đó trong ngăn xếp hoàn tác và lưu trạng thái hiện tại vào ngăn xếp làm lại
  public undo(): CanvasSnapshot | null {
    if (this.undoStack.length === 0 || !this.current) return null;
    const previous = this.undoStack.pop()!;
    this.redoStack.push(this.current);
    this.current = previous;
    return this.cloneSnapshot(previous);
  }

  // Lấy trạng thái kế tiếp trong ngăn xếp làm lại và lưu trạng thái hiện tại vào ngăn xếp hoàn tác
  public redo(): CanvasSnapshot | null {
    if (this.redoStack.length === 0 || !this.current) return null;
    const next = this.redoStack.pop()!;
    this.undoStack.push(this.current);
    this.current = next;
    return this.cloneSnapshot(next);
  }

  // Kiểm tra xem hiện tại có bản chụp nào trong lịch sử để thực hiện hoàn tác không
  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  // Kiểm tra xem hiện tại có bản chụp nào trong lịch sử để thực hiện làm lại không
  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  // Xóa sạch toàn bộ lịch sử hoàn tác và làm lại khi đóng hoặc làm mới tài liệu
  public clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.current = null;
  }

  // Tạo bản sao sâu của bản chụp canvas nhằm tránh các đột biến tham chiếu ngoài ý muốn
  private cloneSnapshot(snapshot: CanvasSnapshot): CanvasSnapshot {
    return {
      text: snapshot.text,
      meta: snapshot.meta ? JSON.parse(JSON.stringify(snapshot.meta)) : null,
    };
  }
}
