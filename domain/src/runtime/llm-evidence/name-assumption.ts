// A name this domain read as something other than what was written, said once
// more where a reader of the run can see it.
//
// ## The hole this closes
//
// The standing rule is that an unknown name a model writes -- a node, a
// parameter, a column -- resolves to its closest match rather than being
// refused, and that **a near match is an assumption and is recorded as one
// where a run's evidence is kept**. Two paths now make that guess and both
// compute the whole assumption:
//
// - `actions/extraction/field-match.ts`, on a literal request's own field keys
//   (`WebAutomationExtractListFieldAssumption`);
// - `plan-resolution/extraction/column-match.ts`, on the columns a detection
//   found (`WebExtractionColumnAssumption`).
//
// Neither reached any artifact. `plan-resolution/resolve-plan-node.ts` dropped
// it, so a Flow could be built on a guessed column and the run's record could
// not say a guess had been made -- which makes a wrong answer caused by a
// mis-resolved column indistinguishable from one caused by anything else. This
// module is the shape the fact travels in, and `capture.ts` declares the field
// it travels on.
//
// ## Why the resolver's own answer cannot carry it
//
// Core accepts a resolved plan-node answer with **exactly** `status` and
// `parameters` (`AS/runtime/llm/harness-options/plan-parameter-resolution.ts`:
// `exactKeys(answer, ["status", "parameters"])`), and anything else refuses the
// node as `bootstrap.parameter_resolution_invalid`. So a field added to that
// answer would not be dropped quietly -- it would refuse every resolved node of
// every plan. The assumption therefore leaves on the **tool execution result**
// beside `resultReason` and `nodeId`, which is the channel this domain already
// uses for a fact it computed and Core only carries.
//
// ## What may travel, and what may not
//
// A name, a word from a closed set, and a number. Every string is held to
// Core's own shape for a caller-supplied diagnostic --
// `/^[A-Za-z0-9_.:-]{1,100}$/`, the `ISSUE_CODE` that screens `resultReason` --
// which admits a column key and a parameter path and admits no whitespace, so
// no page sentence, no page text and no selector can be spelled in any member.
//
// That is the same argument `packages/test-contracts/src/extraction-read/read.ts`
// makes for publishing a read's field keys: the names here are already
// published in full under `authoredNodes[].parameters`, so this names a subset
// of what is in the bundle rather than a new class of string.
//
// **One assumption is deliberately not published**: a column named as a table
// **header** (`column:Unit price`) resolves by header, and a header is the
// page's own words. Its written name holds a space, fails the screen, and the
// entry is dropped rather than carrying page text into a bundle. A header
// written as one token still travels.
//
// This is not the packet the model is shown, and must not become it. A refusal
// that reaches the model quotes a model-chosen key by position rather than by
// name, precisely because such a key may have come from the page
// (`plan-resolution/issue-position.ts`); this is the record's channel, whose
// reader already has the authored parameters in front of them.

/** How a name found what it named, for a name that did not find it verbatim. */
export const WEB_LLM_NAME_ASSUMPTION_HOWS = ["normalized", "nearest"] as const;
export type WebLlmNameAssumptionHow = (typeof WEB_LLM_NAME_ASSUMPTION_HOWS)[number];

/**
 * One name resolved to something other than what was written: where it was
 * written, what was written, what it was read as, how, and with what score.
 *
 * The four facts are t142's and t149's own
 * (`WebAutomationExtractListFieldAssumption`, `WebExtractionColumnAssumption`),
 * in the same words, so the two paths' assumptions read as one thing. The
 * position is a dotted path from the node's parameters -- `extractList.fields.
 * price`, `extractList.where.0.field` -- because a name can be written in
 * several places and `written` alone does not say which.
 *
 * `normalized` is the same name in another casing or with other separators,
 * which is a spelling variant; `nearest` is a scored guess and is the one worth
 * a person's attention. `score` is name similarity in 0..1 as Core's matcher
 * reported it, before any shape tie-break, rounded to three places -- the
 * precision the measurements are recorded at, and no more, so a score cannot
 * become a channel of its own.
 */
export type WebLlmNameAssumption = {
  path: string;
  written: string;
  field: string;
  how: WebLlmNameAssumptionHow;
  score: number;
};

/** What a producer holds before this module screens it: the position as the path it was resolved at. */
export type WebLlmNameAssumptionSaid = {
  path: readonly (string | number)[];
  written: string;
  field: string;
  how: WebLlmNameAssumptionHow;
  score: number;
};

/**
 * How many assumptions one call may publish. Core's own bound on the codes one
 * refusal carries and on the refusals one trace row keeps, so a decision's
 * diagnostics stay one size.
 */
export const MAX_WEB_LLM_NAME_ASSUMPTIONS = 16;

/** Core's shape for a caller-supplied diagnostic string (`plan-parameter-resolution.ts` `ISSUE_CODE`). */
const DIAGNOSTIC_TEXT = /^[A-Za-z0-9_.:-]{1,100}$/u;
/** How precisely a similarity is published: the precision the measurements are stated at. */
const SCORE_PLACES = 3;

/**
 * The assumptions a call may publish, screened, in the order they were made.
 *
 * Absent rather than empty when nothing was assumed: a call that guessed at
 * nothing must not read as one that reported an empty list, and the field is
 * optional precisely so the two are different (`./present.ts`).
 */
export function webLlmNameAssumptions(said: readonly WebLlmNameAssumptionSaid[]): WebLlmNameAssumption[] | undefined {
  const published: WebLlmNameAssumption[] = [];
  for (const entry of said) {
    if (published.length === MAX_WEB_LLM_NAME_ASSUMPTIONS) break;
    const screened = screen(entry);
    if (screened) published.push(screened);
  }
  return published.length > 0 ? published : undefined;
}

/** A dotted path from the node's parameters, or `undefined` when any step of it cannot be spelled. */
export function webLlmNameAssumptionPath(path: readonly (string | number)[]): string | undefined {
  const written = path.map((step) => String(step)).join(".");
  return DIAGNOSTIC_TEXT.test(written) ? written : undefined;
}

function screen(entry: WebLlmNameAssumptionSaid): WebLlmNameAssumption | undefined {
  const path = webLlmNameAssumptionPath(entry.path);
  if (path === undefined || !DIAGNOSTIC_TEXT.test(entry.written) || !DIAGNOSTIC_TEXT.test(entry.field)) return undefined;
  if (!WEB_LLM_NAME_ASSUMPTION_HOWS.includes(entry.how)) return undefined;
  if (!Number.isFinite(entry.score) || entry.score < 0 || entry.score > 1) return undefined;
  // Written by name rather than spread: this is a wire value, and a spread
  // carries no excess-property check, so a renamed member would leave the wire
  // in silence (`./present.ts`). `present` is not used because every member is
  // required, and a required member given `undefined` would make the result a
  // lie rather than omit a field.
  return {
    path,
    written: entry.written,
    field: entry.field,
    how: entry.how,
    score: Number(entry.score.toFixed(SCORE_PLACES))
  };
}
