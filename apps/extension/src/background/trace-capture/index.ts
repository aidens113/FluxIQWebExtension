// The background half of a traced command's page capture (traces and offline
// trials, P2): which commands Core asked to trace (`traced-commands.ts`), the
// capture asked of the page and uploaded to Core's trace store
// (`page-capturer.ts`), and the reference set on the command's gateway
// result (`with-trace-metadata.ts`). The page side is `content/trace-capture/`.
export { isTraceRequest } from "./is-trace-request";
export { readTraceRequest } from "./read-trace-request";
export { TracedCommands } from "./traced-commands";
export { TracePageCapturer, type TracePageCapturerDeps } from "./page-capturer";
export { TRACE_METADATA_KEY } from "./metadata-key";
export { TRACE_UPLOAD_BOUNDS } from "./upload-bounds";
export { TRACE_REMEMBERED_SCOPES } from "./remembered-scopes";
export { StoredDigests } from "./stored-digests";
export { withTraceMetadata } from "./with-trace-metadata";

export type { TraceArtifactUploader, TraceCapture, TraceMessageSender, TraceRequest, TraceUploadBounds } from "./types";
