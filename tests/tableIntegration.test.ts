import { describe, expect, it } from 'vitest';
import { appendNodeContent } from '../src/parser/NodeContentActions';
import { buildRichNodeContent } from '../src/providers/ContentActionRules';
import { updateNodeContentFromMessage } from '../src/providers/NodeContentMessages';
import { parseMarkdownGraph } from '../src/parser/MarkdownGraphParser';

describe('Table and Component Context Integration', () => {
  const docMarkdown = `# Architecture

## Test Node {#node-test}
<!-- graph-node: shape=rounded-rectangle; color=blue -->
Intro paragraph.

| Header 1 | Header 2 | Header 3 |
|:---------|:--------:|---------:|
| A        | B        | C        |
| D        | E        | F        |

Final note.
`;

  const getMockNode = () => {
    const graph = parseMarkdownGraph(docMarkdown);
    return graph.nodes.find((n) => n.id === 'node-test')!;
  };

  it('builds rich node content for table', () => {
    const tableContent = buildRichNodeContent('table', { kind: 'table', cols: 2, rows: 2 });
    expect(tableContent).toBeDefined();
    expect(tableContent).toContain('Header 1');
    expect(tableContent).toContain('Header 2');
    expect(tableContent).toContain('Row 1 Col 1');
  });

  it('appends table to node content via NodeContentActions', () => {
    const docText = `## Test Node {#node-test}\n<!-- graph-node: shape=rounded-rectangle; color=blue -->\nInitial text.`;
    const graph = parseMarkdownGraph(docText);
    const simpleNode = graph.nodes.find((n) => n.id === 'node-test')!;
    const updated = appendNodeContent(docText, simpleNode, { kind: 'table', cols: 3, rows: 2 });
    expect(updated).toBeDefined();
    expect(updated).toContain('Header 1');
    expect(updated).toContain('Row 1 Col 1');
  });

  it('updates table cell via updateNodeContentFromMessage', () => {
    const mockNode = getMockNode();
    const updated = updateNodeContentFromMessage(mockNode, {
      type: 'updateTableCell',
      tableIndex: 0,
      row: 0,
      col: 1,
      text: 'New Value B',
    });
    expect(updated).toBeDefined();
    expect(updated).toContain('New Value B');
    expect(updated).toContain('Header 1');
  });

  it('updates table cell in header via updateNodeContentFromMessage', () => {
    const mockNode = getMockNode();
    const updated = updateNodeContentFromMessage(mockNode, {
      type: 'updateTableCell',
      tableIndex: 0,
      row: -1,
      col: 0,
      text: 'Updated Header 1',
    });
    expect(updated).toBeDefined();
    expect(updated).toContain('Updated Header 1');
  });

  it('inserts row below via tableAction', () => {
    const mockNode = getMockNode();
    const updated = updateNodeContentFromMessage(mockNode, {
      type: 'tableAction',
      tableIndex: 0,
      row: 0,
      col: 0,
      action: 'insertRowBelow',
    });
    expect(updated).toBeDefined();
    expect(updated).toContain('A');
    expect(updated).toContain('D');
  });

  it('inserts column right via tableAction', () => {
    const mockNode = getMockNode();
    const updated = updateNodeContentFromMessage(mockNode, {
      type: 'tableAction',
      tableIndex: 0,
      row: 0,
      col: 1,
      action: 'insertColRight',
    });
    expect(updated).toBeDefined();
    expect(updated).toContain('Col 3');
  });

  it('deletes column via tableAction', () => {
    const mockNode = getMockNode();
    const updated = updateNodeContentFromMessage(mockNode, {
      type: 'tableAction',
      tableIndex: 0,
      row: 0,
      col: 1,
      action: 'deleteCol',
    });
    expect(updated).toBeDefined();
    expect(updated).not.toContain('Header 2');
    expect(updated).toContain('Header 1');
    expect(updated).toContain('Header 3');
  });

  it('spans cells via tableAction', () => {
    const mockNode = getMockNode();
    const updated = updateNodeContentFromMessage(mockNode, {
      type: 'tableAction',
      tableIndex: 0,
      row: 0,
      col: 0,
      action: 'spanCells',
      spanCount: 2,
    });
    expect(updated).toBeDefined();
    expect(updated).toContain('>');
  });

  it('changes column alignment via tableAction', () => {
    const mockNode = getMockNode();
    const updated = updateNodeContentFromMessage(mockNode, {
      type: 'tableAction',
      tableIndex: 0,
      row: 0,
      col: 0,
      action: 'setColAlign',
      align: 'right',
    });
    expect(updated).toBeDefined();
    expect(updated).toContain('---:');
  });

  it('deletes table via tableAction', () => {
    const mockNode = getMockNode();
    const updated = updateNodeContentFromMessage(mockNode, {
      type: 'tableAction',
      tableIndex: 0,
      action: 'deleteTable',
    });
    expect(updated).toBeDefined();
    expect(updated).not.toContain('| Header 1 |');
    expect(updated).toContain('Intro paragraph.');
    expect(updated).toContain('Final note.');
  });
});
