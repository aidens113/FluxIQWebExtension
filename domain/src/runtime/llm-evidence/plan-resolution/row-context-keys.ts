// The key under which a web step's argument carries the row its control was
// found in: `element.context.record`, the card's own words, which
// `./element-identity.ts` writes from the packet and the extension's record
// gate presses only inside (`apps/extension/src/content/identity/record.ts`).
//
// A step repeated over another step's rows is given each kept row in turn
// (`../../../output-nodes/native-runtime.ts`, `scopedToRow`), which replaces
// that record, so the row the step was built on is only its template. Core
// leaves the template out of what it tells the judge a repeated step acts on
// (live run `run-murwcaj0-40e56557`, J1: "one remembered target repeated"),
// but Core names no web key, so this domain declares it to Core as
// `rowContextKeys` (`../tools.ts`), as it declares `deniedEvidenceKeys`.

/** The keys of a step's argument that hold the row its control was found in. */
export const WEB_LLM_ROW_CONTEXT_KEYS: readonly string[] = Object.freeze(["record"]);
