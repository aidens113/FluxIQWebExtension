// What an authored Flow node was told to do, as much of it as can be said
// without saying what a page or a person supplied.
//
// **Why a run bundle needs this at all.** Six live `product-catalog` extract
// runs failed identically -- `expectedRecords 8, observedRecords 23` -- and
// none of them could be diagnosed. The fixture serves eight products per page
// across three pages (`apps/scenario-lab/src/scenarios/product-catalog/
// listing.ts`), so 23 is a Flow that walked all three for an instruction asking
// for the first; but `snapshots/flow-lane.json` published only `flowShape`
// (node counts and output names), no Flow document is persisted under
// `test-runs/`, and nothing recorded whether the model had authored
// `pagination: { mode: "next", maxPages: 3 }`, `mode: "numbered"`, or a scroll
// with a scroll cap. A fix was shipped against an inferred cause and did not
// work. Two wrong diagnoses is what an unrecorded parameter costs, and this
// file is the recording.
//
// **This follows Core's convention rather than inventing one.** Core screens a
// Flow's step parameters for a repair's context in
// `AS/runtime/recovery/repair-context/parameter-screen.ts`, and every judgement
// that file makes about what a string *is* -- which keys name something rather
// than hold something, what a locator looks like, what a credential looks like,
// how a key is spelled for comparison -- is made here by calling Core's own
// exported screens (`automationStudioEvidenceKey`,
// `automationStudioExecutableTargetKey`, `automationStudioLocatorShapedText`,
// `screenAutomationStudioLlmEvidence`). Only the walk is restated, because
// `automationStudioScreenedNodeParameters` itself sits behind no public
// `fluxiq` subpath export and a run bundle is Lab-owned output rather than
// Core's repair context. Nothing here decides afresh what is safe.
//
// **Four kinds of value, and one of them is never carried.**
//
// - A number or a boolean is carried whole: `maxPages: 3`, `paginate: false`.
//   No page and no person is in them, and they are the answer to the question
//   these six runs could not ask.
// - A string is carried only where its *key* is a word for what something is
//   called rather than for what it holds (`mode`, `field`, `column`, `role`,
//   ...), and only in the top two levels, where the keys are the node
//   definition's own declared ids. Deeper than that the keys are whatever the
//   model wrote -- an extraction's field map is keyed by the column names it
//   chose -- so reading `name` there as a word for a name would carry one
//   column's page field and withhold the next for no reason a reader could
//   state. `text` and `value` are absent at every depth: on a typing step they
//   are the person's data.
// - A string that is an absolute URL is carried as its origin, whatever its
//   key. Where a navigation step was pointed is a fact about the Flow; the path
//   and query are where a page number, a search term and a session token live.
// - Everything else is withheld: the key keeps its place with `null` and the
//   path is recorded in `withheld`, so the *shape* of what a step ran with is
//   complete even where none of it could be carried. That is what puts an
//   extraction's column ids in front of a reader -- the field map's keys are
//   the columns it asked the page for -- without any column's selector.
//
// A withheld value is named rather than dropped, for the reason Core's omission
// list exists: a parameter that was screened out and a parameter the step never
// had must not read alike. That is the same confusion, one level down, that
// made these six runs undiagnosable.

import { AUTHORED_FLOW_NODE_BOUNDS } from "@fluxiq-web-extension/test-contracts";
import { automationStudioEvidenceKey, automationStudioExecutableTargetKey, automationStudioLocatorShapedText, screenAutomationStudioLlmEvidence } from "fluxiq/automation-studio";

/** What one node's authored parameters became. `withheld` never holds a value, only the path where one was. */
export type ScreenedNodeParameters = {
  /** What survived, by the key it was authored under. A key whose value did not survive keeps its place with `null`. */
  values: Record<string, unknown>;
  /** The dotted paths whose value was not carried, in the order they were met, each once. */
  withheld: string[];
};

/**
 * The keys whose string value names something rather than holds something.
 *
 * Core's list, kept as Core wrote it (`repair-context/parameter-screen.ts`).
 * Nothing here can tell a control's label from a person's typed text by looking
 * at either, so it does not try: it reads the key. A key that is not here has
 * its value withheld, which is the safe answer for a key nobody has thought
 * about yet.
 */
const NAME_KEYS: ReadonlySet<string> = new Set([
  "label", "name", "title", "caption", "heading", "placeholder", "arialabel", "accessiblename",
  "visibletext", "role", "implicitrole", "tagname", "kind", "mode", "op", "is", "key",
  "field", "fieldid", "column", "columnid", "status", "type", "unit",
]);

/** The deepest level at which a key is the node definition's vocabulary rather than the author's. */
const MAX_NAMED_KEY_DEPTH = 1;
/**
 * How far below a node's parameters this walks, Core's own number. The
 * contract's `AUTHORED_FLOW_NODE_BOUNDS.depth` is a looser backstop and
 * deliberately not this: it counts the written document, where an array costs
 * two levels rather than one, so a walk held to the contract's number could
 * still write a document the contract refuses.
 */
