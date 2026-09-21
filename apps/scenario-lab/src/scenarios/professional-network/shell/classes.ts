import { buildClassNames } from "../../../build-classes.js";

/**
 * Every styled role on the site. None of these names reaches the page: each
 * becomes a generated hash, and the hash is taken over the lab seed, so a run
 * on another seed meets a page whose every class name is different while its
 * markup, text and behaviour are the same.
 */
const ROLES = [
  "page", "nav", "navInner", "logo", "searchBox", "searchInput", "searchMenu", "searchMenuItem", "navList", "navItem", "navItemActive",
  "navIcon", "navLabel", "badge", "premiumLink", "meMenu", "layout3", "layout2", "layoutSearch", "rail", "card", "cardTitle", "main",
  "avatar", "avatarLarge", "muted", "small", "link", "vh", "dock", "dockBar", "dockTitle", "dockBody", "dockRow", "bubble", "bubbleHead",
  "bubbleBody", "bubbleMsg", "bubbleComposer", "iconButton", "consent", "consentText", "primaryBtn", "secondaryBtn", "textBtn", "scrim",
  "modal", "modalHead", "modalBody", "modalFoot", "toastHost", "toast", "footerLinks", "adFrame", "skeleton", "skeletonLine", "spinner",
  "pillBar", "pill", "pillOn", "dropdown", "dropdownFoot", "checkRow", "pager", "pagerBtn", "pagerBtnOn", "resultList", "resultItem",
  "resultBody", "resultName", "resultTitle", "resultSub", "resultMeta", "resultInsight", "promotedTag", "degreeTag", "actionBtn",
  "challenge", "fakeCheck", "feedList", "feedPost", "postHead", "postBody", "postFoot", "sectionHead", "tabs", "tab", "tabOn", "inviteList",
  "inviteRow", "inviteText", "inviteActions", "showMore", "errorLine", "profileHeader", "profileName", "profileSection", "grid", "gridCard",
  "jobCard", "upsell", "noteBox", "honeypot", "counter", "typeahead", "typeaheadItem", "resultCount", "sentinel", "threadList", "threadRow",
] as const;

export type NetworkRole = (typeof ROLES)[number];

export type NetworkClasses = Record<NetworkRole, string>;

export function networkClasses(seed: number): NetworkClasses {
  return buildClassNames(`guildline:${seed}`, ROLES);
}
