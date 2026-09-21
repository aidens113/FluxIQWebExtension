import { escapeHtml } from "../../../html.js";
import { invitationStoreText } from "../store.js";
import { shellClientScript } from "./client-script.js";
import { appPrompt, connectDialog, withdrawDialog } from "./dialogs.js";
import type { ShellKit } from "./kit.js";
import { consentBanner, messagingOverlay, overlayIds } from "./overlays.js";
import { ROOT } from "./paths.js";
import { networkStylesheet } from "./styles.js";

export type NavKey = "home" | "network" | "jobs" | "messaging" | "notifications" | "none";

export type ShellPage = {
  title: string;
  active: NavKey;
  layout: "layout3" | "layout2" | "layoutSearch";
  /** The page's columns, left to right, already rendered with the same kit. */
  columns: readonly string[];
  /** The page's own module script, run after the shell's, with `window.GL` available. */
  script?: string;
  searchValue?: string;
  /** Whether this page opens the app-install prompt a few seconds after it loads. */
  appPrompt?: boolean;
  /** Further dialogs the page owns, placed in the modal outlet. */
  modals?: string;
};

const ICONS: Record<Exclude<NavKey, "none">, string> = {
  home: "M23 9v2h-2v7a3 3 0 01-3 3h-4v-6h-4v6H6a3 3 0 01-3-3v-7H1V9l11-7z",
  network: "M12 16v6H3v-6a3 3 0 013-3h3a3 3 0 013 3zm5.5-3A3.5 3.5 0 1014 9.5a3.5 3.5 0 003.5 3.5zm1 2h-2a2.5 2.5 0 00-2.5 2.5V22h7v-4.5a2.5 2.5 0 00-2.5-2.5zM7.5 2A4.5 4.5 0 1012 6.5 4.49 4.49 0 007.5 2z",
  jobs: "M17 6V5a3 3 0 00-3-3h-4a3 3 0 00-3 3v1H2v4a3 3 0 003 3h14a3 3 0 003-3V6zM9 5a1 1 0 011-1h4a1 1 0 011 1v1H9zm10 9a4 4 0 003-1.38V17a3 3 0 01-3 3H5a3 3 0 01-3-3v-4.38A4 4 0 005 14z",
  messaging: "M16 4H8a7 7 0 000 14h4v4l8.16-5.39A6.78 6.78 0 0023 11a7 7 0 00-7-7zm-8 8.25A1.25 1.25 0 119.25 11 1.25 1.25 0 018 12.25zm4 0A1.25 1.25 0 1113.25 11 1.25 1.25 0 0112 12.25zm4 0A1.25 1.25 0 1117.25 11 1.25 1.25 0 0116 12.25z",
  notifications: "M22 19h-8.28a2 2 0 11-3.44 0H2v-1a4.52 4.52 0 011.17-2.83l1-1.17h15.7l1 1.17A4.42 4.42 0 0122 18zM18.21 7.44A6.27 6.27 0 0012 2a6.27 6.27 0 00-6.21 5.44L5 13h14z",
};

const NAV: ReadonlyArray<[Exclude<NavKey, "none">, string, string, string]> = [
  ["home", "Home", "", ""],
  ["network", "My Network", "mynetwork/", "3"],
  ["jobs", "Jobs", "jobs/", ""],
  ["messaging", "Messaging", "messaging/", "2"],
  ["notifications", "Notifications", "notifications/", "9+"],
];

/**
 * One page of the site in its application shell: the global bar, the page's
 * columns, the messaging dock, the modal outlet with its shared dialogs, the
 * toasts, the cookie banner while unanswered, and the embedded invitation
 * store. The store is hydration data -- JSON in a script element, the way a
 * client-rendered app ships its first state -- and the final-state oracle
 * reads it, so it must be on every page and current after every change.
 */
