import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type { RecordedExchange } from "./types.js";

/** Read the writer's actual files; status/bill are in meta.json, no response sidecar exists. */
export async function readRecordedStepLogs(input: { stepsDirectory: string; streams: Readonly<Record<string, string>> }) {
  const exchanges: RecordedExchange[] = [];
  const gaps: string[] = [];
  const inferredMediaTypes: string[] = [];
  const unmatchedRequests: string[] = [];
  let requests = 0;
  const ordinals = new Map<string, number>();
  const folders = (await readdir(input.stepsDirectory, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  for (const folder of folders) {
    const directory = path.join(input.stepsDirectory, folder);
    let request: string;
    try { request = await readFile(path.join(directory, "request.json"), "utf8"); } catch { continue; }
    requests += 1;
    let metadata: Record<string, unknown> = {};
    try { metadata = JSON.parse(await readFile(path.join(directory, "meta.json"), "utf8")); } catch { gaps.push(`missing_metadata:${folder}`); }
    if (typeof metadata.provider !== "string" || typeof metadata.model !== "string") {
      unmatchedRequests.push(folder);
      gaps.push(`unmatched_request:${folder}`);
      let wire: unknown;
      try { wire = JSON.parse(request); } catch { continue; }
      if (!wire || typeof wire !== "object" || typeof (wire as { model?: unknown }).model !== "string") continue;
    }
    const stream = input.streams[folder];
    if (!stream) {
      gaps.push(`missing_stream_identity:${folder}`);
      continue;
    }
    const ordinal = (ordinals.get(stream) ?? 0) + 1;
    ordinals.set(stream, ordinal);
    let response: Buffer | null = null;
    try { response = await readFile(path.join(directory, "response.json")); } catch { gaps.push(`missing_response:${folder}`); }
    let contentType: string | null = null;
    if (response) {
      const text = response.toString("utf8");
      if (/^(?:event:|data:)/u.test(text)) contentType = "text/event-stream";
      else {
        try {
          JSON.parse(text);
          contentType = "application/json";
        } catch { /* best-effort: unidentified malformed media becomes an explicit gap below */ }
      }
      if (contentType) inferredMediaTypes.push(folder);
      else gaps.push(`unproved_media_type:${folder}`);
    }
    exchanges.push({ stream, ordinal, request, response, contentType, status: typeof metadata.httpStatus === "number" ? metadata.httpStatus : null, historicalUsd: typeof metadata.costUsd === "number" ? metadata.costUsd : null });
  }
  return { exchanges, gaps, inferredMediaTypes, requests, unmatchedRequests };
}
