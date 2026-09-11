import { escapeHtml, fixtureClient, page } from "../../html.js";
import type { RenderContext } from "../../types.js";
import { fileTransferReport } from "./report.js";
import type { FileTransferState } from "./state.js";

/** Fixed cadence for polling the download-status route after the link is clicked: every 50 ms, for up to 5 s. */
const DOWNLOAD_POLL_INTERVAL_MS = 50;
const DOWNLOAD_POLL_ATTEMPTS = 100;

/**
 * Start page: a report download link and an upload form. The status lines
 * are rendered from state as well as written by the script, so a reload
 * shows what the oracle recorded.
 */
export function renderFileTransferPage(state: FileTransferState, context: RenderContext): string {
  const report = fileTransferReport(state.seed);
  const downloadLines = state.downloadCount > 0 ? `<p data-testid="download-recorded">Downloaded ${escapeHtml(state.reportFilename)}</p>` : "";
  const uploadLines = state.lastUpload
    ? `<p data-testid="upload-result">Uploaded ${escapeHtml(state.lastUpload.name)}</p><p data-testid="upload-size">${state.lastUpload.size} bytes</p>`
    : "";
  const body = `<header><h1>File transfer</h1><p>Download the monthly report or upload a supporting file.</p></header>
    <main>
      <section aria-labelledby="report-heading">
        <h2 id="report-heading">Monthly report</h2>
        <p>File <code data-testid="report-filename">${escapeHtml(report.filename)}</code>: CSV, ${report.rowCount} rows.</p>
        <p><a data-testid="download-report" href="/scenarios/file-transfer/report.csv">Download report</a></p>
        <div data-testid="download-status" aria-live="polite">${downloadLines}</div>
      </section>
      <section aria-labelledby="upload-heading">
        <h2 id="upload-heading">Upload a file</h2>
        <form data-testid="upload-form" aria-labelledby="upload-heading" method="post" enctype="multipart/form-data" novalidate>
          <label for="upload-file">File to upload</label>
          <input id="upload-file" name="file" type="file" data-testid="upload-file" aria-describedby="upload-hint">
          <p id="upload-hint">Only the file's name and size are recorded; its contents are never read.</p>
          <button type="submit" data-testid="upload-submit">Upload</button>
        </form>
        <div data-testid="upload-status" aria-live="polite">${uploadLines}</div>
      </section>
    </main>`;
  return page("File transfer", body, pageScript(state, context));
}

function pageScript(state: FileTransferState, context: RenderContext): string {
  return `${fixtureClient(context.runToken, "file-transfer")}
const downloadStatus = document.querySelector('[data-testid="download-status"]');
const uploadStatus = document.querySelector('[data-testid="upload-status"]');
let knownDownloads = ${state.downloadCount};
let knownUploads = ${state.uploadCount};
let polling = false;
function showStatus(container, lines) {
  container.replaceChildren(...lines.map(([testId, text]) => {
    const line = document.createElement('p');
    line.dataset.testid = testId;
    line.textContent = text;
    return line;
  }));
}
async function awaitRecordedDownload() {
  for (let attempt = 0; attempt < ${DOWNLOAD_POLL_ATTEMPTS}; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, ${DOWNLOAD_POLL_INTERVAL_MS}));
    const response = await fetch('/scenarios/file-transfer/download-status', { cache: 'no-store' });
    const status = await response.json();
    if (status.downloadCount > knownDownloads) {
      knownDownloads = status.downloadCount;
      showStatus(downloadStatus, [['download-recorded', 'Downloaded ' + status.filename]]);
      return;
    }
  }
}
document.querySelector('[data-testid="download-report"]').addEventListener('click', () => {
  if (polling) return;
  polling = true;
  awaitRecordedDownload().catch(() => {}).finally(() => { polling = false; });
});
document.querySelector('[data-testid="upload-form"]').addEventListener('submit', event => {
  event.preventDefault();
  const file = document.querySelector('[data-testid="upload-file"]').files?.[0];
  if (!file) return showStatus(uploadStatus, [['upload-error', 'Choose a file to upload.']]);
  mutate('upload', { name: file.name, size: file.size }).then(snapshot => {
    const upload = snapshot.state.lastUpload;
    if (snapshot.state.uploadCount <= knownUploads || !upload) return showStatus(uploadStatus, [['upload-error', 'The upload was rejected.']]);
    knownUploads = snapshot.state.uploadCount;
    showStatus(uploadStatus, [['upload-result', 'Uploaded ' + upload.name], ['upload-size', upload.size + ' bytes']]);
  }).catch(() => showStatus(uploadStatus, [['upload-error', 'The upload failed.']]));
});`;
}
