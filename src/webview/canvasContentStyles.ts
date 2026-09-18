/**
 * Content styles for the rich markdown features rendered by
 * getCanvasMarkdownRendererScript(): highlight, h1, horizontal rule and
 * tables. Reuses the CSS custom properties defined by getCanvasStyles();
 * concatenated after it inside the webview.
 */
export function getCanvasContentStyles(): string {
  return `
    .node-mark {
      background: color-mix(in srgb, var(--focus) 28%, transparent);
      color: var(--ink);
      padding: 0 2px;
      border-radius: 3px;
    }
    .node-h1 {
      font-weight: 600;
      font-size: 13px;
      color: var(--ink);
      margin: 5px 0 2px 0;
    }
    .node-hr {
      border: none;
      border-top: 1px solid var(--rule);
      margin: 6px 0;
    }
    .node-table-wrap {
      margin: 5px 0;
      overflow-x: auto;
      border: 1px solid var(--rule);
      border-radius: 6px;
    }
    .node-table {
      border-collapse: collapse;
      width: 100%;
      font-size: 10px;
      line-height: 1.4;
    }
    .node-table th,
    .node-table td {
      border: 1px solid var(--rule);
      padding: 3px 6px;
      text-align: left;
      position: relative;
    }
    .node-table th {
      background: color-mix(in srgb, var(--panel) 80%, transparent);
      color: var(--ink);
      font-weight: 600;
      white-space: nowrap;
    }
    .node-table tbody tr:nth-child(even) {
      background: color-mix(in srgb, var(--ink) 4%, transparent);
    }
    .node-table-cell {
      cursor: cell;
      user-select: text;
      transition: background 0.1s ease;
    }
    .node-table-cell:hover {
      background: color-mix(in srgb, var(--accent) 14%, transparent) !important;
    }
    .node-table-cell[contenteditable="true"] {
      outline: 2px solid var(--accent) !important;
      outline-offset: -1px;
      background: var(--panel) !important;
      color: var(--ink) !important;
      cursor: text !important;
      border-radius: 2px;
      z-index: 2;
    }
  `;
}
