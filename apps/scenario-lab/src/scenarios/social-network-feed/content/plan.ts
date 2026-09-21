import type { CreatedPost, FeedState } from "../types.js";
import { RIVERSIDE_DISCUSSION } from "./discussion.js";
import { MAYA } from "./people.js";
import { FEED_AFTER_CAUGHT_UP, FEED_BEFORE_CAUGHT_UP, QUIET_FEED_UNITS, type FeedPost, type FeedUnit } from "./units.js";

/** How many units one load of the feed brings in, the first included. */
export const BATCH_SIZE = 5;

/** One unit where it sits in the feed. `position` is its `aria-posinset`, counted from 1 over the whole feed. */
export type FeedEntry = { unit: FeedUnit; position: number };

/**
 * The feed a state produces, as the batches the page loads one scroll at a
 * time. `caughtUpAfter` is the index of the batch the "You're all caught up"
 * marker follows; every batch after it is what the site offers once there is
 * nothing new.
 */
export type FeedPlan = { batches: FeedEntry[][]; caughtUpAfter: number };

type PlanInput = Pick<FeedState, "mode" | "created" | "trashed" | "hidden">;

/**
 * The feed for a state: the rendering's units, Maya's newly created posts on
 * top, and nothing she moved to her trash or hid. Positions are counted after
 * those changes, the way a server numbers the feed it is about to send, so a
 * reload after deleting a post renumbers everything beneath it.
 */
export function feedPlanFor(state: PlanInput): FeedPlan {
  const removed = new Set([...state.trashed, ...state.hidden]);
  const created = [...state.created].reverse().map(createdPostUnit);
  const before = [...created, ...(state.mode === "quiet-feed" ? FEED_BEFORE_CAUGHT_UP.slice(0, QUIET_FEED_UNITS) : FEED_BEFORE_CAUGHT_UP)]
    .filter((unit) => !removed.has(unit.id));
  const after = FEED_AFTER_CAUGHT_UP.filter((unit) => !removed.has(unit.id));
  let position = 0;
  const number = (unit: FeedUnit): FeedEntry => ({ unit, position: (position += 1) });
  const beforeBatches = chunk(before.map(number), BATCH_SIZE);
  const afterBatches = chunk(after.map(number), 2);
  return { batches: [...beforeBatches, ...afterBatches], caughtUpAfter: beforeBatches.length - 1 };
}

/** A post the run created, as the feed renders it: Maya's, stamped with the site's fixed "now". */
export function createdPostUnit(created: CreatedPost): FeedPost {
  return { kind: "post", id: created.id, author: MAYA.slug, minutesAgo: 0, audience: created.audience, text: created.text };
}

/**
 * Any post the site can show on its own page: the feed's, the group's, and
 * the run's own. A shared, sponsored or suggested unit has no page of its own
 * here, as on the real site where it links out instead.
 */
export function findPost(state: PlanInput, id: string): FeedPost | undefined {
  if (state.trashed.includes(id)) return undefined;
  const everything: readonly FeedUnit[] = [...state.created.map(createdPostUnit), ...FEED_BEFORE_CAUGHT_UP, ...RIVERSIDE_DISCUSSION];
  return everything.find((unit): unit is FeedPost => unit.kind === "post" && unit.id === id);
}

function chunk<TValue>(values: readonly TValue[], size: number): TValue[][] {
  const chunks: TValue[][] = [];
  for (let index = 0; index < values.length; index += size) chunks.push(values.slice(index, index + size));
  return chunks;
}
