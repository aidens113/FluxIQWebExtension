import type { BoardClasses } from "./classes.js";

/** Rolefinch's stylesheet, written against the build's hashed class names. */
export function boardStylesheet(c: BoardClasses): string {
  return `
*{box-sizing:border-box}
[hidden]{display:none!important}
body{margin:0;font:15px/1.45 "Segoe UI",system-ui,sans-serif;color:#1f2430;background:#f5f6f8}
a{color:#1d4ed8;text-decoration:none}
.${c.header}{display:flex;align-items:center;gap:24px;height:60px;padding:0 24px;background:#fff;border-bottom:1px solid #e3e6ec;position:sticky;top:0;z-index:20}
.${c.logo}{font-weight:800;font-size:22px;letter-spacing:-.5px;color:#0f766e}
.${c.nav}{display:flex;gap:18px}
.${c.navLink}{color:#374151;font-weight:600}
.${c.headerRight}{margin-left:auto;display:flex;gap:18px;align-items:center}
.${c.myJobs}{color:#374151;font-weight:600;display:inline-flex;gap:6px;align-items:center}
.${c.badge}{background:#0f766e;color:#fff;border-radius:9px;padding:0 7px;font-size:12px;line-height:18px}
.${c.main}{max-width:1220px;margin:0 auto;padding:16px 24px 120px}
.${c.search}{display:flex;gap:10px;align-items:flex-end;background:#fff;border:1px solid #d8dce4;border-radius:12px;padding:12px 14px}
.${c.field}{flex:1;display:flex;flex-direction:column}
.${c.fieldLabel}{font-size:12px;font-weight:700;color:#4b5563}
.${c.fieldInput}{border:0;border-bottom:1px solid #c9ced8;padding:6px 2px;font:inherit;background:transparent}
.${c.searchButton}{background:#0f766e;color:#fff;border:0;border-radius:8px;padding:10px 18px;font:inherit;font-weight:700;cursor:pointer}
.${c.filters}{display:flex;gap:8px;margin:14px 0 6px;flex-wrap:wrap}
.${c.pillWrap}{position:relative}
.${c.pill}{border:1px solid #c9ced8;background:#fff;border-radius:18px;padding:5px 14px;font:inherit;font-size:14px;cursor:pointer}
.${c.pillActive}{border-color:#0f766e;background:#e6f4f1;color:#0f5f58;font-weight:600}
.${c.pillMenu}{position:absolute;top:36px;left:0;z-index:15;background:#fff;border:1px solid #d8dce4;border-radius:8px;box-shadow:0 8px 24px #0002;min-width:180px;padding:6px 0}
.${c.pillOption}{display:block;padding:7px 14px;color:#1f2430}
.${c.pillChosen}{font-weight:700;color:#0f766e}
.${c.meta}{display:flex;gap:16px;align-items:baseline;margin:10px 0}
.${c.metaTitle}{font-size:18px;margin:0}
.${c.count}{color:#6b7280;font-size:13px}
.${c.sort}{margin-left:auto;font-size:13px;color:#6b7280}
.${c.layout}{display:grid;grid-template-columns:minmax(0,520px) minmax(0,1fr);gap:18px;align-items:start}
.${c.list}{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
.${c.card}{background:#fff;border:1px solid #dde1e8;border-radius:10px;padding:14px 16px;cursor:pointer;position:relative}
.${c.cardSelected}{border-color:#0f766e;box-shadow:0 0 0 1px #0f766e}
.${c.cardHead}{display:flex;justify-content:space-between;gap:10px}
.${c.cardTitle}{font-size:16px;margin:0;line-height:1.3}
.${c.cardTitle} a{color:#111827}
.${c.cardCompany}{display:flex;flex-direction:column;color:#374151;font-size:14px;margin-top:2px}
.${c.cardSalary}{margin-top:6px;font-weight:600;font-size:14px;color:#1f2937}
.${c.cardTags}{display:flex;gap:6px;margin-top:6px}
.${c.tag}{background:#f1f3f6;border-radius:4px;padding:1px 7px;font-size:12px;color:#4b5563}
.${c.cardSnippet}{margin:8px 0 0;padding-left:18px;font-size:13px;color:#4b5563}
.${c.cardFoot}{display:flex;justify-content:space-between;margin-top:8px;font-size:12px;color:#6b7280}
.${c.heart}{width:32px;height:32px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;cursor:pointer;flex:none}
.${c.heart} svg{width:20px;height:20px;fill:none;stroke:#4b5563;stroke-width:2}
.${c.heartOn} svg{fill:#dc2626;stroke:#dc2626}
.${c.heartBusy}{opacity:.35}
.${c.pane}{position:sticky;top:76px;background:#fff;border:1px solid #dde1e8;border-radius:10px;min-height:420px;max-height:calc(100vh - 92px);overflow:auto}
.${c.paneEmpty}{padding:48px;color:#6b7280;text-align:center}
.${c.skeleton}{padding:24px}
.${c.skeletonLine}{height:14px;background:#eceff3;border-radius:6px;margin:12px 0}
.${c.paneRoot}{position:relative;min-height:420px}
.${c.paneHead}{padding:20px 22px;border-bottom:1px solid #eceff3}
.${c.paneTitle}{font-size:21px;margin:0 0 4px}
.${c.paneCompany}{font-weight:600}
.${c.paneMeta}{color:#4b5563;font-size:14px}
.${c.paneActions}{display:flex;gap:10px;align-items:center;margin-top:14px;position:relative}
.${c.applyButton}{background:#0f766e;color:#fff;border-radius:8px;padding:9px 16px;font-weight:700;display:inline-flex;gap:6px;align-items:center}
.${c.easyButton}{background:#1d4ed8;color:#fff;border:0;border-radius:8px;padding:9px 16px;font:inherit;font-weight:700;cursor:pointer}
.${c.moreButton}{width:36px;height:36px;border:1px solid #c9ced8;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font-weight:700;letter-spacing:1px}
.${c.menu}{position:absolute;top:44px;right:0;background:#fff;border:1px solid #d8dce4;border-radius:8px;box-shadow:0 8px 24px #0002;z-index:5;min-width:170px;padding:4px 0}
.${c.menuItem}{padding:8px 14px;cursor:pointer}
.${c.paneBody}{padding:6px 22px 18px}
.${c.paneBody} h3{font-size:15px;margin:16px 0 6px}
.${c.paneFoot}{padding:10px 22px 22px;color:#6b7280;font-size:13px}
.${c.closed}{background:#fef2f2;color:#991b1b;border-radius:8px;padding:9px 14px;font-weight:600}
.${c.similar}{display:flex;flex-direction:column;gap:4px}
.${c.slow}{padding:24px;color:#4b5563}
.${c.wall}{position:absolute;inset:0;background:#ffffffee;display:flex;align-items:flex-start;justify-content:center;padding-top:60px;z-index:6}
.${c.wallCard}{max-width:320px;text-align:center}
.${c.wallButton}{display:block;width:100%;margin:8px 0;background:#0f766e;color:#fff;border:0;border-radius:8px;padding:10px;font:inherit;font-weight:700}
.${c.wallLater}{font-size:13px;color:#6b7280}
.${c.pager}{display:flex;gap:6px;margin:18px 0 8px;align-items:center}
.${c.pageLink}{border:1px solid #c9ced8;border-radius:6px;padding:4px 10px;background:#fff;color:#1f2430}
.${c.pageCurrent}{border:1px solid #0f766e;border-radius:6px;padding:4px 10px;background:#0f766e;color:#fff}
.${c.perPage}{font-size:13px;color:#4b5563}
.${c.empty}{background:#fff;border:1px dashed #c9ced8;border-radius:10px;padding:22px;margin-bottom:14px}
.${c.recommend}{font-size:16px;margin:16px 0 8px}
.${c.toast}{position:fixed;left:24px;bottom:24px;background:#111827;color:#fff;border-radius:8px;padding:10px 16px;z-index:40;display:flex;gap:14px}
.${c.toastAction}{color:#93c5fd}
.${c.backdrop}{position:fixed;inset:0;background:#0007;z-index:30;display:flex;align-items:center;justify-content:center}
.${c.modal}{background:#fff;border-radius:14px;padding:28px 30px;width:420px;position:relative}
.${c.modalClose}{position:absolute;top:10px;right:14px;font-size:22px;color:#6b7280;cursor:pointer;line-height:1}
.${c.modalInput}{width:100%;padding:9px;border:1px solid #c9ced8;border-radius:8px;font:inherit;margin:8px 0}
.${c.modalButton}{width:100%;background:#0f766e;color:#fff;border:0;border-radius:8px;padding:10px;font:inherit;font-weight:700}
.${c.modalLater}{display:block;text-align:center;margin-top:10px;font-size:13px;color:#6b7280}
.${c.tabs}{display:flex;gap:4px;border-bottom:1px solid #d8dce4;margin:12px 0}
.${c.tab}{padding:8px 14px;color:#4b5563}
.${c.tabOn}{border-bottom:3px solid #0f766e;color:#0f766e;font-weight:700}
.${c.savedSummary}{color:#4b5563;margin:6px 0 12px}
.${c.savedList}{list-style:none;margin:0;padding:0;background:#fff;border:1px solid #dde1e8;border-radius:10px}
.${c.savedRow}{display:grid;grid-template-columns:2fr 1.3fr 1.1fr 1.6fr 40px;gap:10px;align-items:center;padding:12px 16px;border-bottom:1px solid #eceff3}
.${c.status}{font-size:13px;color:#4b5563}
.${c.panel}{background:#fff;border:1px solid #dde1e8;border-radius:10px;padding:22px}
.${c.notice}{background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:22px;max-width:560px;margin:40px auto}
.${c.retry}{background:#0f766e;color:#fff;border:0;border-radius:8px;padding:9px 16px;font:inherit;font-weight:700}
.${c.retry}:disabled{background:#9ca3af}
.${c.footer}{border-top:1px solid #e3e6ec;padding:24px;color:#6b7280;font-size:13px;text-align:center;background:#fff}
`;
}
