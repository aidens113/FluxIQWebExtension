import { escapeHtml } from "../../../html.js";
import { INTERSTITIALS } from "../data/index.js";
import type { SiteClasses } from "../styles.js";
import type { CompanyWebsiteState } from "../types.js";

/**
 * The account or security dialog the visitor's mode opens over every page,
 * server-rendered over a scrim that takes every click, until one of its
 * buttons is pressed (`client/shell-script.ts` posts the press). Nothing in
 * any other mode.
 */
export function interstitial(state: CompanyWebsiteState, c: SiteClasses): string {
  const dialog = INTERSTITIALS[state.mode];
  if (!dialog || state.interstitial.pressed !== null) return "";
  return `<div class="${c.modalScrim}" data-interstitial><div class="${c.modal}" role="dialog" aria-modal="true" aria-label="${escapeHtml(dialog.label)}">${dialog.body(c)}</div></div>`;
}
