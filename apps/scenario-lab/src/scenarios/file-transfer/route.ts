import type { ScenarioRouteRequest, ScenarioRouteResponse } from "../../types.js";
import { fileTransferReport } from "./report.js";
import type { FileTransferState } from "./state.js";

/**
 * `report.csv` serves the seeded report as an attachment, and its GET records
 * the download (the server skips the mutation on HEAD). `download-status`
 * answers the recorded download count as JSON; the page polls it after the
 * link is clicked. Any other subpath is a 404.
 */
export function routeFileTransfer(state: FileTransferState, request: ScenarioRouteRequest): ScenarioRouteResponse | undefined {
  if (request.subpath === "report.csv") {
    const report = fileTransferReport(state.seed);
    return {
      status: 200,
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${report.filename}"` },
      body: report.csv,
      mutation: { operation: "record-download", payload: { filename: report.filename } },
    };
  }
  if (request.subpath === "download-status") {
    return {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ filename: state.reportFilename, downloadCount: state.downloadCount }),
    };
  }
  return undefined;
}
