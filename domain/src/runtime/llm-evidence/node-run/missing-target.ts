// What a replay answers when a step's target is not on the page: the site
// remembers the step, or the draft no longer reaches the page it acted on.
//
// A dry run's reset is a navigation and nothing more (decision D1), so it runs
// on the state exploration left, and the two look the same from the target
// alone. Where the page stands tells them apart. Core sends every replayed and
// every checked step back with where it found the page (`replay.from`, written
// by `./replay.ts`), and this compares that with where the page stands now.
//
//   on the step's own page -- what the site remembers looks like. A step that
//     is run again answers `remembered`: the consent banner a decline answered
//     stays answered, the sign-in wall a guest passed stays passed, a cart the
//     real order emptied has no "Continue to checkout" (t195-w19a/b/d/e). A
//     step that is only checked answers `present`, its effect already in place
//     (`./verify.ts`). Both pass: the Flow keeps the step, because a fresh site
//     still needs it.
//   anywhere else, or where the page could not be read -- `unreproducible`:
//     the draft's earlier steps no longer reach the step's page (run 18,
//     `run-munpwa5r-e7aefe04`). It blocks, unless Core asks the step again on
//     its own page (`AS/runtime/flow-draft/site-memory.ts`).
//
// A checked step's target that is there and withdrawn itself -- hidden while
// everything around it is shown -- is read the same way (`./verify.ts`). One
// hidden inside a closed container never reaches this: that is a step the Flow
// cannot take, and the check answers `failed` (`./hidden-target.ts`).
//
// The same page by location is not proof: two states can share a path. It is
// the evidence this domain has without acting, and it is the same test for both
// kinds of step.

import type { JsonObject } from "fluxiq/core";
import type { WebLlmEvidenceToolExecution } from "../capture";
import { isJsonRecord } from "../untrusted-json";
import { WEB_NODE_REPLAY_RESULT_CODES, webNodeReplayAnswerOnPage, webNodeReplayPage, type WebNodeReplayFacts } from "./replay-answer";
import type { WebNodeRun } from "./context";

/**
 * Answer a step whose target is not on the page, with the page taken now.
 *
 * `kind` is what Core asked: `step` runs the step again, and its command went
 * out (`acted`, so the page is not also said to be what it found); `verify`
 * only checked it. `failure` is the client's own word for the miss, said on an
 * unreproducible replay as it always was. `shown` is how a checked step's
 * target is missing: `gone` from the page, or `withdrawn` -- there and hidden
 * itself, which a replayed step never reports.
 */
export async function webNodeReplayMissingTarget(
  run: WebNodeRun,
  kind: "step" | "verify",
  about: WebNodeReplayFacts,
  failure?: string,
  shown: "gone" | "withdrawn" = "gone"
): Promise<WebLlmEvidenceToolExecution> {
  const page = await webNodeReplayPage(run);
  const actedOn = actedOnLocation(run.request.value);
  const replayed = kind === "step";
  const withdrawn = !replayed && shown === "withdrawn";
  const found = replayed ? undefined : withdrawn ? "hidden" : "missing";
  if (page && actedOn !== undefined && page.evidence.location === actedOn) {
    return webNodeReplayAnswerOnPage(run, page, {
      code: replayed ? WEB_NODE_REPLAY_RESULT_CODES.remembered : WEB_NODE_REPLAY_RESULT_CODES.present,
      said: replayed
        ? "the step's target is gone from the page it acted on, which is how a site that remembers the step looks; the step stays in the Flow"
        : withdrawn
          ? "the step's target is hidden on the page it acted on while everything around it is shown, which is how its effect already in place looks; it was not run"
          : "the step's target is gone from the page it acted on, which is how its effect already in place looks; it was not run",
      acted: false,
      ok: true,
      // A step that passed refused nothing, so it says no reason.
      about: { resultReason: undefined, nodeId: about.nodeId, assumed: about.assumed },
      found
    });
  }
  return webNodeReplayAnswerOnPage(run, page, {
    code: WEB_NODE_REPLAY_RESULT_CODES.unreproducible,
    said: replayed
      ? `the step did not run (${failure ?? "target_not_found"})`
      : withdrawn
        ? "the step's target is hidden, and this is not the page it acted on; it was not run"
        : "the step's target is not on the page, and this is not the page it acted on; it was not run",
    acted: replayed,
    about,
    found
  });
}

/** Where the step found the page, as this domain wrote it on the step (`./replay.ts`), and Core sent it back. */
function actedOnLocation(value: JsonObject): string | undefined {
  const from = isJsonRecord(value.from) ? value.from : undefined;
  return typeof from?.location === "string" && from.location ? from.location : undefined;
}
