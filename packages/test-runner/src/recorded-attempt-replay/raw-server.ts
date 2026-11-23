import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { ScriptedModelCall, ScriptedModelServer } from "../attempt-lane/scripted-model/index.js";
import { SCRIPTED_MODEL_CORRELATION_HEADER } from "../attempt-lane/scripted-model/index.js";
import { recordedReplyCursor } from "./cursor.js";
import type { RecordedAttemptArtifact } from "./types.js";

/** Raw transport replay, separate from decoded scripted replies. No fabricated stream or token usage. */
export async function startRecordedModelServer(input: { artifact: RecordedAttemptArtifact; key: string; streamForCorrelation: Readonly<Record<string, string>> }): Promise<ScriptedModelServer & { replay: ReturnType<typeof recordedReplyCursor>["report"] }> {
  const cursor = recordedReplyCursor(input.artifact);
  const calls: ScriptedModelCall[] = [];
  let closed = false;
  const server = createServer((request, response) => {
    void (async () => {
      const correlation = request.headers[SCRIPTED_MODEL_CORRELATION_HEADER];
      const stream = typeof correlation === "string" ? input.streamForCorrelation[correlation] : input.streamForCorrelation["uncorrelated"];
      if (closed || request.method !== "POST" || request.url !== "/v1/messages" || request.headers.authorization !== `Bearer ${input.key}` || !stream) {
        closed = true;
        calls.push({ at: Date.now(), kind: "recorded", ordinal: 0, answered: false, refused: "recorded_transport_identity_refused" });
        response.writeHead(409).end();
        return;
      }
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const body = Buffer.concat(chunks).toString("utf8");
      const reply = cursor.take(stream, body);
      calls.push({ at: Date.now(), kind: "recorded", ordinal: reply?.ordinal ?? 0, answered: reply !== null, ...(reply === null ? { refused: cursor.report().divergence?.code ?? "recorded_replay_closed" } : {}) });
      if (!reply) {
        closed = true;
        response.writeHead(409).end();
        return;
      }
      response.writeHead(reply.status!, { "content-type": reply.contentType! });
      response.end(reply.response);
    })().catch((error: unknown) => {
      closed = true;
      calls.push({ at: Date.now(), kind: "recorded", ordinal: 0, answered: false, refused: error instanceof TypeError ? "recorded_transport_type_error" : "recorded_transport_failed" });
      if (!response.headersSent) response.writeHead(409);
      response.end();
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return {
    origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    calls: () => [...calls],
    counts: () => ({ recorded: calls.filter((call) => call.answered).length }),
    refusals: () => calls.filter((call) => !call.answered),
    replay: () => ({ ...cursor.report(), complete: !closed && cursor.report().complete, transportRefused: closed }),
    close: () => new Promise<void>((resolve) => {
      server.closeAllConnections();
      server.close(() => resolve());
    }),
  };
}
