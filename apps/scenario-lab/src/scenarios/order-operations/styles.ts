import { buildClassNames } from "../../build-classes.js";

/**
 * The order desk's class names and the stylesheet they carry.
 *
 * Every class is a build hash (`build-classes.ts`), so nothing on these pages
 * says what it is for: the same hash sits on the notification bell, on the
 * toolbar's settings control and on all 280 row action buttons at once. A class
 * set is evidence about which component was used, never about which control was
 * pressed.
 */
const CLASS_ROLES = [
  "app", "sidebar", "brand", "brandMark", "navLabel", "navList", "navItem", "navCurrent", "navIcon", "navCount", "sidebarFoot",
  "main", "topbar", "searchForm", "searchInput", "topActions", "iconButton", "avatar", "userButton",
  "content", "pageHead", "pageTitle", "statLine", "pageActions", "crumbs",
  "button", "buttonPrimary", "buttonDanger", "buttonNeutral",
  "card", "toolbar", "field", "fieldLabel", "input", "dateInput", "select", "chipRow", "chip", "bulkBar", "bulkCount",
  "tableWrap", "table", "headCell", "checkCell", "row", "rowSelected", "cell", "numberCell", "actionCell",
  "badge", "badgePaid", "badgeOwed", "badgeFailed", "badgeOpen", "badgeSent",
  "tableFoot", "footNote", "empty", "appFoot", "note",
  "columns", "panel", "panelHead", "panelBody", "definitions", "address", "formRow", "hint",
  "menu", "menuHead", "menuItem", "menuDanger", "scrim", "dialog", "dialogHead", "dialogBody", "dialogFoot",
  "toastRegion", "toast", "toastText", "srOnly",
] as const;

export type OrderClassRole = (typeof CLASS_ROLES)[number];
export type OrderClasses = Record<OrderClassRole, string>;

/** The build the desk ships, spelled as the page footer spells it. */
export const ORDER_BUILD = "3.9.6";

/** The footer line: the one place the pages say which build they are. */
export function orderBuildMarker(): string {
  return `Northgate Orders · build ${ORDER_BUILD}`;
}

/** Every class name the order desk renders with. */
export function orderClasses(): OrderClasses {
  return buildClassNames(ORDER_BUILD, CLASS_ROLES);
}

/**
 * The design system's icon paths. Every icon on the page is one of these, drawn
 * in the current colour, so an icon says nothing about which control carries it.
 */
export const ORDER_GLYPHS = {
  square: "M3 3h10v10H3z",
  bell: "M8 2a4 4 0 0 0-4 4v3l-1 2h10l-1-2V6a4 4 0 0 0-4-4z",
  sparkle: "M8 2l1.6 4.4L14 8l-4.4 1.6L8 14l-1.6-4.4L2 8l4.4-1.6z",
  chevron: "M4 6l4 4 4-4",
  sliders: "M2 4h12M2 8h12M2 12h12",
  overflow: "M4 8h.01M8 8h.01M12 8h.01",
  cross: "M4 4l8 8M12 4l-8 8",
} as const;

