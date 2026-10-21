# Report: lane-t-p5w7 reevaluator control (t749, plan P5 tier 2, brief W7)

## Outcome

Done (2026-10-20). All three items landed, tests first, and every named check passes. The builder now lives in the
domain and every extension caller uses it. The reevaluator uses Core's types and has no local contract. D37 replaces
"the recorded read succeeded" with a control run.

Factory's final signature:

```ts
createWebOfflineReadReevaluator(page: WebSnapshotPage): ClientGatewayTraceReevaluator   // fluxiq/client-gateway
```

## What changed and why

- **The builder** is `domain/src/client/browser-result-mapping.ts`, exporting `gatewayActionResultFromBrowserResult`.
  It is exported from `domain/src/client/index.ts`. Its signature is
  `(result: WebAutomationActionResult<unknown, unknown>, source?: { tabId?; frameId? }) => ClientGatewayActionResult`.
  Its 11 rows moved with it into `domain/src/client/tests/browser-result-mapping.test.ts`. The extension's
  `runtime/result-mapping.ts` keeps only the command mapping and the rejection result, and its test keeps those rows
  plus the closed-failure-set compile row. Callers were switched in `server-command-channel.ts` and in the e2e
  `social-read-completion.spec.ts`. That spec file is under `apps/extension/e2e`, not `src`; I read "switch every
  extension caller" as covering it. The change is one import line.
- **Core's types.** `reevaluation-contract.ts` and `gateway-result-builder.ts` are deleted. Every module now reads
  `ClientGatewayTraceReevaluationRequest` and `ClientGatewayTraceRecordedPayload` as untyped data. A new file,
  `command-payload.ts` (`webOfflineReadGatewayCommand`), checks a command payload before it reaches
  `webAutomationActionFromGatewayCommand`:
  - `commandId` and `actionType` must be strings;
  - `parameters`, `target` and `metadata`, when present, must be plain objects;
  - `timeoutMs`, when present, must be a finite number.

  `recorded-snapshot.ts`, `recorded-list-ended.ts` and `answered-result.ts` now read the recorded result defensively
  through record checks. `answered-result.ts` calls the domain builder directly.
