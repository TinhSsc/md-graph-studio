export type ArrangeType = 'square' | 'vertical' | 'horizontal';
export type ArrangeSort = 'none' | 'alpha-asc' | 'alpha-desc';

export interface ArrangeNodeInput {
  id: string;
  title?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  locked?: boolean;
}

export interface ArrangeOptions {
  type: ArrangeType;
  sort?: ArrangeSort;
  gap?: number;
  cols?: number;
  startX?: number;
  startY?: number;
}

export interface ArrangeResult {
  id: string;
  x: number;
  y: number;
}

const DEFAULT_NODE_WIDTH = 240;
const DEFAULT_NODE_HEIGHT = 160;
const DEFAULT_GAP = 40;

/**
 * Sắp xếp thứ tự danh sách node theo tiêu chí.
 */
export function sortNodes<T extends ArrangeNodeInput>(nodes: readonly T[], sort: ArrangeSort = 'none'): T[] {
  const list = [...nodes];
  if (sort === 'alpha-asc') {
    return list.sort((a, b) => {
      const ta = (a.title || a.id || '').trim();
      const tb = (b.title || b.id || '').trim();
      return ta.localeCompare(tb, 'vi', { sensitivity: 'base', numeric: true });
    });
  }
  if (sort === 'alpha-desc') {
    return list.sort((a, b) => {
      const ta = (a.title || a.id || '').trim();
      const tb = (b.title || b.id || '').trim();
      return tb.localeCompare(ta, 'vi', { sensitivity: 'base', numeric: true });
    });
  }
  // 'none': giữ nguyên thứ tự đọc trực quan theo vị trí hiện tại (trên xuống dưới, trái qua phải)
  return list.sort((a, b) => {
    const dy = a.y - b.y;
    if (Math.abs(dy) > 30) return dy;
    return a.x - b.x;
  });
}

/**
 * Tính toán tọa độ x, y mới cho các node được chọn dựa trên kiểu bố cục.
 */
export function arrangeNodes<T extends ArrangeNodeInput>(
  nodes: readonly T[],
  options: ArrangeOptions
): ArrangeResult[] {
  if (!nodes || nodes.length === 0) return [];

  // Lọc các node không bị khóa để sắp xếp
  const unlocked = nodes.filter(n => !n.locked);
  if (unlocked.length === 0) {
    return nodes.map(n => ({ id: n.id, x: n.x, y: n.y }));
  }

  const gap = typeof options.gap === 'number' && options.gap >= 0 ? options.gap : DEFAULT_GAP;
  const sorted = sortNodes(unlocked, options.sort);

  const anchorX = typeof options.startX === 'number' ? options.startX : Math.min(...unlocked.map(n => n.x));
  const anchorY = typeof options.startY === 'number' ? options.startY : Math.min(...unlocked.map(n => n.y));

  const positioned = new Map<string, { x: number; y: number }>();

  if (options.type === 'vertical') {
    // Hình dài xuống: Xếp thành 1 cột dọc thẳng đứng
    let currY = anchorY;
    for (const node of sorted) {
      positioned.set(node.id, { x: Math.round(anchorX), y: Math.round(currY) });
      const h = typeof node.height === 'number' && node.height > 0 ? node.height : DEFAULT_NODE_HEIGHT;
      currY += h + gap;
    }
  } else if (options.type === 'horizontal') {
    // Hình dài ngang: Xếp thành 1 hàng ngang từ trái sang phải
    let currX = anchorX;
    for (const node of sorted) {
      positioned.set(node.id, { x: Math.round(currX), y: Math.round(anchorY) });
      const w = typeof node.width === 'number' && node.width > 0 ? node.width : DEFAULT_NODE_WIDTH;
      currX += w + gap;
    }
  } else {
    // Hình vuông (Grid): Căn lưới ma trận xấp xỉ hình vuông
    let cols = options.cols;
    if (!cols || cols < 1) {
      cols = Math.ceil(Math.sqrt(sorted.length));
    }
    cols = Math.max(1, Math.min(cols, sorted.length));
    const rows = Math.ceil(sorted.length / cols);

    const colWidths = new Array<number>(cols).fill(0);
    const rowHeights = new Array<number>(rows).fill(0);

    for (let i = 0; i < sorted.length; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const node = sorted[i];
      const w = typeof node.width === 'number' && node.width > 0 ? node.width : DEFAULT_NODE_WIDTH;
      const h = typeof node.height === 'number' && node.height > 0 ? node.height : DEFAULT_NODE_HEIGHT;
      colWidths[c] = Math.max(colWidths[c], w);
      rowHeights[r] = Math.max(rowHeights[r], h);
    }

    const colOffsets: number[] = [0];
    for (let c = 0; c < cols - 1; c++) {
      colOffsets.push(colOffsets[c] + colWidths[c] + gap);
    }
    const rowOffsets: number[] = [0];
    for (let r = 0; r < rows - 1; r++) {
      rowOffsets.push(rowOffsets[r] + rowHeights[r] + gap);
    }

    for (let i = 0; i < sorted.length; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const node = sorted[i];
      positioned.set(node.id, {
        x: Math.round(anchorX + colOffsets[c]),
        y: Math.round(anchorY + rowOffsets[r])
      });
    }
  }

  return nodes.map(n => {
    const pos = positioned.get(n.id);
    return pos ? { id: n.id, ...pos } : { id: n.id, x: n.x, y: n.y };
  });
}
