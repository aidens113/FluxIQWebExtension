import { escapeHtml as esc } from "../../../html.js";
import type { RenderContext } from "../../../types.js";
import { clientScript } from "../client/index.js";
import { FEED_BEFORE_CAUGHT_UP, feedPlanFor, MAYA, personBySlug, type FeedPost, type FeedUnit } from "../content/index.js";
import type { FeedState } from "../types.js";
import { avatarGraphic, glyph, photoSource, SITE_ROOT } from "./parts.js";
import { baseConfig, leftRail, rightRail, shellContext, sitePage } from "./shell.js";
import { renderAppPromo } from "./standalone.js";
import { cutText, unitMarkup, type UnitContext } from "./unit.js";

/**
 * The home feed as it first arrives: rails, stories, the composer prompt, and
 * a feed holding three skeleton cards and not one post. The posts come from
 * `feed/?cursor=N` once the script asks for them.
 *
 * Under `app-install`, until the visitor chooses to continue in the browser,
 * the home page is the app interstitial instead.
 */
export function renderHomePage(state: FeedState, context: RenderContext): string {
  if (state.mode === "app-install" && state.appPromo === "pending") return renderAppPromo(context);
  const shell = shellContext(state, context, "home");
  const { css } = shell;
  const stories = ["aisha-khan", "grace-liu", "dev-patel", "sofia-marin"].map((slug) => {
    const person = personBySlug(slug);
    return `<a class="${css.story}" href="${SITE_ROOT}stories/${slug}/" style="background:url('${photoSource(person.hue)}') center/cover"><span class="${css.storyName}">${esc(person.name)}</span></a>`;
  }).join("");
  const skeleton = `<div class="${css.skeleton}" aria-hidden="true"><div class="${css.skeletonLine}" style="width:45%"></div><div class="${css.skeletonLine}" style="width:90%"></div><div class="${css.skeletonLine}" style="width:70%"></div></div>`;
  const main = `<h1 style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Circleway</h1><div class="${css.layout}">${leftRail(shell)}<div class="${css.center}" role="main"><div class="${css.column}"><div class="${css.stories}"><a class="${css.story}" href="${SITE_ROOT}stories/create/" style="background:#fff;color:#050505">${glyph("photo", 28)}<span class="${css.storyName}" style="text-shadow:none">Create story</span></a>${stories}</div><div class="${css.card} ${css.composerCard}"><div class="${css.composerRow}"><a class="${css.avatar}" href="${SITE_ROOT}people/${MAYA.slug}/" aria-hidden="true" tabindex="-1">${avatarGraphic(MAYA.hue, 40)}</a><div class="${css.composerPrompt}" role="button" tabindex="0">What's on your mind, Maya?</div></div><div class="${css.composerRow}" style="border-top:1px solid #e4e6eb;padding-top:8px"><div class="${css.composerOption}" role="button" tabindex="0">${glyph("video")}Live video</div><div class="${css.composerOption}" role="button" tabindex="0">${glyph("photo")}Photo/video</div><div class="${css.composerOption}" role="button" tabindex="0">Feeling/activity</div></div></div><h2 data-uid="feed-h" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Feed posts</h2><div class="${css.feed}" role="feed" data-lb="feed-h">${skeleton}${skeleton}${skeleton}</div></div></div>${rightRail(shell)}</div>`;
  return sitePage(shell, "Circleway", main, clientScript(context.runToken, baseConfig(shell, "home")));
}

/** One load of the feed, as the page's script receives it. */
export type FeedBatch = { html: string; next: number | null; caughtUp: boolean; texts: Record<string, string> };

/**
 * Batch `cursor` of the feed for a state: the units' markup, the cursor of
 * the batch after it (or `null` at the end), whether "You're all caught up"
 * follows it, and the whole text of every long post in it, for "See more".
 */
export function feedBatch(state: FeedState, cursor: number, context: RenderContext): FeedBatch | undefined {
  const plan = feedPlanFor(state);
  const entries = plan.batches[cursor];
  if (!entries) return undefined;
  const unitContext = unitContextFor(state, context);
  return {
    html: entries.map((entry) => unitMarkup(entry, unitContext)).join(""),
    next: cursor + 1 < plan.batches.length ? cursor + 1 : null,
    caughtUp: cursor === plan.caughtUpAfter,
    texts: longTexts(entries.map(({ unit }) => unit)),
  };
}

/** What a unit renders with on this site for this state and run. */
export function unitContextFor(state: FeedState, context: RenderContext): UnitContext {
  return { css: shellContext(state, context, "home").css, seed: context.seed, frameOrigin: context.alternateOrigin ?? "", liked: new Set(state.liked) };
}

/** The whole text of each long post among `units`, keyed by post id, including the posts a recap repeats. */
export function longTexts(units: readonly FeedUnit[]): Record<string, string> {
  const posts = units.flatMap((unit): FeedPost[] => {
    if (unit.kind === "post") return [unit];
    if (unit.kind !== "recap") return [];
    return FEED_BEFORE_CAUGHT_UP.filter((candidate): candidate is FeedPost => candidate.kind === "post" && candidate.id === unit.of);
  });
  return Object.fromEntries(posts.filter((post) => cutText(post.text) !== undefined).map((post) => [post.id, post.text]));
}
