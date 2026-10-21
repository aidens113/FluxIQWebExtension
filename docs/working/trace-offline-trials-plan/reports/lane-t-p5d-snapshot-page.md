# Lane T P5d: the sandboxed snapshot page and its headed check (t749)

Worker: P5d (worker-high). Trees: `fxwork/t749/!FluxIQWebExtension` (edited), `fxwork/t749/!FluxIQ` (read only, not touched).

## Outcome

Done. `openWebSnapshotPage` implements the domain's `WebSnapshotPage` port with Playwright. It runs the extension's built
content code in an isolated world over a recorded snapshot, with page scripts and the network off. An action reaches
the content code through the background's own `executeAction` builder, which this unit moved into a shared module
and switched the background to. The headed spec passes on job-board, photo-social and social-network-feed in Chrome,
on job-board in Edge, and in the dynamic case on photo-social: 5 of 5, 1.0 min. In all four changed-read cases B's rows
and cells offline equal B's live rows and cells exactly.

Factory: `openWebSnapshotPage(options: WebSnapshotPageOptions): PlaywrightWebSnapshotPage`, exported from
`packages/test-runner/src/offline-snapshot-page/index.ts`. The options are `{ content: SnapshotContentCode; channel?:
"chrome" | "msedge"; headless?: boolean; browser?: Browser }`, and
`SnapshotContentCode = { contentScript; pageWorldScript; actionMessage(action, frameId) }`. The return value is
`WebSnapshotPage & { close(): Promise<void> }`.

## What changed and why

- **The shared builder** is `apps/extension/src/shared/execute-action-message.ts` (`executeActionMessage(action,
  frameId)`) with its test in `shared/tests/`. `apps/extension/src/runtime/action-runner.ts` now builds its message with
  it. That is a one-line switch plus the import. Behaviour is unchanged: the existing `action-runner` tests pass.
  The background has no continuation loop for a DOM read. Its only loop is the Next-page press across documents
  (`runtime/next-page-continuation.ts`), and a snapshot cannot load another document, so offline that navigation is
  held and counted instead.
- **Why the builder is passed in.** The test-runner compiles with `rootDir: src`, so it cannot import extension source.
  `SnapshotContentCode.actionMessage` therefore takes the background's builder as given. The spec passes
  `executeActionMessage` itself, never a lambda that restates it.
- **`packages/test-runner/src/offline-snapshot-page/`** (10 files, 6 tests):
  - `routes.ts` is the pure route decision. The primary is served once at the snapshot's address with
    `script-src 'none'`. Each resource is served at its source with its own media type, and an HTML resource also gets
    `script-src 'none'`. A navigation the route cannot answer, including a second one to the page, gets a 204. Any other
    request is aborted (`internetdisconnected`). A non-document primary makes the snapshot unavailable.
  - `canaries.ts` holds the spike's two canaries.
  - `sandbox-runtime-stub.ts` is the `chrome.runtime` stand-in.
  - `scroll-watch.ts` wraps the scroll APIs of the isolated world only, so only the content code's requests count.
  - `content-world-source.ts` builds one isolated-world script in a fixed order: watch, stub, content bundle. Every
    script it injects is named `fluxiq-snapshot-*`.
  - `open-snapshot-sandbox.ts` sets up a fresh `offline: true` context and the route. It counts leaks at the context
    level, so popups are counted too, and counts websockets. It counts scripts through CDP `Debugger.scriptParsed`,
    with pauses skipped. It also tracks the isolated world.
  - `evaluate-over-snapshot.ts` returns `unavailable` in these cases: the action is addressed to a child frame; the
    primary is not a document; the load fails; the content code never sends `fluxiq.contentReady` within 5 s; or the
    content code does not answer, throws, or stalls past the action's `timeoutMs` plus 30 s.
  - `open-web-snapshot-page.ts` launches the browser lazily: Chrome by default, `msedge` by option, none when given a
    browser.
- **Observations.**
  - `scriptsRan` is the page scripts parsed plus the canaries that ran.
  - `requestsLeaked` is the requests that finished without the route answering them, plus websockets.
  - `navigationsHeld` is the 204 answers.
  - `requestsRefused` is the aborted requests.
  - `scrollsPastEnd` counts two kinds of request. One is a scroll that asks for the end of a container or the page,
    or past it. The other is a reveal (`scrollIntoView({block:"end"})`) that **moved anything**, or that left its
    scroller at its end.
