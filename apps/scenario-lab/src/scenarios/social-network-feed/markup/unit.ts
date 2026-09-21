import { escapeHtml as esc } from "../../../html.js";
import { communityBySlug, FEED_BEFORE_CAUGHT_UP, fullDateText, MAYA, PEOPLE_YOU_MAY_KNOW, personBySlug, shortDateText } from "../content/index.js";
import type { Attachment, FeedEntry, FeedPost, MemoryUnit, RecapUnit, SharedUnit, SponsoredUnit, SuggestedUnit } from "../content/index.js";
import type { FeedClasses } from "./classes.js";
import { audienceIcon, avatarGraphic, glyph, photoSource, SITE_ROOT, sponsoredLetters, trackedHref } from "./parts.js";

/** What a unit needs to render besides itself: the build's classes, the seed, where embeds are served from, and what Maya has liked. */
export type UnitContext = { css: FeedClasses; seed: number; frameOrigin: string; liked: ReadonlySet<string> };

/** A post longer than this shows only its start, cut at a word boundary before `CUT_AT`, with "See more" after it. */
export const SEE_MORE_AFTER = 240;
const CUT_AT = 200;

/**
 * The start of a long post as the feed first shows it, or `undefined` for a
 * post short enough to show whole. The rest of the text is not in the
 * document until "See more" is pressed.
 */
export function cutText(text: string): string | undefined {
  if (text.length <= SEE_MORE_AFTER) return undefined;
  const head = text.slice(0, CUT_AT);
  return head.slice(0, head.lastIndexOf(" ")).trimEnd();
}

/**
 * One feed unit as the server sends it. Every unit is an ARIA feed article
 * with its position in the feed and an unknown set size, labelled by its
 * title and described by its text through ids the page assigns when it
 * mounts the unit -- so the ids differ with the order units happen to load in.
 */
export function unitMarkup(entry: FeedEntry, context: UnitContext): string {
  const { unit, position } = entry;
  const key = `${unit.id}-${position}`;
  const body = (() => {
    switch (unit.kind) {
      case "post": return postBody(unit, context, key);
      case "sponsored": return sponsoredBody(unit, context, key);
      case "shared": return sharedBody(unit, context, key);
      case "suggested": return suggestedBody(unit, context, key);
      case "recap": return recapBody(unit, context, key);
      case "memory": return memoryBody(unit, context, key);
      case "people": return peopleBody(context, key);
      case "reels": return reelsBody(context, key);
    }
  })();
  return `<div class="${context.css.unit}" role="article" aria-posinset="${position}" aria-setsize="-1" data-lb="${key}-t" data-db="${key}-m">${body}</div>`;
}

/** A post's own markup, shared by the feed, a recap of it, the group page and the post's own page. */
export function postBody(post: FeedPost, context: UnitContext, key: string, whole = false): string {
  const { css } = context;
  const own = post.author === MAYA.slug;
  const controls = `<div class="${css.unitMenu}" role="button" tabindex="0" aria-label="Actions for this post" aria-haspopup="menu" aria-expanded="false">${glyph("dots")}</div>${own ? "" : `<div class="${css.unitHide}" role="button" tabindex="0" aria-label="Hide post">${glyph("cross", 16)}</div>`}`;
  const boosted = post.boosted ? `<div class="${css.ctaRow}"><span class="${css.muted}">Boosted · 1,204 people reached · £21.00 spent</span><div class="${css.primaryButton}" role="button" tabindex="0">See results</div></div>` : "";
  return `${postHead(post, context, key, controls)}${messageMarkup(post.text, css, key, whole)}${attachmentMarkup(post, context, key)}${boosted}${countsMarkup(css, post.reactions, post.comments, post.shares)}${actionsMarkup(css, context.liked.has(post.id))}`;
}

