import { icons } from './canvasIcons';
import template from './canvasTemplate.html';

export function getCanvasTemplate(): string {
  const toolbarTemplate = template
    .replace('<button class="icon-btn" id="expand-sidebar-left" title="Expand Outline">{{folder}}</button>', '')
    .replace(
      '<button id="add" title="Add new node (N)" style="font-weight:600;">{{plus}} Node</button>',
      '<button class="icon-btn" id="btn-create-template" title="Create full Markdown template">{{filePlus}}</button><button id="add" title="Add new node (N)" style="font-weight:600;">{{plus}} Node</button>',
    )
    .replace(
      '<button class="icon-btn" id="color-picker-btn" title="Node color for new nodes"><span class="picker-preview color-dot-preview" id="color-picker-preview"></span><span class="menu-caret">{{chevronDown}}</span></button>',
      '<button class="icon-btn" id="icon-picker-btn" title="Node icon for new nodes"><span class="picker-preview" id="icon-picker-preview">{{sticker}}</span><span class="menu-caret">{{chevronDown}}</span></button><button class="icon-btn" id="color-picker-btn" title="Node color for new nodes"><span class="picker-preview color-dot-preview" id="color-picker-preview"></span><span class="menu-caret">{{chevronDown}}</span></button>',
    )
    .replace(
      '<button data-action="task" title="Add task" aria-label="Add task">{{squareCheck}}</button>',
      '<button data-action="task" title="Add task" aria-label="Add task">{{squareCheck}}</button><button data-action="list" title="Add bullet item" aria-label="Add bullet item">{{list}}</button>',
    )
    .replace('<button class="icon-btn" id="btn-arrange" title="Auto arrange (left-to-right / top-to-bottom)">{{network}}<span class="menu-caret">{{chevronDown}}</span></button>', '')
    .replace(
      '<button class="icon-btn" id="btn-fit" title="Fit to screen (F)">{{maximize}}</button>',
      '<button class="icon-btn" id="btn-fit" title="Fit to screen (F)">{{maximize}}</button><button class="icon-btn" id="btn-export" title="Export full graph as PNG">{{download}}</button>',
    )
    .replace(
      '<div class="shortcut-row"><span>Nudge Node(s)</span><b>Arrow keys</b></div>',
      '<div class="shortcut-row"><span>Nudge Node(s)</span><b>Arrow keys</b></div><div class="shortcut-row"><span>Copy node(s)</span><b>Ctrl+C</b></div><div class="shortcut-row"><span>Cut node(s)</span><b>Ctrl+X</b></div><div class="shortcut-row"><span>Paste node(s)</span><b>Ctrl+V</b></div><div class="shortcut-row"><span>Undo / Redo</span><b>Ctrl+Z / Ctrl+Y</b></div>',
    );
  return toolbarTemplate.replace(/{{(\w+)}}/g, (_, name: keyof typeof icons) => icons[name] ?? '');
}
