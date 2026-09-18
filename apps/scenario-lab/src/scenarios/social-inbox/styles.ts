/**
 * The inbox's class names, the way a CSS-in-JS build emits them.
 *
 * Every class on this page is a content hash -- `css-1x7ab3f` -- and not one
 * of them says what it is for. Two properties follow, and both are why the
 * fixture exists:
 *
 * 1. A class is a *style*, not a role. `rowAction` is the design system's one
 *    row control, so the same hash sits on every Reply, every Mark handled and
 *    every Assign on the page at once. A class set is evidence about which
 *    component was used, never about which control was pressed.
 * 2. The hash is derived from the build, so shipping any style change renames
 *    every class on the page. The `restyled` rendering is exactly that and
 *    nothing else: same markup, same text, same accessible names, new hashes.
 */
const CLASS_ROLES = [
  "app", "sidebar", "brand", "brandMark", "navLabel", "navList", "navItem", "navCurrent", "navIcon", "navCount",
  "sidebarFoot", "main", "topbar", "searchForm", "searchInput", "topActions", "iconButton", "avatar", "userButton",
  "content", "pageHead", "pageTitle", "statLine", "pageActions", "button", "buttonPrimary", "buttonGhost",
  "card", "toolbar", "field", "fieldLabel", "input", "select", "chipRow", "chip", "bulkBar", "bulkCount",
  "tableWrap", "table", "headCell", "checkCell", "row", "rowSelected", "cell", "actionCell", "rowAction",
  "person", "personName", "personHandle", "accountName", "accountHandle", "messageCell", "messageText",
  "badge", "badgeUnanswered", "badgeHandled", "badgeAssigned", "kindTag",
  "tableFoot", "footNote", "loadMore", "empty", "appFoot",
  "scrim", "dialog", "dialogHead", "dialogBody", "dialogFoot", "textarea", "menu", "menuHead", "menuItem",
  "toastRegion", "toast", "srOnly",
] as const;

export type InboxClassRole = (typeof CLASS_ROLES)[number];
export type InboxClasses = Record<InboxClassRole, string>;

/** The two builds the fixture can render, spelled as the page footer spells them. */
export const INBOX_BUILDS = { baseline: "3.9.4", restyled: "3.10.0" } as const;

/** The footer line for a build: the one place the page says which of the two renderings it is. */
export function inboxBuildMarkerText(build: string): string {
  return `Mentio · build ${build}`;
}

/** Every class name for one build: the same roles, entirely different hashes. */
export function inboxClasses(build: string): InboxClasses {
  return Object.fromEntries(CLASS_ROLES.map((role) => [role, `css-${hash(`${build}:${role}`)}`])) as InboxClasses;
}

/** FNV-1a in base 36: seven characters, indistinguishable from an emotion or styled-components build. */
function hash(text: string): string {
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value.toString(36).padStart(7, "0").slice(0, 7);
}

/**
 * The emitted stylesheet. The first five rules undo the lab's shared page
 * shell, which is centred and 48rem wide; an application shell is neither. The
 * rest is the geometry an inbox of this size has: a sticky top bar, a sticky
 * table header, row controls that only show their labels on wider screens, and
 * a load control pinned under the last row.
 */
