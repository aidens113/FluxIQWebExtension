// What one node call was, accumulated as `../run.ts` proceeds, so a refusal
// raised at any point records the same facts a success does. Split out of
// `../run.ts` when that file reached its line budget (t1096): the record is
// one thing, written by the run and read by its refusal and its robot-check
// statement, and it had grown a field per concern (`found`, `witness`,
// `standing`, `attempts`, `turns`).

import type { JsonObject } from "fluxiq/core";
import type { WebLlmNameAssumption } from "../../name-assumption";
import type { WebLlmSnapshotBinding } from "../../sanitize";
import type { WebNodeReplayStatement } from "../replay";

/**
 * What one call was, accumulated as the call proceeds, so a refusal raised at
 * any point records the same facts a success does.
 *
 * `assumed` is set once the resolution has run and then stands for every
 * refusal after it -- a missing declaration, a permission the person has not
 * given, another origin, and the page's own failure, which arrives as an
 * exception caught outside the block the resolution ran in. Threading it
 * through each of those call sites instead would mean the one site somebody
 * forgot silently lost the guess, which is the shape of defect this field
 * exists to close.
 */
export type WebNodeCallRecord = {
  actionId?: string;
  effect?: "observe" | "mutate";
  proposes?: boolean;
  call?: JsonObject;
  parameters?: JsonObject;
  status?: string;
  assumed?: WebLlmNameAssumption[] | undefined;
  /**
   * The page as the call found it, once it has been read: the state a refusal
   * says it found (`stateDigests.before`), and, for a refusal raised before the
   * node's command went out, the state it left as well.
   */
  found?: WebLlmSnapshotBinding | undefined;
  /** The node's command has gone to the page. From here a refusal cannot say the page is as it was found; only a page captured afterwards says what the call left. */
  acted?: true;
  /** The handle a lasting act on the page it stays on named, set as its command goes out: a robot check met after that still records the act's pre-act witness (t877). */
  witness?: string | undefined;
  /**
   * The step as a succeeded call of this node would have stated it, written
   * just before its command goes out: what the model may be shown (`input`),
   * what the Flow keeps (`ranWith`), and what a replay needs (`replay`).
   *
   * Read only when the command met a robot check (`personNeeded`). Core then
   * asks the person, and on Continue the call stands with this statement --
   * the navigation or press did happen, and the person cleared what stood
   * behind it -- so it is the same statement a success would have made
   * (`personDraft`).
   */
  standing?: { input: JsonObject; ranWith: JsonObject; replay: WebNodeReplayStatement; control: string | undefined; reads: string | undefined };
  attempts?: number; // how many times the command went out, Core's default retries included (`../retries/`)
  /**
   * The detected lists, by item selector, whose page the command turns: a Next
   * page step's own, or those whose detected Next a press presses
   * (`../list-pages/turned-lists.ts`, t1096). Set as the command goes out.
   */
  turns?: readonly string[];
};
