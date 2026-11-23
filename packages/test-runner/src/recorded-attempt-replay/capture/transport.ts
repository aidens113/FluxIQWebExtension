import { writeFile } from "node:fs/promises";

/** Literal fixture transport with no network dependency. A diagnostic Stop never overwrites its first evidence. */
export function recordedCaptureTransport(input: { wireFile: string; attach(): Readonly<{ sourceTraceId: string; artifactId: string; sha256: string }>; cancel(): void }): typeof fetch {
  let claimed = false;
  let ordinal = 0;
  return async (_url, init) => {
    ordinal += 1;
    const request = typeof init?.body === "string" ? init.body : "";
    if (claimed) {
      input.cancel();
      await writeFile(`${input.wireFile}.extra-${ordinal}.json`, JSON.stringify({ ordinal, request, responseBase64: null, status: null, code: "recorded_capture_extra_native_request" }), { flag: "wx" });
      throw new DOMException("The stopped capture refuses an extra native request", "AbortError");
    }
    // Claim before attachment or I/O, so concurrent roles cannot replace the first receipt.
    claimed = true;
    try {
      const position = input.attach();
      const response = Buffer.from("{");
      await writeFile(input.wireFile, JSON.stringify({ position, request, responseBase64: response.toString("base64"), status: 200, contentType: "application/json", historicalUsd: 0 }), { flag: "wx" });
      queueMicrotask(input.cancel);
      return new Response(response, { status: 200, headers: { "content-type": "application/json" } });
    } catch (error) {
      input.cancel();
      throw error;
    }
  };
}
