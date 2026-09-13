/**
 * The directory's class names, the way a CSS-in-JS build emits them.
 *
 * Every class on this page is a content hash -- `css-1x7ab3f` -- and not one of
 * them says what it is for. Two properties follow, and both are why the fixture
 * exists:
 *
 * 1. A class is a *style*, not a role. `iconButton` is the design system's one
 *    icon button, so the same hash sits on the notification bell, on the table
 *    settings control, on the drawer's close button, and on all 240 row action
 *    buttons at once. A class set is evidence about which component was used,
 *    never about which control was clicked.
 * 2. The hash is derived from the build, so shipping any style change renames
 *    every class on the page. The `restyled` rendering is exactly that and
 *    nothing else: same markup, same text, same accessible names, new hashes.
 *
 * Authored names -- `btn btn-primary`, `member-row` -- appear nowhere here,
 * which is the whole difference between this page and a hand-written fixture.
 */
const CLASS_ROLES = [
  "app", "sidebar", "brand", "brandMark", "navLabel", "navList", "navItem", "navCurrent", "navIcon", "navCount",
  "sidebarFoot", "main", "topbar", "searchForm", "searchInput", "topActions", "iconButton", "avatar", "userButton",
  "content", "pageHead", "pageTitle", "statLine", "pageActions", "button", "buttonPrimary", "buttonDanger",
  "card", "toolbar", "field", "fieldLabel", "input", "select", "chipRow", "chip", "bulkBar", "bulkCount",
  "tableWrap", "table", "headCell", "sortButton", "checkCell", "row", "rowSelected", "cell", "actionCell",
  "person", "personName", "personEmail", "badge", "badgeActive", "badgeInvited", "badgeSuspended",
  "tableFoot", "footNote", "empty", "appFoot", "launcher", "drawer", "drawerHead", "drawerBody",
  "menu", "menuHead", "menuItem", "menuDanger", "scrim", "dialog", "dialogHead", "dialogBody", "dialogFoot",
  "toastRegion", "toast", "toastText", "srOnly",
] as const;

export type DirectoryClassRole = (typeof CLASS_ROLES)[number];
export type DirectoryClasses = Record<DirectoryClassRole, string>;

/** The two builds the fixture can render, spelled as the page footer spells them. */
export const DIRECTORY_BUILDS = { baseline: "24.6.1", restyled: "24.7.2" } as const;

/** The footer line for a build: the one place the page says which of the two renderings it is. */
export function buildMarkerText(build: string): string {
  return `Meridian Console · build ${build}`;
}

