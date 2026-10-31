import type { WebLlmSnapshotBinding } from "../../sanitize";

/**
 * Where a step found the page: the page it acted on, or for a step from nowhere
 * where it was sent, or failing both where it arrived.
 *
 * Never empty in practice -- a call with no page before it is one a start
 * location was given for (`currentPage`) -- and the empty string is only what
 * the type needs for the case that cannot occur: `./replay.ts` reads it as a
 * location it will not return to, which is the safe reading.
 */
export function foundAt(current: WebLlmSnapshotBinding | undefined, startLocation: string | undefined, after: WebLlmSnapshotBinding | undefined): string {
  return current?.evidence.location ?? startLocation ?? after?.evidence.location ?? "";
}