/** One design-system glyph: a single path, hidden from the accessibility tree, so only the control's own name labels it. */
export function orderIcon(className: string, path: string): string {
  return `<svg class="${className}" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="${path}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;
}

/**
 * The emitted stylesheet. The first five rules undo the lab's shared page
 * shell, which is centred and 48rem wide; an application shell is neither.
 */
export function orderStylesheet(css: OrderClasses): string {
  return [
    `body { margin: 0; max-width: none; padding: 0; font: 14px/1.45 -apple-system, "Segoe UI", system-ui, sans-serif; color: #1c2536; background: #f5f6f9; }`,
    `li { display: list-item; gap: 0; margin: 0; }`,
    `nav { display: block; gap: 0; }`,
    `label { display: inline-block; margin: 0; }`,
    `button, input, select, textarea { font: inherit; }`,
    `.${css.srOnly} { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }`,
    `.${css.app} { display: grid; grid-template-columns: 220px minmax(0, 1fr); align-items: start; }`,
    `.${css.sidebar} { position: sticky; top: 0; height: 100vh; overflow: auto; box-sizing: border-box; padding: 16px 12px; background: #1b2338; color: #c6cde0; }`,
    `.${css.brand} { display: flex; align-items: center; gap: 8px; padding: 4px 8px 16px; font-weight: 600; color: #fff; }`,
    `.${css.brandMark} { display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 7px; background: #6248c4; color: #fff; font-size: 12px; }`,
    `.${css.navLabel} { margin: 14px 8px 6px; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: #8590ad; }`,
    `.${css.navList} { list-style: none; margin: 0; padding: 0; }`,
    `.${css.navItem} { display: flex; align-items: center; gap: 10px; padding: 7px 8px; border-radius: 6px; color: inherit; text-decoration: none; }`,
    `.${css.navCurrent} { background: #2a3454; color: #fff; }`,
    `.${css.navIcon} { flex: none; width: 15px; height: 15px; opacity: .85; }`,
    `.${css.navCount} { margin-left: auto; padding: 1px 7px; border-radius: 9px; background: #343f63; font-size: 11px; }`,
    `.${css.sidebarFoot} { margin-top: 20px; padding: 12px 8px; border-top: 1px solid #2c3650; font-size: 12px; color: #8f9ab6; }`,
    `.${css.main} { min-width: 0; }`,
    `.${css.topbar} { position: sticky; top: 0; z-index: 30; display: flex; align-items: center; gap: 12px; height: 56px; padding: 0 20px; background: #fff; border-bottom: 1px solid #e3e6ee; }`,
    `.${css.searchForm} { flex: 1; max-width: 400px; }`,
    `.${css.searchInput} { width: 100%; padding: 6px 10px; border: 1px solid #d6dae5; border-radius: 6px; background: #f8f9fc; }`,
    `.${css.topActions} { display: flex; align-items: center; gap: 6px; margin-left: auto; }`,
    `.${css.iconButton} { display: inline-grid; place-items: center; width: 32px; height: 32px; border: 1px solid transparent; border-radius: 6px; background: none; color: #56607a; cursor: pointer; }`,
    `.${css.avatar} { display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; background: #e0dbf5; color: #3d2f7a; font-size: 11px; font-weight: 600; }`,
    `.${css.userButton} { display: flex; align-items: center; gap: 8px; padding: 4px 8px; border: 1px solid #e3e6ee; border-radius: 999px; background: #fff; cursor: pointer; }`,
    `.${css.content} { padding: 20px 20px 140px; }`,
    `.${css.crumbs} { margin: 0 0 8px; color: #59637b; }`,
    `.${css.pageHead} { display: flex; align-items: flex-end; gap: 16px; margin-bottom: 14px; }`,
    `.${css.pageTitle} { margin: 0 0 2px; font-size: 20px; }`,
    `.${css.statLine} { margin: 0; color: #59637b; }`,
    `.${css.pageActions} { display: flex; gap: 8px; margin-left: auto; }`,
    `.${css.button} { padding: 6px 12px; border: 1px solid #d6dae5; border-radius: 6px; background: #fff; color: #1c2536; cursor: pointer; }`,
    `.${css.buttonPrimary} { border-color: #4f3aa8; background: #6248c4; color: #fff; }`,
    `.${css.buttonNeutral} { border-color: #c4c9d8; background: #eef0f6; color: #1c2536; }`,
    `.${css.buttonDanger} { border-color: #e3b5b5; color: #a92f2f; }`,
    `.${css.button}[disabled] { opacity: .5; cursor: not-allowed; }`,
    `.${css.card} { background: #fff; border: 1px solid #e3e6ee; border-radius: 10px; }`,
    `.${css.toolbar} { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 12px 14px; border-bottom: 1px solid #eef0f5; }`,
    `.${css.field} { display: flex; align-items: center; gap: 6px; }`,
    `.${css.fieldLabel} { color: #59637b; }`,
    `.${css.input} { width: 220px; padding: 6px 10px; border: 1px solid #d6dae5; border-radius: 6px; }`,
    `.${css.dateInput} { width: 130px; padding: 6px 10px; border: 1px solid #d6dae5; border-radius: 6px; }`,
    `.${css.select} { padding: 6px 8px; border: 1px solid #d6dae5; border-radius: 6px; background: #fff; }`,
    `.${css.chipRow} { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 10px 14px; border-bottom: 1px solid #eef0f5; background: #f8f9fc; }`,
    `.${css.chip} { padding: 2px 9px; border-radius: 999px; background: #e7e3f7; color: #3d2f7a; font-size: 12px; }`,
    `.${css.bulkBar} { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-bottom: 1px solid #eef0f5; background: #f0edfb; }`,
    `.${css.bulkCount} { font-weight: 600; }`,
    `.${css.tableWrap} { min-width: 0; }`,
    `.${css.table} { width: 100%; border-collapse: collapse; }`,
    `.${css.headCell} { position: sticky; top: 56px; z-index: 20; padding: 9px 12px; background: #fbfcfe; border-bottom: 1px solid #e3e6ee; color: #59637b; font-size: 12px; font-weight: 600; text-align: left; white-space: nowrap; }`,
    `.${css.checkCell} { width: 34px; padding-left: 14px; }`,
    `.${css.row} { border-bottom: 1px solid #f1f3f8; }`,
    `.${css.rowSelected} { background: #f6f4fd; }`,
    `.${css.cell} { padding: 8px 12px; vertical-align: middle; white-space: nowrap; }`,
    `.${css.numberCell} { text-align: right; font-variant-numeric: tabular-nums; }`,
    `.${css.actionCell} { padding-right: 14px; text-align: right; }`,
    `.${css.badge} { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 12px; }`,
    `.${css.badgePaid} { background: #e3f4e9; color: #1f6a3e; }`,
    `.${css.badgeOwed} { background: #fdefdc; color: #8a5b12; }`,
    `.${css.badgeFailed} { background: #fbe3e3; color: #9c2626; }`,
    `.${css.badgeOpen} { background: #e9ecf6; color: #3b4870; }`,
    `.${css.badgeSent} { background: #e3eefb; color: #1d4f86; }`,
    `.${css.tableFoot} { display: flex; gap: 16px; padding: 10px 14px; color: #59637b; }`,
    `.${css.footNote} { margin: 0; }`,
    `.${css.empty} { padding: 28px 14px; color: #6d7891; text-align: center; }`,
    `.${css.appFoot} { padding: 18px 4px; color: #8b95ac; font-size: 12px; }`,
    `.${css.note} { margin: 0 0 14px; }`,
    `.${css.columns} { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 16px; align-items: start; }`,
    `.${css.panel} { background: #fff; border: 1px solid #e3e6ee; border-radius: 10px; margin-bottom: 16px; }`,
    `.${css.panelHead} { padding: 14px 16px 0; }`,
    `.${css.panelBody} { padding: 14px 16px; }`,
    `.${css.definitions} { display: grid; grid-template-columns: 130px minmax(0, 1fr); gap: 4px 10px; margin: 0; }`,
    `.${css.address} { margin: 0; font-style: normal; line-height: 1.6; }`,
    `.${css.formRow} { display: grid; gap: 6px; margin-bottom: 12px; }`,
    `.${css.hint} { margin: 0; color: #6d7891; font-size: 12px; }`,
    `.${css.menu} { position: absolute; z-index: 80; width: 212px; padding: 4px; background: #fff; border: 1px solid #e3e6ee; border-radius: 8px; box-shadow: 0 10px 26px rgba(28, 37, 54, .16); }`,
    `.${css.menuHead} { margin: 4px 8px 6px; color: #6d7891; font-size: 12px; }`,
    `.${css.menuItem} { display: block; width: 100%; padding: 7px 8px; border: 0; border-radius: 6px; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }`,
    `.${css.menuDanger} { color: #a92f2f; }`,
    `.${css.scrim} { position: fixed; inset: 0; z-index: 90; display: grid; place-items: center; background: rgba(28, 37, 54, .38); }`,
    `.${css.dialog} { width: 430px; max-width: calc(100vw - 32px); background: #fff; border-radius: 10px; box-shadow: 0 20px 44px rgba(28, 37, 54, .28); }`,
    `.${css.dialogHead} { padding: 16px 18px 6px; }`,
    `.${css.dialogBody} { padding: 6px 18px 14px; }`,
    `.${css.dialogFoot} { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 18px; border-top: 1px solid #eef0f5; }`,
    `.${css.toastRegion} { position: fixed; left: 20px; bottom: 20px; z-index: 100; }`,
    `.${css.toast} { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px; background: #1b2338; color: #fff; box-shadow: 0 10px 24px rgba(28, 37, 54, .3); }`,
    `.${css.toastText} { margin: 0; }`,
  ].join("\n");
}