function postHead(post: FeedPost, context: UnitContext, key: string, controls: string): string {
  const { css, seed } = context;
  const author = personBySlug(post.author);
  const authorLink = (className: string) => `<a class="${className}" href="${esc(trackedHref(`people/${author.slug}/`, seed, key))}">${esc(author.name)}</a>`;
  const time = timeLink(css, seed, key, post.id, post.minutesAgo);
  const audience = audienceIcon(post.audience === "Members" && post.group ? `Shared with Members of ${communityBySlug(post.group).name}` : `Shared with ${post.audience}`);
  if (post.group) {
    const group = communityBySlug(post.group);
    const groupHref = esc(trackedHref(`groups/${group.slug}/`, seed, key));
    return `<div class="${css.unitHead}"><a class="${css.avatar}" href="${groupHref}" aria-hidden="true" tabindex="-1">${avatarGraphic(group.hue, 40)}</a><div><h3 class="${css.unitTitle}" data-uid="${key}-t"><span><a class="${css.metaLink}" href="${groupHref}">${esc(group.name)}</a></span></h3><div class="${css.unitMeta}"><span>${authorLink(css.metaLink)}</span><span aria-hidden="true"> · </span><span>${time}</span><span aria-hidden="true"> · </span>${audience}</div></div>${controls}</div>`;
  }
  return `<div class="${css.unitHead}"><a class="${css.avatar}" href="${esc(trackedHref(`people/${author.slug}/`, seed, `${key}-a`))}" aria-hidden="true" tabindex="-1">${avatarGraphic(author.hue, 40)}</a><div><h3 class="${css.unitTitle}" data-uid="${key}-t"><span><strong>${authorLink(css.metaLink)}</strong></span></h3><div class="${css.unitMeta}"><span>${time}</span><span aria-hidden="true"> · </span>${audience}</div></div>${controls}</div>`;
}

/** The timestamp: a short label, linked to the post's page, whose label is the full date and time. */
function timeLink(css: FeedClasses, seed: number, key: string, id: string, minutesAgo: number): string {
  return `<a class="${css.metaLink}" href="${esc(trackedHref(`posts/${id}/`, seed, key))}" aria-label="${esc(fullDateText(minutesAgo))}"><span>${esc(shortDateText(minutesAgo))}</span></a>`;
}

function messageMarkup(text: string, css: FeedClasses, key: string, whole: boolean): string {
  const cut = whole ? undefined : cutText(text);
  const shown = cut === undefined ? esc(text) : `${esc(cut)}… <div class="${css.seeMore}" role="button" tabindex="0">See more</div>`;
  return `<div class="${css.message}" dir="auto" data-ad-comet-preview="message" data-uid="${key}-m">${shown}</div>`;
}

function attachmentMarkup(post: FeedPost, context: UnitContext, key: string): string {
  const attachment: Attachment | undefined = post.attachment;
  if (!attachment) return "";
  const { css, seed } = context;
  if (attachment.kind === "photo") return `<a class="${css.attachment}" href="${esc(trackedHref(`photo/?fbid=${post.id.slice(2)}`, seed, key))}"><img class="${css.photo}" src="${photoSource(attachment.hue)}" alt="${esc(attachment.alt)}"></a>`;
  if (attachment.kind === "link") {
    return `<a class="${css.linkCard}" href="${esc(`${SITE_ROOT}l/?u=${encodeURIComponent(attachment.url)}&h=AT${post.id.slice(2)}`)}" target="_blank" rel="nofollow noreferrer"><img class="${css.photo}" src="${photoSource(200)}" alt=""><span class="${css.linkDomain}">${esc(attachment.domain)}</span><span class="${css.linkTitle}">${esc(attachment.title)}</span></a>`;
  }
  return `<iframe class="${css.video}" title="ViewTube video player" src="${esc(`${context.frameOrigin}${SITE_ROOT}embed/${post.id}`)}" loading="lazy"></iframe>`;
}

/**
 * The reactions, comments and shares line, in the page's own words. A count
 * the post does not have is not drawn at all, so a post nobody reacted to has
 * no reactions element to read rather than an empty one.
 */
function countsMarkup(css: FeedClasses, reactions?: string, comments?: string, shares?: string): string {
  if (reactions === undefined && comments === undefined && shares === undefined) return "";
  const react = reactions === undefined ? "" : `<div class="${css.reactIcons}" role="button" tabindex="0" aria-label="See who reacted to this"><span role="img" aria-label="Like">${glyph("like", 18)}</span></div><span class="${css.reactCount}">${esc(reactions)}</span>`;
  const push = reactions === undefined ? ` style="margin-left:auto"` : "";
  const comment = comments === undefined ? "" : `<div class="${css.countButton}" role="button" tabindex="0" aria-expanded="false"${push}><span>${esc(comments)}</span></div>`;
  const share = shares === undefined ? "" : `<div class="${css.countButton}" role="button" tabindex="0" aria-haspopup="dialog"${comment === "" ? push : ""}><span>${esc(shares)}</span></div>`;
  return `<div class="${css.counts}">${react}${comment}${share}</div>`;
}

