import { escapeHtml } from "../../../html.js";
import { branchById, type TeamCard } from "../data/index.js";
import type { SiteClasses } from "../styles.js";

/**
 * One card, exactly as the page builder's "team member" block renders it: the
 * leadership strip, the grid and the job advert all use this one block, so a
 * card's markup says nothing about which of the three it is. The Gas Safe line
 * is a `dt`/`dd` pair among the others, in whatever order the person's
 * credentials were entered.
 */
export function personCard(c: SiteClasses, card: TeamCard): string {
  const initials = card.kind === "hiring" ? "?" : card.name.split(/\s+/u).map((part) => part[0]).join("").slice(0, 2);
  const rows = [{ label: "Branch", value: branchById(card.branchId).name }, ...card.credentials]
    .map(({ label, value }) => `<div class="${c.credRow}"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("");
  const firstName = card.name.split(/\s+/u)[0] ?? card.name;
  const about = card.kind === "hiring"
    ? `<p class="${c.bio}">${escapeHtml(card.bio)}</p><a href="#careers">Apply now</a>`
    : `<div class="${c.bioToggle}">About ${escapeHtml(firstName)}</div><p class="${c.bio}" hidden>${escapeHtml(card.bio)}</p>`;
  return `<article class="${c.personCard}"><div class="${c.avatar}" aria-hidden="true">${escapeHtml(initials)}</div><h3 class="${c.personName}">${escapeHtml(card.name)}</h3><p class="${c.personRole}">${escapeHtml(card.role)}</p><dl class="${c.credList}">${rows}</dl>${about}</article>`;
}