- **The headed spec** is `apps/extension/e2e/content/tests/offline-reads/tests/`:
  - `offline-reads.spec.ts`;
  - `list-read.ts`, which plans the read with the spike's detection and drop of collapsed fields, then runs it bounded;
  - `capture-snapshot.ts`, which uses the production `TracePageCapturer`, imported through its barrel. Its send goes
    through the harness and its upload keeps the bytes. It builds the snapshot from the references and bytes the
    capturer returned;
  - `harness-content-code.ts`, which takes the bundles from the harness's global setup plus `executeActionMessage`.

  B is A's other fields. A list of one field would instead be read again with `maxItems: 3`.

## Live vs offline (final run, `run4`; counts only)

| Site (browser) | A live rows | B live rows / status | B offline rows / status | cells equal / compared | scriptsRan | leaked | held | refused | scrollsPastEnd | offline ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| job-board (Chrome) | 12 | 12 / succeeded | 12 / succeeded | 84 / 84 | 0 | 0 | 0 | 0 | 1 | 2963 |
| photo-social (Chrome) | 27 | 27 / failed `output_not_observed` | 27 / failed `output_not_observed` | 566 / 566 | 0 | 0 | 0 | 0 | 1 | 6180 |
| social-network-feed (Chrome) | 34 (failed `output_not_observed`) | 34 / failed `output_not_observed` | 34 / failed `output_not_observed` | 906 / 906 | 0 | 0 | 0 | 0 | 1 | 6932 |
| job-board (Edge) | 12 | 12 / succeeded | 12 / succeeded | 84 / 84 | 0 | 0 | 0 | 0 | 1 | 3180 |
| photo-social dynamic (Chrome) | n/a (captured before any read) | 27 / failed `output_not_observed` | 4 / succeeded | n/a | 0 | 0 | 0 | 0 | 1 | n/a |

Snapshots carried 0 resources. social-network-feed had 1 resource the capture could not carry.

## Progress log

### 2026-10-20
- Builds before editing: `node ../../scripts/check/core-build.mjs` printed `core-build: FluxIQ Core's build ... is
  current`. Running `node scripts/domain-dist.mjs` printed `{"build-cache":"build","step":"domain:build",...,"reason":"inputs changed:
  domain; not stamped, because inputs changed while it ran (core:packages/fluxiq/src)"}`. The dist then carried
  `WebSnapshotPage`.
- Shared builder, test first. `EXTENSION_TEST_BUILD_LABEL=t749-p5d node scripts/test-extension.mjs
  shared/tests/execute-action-message runtime/tests/action-runner` printed `# tests 42 # pass 42 # fail 0`.
  `npx tsc --noEmit -p tsconfig.json` exited 0 and `-p tsconfig.test.json` exited 0.
- Snapshot page, tests first. `npx tsc -p tsconfig.json` (test-runner) exited 0. `node --test
  dist/offline-snapshot-page/tests/*.test.js` printed `# tests 20 # pass 20 # fail 0`.
- Headed run 1 (`node scripts/test-content.mjs -- --headed --workers=2 offline-reads`): `4 passed`, `1 failed (1.4m)`.
  The dynamic case showed `scrollsPastEnd: 0`. The watch then counted only requests made when the scroller was
  already at its end.
- Headed run 2, which counted requests that reached the end: the same 1 failure.
- A temporary diagnostic, since removed, printed scroll positions only. On both job-board and the photo dynamic case the
  read makes exactly one reveal (`block: "end"`), and that reveal moves the page short of its end: 268 px short on
  job-board, 139 px short on photo. No other scroll call is made. The content code's own rule
  (`list-wait.ts`, `reveal-by-scroll.ts`) is that a reveal that moved may have woken a loader and is waited on. The watch
  now counts a moved reveal. Unit tests were updated to match, and the 20 pass.
- Headed runs 3 and 4: `5 passed (1.4m)`, then `5 passed (1.0m)`. The pass lines are quoted below.
- Audit fixes made in my files: an `as never` cast became a typed `getComputedStyle`; a caught URL failure returned as
  absent became `URL.canParse`; three files with the `snapshot-` prefix were renamed to `canaries.ts`, `routes.ts` and
  `page-options.ts`; and a deep import of `hash-capture-parts` was replaced by the production capturer through the
  `trace-capture` barrel.

