import type { RecordingEventKind } from "./types";

export function shouldAttachStateSnapshot(kind: RecordingEventKind): boolean {
  return kind === "dom.click" ||
    kind === "dom.input" ||
    kind === "dom.change" ||
    kind === "dom.submit" ||
    kind === "dom.keydown";
}
