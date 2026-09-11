import type { FileTransferState, FileTransferUpload } from "./state.js";

/** Longest file name an upload may record; browsers report base names only. */
const MAX_UPLOAD_NAME_LENGTH = 255;

/**
 * `record-download` (applied by the report route on GET) counts a download of
 * the served report; `upload` records a chosen file's name and size, dropping
 * any other payload field. Any other operation, or a malformed payload,
 * leaves the state unchanged.
 */
export function mutateFileTransferState(state: FileTransferState, operation: string, payload: unknown): FileTransferState {
  if (operation === "record-download") {
    return isRecord(payload) && payload.filename === state.reportFilename ? { ...state, downloadCount: state.downloadCount + 1 } : state;
  }
  if (operation === "upload") {
    const upload = uploadFrom(payload);
    return upload ? { ...state, uploadCount: state.uploadCount + 1, lastUpload: upload } : state;
  }
  return state;
}

function uploadFrom(payload: unknown): FileTransferUpload | undefined {
  if (!isRecord(payload)) return undefined;
  const { name, size } = payload;
  if (typeof name !== "string" || name.length === 0 || name.length > MAX_UPLOAD_NAME_LENGTH || /[\\/]/.test(name)) return undefined;
  if (typeof size !== "number" || !Number.isSafeInteger(size) || size < 0) return undefined;
  return { name, size };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
