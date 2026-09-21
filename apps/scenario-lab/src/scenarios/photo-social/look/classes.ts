/**
 * Class names the way an atomic CSS build emits them: every element carries a
 * run of short hashes -- `x1lliihq x6ikm8r x10wlt62` -- and not one says what
 * it is. The first hash in each run is the one the stylesheet styles; the rest
 * are single-declaration atoms drawn from a pool that hundreds of unrelated
 * elements share, which is what makes a class set evidence about styling and
 * never about purpose.
 *
 * Everything hashes the lab seed, so another seed renames every class on the
 * site at once while the markup, text and behaviour stay the same.
 */
const ROLES = [
  "app", "nav", "navBrand", "navItem", "navLabel", "navIcon", "navBadge", "main", "rail", "railHead", "railRow", "follow", "linkButton",
  "stories", "story", "storyRing", "feed", "card", "cardHead", "avatar", "avatarLarge", "handle", "verified", "meta", "media", "mediaImg",
  "carouselArrow", "dots", "dot", "actions", "iconButton", "likes", "caption", "more", "commentsLink", "composer", "composerInput", "postButton",
  "skeleton", "spinner", "sponsored", "suggested", "profile", "profileHead", "profileStats", "bio", "tabs", "tab", "grid", "cell", "cellImg",
  "cellBadge", "cellOverlay", "wall", "wallCard", "primary", "secondary", "article", "articleMedia", "articleSide", "thread", "comment",
  "commentBody", "commentMeta", "replies", "repliesToggle", "loadMore", "scrim", "dialog", "dialogHead", "dialogBody", "dialogRow", "check",
  "input", "toast", "popover", "banner", "consent", "consentActions", "search", "searchInput", "result", "inbox", "threadList", "threadRow",
  "conversation", "bubble", "bubbleMine", "card2", "typing", "dmComposer", "trap", "saved", "tile", "modal", "modalNav", "close", "upsell", "footer",
] as const;

export type PhotoRole = (typeof ROLES)[number];

/** `cls` is what goes in a `class` attribute; `hook` is the one class the stylesheet and the page's own script use. */
export type PhotoLook = { cls: Record<PhotoRole, string>; hook: Record<PhotoRole, string> };

const ATOMS = 56;

function hash(text: string): string {
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return `x${value.toString(36)}`;
}

export function photoLook(seed: number): PhotoLook {
  const atoms = Array.from({ length: ATOMS }, (_, index) => hash(`${seed}:atom:${index}`));
  const hook = {} as Record<PhotoRole, string>;
  const cls = {} as Record<PhotoRole, string>;
  for (const role of ROLES) {
    hook[role] = hash(`${seed}:${role}`);
    const picks = Number.parseInt(hash(`${role}:${seed}:picks`).slice(1), 36);
    const decoys = Array.from({ length: 3 + (picks % 5) }, (_, index) => atoms[(picks >>> (index * 3)) % ATOMS]!);
    cls[role] = [hook[role], ...new Set(decoys)].join(" ");
  }
  return { cls, hook };
}

/** A generated element id in the shape a server-rendered React tree carries, rotated by the seed. */
export function mountId(seed: number, name: string): string {
  return `mount_0_0_${hash(`${seed}:id:${name}`).slice(1, 4)}`;
}
