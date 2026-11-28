import type { WebLlmEvidenceToolRequest } from "../../../capture";
import type { WebLlmSnapshotBinding } from "../../../sanitize";
import { webNodeBuildOf } from "../../build-state";
import type { WebNodeRun } from "../../context";
import type { WebNodePageOptions } from "./options";
import { webNodeReadPage } from "./read-page";

/**
 * The page as it stands, or nothing at all.
 *
 * A build that was told where its Flow starts has had nothing opened for it:
 * the tab is the blank one a browser opens on, the extension refuses to read it
 * (`apps/extension/src/runtime/unsupported-page.ts`), and the capture comes back
 * `page_unreadable`. That is not a fault to report, it is the situation, and
 * `undefined` is how this module says so.
 *
 * **The rule also holds when the page is already open.** Until a navigation
 * node has succeeded in this build (`node-run/arrival.ts`) the answer is
 * `undefined` even when the capture read a page: on `run-muncqlr0-3348202b` the
 * tab already stood on the start location, the first look read it, no step ever
 * reached it, and the Flow was refused `bootstrap.cannot_reach_start_location`.
 * The capture is still taken, so the calls made are the same whichever tab the
 * build was handed. A look alone reads the page through `webNodeReadablePage`.
 *
 * **An arrived build's unreadable page is not "no page".** Where the build has
 * arrived, a look that could not read the page (timed out, the channel closed)
 * is raised as `page_unreadable` with the host's failure, so the call is refused
 * for what happened and the model is never told to go to the start page it has
 * already reached. The one exception is a call that moves the page itself
 * (`movesPage`): a navigation is the way out of an unreadable page, so it
 * proceeds from nowhere as it does from the blank tab.
 *
 * A build that was told no start location is unchanged in every respect: the
 * refusal is raised as it always was, because there is nowhere to send the
 * model and "the page could not be read" is then the whole truth.
 */
export async function webNodeCurrentPage(run: WebNodeRun, request: WebLlmEvidenceToolRequest, options?: WebNodePageOptions, movesPage = false): Promise<WebLlmSnapshotBinding | undefined> {
  const read = await webNodeReadPage(run, request, options);
  const arrived = run.request.startLocation === undefined || run.arrivals.arrived(webNodeBuildOf(run.request).build);
  if (read.kind === "unreadable") {
    if (run.request.startLocation !== undefined && (!arrived || movesPage)) return undefined;
    throw read.rejection;
  }
  return arrived ? read.page : undefined;
}
