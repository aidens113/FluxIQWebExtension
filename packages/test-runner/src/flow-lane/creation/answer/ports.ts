import type { AttemptStandIn } from "@fluxiq-web-extension/test-contracts";
import type { LastingView, SiteBaseline } from "../site-change/index.js";
import type { CreatedFlowBuild } from "../build-proposal.js";
import type { CreatedFlowDatasetSource } from "../judgement.js";

/**
 * The answer turn the person saw, as Core's result record shapes it
 * (`AutomationStudioTaskResult`, `@fluxiq/contracts/automation`), restated to what is
 * judged because `fluxiq/automation` does not export it and this package does not
 * depend on the contracts package. `previewRows` is what reached the person, and is
 * compared, never kept.
 */
export type ShownAnswerTurn = Readonly<{
  kind: "rows" | "done_on_site" | "plain_answer" | "partial";
  rows?: Readonly<{ totalRows: number; truncated: boolean; previewRows: readonly Readonly<Record<string, unknown>>[] }>;
  acts: readonly Readonly<{ state: "landed" | "may_have_landed" | "undone" | "not_done" }>[];
  answerText?: Readonly<{ text: string }>;
}>;

/**
 * What reached the person. `turn` is the Answer lane's turn. `text` is what the chat
 * shows when there is no such turn yet, the words of the panel: today's product, in
 * which a right answer that was never shown is found out here. `null` is a chat that
 * could not be read at all, or showed nothing.
 */
export type ShownAnswer =
  | Readonly<{ form: "turn"; turn: ShownAnswerTurn }>
  | Readonly<{ form: "text"; text: string }>;

/** The port the Answer lane's turn is read through. The Lab's stand-in implements it until that lane lands. */
export type ChatAnswerPort = { readShownAnswer(): Promise<ShownAnswer | null> };

/** How the attempt ended, as far as the Lab can tell. The hard rule decides what `other` means. */
export type AttemptEndingFact = "finished" | "budget_out" | "stopped_by_person" | "other";

/**
 * Where an attempt's score is read from, on the attempt itself, before any reset:
 * its stored rows, the site's lasting view, what the chat showed. `standIns` names
 * every input that was scripted, and an empty list claims them all as the product's.
 */
export type CreatedFlowAnswerStage = Readonly<{
  /** The site as the attempt found it, read just before it acts. */
  readBaseline(): Promise<SiteBaseline>;
  readSiteView(): Promise<LastingView>;
  /** The attempt's stored rows, with no Flow run needed; `null` when it stored none anywhere the Lab can read. */
  readStoredRows(build: CreatedFlowBuild | undefined): Promise<CreatedFlowDatasetSource | null>;
  chat: ChatAnswerPort;
  /** Declared secret values: a shown answer holding one fails, and they are compared, never kept. */
  secretValues: readonly string[];
  standIns: readonly AttemptStandIn[];
}>;
