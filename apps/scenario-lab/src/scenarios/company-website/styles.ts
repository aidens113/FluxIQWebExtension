import { buildClassNames } from "../../build-classes.js";
import { fnv1a } from "./data/index.js";

/**
 * The site's class names, as the page builder's CSS-in-JS emits them: every
 * one a hash of the build and the lab seed, so a class says which component
 * drew an element and nothing about which element it is, and another seed is
 * another deploy with every class renamed. Nothing on the site carries an
 * authored class name.
 */
const CLASS_ROLES = [
  "page", "topBar", "header", "brand", "brandMark", "nav", "navLink", "navCurrent", "headerCta", "phoneLink", "main",
  "footer", "footerCols", "footerCol", "footerLink", "legal",
  "button", "buttonPrimary", "buttonGhost", "linkButton", "section", "sectionTitle", "lead", "muted", "tag", "sponsoredTag",
  "skeleton", "skeletonLine", "spinner", "toast", "offscreen",
  "hero", "heroTitle", "heroActions", "teaserGrid", "teaser", "stats", "review",
  "leadership", "personCard", "avatar", "personName", "personRole", "credList", "credRow", "bio", "bioToggle",
  "chips", "chip", "chipActive", "chipCount", "grid", "sentinel", "loadMore", "loadStatus",
  "vatSwitch", "vatOption", "vatActive", "accordion", "accordionHead", "accordionBody", "priceTable", "partnerRow", "priceCell",
  "drawer", "drawerHead", "drawerBody", "drawerFoot", "drawerScrim", "stepper", "stepDot", "stepActive",
  "field", "fieldLabel", "input", "textarea", "fieldError", "radioRow", "checkRow", "fauxSelect", "fauxSelectList", "fauxOption",
  "verifyBox", "verifyCheck", "stepHeaderAction",
  "branchCard", "hoursTable", "widgetFrame", "notice", "summary", "summaryRow",
  "modalScrim", "modal", "modalClose", "noticeModal",
] as const;

export type SiteClassRole = (typeof CLASS_ROLES)[number];
export type SiteClasses = Record<SiteClassRole, string>;

/** The page builder's release, which the footer prints. */
export const SITE_BUILD = "pb-2026.37.4";

/** Every class name for a lab seed. */
export function siteClasses(seed: number): SiteClasses {
  return buildClassNames(`kestrel:${SITE_BUILD}:${seed}`, CLASS_ROLES);
}

/**
 * An element id the way a component library generates one, `:r4k2p:`, new
 * for every seed. Labels and `aria-` references use it, so the page stays
 * accessible while no id survives a redeploy.
 */
export function generatedId(seed: number, name: string): string {
  return `:r${(fnv1a(`${seed}:${name}`) % 46_656).toString(36)}:`;
}

