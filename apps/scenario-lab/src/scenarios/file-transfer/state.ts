import { fileTransferReport } from "./report.js";

/** What an upload recorded: the chosen file's name and size, never its contents. */
export type FileTransferUpload = { name: string; size: number };

/**
 * The fixture oracle published at `/__control/final-state`. `downloadCount`
 * counts GETs of the report route; `lastUpload` is the latest accepted upload.
 */
export type FileTransferState = {
  seed: number;
  reportFilename: string;
  downloadCount: number;
  uploadCount: number;
  lastUpload: FileTransferUpload | null;
};

export function createFileTransferState(seed: number): FileTransferState {
  return { seed, reportFilename: fileTransferReport(seed).filename, downloadCount: 0, uploadCount: 0, lastUpload: null };
}
