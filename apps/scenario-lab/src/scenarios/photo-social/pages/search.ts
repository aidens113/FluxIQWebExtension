import { escapeHtml } from "../../../html.js";
import { ACCOUNTS, accountByHandle } from "../data/index.js";
import { glyph } from "../look/index.js";
import type { Account } from "../types.js";
import type { PageContext } from "./context.js";
import { avatar } from "./media.js";
import { ROOT, compactCount } from "./text.js";

/**
 * Accounts the visitor opened recently, which is what the search panel lists
 * before anything is typed. The impersonator is first: the visitor opened it
 * from the giveaway ad.
 */
export const RECENT_SEARCHES = ["harbourlight.studios", "kiln.theory", "saltmarsh.goods"] as const;

function resultRow(ctx: PageContext, account: Account): string {
  const { cls } = ctx.look;
  const badge = account.verified ? glyph("badge", cls.verified, "Verified") : "";
  return `<a class="${cls.result}" href="${ROOT}${account.handle}/">${avatar(account.handle, cls.avatar)}<div><div><span class="${cls.handle}">${escapeHtml(account.handle)}</span>${badge}</div><div class="${cls.meta}">${escapeHtml(account.name)} • ${compactCount(account.followers)} followers</div></div></a>`;
}

/**
 * Accounts matching a query, ranked the way the visitor's own history ranks
 * them: anything opened recently first, then by followers. The query matches
 * handles and names with spaces, dots and underscores ignored.
 */
export function searchResults(ctx: PageContext, query: string): string {
  const needle = query.toLowerCase().replace(/[\s._]+/gu, "");
  const { cls } = ctx.look;
  if (needle === "") {
    const recent = RECENT_SEARCHES.map((handle) => accountByHandle(handle)).filter((account): account is Account => account !== undefined);
    return `<div class="${cls.railHead}" style="padding:0 24px"><span>Recent</span><div role="button" tabindex="0" class="${cls.linkButton}">Clear all</div></div>${recent.map((account) => resultRow(ctx, account)).join("")}`;
  }
  const recentRank = (handle: string) => { const index = (RECENT_SEARCHES as readonly string[]).indexOf(handle); return index < 0 ? RECENT_SEARCHES.length : index; };
  const matches = ACCOUNTS.filter((account) => `${account.handle}${account.name}`.toLowerCase().replace(/[\s._]+/gu, "").includes(needle))
    .sort((a, b) => recentRank(a.handle) - recentRank(b.handle) || b.followers - a.followers)
    .slice(0, 12);
  return matches.length === 0 ? `<p class="${cls.meta}" style="padding:0 24px">No results found.</p>` : matches.map((account) => resultRow(ctx, account)).join("");
}
