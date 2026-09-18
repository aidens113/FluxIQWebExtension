/**
 * The console's class names, the way a CSS-in-JS build emits them.
 *
 * Every class on this page is a content hash -- `css-1x7ab3f` -- and not one
 * of them says what it is for. Two properties follow, and both are why the
 * fixture exists:
 *
 * 1. A class is a *style*, not a role. `iconButton` is the design system's one
 *    icon button, so the same hash sits on the notification bell, on the
 *    composer's close control, and on all 280 row action buttons at once. A
 *    class set is evidence about which component was used, never about which
 *    control was pressed.
 * 2. The hash is derived from the build, so shipping any style change renames
 *    every class on the page. The `restyled` rendering is exactly that and
 *    nothing else: same markup, same text, same accessible names, new hashes.
 */
const CLASS_ROLES = [
  "app", "sidebar", "brand", "brandMark", "navLabel", "navList", "navItem", "navCurrent", "navIcon", "navCount",
  "sidebarFoot", "main", "topbar", "searchForm", "searchInput", "topActions", "iconButton", "avatar", "userButton",
  "content", "pageHead", "pageTitle", "statLine", "pageActions", "button", "buttonPrimary", "buttonDanger",
  "card", "cardHead", "toolbar", "field", "fieldLabel", "input", "select", "chipRow", "chip", "bulkBar", "bulkCount",
  "tableWrap", "table", "headCell", "checkCell", "row", "rowSelected", "cell", "actionCell",
  "postCell", "postExcerpt", "linkChip", "slotPrimary", "slotSecondary", "accountCell", "accountName", "accountHandle",
  "badge", "badgeScheduled", "badgeDraft", "badgePublished", "badgeFailed", "badgeQueued",
  "tableFoot", "footNote", "empty", "appFoot",
  "composer", "composerHead", "composerGrid", "composerFoot", "textarea", "charCount",
  "scrim", "dialog", "dialogHead", "dialogBody", "dialogFoot", "menu", "menuHead", "menuItem", "menuDanger",
  "toastRegion", "toast", "srOnly",
] as const;

export type SchedulerClassRole = (typeof CLASS_ROLES)[number];
export type SchedulerClasses = Record<SchedulerClassRole, string>;

/** The two builds the fixture can render, spelled as the page footer spells them. */
export const SCHEDULER_BUILDS = { baseline: "8.14.2", restyled: "8.15.0" } as const;

/** The footer line for a build: the one place the page says which of the two renderings it is. */
export function buildMarkerText(build: string): string {
  return `Cadence Studio · build ${build}`;
}