const MAX_DEPTH = 3;

/**
 * One node's authored parameters, screened.
 *
 * `deniedKeys` is the bound domain's declaration
 * (`WEB_LLM_DENIED_EVIDENCE_KEYS`), passed as declared. It is required for the
 * reason Core requires it: an absent declaration means nobody said what this
 * medium's raw payload is called, never "deny nothing", and a projection of a
 * node's parameters is exactly where that would matter.
 */
export function screenedNodeParameters(parameters: Readonly<Record<string, unknown>>, deniedKeys: readonly string[]): ScreenedNodeParameters {
  const denied = new Set(deniedKeys.map(automationStudioEvidenceKey));
  const withheld: string[] = [];
  const values = screenedObject(parameters, denied, withheld, "", { depth: 0, nameDepth: 0 });
  return { values, withheld: withheld.slice(0, AUTHORED_FLOW_NODE_BOUNDS.withheldPaths) };
}

/**
 * Where a value sits, in the two senses that matter. `depth` bounds the
 * recursion and counts every level, array levels included. `nameDepth` counts
 * only the levels whose keys are a node definition's own -- a list's index is
 * not a name, so an array does not advance it.
 */
type ScreenPosition = { depth: number; nameDepth: number };

function screenedObject(source: Readonly<Record<string, unknown>>, denied: ReadonlySet<string>, withheld: string[], prefix: string, at: ScreenPosition): Record<string, unknown> {
  const screened: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source).slice(0, AUTHORED_FLOW_NODE_BOUNDS.keysPerObject)) {
    const path = prefix ? `${prefix}.${key}` : key;
    // The medium's own word for its raw payload, or Core's word for something
    // a model could execute. Neither keeps its place: the key itself is the
    // finding, and it is recorded as withheld.
    if (denied.has(automationStudioEvidenceKey(key)) || automationStudioExecutableTargetKey(key)) {
      note(withheld, path);
      continue;
    }
    const carried = screenedValue(key, value, denied, withheld, path, at);
    screened[key] = carried === undefined ? null : carried;
  }
  return screened;
}

function screenedValue(key: string, value: unknown, denied: ReadonlySet<string>, withheld: string[], path: string, at: ScreenPosition): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") return screenedString(key, value, withheld, path, at);
  if (typeof value !== "object") return undefined;
  if (at.depth >= MAX_DEPTH) {
    note(withheld, path);
    return undefined;
  }
  if (Array.isArray(value)) {
    const items = value.slice(0, AUTHORED_FLOW_NODE_BOUNDS.itemsPerArray)
      .map((item, index) => screenedValue("", item, denied, withheld, `${path}[${index}]`, { depth: at.depth + 1, nameDepth: at.nameDepth }))
      .filter((item) => item !== undefined);
    // The count is the fact a reader wants -- how many columns, how many
    // steps -- and it survives even where no item did.
    return { count: value.length, ...(items.length ? { items } : {}) };
  }
  return screenedObject(value as Record<string, unknown>, denied, withheld, path, { depth: at.depth + 1, nameDepth: at.nameDepth + 1 });
}

/**
 * A string, carried only where it is a name, an origin, and neither a
 * credential nor a way to address an element.
 *
 * The locator check is Core's own, so a string Core would have rewritten to a
 * withheld marker is named as withheld here instead: a marker written in a
 * parameter's place reads as the value, which is the one way this record could
 * mislead the reader it exists to inform.
 */
function screenedString(key: string, value: string, withheld: string[], path: string, at: ScreenPosition): string | undefined {
  if (screenAutomationStudioLlmEvidence(value, []).secretShaped) {
    note(withheld, path);
    return undefined;
  }
  const origin = absoluteUrlOrigin(value);
  if (origin) return origin;
  const named = at.nameDepth <= MAX_NAMED_KEY_DEPTH && NAME_KEYS.has(automationStudioEvidenceKey(key));
  if (!named || value.length > AUTHORED_FLOW_NODE_BOUNDS.textLength || automationStudioLocatorShapedText(value)) {
    note(withheld, path);
    return undefined;
  }
  return value;
}

/**
 * The origin of an absolute http(s) URL, or nothing.
 *
 * Matched rather than parsed, as Core matches it. `new URL` throws on input it
 * will not take, and a caught throw answers exactly like text that was never a
 * URL -- the reading this whole record exists to keep apart. An authority
 * carrying userinfo (`https://user:pass@host`) does not match, so it is
 * refused rather than trimmed, because the thing being trimmed off would be a
 * credential.
 */
function absoluteUrlOrigin(value: string): string | undefined {
  const matched = /^(https?:\/\/[A-Za-z0-9._~-]+(?::\d{1,5})?)(?:[/?#]|$)/iu.exec(value);
  return matched?.[1];
}

function note(withheld: string[], path: string): void {
  if (path && withheld.length < AUTHORED_FLOW_NODE_BOUNDS.withheldPaths && !withheld.includes(path)) withheld.push(path);
}
