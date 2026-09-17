/**
 * Cung cấp style CSS cho thanh công cụ, popover, menu ngữ cảnh và các thành phần Markdown mở rộng.
 */
export function getCanvasActionBarStyles(): string {
  return `
    #node-action-bar, #action-image-menu, #node-popover {
      position: fixed; z-index: 60; display: none;
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 10px;
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35);
      color: var(--fg);
    }
    @supports ((backdrop-filter: blur(10px)) or (-webkit-backdrop-filter: blur(10px))) {
      #node-action-bar, #action-image-menu, #node-popover {
        background: rgba(30, 34, 40, 0.82);
        -webkit-backdrop-filter: blur(10px);
        backdrop-filter: blur(10px);
      }
    }

    #node-action-bar { flex-direction: row; align-items: center; gap: 2px; padding: 4px; }
    #node-action-bar button {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 28px; min-height: 28px; padding: 0 6px;
      background: transparent; border: none; border-radius: 7px;
      color: var(--fg); cursor: pointer;
    }
    #node-action-bar button:hover:not([disabled]) { background: var(--hover); }
    #node-action-bar button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
    #node-action-bar button[disabled] { opacity: 0.38; cursor: not-allowed; }
    #node-action-bar button.danger { color: #e57373; }
    .action-bar-divider { width: 1px; height: 18px; background: var(--border); margin: 0 3px; }

    /* Lock button: glyph mirrors node.locked, aria-pressed reflects state */
    #node-action-bar button[data-action="lock"] .lock-glyph-locked { display: none; }
    #node-action-bar button[data-action="lock"][aria-pressed="true"] { color: #d2a32a; }
    #node-action-bar button[data-action="lock"][aria-pressed="true"] .lock-glyph-locked { display: inline-flex; }
    #node-action-bar button[data-action="lock"][aria-pressed="true"] .lock-glyph-unlocked { display: none; }

    /* Icon picker popover */
    #icon-picker {
      position: fixed; z-index: 95; display: none; flex-direction: column;
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 10px;
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35);
      color: var(--fg);
      padding: 8px;
      min-width: 200px;
      max-width: 236px;
    }
    @supports ((backdrop-filter: blur(10px)) or (-webkit-backdrop-filter: blur(10px))) {
      #icon-picker {
        background: rgba(30, 34, 40, 0.82);
        -webkit-backdrop-filter: blur(10px);
        backdrop-filter: blur(10px);
      }
    }
    .icon-picker-header { font-size: 11px; font-weight: 600; color: var(--muted); padding: 0 2px 6px; }
    .icon-picker-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, 28px);
      gap: 3px;
      justify-content: center;
    }
    .icon-picker-item {
      display: inline-flex; align-items: center; justify-content: center;
      width: 28px; height: 28px; padding: 0;
      background: transparent; border: 1px solid transparent; border-radius: 6px;
      color: var(--fg); cursor: pointer;
    }
    .icon-picker-item:hover { background: var(--hover); border-color: var(--border); }
    .icon-picker-item svg { width: 14px; height: 14px; }
    .icon-picker-none {
      width: 100%; min-width: 0; height: 24px; margin-top: 6px;
      font-size: 11px; border: 1px solid var(--border); border-radius: 6px;
      justify-content: center;
    }

    #action-image-menu { flex-direction: column; padding: 4px; min-width: 168px; }
    #action-image-menu.open { display: flex; }
    #action-image-menu button {
      display: flex; align-items: center; gap: 7px;
      min-height: 28px; padding: 5px 9px;
      background: transparent; border: none; border-radius: 7px;
      color: var(--fg); font-size: 12px; text-align: left; cursor: pointer;
    }
    #action-image-menu button:hover, #action-image-menu button:focus-visible { background: var(--hover); outline: none; }
    #action-image-menu button:focus-visible { outline: 2px solid var(--accent); }

    #node-popover { width: 280px; padding: 0; }
    #node-popover[style*="display: block"], #node-popover[style*="display:block"] { display: block; }
    .popover-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 10px; border-bottom: 1px solid var(--border);
      font-size: 12.5px; font-weight: 600;
    }
    #popover-body { padding: 10px; display: flex; flex-direction: column; gap: 8px; }
    .popover-field { display: flex; flex-direction: column; gap: 4px; }
    .field-label { font-size: 11px; color: var(--muted); }
    .field-error { font-size: 11px; color: #e57373; min-height: 0; }
    .popover-field input, .popover-field textarea {
      width: 100%; box-sizing: border-box;
      background: var(--bg); border: 1px solid var(--border); border-radius: 6px;
      color: var(--fg); font-size: 12px; padding: 6px 8px; font-family: inherit;
    }
    .popover-field textarea { resize: vertical; font-family: var(--mono, monospace); }
    .popover-field input.invalid, .popover-field textarea.invalid { border-color: #e57373; }
    .popover-field input:focus-visible, .popover-field textarea:focus-visible { outline: 2px solid var(--accent); outline-offset: 0; border-color: transparent; }
    .popover-confirm { margin: 0; font-size: 12.5px; line-height: 1.5; }
    #popover-error { margin: 0; padding: 0 10px 8px; font-size: 11px; color: #e57373; }

    .popover-actions { display: flex; justify-content: flex-end; gap: 6px; margin-top: 6px; }
    .popover-actions button {
      min-height: 26px; padding: 4px 10px; font-size: 11.5px;
      border-radius: 5px; cursor: pointer; border: 1px solid var(--border);
      background: var(--bg); color: var(--fg);
    }
    .popover-actions button:hover { background: var(--hover); }
    .popover-actions button.btn-submit { background: var(--accent, #3b82f6); color: #fff; border-color: transparent; }
    .popover-actions button.btn-submit:hover { filter: brightness(1.1); }
    .popover-actions button.btn-submit.danger { background: #d32f2f; color: #fff; border-color: transparent; }

    .node-code-block {
      max-height: 140px; overflow-y: auto; position: relative;
    }
    .node-code-block[data-lang]::before {
      content: attr(data-lang);
      position: absolute; top: 4px; right: 6px;
      font-size: 9px; color: var(--muted);
      background: rgba(0, 0, 0, 0.28); padding: 1px 5px; border-radius: 3px;
      pointer-events: none;
    }



    .node-link.external-link .external-icon {
      font-size: 9px; opacity: 0.75; display: inline-block; margin-left: 2px;
    }
    .node-blocked-link { color: #e57373; font-style: italic; font-size: 11px; }

    .toast-region { position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); z-index: 90; display: flex; flex-direction: column; gap: 6px; align-items: center; pointer-events: none; }
    .toast {
      background: var(--panel); border: 1px solid var(--border); border-radius: 8px;
      color: var(--fg); font-size: 12px; padding: 8px 14px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
      animation: toast-in 160ms ease-out;
    }
    .toast-error { border-color: #a4545c; color: #f2a6a6; }
    @keyframes toast-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

    @media (prefers-reduced-motion: reduce) {
      .toast { animation: none; }
      #node-action-bar, #action-image-menu, #node-popover { transition: none; }
    }
  `;
}