/** The stylesheet for one set of class names. */
export function siteStylesheet(c: SiteClasses): string {
  return `<style>
*{box-sizing:border-box}
[hidden]{display:none!important}
html,body{margin:0;padding:0;max-width:none}
body{font:16px/1.5 "Segoe UI",system-ui,sans-serif;color:#1f2a2e;background:#fbfaf7}
a{color:#0b5c6b}
.${c.topBar}{background:#8a1c1c;color:#fff;font-size:.85rem;padding:.35rem 1rem;text-align:center}
.${c.header}{display:flex;align-items:center;gap:1.5rem;padding:.75rem 2rem;background:#fff;border-bottom:1px solid #e3e0d8;position:sticky;top:0;z-index:20}
.${c.brand}{display:flex;align-items:center;gap:.5rem;font-weight:700;font-size:1.15rem;color:#0b3b45;text-decoration:none}
.${c.brandMark}{width:2rem;height:2rem;border-radius:50%;background:#0b5c6b;color:#fff;display:grid;place-items:center;font-size:.8rem}
.${c.nav}{display:flex;gap:1.1rem;flex:1}
.${c.navLink}{color:#1f2a2e;text-decoration:none;font-size:.95rem;padding:.3rem 0}
.${c.navCurrent}{border-bottom:2px solid #0b5c6b;font-weight:600}
.${c.phoneLink}{font-weight:600;color:#0b3b45;text-decoration:none;white-space:nowrap}
.${c.headerCta},.${c.buttonPrimary}{background:#e0762b;color:#fff;border:0;border-radius:.4rem;padding:.6rem 1.1rem;font:inherit;font-weight:600;cursor:pointer}
.${c.button},.${c.buttonGhost}{background:#fff;color:#0b3b45;border:1px solid #9fb6bb;border-radius:.4rem;padding:.55rem 1rem;font:inherit;cursor:pointer}
.${c.buttonGhost}{border-color:transparent;text-decoration:underline}
.${c.linkButton}{color:#0b5c6b;text-decoration:underline;cursor:pointer;display:inline-block}
.${c.main}{max-width:72rem;margin:0 auto;padding:1.5rem 2rem 6rem}
.${c.section}{margin:2.5rem 0}
.${c.sectionTitle}{font-size:1.5rem;margin:0 0 1rem;color:#0b3b45}
.${c.lead}{font-size:1.1rem;color:#44545a;max-width:46rem}
.${c.muted}{color:#66767c;font-size:.9rem}
.${c.tag}{display:inline-block;background:#e8f1f2;color:#0b3b45;border-radius:1rem;padding:0 .6rem;font-size:.75rem}
.${c.sponsoredTag}{display:inline-block;background:#f3ecd9;color:#7a5b10;border-radius:.2rem;padding:0 .35rem;font-size:.65rem;text-transform:uppercase;letter-spacing:.04em;margin-left:.4rem}
.${c.skeleton}{background:#fff;border:1px solid #ece9e1;border-radius:.6rem;padding:1rem;min-height:12rem}
.${c.skeletonLine}{height:.8rem;border-radius:.4rem;background:linear-gradient(90deg,#eee 25%,#f7f7f7 50%,#eee 75%);background-size:200% 100%;animation:kl-shimmer 1.2s infinite;margin:.6rem 0}
@keyframes kl-shimmer{to{background-position:-200% 0}}
.${c.spinner}{display:inline-block;width:1rem;height:1rem;border:2px solid #9fb6bb;border-top-color:#0b5c6b;border-radius:50%;animation:kl-spin .8s linear infinite;vertical-align:middle}
@keyframes kl-spin{to{transform:rotate(360deg)}}
.${c.toast}{position:fixed;left:50%;bottom:1.5rem;transform:translateX(-50%);background:#0b3b45;color:#fff;padding:.7rem 1.2rem;border-radius:.4rem;z-index:60}
.${c.offscreen}{position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden}
.${c.hero}{background:linear-gradient(120deg,#0b3b45,#0b5c6b);color:#fff;border-radius:1rem;padding:3rem 2.5rem;margin-top:1rem}
.${c.heroTitle}{font-size:2.4rem;margin:0 0 .5rem}
.${c.heroActions}{display:flex;gap:1rem;margin-top:1.5rem;align-items:center}
.${c.heroActions} a{color:#fff}
.${c.teaserGrid},.${c.grid}{display:grid;grid-template-columns:repeat(auto-fill,minmax(15rem,1fr));gap:1rem}
.${c.teaser},.${c.personCard},.${c.branchCard}{background:#fff;border:1px solid #ece9e1;border-radius:.6rem;padding:1rem}
.${c.stats}{display:flex;gap:2rem;flex-wrap:wrap}
.${c.review}{border-left:3px solid #e0762b;padding-left:1rem;margin:1rem 0}
.${c.leadership}{display:grid;grid-template-columns:repeat(4,1fr);gap:1rem}
.${c.avatar}{width:4rem;height:4rem;border-radius:50%;background:#d9e5e7;display:grid;place-items:center;font-weight:700;color:#0b3b45}
.${c.personName}{margin:.6rem 0 0;font-size:1.05rem}
.${c.personRole}{margin:.1rem 0 .5rem;color:#44545a}
.${c.credList}{margin:0;font-size:.85rem}
.${c.credRow}{display:flex;gap:.4rem}
.${c.credRow} dt{color:#66767c}
.${c.credRow} dd{margin:0;font-weight:600}
.${c.bio}{font-size:.85rem;color:#44545a}
.${c.bioToggle}{font-size:.85rem;color:#0b5c6b;cursor:pointer;margin-top:.4rem}
.${c.chips}{display:flex;gap:.5rem;flex-wrap:wrap;margin:1rem 0}
.${c.chip}{border:1px solid #9fb6bb;border-radius:2rem;padding:.3rem .8rem;cursor:pointer;background:#fff;user-select:none}
.${c.chipActive}{background:#0b3b45;color:#fff;border-color:#0b3b45}
.${c.chipCount}{opacity:.7;margin-left:.3rem}
.${c.sentinel}{height:1px}
.${c.loadMore}{display:block;margin:1.5rem auto}
.${c.loadStatus}{text-align:center;color:#66767c;min-height:1.5rem}
.${c.vatSwitch}{display:inline-flex;border:1px solid #9fb6bb;border-radius:.4rem;overflow:hidden;margin:1rem 0}
.${c.vatOption}{padding:.5rem 1rem;cursor:pointer;background:#fff;user-select:none}
.${c.vatActive}{background:#0b3b45;color:#fff}
.${c.accordion}{border:1px solid #ece9e1;border-radius:.6rem;background:#fff;margin:.75rem 0}
.${c.accordionHead}{display:flex;justify-content:space-between;width:100%;border:0;background:none;font:inherit;font-weight:600;padding:1rem;cursor:pointer;text-align:left}
.${c.accordionBody}{padding:0 1rem 1rem}
.${c.priceTable}{width:100%;border-collapse:collapse}
.${c.priceTable} th,.${c.priceTable} td{text-align:left;padding:.55rem .4rem;border-top:1px solid #f0ede6;vertical-align:top}
.${c.priceTable} th{font-weight:600}
.${c.partnerRow}{background:#fffaf0}
.${c.priceCell}{white-space:nowrap;text-align:right!important;font-weight:600}
.${c.drawerScrim}{position:fixed;inset:0;background:rgba(10,30,35,.45);z-index:40}
.${c.drawer}{position:fixed;top:0;right:0;bottom:0;width:min(28rem,100vw);background:#fff;z-index:41;display:flex;flex-direction:column;box-shadow:-4px 0 24px rgba(0,0,0,.2)}
.${c.drawerHead}{padding:1rem 1.25rem;border-bottom:1px solid #ece9e1;display:flex;justify-content:space-between;align-items:center}
.${c.drawerBody}{padding:1rem 1.25rem;overflow:auto;flex:1;position:relative}
.${c.drawerFoot}{padding:1rem 1.25rem;border-top:1px solid #ece9e1;display:flex;justify-content:space-between;gap:.75rem;background:#fff}
.${c.drawerFoot} button{min-width:10rem}
.${c.stepper}{display:flex;gap:.4rem;margin-bottom:1rem}
.${c.stepDot}{flex:1;height:.3rem;border-radius:.2rem;background:#e3e0d8}
.${c.stepActive}{background:#e0762b}
.${c.field}{display:block;margin:.8rem 0}
.${c.fieldLabel}{display:block;font-weight:600;font-size:.9rem;margin-bottom:.25rem}
.${c.input},.${c.textarea}{width:100%;border:1px solid #b9c7ca;border-radius:.35rem;padding:.5rem .6rem;font:inherit}
.${c.textarea}{min-height:6rem}
.${c.fieldError}{color:#a31818;font-size:.8rem;min-height:1rem}
.${c.radioRow},.${c.checkRow}{display:flex;gap:.5rem;align-items:flex-start;margin:.4rem 0}
.${c.fauxSelect}{border:1px solid #b9c7ca;border-radius:.35rem;padding:.5rem .6rem;cursor:pointer;background:#fff;position:relative}
.${c.fauxSelectList}{border:1px solid #b9c7ca;border-radius:.35rem;margin-top:.2rem;background:#fff;max-height:14rem;overflow:auto}
.${c.fauxOption}{padding:.45rem .6rem;cursor:pointer}
.${c.fauxOption}:hover{background:#e8f1f2}
.${c.verifyBox}{position:absolute;inset:0;background:rgba(255,255,255,.96);display:grid;place-items:center;text-align:center;padding:2rem}
.${c.verifyCheck}{display:inline-flex;gap:.6rem;align-items:center;border:1px solid #b9c7ca;border-radius:.3rem;padding:.8rem 1rem;cursor:pointer;background:#f9f9f9}
.${c.stepHeaderAction}{float:right}
.${c.hoursTable} td{padding:.15rem .75rem .15rem 0}
.${c.widgetFrame}{width:100%;height:46rem;border:1px solid #ece9e1;border-radius:.6rem;background:#fff}
.${c.notice}{background:#fff7e8;border:1px solid #f0d9a8;border-radius:.5rem;padding:.75rem 1rem}
.${c.summary}{display:grid;grid-template-columns:12rem 1fr;gap:.4rem 1rem;background:#fff;border:1px solid #ece9e1;border-radius:.6rem;padding:1rem 1.25rem}
.${c.summary} dt{color:#66767c}
.${c.summary} dd{margin:0;font-weight:600}
.${c.footer}{background:#0b3b45;color:#d5e3e5;padding:2rem}
.${c.footerCols}{display:flex;gap:3rem;flex-wrap:wrap;max-width:72rem;margin:0 auto}
.${c.footerCol}{display:flex;flex-direction:column;gap:.3rem}
.${c.footerLink}{color:#d5e3e5;text-decoration:none;cursor:pointer}
.${c.legal}{max-width:72rem;margin:1.5rem auto 0;font-size:.8rem;color:#9fb6bb}
.${c.modalScrim}{position:fixed;inset:0;background:rgba(10,30,35,.55);z-index:70;display:grid;place-items:center}
.${c.modal},.${c.noticeModal}{background:#fff;border-radius:.8rem;padding:1.75rem;width:min(30rem,92vw);position:relative;box-shadow:0 10px 40px rgba(0,0,0,.3)}
.${c.noticeModal}{border-top:6px solid #8a1c1c}
.${c.modalClose}{position:absolute;top:.6rem;right:.9rem;cursor:pointer;font-size:1.3rem;color:#66767c}
</style>`;
}
