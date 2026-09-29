// The Current step tab: the detail the simple view's one sentence leaves out
// (UI audit, section 4). This is where the raw target -- a selector, a URL or a
// typed value -- and the raw failure message may appear; the simple view never
// shows them.

import type { RuntimeCommandStatus } from "../../shared/protocol";
import { pageHostname, stepSentence } from "../copy";
import { relativeTime } from "./time-copy";

/** One labelled line of the Current step tab. */
export type StepRow = { readonly label: "Step" | "Page element" | "Browser tab" | "Outcome" | "Started"; readonly value: string };

/** The rows for `runtime`, or undefined when no step has run yet. */
export function stepRows(runtime: RuntimeCommandStatus | undefined, now: number): StepRow[] | undefined {
  if (runtime === undefined || (runtime.state === "idle" && runtime.actionType === undefined && runtime.startedAt === undefined)) return undefined;
  const running = runtime.state === "running";
  return [
    { label: "Step", value: stepSentence(runtime, running ? "present" : "past") },
    { label: "Page element", value: present(runtime.target) ?? "None" },
    { label: "Browser tab", value: browserTab(runtime) },
    { label: "Outcome", value: outcome(runtime) },
    { label: "Started", value: runtime.startedAt === undefined ? "Not started" : relativeTime(runtime.startedAt, now) }
  ];
}

function browserTab(runtime: RuntimeCommandStatus): string {
  const hostname = pageHostname(runtime.url);
  const tab = runtime.tabId === undefined ? undefined : `Tab ${runtime.tabId}`;
  if (tab !== undefined && hostname !== undefined) return `${tab} · ${hostname}`;
  return tab ?? hostname ?? "None";
}

function outcome(runtime: RuntimeCommandStatus): string {
  if (runtime.state === "running") return "Still running";
  if (runtime.state === "idle") return "Not started";
  if (runtime.state === "succeeded") {
    const message = present(runtime.message);
    return message === undefined ? "Done" : `Done: ${message}`;
  }
  const reason = present(runtime.error) ?? present(runtime.message);
  return reason === undefined ? "Didn't work" : `Didn't work: ${reason}`;
}

function present(text: string | undefined): string | undefined {
  const trimmed = text?.trim();
  return trimmed === undefined || trimmed === "" ? undefined : trimmed;
}
