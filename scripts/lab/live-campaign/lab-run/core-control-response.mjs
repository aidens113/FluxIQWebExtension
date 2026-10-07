// The Lab's control client reports a Core that answered with an HTTP error as
// `FluxIQ control request failed: <endpoint> (<status>)[: <reason>]`
// (`packages/test-runner/src/http-control/index.ts`).
const CONTROL_RESPONSE = /FluxIQ control request failed: (\S+) \((\d{3})\)/u;

/**
 * The endpoint and status of a Core control request that Core answered with an
 * HTTP error, or `null` when the text is not one. Core answering is the
 * opposite of a crash: whatever the status, the process was alive and decided.
 *
 * @param {string | null | undefined} text
 * @returns {{ endpoint: string, status: number } | null}
 */
export function coreControlResponse(text) {
  const match = CONTROL_RESPONSE.exec(String(text ?? ""));
  return match ? { endpoint: match[1], status: Number(match[2]) } : null;
}
