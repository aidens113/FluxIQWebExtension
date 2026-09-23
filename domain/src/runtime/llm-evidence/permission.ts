// Asking Core whether an action the model declared may be taken.
//
// The consequence classes are what the model says its own action does -- the
// press it is about to make while exploring, or the step it writes into the
// Flow. They are never FluxIQ's reading of what a control looks like: the user's
// rule is that nothing is refused on FluxIQ's own judgement of a control, and
// the one thing that gates a lasting act is his instruction or his grant. Core
// holds both (`AS/runtime/action-permissions/`), reads the instruction for what
// it asks for, and answers; when the answer is no it has already raised the
// request that goes to the person, so this module only reports the refusal.
//
// **An action that only reads is never gated, whatever it declared.** The
// model's word is the authority on what a press means on this page; it is not
// the authority on whether the action acts at all, and this domain already
// knows that from its own safety table. On 2026-09-23 a build was told to
// collect a page of products into a table, ran the list-reading node, declared
// `create_new` for it because a dataset felt like something new, and was
// refused -- so FluxIQ stopped and asked a person for permission to read the
// page the instruction told it to read (`run-mueozmp8-348a2057`: 21 provider
// calls, 233,440 tokens, no Flow). The instruction is the authority: if it says
// to read the list, reading the list is the work. So `effect` travels with
// every declaration, and Core disregards the classes an observing action named.
//
// An action that declares no lasting consequence has nothing to be permitted:
// moving about, opening, ticking a row are undone by looking away. It is still
// put to Core, which is the change of 2026-09-22 and is not a formality. Saying
// `[]` is an answer, and until then this module returned `no_consequence`
// without calling the check at all -- so every press in four measured live
// builds, including the one that scheduled a public post, was invisible to Core
// and what each step had declared could only be deduced from the absence of a
// refusal. Core now reads the empty answer, records it against the action, and
// permits it. A declaration that is not a list of Core's classes is not a
// declaration at all, and no permission is asked for something nobody could
// read. Without a check to ask -- a caller that did not pass Core's -- a
// declared consequence is refused, never taken, and an empty one stands,
// because refusing it would make honesty the one answer that cannot be given.
//
// **A refusal is reported with what Core said about it.** The standing product
// rule is that a blocked action is put to the person rather than quietly
// refused, so the two refusals here are not the same event and this module
// stopped flattening them into one word on 2026-09-22. Core answering "no" has
// *already* raised a request the person will see, and says which classes are
// missing and which request carries them; a caller with no check to pass has
// raised nothing, and there is nobody to ask at all. `requestId` is what tells
// the two apart, and both it and `missing` travel into the refusal the model is
// given (`./press.ts`, `./tool-rejection.ts`), so neither the model nor a trace
// has to guess which of them happened.

import type { AutomationStudioActionConsequence, AutomationStudioActionPermissionCheck } from "fluxiq/automation-studio";
import { isAutomationStudioActionConsequence } from "fluxiq/automation-studio";

/**
 * How an action a model declared stands: nothing to ask, asked and allowed,
 * refused, or unreadable.
 *
 * `refused` always means: do not take it. `missing` is the classes this run
 * does not hold, in Core's own words, and `requestId` names the request Core
 * raised for the person -- `null` where there was no check to ask, so nothing
 * was raised and nobody can answer it.
 */
export type WebActionPermission =
  | { kind: "no_consequence" }
  | { kind: "permitted" }
  | { kind: "refused"; missing: readonly AutomationStudioActionConsequence[]; requestId: string | null }
  | { kind: "invalid" };

/**
 * `control.name` must be the words the model was shown for the control -- Core
 * carries it to the person only when it can find it in evidence already shown.
 * `kind` is one plain word for what the control is; `verb` what the action does to it.
 *
 * `effect` is the one field here that is not the model's word: it is what this
 * domain knows about the action from its own safety table
 * (`actions/effect.ts`), and Core reads it as the fact that an action which
 * only looks at the page cannot have done anything lasting, whatever the model
 * declared for it. Every caller states it, because a caller that forgot would
 * be gating a read.
 */
export async function webActionPermission(input: {
  check: AutomationStudioActionPermissionCheck | undefined;
  declared: unknown;
  control: { name: string | undefined; kind: string };
  verb: string;
  effect: "observe" | "mutate";
}): Promise<WebActionPermission> {
  if (input.declared === undefined) return { kind: "no_consequence" };
  if (!Array.isArray(input.declared) || input.declared.length > 10 || !input.declared.every(isAutomationStudioActionConsequence)) return { kind: "invalid" };
  const declared: readonly AutomationStudioActionConsequence[] = input.declared;
  // Nobody to ask, so the whole declaration is what is missing: none of it was
  // put to anyone. An empty one asks for nothing, so there is nothing to miss,
  // and neither has a read: nothing it named could outlast it, so refusing it
  // would be refusing the instruction's own work with nobody able to allow it.
  if (input.check === undefined) return declared.length && input.effect !== "observe" ? { kind: "refused", missing: declared, requestId: null } : { kind: "no_consequence" };
  const name = boundedName(input.control.name) || `an unlabelled ${input.control.kind}`;
  const verdict = await input.check({ consequences: declared, control: { name, kind: input.control.kind }, verb: boundedVerb(input.verb), effect: input.effect });
  if (verdict.permitted) return { kind: "permitted" };
  return { kind: "refused", missing: verdict.missing, requestId: verdict.requestId };
}

/**
 * The control's name as Core's reader will take it: trimmed, and no longer than
 * the reader allows. Core withholds a name it cannot find in evidence already
 * shown, so cutting a long one here costs nothing a person would have seen.
 */
function boundedName(name: string | undefined): string {
  return (name ?? "").replace(/\s+/gu, " ").trim().slice(0, 2_000);
}

/**
 * The verb as Core's reader will take it: at most two plain lowercase words.
 *
 * Bounded here rather than left to throw, because the verb is what a sentence
 * shown to a person reads as -- presentation, not authority -- and a caller
 * naming its action from a node label ("Wait For Selector") would otherwise
 * fail the action outright over three words. Nothing about the declaration's
 * classes is softened: an unreadable class still throws, and the action fails.
 */
function boundedVerb(verb: string): string {
  const words = verb.toLowerCase().replace(/[^a-z ]+/gu, " ").split(/\s+/u).filter((word) => word.length >= 2 && word.length <= 20);
  return words.slice(0, 2).join(" ") || "run";
}
