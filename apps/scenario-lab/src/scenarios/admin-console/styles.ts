/**
 * Height of one list row, in pixels. The virtualiser positions rows by
 * multiplying it, so the CSS and the script must agree exactly; both read it
 * from here.
 */
export const LIST_ROW_HEIGHT_PX = 44;
/** Height of the list's scroll viewport. Fixed, so the render window is the same on every viewport size. */
export const LIST_VIEWPORT_HEIGHT_PX = 480;
/** Rows kept mounted on each side of the visible band, the way a production virtualiser overscans. */
export const LIST_OVERSCAN_ROWS = 4;

/**
 * Class names as a bundler emits them. They are hashes, not descriptions:
 * nothing in a recording can lean on `.record-row` meaning a record row,
 * because no such class exists on the page. They are fixed strings rather than
 * generated ones, so a recorded selector stays reproducible across runs -- a
 * class that changed per build would be testing the wrong thing.
 */
export const CX = {
  shell: "css-1qk4d0",
  topbar: "css-9fj2ae",
  brand: "css-4mt71b",
  sidebar: "css-0b7m1x",
  navLink: "css-8ra2vd",
  navLinkOn: "css-8ra2vd-hs",
  main: "css-2we6lq",
  board: "css-1yh4sp",
  split: "css-8gk3na",
  listPane: "css-4dt8zz",
  listHeader: "css-6xk0pn",
  search: "css-1td93o",
  viewport: "css-5jb7wu",
  canvas: "css-3qz8ma",
  row: "css-2h6rql",
  rowOn: "css-2h6rql-sel",
  rowMain: "css-7dv4ic",
  rowCompany: "css-0lp2xe",
  rowMeta: "css-9sc3bt",
  chip: "css-1nz5kf",
  rowMenu: "css-6yb8qa",
  detail: "css-7pn3ov",
  detailHead: "css-3fj9wl",
  fields: "css-5xw1ub",
  fieldRow: "css-8kd0rv",
  fieldButton: "css-2pq7ye",
  fieldInput: "css-0hw6cz",
  fieldStatic: "css-4nb1sj",
  bar: "css-9tl3md",
  primary: "css-1cv8ke",
  ghost: "css-7za0if",
  badge: "css-3md5tp",
  empty: "css-6fq2xn",
  tabs: "css-0ej4kt",
  tab: "css-8mw1rz",
  tabOn: "css-8mw1rz-cur",
  panel: "css-2xr9db",
  pref: "css-5hd8vq",
} as const;

