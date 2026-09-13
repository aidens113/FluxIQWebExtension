/**
 * The store's class names and the stylesheet that uses them.
 *
 * Every name is the kind a build tool emits -- emotion hashes for the store's
 * own components, a CMP vendor's `_cmp-` names for the consent banner, and
 * styled-components names for the bundled chat widget. Authored semantic
 * classes (`.checkout-form`, `.cart-item`) are what a fixture writer reaches
 * for and what a real front end almost never ships, and an element identity
 * that quietly leans on a readable class name would look far more reliable
 * here than it is in the field.
 */
export const styleClass = {
  announcement: "css-hb27qk",
  shell: "css-1qy8v7n",
  header: "css-8kf2ta",
  brand: "css-b41x9e",
  headerNav: "css-0jt7wq",
  progress: "css-4m2ndx",
  columns: "css-19zqp4c",
  form: "css-7ta1ok",
  step: "css-1d9fhpz",
  stepHead: "css-mz3f8b",
  stepBody: "css-txn40s",
  stepDone: "css-9wqlt2",
  field: "css-5bx0hv",
  hint: "css-e8p1vr",
  actions: "css-2ktb6f",
  primaryButton: "css-1hs8mgy",
  quietButton: "css-06fdn3",
  lineItem: "css-r7v2jd",
  thumb: "css-y1k93s",
  summary: "css-t4b0gz",
  summaryRow: "css-nk18eu",
  summaryTotal: "css-3fj7dq",
  suggestions: "css-vp2rme",
  notice: "css-qh5wt1",
  alert: "css-8dz2fk",
  confirmation: "css-0px41w",
  footer: "css-56ntbi",
  consentBackdrop: "_cmp-scrim",
  consentBanner: "_cmp-b3d0",
  consentActions: "_cmp-actions",
  backToTop: "css-9lm3ec",
  wallets: "css-4gd7xb",
  brands: "css-p28sfe",
  chatRoot: "sc-kAyceB",
  chatLauncher: "sc-gEvEer",
  chatBadge: "sc-hLseeU",
  chatPanel: "sc-dkzDqf",
  chatLog: "sc-bcXHqe",
  frameField: "css-1p3mfx4",
  frameRow: "css-jd91zk",
  frameError: "css-vv02sy",
} as const;