/** Every class name for one build: the same roles, entirely different hashes. */
export function schedulerClasses(build: string): SchedulerClasses {
  return Object.fromEntries(CLASS_ROLES.map((role) => [role, `css-${hash(`${build}:${role}`)}`])) as SchedulerClasses;
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
 * rest is the geometry a console of this size has: a sticky top bar, a table
 * header that sticks underneath it, and a composer that sits above the queue
 * when it is open.
 */
export function schedulerStylesheet(css: SchedulerClasses): string {
  return [
    `body { margin: 0; max-width: none; padding: 0; font: 14px/1.45 -apple-system, "Segoe UI", system-ui, sans-serif; color: #1c2430; background: #f4f6f9; }`,
    `li { display: list-item; gap: 0; margin: 0; }`,
    `nav { display: block; gap: 0; }`,
    `label { display: inline-block; margin: 0; }`,
    `button, input, select, textarea { font: inherit; }`,
    `.${css.srOnly} { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }`,
    `.${css.app} { display: grid; grid-template-columns: 224px minmax(0, 1fr); align-items: start; }`,
    `.${css.sidebar} { position: sticky; top: 0; height: 100vh; overflow: auto; box-sizing: border-box; padding: 16px 12px; background: #131c2b; color: #c3cedd; }`,
    `.${css.brand} { display: flex; align-items: center; gap: 8px; padding: 4px 8px 16px; font-weight: 600; color: #fff; }`,
    `.${css.brandMark} { display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 7px; background: #e0562f; color: #fff; font-size: 12px; }`,
    `.${css.navLabel} { margin: 14px 8px 6px; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: #78889f; }`,
    `.${css.navList} { list-style: none; margin: 0; padding: 0; }`,
    `.${css.navItem} { display: flex; align-items: center; gap: 10px; padding: 7px 8px; border-radius: 6px; color: inherit; text-decoration: none; }`,
    `.${css.navCurrent} { background: #22304a; color: #fff; }`,
    `.${css.navIcon} { flex: none; width: 15px; height: 15px; opacity: .8; }`,
    `.${css.navCount} { margin-left: auto; padding: 1px 7px; border-radius: 9px; background: #2c3c5c; font-size: 11px; }`,
    `.${css.sidebarFoot} { margin-top: 20px; padding: 12px 8px; border-top: 1px solid #253350; font-size: 12px; color: #8b9bb4; }`,
    `.${css.main} { min-width: 0; }`,
    `.${css.topbar} { position: sticky; top: 0; z-index: 30; display: flex; align-items: center; gap: 12px; height: 56px; padding: 0 20px; background: #fff; border-bottom: 1px solid #e2e7ef; }`,
    `.${css.searchForm} { flex: 1; max-width: 400px; }`,
    `.${css.searchInput} { width: 100%; padding: 6px 10px; border: 1px solid #d5dce6; border-radius: 6px; background: #f7f9fc; }`,
    `.${css.topActions} { display: flex; align-items: center; gap: 6px; margin-left: auto; }`,
    `.${css.iconButton} { display: inline-grid; place-items: center; width: 30px; height: 30px; border: 1px solid transparent; border-radius: 6px; background: transparent; color: #47566b; cursor: pointer; }`,
    `.${css.avatar} { display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; background: #dde5f1; color: #2c3d57; font-size: 11px; font-weight: 600; }`,
    `.${css.userButton} { display: flex; align-items: center; gap: 8px; padding: 4px 8px; border: 1px solid transparent; border-radius: 6px; background: transparent; color: inherit; cursor: pointer; }`,
    `.${css.content} { padding: 20px; }`,
    `.${css.pageHead} { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 14px; }`,
    `.${css.pageTitle} { margin: 0; font-size: 20px; }`,
    `.${css.statLine} { margin: 4px 0 0; color: #5d6b7e; }`,
    `.${css.pageActions} { display: flex; gap: 8px; margin-left: auto; }`,
    `.${css.button} { padding: 6px 12px; border: 1px solid #d0d8e4; border-radius: 6px; background: #fff; color: #1c2430; cursor: pointer; }`,
    `.${css.buttonPrimary} { border-color: #e0562f; background: #e0562f; color: #fff; }`,
    `.${css.buttonDanger} { border-color: #d0d8e4; color: #ac2e2e; }`,
    `.${css.card} { border: 1px solid #e2e7ef; border-radius: 10px; background: #fff; overflow: hidden; }`,
    `.${css.cardHead} { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-bottom: 1px solid #eef1f6; }`,
    `.${css.toolbar} { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 12px 14px; border-bottom: 1px solid #eef1f6; }`,
    `.${css.field} { display: inline-flex; align-items: center; gap: 6px; }`,
    `.${css.fieldLabel} { font-size: 12px; color: #5d6b7e; }`,
    `.${css.input} { padding: 6px 10px; border: 1px solid #d5dce6; border-radius: 6px; min-width: 200px; }`,
    `.${css.select} { padding: 6px 8px; border: 1px solid #d5dce6; border-radius: 6px; background: #fff; }`,
    `.${css.chipRow} { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 10px 14px; border-bottom: 1px solid #eef1f6; background: #fafbfd; }`,
    `.${css.chip} { padding: 2px 9px; border-radius: 11px; background: #eaeffa; color: #2c3d57; font-size: 12px; }`,
    `.${css.bulkBar} { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-bottom: 1px solid #eef1f6; background: #fff7ed; }`,
    `.${css.bulkCount} { margin: 0; font-weight: 600; }`,
    `.${css.tableWrap} { overflow: auto; max-height: 70vh; }`,
    `.${css.table} { width: 100%; border-collapse: collapse; }`,
    `.${css.headCell} { position: sticky; top: 0; z-index: 10; padding: 9px 12px; border-bottom: 1px solid #e2e7ef; background: #f7f9fc; text-align: left; font-size: 12px; letter-spacing: .03em; text-transform: uppercase; color: #5d6b7e; white-space: nowrap; }`,
    `.${css.checkCell} { width: 34px; }`,
    `.${css.actionCell} { width: 44px; text-align: right; }`,
    `.${css.row} { border-bottom: 1px solid #f0f3f8; }`,
    `.${css.rowSelected} { background: #fff7ed; }`,
    `.${css.cell} { padding: 9px 12px; vertical-align: top; }`,
    `.${css.postCell} { max-width: 420px; }`,
    `.${css.postExcerpt} { color: #1c2430; text-decoration: none; }`,
    `.${css.linkChip} { display: inline-block; margin-left: 6px; padding: 1px 7px; border-radius: 10px; background: #eef2f8; color: #47566b; font-size: 11px; }`,
    `.${css.slotPrimary} { display: block; }`,
    `.${css.slotSecondary} { display: block; color: #78889f; font-size: 12px; }`,
    `.${css.accountCell} { display: flex; align-items: flex-start; gap: 8px; }`,
    `.${css.accountName} { display: block; }`,
    `.${css.accountHandle} { display: block; color: #78889f; font-size: 12px; }`,
    `.${css.badge} { display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 12px; background: #eef1f6; color: #47566b; }`,
    `.${css.badgeScheduled} { background: #e6f0ff; color: #234a8a; }`,
    `.${css.badgeDraft} { background: #f0f1f4; color: #55606f; }`,
    `.${css.badgePublished} { background: #e6f4ea; color: #1e6b3a; }`,
    `.${css.badgeFailed} { background: #fdeaea; color: #9c2a2a; }`,
    `.${css.badgeQueued} { background: #fff2dd; color: #8a5a12; }`,
    `.${css.tableFoot} { display: flex; gap: 16px; padding: 10px 14px; border-top: 1px solid #eef1f6; }`,
    `.${css.footNote} { margin: 0; color: #5d6b7e; font-size: 12px; }`,
    `.${css.empty} { padding: 28px 14px; text-align: center; color: #5d6b7e; }`,
    `.${css.appFoot} { padding: 14px 4px 24px; color: #8b9bb4; }`,
    `.${css.composer} { margin-bottom: 14px; border: 1px solid #e2e7ef; border-radius: 10px; background: #fff; }`,
    `.${css.composerHead} { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-bottom: 1px solid #eef1f6; font-weight: 600; }`,
    `.${css.composerGrid} { display: flex; flex-wrap: wrap; gap: 12px; padding: 12px 14px; }`,
    `.${css.composerFoot} { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-top: 1px solid #eef1f6; }`,
    `.${css.textarea} { width: 100%; min-height: 84px; box-sizing: border-box; padding: 8px 10px; border: 1px solid #d5dce6; border-radius: 6px; }`,
    `.${css.charCount} { margin: 0; color: #78889f; font-size: 12px; }`,
    `.${css.scrim} { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; background: rgba(16, 25, 43, .45); }`,
    `.${css.dialog} { width: min(460px, 92vw); border-radius: 10px; background: #fff; box-shadow: 0 18px 48px rgba(16, 25, 43, .28); }`,
    `.${css.dialogHead} { padding: 14px 16px 0; font-weight: 600; }`,
    `.${css.dialogBody} { padding: 10px 16px; }`,
    `.${css.dialogFoot} { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 16px 16px; }`,
    `.${css.menu} { position: absolute; z-index: 70; width: 208px; padding: 5px; border: 1px solid #e2e7ef; border-radius: 8px; background: #fff; box-shadow: 0 12px 28px rgba(16, 25, 43, .2); }`,
    `.${css.menuHead} { margin: 4px 8px 6px; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: #78889f; }`,
    `.${css.menuItem} { display: block; width: 100%; padding: 7px 8px; border: 0; border-radius: 6px; background: transparent; text-align: left; cursor: pointer; }`,
    `.${css.menuDanger} { color: #ac2e2e; }`,
    `.${css.toastRegion} { position: fixed; right: 18px; bottom: 18px; z-index: 80; display: grid; gap: 8px; }`,
    `.${css.toast} { padding: 10px 14px; border-radius: 8px; background: #131c2b; color: #fff; box-shadow: 0 10px 26px rgba(16, 25, 43, .3); }`,
  ].join("\n");
}