/** The console's stylesheet. It overrides the lab's shared page style, which centres a narrow column. */
export const ADMIN_CONSOLE_STYLE = `
  body { max-width: none; margin: 0; padding: 0; background: #f6f7f9; color: #1f2328; }
  /* The grid and flex displays below outrank the UA rule for [hidden], so a
     hidden screen would keep its box without this. */
  [hidden] { display: none !important; }
  nav, li { display: block; }
  label { margin: 0; }
  button { cursor: pointer; }
  /* A console frame fills the window and never scrolls itself; every pane inside it scrolls on its own. */
  .${CX.shell} { display: grid; grid-template-rows: 56px 1fr; height: 100vh; overflow: hidden; }
  .${CX.topbar} { display: flex; align-items: center; gap: 1rem; padding: 0 1rem; background: #10233f; color: #fff; }
  .${CX.brand} { font-weight: 600; letter-spacing: .01em; }
  .${CX.main} { display: grid; grid-template-columns: 216px 1fr; height: 100%; min-height: 0; }
  .${CX.board} { min-width: 0; height: 100%; min-height: 0; }
  .${CX.split} { display: grid; grid-template-columns: minmax(340px, 400px) 1fr; height: 100%; min-height: 0; }
  .${CX.sidebar} { padding: 1rem .75rem; border-right: 1px solid #dfe3e8; background: #fff; overflow-y: auto; }
  .${CX.navLink} { display: block; width: 100%; text-align: left; padding: .5rem .6rem; margin-bottom: .25rem; border: 0; border-radius: 6px; background: transparent; color: #37414d; }
  .${CX.navLinkOn} { background: #e8effb; color: #10233f; font-weight: 600; }
  .${CX.listPane} { border-right: 1px solid #dfe3e8; background: #fff; display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
  .${CX.listHeader} { padding: .75rem .9rem; border-bottom: 1px solid #eceff2; }
  .${CX.listHeader} h2 { font-size: .95rem; margin: 0 0 .4rem; }
  .${CX.listHeader} label { font-size: .8rem; color: #5b6570; }
  .${CX.listHeader} p { margin: .4rem 0 0; font-size: .85rem; color: #5b6570; }
  .${CX.search} { width: 100%; box-sizing: border-box; padding: .4rem .55rem; border: 1px solid #ccd2d9; border-radius: 6px; }
  .${CX.viewport} { height: ${LIST_VIEWPORT_HEIGHT_PX}px; overflow-y: auto; overflow-x: hidden; box-sizing: content-box; padding: 0; border: 0; }
  .${CX.canvas} { position: relative; }
  .${CX.row} { position: absolute; left: 0; right: 0; height: ${LIST_ROW_HEIGHT_PX}px; box-sizing: border-box; display: flex; align-items: center; gap: .5rem; padding: 0 .6rem; border-bottom: 1px solid #f0f2f4; background: #fff; }
  .${CX.rowOn} { background: #eef4ff; }
  .${CX.rowMain} { flex: 1; min-width: 0; }
  .${CX.rowCompany} { display: block; font-size: .92rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .${CX.rowMeta} { display: block; font-size: .78rem; color: #5b6570; }
  .${CX.chip} { font-size: .72rem; padding: .05rem .4rem; border-radius: 999px; background: #eef1f4; color: #37414d; }
  .${CX.rowMenu} { border: 0; background: transparent; color: #6b7580; padding: .1rem .35rem; border-radius: 4px; }
  .${CX.detail} { padding: 1rem 1.25rem; box-sizing: border-box; overflow-y: auto; min-height: 0; }
  .${CX.detailHead} h2 { margin: 0; font-size: 1.15rem; }
  .${CX.detailHead} p { margin: .15rem 0 0; color: #5b6570; font-size: .85rem; }
  .${CX.fields} { margin: 1rem 0 0; display: grid; gap: .1rem; max-width: 30rem; }
  .${CX.fieldRow} { display: grid; grid-template-columns: 12rem 1fr; align-items: center; gap: .5rem; padding: .3rem 0; border-bottom: 1px solid #eceff2; }
  .${CX.fieldRow} dt { color: #5b6570; font-size: .85rem; }
  .${CX.fieldRow} dd { margin: 0; }
  .${CX.fieldButton} { border: 1px solid transparent; background: transparent; padding: .2rem .35rem; border-radius: 5px; font: inherit; text-align: left; }
  .${CX.fieldButton}:hover { border-color: #ccd2d9; background: #fbfcfd; }
  .${CX.fieldInput} { font: inherit; padding: .2rem .35rem; border: 1px solid #3f6fd8; border-radius: 5px; width: 12rem; }
  .${CX.fieldStatic} { padding: .2rem .35rem; display: inline-block; }
  .${CX.bar} { display: flex; align-items: center; gap: .6rem; margin-top: 1rem; }
  .${CX.primary} { border: 0; border-radius: 6px; padding: .4rem .8rem; background: #2f5fd0; color: #fff; }
  .${CX.primary}:disabled { background: #b9c4d9; cursor: default; }
  .${CX.ghost} { border: 1px solid #ccd2d9; border-radius: 6px; padding: .3rem .6rem; background: #fff; }
  .${CX.badge} { font-size: .75rem; padding: .1rem .45rem; border-radius: 999px; background: #fff4d6; color: #7a5a00; }
  .${CX.empty} { color: #5b6570; padding: 2rem 0; }
  .${CX.tabs} { display: flex; gap: .25rem; border-bottom: 1px solid #dfe3e8; margin-top: .75rem; }
  .${CX.tab} { border: 0; background: transparent; padding: .45rem .7rem; color: #37414d; border-bottom: 2px solid transparent; }
  .${CX.tabOn} { color: #10233f; font-weight: 600; border-bottom-color: #2f5fd0; }
  .${CX.panel} { padding: 1rem 0; max-width: 34rem; }
  .${CX.pref} { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: .55rem 0; border-bottom: 1px solid #eceff2; }`;
