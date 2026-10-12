// One library call as the draft writes it down: what the Flow's step keeps
// (`ranWith`) and what the model may be shown back (`input`).
//
// Its own file because two statements are built from it and must agree: the
// step a live run made (`./run.ts`) and the step a written call made
// (`./written-step.ts`, t252). A written step whose `ranWith` was spelled
// differently from a run one would be a step the test and the Flow read
// differently.

import type { JsonObject, JsonValue } from "fluxiq/core";
import { withoutWebLlmDeniedKeys } from "../denied-keys";
import { present } from "../present";
import { isJsonRecord } from "../untrusted-json";

/** The parameter a list read names its list in, kept as a handle (`webNodeFlowParameters`). */
const EXTRACTION_SLOT = "extractList";
/** The slots a handle is written in (`./run.ts`), and every slot a step names its element in. */
const HANDLE_SLOTS = ["target", "selector", "element"];
const ELEMENT_SLOTS: readonly string[] = [...HANDLE_SLOTS, "visualTarget"];

/**
 * The parameters the Flow's step keeps: resolved, except for the list an
 * extraction reads.
 *
 * An element is kept resolved because a handle names a control on a page as it
 * was, and a page that re-renders stops having it. A detected list is the other
 * way round: its handle belongs to the Flow rather than to a page, and the plan
 * resolver *refuses* a literal request outright once a list has been detected,
 * because a model that was shown a handle and wrote selectors instead can only
 * have guessed them. So the handle is what is written down, and it is resolved
 * again when the plan is assembled. Live, keeping the resolved request instead
 * had a build refused `web.handle.extraction_required` twenty-three times for
 * a fault in what Core had written down rather than in anything the model
 * wrote (`run-mudakzor-ec549d9d`).
 */
export function webNodeFlowParameters(written: JsonObject, ran: JsonObject): JsonObject {
  return written[EXTRACTION_SLOT] === undefined ? ran : { ...ran, [EXTRACTION_SLOT]: written[EXTRACTION_SLOT] };
}

/**
 * The call as the model may be shown it again: its own words, with every key
 * the domain denies removed (`../denied-keys.ts`).
 *
 * **A call that named its element by handle is kept naming it by that handle
 * alone (t439).** Its `selector`, `element` and `visualTarget` -- the saved
 * step's address and fingerprint a rerun merged under the handle -- are left
 * out rather than screened. Screened, the saved element came back without its
 * selector, and a rerun of the step from this copy was read as an element the
 * model had written and refused (`run-mv4912r9-53b05a51`, t942 and t870). The
 * address and the fingerprint stay in what the Flow keeps (`ranWith`), and a
 * rerun from this copy names the control by its handle, as every call of the
 * model does.
 */
export function webNodeShownCall(value: JsonObject, parameters: JsonObject): JsonObject {
  return withoutWebLlmDeniedKeys(webNodeCall(value, byHandleOnly(parameters)));
}

/** The parameters, with the element slots beside a handle left out; unchanged for a call naming no handle. */
function byHandleOnly(parameters: JsonObject): JsonObject {
  const slot = HANDLE_SLOTS.find((each) => {
    const named = parameters[each];
    return isJsonRecord(named) && Object.hasOwn(named, "handle");
  });
  if (slot === undefined) return parameters;
  const out: JsonObject = {};
  for (const [key, item] of Object.entries(parameters)) if (key === slot || !ELEMENT_SLOTS.includes(key)) out[key] = item;
  return out;
}

/**
 * One library call, written by name: the node, its parameters and what the
 * call said running it would lastingly do.
 *
 * Never stripped. This is what the Flow's step is built from, and a web step
 * runs on a selector by necessity; the declaration is applied to what the model
 * is *shown* instead (`webNodeShownCall`). Nothing else of the call rides
 * along: not `write`, so a written step runs live when the test sends it.
 *
 * **`consequences` is written only when the call carried one.** Until t194-w35
 * a call with none was written back with `consequences: null`. Core takes this
 * as the step's input (`llm/evidence-loop/call-record.ts`), a rerun is a merge
 * patch over that input that never names the key, and the permission check
 * read the `null` as an unreadable declaration -- so live run 11's re-author had
 * sixteen reruns of a read refused `consequences_unreadable` for a word nobody
 * wrote (`run-muq4oaof-464f5bce`). A `null` that arrives is dropped the same
 * way, so a call already stored with one stops carrying it from its next run.
 */
export function webNodeCall(value: JsonObject, parameters: JsonObject): JsonObject {
  return present<{ node: JsonValue; parameters: JsonObject; consequences?: JsonValue }>({
    node: value.node ?? null,
    parameters,
    consequences: value.consequences === null ? undefined : value.consequences
  }) as unknown as JsonObject;
}
