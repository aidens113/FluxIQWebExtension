import type { RenderContext, ScenarioRouteResponse } from "../../../types.js";
import { BRANCHES, TEAM_BATCH_SIZE, teamCardsFor } from "../data/index.js";
import { siteClasses } from "../styles.js";
import type { CompanyWebsiteState } from "../types.js";
import { personCard } from "./person-card.js";

/** Two batch requests closer together than this are refused. */
export const TEAM_RATE_WINDOW_MS = 900;
/** What a refused request is told to wait, in seconds. */
export const TEAM_RETRY_AFTER_S = 2;

/**
 * One batch of the team grid, as the grid's script fetches it: up to eight
 * cards from `offset` for a filter, and whether more follow in `x-has-more`.
 *
 * The endpoint rate-limits the way a small site's hosting plan does: a second
 * request inside `TEAM_RATE_WINDOW_MS` of the last gets `429` and a
 * `Retry-After`. The page's own script waits and asks again, so a visitor who
 * waits is never the worse for it; only a client that hammers the endpoint is
 * slowed.
 */
export function teamBatch(state: CompanyWebsiteState, query: URLSearchParams, context: RenderContext, now: number): ScenarioRouteResponse {
  const branch = query.get("branch") ?? "all";
  const offset = Number(query.get("offset") ?? "0");
  if ((branch !== "all" && !BRANCHES.some(({ id }) => id === branch)) || !Number.isSafeInteger(offset) || offset < 0) return { status: 400, body: "" };
  if (state.team.batchRequests > 0 && now - state.team.lastBatchAtMs < TEAM_RATE_WINDOW_MS) {
    return { status: 429, headers: { "retry-after": String(TEAM_RETRY_AFTER_S) }, body: "", mutation: { operation: "throttle-team-batch" } };
  }
  const c = siteClasses(context.seed);
  const cards = teamCardsFor(branch);
  const batch = cards.slice(offset, offset + TEAM_BATCH_SIZE);
  return {
    status: 200,
    headers: { "x-has-more": String(offset + batch.length < cards.length) },
    body: batch.map((card) => personCard(c, card)).join(""),
    mutation: { operation: "record-team-batch", payload: { atMs: now } },
  };
}
