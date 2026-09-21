import { escapeHtml as esc } from "../../../html.js";
import type { RenderContext } from "../../../types.js";
import { clientScript } from "../client/index.js";
import { communityBySlug, FEED_BEFORE_CAUGHT_UP, MAYA, RIVERSIDE_DISCUSSION, TASK_GROUP, type FeedPost } from "../content/index.js";
import type { FeedState, PendingGroupPost } from "../types.js";
import type { FeedClasses } from "./classes.js";
import { longTexts, unitContextFor } from "./home.js";
import { avatarGraphic, glyph, SITE_ROOT } from "./parts.js";
import { baseConfig, shellContext, sitePage } from "./shell.js";
import { unitMarkup } from "./unit.js";

/** The groups Maya is a member of. Any other group's page offers Join instead of a composer. */
export const MEMBER_GROUPS: readonly string[] = [TASK_GROUP, "harbourside-runners", "old-town-bakers"];

const PENDING_NOTE = "Admins will review your post before it's shared with the group.";

/**
 * A group's page: cover, name and actions, tabs, then Maya's pending posts,
 * the composer, and the discussion.
 *
 * The composer is where `regrouped` differs. As shipped it is a "Write
 * something..." prompt -- the one control on the site with a test id, left
 * behind by the team that owns it -- with Anonymous post, Poll and
 * Feeling/activity beneath. After the redesign the prompt is gone and three
 * buttons stand in its place: Create post, Create poll and Create event.
 */
export function renderGroupPage(state: FeedState, context: RenderContext, slug: string): string | undefined {
  const group = communityBySlug(slug);
  if (group.kind !== "group") return undefined;
  const shell = shellContext(state, context, "groups");
  const { css } = shell;
  const member = MEMBER_GROUPS.includes(slug);
  const discussion = discussionFor(slug);
  const unitContext = unitContextFor(state, context);
  const units = discussion.map((post, index) => unitMarkup({ unit: post, position: index + 1 }, unitContext)).join("");
  const actions = member
    ? `<div class="${css.secondaryButton}" role="button" tabindex="0" aria-haspopup="menu">Joined &#x25BE;</div><div class="${css.primaryButton}" role="button" tabindex="0">+ Invite</div><div class="${css.secondaryButton}" role="button" tabindex="0">Share</div>`
    : `<div class="${css.primaryButton}" role="button" tabindex="0">Join group</div><div class="${css.secondaryButton}" role="button" tabindex="0">Share</div>`;
  const tabs = ["About", "Discussion", "Featured", "Events", "Media", "Files"].map((tab) => tab === "Discussion"
    ? `<a class="${css.tab} ${css.tabCurrent}" href="${SITE_ROOT}groups/${slug}/" aria-current="page">${tab}</a>`
    : `<a class="${css.tab}" href="${SITE_ROOT}groups/${slug}/${tab.toLowerCase()}/">${tab}</a>`).join("");
  const composer = !member ? `<div class="${css.card} ${css.aboutCard}">Join this group to post and comment.</div>`
    : state.mode === "regrouped"
      ? `<div class="${css.card} ${css.createRow}"><div class="${css.primaryButton}" role="button" tabindex="0">Create post</div><div class="${css.secondaryButton}" role="button" tabindex="0">Create poll</div><div class="${css.secondaryButton}" role="button" tabindex="0">Create event</div></div>`
      : `<div class="${css.card} ${css.composerCard}"><div class="${css.composerRow}"><a class="${css.avatar}" href="${SITE_ROOT}people/${MAYA.slug}/" aria-hidden="true" tabindex="-1">${avatarGraphic(MAYA.hue, 40)}</a><div class="${css.composerPrompt}" role="button" tabindex="0" data-testid="group-composer-prompt">Write something...</div></div><div class="${css.composerRow}" style="border-top:1px solid #e4e6eb;padding-top:8px"><div class="${css.composerOption}" role="button" tabindex="0">Anonymous post</div><div class="${css.composerOption}" role="button" tabindex="0">Poll</div><div class="${css.composerOption}" role="button" tabindex="0">Feeling/activity</div></div></div>`;
  const about = `<div class="${css.card} ${css.aboutCard}"><h2 class="${css.heading}">About</h2><p>Plot holders, the waiting list and friends of ${esc(group.name)}. Swaps, notices and the odd glut of courgettes.</p><p><strong>${esc(group.about.split(" · ")[0] ?? "")}</strong><br><span class="${css.muted}">Only members can see who's in the group and what they post.</span></p><p><strong>Post approval</strong><br><span class="${css.muted}">Admins review every new post before it appears in the group.</span></p></div>`;
  const main = `<div style="padding-top:56px"><div class="${css.groupHead}"><div class="${css.groupCover}"></div><h1 class="${css.groupName}">${esc(group.name)}</h1><p class="${css.groupMeta}">${esc(group.about)}</p><div class="${css.groupActions}">${actions}<div class="${css.iconButton}" role="button" tabindex="0" aria-label="More">${glyph("dots")}</div></div><nav class="${css.tabs}" aria-label="Group sections">${tabs}</nav></div><div class="${css.groupColumns}"><div role="main" style="display:grid;gap:16px;align-content:start">${pendingBoxMarkup(css, state, slug)}${composer}<h2 class="${css.heading}">Recent activity</h2><div class="${css.feed}" role="feed">${units}</div></div><div>${about}</div></div></div>`;
  const config = { ...baseConfig(shell, "group"), group: slug, groupName: group.name, regrouped: state.mode === "regrouped", texts: longTexts(discussion) };
  return sitePage(shell, `${group.name} | Circleway`, main, clientScript(context.runToken, config));
}

/**
 * Maya's posts in this group that are waiting for an admin, straight from the
 * server's state, or nothing when there are none. The page fetches this again
 * after every submission, so it never shows a post the server did not keep.
 */
export function pendingBoxMarkup(css: FeedClasses, state: FeedState, slug: string): string {
  const mine = state.pending.filter((entry) => entry.group === slug);
  if (mine.length === 0) return "";
  const items = mine.map((entry) => `<div><strong>${entry.kind === "poll" ? "Poll" : "Post"}</strong><p style="margin:0">${esc(entry.text)}</p></div>`).join("");
  return `<section class="${css.card} ${css.pendingBox}" data-testid="pending-posts"><h2 class="${css.heading}">Your pending posts</h2><p class="${css.muted}" style="margin:4px 0 8px">${esc(PENDING_NOTE)}</p>${items}</section>`;
}

/** The pending box's whole text for these submissions, exactly as the page's text reads. */
export function pendingBoxText(entries: ReadonlyArray<Pick<PendingGroupPost, "kind" | "text">>): string {
  return `Your pending posts${PENDING_NOTE}${entries.map((entry) => `${entry.kind === "poll" ? "Poll" : "Post"}${entry.text}`).join("")}`;
}

function discussionFor(slug: string): FeedPost[] {
  if (slug === TASK_GROUP) return [...RIVERSIDE_DISCUSSION];
  return FEED_BEFORE_CAUGHT_UP.filter((unit): unit is FeedPost => unit.kind === "post" && unit.group === slug);
}
