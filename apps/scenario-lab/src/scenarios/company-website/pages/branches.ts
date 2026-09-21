import { escapeHtml } from "../../../html.js";
import type { RenderContext } from "../../../types.js";
import { BRANCHES, branchById, COMPANY } from "../data/index.js";
import { siteClasses } from "../styles.js";
import type { CompanyWebsiteState } from "../types.js";
import { sitePage } from "./shell.js";

/** The branches, with opening hours, and a "Get directions" link each that opens the map in a new tab. */
export function renderBranches(state: CompanyWebsiteState, context: RenderContext): string {
  const c = siteClasses(context.seed);
  const cards = BRANCHES.map((branch) => {
    const hours = branch.hours.map(([days, times]) => `<tr><td>${escapeHtml(days)}</td><td>${escapeHtml(times)}</td></tr>`).join("");
    return `<article class="${c.branchCard}"><h2 style="margin-top:0">${escapeHtml(branch.name)}</h2><p>${escapeHtml(branch.address)}<br>${escapeHtml(branch.phone)}</p><table class="${c.hoursTable}"><tbody>${hours}</tbody></table><p class="${c.muted}">${escapeHtml(branch.note)}</p><a href="${COMPANY.root}directions?branch=${branch.id}" target="_blank" rel="noopener">Get directions</a></article>`;
  }).join("");
  const main = `<h1 class="${c.sectionTitle}" style="font-size:2rem">Branches</h1><p class="${c.lead}">Five branches, one team. Call the branch nearest you, or use our head office number and we will put you through.</p><div class="${c.teaserGrid}">${cards}</div>`;
  return sitePage({ state, context, title: "Branches and opening hours", section: "branches", main });
}

/** The map tab "Get directions" opens. It records which branch was asked for. */
export function renderDirections(state: CompanyWebsiteState, context: RenderContext, branchId: string): string {
  const c = siteClasses(context.seed);
  const branch = branchById(branchId);
  const main = `<h1 class="${c.sectionTitle}">Directions to ${escapeHtml(branch.name)}</h1><div class="${c.notice}" style="height:18rem;display:grid;place-items:center">Map loading&hellip;</div><p>${escapeHtml(branch.address)}</p>`;
  return sitePage({ state, context, title: `Directions to ${branch.name}`, section: "branches", main });
}
