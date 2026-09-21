import { escapeHtml } from "../../../html.js";
import { FEED_POSTS } from "../data/index.js";
import { newsRail, renderShellPage, ROOT, type ShellKit } from "../shell/index.js";
import { resultEntryMarkup, type CardAction } from "./card.js";
import { peopleSearchHref } from "./query.js";
import { peopleMatches } from "./results.js";

const JOBS: ReadonlyArray<[string, string, string, string]> = [
  ["Data Engineer", "Harbourline Logistics", "Rotterdam, South Holland, Netherlands (Hybrid)", "€62,000/yr – €78,000/yr"],
  ["Senior Data Engineer", "Kade Energy", "Rotterdam, South Holland, Netherlands (On-site)", "€75.000 – €92.000 per jaar"],
  ["Data Engineer (Streaming)", "Quayside Labs", "Rotterdam, South Holland, Netherlands (Remote)", "Promoted"],
];

/**
 * Where the global search box lands: a little of everything. Three people
 * with a link to all of them, three jobs, and two posts. The page's type
 * switcher is a row of buttons that navigate; only "See all people results"
 * and the People button reach the people search.
 */
export function renderAllResultsPage(kit: ShellKit, keywords: string): string {
  const c = kit.css;
  const peopleHref = peopleSearchHref({ keywords, network: [], geo: [], company: [], page: 1 });
  const actions = new Map<string, CardAction>();
  const people = peopleMatches({ keywords, network: [], geo: [], company: [], page: 1 }).slice(0, 3)
    .map((member, index) => resultEntryMarkup(kit, { kind: "organic", member, position: index + 1 }, actions)).join("");
  const jobs = JOBS.map(([title, company, place, pay]) => `<div class="${c.jobCard}"><div class="${c.avatar}" aria-hidden="true">${escapeHtml(company[0]!)}</div><div><a class="${c.link}" href="${ROOT}jobs/">${escapeHtml(title)}</a><div>${escapeHtml(company)}</div><div class="${c.muted} ${c.small}">${escapeHtml(place)}</div><div class="${c.muted} ${c.small}">${escapeHtml(pay)}</div></div></div>`).join("");
  const posts = FEED_POSTS.filter((post) => !post.promoted && post.body.toLowerCase().includes("data")).slice(0, 2)
    .map((post) => `<div class="${c.jobCard}"><div><strong>${escapeHtml(post.actor)}</strong><div class="${c.muted} ${c.small}">${escapeHtml(post.actorHeadline)} · ${post.age}</div><p>${escapeHtml(post.body)}</p></div></div>`).join("");
  const types = ["People", "Jobs", "Posts", "Companies", "Groups", "Events"].map((type) => `<button class="${c.pill}" type="button">${type}</button>`).join("");
  const main = `<div class="${c.pillBar}">${types}<div class="${c.pill}" tabindex="0">All filters</div></div>
<section class="${c.card}"><h2 class="${c.cardTitle}">People</h2><ul class="${c.resultList}" role="list">${people || `<li class="${c.resultItem}">No people match “${escapeHtml(keywords)}”.</li>`}</ul>
<a class="${c.link}" style="display:block;padding:12px 16px;text-align:center;border-top:1px solid #e0dfdc" href="${escapeHtml(peopleHref)}">See all people results</a></section>
<section class="${c.card}"><h2 class="${c.cardTitle}">Jobs</h2>${jobs}<a class="${c.link}" style="display:block;padding:12px 16px;text-align:center" href="${ROOT}jobs/">See all job results in Netherlands</a></section>
<section class="${c.card}"><h2 class="${c.cardTitle}">Posts</h2>${posts}</section>`;
  const script = `const target = { People: ${JSON.stringify(peopleHref)}, Jobs: window.GL.root + 'jobs/' };
for (const button of document.querySelectorAll(${JSON.stringify(`.${c.pillBar} button`)})) {
  button.addEventListener('click', () => { const href = target[button.textContent.trim()]; if (href) location.assign(href); });
}`;
  return renderShellPage(kit, { title: `${keywords} | Search | Guildline`, active: "none", layout: "layoutSearch", columns: [main, newsRail(kit)], script, searchValue: keywords, appPrompt: true });
}
