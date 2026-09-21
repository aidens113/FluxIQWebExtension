/**
 * The site's class names, the way an atomic CSS build emits them.
 *
 * A large social network ships no authored class names. Every class is a short
 * hash -- `x1lliihq` -- and most of them are single declarations shared by
 * hundreds of unrelated elements, so a class list says which styles an element
 * uses and nothing about what it is. Here every element carries one class for
 * its own rule and two or three "utility" classes drawn from a shared pool.
 *
 * The hashes are derived from the lab seed, so every seed ships a different
 * build: a selector written against one run's classes matches nothing on a run
 * with another seed, exactly as a site's classes move with each deploy.
 */
export const CLASS_ROLES = [
  "app", "topbar", "logo", "search", "searchInput", "topNav", "topNavItem", "topNavCurrent", "badge", "topActions", "iconButton",
  "avatar", "avatarSmall", "layout", "leftRail", "rightRail", "railItem", "railLabel", "railIcon", "railFoot", "center", "column",
  "card", "stories", "story", "storyName", "composerCard", "composerPrompt", "composerRow", "composerOption",
  "feed", "unit", "unitHead", "unitTitle", "unitMeta", "metaLink", "unitMenu", "unitHide", "message", "seeMore", "attachment",
  "photo", "linkCard", "linkDomain", "linkTitle", "video", "counts", "reactIcons", "reactCount", "countButton", "actions", "action",
  "actionActive", "sponsoredLabel", "spDecoy", "ctaRow", "ctaButton", "contextBar", "joinButton", "carousel", "carouselCard",
  "carouselTitle", "reelTile", "memoryCard", "sharedBox", "skeleton", "skeletonLine", "caughtUp", "endNote", "sentinel",
  "scrim", "dialog", "dialogHead", "dialogTitle", "dialogClose", "dialogBody", "dialogFoot", "primaryButton", "secondaryButton",
  "editor", "audienceButton", "trapField", "spinner", "radioRow", "menu", "menuItem", "menuItemDisabled", "menuNote", "consent",
  "chat", "chatHead", "chatBody", "chatBubble", "chatInput", "chatSend", "toastRegion", "toast", "groupCover", "groupHead",
  "groupName", "groupMeta", "groupActions", "tabs", "tab", "tabCurrent", "pendingBox", "groupColumns", "aboutCard", "createRow",
  "friendsGrid", "requestCard", "requestPhoto", "requestName", "requestMutual", "requestActions", "requestStatus", "sectionHead",
  "muted", "heading", "promo", "promoButton", "pageBody", "hoverCard",
] as const;

export type FeedClassRole = (typeof CLASS_ROLES)[number];
export type FeedClasses = Record<FeedClassRole, string>;

/**
 * Declarations shared across the page, each under its own hashed name. They
 * are harmless on any element they land on -- which is the point: they are
 * there because a build put them there, not because the element needs them.
 */
export const UTILITY_DECLARATIONS = [
  "box-sizing:border-box", "min-width:0", "-webkit-tap-highlight-color:transparent", "overflow-wrap:break-word",
  "font-family:inherit", "text-align:inherit", "touch-action:manipulation", "outline:none", "-webkit-font-smoothing:antialiased",
  "text-rendering:optimizeLegibility", "border-style:solid", "border-width:0", "list-style:none", "hyphens:manual",
] as const;

/**
 * Every class name for one seed: for each role, its own hashed class first,
 * then the utilities it picked. Two roles may share every utility, and most
 * share some, so a class that appears on a post also appears on the top bar.
 */
export function feedClasses(seed: number): FeedClasses {
  const utilities = utilityNames(seed);
  return Object.fromEntries(CLASS_ROLES.map((role) => {
    const picks = [0, 1, 2].map((index) => utilities[fnv(`${role}:${index}`) % utilities.length] ?? "");
    const count = 2 + (fnv(role) % 2);
    return [role, [roleClass(seed, role), ...new Set(picks.slice(0, count))].join(" ")];
  })) as FeedClasses;
}

/** The one class that carries a role's own rule: the first name in its list. */
export function roleClass(seed: number, role: FeedClassRole): string {
  return `x${fnv(`${seed}:role:${role}`).toString(36).padStart(7, "0").slice(0, 7)}`;
}

/** The pool's hashed names for one seed, in the order of `UTILITY_DECLARATIONS`. */
export function utilityNames(seed: number): string[] {
  return UTILITY_DECLARATIONS.map((declaration) => `x${fnv(`${seed}:util:${declaration}`).toString(36).padStart(6, "0").slice(0, 6)}`);
}

/** FNV-1a: a short, stable hash that looks like any atomic CSS build's. */
function fnv(text: string): number {
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value;
}