function actionsMarkup(css: FeedClasses, liked: boolean): string {
  const like = `<div class="${css.action}${liked ? ` ${css.actionActive}` : ""}" role="button" tabindex="0" aria-label="${liked ? "Remove Like" : "Like"}">${glyph("like", 18)}<span>Like</span></div>`;
  return `<div class="${css.actions}">${like}<div class="${css.action}" role="button" tabindex="0" aria-label="Leave a comment">${glyph("comment", 18)}<span>Comment</span></div><div class="${css.action}" role="button" tabindex="0" aria-label="Send this to friends or post it on your profile.">${glyph("share", 18)}<span>Share</span></div></div>`;
}

function sponsoredBody(ad: SponsoredUnit, context: UnitContext, key: string): string {
  const { css, seed } = context;
  const page = communityBySlug(ad.page);
  const out = esc(`${SITE_ROOT}l/?u=${encodeURIComponent(`https://${ad.domain.toLowerCase()}/`)}&h=AT${ad.id.slice(2)}`);
  const label = `<a class="${css.sponsoredLabel}" href="${esc(trackedHref("ads/about/", seed, key))}" data-lb="${key}-s"><span data-uid="${key}-s">${sponsoredLetters(seed, ad.id, css.spDecoy)}</span></a>`;
  const head = `<div class="${css.unitHead}"><a class="${css.avatar}" href="${out}" aria-hidden="true" tabindex="-1">${avatarGraphic(page.hue, 40)}</a><div><h3 class="${css.unitTitle}" data-uid="${key}-t"><span><a class="${css.metaLink}" href="${out}">${esc(page.name)}</a></span></h3><div class="${css.unitMeta}">${label}<span aria-hidden="true"> · </span>${audienceIcon("Shared with Public")}</div></div><div class="${css.unitMenu}" role="button" tabindex="0" aria-label="Actions for this post" aria-haspopup="menu" aria-expanded="false">${glyph("dots")}</div><div class="${css.unitHide}" role="button" tabindex="0" aria-label="Hide post">${glyph("cross", 16)}</div></div>`;
  const card = `<a class="${css.linkCard}" href="${out}" target="_blank" rel="nofollow noreferrer"><img class="${css.photo}" src="${photoSource(page.hue)}" alt=""><div class="${css.ctaRow}"><span><span class="${css.linkDomain}">${esc(ad.domain)}</span><span class="${css.linkTitle}">${esc(ad.headline)}</span></span><div class="${css.ctaButton}" role="button" tabindex="0">${esc(ad.cta)}</div></div></a>`;
  return `${head}${messageMarkup(ad.text, css, key, false)}${card}${actionsMarkup(css, false)}`;
}

function sharedBody(share: SharedUnit, context: UnitContext, key: string): string {
  const { css, seed } = context;
  const sharer = personBySlug(share.sharer);
  const page = communityBySlug(share.page);
  const sharerHref = esc(trackedHref(`people/${sharer.slug}/`, seed, key));
  const pageHref = esc(trackedHref(`pages/${page.slug}/`, seed, key));
  const head = `<div class="${css.unitHead}"><a class="${css.avatar}" href="${sharerHref}" aria-hidden="true" tabindex="-1">${avatarGraphic(sharer.hue, 40)}</a><div><h3 class="${css.unitTitle}" data-uid="${key}-t"><span><strong><a class="${css.metaLink}" href="${sharerHref}">${esc(sharer.name)}</a></strong></span></h3><div class="${css.unitMeta}"><span>${timeLink(css, seed, key, share.id, share.minutesAgo)}</span><span aria-hidden="true"> · </span>${audienceIcon("Shared with Friends")}</div></div><div class="${css.unitMenu}" role="button" tabindex="0" aria-label="Actions for this post" aria-haspopup="menu" aria-expanded="false">${glyph("dots")}</div><div class="${css.unitHide}" role="button" tabindex="0" aria-label="Hide post">${glyph("cross", 16)}</div></div>`;
  const original = `<div class="${css.sharedBox}"><div class="${css.unitHead}"><a class="${css.avatar}" href="${pageHref}" aria-hidden="true" tabindex="-1">${avatarGraphic(page.hue, 40)}</a><div><h4 class="${css.unitTitle}"><a class="${css.metaLink}" href="${pageHref}">${esc(page.name)}</a></h4><div class="${css.unitMeta}"><span>${timeLink(css, seed, `${key}-o`, `${share.id}o`, share.originalMinutesAgo)}</span><span aria-hidden="true"> · </span>${audienceIcon("Shared with Public")}</div></div></div><div class="${css.message}" dir="auto">${esc(share.originalText)}</div></div>`;
  return `${head}${messageMarkup(share.caption, css, key, false)}${original}${countsMarkup(css, share.reactions, share.comments)}${actionsMarkup(css, false)}`;
}

function suggestedBody(suggestion: SuggestedUnit, context: UnitContext, key: string): string {
  const { css, seed } = context;
  const community = communityBySlug(suggestion.community);
  const communityHref = esc(trackedHref(`${community.kind === "group" ? "groups" : "pages"}/${community.slug}/`, seed, key));
  const join = community.kind === "group" ? "Join group" : "Follow";
  const context_ = `<div class="${css.contextBar}"><span>Suggested for you</span><div class="${css.joinButton}" role="button" tabindex="0">${join}</div></div>`;
  const author = suggestion.author === undefined ? "" : `<span><a class="${css.metaLink}" href="${esc(trackedHref(`people/${suggestion.author}/`, seed, key))}">${esc(personBySlug(suggestion.author).name)}</a></span><span aria-hidden="true"> · </span>`;
  const head = `<div class="${css.unitHead}"><a class="${css.avatar}" href="${communityHref}" aria-hidden="true" tabindex="-1">${avatarGraphic(community.hue, 40)}</a><div><h3 class="${css.unitTitle}" data-uid="${key}-t"><span><a class="${css.metaLink}" href="${communityHref}">${esc(community.name)}</a></span></h3><div class="${css.unitMeta}">${author}<span>${timeLink(css, seed, key, suggestion.id, suggestion.minutesAgo)}</span><span aria-hidden="true"> · </span>${audienceIcon("Shared with Public")}</div></div><div class="${css.unitHide}" role="button" tabindex="0" aria-label="Hide post">${glyph("cross", 16)}</div></div>`;
  return `${context_}${head}${messageMarkup(suggestion.text, css, key, false)}${countsMarkup(css, suggestion.reactions, suggestion.comments)}${actionsMarkup(css, false)}`;
}

/** A post shown again: the reason on top, then the same post, with the same page, words and counts. */
function recapBody(recap: RecapUnit, context: UnitContext, key: string): string {
  const post = FEED_BEFORE_CAUGHT_UP.find((unit): unit is FeedPost => unit.kind === "post" && unit.id === recap.of);
  if (!post) throw new Error(`Recap ${recap.id} repeats no authored post`);
  return `<div class="${context.css.contextBar}"><span>${esc(recap.context)}</span></div>${postBody(post, context, key)}`;
}

function memoryBody(memory: MemoryUnit, context: UnitContext, key: string): string {
  const { css } = context;
  return `<div class="${css.unitHead}"><div><h3 class="${css.unitTitle}" data-uid="${key}-t">Memories</h3><div class="${css.unitMeta}">Your memories on Circleway</div></div></div><div class="${css.memoryCard}"><div class="${css.unitMeta}">${esc(MAYA.name)} · ${memory.yearsAgo} years ago</div><div class="${css.message}" dir="auto" data-ad-comet-preview="message" data-uid="${key}-m">${esc(memory.text)}</div><div class="${css.primaryButton}" role="button" tabindex="0">Share memory</div></div>`;
}

function peopleBody(context: UnitContext, key: string): string {
  const { css, seed } = context;
  const cards = PEOPLE_YOU_MAY_KNOW.map((entry) => {
    const person = personBySlug(entry.person);
    const href = esc(trackedHref(`people/${person.slug}/`, seed, key));
    return `<div class="${css.carouselCard}"><a class="${css.requestPhoto}" href="${href}" aria-hidden="true" tabindex="-1">${avatarGraphic(person.hue, 178)}</a><a class="${css.requestName}" href="${href}">${esc(person.name)}</a><span class="${css.muted}">${esc(entry.mutualLine)}</span><div class="${css.secondaryButton}" role="button" tabindex="0" aria-label="Add friend">Add friend</div></div>`;
  }).join("");
  return `<h3 class="${css.carouselTitle}" data-uid="${key}-t">People you may know</h3><div class="${css.carousel}">${cards}</div>`;
}

function reelsBody(context: UnitContext, key: string): string {
  const { css } = context;
  const tiles = [["Allotment hacks", "1.2M views", 120], ["Sourdough in 60s", "845K views", 30], ["Harbour at dawn", "2.1M views", 210], ["Bike rebuild", "96K views", 0]] as const;
  return `<h3 class="${css.carouselTitle}" data-uid="${key}-t">Reels and short videos</h3><div class="${css.carousel}">${tiles.map(([title, views, hue]) => `<a class="${css.reelTile}" href="${SITE_ROOT}reel/${hue}/" style="background:hsl(${hue} 40% 35%)"><span>${esc(title)}<br>${esc(views)}</span></a>`).join("")}</div>`;
}
