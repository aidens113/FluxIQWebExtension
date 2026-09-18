import { buildClassNames } from "../../build-classes.js";

/**
 * The desk's class names and the stylesheet they carry.
 *
 * Every class is a build hash (`build-classes.ts`), so nothing on this page
 * says what it is for and the same hash sits on the notification bell, on the
 * toolbar's settings control and on all 320 row action buttons at once. A class
 * set is evidence about which component was used, never about which control was
 * pressed.
 */
const CLASS_ROLES = [
  "app", "sidebar", "brand", "brandMark", "navLabel", "navList", "navItem", "navCurrent", "navIcon", "navCount", "sidebarFoot",
  "main", "topbar", "searchForm", "searchInput", "topActions", "iconButton", "avatar", "userButton",
  "content", "pageHead", "pageTitle", "statLine", "pageActions", "workload",
  "button", "buttonPrimary", "buttonDanger", "buttonNeutral",
  "card", "toolbar", "field", "fieldLabel", "input", "select", "chipRow", "chip", "bulkBar", "bulkCount",
  "tableWrap", "table", "headCell", "sortButton", "checkCell", "row", "rowSelected", "cell", "subjectButton", "actionCell",
  "requesterName", "requesterEmail", "badge", "badgeUrgent", "badgeHigh", "badgeNormal", "badgeLow",
  "badgeStatus", "slaBreached", "slaDue", "tableFoot", "footNote", "empty", "appFoot",
  "pane", "paneHead", "paneBody", "paneFoot", "definitions", "thread", "message", "messageMeta", "messageBody",
  "composer", "textarea", "hint", "formGrid",
  "menu", "menuHead", "menuItem", "menuDanger", "scrim", "dialog", "dialogHead", "dialogBody", "dialogFoot",
  "toastRegion", "toast", "toastText", "srOnly",
] as const;

export type DeskClassRole = (typeof CLASS_ROLES)[number];
export type DeskClasses = Record<DeskClassRole, string>;

/** The build the desk ships, spelled as the page footer spells it. */
export const DESK_BUILD = "5.14.2";

/** The footer line: the one place the page says which build it is. */
export function deskBuildMarker(): string {
  return `Halo Support · build ${DESK_BUILD}`;
}

/** Every class name the desk renders with. */
export function deskClasses(): DeskClasses {
  return buildClassNames(DESK_BUILD, CLASS_ROLES);
}

/**
 * The design system's icon paths. Every icon on the page is one of these, drawn
 * in the current colour, so an icon says nothing about which control carries it.
 */
export const DESK_GLYPHS = {
  square: "M3 3h10v10H3z",
  bell: "M8 2a4 4 0 0 0-4 4v3l-1 2h10l-1-2V6a4 4 0 0 0-4-4z",
  sparkle: "M8 2l1.6 4.4L14 8l-4.4 1.6L8 14l-1.6-4.4L2 8l4.4-1.6z",
  chevron: "M4 6l4 4 4-4",
  sliders: "M2 4h12M2 8h12M2 12h12",
  overflow: "M4 8h.01M8 8h.01M12 8h.01",
  cross: "M4 4l8 8M12 4l-8 8",
} as const;