- **D37.** `control-reproduced.ts` (`webOfflineReadControlReproduced`) compares the control with the recorded result.
  The control is built into a gateway result by the same builder first. The comparison covers:
  - the status;
  - `failure.code`;
  - `payload.extracted`, by JSON value (array order matters, object key order does not);
  - the summary counts `recordCount`, `pagesRead`, `itemsSeen`, `emptyRecords` and `earlierPageRepeats`, read through
    `webAutomationExtractionSummaryValue`. A summary on only one side counts as a difference.

  `dynamic-content.ts` now takes `{ changed, control, recordedResult }` and applies the rules in this order:
  1. A breach in either run is dynamic.
  2. A control that does not reproduce the recorded result is dynamic.
  3. A changed read whose target was not found or not shown, that timed out, or whose list never appeared is dynamic.
  4. A changed read that asked for more than the control (`navigationsHeld` or `scrollsPastEnd` above the control's)
     is dynamic, unless `recorded-list-ended.ts` holds.

  `reevaluator.ts` runs these steps in order:
  1. An unreadable command, a command the domain rejects, or an ineligible command is `declined`.
  2. A recorded command that is unreadable, rejected by the domain, or of a different action type is
     `incomplete_capture`.
  3. A missing snapshot is `snapshot_unavailable`.
  4. The control runs, then the changed read. A page that cannot run either one gives the page's own reason.
  5. The rule above is applied.
  6. Otherwise the read is answered.

  The rule is documented in the `reevaluator.ts` header and in each rule file's header.
- `snapshot-page.ts`: unchanged. Every field was usable.
- I renamed `recorded-command.ts` to `command-payload.ts` after the audit's `naming` rule flagged three `recorded-*`
  files. It reads the trial's command as well as the recorded one.

## Progress log

### 2026-10-20 - Baseline
- `node scripts/structure-audit.mjs` (downstream root) -> `structure-audit: 99 violation(s) across 1 rule(s).`, all
  `package-exports`, none in this brief's files.
- `DOMAIN_TEST_BUILD_LABEL=t749-w7 node scripts/test-domain.mjs runtime/offline-reads/tests` (domain) -> `# tests 12`,
  `# pass 12`, `# fail 0` (P5c's module as it stood).

### 2026-10-20 - Unit 1: the builder moves into the domain
- Test first: `domain/src/client/tests/browser-result-mapping.test.ts` (the extension's builder rows, on the domain's
  JSON-bound result; the `as never` on the structure row is gone, a non-literal object needs none). Before the move:
  `DOMAIN_TEST_BUILD_LABEL=t749-w7 node scripts/test-domain.mjs client/tests/browser-result-mapping` ->
  `ERROR: Could not resolve "../browser-result-mapping"`.
- Moved `gatewayActionResultFromBrowserResult` (with its private `browserSourceId`, `compactObject`) to
  `domain/src/client/browser-result-mapping.ts`, exported from `domain/src/client/index.ts`. It takes
  `WebAutomationActionResult<unknown, unknown>`, so the extension's `BrowserActionResult` and the domain's own result
  both fit; the three `as never` casts became the domain's usual `as WebAutomationElementStateInput` /
  `as WebAutomationActionResult` reads. After: same command -> `# tests 11`, `# pass 11`, `# fail 0`.
- Callers switched: `apps/extension/src/background/connection/server-command-channel.ts` (now imports it from
  `@fluxiq-web-extension/domain/client`), `apps/extension/e2e/content/tests/extraction/tests/social-read-completion.spec.ts`
  (same; it imported it through `src/runtime/index.js`). Removed from `apps/extension/src/runtime/result-mapping.ts`
  (its now-unused imports too); the moved rows left `runtime/tests/result-mapping.test.ts`, which keeps the command,
  rejection and closed-failure-set rows.
- Extension `npx tsc --noEmit -p tsconfig.json` -> exit 0; `-p tsconfig.test.json` (covers e2e) -> exit 0.
  `EXTENSION_TEST_BUILD_LABEL=t749-w7 node scripts/test-extension.mjs runtime/tests/result-mapping runtime/tests/action-runner background/connection/tests/server-command-channel`
  -> `# tests 62`, `# pass 62`, `# fail 0`.

### 2026-10-20 - Units 2 and 3: Core's types and the differential rule (D37)
- Tests first: rewrote `domain/src/runtime/offline-reads/tests/reevaluator.test.ts`. It now has 18 rows. The fake page
  tells the control from the changed read by command id, and the builder is the real domain builder. Run against
  P5c's module, `DOMAIN_TEST_BUILD_LABEL=t749-w7 node scripts/test-domain.mjs runtime/offline-reads/tests` gave
  `# tests 18`, `# pass 4`, `# fail 14`. The failures included the failed-but-rows row, the control-differs row,
  equal asks, incomplete_capture, and the payload-equals-builder row. The "asks more" row already passed, because the
  old rule made every scroll dynamic.
- Implementation as described under "What changed". After it, the same command gave `# tests 18`, `# pass 18`,
  `# fail 0`.
- Mutation check. I backed up the file to scratch, changed one rule at a time, and confirmed the restore with `cmp`:
  - control check removed: `not ok 3`
  - asks rule removed: `not ok 5`, `not ok 7`
  - list-ended exception removed: `not ok 7`
  - control-run breach ignored: `not ok 9`
- The first domain `tsc -p tsconfig.test.json` failed (TS2352). Two hand-written failure records had codes and stages
  outside the closed set. I switched every failure in the test to `webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.*)`,
  and after that it exited 0.
- The structure audit flagged `[naming] domain/src/runtime/offline-reads/: 3 files share the prefix "recorded-"`.
  I renamed `recorded-command.ts` to `command-payload.ts`, and the audit then showed no finding in my files.

UNIT READY: domain/src/client/browser-result-mapping.ts, domain/src/client/tests/browser-result-mapping.test.ts,
domain/src/client/index.ts, domain/src/runtime/offline-reads/** (deleted: reevaluation-contract.ts,
gateway-result-builder.ts), apps/extension/src/runtime/result-mapping.ts,
apps/extension/src/runtime/tests/result-mapping.test.ts,
apps/extension/src/background/connection/server-command-channel.ts,
apps/extension/e2e/content/tests/extraction/tests/social-read-completion.spec.ts, this report.

## Commands run and observed results (final state)

| Command (directory) | Observed |
| --- | --- |
| `DOMAIN_TEST_BUILD_LABEL=t749-w7 node scripts/test-domain.mjs runtime/offline-reads/tests` (domain) | `# tests 18`, `# pass 18`, `# fail 0` |
| `DOMAIN_TEST_BUILD_LABEL=t749-w7 node scripts/test-domain.mjs client/tests/browser-result-mapping` (domain) | `# tests 11`, `# pass 11`, `# fail 0` |
| `npx tsc --noEmit -p tsconfig.json` (domain) | exit 0 |
| `npx tsc --noEmit -p tsconfig.test.json` (domain) | exit 0 |
| `npx tsc --noEmit -p tsconfig.json` (apps/extension) | exit 0 |
| `npx tsc --noEmit -p tsconfig.test.json` (apps/extension, includes e2e) | exit 0 |
| `EXTENSION_TEST_BUILD_LABEL=t749-w7 node scripts/test-extension.mjs runtime/tests/result-mapping runtime/tests/action-runner background/connection/tests/server-command-channel` (apps/extension) | `# tests 62`, `# pass 62`, `# fail 0` |
| `node scripts/structure-audit.mjs` (root) | exit 1, `35 violation(s) across 1 rule(s)`, all `[package-exports]` in other lanes' files; none in mine. Advisory `file-lines` warnings only on files over 400 lines before this change (`server-command-channel.ts`: 469 lines, +1 import line). |

## Not verified

- No run against P5d's real Playwright page or a recorded trace. The control's effect on the photo, job and social
  traces is unmeasured. In particular, I have not checked that a live recorded result's extracted records equal a
  control's exactly, value for value; P5d's 566/566 and 906/906 cell equality suggests they do. That measurement
  belongs to the gate run.
- I have not wired this into the matcher. Nothing in `packages/test-runner` calls the factory yet: W6 owns that, and
  must call it with one argument.
- The e2e spec `social-read-completion.spec.ts` was typechecked (extension `tsconfig.test.json`) but not run, since it
  is a headed browser spec.
- No full suites, per the narrow-checks rule.

## Open questions or contradictions found

1. **The e2e importer.** `apps/extension/e2e/content/tests/extraction/tests/social-read-completion.spec.ts` imported
   the builder through `src/runtime/index.js`. The brief's ownership names importers "under apps/extension/src/**".
   I switched it anyway, since "switch every extension caller" requires it and leaving it would break the typecheck.
   It is a one-line import change. Please confirm.
2. **Stale comments outside my files.** These still name `runtime/result-mapping.ts` as where the gateway result is
   built:
   - `apps/extension/src/content/action-runtime/results.ts:143`
   - `apps/extension/e2e/content/tests/redaction.spec.ts:353,417,538`
   - `domain/src/client/gateway-mapping.ts:307` (in `domain/src/client`, but outside the "new file and barrel line"
     I own)
   - `domain/src/runtime/tests/adapter-redaction.test.ts:6,251`
   - `docs/architecture/failure-taxonomy.md`
   - `docs/architecture/web-capabilities.md`

   Each should now point to `domain/src/client/browser-result-mapping.ts`. This is comment and documentation drift
   only.
3. **Order and rules I chose:**
   - The recorded command is checked before the snapshot is loaded, so it is a cheap gap with no store reads.
   - The control runs before the changed read.
   - A recorded command of a different action type from the changed command is `incomplete_capture`. Core offers only
     same-type mismatches, so this should not happen.
   - An unreadable trial command is `declined`, not a gap.
   - A summary present on only one side counts as not reproduced.
