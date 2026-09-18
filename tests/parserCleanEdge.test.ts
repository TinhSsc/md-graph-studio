import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseMarkdownGraph } from '../src/parser/MarkdownGraphParser';
import { serializeEdge } from '../src/parser/MarkdownGraphSerializer';
import { updateNodeDocument } from '../src/parser/NodeDocumentUpdater';
import type { GraphEdge } from '../src/model/graphTypes';

describe('Phase 1: Stable Node ID & Explicit Anchor Parsing', () => {
  const fixturesDir = path.join(__dirname, 'fixtures', 'sidecar');

  it('parses explicit anchor {#node-id} and separates it from display title', () => {
    const markdown = fs.readFileSync(path.join(fixturesDir, 'clean-canonical.md'), 'utf8');
    const graph = parseMarkdownGraph(markdown);

    expect(graph.nodes).toHaveLength(3);
    const authNode = graph.nodes.find((n) => n.id === 'auth-service');
    expect(authNode).toBeDefined();
    expect(authNode?.title).toBe('Authentication Service');
    expect(authNode?.title).not.toContain('{#');

    const dbNode = graph.nodes.find((n) => n.id === 'database-service');
    expect(dbNode).toBeDefined();
    expect(dbNode?.title).toBe('Database Service');
  });

  it('handles duplicate titles with distinct explicit IDs without colliding', () => {
    const markdown = fs.readFileSync(path.join(fixturesDir, 'duplicate-title-explicit-id.md'), 'utf8');
    const graph = parseMarkdownGraph(markdown);

    expect(graph.nodes).toHaveLength(2);
    expect(graph.nodes[0].id).toBe('auth-v1');
    expect(graph.nodes[0].title).toBe('Xác thực');
    expect(graph.nodes[1].id).toBe('auth-v2');
    expect(graph.nodes[1].title).toBe('Xác thực');

    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].source).toBe('auth-v1');
    expect(graph.edges[0].target).toBe('auth-v2');
    expect(graph.edges[0].label).toBe('Migrate to v2');
  });

  it('maps legacy title references to node explicit ID if matching title exists', () => {
    const markdown = `
## Authentication Service {#auth-service}
Validates tokens.

- [[Database Service]]

## Database Service {#db-cluster}
Primary DB.
    `.trim();

    const graph = parseMarkdownGraph(markdown);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].source).toBe('auth-service');
    expect(graph.edges[0].target).toBe('db-cluster');
  });
});

describe('Phase 1: Clean Edge Serialization (Omit Defaults)', () => {
  it('omits <!-- graph-edge --> comment when all edge attributes match defaults', () => {
    const edge: Pick<GraphEdge, 'label' | 'arrow' | 'line' | 'path' | 'color' | 'fromPort' | 'toPort'> = {
      label: 'Read user',
      arrow: 'forward',
      line: 'solid',
      path: 'orthogonal',
    };

    const serialized = serializeEdge('#database-service', edge);
    expect(serialized).toBe('- [[#database-service|Read user]]');
    expect(serialized).not.toContain('<!-- graph-edge');
  });

  it('only serializes non-default attributes into comment', () => {
    const edge: Pick<GraphEdge, 'label' | 'arrow' | 'line' | 'path' | 'color' | 'fromPort' | 'toPort'> = {
      label: 'Check fraud',
      arrow: 'forward',
      line: 'dashed',
      path: 'orthogonal',
      color: 'red',
    };

    const serialized = serializeEdge('#fraud-service', edge);
    expect(serialized).toBe('- [[#fraud-service|Check fraud]] <!-- graph-edge: line=dashed; color=red -->');
    expect(serialized).not.toContain('arrow=');
    expect(serialized).not.toContain('path=');
  });

  it('parses special-edges.md fixture correctly with non-default properties', () => {
    const fixturesDir = path.join(__dirname, 'fixtures', 'sidecar');
    const markdown = fs.readFileSync(path.join(fixturesDir, 'special-edges.md'), 'utf8');
    const graph = parseMarkdownGraph(markdown);

    const dashedEdge = graph.edges.find((e) => e.target === 'fraud-service');
    expect(dashedEdge).toBeDefined();
    expect(dashedEdge?.line).toBe('dashed');
    expect(dashedEdge?.color).toBe('red');

    const bothEdge = graph.edges.find((e) => e.target === 'ledger-service');
    expect(bothEdge).toBeDefined();
    expect(bothEdge?.arrow).toBe('both');

    const defaultEdge = graph.edges.find((e) => e.target === 'receipt-service');
    expect(defaultEdge).toBeDefined();
    expect(defaultEdge?.arrow).toBe('forward');
    expect(defaultEdge?.line).toBe('solid');
  });
});

describe('Phase 1: Renaming Preservation for Explicit IDs', () => {
  it('preserves {#node-id} and avoids breaking target links when title changes', () => {
    const markdown = `
## Authentication Service {#auth-service}
<!-- graph-node: shape=rounded-rectangle; color=blue -->
Old description.

- [[#database-service]]

## Database Service {#database-service}
<!-- graph-node: shape=rectangle; color=green -->
DB content.
    `.trim();

    const graph = parseMarkdownGraph(markdown);
    const authNode = graph.nodes.find((n) => n.id === 'auth-service')!;

    const updatedMarkdown = updateNodeDocument(markdown, graph, authNode, {
      title: 'Auth Gateway',
      content: 'Updated description.',
      shape: authNode.shape,
      color: authNode.color,
    });

    expect(updatedMarkdown).toContain('## Auth Gateway {#auth-service}');
    expect(updatedMarkdown).toContain('- [[#database-service]]');
    expect(updatedMarkdown).not.toContain('<!-- canvas-meta');

    const reparsed = parseMarkdownGraph(updatedMarkdown);
    expect(reparsed.nodes[0].id).toBe('auth-service');
    expect(reparsed.nodes[0].title).toBe('Auth Gateway');
  });
});