/** One design-system glyph: a single path, hidden from the accessibility tree, so only the control's own name labels it. */
export function deskIcon(className: string, path: string): string {
  return `<svg class="${className}" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="${path}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;
}

/**
 * The emitted stylesheet. The first five rules undo the lab's shared page
 * shell, which is centred and 48rem wide; an application shell is neither. The
 * geometry after them is the part a run can trip over: a sticky top bar, a
 * table header sticking underneath it, and a detail pane docked down the right
 * edge over whatever the table has there.
 */
export function deskStylesheet(css: DeskClasses): string {
  return [
    `body { margin: 0; max-width: none; padding: 0; font: 14px/1.45 -apple-system, "Segoe UI", system-ui, sans-serif; color: #1d2430; background: #f4f6fa; }`,
    `li { display: list-item; gap: 0; margin: 0; }`,
    `nav { display: block; gap: 0; }`,
    `label { display: inline-block; margin: 0; }`,
    `button, input, select, textarea { font: inherit; }`,
    `.${css.srOnly} { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }`,
    `.${css.app} { display: grid; grid-template-columns: 216px minmax(0, 1fr); align-items: start; }`,
    `.${css.sidebar} { position: sticky; top: 0; height: 100vh; overflow: auto; box-sizing: border-box; padding: 16px 12px; background: #132033; color: #c3d0e2; }`,
    `.${css.brand} { display: flex; align-items: center; gap: 8px; padding: 4px 8px 16px; font-weight: 600; color: #fff; }`,
    `.${css.brandMark} { display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 7px; background: #2f7d6b; color: #fff; font-size: 12px; }`,
    `.${css.navLabel} { margin: 14px 8px 6px; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: #7e8ea6; }`,
    `.${css.navList} { list-style: none; margin: 0; padding: 0; }`,
    `.${css.navItem} { display: flex; align-items: center; gap: 10px; padding: 7px 8px; border-radius: 6px; color: inherit; text-decoration: none; }`,
    `.${css.navCurrent} { background: #1d3049; color: #fff; }`,
    `.${css.navIcon} { flex: none; width: 15px; height: 15px; opacity: .85; }`,
    `.${css.navCount} { margin-left: auto; padding: 1px 7px; border-radius: 9px; background: #27405f; font-size: 11px; }`,
    `.${css.sidebarFoot} { margin-top: 20px; padding: 12px 8px; border-top: 1px solid #22344d; font-size: 12px; color: #8b9cb4; }`,
    `.${css.main} { min-width: 0; }`,
    `.${css.topbar} { position: sticky; top: 0; z-index: 30; display: flex; align-items: center; gap: 12px; height: 56px; padding: 0 20px; background: #fff; border-bottom: 1px solid #e2e7ef; }`,
    `.${css.searchForm} { flex: 1; max-width: 400px; }`,
    `.${css.searchInput} { width: 100%; padding: 6px 10px; border: 1px solid #d5dce6; border-radius: 6px; background: #f7f9fc; }`,
    `.${css.topActions} { display: flex; align-items: center; gap: 6px; margin-left: auto; }`,
    `.${css.iconButton} { display: inline-grid; place-items: center; width: 32px; height: 32px; border: 1px solid transparent; border-radius: 6px; background: none; color: #52627a; cursor: pointer; }`,
    `.${css.avatar} { display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; background: #d8e6e2; color: #205246; font-size: 11px; font-weight: 600; }`,
    `.${css.userButton} { display: flex; align-items: center; gap: 8px; padding: 4px 8px; border: 1px solid #e2e7ef; border-radius: 999px; background: #fff; cursor: pointer; }`,
    `.${css.content} { padding: 20px 20px 140px; }`,
    `.${css.pageHead} { display: flex; align-items: flex-end; gap: 16px; margin-bottom: 14px; }`,
    `.${css.pageTitle} { margin: 0 0 2px; font-size: 20px; }`,
    `.${css.statLine} { margin: 0; color: #56657d; }`,
    `.${css.workload} { margin: 4px 0 0; color: #6b7a92; font-size: 12px; }`,
    `.${css.pageActions} { display: flex; gap: 8px; margin-left: auto; }`,
    `.${css.button} { padding: 6px 12px; border: 1px solid #d5dce6; border-radius: 6px; background: #fff; color: #1d2430; cursor: pointer; }`,
    `.${css.buttonPrimary} { border-color: #226354; background: #2f7d6b; color: #fff; }`,
    `.${css.buttonNeutral} { border-color: #c2ccdb; background: #eef2f8; color: #1d2430; }`,
    `.${css.buttonDanger} { border-color: #e2b3b3; color: #ab2f2f; }`,
    `.${css.button}[disabled] { opacity: .5; cursor: not-allowed; }`,
    `.${css.card} { background: #fff; border: 1px solid #e2e7ef; border-radius: 10px; }`,
    `.${css.toolbar} { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 12px 14px; border-bottom: 1px solid #edf0f5; }`,
    `.${css.field} { display: flex; align-items: center; gap: 6px; }`,
    `.${css.fieldLabel} { color: #56657d; }`,
    `.${css.input} { width: 230px; padding: 6px 10px; border: 1px solid #d5dce6; border-radius: 6px; }`,
    `.${css.select} { padding: 6px 8px; border: 1px solid #d5dce6; border-radius: 6px; background: #fff; }`,
    `.${css.chipRow} { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 10px 14px; border-bottom: 1px solid #edf0f5; background: #f8fafd; }`,
    `.${css.chip} { padding: 2px 9px; border-radius: 999px; background: #e3efec; color: #205246; font-size: 12px; }`,
    `.${css.bulkBar} { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-bottom: 1px solid #edf0f5; background: #eaf3f0; }`,
    `.${css.bulkCount} { font-weight: 600; }`,
    `.${css.tableWrap} { min-width: 0; }`,
    `.${css.table} { width: 100%; border-collapse: collapse; }`,
    `.${css.headCell} { position: sticky; top: 56px; z-index: 20; padding: 9px 12px; background: #fbfcfe; border-bottom: 1px solid #e2e7ef; color: #56657d; font-size: 12px; font-weight: 600; text-align: left; white-space: nowrap; }`,
    `.${css.sortButton} { border: 0; padding: 0; background: none; color: inherit; font: inherit; cursor: pointer; }`,
    `.${css.checkCell} { width: 34px; padding-left: 14px; }`,
    `.${css.row} { border-bottom: 1px solid #f0f3f8; }`,
    `.${css.rowSelected} { background: #f2f8f6; }`,
    `.${css.cell} { padding: 8px 12px; vertical-align: middle; white-space: nowrap; }`,
    `.${css.subjectButton} { border: 0; padding: 0; background: none; color: #1b5e9c; font: inherit; text-align: left; cursor: pointer; }`,
    `.${css.actionCell} { padding-right: 14px; text-align: right; }`,
    `.${css.requesterName} { display: block; font-weight: 500; }`,
    `.${css.requesterEmail} { display: block; color: #6b7a92; font-size: 12px; }`,
    `.${css.badge} { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 12px; }`,
    `.${css.badgeUrgent} { background: #fbe3e3; color: #9c2626; }`,
    `.${css.badgeHigh} { background: #fdefdc; color: #8a5b12; }`,
    `.${css.badgeNormal} { background: #e8eef7; color: #355073; }`,
    `.${css.badgeLow} { background: #eef1f5; color: #67748a; }`,
    `.${css.badgeStatus} { background: #e7f2ee; color: #205246; }`,
    `.${css.slaBreached} { color: #9c2626; font-weight: 600; }`,
    `.${css.slaDue} { color: #56657d; }`,
    `.${css.tableFoot} { display: flex; gap: 16px; padding: 10px 14px; color: #56657d; }`,
    `.${css.footNote} { margin: 0; }`,
    `.${css.empty} { padding: 28px 14px; color: #6b7a92; text-align: center; }`,
    `.${css.appFoot} { padding: 18px 4px; color: #8a97ab; font-size: 12px; }`,
    `.${css.pane} { position: fixed; top: 56px; right: 0; bottom: 0; z-index: 50; width: 430px; overflow: auto; background: #fff; border-left: 1px solid #e2e7ef; box-shadow: -12px 0 28px rgba(19, 32, 51, .1); }`,
    `.${css.paneHead} { padding: 14px 16px; border-bottom: 1px solid #edf0f5; }`,
    `.${css.paneBody} { padding: 14px 16px; }`,
    `.${css.paneFoot} { display: flex; flex-wrap: wrap; gap: 8px; padding: 12px 16px; border-top: 1px solid #edf0f5; }`,
    `.${css.definitions} { display: grid; grid-template-columns: 110px minmax(0, 1fr); gap: 4px 10px; margin: 0; }`,
    `.${css.thread} { list-style: none; margin: 16px 0 0; padding: 0; }`,
    `.${css.message} { display: block; margin: 0 0 12px; padding: 10px 12px; border: 1px solid #edf0f5; border-radius: 8px; background: #fbfcfe; }`,
    `.${css.messageMeta} { margin: 0 0 4px; color: #6b7a92; font-size: 12px; }`,
    `.${css.messageBody} { margin: 0; }`,
    `.${css.composer} { margin-top: 16px; display: grid; gap: 8px; }`,
    `.${css.textarea} { width: 100%; min-height: 84px; box-sizing: border-box; padding: 8px 10px; border: 1px solid #d5dce6; border-radius: 6px; }`,
    `.${css.hint} { margin: 0; color: #6b7a92; font-size: 12px; }`,
    `.${css.formGrid} { display: grid; gap: 12px; max-width: 460px; }`,
    `.${css.menu} { position: absolute; z-index: 80; width: 212px; padding: 4px; background: #fff; border: 1px solid #e2e7ef; border-radius: 8px; box-shadow: 0 10px 26px rgba(19, 32, 51, .16); }`,
    `.${css.menuHead} { margin: 4px 8px 6px; color: #6b7a92; font-size: 12px; }`,
    `.${css.menuItem} { display: block; width: 100%; padding: 7px 8px; border: 0; border-radius: 6px; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }`,
    `.${css.menuDanger} { color: #ab2f2f; }`,
    `.${css.scrim} { position: fixed; inset: 0; z-index: 90; display: grid; place-items: center; background: rgba(19, 32, 51, .38); }`,
    `.${css.dialog} { width: 420px; max-width: calc(100vw - 32px); background: #fff; border-radius: 10px; box-shadow: 0 20px 44px rgba(19, 32, 51, .28); }`,
    `.${css.dialogHead} { padding: 16px 18px 6px; }`,
    `.${css.dialogBody} { padding: 6px 18px 14px; }`,
    `.${css.dialogFoot} { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 18px; border-top: 1px solid #edf0f5; }`,
    `.${css.toastRegion} { position: fixed; left: 20px; bottom: 20px; z-index: 100; }`,
    `.${css.toast} { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px; background: #132033; color: #fff; box-shadow: 0 10px 24px rgba(19, 32, 51, .3); }`,
    `.${css.toastText} { margin: 0; }`,
  ].join("\n");
}
