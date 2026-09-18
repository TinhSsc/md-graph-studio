import { describe, expect, it } from 'vitest';
import { arrangeNodes, sortNodes, type ArrangeNodeInput } from '../src/layout/NodeArrangeEngine';

describe('NodeArrangeEngine', () => {
  const sampleNodes: ArrangeNodeInput[] = [
    { id: 'c', title: 'Cường', x: 200, y: 100, width: 100, height: 50 },
    { id: 'a', title: 'An', x: 50, y: 50, width: 120, height: 60 },
    { id: 'b', title: 'Bình', x: 100, y: 300, width: 100, height: 40 },
    { id: 'd', title: 'Dũng', x: 300, y: 400, width: 110, height: 50 }
  ];

  describe('sortNodes', () => {
    it('sorts alpha-asc with Vietnamese collation', () => {
      const sorted = sortNodes(sampleNodes, 'alpha-asc');
      expect(sorted.map(n => n.title)).toEqual(['An', 'Bình', 'Cường', 'Dũng']);
    });

    it('sorts alpha-desc with Vietnamese collation', () => {
      const sorted = sortNodes(sampleNodes, 'alpha-desc');
      expect(sorted.map(n => n.title)).toEqual(['Dũng', 'Cường', 'Bình', 'An']);
    });

    it('keeps visual reading order when sort is none', () => {
      const sorted = sortNodes(sampleNodes, 'none');
      expect(sorted[0].id).toBe('a'); // y = 50
      expect(sorted[1].id).toBe('c'); // y = 100
      expect(sorted[2].id).toBe('b'); // y = 300
      expect(sorted[3].id).toBe('d'); // y = 400
    });
  });

  describe('arrangeNodes', () => {
    it('arranges nodes vertically (dài xuống)', () => {
      const result = arrangeNodes(sampleNodes, { type: 'vertical', sort: 'alpha-asc', gap: 20 });
      expect(result).toHaveLength(4);

      // minX of sampleNodes is 50, minY is 50
      const an = result.find(r => r.id === 'a')!;
      const binh = result.find(r => r.id === 'b')!;
      const cuong = result.find(r => r.id === 'c')!;
      const dung = result.find(r => r.id === 'd')!;

      expect(an.x).toBe(50);
      expect(an.y).toBe(50);

      // An height is 60, gap is 20 -> next y = 50 + 60 + 20 = 130
      expect(binh.x).toBe(50);
      expect(binh.y).toBe(130);

      // Bình height is 40, gap is 20 -> next y = 130 + 40 + 20 = 190
      expect(cuong.x).toBe(50);
      expect(cuong.y).toBe(190);

      // Cường height is 50, gap is 20 -> next y = 190 + 50 + 20 = 260
      expect(dung.x).toBe(50);
      expect(dung.y).toBe(260);
    });

    it('arranges nodes horizontally (dài ngang)', () => {
      const result = arrangeNodes(sampleNodes, { type: 'horizontal', sort: 'alpha-asc', gap: 30 });
      expect(result).toHaveLength(4);

      const an = result.find(r => r.id === 'a')!;
      const binh = result.find(r => r.id === 'b')!;
      const cuong = result.find(r => r.id === 'c')!;
      const dung = result.find(r => r.id === 'd')!;

      expect(an.y).toBe(50);
      expect(an.x).toBe(50);

      // An width = 120, gap = 30 -> next x = 50 + 120 + 30 = 200
      expect(binh.y).toBe(50);
      expect(binh.x).toBe(200);

      // Bình width = 100, gap = 30 -> next x = 200 + 100 + 30 = 330
      expect(cuong.y).toBe(50);
      expect(cuong.x).toBe(330);

      // Cường width = 100, gap = 30 -> next x = 330 + 100 + 30 = 460
      expect(dung.y).toBe(50);
      expect(dung.x).toBe(460);
    });

    it('arranges nodes in square grid (hình vuông 2x2 for 4 nodes)', () => {
      const result = arrangeNodes(sampleNodes, { type: 'square', sort: 'alpha-asc', gap: 20 });
      expect(result).toHaveLength(4);

      // cols = ceil(sqrt(4)) = 2 cols
      // col 0: an (w: 120), cuong (w: 100) -> colWidth[0] = 120
      // col 1: binh (w: 100), dung (w: 110) -> colWidth[1] = 110
      // row 0: an (h: 60), binh (h: 40) -> rowHeight[0] = 60
      // row 1: cuong (h: 50), dung (h: 50) -> rowHeight[1] = 50

      const an = result.find(r => r.id === 'a')!;
      const binh = result.find(r => r.id === 'b')!;
      const cuong = result.find(r => r.id === 'c')!;
      const dung = result.find(r => r.id === 'd')!;

      // Row 0, Col 0
      expect(an.x).toBe(50);
      expect(an.y).toBe(50);

      // Row 0, Col 1 -> x = 50 + colWidth[0](120) + gap(20) = 190
      expect(binh.x).toBe(190);
      expect(binh.y).toBe(50);

      // Row 1, Col 0 -> y = 50 + rowHeight[0](60) + gap(20) = 130
      expect(cuong.x).toBe(50);
      expect(cuong.y).toBe(130);

      // Row 1, Col 1
      expect(dung.x).toBe(190);
      expect(dung.y).toBe(130);
    });

    it('does not move locked nodes', () => {
      const nodesWithLocked: ArrangeNodeInput[] = [
        { id: '1', title: 'Node 1', x: 10, y: 10, width: 100, height: 50, locked: true },
        { id: '2', title: 'Node 2', x: 100, y: 200, width: 100, height: 50, locked: false },
        { id: '3', title: 'Node 3', x: 300, y: 400, width: 100, height: 50, locked: false }
      ];

      const result = arrangeNodes(nodesWithLocked, { type: 'horizontal', gap: 20 });
      const lockedNode = result.find(r => r.id === '1')!;
      expect(lockedNode.x).toBe(10);
      expect(lockedNode.y).toBe(10);

      // Node 2 and Node 3 are arranged horizontally starting from min of unlocked (100, 200)
      const n2 = result.find(r => r.id === '2')!;
      const n3 = result.find(r => r.id === '3')!;
      expect(n2.x).toBe(100);
      expect(n2.y).toBe(200);
      expect(n3.x).toBe(100 + 100 + 20); // 220
      expect(n3.y).toBe(200);
    });
  });
});
