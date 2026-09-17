/**
 * Styles for the canvas diagnostics surface: toolbar chip, issues panel and
 * node badges. Matches the dark minimal tokens defined in canvasStyles.ts.
 */
export function getCanvasDiagnosticsStyles(): string {
  return `
    /* Issues chip in the floating top toolbar */
    .mgs-diag-chip {
      display: inline-flex;
      align-items: center;
      height: 24px;
      padding: 0 9px;
      border: 1px solid color-mix(in srgb, #d2a32a 55%, var(--rule));
      border-radius: 7px;
      background: color-mix(in srgb, #d2a32a 14%, var(--panel));
      color: #e8c15c;
      font-size: 10.5px;
      font-weight: 600;
      gap: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
    .mgs-diag-chip:hover { background: color-mix(in srgb, #d2a32a 24%, var(--panel)); }

    /* Issues panel anchored below the top toolbar */
    .mgs-diag-panel {
      position: absolute;
      top: 54px;
      left: 175px;
      width: 330px;
      max-width: calc(100vw - 40px);
      max-height: 46vh;
      overflow-y: auto;
      z-index: 90;
      background: var(--panel);
      border: 1px solid var(--rule);
      border-radius: 10px;
      box-shadow: 0 10px 32px rgba(0,0,0,0.4);
      padding: 6px;
    }
    .mgs-diag-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 6px 6px;
      border-bottom: 1px solid var(--rule);
      margin-bottom: 4px;
    }
    .mgs-diag-title { font-size: 11px; font-weight: 600; color: var(--ink); }
    .mgs-diag-close {
      width: 20px;
      height: 20px;
      padding: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 5px;
      color: var(--muted);
      font-size: 11px;
    }
    .mgs-diag-close:hover { background: var(--hover-bg); color: var(--ink); }
    .mgs-diag-rows { display: flex; flex-direction: column; gap: 2px; }
    .mgs-diag-row {
      display: flex;
      align-items: baseline;
      gap: 6px;
      padding: 4px 6px;
      border-radius: 5px;
      font-size: 10.5px;
      line-height: 1.4;
    }
    .mgs-diag-row:hover { background: var(--hover-bg); }
    .mgs-diag-icon { flex-shrink: 0; font-size: 10px; }
    .mgs-diag-msg { flex: 1; word-break: break-word; color: var(--ink); }
    .mgs-diag-code {
      flex-shrink: 0;
      font-size: 9px;
      color: var(--muted);
      font-family: 'Cascadia Code', Consolas, monospace;
    }
    .mgs-diag-row-error .mgs-diag-icon { color: #f25555; }
    .mgs-diag-row-warning .mgs-diag-icon { color: #d2a32a; }
    .mgs-diag-row-info .mgs-diag-icon { color: var(--focus); }

    /* Warning badge pinned to the node header corner */
    .node-header { position: relative; }
    .node-diag-badge {
      position: absolute;
      top: -5px;
      right: -5px;
      min-width: 13px;
      height: 13px;
      padding: 0 3px;
      border-radius: 8px;
      background: #d2a32a;
      color: #181a1f;
      font-size: 9px;
      font-weight: 700;
      line-height: 13px;
      text-align: center;
      z-index: 7;
      pointer-events: none;
      box-shadow: 0 1px 4px rgba(0,0,0,0.35);
    }
    .node-diag-badge-error { background: #f25555; color: #ffffff; }
  `;
}
