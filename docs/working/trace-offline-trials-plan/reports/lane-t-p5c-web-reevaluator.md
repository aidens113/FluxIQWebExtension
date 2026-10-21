# Report: lane-t-p5c web reevaluator (t749, plan P5 tier 2)

## Outcome

Partial (2026-10-20). The web domain's offline reevaluator is built in `domain/src/runtime/offline-reads/**` with
every rule in the brief, tests written first, and domain typechecks clean. One item is not done: moving the
extension's gateway-result builder into the domain. It lives outside the paths I own (see Open questions), so the
factory takes the builder as an argument instead. That reuses the extension's code and copies none of it, but the
move and switch the brief asked for is still open.

Factory:

```ts
createWebOfflineReadReevaluator(page: WebSnapshotPage, buildResult: WebOfflineReadGatewayResultBuilder): WebOfflineReadReevaluator
// WebOfflineReadGatewayResultBuilder = (result: WebAutomationActionResult) => ClientGatewayActionResult
// WebOfflineReadReevaluator = { reevaluate(request: WebOfflineReadRequest): Promise<WebOfflineReadAnswer> }
```

## What changed and why

All new files are under `domain/src/runtime/offline-reads/`, one export (or one type family) per file:

- `reevaluation-contract.ts`: a structural declaration of the reevaluation port (request, answer, artifact, gap reason,
  reevaluator), for the lead to replace with Core's types.
- `gateway-result-builder.ts`: the builder type. The host passes in the extension's
  `gatewayActionResultFromBrowserResult`, so an offline answer is built by the same code as a live one.
- `read-eligibility.ts` (`webOfflineReadEligible`): uses the domain's existing classification
  `WEB_AUTOMATION_ACTION_SAFETY[actionType] === "safe"` (the "only observes or waits" record that the manifest and output
  nodes derive from), with no new list. Every differing path must be `parameters`, `target`, or a path under them,
  matched by path segment. No fields at all also declines.
- `recorded-snapshot.ts` (`webOfflineReadRecordedSnapshot`): reads `recordedResult.metadata.trace` and needs exactly one
  primary with a `source`. Every part must appear in the segment's `artifacts` list (D32: nothing from later), and bytes
  come only from `readArtifact`. A resource the segment does not hold, or whose bytes do not come back, is counted in
  `unavailable`. The primary's `source` is the page address: `capture-page.ts:34` sends `document: { html, source: doc.URL }`,
  `hash-capture-parts.ts` maps it to the primary artifact, and `with-trace-metadata.ts` puts it on `metadata.trace`.
- `recorded-list-ended.ts` (`webOfflineReadRecordedListEnded`): the documented rule. The recorded read must be a
  succeeded `web.dom.extract_list` whose summary (read with the wire's own copier,
  `webAutomationExtractionSummaryValue`) shows: not truncated, no `listContinues`, `listPresence` not `never_appeared`,
  and either `scrolled_to_end`, or `pagesRead === 1` with no stop or a stop of `control_disabled`/`no_following_page`.
  A read that followed a control to later pages proves nothing, because the snapshot holds only its last page.
- `dynamic-content.ts` (`webOfflineReadDynamicContent`): returns `dynamic_content` when:
  - `scriptsRan` or `requestsLeaked` is above 0 (a breach is never a pass);
  - `navigationsHeld` or `scrollsPastEnd` is above 0 and the list-ended rule does not hold;
  - the content result failed with `web.target.not_found` or `web.target.not_shown`;
  - the status is `timed_out`;
  - the read's own `listPresence` is `never_appeared`.

  `requestsRefused` alone is not a gap, and rows a filter excluded are answered.
- `answered-result.ts` (`webOfflineReadAnsweredResult`): before calling the builder, it replaces the content result's
  `startedAt`/`finishedAt` with the recorded `startedAt`/`completedAt`, falling back to the recorded payload's
  `startedAt`/`finishedAt`. That way the top level and the payload carry the recorded timings and every offline run
  gives the same answer. It then keeps the recorded `metadata.trace` and the recorded `payload.sourceId` (the
  extension-owned tab and frame id; the sandbox has none).
