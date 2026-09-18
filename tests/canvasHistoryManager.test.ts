import { describe, expect, it } from 'vitest';
import { CanvasHistoryManager, snapshotsEqual, type CanvasSnapshot } from '../src/state/CanvasHistoryManager';
import type { CanvasMeta } from '../src/model/graphTypes';

describe('CanvasHistoryManager', () => {
  const baseMeta: CanvasMeta = {
    version: 1,
    revision: 1,
    nodes: {
      'node-1': { x: 100, y: 100, width: 240, height: 160 },
    },
    groups: {},
    viewport: { x: 0, y: 0, zoom: 1 },
  };

  const initialSnapshot: CanvasSnapshot = {
    text: '## Node 1\nContent 1',
    meta: baseMeta,
  };

  it('snapshotsEqual correctly identifies equal and unequal snapshots', () => {
    expect(snapshotsEqual(initialSnapshot, { ...initialSnapshot })).toBe(true);

    const textChanged: CanvasSnapshot = {
      text: '## Node 1\nUpdated Content',
      meta: baseMeta,
    };
    expect(snapshotsEqual(initialSnapshot, textChanged)).toBe(false);

    const sizeChanged: CanvasSnapshot = {
      text: initialSnapshot.text,
      meta: {
        ...baseMeta,
        nodes: {
          'node-1': { x: 100, y: 100, width: 350, height: 220 },
        },
      },
    };
    expect(snapshotsEqual(initialSnapshot, sizeChanged)).toBe(false);
  });

  it('tracks undo and redo for layout resizing and moves', () => {
    const history = new CanvasHistoryManager();
    history.init(initialSnapshot);

    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);

    // User resizes node-1
    const resizedSnapshot: CanvasSnapshot = {
      text: initialSnapshot.text,
      meta: {
        ...baseMeta,
        nodes: {
          'node-1': { x: 100, y: 100, width: 380, height: 250 },
        },
      },
    };
    history.push(resizedSnapshot);

    expect(history.canUndo()).toBe(true);
    expect(history.canRedo()).toBe(false);

    // Undo should restore initialSnapshot with original width & height
    const undone = history.undo();
    expect(undone).not.toBeNull();
    expect(undone?.meta?.nodes['node-1'].width).toBe(240);
    expect(undone?.meta?.nodes['node-1'].height).toBe(160);
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(true);

    // Redo should restore resized dimensions
    const redone = history.redo();
    expect(redone).not.toBeNull();
    expect(redone?.meta?.nodes['node-1'].width).toBe(380);
    expect(redone?.meta?.nodes['node-1'].height).toBe(250);
    expect(history.canUndo()).toBe(true);
    expect(history.canRedo()).toBe(false);
  });

  it('clears redo stack when a new modification is pushed', () => {
    const history = new CanvasHistoryManager();
    history.init(initialSnapshot);

    const step1: CanvasSnapshot = {
      text: initialSnapshot.text,
      meta: {
        ...baseMeta,
        nodes: { 'node-1': { x: 150, y: 150, width: 240, height: 160 } },
      },
    };
    history.push(step1);
    history.undo();
    expect(history.canRedo()).toBe(true);

    // Pushing a new change branch should clear redo
    const step2: CanvasSnapshot = {
      text: initialSnapshot.text,
      meta: {
        ...baseMeta,
        nodes: { 'node-1': { x: 200, y: 200, width: 300, height: 200 } },
      },
    };
    history.push(step2);
    expect(history.canRedo()).toBe(false);

    const undone = history.undo();
    expect(undone?.meta?.nodes['node-1'].x).toBe(100);
  });
});
