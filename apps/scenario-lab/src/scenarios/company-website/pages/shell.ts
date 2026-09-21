import { buildClassNames } from "../../../build-classes.js";
import { escapeHtml } from "../../../html.js";
import type { RenderContext } from "../../../types.js";
import { shellScript } from "../client/index.js";
import { COMPANY } from "../data/index.js";
import { SITE_BUILD, siteClasses, siteStylesheet, type SiteClasses } from "../styles.js";
import type { CompanyWebsiteState } from "../types.js";

export type SiteSection = "home" | "services" | "team" | "branches" | "book" | null;

const ROOT = COMPANY.root;
const NAV: ReadonlyArray<readonly [Exclude<SiteSection, null>, string, string]> = [
  ["home", "Home", ROOT],
  ["services", "Services & prices", `${ROOT}services`],
  ["team", "Our team", `${ROOT}team`],
  ["branches", "Branches", `${ROOT}branches`],
  ["book", "Book a service", `${ROOT}book`],
];

/**
 * Every page of the site: the emergency strip, the sticky header, the page's
 * own main content, the footer, and whatever overlays the visitor's session
 * still owes them. `pageScript` runs after the shell's own script, in the same
 * module, so it can call `mutate`.
 */
export function sitePage(input: {
  state: CompanyWebsiteState;
  context: RenderContext;
  title: string;
  section: SiteSection;
  main: string;
  pageScript?: string;
}): string {
  const { state, context } = input;
  const c = siteClasses(context.seed);
  const chat = buildClassNames(`kes-chat:${context.seed}`, ["launcher", "greeting", "close", "panel", "panelHead", "log"] as const);
  const flags = {
    consentPending: state.consent === "pending",
    newsletterDue: !state.newsletter.dismissed,
    greetingDue: !state.chat.greetingDismissed,
  };
  const nav = NAV.map(([id, label, href]) => `<a class="${c.navLink}${id === input.section ? ` ${c.navCurrent}` : ""}" href="${href}"${id === input.section ? ' aria-current="page"' : ""}>${escapeHtml(label)}</a>`).join("");
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" href="data:,">
<title>${escapeHtml(input.title)} | ${escapeHtml(COMPANY.name)}</title>
${siteStylesheet(c)}
</head>
<body>
<div class="${c.page}">
<div class="${c.topBar}">No heating or hot water? Our 24-hour emergency line is <a style="color:#fff" href="tel:01632960999">${COMPANY.emergencyPhone}</a></div>
<header class="${c.header}">
  <a class="${c.brand}" href="${ROOT}"><span class="${c.brandMark}">KL</span>${escapeHtml(COMPANY.shortName)}</a>
  <nav class="${c.nav}" aria-label="Main">${nav}</nav>
  <a class="${c.phoneLink}" href="tel:01632960418">${COMPANY.phone}</a>
  <button type="button" class="${c.headerCta}" data-open-quote>Get a free quote</button>
</header>
<main class="${c.main}">
${input.main}
</main>
${footer(c)}
</div>
${consentBanner(state, context.seed)}${winterNotice(state, c)}
<script type="module">${shellScript(context.runToken, c, chat, flags)}
${quoteOpener()}
${input.pageScript ?? ""}</script>
</body>
</html>`;
}

/**
 * Off the home page, every "Get a free quote" control goes to the home page
 * and opens the drawer there; the home page's own script replaces this.
 */
function quoteOpener(): string {
  return `if (!document.querySelector('[data-quote-drawer]')) {
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-open-quote]')) location.href = ${JSON.stringify(`${ROOT}#quote`)};
  });
}`;
}

function footer(c: SiteClasses): string {
  const link = (href: string, label: string) => `<a class="${c.footerLink}" href="${href}">${escapeHtml(label)}</a>`;
  return `<footer class="${c.footer}">
