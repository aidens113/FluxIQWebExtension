import type { ShellKit } from "../shell/index.js";
import { resultEntryMarkup, type CardAction } from "./card.js";
import type { PeopleQuery } from "./query.js";
import { RETRY_AFTER_SECONDS } from "./rate-limit.js";
import { peopleResultsPage, resultCountText } from "./results.js";

/**
 * What the results endpoint answers: JSON, as a client-rendered search
 * fetches it. `html` is the results list with its pager; `cards` is what each
 * card's button needs; a check answer carries `retryAfter` instead of results.
 */
export type PeopleFragment = { html: string; cards: Record<string, CardAction>; page: number; pageCount: number; retryAfter?: number };

/**
 * One page of results. The pager lists every page by number, and offers
 * Previous and Next beside them; the page's script is what makes Next not
 * work, not this markup.
 */
export function peopleFragment(kit: ShellKit, query: PeopleQuery): PeopleFragment {
  const c = kit.css;
  const results = peopleResultsPage(query);
  const actions = new Map<string, CardAction>();
  if (results.entries.length === 0) {
    return { html: `<div class="${c.challenge}"><h2>No results found</h2><p class="${c.muted}">Try shortening or rephrasing your search.</p></div>`, cards: {}, page: results.page, pageCount: results.pageCount };
  }
  const items = results.entries.map((entry) => resultEntryMarkup(kit, entry, actions)).join("\n");
  const numbers = Array.from({ length: results.pageCount }, (_, index) => {
    const number = index + 1;
    const on = number === results.page;
    return `<li><button class="${c.pagerBtn}${on ? ` ${c.pagerBtnOn}` : ""}" type="button"${on ? ' aria-current="true"' : ""}>${number}</button></li>`;
  }).join("");
  const pager = results.pageCount < 2 ? "" : `<div class="${c.pager}"><span class="${c.muted} ${c.small}" style="margin-right:auto">Page ${results.page} of ${results.pageCount}</span>
<button class="${c.pagerBtn}" type="button"${results.page === 1 ? " disabled" : ""}>Previous</button>
<ul style="display:flex;gap:4px;list-style:none;margin:0;padding:0">${numbers}</ul>
<button class="${c.pagerBtn}" type="button">Next</button></div>`;
  return {
    html: `<div class="${c.resultCount}">${resultCountText(results.total)}</div>\n<ul class="${c.resultList}" role="list">\n${items}\n</ul>\n${pager}`,
    cards: Object.fromEntries(actions),
    page: results.page,
    pageCount: results.pageCount,
  };
}

/**
 * The security check the search answers with when it is asked for results
 * too fast. Its box is a styled block with a click handler and no role; the
 * page retries on its own after `retryAfter` seconds, or two seconds after the
 * box is ticked.
 */
export function challengeFragment(kit: ShellKit, page: number): PeopleFragment {
  const c = kit.css;
  return {
    html: `<div class="${c.challenge}"><h2>Let’s do a quick security check</h2>
<p>We noticed some unusual activity from your account. To keep Guildline safe, please confirm you’re a person.</p>
<div class="${c.fakeCheck}"><span style="width:24px;height:24px;border:2px solid #c1c1c1;border-radius:2px;background:#fff"></span><span>I’m not a robot</span></div>
<p class="${c.muted} ${c.small}">Or wait a few seconds and we’ll try again automatically.</p></div>`,
    cards: {},
    page,
    pageCount: 0,
    retryAfter: RETRY_AFTER_SECONDS,
  };
}