/** Every class name for one build: the same roles, entirely different hashes. */
export function directoryClasses(build: string): DirectoryClasses {
  return Object.fromEntries(CLASS_ROLES.map((role) => [role, `css-${hash(`${build}:${role}`)}`])) as DirectoryClasses;
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
 * The emitted stylesheet. It carries the geometry the page's hit-testing turns
 * on: a sticky top bar, a table header that sticks underneath it, a fixed help
 * launcher over the bottom-right corner, and a support drawer down the right
 * edge -- each of them able to be painted over a control that the DOM still
 * reports as perfectly clickable.
 *
 * The first four rules undo the lab's shared page shell, which is centred and
 * 48rem wide. An application shell is neither.
 */
export function directoryStylesheet(css: DirectoryClasses): string {
  return [
    `body { margin: 0; max-width: none; padding: 0; font: 14px/1.45 -apple-system, "Segoe UI", system-ui, sans-serif; color: #1f2933; background: #f5f7fa; }`,
    `li { display: list-item; gap: 0; margin: 0; }`,
    `nav { display: block; gap: 0; }`,
    `label { display: inline-block; margin: 0; }`,
    `button, input, select { font: inherit; }`,
    `.${css.srOnly} { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }`,
    `.${css.app} { display: grid; grid-template-columns: 232px minmax(0, 1fr); align-items: start; }`,
    `.${css.sidebar} { position: sticky; top: 0; height: 100vh; overflow: auto; box-sizing: border-box; padding: 16px 12px; background: #10192b; color: #c7d2e0; }`,
    `.${css.brand} { display: flex; align-items: center; gap: 8px; padding: 4px 8px 16px; font-weight: 600; color: #fff; }`,
    `.${css.brandMark} { display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 7px; background: #3b6ef5; color: #fff; font-size: 12px; }`,
    `.${css.navLabel} { margin: 14px 8px 6px; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: #7b8aa3; }`,
    `.${css.navList} { list-style: none; margin: 0; padding: 0; }`,
    `.${css.navItem} { display: flex; align-items: center; gap: 10px; padding: 7px 8px; border-radius: 6px; color: inherit; text-decoration: none; }`,
    `.${css.navCurrent} { background: #1e2b45; color: #fff; }`,
    `.${css.navIcon} { flex: none; width: 15px; height: 15px; opacity: .8; }`,
    `.${css.navCount} { margin-left: auto; padding: 1px 7px; border-radius: 9px; background: #2a3a5c; font-size: 11px; }`,
    `.${css.sidebarFoot} { margin-top: 20px; padding: 12px 8px; border-top: 1px solid #23314e; font-size: 12px; color: #8fa0ba; }`,
    `.${css.main} { min-width: 0; }`,
    `.${css.topbar} { position: sticky; top: 0; z-index: 30; display: flex; align-items: center; gap: 12px; height: 56px; padding: 0 20px; background: #fff; border-bottom: 1px solid #e3e8ef; }`,
    `.${css.searchForm} { flex: 1; max-width: 420px; }`,
    `.${css.searchInput} { width: 100%; padding: 6px 10px; border: 1px solid #d7dee8; border-radius: 6px; background: #f7f9fc; }`,
    `.${css.topActions} { display: flex; align-items: center; gap: 6px; margin-left: auto; }`,
    `.${css.iconButton} { display: inline-grid; place-items: center; width: 32px; height: 32px; border: 1px solid transparent; border-radius: 6px; background: none; color: #52627a; cursor: pointer; }`,
    `.${css.avatar} { display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; background: #dbe4f5; color: #2b4a8b; font-size: 11px; font-weight: 600; }`,
    `.${css.userButton} { display: flex; align-items: center; gap: 8px; padding: 4px 8px; border: 1px solid #e3e8ef; border-radius: 999px; background: #fff; cursor: pointer; }`,
    `.${css.content} { padding: 20px 20px 140px; }`,
    `.${css.pageHead} { display: flex; align-items: flex-end; gap: 16px; margin-bottom: 16px; }`,
    `.${css.pageTitle} { margin: 0 0 2px; font-size: 20px; }`,
    `.${css.statLine} { margin: 0; color: #5b6b83; }`,
    `.${css.pageActions} { display: flex; gap: 8px; margin-left: auto; }`,
    `.${css.button} { padding: 6px 12px; border: 1px solid #d7dee8; border-radius: 6px; background: #fff; color: #1f2933; cursor: pointer; }`,
    `.${css.buttonPrimary} { border-color: #2f5fe0; background: #3b6ef5; color: #fff; }`,
    `.${css.buttonDanger} { border-color: #e5b4b4; color: #b32d2d; }`,
    `.${css.card} { background: #fff; border: 1px solid #e3e8ef; border-radius: 10px; }`,
    `.${css.toolbar} { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-bottom: 1px solid #eef1f6; }`,
    `.${css.field} { display: flex; align-items: center; gap: 6px; }`,
    `.${css.fieldLabel} { color: #5b6b83; }`,
    `.${css.input} { width: 240px; padding: 6px 10px; border: 1px solid #d7dee8; border-radius: 6px; }`,
    `.${css.select} { padding: 6px 8px; border: 1px solid #d7dee8; border-radius: 6px; background: #fff; }`,
    `.${css.chipRow} { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-bottom: 1px solid #eef1f6; background: #f8fafd; }`,
    `.${css.chip} { padding: 2px 9px; border-radius: 999px; background: #e7edf9; color: #2b4a8b; font-size: 12px; }`,
    `.${css.bulkBar} { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-bottom: 1px solid #eef1f6; background: #eef4ff; }`,
    `.${css.bulkCount} { font-weight: 600; }`,
    // Deliberately not a scroll container. `overflow-x: auto` here would make
    // this element the table header's nearest scrolling ancestor, and a header
    // that sticks to a box which never scrolls does not stick at all -- the
    // commonest way a real console loses its sticky header without anyone
    // noticing. The page is what scrolls, so the header sticks under the top bar.
    `.${css.tableWrap} { min-width: 0; }`,
    `.${css.table} { width: 100%; border-collapse: collapse; }`,
    `.${css.headCell} { position: sticky; top: 56px; z-index: 20; padding: 9px 14px; background: #fbfcfe; border-bottom: 1px solid #e3e8ef; color: #5b6b83; font-size: 12px; font-weight: 600; text-align: left; white-space: nowrap; }`,
    `.${css.sortButton} { border: 0; padding: 0; background: none; color: inherit; font: inherit; cursor: pointer; }`,
    `.${css.checkCell} { width: 34px; padding-left: 14px; }`,
    `.${css.row} { border-bottom: 1px solid #f0f3f8; }`,
    `.${css.rowSelected} { background: #f4f8ff; }`,
    `.${css.cell} { padding: 8px 14px; vertical-align: middle; white-space: nowrap; }`,
    `.${css.actionCell} { padding-right: 14px; text-align: right; }`,
    `.${css.person} { display: flex; align-items: center; gap: 9px; }`,
    `.${css.personName} { display: block; font-weight: 500; }`,
    `.${css.personEmail} { display: block; color: #6b7a92; font-size: 12px; }`,
    `.${css.badge} { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 12px; }`,
    `.${css.badgeActive} { background: #e4f6ec; color: #1c6b3f; }`,
    `.${css.badgeInvited} { background: #fdf1dc; color: #8a5b12; }`,
    `.${css.badgeSuspended} { background: #fbe6e6; color: #a32d2d; }`,
    `.${css.tableFoot} { display: flex; gap: 16px; padding: 10px 14px; color: #5b6b83; }`,
    `.${css.footNote} { margin: 0; }`,
    `.${css.empty} { padding: 28px 14px; color: #6b7a92; text-align: center; }`,
    `.${css.appFoot} { padding: 18px 4px; color: #8a97ab; font-size: 12px; }`,
    `.${css.launcher} { position: fixed; right: 22px; bottom: 22px; z-index: 60; display: grid; place-items: center; width: 54px; height: 54px; border: 0; border-radius: 50%; background: #10192b; color: #fff; cursor: pointer; box-shadow: 0 6px 18px rgba(16, 25, 43, .28); }`,
    `.${css.drawer} { position: fixed; top: 0; right: 0; bottom: 0; z-index: 70; width: 380px; background: #fff; border-left: 1px solid #e3e8ef; box-shadow: -12px 0 28px rgba(16, 25, 43, .12); }`,
    `.${css.drawerHead} { display: flex; align-items: center; gap: 8px; padding: 14px 16px; border-bottom: 1px solid #eef1f6; font-weight: 600; }`,
    `.${css.drawerBody} { padding: 16px; color: #5b6b83; }`,
    `.${css.menu} { position: absolute; z-index: 75; min-width: 208px; padding: 5px; background: #fff; border: 1px solid #e3e8ef; border-radius: 8px; box-shadow: 0 10px 24px rgba(16, 25, 43, .16); }`,
    `.${css.menuHead} { margin: 0; padding: 6px 9px; color: #6b7a92; font-size: 12px; }`,
    `.${css.menuItem} { display: block; width: 100%; padding: 7px 9px; border: 0; border-radius: 5px; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }`,
    `.${css.menuDanger} { color: #b32d2d; }`,
    `.${css.scrim} { position: fixed; inset: 0; z-index: 80; display: grid; place-items: center; background: rgba(16, 25, 43, .45); }`,
    `.${css.dialog} { width: 420px; max-width: 92vw; background: #fff; border-radius: 10px; box-shadow: 0 24px 48px rgba(16, 25, 43, .3); }`,
    `.${css.dialogHead} { padding: 16px 18px 4px; }`,
    `.${css.dialogBody} { padding: 6px 18px 14px; }`,
    `.${css.dialogFoot} { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 18px; border-top: 1px solid #eef1f6; }`,
    `.${css.toastRegion} { position: fixed; right: 22px; bottom: 90px; z-index: 65; width: 318px; }`,
    `.${css.toast} { display: flex; align-items: center; gap: 10px; padding: 11px 13px; border-radius: 8px; background: #10192b; color: #fff; box-shadow: 0 8px 20px rgba(16, 25, 43, .26); }`,
    `.${css.toastText} { flex: 1; margin: 0; }`,
  ].join("\n");
}
