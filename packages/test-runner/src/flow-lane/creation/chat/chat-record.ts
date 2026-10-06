/**
 * How a Flow build started from the extension's chat window went, as the build
 * record keeps it: identifiers, places in the thread, closed words and counts,
 * and FluxIQ's own last words about the instruction (`said`). Never what the
 * person typed.
 *
 * - `conversationId`: the chat thread the extension opened in Core and sent
 *   the instruction to.
 * - `panelInput`: how the panel was typed into -- Playwright's trusted input,
 *   or script in the panel's own document (`panel-driver.ts`).
 * - `personTurn`, `answerTurn`, `resultTurn`: places in that thread of the
 *   instruction, of FluxIQ's answer to it, and of the build's result.
 * - `readWithoutModel`: FluxIQ said in its answer that it matched the words
 *   itself because the model could not be used; `null` when it never answered.
 * - `became`: `build` when FluxIQ started a Flow build from the instruction,
 *   `no_build` when it answered without starting anything, `other_capability`
 *   when it ran something else (`otherCapability` names it).
 * - `ending`: `created` when the chat built the Flow and put the steps into it,
 *   `awaiting_permission` when the build finished still waiting on a question,
 *   `failed` for any other result, `no_result` when none arrived in time.
 * - `asks`: the questions the thread carried, by kind.
 * - `secondsToEnding`: from the instruction being sent to the build's result.
 * - `said`: FluxIQ's own last word about the instruction in the thread, whole
 *   -- the build's result turn, or its answer when it started no build --
 *   on every ending; `null` only when neither arrived. It used to travel on a
 *   failure only, so a created ending kept no record of what FluxIQ told the
 *   person (live run `run-musp8nz1-dbd3905a`, cause R1). The evidence bundle
 *   screens what it writes for secrets, as it does every failure message.
 */
export type CreatedFlowChatRecord = Readonly<{
  conversationId: string;
  panelInput: "trusted" | "view-dom";
  personTurn: number;
  answerTurn: number | null;
  resultTurn: number | null;
  readWithoutModel: boolean | null;
  became: "build" | "no_build" | "other_capability";
  otherCapability?: string;
  ending: "created" | "awaiting_permission" | "failed" | "no_result";
  asks: Readonly<{ permission: number; personCheck: number; other: number }>;
  secondsToEnding: number | null;
  said: string | null;
}>;
