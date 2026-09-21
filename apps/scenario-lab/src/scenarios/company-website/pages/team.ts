import { escapeHtml } from "../../../html.js";
import type { RenderContext } from "../../../types.js";
import { teamScript } from "../client/index.js";
import { BRANCHES, CHIP_COUNTS, COMPANY, TEAM } from "../data/index.js";
import { generatedId, siteClasses } from "../styles.js";
import type { CompanyWebsiteState } from "../types.js";
import { personCard } from "./person-card.js";
import { sitePage } from "./shell.js";

/**
 * "Meet the team". The leadership strip is server-rendered; the grid below it
 * arrives in batches of eight, behind skeleton cards, as its end scrolls into
 * view -- three times, after which a "Show more people" button takes over.
 * The branch filter is a row of `div` chips whose counts are a day stale.
 */
export function renderTeam(state: CompanyWebsiteState, context: RenderContext): string {
  const c = siteClasses(context.seed);
  const id = (name: string) => generatedId(context.seed, `team:${name}`);
  const ids = { chips: id("chips"), grid: id("grid"), sentinel: id("sentinel"), status: id("status"), more: id("more") };
  const leadership = TEAM.filter((card) => card.leadership).map((card) => personCard(c, card)).join("");
  const chip = (filter: string, label: string, active: boolean) => `<div class="${c.chip}${active ? ` ${c.chipActive}` : ""}" data-filter="${filter}">${escapeHtml(label)}<span class="${c.chipCount}">(${CHIP_COUNTS[filter] ?? 0})</span></div>`;
  const chips = [chip("all", "Everyone", true), ...BRANCHES.map((branch) => chip(branch.id, branch.name, false))].join("");
  const skeletons = Array.from({ length: 8 }, () => `<div class="${c.skeleton}" aria-hidden="true" data-skeleton><div class="${c.skeletonLine}" style="width:40%"></div><div class="${c.skeletonLine}"></div><div class="${c.skeletonLine}" style="width:70%"></div></div>`).join("");
  const main = `<h1 class="${c.sectionTitle}" style="font-size:2rem">Meet the team</h1>
<p class="${c.lead}">Every engineer who comes to your home works for us, not a subcontractor. Here are the people behind ${escapeHtml(COMPANY.shortName)}, branch by branch.</p>
<section class="${c.section}" aria-label="Leadership"><h2 class="${c.sectionTitle}">Leadership</h2><div class="${c.leadership}">${leadership}</div></section>
<section class="${c.section}" aria-label="Our people"><h2 class="${c.sectionTitle}">Our people</h2>
<div class="${c.chips}" id="${ids.chips}">${chips}</div>
<div class="${c.grid}" id="${ids.grid}">${skeletons}</div>
<div class="${c.sentinel}" id="${ids.sentinel}"></div>
<p class="${c.loadStatus}" id="${ids.status}" role="status"></p>
<button type="button" class="${c.button} ${c.loadMore}" id="${ids.more}" hidden>Show more people</button>
</section>`;
  return sitePage({ state, context, title: "Meet the team", section: "team", main, pageScript: teamScript(ids, c, `${COMPANY.root}team/people`) });
}
