import { defineScenario } from "../../types.js";
import { fileTransferManifest } from "./manifest.js";
import { mutateFileTransferState } from "./mutate.js";
import { renderFileTransferPage } from "./page.js";
import { routeFileTransfer } from "./route.js";
import { createFileTransferState, type FileTransferState } from "./state.js";

/** A report download served as a CSV attachment, and an upload form that records a file name and size. */
export const fileTransferScenario = defineScenario<FileTransferState>({
  id: "file-transfer", title: "File transfer", startPath: "/scenarios/file-transfer/", seed: 119,
  manifest: fileTransferManifest,
  createState: createFileTransferState,
  mutate: mutateFileTransferState,
  render: renderFileTransferPage,
  route: routeFileTransfer,
});
