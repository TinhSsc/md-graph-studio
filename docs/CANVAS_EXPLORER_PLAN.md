# Canvas Explorer Plan

## Mục tiêu

Thêm Activity Bar container để mở lại canvas Markdown gần đây và dùng một Outline duy nhất ở sidebar VS Code.

## Phạm vi

- Hai Tree View `Canvases` và `Outline`.
- Lưu tối đa 10 URI canvas đã mở trong workspace state.
- Chọn file Markdown khi chưa có canvas.
- Cập nhật outline khi tài liệu thay đổi.
- Click Outline để mở canvas, chọn và đưa node vào giữa màn hình.
- Loại bỏ Outline trùng trong webview; giữ B/I/H dưới dạng thanh nổi nhỏ.

Ngoài phạm vi: thay đổi format Markdown hoặc storage sidecar.

## Module

- `src/explorer/CanvasExplorer.ts`: lịch sử, TreeDataProvider và điều hướng node.
- `src/extension.ts`: đăng ký explorer.
- `src/providers/MarkdownGraphEditorProvider.ts`: liên kết Tree View với webview đang mở.
- `package.json` và `media/graph-studio.svg`: contributions và icon Activity Bar.
- `src/webview/*`: bỏ sidebar trùng, nhận lệnh focus node.

## Kiểm thử và Definition of Done

- Type-check, unit tests, build và syntax check đạt.
- Activity Bar mở được canvas gần đây hoặc chọn file mới.
- Outline phản ánh canvas mới nhất và click focus đúng node.
- Canvas không còn cột Outline nội bộ và không mất chức năng định dạng.
