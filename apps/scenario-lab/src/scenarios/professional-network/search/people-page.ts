import { CLOSE_ICON, newsRail, renderShellPage, ROOT, type ShellKit } from "../shell/index.js";
import { filterBar } from "./filter-bar.js";
import { peopleClientScript } from "./people-client.js";
import type { PeopleQuery } from "./query.js";

export type UpsellIds = { scrim: string; dismiss: string; noThanks: string };

/** Five grey placeholder cards: what the results list is until its data arrives. */
export function skeletonMarkup(kit: ShellKit): string {
  const c = kit.css;
  const card = `<div class="${c.skeleton}" aria-hidden="true"><div class="${c.avatar}"></div><div style="flex:1"><div class="${c.skeletonLine}" style="width:40%"></div><div class="${c.skeletonLine}" style="width:80%"></div><div class="${c.skeletonLine}" style="width:55%"></div></div></div>`;
  return card.repeat(5);
}

/**
 * The Premium offer `premium-upsell` opens over the results. "Start free
 * trial" leads to a checkout; the close icon has no label; "No thanks" is a
 * styled block.
 */
function upsell(kit: ShellKit): { markup: string; ids: UpsellIds } | undefined {
  if (kit.state.mode !== "premium-upsell" || kit.state.upsellDismissed) return undefined;
  const c = kit.css;
  const ids: UpsellIds = { scrim: kit.ids.next(), dismiss: kit.ids.next(), noThanks: kit.ids.next() };
  return {
    ids,
    markup: `<div id="${ids.scrim}" class="${c.scrim}" hidden><div class="${c.modal}" role="dialog" aria-modal="true">
<div class="${c.upsell}"><button id="${ids.dismiss}" class="${c.iconButton}" type="button" style="float:right">${CLOSE_ICON}</button>
<h2>Rafaela, see who’s hiring data engineers before anyone else</h2><p>Premium members get 3× more profile views and InMail to anyone. Try Premium for €0.</p></div>
<div class="${c.modalBody}"><ul><li>See everyone who viewed your profile in the last 365 days</li><li>15 InMail credits a month</li><li>Cancel anytime. We’ll remind you 7 days before your trial ends.</li></ul></div>
<div class="${c.modalFoot}"><div id="${ids.noThanks}" class="${c.textBtn}">No thanks</div><a class="${c.primaryBtn}" href="${ROOT}premium/checkout/">Start free trial</a></div></div></div>`,
  };
}

/**
 * The people search results page. The list arrives from the results endpoint
 * 0.7 seconds after the page loads, and again after every page change; until
 * then it is skeleton cards. The app prompt runs here as it does on the feed.
 */
export function renderPeoplePage(kit: ShellKit, query: PeopleQuery): string {
  const c = kit.css;
  const bar = filterBar(kit, query);
  const resultsId = kit.ids.next();
  const offer = upsell(kit);
  const main = `${bar.markup}<section id="${resultsId}" class="${c.card}" aria-label="Search results">${skeletonMarkup(kit)}</section>`;
  const right = `<section class="${c.card}" style="padding:16px"><h2 style="font-size:16px;margin:0 0 8px">Are these results helpful?</h2><p class="${c.muted} ${c.small}">Your feedback helps us improve search results.</p></section>${newsRail(kit)}`;
  const script = peopleClientScript(kit, { query, resultsId, bar: bar.ids, upsell: offer?.ids, skeleton: skeletonMarkup(kit) });
  return renderShellPage(kit, {
    title: `${query.keywords || "People"} | Search | Guildline`,
    active: "none",
    layout: "layoutSearch",
    columns: [main, right],
    script,
    searchValue: query.keywords,
    appPrompt: true,
    modals: `${bar.allFilters}${offer?.markup ?? ""}`,
  });
}
