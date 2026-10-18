# Codex paging person handoff (t565)

Status: Ready for supervisor integration/review; targeted browser, unit, type and structure checks passed. No paid run authorized or started.

## Source correction and scope

The brief inherited an obsolete assumption that a supported `extract_list` moves itself across pages. Current S4/S7 architecture explicitly refuses multi-page requests in `domain/src/output-nodes/extract-list/dispatch.ts` / `domain/src/actions/extraction/retired-paging.ts`; `runtime/action-runner.ts` sends reads without checkpoint transport, and `runtime/tests/list-read-delivery.test.ts` proves legacy requests cannot revive that transport. The supported path is one-page read → Next page → repeated read, with Core collecting each pass. Supervisor confirmed preserving that architecture. No generic Core resumable contract or retired checkpoint transport was added.

Core's existing person parking is correct for this completed-move case: Continue routes to the next node, and a build's tool wrapper stands the completed step and takes a fresh look. Re-dispatching Next after the person would incorrectly move again. The patch detects only after dispatch/marked arrival; it does not call a blocked, unperformed move complete.

## Root cause and fix

The run debug `run-mvd9554h-42cdf9b7` identifies page 3 as the marketplace's person-only traffic screen. `arrival.ts` previously checked HTTP refusal/missing list and could reload instead of asking the person; `list-change.ts` likewise waited for list change/render and could follow a link fallback while a check stood there.

`PageMovePersonCheck` now reads the same generic `robotCheckIn` evidence as click/navigation. Person-only checks throw a local typed sighting; self-clearing checks are waited for up to 15 seconds within the command deadline, and expiry produces the existing `not_cleared` sighting. Arrival asks this before HTTP status or reload, and polls it while awaiting the list; in-document pager moves ask before fallback and while waiting for changed/rendered results. No check is clicked, solved or reloaded by the automation.

`movePage` converts the local sighting into `PageMoveOutcome { outcome: "needs_person", sighting }`; `nextPageAction` delegates it to existing `deps.needsPerson` / `actionNeedsPerson`, preserving USER_INTERVENTION_REQUIRED and its `captcha:` evidence. It invents no moved/ended answer. A marked landing can be acknowledged after the person without pressing again; an actual Flow continues straight to its next one-page read.

Owned source changes are `content/extraction/page-advance/{person-check,arrival,list-change,move-page,move-outcome,index}.ts` and `content/actions/next-page.ts`; tests beside those subjects and `e2e/content/tests/extraction/tests/crossborder-next-page-person.spec.ts`; authored docs `docs/architecture/extension-client.md`. Additional notified path `content/action-runtime/robot-check/index.ts` re-exports the classifier through its focused barrel; importing the action-runtime root barrel would create an execution/extraction cycle. No Core source edits, model-guidance changes, scenario/oracle edits or other lane changes.

## Validation ledger

- First targeted unit run: 12/13 passed; the single failure was the new test incorrectly expecting the **outer failure envelope** inside the **result payload**. The existing payload contract intentionally excludes it. The assertion was corrected to check the outer failure and absence of fabricated nextPage data.
- Changed-directory unit run: **66/66 passed**, 42.3 seconds (`EXTENSION_TEST_BUILD_LABEL=codex-paging-person node scripts/test-extension.mjs content/extraction/page-advance/ content/actions/tests/next-page.test`, from apps/extension). Covers 429-person handoff precedence, marked arrival after human clear with no second press, self-clearing success/expiry, in-place check before fallback, and typed action routing. Subsequent changes add self-clearing waits around in-document fallback; final narrow recheck required.
- Initial Core guard correctly refused t565's 115-minute-stale compiled output. Rebuilt only this lane's three Core libraries. Core HEAD **4d6fb8b6**, no source changes. Contracts/gateway reused their current stamps; fluxiq rebuilt and wrote its identity/stamp. Optional shared-store publication then stalled with no build children; supervisor was notified, owned publication PID 10128 was stopped after output/stamp completion, and cache-off three-library command completed successfully in **9.2 seconds**, all three steps `reuse`, source `stamp`, exit 0. No modules were rewritten by that reuse.
- Exact successful Core command: `FLUXIQ_BUILD_CACHE_DIR=off pnpm.cmd --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build` (PowerShell environment assignment used). `runtime-build-identity.json` and successful build stamp verified present; the guard then reported compiled Core current with source.
- Final narrow handler/transport unit run: **29/29 passed**, 17.3 seconds. Includes new person tests, list-change tests, next-page continuation and retired list-read delivery tests. Existing Core executor person-needed tests: **14/14 passed**, covering Continue and Stop/timeout/durable parking behavior; no Core source changed. The command also named a nonexistent parking test filename, so Vitest ran only the real executor file; no parking-wrapper coverage is claimed.
- Structure audit initially rejected a new root-barrel cycle and one packed test statement. Re-exporting via the existing focused robot-check barrel and expanding the statement resolved both. Final observed audit: **passed, 208 warnings, 638 baselined; AUDIT_EXIT=0**.
- First browser attempts exposed harness setup mistakes: auto-detection did not identify the intended results pager, and the fixture's apparent Next is an inert div. Corrected the harness to use the actual results card selector and real numbered links, matching the fixture's supported path. The corrected realistic harness **passed 1/1**, 26.1 seconds total / 10.5-second test.
- **Fail-first browser reproduction:** temporarily disabling only the new check helper produced the run's exact former failure on page 3: expected `web.intervention.required`, received `web.validation.output_not_observed`. Helper restored completely; final restored-source harness **passed 1/1**, 51.5 seconds total / 11.4-second browser test. No temporary probe code remains.
- Extension package check previously passed, then another pass was deliberately not stamped because the harness changed during it. Final frozen-source check **passed and stamped**, exit 0, 51.7 seconds. `git diff --check` passed. No live/paid/full suites launched.

Exact final commands from the downstream root or apps/extension as appropriate:

```powershell
$env:FLUXIQ_BUILD_CACHE_DIR='off'
pnpm.cmd --filter @fluxiq-web-extension/extension check
```

```powershell
node scripts/test-content.mjs -- crossborder-next-page-person --workers=1
```

## Browser proof completed

The new headless Chromium content harness uses only realistic crossborder-marketplace: dismisses welcome/consent via site controls, opens searches 1 and 2, executes the real Next page press to page 3, carries its movement mark across document replacement, and expects USER_INTERVENTION_REQUIRED on the traffic screen. It asserts no automatic search reload while waiting, then plays the person through the site's check control and executes the next one-page read on page 3. It does not replay the completed pager press. This isolates browser handoff behavior; it does not prove a full paid build/trial/playback until the supervisor's live release.