UNIT READY: apps/extension/src/shared/execute-action-message.ts, apps/extension/src/shared/tests/execute-action-message.test.ts,
apps/extension/src/runtime/action-runner.ts, packages/test-runner/src/offline-snapshot-page/**,
apps/extension/e2e/content/tests/offline-reads/**, this report.

## Commands run and observed results

- `npx tsc -p tsconfig.json` (packages/test-runner): exit 0.
- `node --test dist/offline-snapshot-page/tests/*.test.js` (packages/test-runner): `# tests 20`, `# pass 20`, `# fail 0`.
- `npx tsc --noEmit -p tsconfig.json` and `npx tsc --noEmit -p tsconfig.test.json` (apps/extension): both exit 0.
- `node scripts/test-extension.mjs shared/tests/execute-action-message runtime/tests/action-runner` (apps/extension):
  `# pass 42`, `# fail 0`.
- `node scripts/test-content.mjs -- --headed --workers=2 offline-reads` (apps/extension), final run:
  ```
  ok 1 ... job-board (chrome): a changed read over the production capture gives the live rows (11.0s)
  ok 2 ... photo-social (chrome): a changed read over the production capture gives the live rows (27.1s)
  ok 3 ... social-network-feed (chrome): a changed read over the production capture gives the live rows (36.6s)
  ok 4 ... job-board (msedge): a changed read over the production capture gives the live rows (10.9s)
  ok 5 ... photo-social (chrome): a read past a feed captured before it grew shows the snapshot was asked for more (13.7s)
  5 passed (1.0m)
  ```
  I ran the script directly, not through `pnpm test:content`. That package script starts with
  `scripts/check/core-build.mjs`, which reported `FluxIQ Core's build ... is not current with its source` because of
  parallel Core edits, so I ran the wrapped command myself. I did not build Core. `test-contracts:build` reported
  `reuse`.
- `node scripts/structure-audit.mjs` (root): `structure-audit: 99 violation(s) across 1 rule(s)`, all from
  `package-exports`. Every other rule passes. That rule is P5e's new, uncommitted rule. 97 of its findings were already
  there, including `e2e/content/harness.ts` loading `packages/test-runner/src/realistic-scenarios/index.js`. The other
  2 are mine: the spec and `harness-content-code.ts` load `packages/test-runner/src/offline-snapshot-page/index.js`,
  which is the same e2e-to-test-runner-source pattern. `action-runner.ts` went from 586 to 587 lines; the file-lines
  limit there is advisory only.

## Not verified

- The page has not been run against a snapshot read back from Core's trace store. The spec builds the snapshot from the
  production capturer's own references and bytes, which are exactly what it would upload.
- Child-frame actions are refused as `unavailable` and were not exercised. `capture_snapshot`'s merge of frames
  (`look-across-frames.ts`) is not reproduced: the sandbox answers from the top frame only.
- Firefox is not covered, because the port's CDP proofs are Chromium-only.
- The websocket count and held navigations did not occur in any run (both stayed 0), so they are untested live.
- The full suites were not run, per the narrow-checks rule.

## Open questions or contradictions found

1. **Path in the brief.** The brief names `apps/extension/src/background/runtime/**`, which does not exist. The
   background's action runner lives at `apps/extension/src/runtime/action-runner.ts`, and I edited it with a one-line
   switch on that reading. Please confirm.
2. **`scrollsPastEnd` is 1 on every read, static or not.** Each one-page read reveals its list's end once, and that
   reveal moves the page. The page alone cannot tell job-board's static list from photo's growing feed. The domain's
   `recorded-list-ended.ts` is what separates them. That matters here: social's recorded read A **failed**
   (`output_not_observed`, with one collapsed field already dropped), so the domain will treat social reads as
   `dynamic_content` even though offline equals live exactly. The same holds for any recorded read that fails. P5c and
   the lead should decide whether that is intended.
3. **The `package-exports` rule (P5e) flags e2e imports of test-runner source,** including the existing `harness.ts`.
   Two ways to resolve it: allow e2e to import test-runner `src/`, or give test-runner a subpath export and have the
   extension declare the dependency. Both need files I do not own.
4. **Copies kept on purpose, consolidation possible.** `canaries.ts` and `sandbox-runtime-stub.ts` follow the spike's
   `arm-capture.ts` and the harness's `runtime-stub.ts`, which I did not own. Those e2e files could import from the
   test-runner, as `harness.ts` already does for realistic scenarios.
5. **The test-runner root `src/index.ts`** does not export the new module, because the file is not mine. Wave 2
   consumers import `offline-snapshot-page/index.js`.
