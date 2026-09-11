import { createScenarioManifest } from "../../types.js";
import { fileTransferReport } from "./report.js";

const SEED = 119;
/** The runner starts the lab with the fixture's own seed by default, so the download is `report-119.csv`. */
const REPORT_FILENAME = fileTransferReport(SEED).filename;
const UPLOAD_NAME = "expense-receipts.csv";

/**
 * Corpus rows W16 (the primary workflow: download the report) and W17 (the
 * `upload` workflow). Neither has variants. Each script ends by waiting for
 * the status line its final-state fact reads, because facts are read once,
 * without retry, after the script.
 */
export const fileTransferManifest = createScenarioManifest({
  id: "file-transfer", title: "File transfer", tags: ["file-transfer", "download", "upload", "forms"], seed: SEED,
  startPath: "/scenarios/file-transfer/", capabilities: ["download", "forms", "mutation"],
  recordingScript: [
    { id: "click-download-report", operation: "click", target: "testid:download-report" },
    { id: "wait-report-download", operation: "waitForDownload", value: REPORT_FILENAME, timeoutMs: 5000 },
    { id: "wait-download-recorded", operation: "waitForState", target: "testid:download-recorded", timeoutMs: 5000 },
  ],
  expected: {
    pageFacts: [
      { id: "download-link-visible", subject: "download-report", predicate: "visible", value: true },
      { id: "report-file-named", subject: "report-filename", predicate: "text", value: REPORT_FILENAME },
      { id: "no-download-recorded", subject: "download-recorded", predicate: "exists", value: false },
    ],
    recordingEvents: [{ type: "web.element.clicked", count: 1 }],
    actions: [{ action: "web.dom.click", outcome: "succeeded" }],
    finalState: [{ id: "report-downloaded", subject: "download-recorded", predicate: "text", value: `Downloaded ${REPORT_FILENAME}` }],
    allowedConsoleErrors: [],
  },
  workflows: [{
    id: "upload",
    description: "W17: choose a file in the labelled file input, submit the upload form, and see the echoed file name.",
    recordingScript: [
      { id: "choose-upload-file", operation: "upload", target: "testid:upload-file", value: UPLOAD_NAME },
      { id: "submit-upload", operation: "click", target: "testid:upload-submit" },
      { id: "wait-upload-echo", operation: "waitForState", target: "testid:upload-result", timeoutMs: 5000 },
    ],
    expected: {
      pageFacts: [
        { id: "upload-form-visible", subject: "upload-form", predicate: "visible", value: true },
        { id: "no-upload-recorded", subject: "upload-result", predicate: "exists", value: false },
      ],
      recordingEvents: [{ type: "web.element.clicked", count: 1 }],
      actions: [{ action: "web.dom.click", outcome: "succeeded" }],
      finalState: [{ id: "upload-echoed", subject: "upload-result", predicate: "text", value: `Uploaded ${UPLOAD_NAME}` }],
      allowedConsoleErrors: [],
    },
  }],
});
