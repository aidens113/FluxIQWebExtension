/**
 * Where in `web.dom.extract_list`'s result the page puts its list of records.
 *
 * Core's record capture reads a node's `outputs.result` at `recordsPath`
 * (`runtime/executor/record-capture.ts`), and its proposal lift defaults that
 * path from the output's `metadata.recordsPath` (Core CD19), rejecting a
 * candidate that has none. Core never hard-codes `extracted`, because the key is
 * this domain's vocabulary. Only the list extraction returns records:
 * `web.dom.extract` also answers on `extracted`, but with one value, so a path
 * declared there would be a default that can never capture.
 *
 * **Two segments, because the dispatch wraps the client's answer.**
 * `io/gateway-output-dispatcher.ts` returns `{ status, message, result }` with
 * the client's action result under `result`, and `runtime/adapter.ts` carries
 * that same object through on the runtime path. Core then puts it at
 * `outputs.result` whole (`runtime/io-policy.ts`), so the rows the client sent
 * on `extracted` sit at `result.extracted` and a one-segment path finds
 * nothing. It found nothing in run `run-mu3rnmt9-fed2c3dc`, where the first
 * recorded extraction ever to reach the capture read the page and failed at
 * `record_output.records_missing` having saved no rows.
 *
 * The output node declares it as metadata (`../definitions.ts`) and sends it
 * with every record output it dispatches (`./dispatch.ts`).
 */
export const WEB_AUTOMATION_EXTRACT_LIST_RECORDS_PATH = "result.extracted";
