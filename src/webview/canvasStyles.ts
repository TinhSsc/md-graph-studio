export function getCanvasStyles(): string {
  return `
    :root {
      --ink: var(--vscode-editor-foreground, #e0e0e0);
      --bg: var(--vscode-editor-background, #181a1f);
      --panel: var(--vscode-sideBar-background, #21242b);
      --rule: var(--vscode-panel-border, #333842);
      --focus: var(--vscode-focusBorder, #4d90fe);
      --muted: var(--vscode-descriptionForeground, #9da5b4);
      --card-bg: var(--vscode-editorWidget-background, #21252b);
      --input-bg: var(--vscode-input-background, #282c34);
      --input-border: var(--vscode-input-border, #3e4451);
      --hover-bg: var(--vscode-toolbar-hoverBackground, rgba(255,255,255,0.08));
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font: 12px var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
      overflow: hidden;
      user-select: none;
      width: 100vw;
      height: 100vh;
      display: flex;
    }
    button, input, textarea, select { font: inherit; color: var(--ink); }
    button {
      background: transparent;
      border: 1px solid transparent;
      border-radius: 6px;
      padding: 4px 7px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      line-height: 1;
    }
    button:hover { background: var(--hover-bg); }
    .icon-btn {
      width: 24px;
      height: 24px;
      padding: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 5px;
      color: var(--muted);
      cursor: pointer;
    }
    .icon-btn:hover { color: var(--ink); background: var(--hover-bg); }

    /* Compact Left Sidebar: Outline & Nodes */
    #sidebar-left {
      width: 155px;
      background: var(--panel);
      border-right: 1px solid var(--rule);
      display: flex;
      flex-direction: column;
      position: relative;
      z-index: 30;
      transition: margin-left 0.2s ease;
    }
    #sidebar-left.collapsed { margin-left: -155px; }
    .sidebar-header {
      padding: 9px 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--rule);
      font-weight: 600;
      font-size: 11.5px;
    }
    .outline-list { flex: 1; overflow-y: auto; padding: 6px 4px; }
    .sidebar-search-row {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 6px 8px;
      border-bottom: 1px solid var(--rule);
      color: var(--muted);
    }
    .sidebar-search-row > svg { flex-shrink: 0; }
    #search-box {
      flex: 1;
      width: 100%;
      min-width: 0;
      padding: 3px 7px;
      border-radius: 5px;
      border: 1px solid var(--input-border);
      background: var(--input-bg);
      font-size: 11px;
    }
    #search-count { font-size: 9.5px; color: var(--muted); white-space: nowrap; flex-shrink: 0; }
    .outline-item {
      padding: 4px 6px;
      border-radius: 5px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 2px;
      font-size: 11px;
      transition: background 0.12s;
    }
    .outline-item:hover { background: var(--hover-bg); }
    .outline-item.selected { background: color-mix(in srgb, var(--focus) 24%, transparent); font-weight: 600; color: #fff; }
    .outline-badge { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }

    #expand-sidebar-left {
      position: absolute;
      left: 10px;
      top: 12px;
      z-index: 35;
      background: var(--panel);
      border: 1px solid var(--rule);
      border-radius: 6px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      display: none;
    }
    #sidebar-left.collapsed ~ #canvas-container #expand-sidebar-left { display: flex; }

    /* Floating Top Quick Toolbar */
    #toolbar-top {
      position: absolute;
      top: 12px;
      left: calc(155px + 14px);
      height: 40px;
      background: color-mix(in srgb, var(--panel) 88%, transparent);
      backdrop-filter: blur(10px);
      border: 1px solid var(--rule);
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.25);
      padding: 4px;
      display: flex;
      align-items: center;
      gap: 4px;
      z-index: 25;
      transition: left 0.2s ease, transform 0.2s;
    }
    .toolbar-group {
      display: flex;
      align-items: center;
      gap: 2px;
      height: 30px;
      padding: 1px 2px;
      border-radius: 6px;
      border: 1px solid var(--rule);
      background: color-mix(in srgb, var(--ink) 5%, transparent);
    }
    #toolbar-top .toolbar-group > button {
      height: 26px;
      min-height: 26px;
      margin: 0;
    }
    #toolbar-top .toolbar-group > .icon-btn {
      width: 26px;
      min-width: 26px;
    }
    #toolbar-top #add { padding: 0 8px; }
    .menu-caret { display: inline-flex; margin-left: 1px; opacity: 0.65; }
    .menu-caret svg { width: 9px; height: 9px; }
    .picker-preview { display: inline-flex; align-items: center; }
    .picker-preview svg { width: 12px; height: 12px; }
    .color-dot-preview {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #4a98e5;
      box-shadow: 0 0 4px currentColor;
    }
    #sidebar-left.collapsed ~ #canvas-container #toolbar-top { left: 46px; }
    #toolbar-top.collapsed { transform: translateY(-55px); opacity: 0; pointer-events: none; }
    #expand-toolbar-top {
      position: absolute;
      top: 12px;
      left: calc(180px + 16px);
      z-index: 24;
      background: var(--panel);
      border: 1px solid var(--rule);
      border-radius: 7px;
      padding: 4px 9px;
      box-shadow: 0 3px 12px rgba(0,0,0,0.22);
      display: none;
      font-weight: 600;
      font-size: 11px;
    }
    #sidebar-left.collapsed ~ #canvas-container #expand-toolbar-top { left: 46px; }
    #toolbar-top.collapsed ~ #expand-toolbar-top { display: inline-flex; }
    .divider { width: 1px; height: 15px; background: var(--rule); margin: 0 2px; }

    /* Anchored dropdown menus for the quick toolbar (shape/color/arrange) */
    .toolbar-dropdown {
      position: fixed;
      z-index: 95;
      display: none;
      flex-direction: column;
      min-width: 150px;
      padding: 4px;
      background: color-mix(in srgb, var(--panel) 94%, transparent);
      backdrop-filter: blur(10px);
      border: 1px solid var(--rule);
      border-radius: 8px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.45);
    }
    .dropdown-item {
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 5px 8px;
      border: none;
      border-radius: 6px;
      font-size: 11.5px;
      color: var(--ink);
      cursor: pointer;
      text-align: left;
      text-transform: none;
    }
    .dropdown-item:hover { background: var(--hover-bg); }
    .dropdown-item svg { width: 12px; height: 12px; flex-shrink: 0; }
    .dropdown-dot { width: 11px; height: 11px; border-radius: 50%; flex-shrink: 0; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.25); }
    .toolbar-icon-menu { width: 196px; }
    .toolbar-icon-grid {
      display: grid;
      grid-template-columns: repeat(6, 28px);
      gap: 3px;
    }
    .toolbar-icon-grid .icon-picker-item {
      width: 28px;
      height: 28px;
      padding: 0;
      justify-content: center;
    }
    .toolbar-icon-menu .icon-picker-none { justify-content: center; margin-top: 4px; }

    /* Right Note Editor Card */
    #editor-right {
      position: absolute;
      top: 12px;
      right: 14px;
      width: 220px;
      max-height: calc(100vh - 80px);
      background: color-mix(in srgb, var(--panel) 92%, #181a1f);
      backdrop-filter: blur(12px);
      border: 1px solid var(--rule);
      border-radius: 10px;
      box-shadow: 0 8px 25px rgba(0,0,0,0.35);
      z-index: 25;
      display: flex;
      flex-direction: column;
      transition: transform 0.2s ease, opacity 0.2s;
    }
    #editor-right.collapsed { transform: translateX(250px); opacity: 0; pointer-events: none; }
    .editor-header {
      padding: 8px 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--rule);
      font-weight: 600;
      font-size: 11px;
    }
    .editor-body { flex: 1; overflow-y: auto; padding: 8px 10px; }
    .field { display: grid; gap: 3px; margin-bottom: 7px; }
    .field label { font-size: 10px; color: var(--muted); font-weight: 500; }
    input:not([type="checkbox"]):not([type="radio"]), textarea, select {
      width: 100%;
      padding: 4px 6px;
      border: 1px solid var(--input-border);
      background: var(--input-bg);
      border-radius: 5px;
      font-size: 11px;
    }
    textarea { min-height: 50px; height: 75px; max-height: 220px; resize: vertical; }
    .actions { display: flex; justify-content: space-between; gap: 6px; margin-top: 8px; }
    .btn-primary { background: var(--focus); color: #fff; border-radius: 5px; font-weight: 600; padding: 4px 10px; }
    .btn-secondary { width: 100%; justify-content: center; border-color: var(--input-border); margin-top: 2px; }
    .btn-danger { color: #f25555; }
    .btn-danger:hover { background: rgba(242, 85, 85, 0.15); }

    /* Bottom-Right Zoom Widget */
    #zoom-widget {
      position: absolute;
      right: 14px;
      bottom: 14px;
      height: 34px;
      background: color-mix(in srgb, var(--panel) 88%, transparent);
      backdrop-filter: blur(10px);
      border: 1px solid var(--rule);
      border-radius: 8px;
      box-shadow: 0 4px 14px rgba(0,0,0,0.22);
      padding: 2px 5px;
      display: flex;
      align-items: center;
      gap: 3px;
      z-index: 25;
    }
    #zoom-val { min-width: 38px; text-align: center; font-size: 11px; cursor: pointer; font-weight: 600; }

    /* Canvas Area with Dot Grid */
    #canvas-container { flex: 1; height: 100vh; position: relative; overflow: hidden; }
    #canvas {
      width: 100%;
      height: 100%;
      overflow: hidden;
      position: relative;
      background-image: radial-gradient(color-mix(in srgb, var(--ink) 24%, transparent) 1.5px, transparent 1.5px);
      background-size: 24px 24px;
      cursor: default;
      touch-action: none;
    }
    #canvas.panning { cursor: grabbing !important; }

    #world {
      position: absolute;
      left: 0;
      top: 0;
      width: 0;
      height: 0;
      transform-origin: 0 0;
      will-change: transform;
    }
    /* SVG Layer - width/height > 0 so SVG renderer is active without allocating huge GPU textures */
    svg#svg, svg#wire-svg, svg#edge-handles-svg {
      position: absolute;
      left: 0;
      top: 0;
      width: 1px;
      height: 1px;
      overflow: visible;
      pointer-events: none;
    }
    svg#svg { z-index: 1; }
    svg#wire-svg { z-index: 30; }
    svg#wire-svg, svg#wire-svg * { pointer-events: none !important; }
    svg#edge-handles-svg { z-index: 31; pointer-events: none; }
    svg#edge-handles-svg .edge-endpoint, svg#edge-handles-svg .edge-segment-handle { pointer-events: all; }
    .edge {
      fill: none;
      stroke: color-mix(in srgb, var(--muted) 85%, #fff 15%);
      stroke-width: 2.2;
      pointer-events: stroke;
      cursor: pointer;
      transition: stroke 0.15s, stroke-width 0.15s;
    }
    .edge:hover { stroke: var(--focus); stroke-width: 3.5; }
    .edge.selected { stroke: var(--focus); stroke-width: 4; }
    /* Invisible wide hit target: enlarges the clickable band of an edge
       without thickening the visible stroke. */
    .edge-hit {
      fill: none;
      stroke: transparent;
      stroke-width: 11;
      pointer-events: stroke;
      cursor: pointer;
    }
    .edge-hit:hover + .edge { stroke: var(--focus); stroke-width: 3.5; }
    .edge.temp {
      stroke: #4d90fe !important;
      stroke-width: 3px !important;
      stroke-dasharray: 6 4;
      pointer-events: none;
    }
    .edge-endpoint {
      fill: var(--focus);
      stroke: #ffffff;
      stroke-width: 2;
      cursor: move;
      pointer-events: all;
      vector-effect: non-scaling-stroke;
    }
    .edge-segment-handle {
      stroke: transparent;
      stroke-width: 9;
      stroke-linecap: round;
      opacity: 1;
      vector-effect: non-scaling-stroke;
      transition: opacity 0.12s, stroke-width 0.12s;
      cursor: grab;
    }
    .edge-segment-handle:hover, body.adjusting-edge .edge-segment-handle { stroke: var(--focus); opacity: 0.8; stroke-width: 10; cursor: grabbing; }
    .edge-segment-handle.horizontal { cursor: ns-resize; }
    .edge-segment-handle.vertical { cursor: ew-resize; }
    .edge-segment-knob {
      fill: var(--card-bg, #22252a);
      stroke: var(--focus, #4a98e5);
      stroke-width: 2;
      cursor: grab;
      pointer-events: all;
      transition: transform 0.12s, fill 0.12s;
    }
    .edge-segment-knob:hover {
      fill: var(--focus, #4a98e5);
      stroke: #ffffff;
      cursor: grabbing;
    }
    .edge-label-group {
      cursor: pointer;
      user-select: none;
      pointer-events: all;
    }
    .edge-label-bg {
      fill: var(--bg);
      stroke: none;
    }
    .edge-label-group:hover .edge-label-text,
    .edge-label-group.selected .edge-label-text {
      fill: var(--focus, #4a98e5);
      font-weight: 600;
    }
    .edge-label-text, .label {
      font-size: 11px;
      font-weight: 500;
      fill: var(--ink, #e0e6ed);
      pointer-events: none;
      font-family: inherit;
      transition: fill 0.12s;
    }
    .edge-inline-input {
      position: absolute;
      transform: translate(-50%, -50%);
      z-index: 60;
      background: var(--card-bg, #22252a);
      color: var(--ink, #e0e6ed);
      border: 1.5px solid var(--focus, #4a98e5);
      border-radius: 6px;
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 500;
      outline: none;
      box-shadow: 0 4px 14px rgba(0,0,0,0.4);
      min-width: 90px;
      text-align: center;
      font-family: inherit;
    }

    /* Cute & Modern Nodes: Auto-fit content with soft aesthetic */
    #nodes { position: absolute; left: 0; top: 0; z-index: 2; }
    .node {
      position: absolute;
      background: linear-gradient(160deg, color-mix(in srgb, var(--card-bg) 96%, #fff 4%), color-mix(in srgb, var(--card-bg) 92%, #000 8%));
      border: 1.5px solid color-mix(in srgb, var(--node-color) 75%, var(--rule));
      border-radius: 12px;
      box-shadow: 0 4px 18px rgba(0,0,0,0.22), 0 1px 3px rgba(0,0,0,0.15);
      cursor: grab;
      user-select: none;
      min-width: 110px;
      max-width: 360px;
      width: fit-content;
      height: fit-content;
      min-height: 38px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      touch-action: none;
      transition: box-shadow 0.12s, outline 0.12s;
    }
    .node:active, body.dragging-node, body.dragging-node .node {
      cursor: grabbing !important;
    }
    .node.selected {
      outline: 2.5px solid var(--focus) !important;
      outline-offset: 2px;
      box-shadow: 0 0 0 4px color-mix(in srgb, var(--focus) 35%, transparent), 0 10px 28px rgba(0,0,0,0.35) !important;
    }
    .node.user-sized {
      max-width: none;
    }
    .node.user-sized .node-content {
      min-height: 0;
      max-height: none;
    }
    .node.drop-target {
      outline: 2.5px dashed var(--focus) !important;
      outline-offset: 4px;
      box-shadow: 0 0 16px var(--focus) !important;
    }
    .node-header {
      padding: 6px 10px 5px;
      display: flex;
      align-items: center;
      gap: 6px;
      border-bottom: 1px solid color-mix(in srgb, var(--node-color) 20%, transparent);
    }
    .node-color-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--node-color);
      box-shadow: 0 0 5px var(--node-color);
      flex-shrink: 0;
    }
    .node-title {
      font-weight: 600;
      font-size: 12px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
    }
    .node-content {
      padding: 6px 10px 8px;
      font-size: 11px;
      line-height: 1.45;
      color: color-mix(in srgb, var(--ink) 88%, transparent);
      word-break: break-word;
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      max-height: 320px;
    }
    .node-content::-webkit-scrollbar { width: 4px; }
    .node-content::-webkit-scrollbar-thumb { background: var(--rule); border-radius: 2px; }

    .node-paragraph { margin: 0 0 5px 0; }
    .node-paragraph:last-child { margin-bottom: 0; }
    .node-h3, .node-h4, .node-h5, .node-h6 {
      font-weight: 600;
      color: var(--ink);
      margin: 5px 0 2px 0;
    }
    .node-h3 { font-size: 12px; }
    .node-h4 { font-size: 11px; }
    .node-blockquote {
      margin: 4px 0;
      padding: 2px 0 2px 8px;
      border-left: 2.5px solid var(--node-color);
      color: var(--muted);
      font-style: italic;
    }
    .node-list {
      margin: 2px 0 5px 14px;
      padding: 0;
      line-height: 1.4;
    }
    .node-list li { margin-bottom: 2px; }
    .node-task-item {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 3px 0;
      line-height: 1.35;
      user-select: text;
      width: 100%;
    }
    .node-task-item .task-text {
      flex: 1;
      min-width: 0;
      word-break: break-word;
      cursor: text;
    }
    .node-task-item .task-text[contenteditable="true"] {
      outline: 1px solid var(--focus);
      background: var(--surface);
      border-radius: 3px;
      padding: 1px 4px;
    }
    .node-task-item.completed .task-text {
      text-decoration: line-through;
      opacity: 0.55;
    }
    .task-delete-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: none;
      color: var(--muted);
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
      width: 16px;
      height: 16px;
      padding: 0;
      margin: 0;
      border-radius: 3px;
      opacity: 0;
      transition: opacity 120ms ease, color 120ms ease, background 120ms ease;
      flex-shrink: 0;
      user-select: none;
    }
    .node-task-item:hover .task-delete-btn,
    .task-delete-btn:focus-visible {
      opacity: 0.75;
    }
    .task-delete-btn:hover {
      opacity: 1 !important;
      color: #ef4444;
      background: color-mix(in srgb, #ef4444 15%, transparent);
    }
    .task-checkbox {
      width: 14px;
      height: 14px;
      min-width: 14px;
      min-height: 14px;
      cursor: pointer;
      margin: 2px 0 0 0;
      padding: 0;
      accent-color: var(--focus);
      flex-shrink: 0;
      border-radius: 3px;
    }
    .inline-code {
      background: color-mix(in srgb, var(--ink) 12%, transparent);
      padding: 1px 4px;
      border-radius: 3px;
      font-family: 'Cascadia Code', Consolas, monospace;
      font-size: 10px;
      color: var(--ink);
    }
    .node-code-block {
      position: relative;
      background: color-mix(in srgb, var(--panel) 92%, #000 8%);
      border: 1px solid var(--rule);
      border-radius: 6px;
      padding: 6px 8px;
      margin: 5px 0;
      overflow-x: auto;
      font-family: 'Cascadia Code', Consolas, monospace;
      font-size: 10px;
      line-height: 1.35;
      color: var(--ink);
      user-select: text;
    }
    .node-code-block code { font-family: inherit; font-size: inherit; }
    .code-language {
      display: block;
      width: fit-content;
      margin: -2px 0 5px auto;
      color: var(--muted);
      font-size: 9px;
      cursor: text;
      user-select: text;
    }
    [data-edit-kind][contenteditable='true'] {
      outline: 1px solid var(--focus);
      outline-offset: 2px;
      border-radius: 3px;
      user-select: text;
      white-space: pre-wrap;
      cursor: text;
    }
    .node-image-container {
      margin: 5px 0;
      border-radius: 6px;
      overflow: hidden;
      background: rgba(0, 0, 0, 0.18);
      display: flex;
      justify-content: center;
      align-items: center;
      max-width: 100%;
    }
    .node-img {
      max-width: 100%;
      height: auto;
      object-fit: contain;
      display: block;
      border-radius: 4px;
      image-rendering: auto;
    }
    .node-img.img-error {
      padding: 8px;
      font-size: 10px;
      color: var(--muted);
      font-style: italic;
    }
    .node-link {
      color: var(--focus);
      text-decoration: none;
      cursor: pointer;
    }
    .node-link:hover { text-decoration: underline; }
    .node-tag {
      display: inline-block;
      padding: 1px 5px;
      font-size: 9.5px;
      border-radius: 8px;
      background: color-mix(in srgb, var(--focus) 18%, transparent);
      color: var(--focus);
      font-weight: 500;
      margin: 1px 2px;
    }

    /* Inspector Markdown Toolbar */
    .md-toolbar {
      display: flex;
      align-items: center;
      gap: 3px;
      margin-bottom: 4px;
      flex-wrap: wrap;
      background: color-mix(in srgb, var(--panel) 90%, transparent);
      padding: 3px 4px;
      border-radius: 6px;
      border: 1px solid var(--rule);
    }
    .md-btn {
      padding: 2px 6px;
      font-size: 10.5px;
      font-weight: 600;
      border-radius: 4px;
      border: none;
      background: transparent;
      color: var(--ink);
      cursor: pointer;
      transition: background 0.1s;
    }
    .md-btn:hover {
      background: var(--hover-bg);
      color: var(--focus);
    }
    .md-preview-pane {
      display: none;
      padding: 8px;
      border: 1px solid var(--rule);
      border-radius: 6px;
      background: var(--input-bg);
      font-size: 11px;
      line-height: 1.4;
      max-height: 200px;
      overflow-y: auto;
      margin-top: 4px;
    }

    /* Shape Customizations */
    .node.rounded-rectangle { border-radius: 14px; }
    .node.rectangle { border-radius: 4px; }

    /* Resizer corner grip at bottom-right */
    .resizer {
      position: absolute;
      right: 2px;
      bottom: 2px;
      width: 10px;
      height: 10px;
      cursor: nwse-resize;
      z-index: 6;
      opacity: 0.3;
      background: radial-gradient(circle, var(--ink) 1px, transparent 1px);
      background-size: 3px 3px;
      touch-action: none;
    }
    .node:hover .resizer, .node.selected .resizer { opacity: 0.85; }
    /* Locked nodes: hide the resize grip so resizing cannot start */
    .node.locked .resizer { display: none; }
    .node.locked { cursor: default; }

    /* Connection Ports: Visible on hover */
    .port {
      position: absolute;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #ffffff;
      border: 2px solid #4d90fe;
      box-shadow: 0 1px 4px rgba(0,0,0,0.4);
      opacity: 0;
      cursor: crosshair;
      z-index: 10;
      touch-action: none;
      transition: opacity 0.12s, transform 0.12s;
    }
    .port::after {
      content: '';
      position: absolute;
      left: -8px;
      top: -8px;
      width: 26px;
      height: 26px;
    }
    .node:hover .port, .node.selected .port, .node.drop-target .port, body.connecting .port { opacity: 0.95; }
    body.editing-edge .port { opacity: 0 !important; pointer-events: none; }
    .port:hover {
      transform: scale(1.35);
      background: #4d90fe;
      border-color: #ffffff;
      box-shadow: 0 0 8px #4d90fe;
    }
    .port.top { top: -5px; left: calc(50% - 5px); }
    .port.right { right: -5px; top: calc(50% - 5px); }
    .port.bottom { bottom: -5px; left: calc(50% - 5px); }
    .port.left { left: -5px; top: calc(50% - 5px); }

    /* Marquee Selection Box */
    #selection-marquee {
      position: absolute;
      background: color-mix(in srgb, var(--focus) 18%, transparent);
      border: 1.5px dashed var(--focus);
      pointer-events: none;
      z-index: 40;
      display: none;
    }

    /* Context Menu & Shortcuts Modal */
    #context-menu {
      position: fixed;
      z-index: 100;
      background: var(--panel);
      border: 1px solid var(--rule);
      border-radius: 8px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.45);
      padding: 4px 0;
      min-width: 165px;
      display: none;
    }
    .menu-item { padding: 6px 12px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; font-size: 11.5px; }
    .menu-item:hover { background: var(--hover-bg); }
    .menu-divider { height: 1px; background: var(--rule); margin: 4px 0; }
    .menu-field { padding: 5px 8px 5px 12px; display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--muted); }
    .menu-field select, .menu-field input { width: 116px; min-height: 25px; background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 5px; padding: 2px 5px; }
    .menu-field-column { align-items: stretch; flex-direction: column; gap: 4px; }
    .menu-field-column input { width: 100%; }

    #editor-right { display: none !important; }
    .node.editing { z-index: 80; cursor: default; min-width: 180px; }
    .node.editing .port, .node.editing .resizer { opacity: 0 !important; pointer-events: none; }
    .node-title[contenteditable='true'], .node-content[contenteditable='true'] {
      cursor: text;
      outline: none;
      overflow: visible;
      user-select: text;
      white-space: pre-wrap;
    }
    .node-title[contenteditable='true'] { text-overflow: clip; }
    .node-title[contenteditable='true']:focus, .node-content[contenteditable='true']:focus {
      box-shadow: inset 0 -1.5px 0 var(--focus);
    }
    .node-content[contenteditable='true'] { min-height: 26px; }

    #shortcuts-modal {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 200;
      width: 440px;
      max-width: 90vw;
      background: var(--panel);
      border: 1px solid var(--rule);
      border-radius: 12px;
      box-shadow: 0 16px 45px rgba(0,0,0,0.6);
      padding: 16px 20px;
      display: none;
    }
    #shortcuts-modal.visible { display: block; }
    .shortcuts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 7px 14px; margin-top: 12px; }
    .shortcut-row { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px solid var(--rule); }
    .shortcut-row span { color: var(--muted); font-size: 11px; }
  `;
}
