import { routedFetch, SCRIPTED_MODEL_CORRELATION_HEADER } from "../attempt-lane/scripted-model/index.js";

/** Adds transport metadata without reading or changing Core's provider payload. */
export function hostProofModelFetch(real: typeof fetch, origin: string, runIdOf: () => string | undefined): typeof fetch {
  if (new URL(origin).hostname !== "127.0.0.1") throw new Error("The host proof's model transport must stay on loopback.");
  const routed = routedFetch(real, origin);
  return async (input, init) => {
    const request = new Request(input, init);
    request.headers.delete(SCRIPTED_MODEL_CORRELATION_HEADER);
    const runId = runIdOf();
    if (runId !== undefined) request.headers.set(SCRIPTED_MODEL_CORRELATION_HEADER, runId);
    const forwarded: RequestInit & { duplex: "half" } = { method: request.method, headers: request.headers, body: request.body, signal: request.signal, duplex: "half" };
    return await routed(request.url, forwarded);
  };
}
