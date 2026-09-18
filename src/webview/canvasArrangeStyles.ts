/**
 * Style siêu gọn cho menu Sắp xếp và thanh công cụ chỉnh nhanh (Quick Arrange Bar).
 */
export function getCanvasArrangeStyles(): string {
  return `
    /* Context Menu Submenu - Siêu gọn */
    .menu-item-has-submenu {
      position: relative;
    }
    .menu-item-has-submenu:hover > .menu-submenu,
    .menu-item-has-submenu.open > .menu-submenu {
      display: block;
    }
    .menu-submenu {
      display: none;
      position: absolute;
      left: 100%;
      top: -4px;
      background: var(--panel);
      border: 1px solid var(--rule);
      border-radius: 8px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.45);
      padding: 4px 0;
      min-width: 175px;
      z-index: 120;
    }
    .menu-submenu.flip-left {
      left: auto;
      right: 100%;
    }
    .menu-submenu.flip-top {
      top: auto;
      bottom: -4px;
    }
    .menu-item-nested {
      padding: 5px 12px;
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      font-size: 11.5px;
      color: var(--fg);
      white-space: nowrap;
      transition: background 100ms ease;
    }
    .menu-item-nested:hover {
      background: var(--hover-bg);
      color: var(--text-color, #fff);
    }
    .menu-item-nested.highlight {
      color: #60a5fa;
      font-weight: 500;
    }
    .menu-item-nested.highlight:hover {
      background: rgba(96, 165, 250, 0.12);
    }
    .menu-item-nested .menu-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      opacity: 0.9;
    }
    .menu-item-nested .menu-icon svg {
      width: 14px;
      height: 14px;
      display: block;
    }

    /* Quick Arrange Capsule Bar - Minimalist (Cao ~30px) */
    #arrange-quick-bar {
      position: fixed;
      z-index: 150;
      background: var(--panel);
      border: 1px solid var(--rule);
      border-radius: 20px;
      box-shadow: 0 6px 24px rgba(0,0,0,0.4);
      padding: 3px 6px;
      height: 32px;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      gap: 4px;
      backdrop-filter: blur(10px);
      user-select: none;
      pointer-events: auto;
      cursor: default;
      animation: arrange-pop 140ms ease-out;
    }
    @keyframes arrange-pop {
      from { opacity: 0; transform: translateY(3px) scale(0.97); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .arrange-group {
      display: flex;
      align-items: center;
      gap: 2px;
    }
    .arrange-divider {
      width: 1px;
      height: 16px;
      background: var(--rule);
      margin: 0 2px;
    }
    .arrange-btn {
      background: transparent;
      border: 1px solid transparent;
      border-radius: 12px;
      color: var(--fg);
      font-size: 11px;
      padding: 2px 6px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 24px;
      line-height: 1;
      transition: all 100ms ease;
    }
    .arrange-btn:hover {
      background: var(--hover-bg);
    }
    .arrange-btn.active {
      background: rgba(77, 144, 254, 0.2);
      border-color: rgba(77, 144, 254, 0.4);
      color: #70a5ff;
      font-weight: 600;
    }
    .arrange-btn svg,
    .arrange-step-btn svg,
    .arrange-close-btn svg,
    .arrange-btn svg *,
    .arrange-step-btn svg *,
    .arrange-close-btn svg * {
      pointer-events: none;
    }
    .arrange-btn svg {
      width: 14px;
      height: 14px;
      display: block;
    }
    .arrange-stepper {
      display: flex;
      align-items: center;
      gap: 1px;
      background: var(--input-bg);
      border: 1px solid var(--input-border);
      border-radius: 12px;
      padding: 1px 3px;
      height: 24px;
      box-sizing: border-box;
    }
    .arrange-label {
      font-size: 10px;
      font-weight: 600;
      color: var(--muted);
      padding: 0 2px;
    }
    .arrange-val {
      font-size: 10.5px;
      min-width: 28px;
      text-align: center;
      font-weight: 600;
      color: var(--fg);
    }
    .arrange-step-btn {
      background: transparent;
      border: none;
      color: var(--fg);
      cursor: pointer;
      width: 18px;
      height: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      font-size: 12px;
      line-height: 1;
      padding: 0;
    }
    .arrange-step-btn:hover {
      background: var(--hover-bg);
    }
    .arrange-step-btn svg {
      width: 12px;
      height: 12px;
      display: block;
    }
    .arrange-close-btn {
      background: transparent;
      border: none;
      color: var(--muted);
      cursor: pointer;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      padding: 0;
    }
    .arrange-close-btn:hover {
      color: #ff6e6e;
      background: rgba(255, 110, 110, 0.15);
    }
    .arrange-close-btn svg {
      width: 12px;
      height: 12px;
      display: block;
    }
  `;
}
