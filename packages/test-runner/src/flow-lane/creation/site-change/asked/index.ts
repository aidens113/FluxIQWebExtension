// What each realistic task asks a site to change, once, by act. Private to the Lab:
// never shown to a model, and never the task's words. Filled from the honest path
// each task's own recording script walks (`attempt-lane/audit-asked-changes.ts`).
import { ASKED_TABLE } from "./table.js";

/** One lasting act a task asks for: its name, as a report says it, and what the site's lasting view must move by. */
export type AskedAct = Readonly<{ name: string; change: Readonly<Record<string, number>> }>;

/** Everything a task asks a site to change. No acts means it asks for none, so any lasting change is an unasked one. */
export type AskedChange = Readonly<{ acts: readonly AskedAct[]; change: Readonly<Record<string, number>> }>;

export const ASKED_CHANGES: Readonly<Record<string, AskedChange>> = Object.freeze(Object.fromEntries(Object.entries(ASKED_TABLE).map(([taskId, acts]) => [taskId, Object.freeze({
  acts,
  change: Object.freeze(Object.assign({}, ...acts.map((act) => act.change)) as Record<string, number>),
})])));

/** What `taskId` asks for; `undefined` for a task the table does not hold, which the oracle reports rather than guesses. */
export function askedChangeOf(taskId: string): AskedChange | undefined {
  return Object.hasOwn(ASKED_CHANGES, taskId) ? ASKED_CHANGES[taskId] : undefined;
}
