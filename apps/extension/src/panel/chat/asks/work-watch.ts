// Whether a task is working or waiting on the person, which is when nothing may
// ask for a PIN. It reads what the panel is told of FluxIQ's live activity. Until
// the first answer it says yes: not knowing never opens a PIN dialog.

import type { ChatActivityPort } from "@fluxiq/ui-components";

/** The watch: `working` is read at each press and each drawing of a question. */
export type WorkWatch = { working(): boolean };

/** Starts watching `activity`, for as long as the panel lives. */
export function createWorkWatch(activity: Pick<ChatActivityPort, "read" | "subscribe">): WorkWatch {
  let working = true;
  let heard = false;
  activity.subscribe((state) => {
    heard = true;
    working = isWorking(state);
  });
  void activity.read().then((result) => {
    if (result.ok && !heard) working = isWorking(result.value.state);
  }, /* best-effort: with no answer it stays "working", the side that asks for nothing */ () => undefined);
  return { working: () => working };
}

function isWorking(state: unknown): boolean {
  const display = (state as { display?: { working?: unknown; outcome?: unknown } | null } | null | undefined)?.display;
  return display?.working === true || display?.outcome === "waiting";
}
