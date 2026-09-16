// Which recorded kinds carry the page state they happened against.
//
// The executable kinds do, because a replay checks its own preconditions
// against what the recording saw -- including `data.extract`, where the
// snapshot is the page the extraction was defined on, and therefore the page a
// replay has to be on for the item selector to match.

import type { RecordingEventKind } from "./types";

export function shouldAttachStateSnapshot(kind: RecordingEventKind): boolean {
  return kind === "data.extract" ||
    kind === "dom.click" ||
    kind === "dom.input" ||
    kind === "dom.change" ||
    kind === "dom.submit" ||
    kind === "dom.keydown";
}