export function inboxStylesheet(css: InboxClasses): string {
  return [
    `body { margin: 0; max-width: none; padding: 0; font: 14px/1.45 -apple-system, "Segoe UI", system-ui, sans-serif; color: #1d232e; background: #f5f6f8; }`,
    `li { display: list-item; gap: 0; margin: 0; }`,
    `nav { display: block; gap: 0; }`,
    `label { display: inline-block; margin: 0; }`,
    `button, input, select, textarea { font: inherit; }`,
    `.${css.srOnly} { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }`,
    `.${css.app} { display: grid; grid-template-columns: 216px minmax(0, 1fr); align-items: start; }`,
    `.${css.sidebar} { position: sticky; top: 0; height: 100vh; overflow: auto; box-sizing: border-box; padding: 16px 12px; background: #17212b; color: #c0cbd6; }`,
    `.${css.brand} { display: flex; align-items: center; gap: 8px; padding: 4px 8px 16px; font-weight: 600; color: #fff; }`,
    `.${css.brandMark} { display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 7px; background: #2f8f83; color: #fff; font-size: 12px; }`,
    `.${css.navLabel} { margin: 14px 8px 6px; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: #7a8b9b; }`,
    `.${css.navList} { list-style: none; margin: 0; padding: 0; }`,
    `.${css.navItem} { display: flex; align-items: center; gap: 10px; padding: 7px 8px; border-radius: 6px; color: inherit; text-decoration: none; }`,
    `.${css.navCurrent} { background: #22303d; color: #fff; }`,
    `.${css.navIcon} { flex: none; width: 15px; height: 15px; opacity: .8; }`,
    `.${css.navCount} { margin-left: auto; padding: 1px 7px; border-radius: 9px; background: #2c3e4e; font-size: 11px; }`,
    `.${css.sidebarFoot} { margin-top: 20px; padding: 12px 8px; border-top: 1px solid #253442; font-size: 12px; color: #8899a8; }`,
    `.${css.main} { min-width: 0; }`,
    `.${css.topbar} { position: sticky; top: 0; z-index: 30; display: flex; align-items: center; gap: 12px; height: 56px; padding: 0 20px; background: #fff; border-bottom: 1px solid #e3e6ec; }`,
    `.${css.searchForm} { flex: 1; max-width: 380px; }`,
    `.${css.searchInput} { width: 100%; padding: 6px 10px; border: 1px solid #d6dbe4; border-radius: 6px; background: #f7f8fb; }`,
    `.${css.topActions} { display: flex; align-items: center; gap: 6px; margin-left: auto; }`,
    `.${css.iconButton} { display: inline-grid; place-items: center; width: 30px; height: 30px; border: 1px solid transparent; border-radius: 6px; background: transparent; color: #4a5668; cursor: pointer; }`,
    `.${css.avatar} { display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; background: #dce4ee; color: #2d3d54; font-size: 11px; font-weight: 600; }`,
    `.${css.userButton} { display: flex; align-items: center; gap: 8px; padding: 4px 8px; border: 1px solid transparent; border-radius: 6px; background: transparent; color: inherit; cursor: pointer; }`,
    `.${css.content} { padding: 20px; }`,
    `.${css.pageHead} { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 14px; }`,
    `.${css.pageTitle} { margin: 0; font-size: 20px; }`,
    `.${css.statLine} { margin: 4px 0 0; color: #5c6878; }`,
    `.${css.pageActions} { display: flex; gap: 8px; margin-left: auto; }`,
    `.${css.button} { padding: 6px 12px; border: 1px solid #d1d7e0; border-radius: 6px; background: #fff; color: #1d232e; cursor: pointer; }`,
    `.${css.buttonPrimary} { border-color: #2f8f83; background: #2f8f83; color: #fff; }`,
    `.${css.buttonGhost} { border-color: transparent; background: transparent; color: #3c6f9c; }`,
    `.${css.card} { border: 1px solid #e3e6ec; border-radius: 10px; background: #fff; overflow: hidden; }`,
    `.${css.toolbar} { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 12px 14px; border-bottom: 1px solid #eef0f5; }`,
    `.${css.field} { display: inline-flex; align-items: center; gap: 6px; }`,
    `.${css.fieldLabel} { font-size: 12px; color: #5c6878; }`,
    `.${css.input} { padding: 6px 10px; border: 1px solid #d6dbe4; border-radius: 6px; min-width: 200px; }`,
    `.${css.select} { padding: 6px 8px; border: 1px solid #d6dbe4; border-radius: 6px; background: #fff; }`,
    `.${css.chipRow} { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 10px 14px; border-bottom: 1px solid #eef0f5; background: #fafbfd; }`,
    `.${css.chip} { padding: 2px 9px; border-radius: 11px; background: #e7f0ee; color: #23574f; font-size: 12px; }`,
    `.${css.bulkBar} { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-bottom: 1px solid #eef0f5; background: #f3f8f7; }`,
    `.${css.bulkCount} { margin: 0; font-weight: 600; }`,
    `.${css.tableWrap} { overflow: auto; }`,
    `.${css.table} { width: 100%; border-collapse: collapse; }`,
    `.${css.headCell} { position: sticky; top: 0; z-index: 10; padding: 9px 12px; border-bottom: 1px solid #e3e6ec; background: #f7f8fb; text-align: left; font-size: 12px; letter-spacing: .03em; text-transform: uppercase; color: #5c6878; white-space: nowrap; }`,
    `.${css.checkCell} { width: 34px; }`,
    `.${css.actionCell} { width: 210px; }`,
    `.${css.row} { border-bottom: 1px solid #f1f3f7; }`,
    `.${css.rowSelected} { background: #f3f8f7; }`,
    `.${css.cell} { padding: 9px 12px; vertical-align: top; }`,
    `.${css.rowAction} { padding: 3px 8px; margin-right: 4px; border: 1px solid #d1d7e0; border-radius: 6px; background: #fff; color: #1d232e; cursor: pointer; font-size: 12px; }`,
    `.${css.person} { display: flex; align-items: flex-start; gap: 8px; }`,
    `.${css.personName} { display: block; }`,
    `.${css.personHandle} { display: block; color: #7a8b9b; font-size: 12px; }`,
    `.${css.accountName} { display: block; }`,
    `.${css.accountHandle} { display: block; color: #7a8b9b; font-size: 12px; }`,
    `.${css.messageCell} { max-width: 380px; }`,
    `.${css.messageText} { color: #1d232e; text-decoration: none; }`,
    `.${css.badge} { display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 12px; background: #eef0f5; color: #4a5668; }`,
    `.${css.badgeUnanswered} { background: #fdeee2; color: #8c4a13; }`,
    `.${css.badgeHandled} { background: #e7f4ea; color: #1f6b3b; }`,
    `.${css.badgeAssigned} { background: #e7eefb; color: #23498a; }`,
    `.${css.kindTag} { color: #4a5668; }`,
    `.${css.tableFoot} { display: flex; align-items: center; gap: 16px; padding: 12px 14px; border-top: 1px solid #eef0f5; }`,
    `.${css.footNote} { margin: 0; color: #5c6878; font-size: 12px; }`,
    `.${css.loadMore} { padding: 6px 12px; border: 1px solid #d1d7e0; border-radius: 6px; background: #fff; cursor: pointer; }`,
    `.${css.empty} { padding: 28px 14px; text-align: center; color: #5c6878; }`,
    `.${css.appFoot} { padding: 14px 4px 24px; color: #8899a8; }`,
    `.${css.scrim} { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; background: rgba(23, 33, 43, .45); }`,
    `.${css.dialog} { width: min(520px, 92vw); border-radius: 10px; background: #fff; box-shadow: 0 18px 48px rgba(23, 33, 43, .28); }`,
    `.${css.dialogHead} { display: flex; align-items: center; gap: 10px; padding: 14px 16px 8px; font-weight: 600; }`,
    `.${css.dialogBody} { padding: 4px 16px 10px; }`,
    `.${css.dialogFoot} { display: flex; justify-content: flex-end; gap: 8px; padding: 10px 16px 16px; }`,
    `.${css.textarea} { width: 100%; min-height: 96px; box-sizing: border-box; padding: 8px 10px; border: 1px solid #d6dbe4; border-radius: 6px; }`,
    `.${css.menu} { position: absolute; z-index: 70; width: 208px; padding: 5px; border: 1px solid #e3e6ec; border-radius: 8px; background: #fff; box-shadow: 0 12px 28px rgba(23, 33, 43, .2); }`,
    `.${css.menuHead} { margin: 4px 8px 6px; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: #7a8b9b; }`,
    `.${css.menuItem} { display: block; width: 100%; padding: 7px 8px; border: 0; border-radius: 6px; background: transparent; text-align: left; cursor: pointer; }`,
    `.${css.toastRegion} { position: fixed; right: 18px; bottom: 18px; z-index: 80; display: grid; gap: 8px; }`,
    `.${css.toast} { padding: 10px 14px; border-radius: 8px; background: #17212b; color: #fff; box-shadow: 0 10px 26px rgba(23, 33, 43, .3); }`,
  ].join("\n");
}
