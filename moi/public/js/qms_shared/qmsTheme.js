export function getQmsPageStyles(
  pageClass,
  {
    accent = "#1f7aec",
    appearance = "light",
    surfaceTint = "#f8fafc",
  } = {}
) {
  const isDark = appearance === "dark";
  const canvas = isDark ? "#0f172a" : "#f3f6f9";
  const surface = isDark ? "#111827" : "#ffffff";
  const surfaceAlt = isDark ? "#1f2937" : surfaceTint;
  const border = isDark ? "rgba(148, 163, 184, 0.18)" : "#d7dee5";
  const borderStrong = isDark ? "rgba(148, 163, 184, 0.28)" : "#c7d0da";
  const text = isDark ? "#f8fafc" : "#17212b";
  const textMuted = isDark ? "#94a3b8" : "#66768a";
  const shadow = isDark
    ? "0 18px 40px rgba(15, 23, 42, 0.34)"
    : "0 12px 28px rgba(31, 41, 55, 0.08)";
  const shadowSoft = isDark
    ? "0 8px 24px rgba(2, 6, 23, 0.28)"
    : "0 4px 14px rgba(15, 23, 42, 0.06)";

  return `
    header.navbar, .navbar, .page-sidebar, .page-head,
    .body-sidebar-container { display: none !important; }
    .layout-main-section-wrapper, .page-container { padding: 0 !important; margin: 0 !important; }
    .layout-main-section { max-width: 100vw !important; }

    .${pageClass}, .${pageClass} * { box-sizing: border-box; }

    .${pageClass} {
      --qms-accent: ${accent};
      --qms-canvas: ${canvas};
      --qms-surface: ${surface};
      --qms-surface-alt: ${surfaceAlt};
      --qms-border: ${border};
      --qms-border-strong: ${borderStrong};
      --qms-text: ${text};
      --qms-text-muted: ${textMuted};
      --qms-shadow: ${shadow};
      --qms-shadow-soft: ${shadowSoft};
      --qms-danger: #d9485f;
      --qms-danger-soft: ${isDark ? "rgba(217, 72, 95, 0.16)" : "#fff1f2"};
      --qms-warning: #b7791f;
      --qms-warning-soft: ${isDark ? "rgba(217, 119, 6, 0.18)" : "#fff7e6"};
      --qms-success: #16794a;
      --qms-success-soft: ${isDark ? "rgba(22, 121, 74, 0.2)" : "#edfdf3"};
      --qms-info: #1769cf;
      --qms-info-soft: ${isDark ? "rgba(37, 99, 235, 0.18)" : "#edf4ff"};
      width: 100vw;
      min-height: 100vh;
      background:
        radial-gradient(circle at top left, ${isDark ? "rgba(31,122,236,0.18)" : "rgba(31,122,236,0.1)"} 0, transparent 34%),
        linear-gradient(180deg, ${isDark ? "#0b1220" : "#f8fafc"} 0%, var(--qms-canvas) 24%, var(--qms-canvas) 100%);
      color: var(--qms-text);
      font-family: Inter, "Segoe UI", sans-serif;
      display: flex;
      flex-direction: column;
      overflow-x: hidden;
    }

    .${pageClass} button,
    .${pageClass} input,
    .${pageClass} select,
    .${pageClass} textarea {
      font: inherit;
    }

    .qms-shell-header {
      position: sticky;
      top: 0;
      z-index: 50;
      min-height: 68px;
      padding: 14px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      background: color-mix(in srgb, var(--qms-surface) 88%, transparent);
      backdrop-filter: blur(14px);
      border-bottom: 1px solid var(--qms-border);
      box-shadow: var(--qms-shadow-soft);
    }

    .qms-shell-brand {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    .qms-shell-logo {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, var(--qms-accent), color-mix(in srgb, var(--qms-accent) 72%, white));
      color: white;
      font-size: 18px;
      font-weight: 800;
      box-shadow: 0 10px 18px color-mix(in srgb, var(--qms-accent) 28%, transparent);
      flex-shrink: 0;
    }

    .qms-shell-title {
      font-size: 17px;
      font-weight: 700;
      letter-spacing: -0.01em;
      white-space: nowrap;
    }

    .qms-shell-subtitle {
      margin-top: 2px;
      font-size: 12px;
      color: var(--qms-text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .qms-shell-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
      flex-wrap: wrap;
    }

    .qms-panel-tabs {
      display: flex;
      gap: 6px;
      padding: 12px 24px 0;
      flex-wrap: wrap;
    }

    .qms-tab-button {
      border: 1px solid transparent;
      background: transparent;
      color: var(--qms-text-muted);
      border-radius: 10px 10px 0 0;
      padding: 10px 14px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: color 0.15s ease, background 0.15s ease, border-color 0.15s ease;
    }

    .qms-tab-button:hover {
      color: var(--qms-text);
      background: color-mix(in srgb, var(--qms-surface) 74%, transparent);
    }

    .qms-tab-button.active {
      color: var(--qms-accent);
      background: var(--qms-surface);
      border-color: var(--qms-border);
      border-bottom-color: var(--qms-surface);
      box-shadow: var(--qms-shadow-soft);
    }

    .qms-content {
      flex: 1;
      padding: 24px;
    }

    .qms-card {
      background: var(--qms-surface);
      border: 1px solid var(--qms-border);
      border-radius: 18px;
      box-shadow: var(--qms-shadow-soft);
    }

    .qms-card-muted {
      background: var(--qms-surface-alt);
      border: 1px solid var(--qms-border);
      border-radius: 16px;
    }

    .qms-toolbar {
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
    }

    .qms-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
    }

    .qms-label {
      font-size: 11px;
      font-weight: 700;
      color: var(--qms-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .qms-input,
    .qms-select,
    .qms-textarea {
      width: 100%;
      min-height: 38px;
      border-radius: 12px;
      border: 1px solid var(--qms-border-strong);
      background: var(--qms-surface);
      color: var(--qms-text);
      padding: 10px 12px;
      outline: none;
      transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
    }

    .qms-input:focus,
    .qms-select:focus,
    .qms-textarea:focus {
      border-color: var(--qms-accent);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--qms-accent) 18%, transparent);
    }

    .qms-button {
      min-height: 38px;
      border-radius: 12px;
      border: 1px solid var(--qms-border);
      padding: 9px 14px;
      background: var(--qms-surface);
      color: var(--qms-text);
      font-size: 13px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      cursor: pointer;
      transition: transform 0.12s ease, background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
    }

    .qms-button:hover:not(:disabled) {
      transform: translateY(-1px);
      border-color: var(--qms-border-strong);
      background: color-mix(in srgb, var(--qms-surface-alt) 82%, white);
    }

    .qms-button:disabled {
      opacity: 0.55;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    .qms-button.primary {
      background: var(--qms-accent);
      border-color: var(--qms-accent);
      color: white;
      box-shadow: 0 10px 22px color-mix(in srgb, var(--qms-accent) 24%, transparent);
    }

    .qms-button.primary:hover:not(:disabled) {
      background: color-mix(in srgb, var(--qms-accent) 90%, black);
      border-color: color-mix(in srgb, var(--qms-accent) 90%, black);
    }

    .qms-button.success {
      background: var(--qms-success);
      border-color: var(--qms-success);
      color: white;
    }

    .qms-button.warning {
      background: var(--qms-warning-soft);
      border-color: color-mix(in srgb, var(--qms-warning) 34%, transparent);
      color: var(--qms-warning);
    }

    .qms-button.danger {
      background: var(--qms-danger-soft);
      border-color: color-mix(in srgb, var(--qms-danger) 34%, transparent);
      color: var(--qms-danger);
    }

    .qms-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 30px;
      padding: 4px 12px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      border: 1px solid transparent;
      white-space: nowrap;
    }

    .qms-badge::before {
      content: "";
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: currentColor;
      opacity: 0.9;
    }

    .qms-badge.success { background: var(--qms-success-soft); color: var(--qms-success); }
    .qms-badge.warning { background: var(--qms-warning-soft); color: var(--qms-warning); }
    .qms-badge.danger { background: var(--qms-danger-soft); color: var(--qms-danger); }
    .qms-badge.info { background: var(--qms-info-soft); color: var(--qms-info); }
    .qms-badge.neutral { background: color-mix(in srgb, var(--qms-surface-alt) 80%, white); color: var(--qms-text-muted); }

    .qms-kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 14px;
    }

    .qms-kpi {
      padding: 18px;
      background: var(--qms-surface);
      border: 1px solid var(--qms-border);
      border-radius: 16px;
      box-shadow: var(--qms-shadow-soft);
    }

    .qms-kpi-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--qms-text-muted);
      margin-bottom: 8px;
    }

    .qms-kpi-value {
      font-size: 30px;
      line-height: 1;
      font-weight: 800;
      letter-spacing: -0.03em;
    }

    .qms-kpi-sub {
      margin-top: 6px;
      color: var(--qms-text-muted);
      font-size: 12px;
    }

    .qms-empty-state {
      padding: 42px 20px;
      text-align: center;
      color: var(--qms-text-muted);
    }

    .qms-grid {
      display: grid;
      gap: 18px;
    }

    @media (max-width: 900px) {
      .qms-shell-header {
        padding: 14px 16px;
        align-items: flex-start;
      }

      .qms-content,
      .qms-panel-tabs {
        padding-left: 16px;
        padding-right: 16px;
      }
    }

    /* ── Tablet portrait (7" Android, iPad mini) ── */
    @media (max-width: 768px) {
      .qms-shell-header { min-height: 56px; padding: 10px 12px; }
      .qms-shell-title { font-size: 15px; }
      .qms-shell-subtitle { display: none; }
      .qms-content, .qms-panel-tabs { padding-left: 12px; padding-right: 12px; }
    }

    /* ── Kiosk full-width desktop ── */
    @media (min-width: 1366px) {
      .qms-content { padding: 32px 48px; }
    }
  `;
}

export function qmsStatusTone(status) {
  const map = {
    Open: "success",
    Completed: "success",
    Break: "warning",
    Waiting: "warning",
    Serving: "info",
    Closed: "danger",
    "No Show": "danger",
    Cancelled: "neutral",
  };
  return map[status] || "neutral";
}
