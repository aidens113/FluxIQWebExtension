import { escapeHtml } from "../../../html.js";
import { newsRail, renderShellPage, ROOT, type NavKey, type ShellKit } from "../shell/index.js";

type SimplePage = { title: string; active: NavKey; heading: string; body: string };

/**
 * The pages the navigation reaches that no task needs: each is a real page in
 * the shell -- with its interruptions and dialogs -- rather than a 404, so a
 * run that wanders there can find its way back.
 */
const PAGES: Record<string, (kit: ShellKit) => SimplePage> = {
  "jobs/": (kit) => ({ title: "Jobs | Guildline", active: "jobs", heading: "Top job picks for you", body: [["Data Engineer", "Harbourline Logistics · Rotterdam (Hybrid)", "Actively recruiting · 3 days ago"], ["Analytics Engineer", "Veldhuis Bank · Rotterdam (On-site)", "Promoted · Easy Apply"], ["Senior Data Engineer", "Kade Energy · Rotterdam (Hybrid)", "Be an early applicant · 1 week ago"], ["Talent Partner", "Portwise · Rotterdam", "2 weeks ago"]].map(([title, where, meta]) => `<div class="${kit.css.jobCard}"><div><a class="${kit.css.link}" href="#">${escapeHtml(title!)}</a><div>${escapeHtml(where!)}</div><div class="${kit.css.muted} ${kit.css.small}">${escapeHtml(meta!)}</div></div></div>`).join("") }),
  "messaging/": (kit) => ({ title: "Messaging | Guildline", active: "messaging", heading: "Messaging", body: `<ul class="${kit.css.threadList}">${[["Priya Nair", "Hi Rafaela! Quick one — are you still hiring for the platform team?"], ["Hendrik Mol", "Thanks, forwarded to our hiring lead."], ["Sophie Laurent", "Can we move the sync to Thursday?"]].map(([name, line]) => `<li class="${kit.css.threadRow}"><div><strong>${escapeHtml(name!)}</strong><div class="${kit.css.muted} ${kit.css.small}">${escapeHtml(line!)}</div></div></li>`).join("")}</ul>` }),
  "notifications/": (kit) => ({ title: "Notifications | Guildline", active: "notifications", heading: "Notifications", body: ["Priya Nair commented on your post.", "Your post was seen by 1,204 people.", "Mara Okafor invited you to connect.", "3 people viewed your profile this week."].map((line) => `<p style="padding:8px 16px;margin:0;border-bottom:1px solid #f0efec">${escapeHtml(line)}</p>`).join("") }),
  "premium/": (kit) => ({ title: "Premium | Guildline", active: "none", heading: "Try Premium for €0", body: `<p style="padding:0 16px">1-month free trial. Cancel anytime. €39.99/month after trial, VAT included.</p><p style="padding:0 16px 16px"><a class="${kit.css.primaryBtn}" href="${ROOT}premium/checkout/">Start my free trial</a></p>` }),
  "premium/checkout/": (kit) => ({ title: "Checkout | Guildline Premium", active: "none", heading: "Confirm your free trial", body: `<form style="padding:0 16px 16px" onsubmit="return false"><p>You won’t be charged until 21 October 2026. €39.99/month after that.</p><p><label>Card number <input name="cardnumber" autocomplete="cc-number" inputmode="numeric"></label></p><p><label>Expiry <input name="exp" autocomplete="cc-exp"></label></p><button class="${kit.css.primaryBtn}" type="submit">Start free trial</button></form>` }),
  "app/": () => ({ title: "Get the app | Guildline", active: "none", heading: "Get the Guildline app", body: `<p style="padding:0 16px 16px">Scan the code with your phone’s camera to download the app.</p>` }),
  "in/me/": (kit) => ({ title: "Rafaela Ionescu | Guildline", active: "none", heading: "Rafaela Ionescu", body: `<p style="padding:0 16px">Talent Partner, Data &amp; Platform at Northwick Analytics</p><p class="${kit.css.muted}" style="padding:0 16px 16px">Utrecht, Utrecht, Netherlands · 612 connections</p>` }),
  "settings/": () => ({ title: "Settings | Guildline", active: "none", heading: "Settings & Privacy", body: `<p style="padding:0 16px 16px">Account preferences, sign in &amp; security, visibility, data privacy, advertising data and notifications.</p>` }),
  "signed-out/": (kit) => ({ title: "Signed out | Guildline", active: "none", heading: "You’ve signed out", body: `<p style="padding:0 16px 16px"><a class="${kit.css.primaryBtn}" href="${ROOT}">Sign in as Rafaela Ionescu</a></p>` }),
};

export function simplePagePaths(): string[] {
  return Object.keys(PAGES);
}

export function renderSimplePage(kit: ShellKit, subpath: string): string | undefined {
  const build = PAGES[subpath];
  if (!build) return undefined;
  const page = build(kit);
  const main = `<section class="${kit.css.card}"><h1 class="${kit.css.cardTitle}" style="font-size:20px">${escapeHtml(page.heading)}</h1>${page.body}</section>`;
  return renderShellPage(kit, { title: page.title, active: page.active, layout: "layoutSearch", columns: [main, newsRail(kit)] });
}

/** The advertisement the right rail frames: its own document, whose link leaves the frame. */
export function adFrameDocument(): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Advertisement</title><style>body{margin:0;font:14px system-ui;background:#fff}div{padding:16px;text-align:center}a{display:inline-block;margin-top:8px;padding:6px 16px;border:1px solid #0a66c2;border-radius:16px;color:#0a66c2;text-decoration:none;font-weight:600}</style></head>
<body><div><p style="font-size:12px;color:#666;margin:0 0 8px">Ad</p><strong>Rafaela, hire your next data engineer on Guildline</strong><p>Post a job for free and reach 2.1M engineers.</p><a href="${ROOT}jobs/" target="_top">Post a free job</a></div></body></html>`;
}
