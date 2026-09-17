/**
 * CSS for the floating format bar (#format-bar): compact Bold / Italic /
 * Highlight controls that do not consume permanent canvas width. Reuses the CSS
 * custom properties defined by getCanvasStyles().
 */
export function getCanvasFormatStyles(): string {
  return `
    #format-bar {
      position: fixed;
      left: 12px;
      bottom: 12px;
      z-index: 35;
      padding: 4px;
      border: 1px solid var(--rule);
      border-radius: 7px;
      background: color-mix(in srgb, var(--panel) 92%, transparent);
      box-shadow: 0 3px 12px rgba(0,0,0,0.24);
      display: flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }
    #format-bar button {
      width: 26px;
      height: 26px;
      padding: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--rule);
      border-radius: 5px;
      background: transparent;
      color: var(--muted);
      font-size: 11px;
      line-height: 1;
      cursor: pointer;
      transition: background 0.12s, color 0.12s, border-color 0.12s;
    }
    #format-bar button:hover {
      background: var(--hover-bg);
      color: var(--ink);
      border-color: var(--input-border);
    }
    #format-bar button[data-format="bold"] { font-weight: 700; }
    #format-bar button[data-format="italic"] { font-style: italic; font-family: Georgia, 'Times New Roman', serif; }
    #format-bar button[data-format="highlight"] {
      background: color-mix(in srgb, var(--focus) 22%, transparent);
      font-weight: 600;
    }
    #format-bar button[data-format="highlight"]:hover {
      background: color-mix(in srgb, var(--focus) 32%, transparent);
    }
    #format-bar button.disabled {
      opacity: 0.35;
      pointer-events: none;
      cursor: default;
    }
  `;
}
