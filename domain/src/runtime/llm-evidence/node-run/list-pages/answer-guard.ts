// What a node's call does with where a read's list stands, once the page has
// answered it (t1022): refuse a read whose list does not stand on the page it
// read, none of its rows kept, and remember the list a Next page moved.
//
// Split out of `../run.ts`, which only has to say that a call is checked here:
// the check is one responsibility with `./read-elsewhere.ts` (whether the list
// stands) and `./list-pages.ts` (where the build's own pager took it), and the
// refusal is raised as every other refusal the page caused is, carrying the
// page as it now stands (`../../capture.ts`, `pageRefusal`) or, from nowhere,
// where the Flow starts (`../start-location.ts`).

import type { JsonObject, JsonValue } from "fluxiq/core";
import { pageRefusal } from "../../capture";
import type { WebLlmSnapshotBinding } from "../../sanitize";
import { RecoverableToolRejection } from "../../tool-rejection";
import type { WebNodeRun } from "../context";
import { webStartLocationRefusal } from "../start-location";
import { webNodeListPages } from "./list-pages";
import { webNodeReadElsewhere } from "./read-elsewhere";

/** What the guard needs of the call that ran: the node, what the model wrote and what it ran with, the page's answer, and the page the call found. */
export type WebNodeListReadGuardInput = {
  actionType: string;
  written: JsonObject;
  ran: JsonObject;
  payload: JsonValue | undefined;
  current: WebLlmSnapshotBinding | undefined;
  failure: unknown;
  actionability: unknown;
};

/** Throw the refusal of a list read whose list is not on the page it read; otherwise remember the list a Next page moved. */
export async function webNodeListReadGuard(run: WebNodeRun, input: WebNodeListReadGuardInput): Promise<void> {
  const { actionType, written, ran, payload, current, failure, actionability } = input;
  const listPages = webNodeListPages(run);
  const elsewhere = webNodeReadElsewhere(listPages, actionType, written, payload, current?.evidence.location);
  if (elsewhere !== undefined) {
    throw current
      ? await pageRefusal(run.gateway, run.sessionId, run.request, current, elsewhere.refused, run.request.signal, failure, actionability)
      : new RecoverableToolRejection(elsewhere.refused.code, webStartLocationRefusal(run.request.startLocation ?? ""), undefined, undefined, failure, actionability);
  }
  listPages.pagerAnswered(ran, payload);
}
