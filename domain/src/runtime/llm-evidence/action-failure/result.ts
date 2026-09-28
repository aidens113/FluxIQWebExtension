// The part of a gateway action result this domain reads when the action did
// not succeed.
//
// Every field is untrusted: it was written by the page's own client and
// arrives over the wire. Nothing here is passed on as it stands -- the code is
// matched against this domain's closed failure set and the payload is read only
// through `actions/extraction/summary.ts`, which copies a summary field by
// field and drops the whole of it rather than let anything undeclared through.

import type { JsonObject } from "fluxiq/core";

/** The part of a gateway result a failed action is read from. Every field is untrusted. */
export type WebFailedActionResult = {
  status: string;
  failure?: { code?: unknown; actual?: unknown } | undefined;
  /**
   * The client's own result payload.
   *
   * Only `extraction` is ever read from it, and only through the closed copy
   * (`actions/extraction/summary.ts`). It is declared here because a failed
   * read's account of itself travels on the *result*, not on the failure
   * record: `content/actions/extract-list.ts` puts the counts on the result's
   * evidence and the code on the record, and until 2026-09-28 this type named
   * only the record, so the whole account was in the reply and unreachable.
   */
  payload?: JsonObject | undefined;
};