export function renderShellPage(kit: ShellKit, shellPage: ShellPage): string {
  const c = kit.css;
  const next = kit.ids.next;
  const searchInput = next();
  const searchMenu = next();
  const meButton = next();
  const meMenu = next();
  const toastHost = next();
  const overlays = overlayIds(kit);
  const withdraw = withdrawDialog(kit);
  const connect = connectDialog(kit);
  const prompt = shellPage.appPrompt && !kit.state.appPromptDismissed ? appPrompt(kit) : undefined;
  const navItems = NAV.map(([key, label, href, badge]) => {
    const active = shellPage.active === key;
    const count = badge ? `<span class="${c.badge}">${badge}<span class="${c.vh}"> new notifications</span></span>` : "";
    return `<li><a class="${c.navItem}${active ? ` ${c.navItemActive}` : ""}" href="${ROOT}${href}"${active ? ' aria-current="page"' : ""}><svg class="${c.navIcon}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[key]}" fill="currentColor"/></svg>${count}<span>${label}</span></a></li>`;
  }).join("");
  const store = `<script type="application/json" data-testid="invitation-store">${invitationStoreText(kit.state.store).replaceAll("<", "\\u003c")}</script>`;
  const script = shellClientScript(kit, { overlays, withdraw: withdraw.ids, connect: connect.ids, appPrompt: prompt?.ids, searchInput, searchMenu, meButton, meMenu, toastHost });
  const columns = shellPage.columns.map((column, index) => `<div class="${index === 0 && shellPage.layout !== "layoutSearch" ? c.rail : c.main}">${column}</div>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(shellPage.title)}</title>
<style>${networkStylesheet(c)}</style>
</head>
<body class="${c.page}">
<header class="${c.nav}"><div class="${c.navInner}">
<a class="${c.logo}" href="${ROOT}"><span aria-hidden="true">gl</span><span class="${c.vh}">Guildline</span></a>
<div class="${c.searchBox}"><input id="${searchInput}" class="${c.searchInput}" type="text" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-label="Search" placeholder="Search" value="${escapeHtml(shellPage.searchValue ?? "")}">
<div id="${searchMenu}" class="${c.searchMenu}" hidden><div class="${c.muted} ${c.small}" style="padding:4px 16px">Recent</div>
<a class="${c.searchMenuItem}" href="${ROOT}search/results/all/?keywords=data%20analyst&amp;origin=RECENT">data analyst</a>
<a class="${c.searchMenuItem}" href="${ROOT}search/results/all/?keywords=Harbourline%20Logistics&amp;origin=RECENT">Harbourline Logistics</a>
<a class="${c.searchMenuItem}" href="${ROOT}search/results/all/?keywords=platform%20engineer&amp;origin=RECENT">platform engineer</a></div></div>
<ul class="${c.navList}">${navItems}
<li style="position:relative"><button id="${meButton}" class="${c.navItem}" type="button"><span class="${c.avatar}" style="width:24px;height:24px;font-size:10px" aria-hidden="true">RI</span><span>Me ▾</span></button>
<div id="${meMenu}" class="${c.meMenu}" hidden><div style="padding:8px 16px"><strong>Rafaela Ionescu</strong><div class="${c.muted} ${c.small}">Talent Partner, Data &amp; Platform at Northwick Analytics</div></div>
<a class="${c.searchMenuItem}" href="${ROOT}in/me/">View profile</a><a class="${c.searchMenuItem}" href="${ROOT}settings/">Settings &amp; Privacy</a><a class="${c.searchMenuItem}" href="${ROOT}signed-out/">Sign out</a></div></li>
<li><a class="${c.navItem}" href="${ROOT}premium/"><span class="${c.premiumLink}">Try Premium for €0</span></a></li></ul>
</div></header>
<div class="${c[shellPage.layout]}">${columns}</div>
${messagingOverlay(kit, overlays)}
<div id="artdeco-modal-outlet">${withdraw.markup}${connect.markup}${prompt?.markup ?? ""}${shellPage.modals ?? ""}</div>
<div id="${toastHost}" class="${c.toastHost}" role="status" aria-live="polite"></div>
${consentBanner(kit, overlays)}
${store}
<script type="module">${script}</script>
${shellPage.script ? `<script type="module">${shellPage.script}</script>` : ""}
</body>
</html>`;
}

/** The right rail most pages carry: news, an advertisement in its own frame, and the footer. */
export function newsRail(kit: ShellKit): string {
  const c = kit.css;
  const news = [
    ["Port of Rotterdam hires for data roles", "1d ago · 2,318 readers"],
    ["Energy firms race for grid engineers", "2d ago · 1,044 readers"],
    ["Hybrid work rules tighten in Benelux", "3d ago · 6,512 readers"],
    ["Why recruiters are asking for dbt", "4d ago · 873 readers"],
  ].map(([title, meta]) => `<li style="padding:6px 16px"><a href="#"><strong>${escapeHtml(title!)}</strong></a><div class="${c.muted} ${c.small}">${escapeHtml(meta!)}</div></li>`).join("");
  return `<section class="${c.card}"><h2 class="${c.cardTitle}">Guildline News</h2><ul style="list-style:none;margin:0;padding:0 0 12px">${news}</ul></section>
<section class="${c.card}"><iframe class="${c.adFrame}" title="Advertisement" src="${ROOT}ad/"></iframe></section>
<nav class="${c.footerLinks}" aria-label="Footer">About · Accessibility · Help Center · Privacy &amp; Terms · Ad Choices · Advertising · Business Services · Get the Guildline app<br>Guildline Corporation © 2026</nav>`;
}