/** The store's stylesheet, in one block, as a bundler would inline it. */
export const storefrontStyles = `<style>
  [hidden] { display: none !important; }
  body { max-width: none; margin: 0; padding: 0; background: #f6f6f4; color: #14181c; }
  .${styleClass.shell} { max-width: 68rem; margin: 0 auto; padding: 0 1.25rem 6rem; }
  .${styleClass.header} { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; padding: 1.25rem 0; border-bottom: 1px solid #dcdcd6; }
  .${styleClass.brand} { font-size: 1.15rem; font-weight: 700; letter-spacing: .02em; }
  .${styleClass.headerNav} { display: flex; gap: 1rem; font-size: .85rem; color: #4b5560; }
  .${styleClass.progress} { padding: .9rem 0; font-size: .85rem; color: #4b5560; }
  .${styleClass.columns} { display: flex; gap: 2rem; align-items: flex-start; }
  .${styleClass.form} { flex: 1 1 60%; min-width: 0; }
  .${styleClass.step} { background: #fff; border: 1px solid #dcdcd6; border-radius: .4rem; margin-bottom: .85rem; }
  .${styleClass.stepHead} { display: flex; align-items: center; justify-content: space-between; gap: .75rem; padding: .85rem 1rem; font-weight: 600; }
  .${styleClass.stepBody} { padding: 0 1rem 1.1rem; }
  .${styleClass.stepDone} { font-size: .8rem; font-weight: 400; color: #3d7a4d; }
  .${styleClass.field} { display: block; margin: .7rem 0; font-size: .9rem; }
  .${styleClass.field} input, .${styleClass.field} select { display: block; width: 100%; box-sizing: border-box; margin-top: .25rem; padding: .5rem; border: 1px solid #b9b9b1; border-radius: .25rem; }
  .${styleClass.hint} { font-size: .8rem; color: #6a7480; margin: .2rem 0 0; }
  .${styleClass.actions} { display: flex; gap: .75rem; align-items: center; margin-top: 1rem; }
  .${styleClass.primaryButton} { background: #14532d; color: #fff; border: 0; border-radius: .25rem; padding: .6rem 1.1rem; cursor: pointer; }
  .${styleClass.primaryButton}[disabled] { background: #9aa39a; cursor: not-allowed; }
  .${styleClass.quietButton} { background: transparent; border: 1px solid #b9b9b1; border-radius: .25rem; padding: .5rem .9rem; cursor: pointer; }
  .${styleClass.lineItem} { display: flex; gap: .9rem; align-items: flex-start; padding: .7rem 0; border-bottom: 1px solid #eceae4; }
  .${styleClass.thumb} { width: 3.25rem; height: 3.25rem; border-radius: .3rem; background: #dfe4dc; flex: none; }
  .${styleClass.summary} { flex: 0 0 20rem; background: #fff; border: 1px solid #dcdcd6; border-radius: .4rem; padding: 1rem; position: sticky; top: 1rem; }
  .${styleClass.summaryRow} { display: flex; justify-content: space-between; font-size: .9rem; margin: .35rem 0; }
  .${styleClass.summaryTotal} { display: flex; justify-content: space-between; font-weight: 700; border-top: 1px solid #dcdcd6; margin-top: .6rem; padding-top: .6rem; }
  .${styleClass.suggestions} { list-style: none; margin: .6rem 0 0; padding: 0; border: 1px solid #dcdcd6; border-radius: .25rem; }
  .${styleClass.suggestions} li { display: block; margin: 0; border-bottom: 1px solid #eceae4; }
  .${styleClass.suggestions} button { display: block; width: 100%; text-align: left; background: #fff; border: 0; padding: .55rem .7rem; cursor: pointer; font: inherit; }
  .${styleClass.notice} { font-size: .85rem; color: #6a7480; margin: .5rem 0 0; }
  .${styleClass.alert} { background: #fdecec; border: 1px solid #e4a3a3; color: #7d1d1d; border-radius: .25rem; padding: .7rem .9rem; margin: .8rem 0 0; font-size: .9rem; }
  .${styleClass.confirmation} { background: #fff; border: 1px solid #dcdcd6; border-radius: .4rem; padding: 1.5rem; }
  .${styleClass.footer} { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #dcdcd6; font-size: .8rem; color: #6a7480; display: flex; gap: 1rem; }
  .${styleClass.announcement} { background: #14532d; color: #fff; text-align: center; font-size: .8rem; padding: .45rem 1rem; }
  .${styleClass.wallets} { display: flex; gap: .6rem; align-items: center; margin: .8rem 0; }
  .${styleClass.brands} { list-style: none; display: flex; gap: .5rem; margin: .5rem 0 0; padding: 0; font-size: .75rem; color: #6a7480; }
  .${styleClass.brands} li { display: block; border: 1px solid #dcdcd6; border-radius: .2rem; padding: .1rem .35rem; }
  /* Anchored to the same corner as the chat widget and stacked below it, which
     is where a great many real sites leave their back-to-top control. */
  .${styleClass.backToTop} { position: fixed; right: 1.25rem; bottom: 1.25rem; z-index: 2147481000; background: #fff; border: 1px solid #b9b9b1; border-radius: 2rem; padding: .7rem 1.1rem; cursor: pointer; }
  .${styleClass.consentBackdrop} { position: fixed; inset: 0; background: rgba(12, 16, 20, .45); z-index: 2147483000; }
  .${styleClass.consentBanner} { position: fixed; left: 50%; bottom: 1.5rem; transform: translateX(-50%); width: min(46rem, calc(100vw - 2rem)); background: #fff; border-radius: .5rem; box-shadow: 0 1rem 2.5rem rgba(0,0,0,.28); padding: 1.1rem 1.25rem; z-index: 2147483001; font-size: .9rem; }
  .${styleClass.consentActions} { display: flex; gap: .6rem; flex-wrap: wrap; margin-top: .8rem; }
  .${styleClass.chatRoot} { position: fixed; right: 1.25rem; bottom: 1.25rem; z-index: 2147482000; text-align: right; }
  .${styleClass.chatLauncher} { position: relative; background: #14532d; color: #fff; border: 0; border-radius: 2rem; padding: .7rem 1.1rem; cursor: pointer; box-shadow: 0 .4rem 1rem rgba(0,0,0,.22); }
  .${styleClass.chatBadge} { position: absolute; top: -.35rem; right: -.35rem; background: #c0392b; color: #fff; border-radius: 50%; width: 1.25rem; height: 1.25rem; font-size: .7rem; line-height: 1.25rem; }
  .${styleClass.chatPanel} { width: 18rem; background: #fff; border: 1px solid #dcdcd6; border-radius: .4rem; box-shadow: 0 .6rem 1.6rem rgba(0,0,0,.2); padding: .8rem; margin-bottom: .6rem; text-align: left; font-size: .85rem; }
  .${styleClass.chatLog} { list-style: none; margin: .5rem 0; padding: 0; }
  .${styleClass.chatLog} li { display: block; margin: .35rem 0; }
  .${styleClass.frameField} { display: block; margin: .65rem 0; font-size: .85rem; }
  .${styleClass.frameField} input { display: block; width: 100%; box-sizing: border-box; margin-top: .2rem; padding: .45rem; border: 1px solid #b9b9b1; border-radius: .25rem; }
  .${styleClass.frameRow} { display: flex; gap: .7rem; }
  .${styleClass.frameRow} > * { flex: 1; }
  .${styleClass.frameError} { background: #fdecec; border: 1px solid #e4a3a3; color: #7d1d1d; border-radius: .25rem; padding: .55rem .7rem; font-size: .85rem; margin: .6rem 0 0; }
</style>`;