<div class="${c.footerCols}">
  <div class="${c.footerCol}"><strong>Services</strong>${link(`${ROOT}services`, "Boiler servicing")}${link(`${ROOT}services`, "Repairs")}${link(`${ROOT}services`, "New boilers")}${link(`${ROOT}services`, "Heat pumps")}</div>
  <div class="${c.footerCol}"><strong>Company</strong>${link(`${ROOT}team`, "Our team")}${link(`${ROOT}branches`, "Branches")}${link(`${ROOT}team`, "Careers")}</div>
  <div class="${c.footerCol}"><strong>Help</strong><span class="${c.footerLink}" data-open-quote>Request a quote</span>${link(`${ROOT}book`, "Book a service")}<span class="${c.footerLink}">Cookie settings</span>${link(`${ROOT}branches`, "Contact us")}</div>
  <div class="${c.footerCol}"><strong>Talk to us</strong><span>${COMPANY.phone}</span><span>${escapeHtml(COMPANY.email)}</span><span>Monday to Friday, 8am to 5:30pm</span></div>
</div>
<p class="${c.legal}">&copy; 2026 ${escapeHtml(COMPANY.name)} Ltd. Registered in England and Wales. Gas Safe business registration 118822. Site by Harbourline Digital &middot; build ${SITE_BUILD}</p>
</footer>`;
}

/**
 * The consent platform's banner. It is server-rendered into a declarative
 * shadow root so it is there on first paint, and its host covers the whole
 * viewport, so until it is answered every click on the page lands on it.
 * The platform's own class names are hashed separately from the site's.
 */
function consentBanner(state: CompanyWebsiteState, seed: number): string {
  if (state.consent !== "pending") return "";
  const k = buildClassNames(`cmp:${seed}`, ["scrim", "banner", "title", "text", "actions", "accept", "quiet", "purposes"] as const);
  return `<div data-testid="cookie-consent" style="position:fixed;inset:0;z-index:2147482000"><template shadowrootmode="open"><style>
.${k.scrim}{position:fixed;inset:0;background:rgba(0,0,0,.35)}
.${k.banner}{position:fixed;left:0;right:0;bottom:0;background:#fff;padding:24px 32px;font:15px/1.5 system-ui;color:#222;box-shadow:0 -6px 24px rgba(0,0,0,.2)}
.${k.title}{margin:0 0 6px;font-size:18px}
.${k.text}{max-width:60rem;margin:0 0 12px}
.${k.actions}{display:flex;gap:12px;justify-content:flex-end;flex-wrap:wrap}
.${k.accept}{background:#1d4ed8;color:#fff;border:0;border-radius:4px;padding:10px 22px;font:inherit;font-weight:600;cursor:pointer}
.${k.quiet}{background:#fff;color:#1d4ed8;border:1px solid #1d4ed8;border-radius:4px;padding:10px 18px;font:inherit;cursor:pointer}
.${k.purposes}{margin:8px 0 12px}
</style>
<div class="${k.scrim}"></div>
<div class="${k.banner}" role="dialog" aria-modal="true" aria-label="Your privacy choices">
<h2 class="${k.title}">We value your privacy</h2>
<p class="${k.text}">We and our 23 partners use cookies and similar technologies to run this website, measure how it is used and show you relevant offers. You can accept all, reject everything that is not essential, or choose purpose by purpose.</p>
<div class="${k.purposes}" data-panel="purposes" hidden>
<label><input type="checkbox" checked disabled> Strictly necessary</label><br>
<label><input type="checkbox" checked> Analytics</label><br>
<label><input type="checkbox" checked> Marketing and partners</label>
</div>
<div class="${k.actions}">
<button type="button" class="${k.quiet}" data-choice="customise">Customise</button>
<button type="button" class="${k.quiet}" data-choice="essential">Reject non-essential</button>
<button type="button" class="${k.accept}" data-choice="all">Accept all</button>
</div>
</div></template></div>`;
}

function winterNotice(state: CompanyWebsiteState, c: SiteClasses): string {
  if (state.mode !== "winter-notice" || state.notice.dismissed) return "";
  return `<div class="${c.modalScrim}" data-testid="winter-notice"><div class="${c.noticeModal}" role="dialog" aria-modal="true" aria-label="Winter service notice">
<h2>Winter emergency service</h2>
<p>From 1 October we prioritise households with no heating or hot water, especially where someone is elderly, unwell or has a young child. Routine work may move by a day or two.</p>
<p>If you have no heat at all, ring ${COMPANY.emergencyPhone} rather than using this website.</p>
<button type="button" class="${c.buttonPrimary}">Continue to site</button></div></div>`;
}
