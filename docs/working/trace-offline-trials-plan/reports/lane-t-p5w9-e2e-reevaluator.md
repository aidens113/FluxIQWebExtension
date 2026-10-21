# Report: lane-t-p5w9 e2e reevaluator (t749, plan P5 gate, brief W9)

## Outcome

Done (2026-10-20). The headed offline-reads spec now asks the domain's `createWebOfflineReadReevaluator` for every case,
using a request shaped like Core's `ClientGatewayTraceReevaluationRequest`. All 5 cases pass headed, provider-free:

- The three static sites answer with B's live rows cell for cell. job-board also passes on Edge.
- The grown photo feed is a `dynamic_content` gap.
- In every case, the same request with the primary missing from the store is a `snapshot_unavailable` gap and runs
  nothing in the page.

I found no defect in the reevaluator or the page.

## What changed and why

Every file below is under `apps/extension/e2e/content/tests/offline-reads/tests/`.

- `capture-snapshot.ts` now returns `PageCapture = { trace, bytes, snapshot }`:
  - `trace` is the capturer's own `ClientGatewayTraceResultMetadata`;
  - `bytes` is the uploaded parts, by digest;
  - `snapshot` is built as before.

  The request needs the references and the store as well as the snapshot.
- `reevaluation-request.ts` (new) builds the request:
  - `command` and `recordedCommand` are B's and A's `server.execute_action` payloads
    (`{commandId, actionType, timeoutMs, parameters: {extractList}}`).
  - `operation`, `recorded` and `fields` come from Core's own `readClientGatewayTraceOperation` and
    `clientGatewayTraceOperationDifferences`, imported through `fluxiq/client-gateway`.
  - `recordedResult` is `withTraceMetadata(gatewayActionResultFromBrowserResult(liveA), capture.trace)`. Both are the
    production functions: the domain's builder, and the background's trace-capture barrel.
  - `artifacts` and `readArtifact` read the captured parts.
  - Every payload goes through JSON, as a trace records it and reads it back.
- `watched-snapshot-page.ts` (new) wraps the `WebSnapshotPage` the reevaluator is given. It records each evaluation's
  command id, status, failure code, row count and sandbox observations, as counts only. This replaces the raw-page call.
  The observations stay in the log, and the spec can still tell which run, the control or B, saw what.
- `offline-reads.spec.ts` is rewritten around the reevaluator.
  - **Static cases:** the answer is `answered`. Its result status equals live B's gateway status, and its rows equal
    live B's, both by count of cells and by `toEqual`.
  - **Dynamic case:** the photo feed is captured before it grows, and live A runs afterwards. The checks:
    - the control ran and read fewer rows than live A (4 vs 20);
    - the control ran no page script and leaked no request;
    - the answer is not `answered`, and it equals `{gap, dynamic_content, fields}`.
  - **Every case:** `withoutPrimary(request)` makes `readArtifact` answer nothing for the primary. The answer must equal
    `{gap, snapshot_unavailable, fields}`, and the page must evaluate nothing more.
  - **Raw-page measurements dropped:** the direct `page.evaluate` call and the "scrollsPastEnd > 0" assertion. They
    proved nothing about gaps, and the watched page keeps the same observations in the log.

## Progress log

### 2026-10-20
- Read the brief, the shared lane rules, the P5d and W7 reports, the spec, the reevaluator module, Core's
  `trace-matcher/types.ts`, `reevaluation-request.ts` and `operation/`, and the package-exports rule header.
- Wrote the four files above.
- `npx tsc --noEmit -p tsconfig.test.json` (apps/extension) -> `EXIT 0`.
- `node scripts/test-content.mjs -- --headed --workers=2 offline-reads` (apps/extension) -> 5 passed (4.0m). This was the
  first run, and the lines are quoted below.
- `node scripts/structure-audit.mjs` (root) -> `structure-audit: passed (218 warning(s), 651 baselined).` with no line
  naming `offline-reads`.

UNIT READY: apps/extension/e2e/content/tests/offline-reads/tests/{offline-reads.spec.ts,capture-snapshot.ts,reevaluation-request.ts,watched-snapshot-page.ts}, this report.

## Commands run and observed results

- `npx tsc --noEmit -p tsconfig.test.json` (apps/extension): exit 0.
- `node scripts/test-content.mjs -- --headed --workers=2 offline-reads` (apps/extension):
  ```
  ok 2 ... job-board (chrome): the reevaluator answers a changed read over the production capture with the live rows (18.3s)
  ok 1 ... photo-social (chrome): the reevaluator answers a changed read over the production capture with the live rows (50.1s)
  ok 3 ... social-network-feed (chrome): the reevaluator answers a changed read over the production capture with the live rows (49.6s)
  ok 4 ... job-board (msedge): the reevaluator answers a changed read over the production capture with the live rows (18.1s)
  ok 5 ... photo-social (chrome): a read past a feed captured before it grew is a dynamic-content gap, never an answer (47.4s)
  5 passed (4.0m)
  ```
- `node scripts/structure-audit.mjs` (root): `structure-audit: passed (218 warning(s), 651 baselined).`, exit 0.

Counts from the OFFLINE_READS lines:

| Case | differing fields | live A rows / status | live B rows / status | answer | answered rows, cells equal | control rows | missing primary |
| --- | --- | --- | --- | --- | --- | --- | --- |
| job-board (Chrome) | 15 | 12 / succeeded | 12 / succeeded | answered | 12, 84/84 | 12 | snapshot_unavailable |
| photo-social (Chrome) | 43 | 27 / succeeded | 27 / failed output_not_observed | answered | 27, 566/566 | 27 | snapshot_unavailable |
| social-network-feed (Chrome) | 54 | 34 / failed output_not_observed | 34 / failed output_not_observed | answered | 34, 906/906 | 34 | snapshot_unavailable |
| job-board (Edge) | 15 | 12 / succeeded | 12 / succeeded | answered | 12, 84/84 | 12 | snapshot_unavailable |
| photo-social dynamic (Chrome) | 43 | 20 / succeeded | not run | gap dynamic_content | n/a | 4 | snapshot_unavailable |

Every evaluation showed `scriptsRan 0`, `requestsLeaked 0`, `navigationsHeld 0` and `requestsRefused 0`. Each also showed
`scrollsPastEnd 1`, for the control and for B alike.

## Not verified

- The request is built in the spec from Core's public functions. It does not come from Core's
  `clientGatewayTraceReevaluationRequest` over a recorded trace store and matcher. `recorded.sequence`, `logicalMs`,
  `session` and the artifact ids and sequences are placeholders, and the reevaluator does not read them.
- I ran the content script directly, as P5d did, not through `pnpm test:content`. I did not check whether Core's build
  was current.
- The dynamic gap here comes from the control not reproducing live A (4 vs 20 rows). The "asks more than the control"
  rule did not fire in any case: the control and B both counted `scrollsPastEnd` 1. That rule is still exercised only
  by the domain unit tests.
- Firefox is not covered.
- I ran one headed run, with no repeat for flakiness.

## Open questions or contradictions found

1. **The live A row count in the dynamic case** was 20 here. P5d's all-field live read got 27. The feed grows during
   the read, so the count depends on timing. The assertion needs only live A to be greater than the control, and the
   control read 4.
2. **social-network-feed is answered even though its recorded A failed.** This settles P5d's open question 2, as W7's
   D37 intended: a control that fails the same way with the same rows reproduces the recorded read.
