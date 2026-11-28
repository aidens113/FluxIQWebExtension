import type { WebLlmEvidenceToolRequest } from "../../../capture";
import type { WebLlmSnapshotBinding } from "../../../sanitize";
import { webNodeBuildOf } from "../../build-state";
import type { WebNodeRun } from "../../context";
import type { WebNodeDispatchCapture } from "../types";
import type { WebNodePageOptions } from "./options";
import { webNodeReadPage } from "./read-page";

/**
 * The page as it stands, arrived or not.
 *
 * An unreadable page answers `undefined` only for a build that was told where
 * its Flow starts and has not arrived: the blank tab is the situation, and the
 * caller says where to go. Once the build has arrived, or when it was told no
 * start location, an unreadable page is the fault it is and is raised as
 * `page_unreadable`, carrying the host's failure (a timed-out look is not "no
 * page", and no start page is the cure).
 */
export async function webNodeReadablePage(run: WebNodeRun, request: WebLlmEvidenceToolRequest, options?: WebNodePageOptions, capture?: WebNodeDispatchCapture): Promise<WebLlmSnapshotBinding | undefined> {
  const read = await webNodeReadPage(run, request, options, capture);
  if (read.kind === "read") return read.page;
  if (run.request.startLocation !== undefined && !run.arrivals.arrived(webNodeBuildOf(run.request).build)) return undefined;
  throw read.rejection;
}