- `reevaluator.ts` (`createWebOfflineReadReevaluator`) runs these steps in order:
  1. Map the command with `webAutomationActionFromGatewayCommand`. A rejected command is `declined`.
  2. Check eligibility. An ineligible command is `declined`.
  3. Load the snapshot. No snapshot gives `snapshot_unavailable`.
  4. Run `page.evaluate`. A page result of `unavailable` gives the page's own reason.
  5. Check for dynamic content.
  6. Otherwise, answer.

  A page or store that throws is left to throw. P5a's matcher turns that into an `incomplete_capture` gap and keeps the
  message (I first had a catch here; the structure audit's `failure-as-empty` rule flagged it).
- `index.ts`: barrel lines for the new exports. `snapshot-page.ts` is unchanged.
- `tests/reevaluator.test.ts`: 12 tests with a fake `WebSnapshotPage` and a stand-in builder (no browser, synthetic
  page text).

## Progress log

### 2026-10-20 - P5c unit
- Tests first: `cd domain && DOMAIN_TEST_BUILD_LABEL=t749-p5c node scripts/test-domain.mjs runtime/offline-reads/tests`
  failed before the module existed: `ERROR: Could not resolve "../reevaluator"`.
- After implementation: `# tests 11 # pass 11 # fail 0`. I then added a 12th test ("a store that throws ... reaches the
  matcher"). It failed (`not ok 6`, 11/12) while the snapshot reader still caught the error, and passed after the fix:
  `# tests 12 # pass 12 # fail 0`.
- Mutation check: I broke each rule in turn and restored from a scratch backup, confirming each time with `cmp` that
  everything was restored. Each mutation failed exactly its own test:
  - breach rule removed: `not ok 7`
  - list-ended exception removed: `not ok 9`
  - unresolved-target rule removed: `not ok 10`
  - safety ignored: `not ok 3`
  - segment check removed: `not ok 5`
  - trace not kept: `not ok 1`
  - timings not kept: `not ok 1`

  Test numbers are from the 11-test run, except the breach rule, which was rerun separately.
- `cd domain && npx tsc --noEmit -p tsconfig.json` exited 0. `npx tsc --noEmit -p tsconfig.test.json` exited 0, and
  `--listFilesOnly` shows 11 offline-reads files, so the test file is covered. The baseline before my edits also exited 0.
- `node scripts/structure-audit.mjs` exited 1 with 102 violations, none under `domain/src/runtime/offline-reads`
  (`grep -c` gives 0). They belong to other workers' files that are still changing: P5d's
  `packages/test-runner/src/offline-snapshot-page/**` and `apps/extension/e2e/content/tests/offline-reads/**`, and P5e's
  new `package-exports` rule, which flags about 95 existing e2e and script files. Earlier runs flagged three of mine
  (`failure-as-empty`, `imports` through `../../client/gateway-mapping`, and `statement-packing` in the test). All three
  are fixed.
- UNIT READY: domain/src/runtime/offline-reads/{reevaluation-contract,gateway-result-builder,read-eligibility,recorded-snapshot,recorded-list-ended,dynamic-content,answered-result,reevaluator,index}.ts, domain/src/runtime/offline-reads/tests/reevaluator.test.ts

## Commands run and observed results

| Command | Observed |
| --- | --- |
| `DOMAIN_TEST_BUILD_LABEL=t749-p5c node scripts/test-domain.mjs runtime/offline-reads/tests` (domain), before module | build error `Could not resolve "../reevaluator"` |
| same, final | `# tests 12`, `# pass 12`, `# fail 0` |
| `npx tsc --noEmit -p tsconfig.json` (domain) | exit 0, no output |
| `npx tsc --noEmit -p tsconfig.test.json` (domain) | exit 0, no output |
| `node scripts/structure-audit.mjs` (downstream root) | exit 1, `102 violation(s) across 5 rule(s)`, 0 in `domain/src/runtime/offline-reads` |

I did not run the extension typecheck, because I touched no extension file.

## Not verified

- I have not checked equality with the real extension builder. The test proves the answer is the builder's output for
  the same content result (with recorded timings), plus the recorded `sourceId` and `metadata.trace`, but the builder in
  the test is a stand-in. Domain tests cannot import the extension.
- I have not wired this into the matcher or a real sandbox. There is no run against P5a's port or P5d's Playwright page,
  and no run on a recorded trace.
- I have not tried compiling against Core's P5a types (see below).

## Open questions or contradictions found

1. **Builder location and ownership.** The builder is `gatewayActionResultFromBrowserResult` in
   `apps/extension/src/runtime/result-mapping.ts`, not in `background/connection/**`. `server-command-channel.ts:357`
   calls it from the runtime barrel. Moving it means editing that file and its test
   (`apps/extension/src/runtime/tests/result-mapping.test.ts`) and adding a file under `domain/src/client/**`. None of
   these are mine, and `apps/extension/src/runtime/` looks like the "background/runtime" P5d owns: P5d is editing
   `apps/extension/src/runtime/action-runner.ts` now. So I injected the builder instead of moving it.

   Two ways forward:
   - (a) Keep the injection, and have the host wire `(result) => gatewayActionResultFromBrowserResult(result as never)`.
     The cast is needed because `BrowserActionResult` uses `DomElementDescriptor`/`DomSnapshot` where the domain uses
     `JsonObject`; prefer a typed adapter, since the audit forbids `as never` in source.
   - (b) Give a worker `domain/src/client/<new file>`, `domain/src/client/index.ts`,
     `apps/extension/src/runtime/result-mapping.ts` and its test. That worker moves the function and its
     `browserSourceId` helper, switches `server-command-channel.ts`, and then drops the factory's second argument.
     Almost all the logic already calls domain functions (`webAutomationActionResultPayload`, the target and
     visual-target helpers, `webAutomationClearedCheckWaitValue`).
2. **Core's P5a types, as now in the Core tree** (`trace-matcher/types.ts:34-92`):
   - `command`, `recordedCommand`, `recordedResult` and the answered `result` are
     `{ readonly [key: string]: unknown }`, and `recordedResult` is non-null.
   - When the lead switches to them, `command` needs a read or a narrowing before
     `webAutomationActionFromGatewayCommand`, which takes a typed `ClientGatewayActionCommand & { commandId }`.
   - My readers of `recordedResult` already treat it as untrusted (record checks, number checks, the summary copier).
   - The gap `reason` there is `ClientGatewayTraceMatcherGapReason`, which must gain `snapshot_unavailable` and
     `dynamic_content`.
   - Core's `result-metadata-strip.ts` header confirms the recorded raw text keeps `metadata.trace`, which this module
     relies on.
3. **Rules I chose that the brief did not spell out:**
   - `web.target.not_shown` and `timed_out` count as dynamic, alongside not-found. All are possibly script-dependent,
     and a gap is the safe direction.
   - A failed `wait_for_text`/`assert` whose text is absent, without a timeout, is answered as it failed. Text is not a
     target.
   - A command the domain rejects (for example, an unknown verb or an unreadable required field) is `declined`, not
     answered with the extension's rejection result, which is also extension-local.
   - `payload.sourceId` is kept from the recorded result.
   - The lead may want any of these changed.
4. **`snapshot-page.ts`:** no change needed; every field was usable.
