/**
 * CSS for node identity cues: node icon, locked/ghost/collapsed states and collapse toggle.
 */
export function getCanvasNodeIdentityStyles(): string {
  return `
    .node-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--muted);
      flex-shrink: 0;
      opacity: 0.9;
    }
    .node-icon svg { display: block; width: 12px; height: 12px; }

    /* Locked: solid tinted border + striped header + lock glyph */
    .node.locked {
      border-width: 2px;
      border-style: solid;
      border-color: color-mix(in srgb, var(--node-color) 80%, var(--focus));
    }
    .node.locked .node-header {
      background-image: repeating-linear-gradient(45deg, transparent 0 6px, color-mix(in srgb, var(--node-color) 10%, transparent) 6px 12px);
    }
    .node.locked .node-header::after {
      content: '🔒';
      font-size: 9px;
      line-height: 1;
      margin-left: 2px;
      opacity: 0.85;
      flex-shrink: 0;
    }

    /* Ghost: unresolved link placeholder */
    .node.ghost {
      border-style: dashed;
      border-width: 1.5px;
      opacity: 0.55;
      cursor: default;
    }
    .node.ghost .node-title { font-style: italic; }

    /* Collapsed: compact card with hint row instead of body */
    .node.collapsed { box-shadow: 0 2px 10px rgba(0,0,0,0.18); }
    .node.collapsed .node-header { padding: 4px 8px 3px; }
    .node-collapsed-hint {
      padding: 3px 10px 5px;
      font-size: 10px;
      font-style: italic;
      color: var(--muted);
    }

    .node-collapse-toggle {
      width: 16px;
      height: 16px;
      min-width: 16px;
      padding: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: none;
      border-radius: 4px;
      color: var(--muted);
      cursor: pointer;
      flex-shrink: 0;
      opacity: 0.55;
      transition: opacity 0.12s, background 0.12s;
    }
    .node-collapse-toggle:hover { background: var(--hover-bg); color: var(--ink); opacity: 1; }
    .node-collapse-toggle svg { display: block; }

  `;
}
