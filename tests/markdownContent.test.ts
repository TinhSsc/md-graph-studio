import { describe, expect, it } from 'vitest';
import { parseMarkdownGraph } from '../src/parser/MarkdownGraphParser';

describe('Markdown rich content parsing', () => {
  it('preserves images, tasks, links, tags and code blocks in node body', () => {
    const markdown = [
      '## Architecture Node',
      '<!-- graph-node: shape=rounded-rectangle; color=blue -->',
      'Overview of the system with #architecture tag.',
      '',
      '![System Diagram](./assets/diagram.png)',
      '',
      '- [ ] Implement frontend',
      '- [x] Set up database',
      '',
      '```ts',
      'const port = 3000;',
      '```',
      '',
      '[API Docs](https://api.example.com)',
      '',
      '- [[Dashboard]]',
    ].join('\n');

    const graph = parseMarkdownGraph(markdown);
    expect(graph.nodes).toHaveLength(2); // Architecture Node + Dashboard (ghost)
    const archNode = graph.nodes.find((n) => n.id === 'Architecture Node')!;
    expect(archNode).toBeDefined();

    // Wiki-links are extracted into edges, not duplicated in body
    expect(archNode.content).toContain('![System Diagram](./assets/diagram.png)');
    expect(archNode.content).toContain('- [ ] Implement frontend');
    expect(archNode.content).toContain('- [x] Set up database');
    expect(archNode.content).toContain('```ts');
    expect(archNode.content).toContain('[API Docs](https://api.example.com)');
    expect(archNode.content).not.toContain('[[Dashboard]]');

    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].source).toBe('Architecture Node');
    expect(graph.edges[0].target).toBe('Dashboard');
  });

  it('correctly isolates multiple tasks in a node section', () => {
    const text = [
      '## Sprint Tasks',
      '- [ ] Step 1',
      '- [ ] Step 2',
      '- [x] Step 3',
    ].join('\n');

    const graph = parseMarkdownGraph(text);
    const node = graph.nodes[0];
    expect(node.content).toContain('- [ ] Step 1');
    expect(node.content).toContain('- [ ] Step 2');
    expect(node.content).toContain('- [x] Step 3');

    // Simulate task toggling logic
    const taskIndexToToggle = 1; // Step 2
    let index = -1;
    const toggled = node.content.replace(/([-*]\s*\[)([ xX])(\])/g, (match, prefix, state, suffix) => {
      index += 1;
      if (index === taskIndexToToggle) {
        const nextState = state.toLowerCase() === 'x' ? ' ' : 'x';
        return `${prefix}${nextState}${suffix}`;
      }
      return match;
    });

    expect(toggled).toContain('- [ ] Step 1');
    expect(toggled).toContain('- [x] Step 2');
    expect(toggled).toContain('- [x] Step 3');
  });
});
