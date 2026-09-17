# Two-shape and outline icon cleanup

## Goal

- Keep only `rounded-rectangle` and `rectangle` as node shapes.
- Show node icons in Outline; never use shape glyphs there.
- Remove obsolete shape UI, rendering styles, documentation, and tests.

## Scope

- Model/parser contract, webview rendering and controls, AI instructions, docs, and affected tests.
- Existing unsupported shape values fall back to `rounded-rectangle` through parser validation.

## Steps

1. Reduce the shape contract and icon maps to two values.
2. Render a custom node icon or a neutral default icon in Outline and node headers.
3. Remove obsolete shape CSS and documentation.
4. Update fixtures/tests and run syntax, type-check, tests, and build.

## Definition of Done

- No UI exposes the four removed shapes.
- Outline contains node icons, not shape icons.
- Source contracts and documentation list exactly two shapes.
- Verification passes.
