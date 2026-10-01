# Codex cleared wait gaps ? t216

Status: Complete (supervisor verified; locally committed)
Owner: codex worker wait_gaps
Scope: Task 4 in isolated downstream/Core pair only.

## Current State

Task 4 source and report are complete and frozen. Current Core focused regressions passed 3 files /43 tests; Core tsc, structure and full build passed. Final downstream extension check/build/smoke passed; extension suite passed1677tests and unlabelled domain suite passed1063tests, with zero failures/skips. Downstream structure passed. Supervisor independently verified final Core43 and extension65 focused regressions and inspected actual suite logs. Core commit90dfd1db; this report is committed with downstream implementation. No merge or push; Claude owns integration.

## Findings and decisions

- Navigation attaches checkWait only on success; refused click landing discards the settled wait.
- Existing domain lifting already handles failed results; regressions will exercise those paths.
- Generic gateway transport cannot read web payloads. Supervisor approved optional generic clearedWait on ClientGatewayActionResult, downstream result mapping, and defensive Core transport reading.
- No existing Core runtime/service test is edited. Supervisor approved new runtime-session/tests/parked-expiry.test.ts only for expiry/delete settlement.
- Deadline settlement uses run serialization; timers are unrefed and removed on close/delete. Persistence failure must retain the waiting row and report the error.
- Forbidden areas, Lab, browser, Playwright and provider calls remain untouched.

## Validation

Validation history follows; earlier revisions and superseding checks are explicitly identified.
- Observed first Core focused run: `& "C:/Program Files/Git/bin/bash.exe" "C:/Users/osrs_/FluxStuff/build-slots/heavy.sh" "codex t216 core focused" pnpm exec vitest run activity executor runtime-session client-gateway-transport` from Core packages/fluxiq -> exit 0; 57 files, 632 tests passed, 46.19 s. No timeout flags, skips, browser or provider calls.
- Supervisor review added bounded summary-page deadline restoration, rejection of overlapping project deletion, async close waiting for in-flight settlement, and preserved class/file-size ratchets by keeping raw persistence in the original private method.
- First Core tsc rejected two test typing cases (undefined optional deadline assignment and intentionally malformed gateway field); fixed with delete and explicit untrusted-value cast.
- First Core structure audit rejected queue-tail catch syntax and screened timer failure callback. Queue tails now use the documented then success/failure form; retry callback states its screened best-effort handling explicitly. Service baseline dropped; no ratchet increased.
- Observed rerun `pnpm exec tsc -p packages/fluxiq/tsconfig.json --noEmit` -> exit 0 in heavy Core gates command.
- Observed Core `node scripts/structure-audit.mjs` -> passed (203 warnings, 353 baselined).
- Observed Core `pnpm structure:baseline` -> service.ts file-lines lowered 4505 -> 4493; baseline written, 353 entries across 10 rules. No other ratchet changed.
- Core `pnpm build` now running to regenerate private contracts, fluxiq, gateway and web packages before downstream tests.
- Full Core `pnpm build` -> exit 0: contracts, fluxiq, gateway websocket rebuilt; Next.js web compiled, types validated, 17 static pages generated. Last web cache step 271545 ms. This preceded final parser fix and is not final verification of that fix.
- Discovered seeded Core exact-key list rejected clearedWait entirely while downstream listed it. Supervisor approved allowlist-only change and parser regression. Integration overlap: Task2 independently adds diagnostic to the SAME Core evidence-loop-decision.ts exactKeys line; final merged union must contain BOTH diagnostic and clearedWait. No Task2 source copied or depended upon here.
- Added public summary/delete wiring regressions and failed cancellation persistence regression to the new parked-expiry test file only.

## Files changed

Downstream:
- apps/extension/src/runtime/action-runner.ts: attach the cleared check fact after constructing every navigation verdict.
- apps/extension/src/runtime/click-landing.ts: preserve the wait when the post-check HTTP destination is refused, including an unloaded-page reply.
- apps/extension/src/runtime/result-mapping.ts: lift the screened generic gateway field.
- apps/extension/src/runtime/tests/{navigate-action,click-landing,result-mapping}.test.ts: failed-navigation/refused-click/wire regressions.
- domain/src/io/tests/gateway-output-dispatcher-check-wait.test.ts and domain/src/runtime/tests/adapter-check-wait.test.ts: failed-result lifting regressions.
- docs/architecture/extension-client.md: updated cleared-check and parked-ask behavior.
- This report; supervisor-owned codex-cleared-wait-gaps-brief.md retained separately.

Core:
- packages/contracts/src/client-gateway.ts: backward-compatible generic optional clearedWait.
- packages/fluxiq/src/runtime/client-gateway-transport.ts and tests/client-gateway-transport.test.ts: defensive dispatch/event lifting.
- packages/fluxiq/src/programs/automation-studio/runtime/service.ts: deadlines on write/read/list/bounded summary pages; guarded cancellation/delete/close.
- runtime/service/runtime-session/{parked-expiry,index}.ts: focused expiry/cancellation persistence lock and teardown.
- runtime/service/runtime-session/tests/parked-expiry.test.ts: new file only; no existing service tests edited.
- runtime/llm/evidence-loop-decision.ts and runtime/llm/tests/evidence-loop-tool-failure.test.ts: allow clearedWait without refusing the typed execution; activity observer owns its meaning.
- docs/architecture/{automation-studio,runtime-kernel}.md: contract and lifecycle behavior.
- .structure-baseline.json: lower service file-length ratchet only.

## Integration ownership

All source is isolated in t216. The only expected Task2 overlap is the Core exactKeys line in runtime/llm/evidence-loop-decision.ts: keep its diagnostic addition and this task's clearedWait addition. No source in Task2's run.ts/capture.ts, excluded Core storage/conversations/context-packet areas, existing runtime/service tests, or Claude worktrees changed.

## Not exercised

No Lab, live/browser/Playwright runs, model-provider calls, panel processes, or real page data. Timer/persistence and gateway semantics are verified with controlled unit inputs; browser rendering and real gateway round trips remain unverified as required by the task restrictions. No commits, merges or pushes performed by this worker.

- Kept llm/tests within its 25-file cap: moved the six parser regressions into existing evidence-loop-tool-failure.test.ts and removed only this worker's new untracked parser test. Existing runtime/service tests remain untouched. The final queued activity/executor/runtime-session/transport command does not match this moved file; run it separately by evidence-loop-tool-failure name.
- Final Core broad focused tests: `& "C:/Program Files/Git/bin/bash.exe" "C:/Users/osrs_/FluxStuff/build-slots/heavy.sh" "codex t216 final core tests" pnpm exec vitest run activity executor runtime-session client-gateway-transport cleared-wait-result` from Core packages/fluxiq -> exit 0; 57 files / 637 tests passed; 39.87 s. New parked-expiry file: 14 tests passed; transport: 7 tests passed. The absent moved parser-file fragment matched no file; parser regressions are validated separately below.
- Final parser regression: `& "C:/Program Files/Git/bin/bash.exe" "C:/Users/osrs_/FluxStuff/build-slots/heavy.sh" "codex t216 parser regression" pnpm exec vitest run evidence-loop-tool-failure` from Core packages/fluxiq -> exit 0; 1 file /18tests passed, including 6 new cleared-wait parser cases; 24.32s.
- Final Core gates: tsc exit0; structure passed (203 warnings,353 baselined); contracts/gateway builds reused current stamps and fluxiq rebuilt current source (110392ms). Web build still running. Downstream stage can now consume current private Core packages.
- Prior final Core full build exited0 (web step230011ms), before the following helper correction. It verifies the earlier revision only.
- Material partial-write edge corrected: unconfirmed before/after/resolution records retry the full persistence path even when the terminal session file was already stored before an index/detail failure. Exact canonical snapshot equality prevents overwriting newer work. Expiry, direct cancellation and deletion cancellation use the same path; deletion is not attempted until cancellation persistence succeeds. Added partial expiry/deletion/moved-on regressions.
- Own queued downstream session98137 was cancelled before slot acquisition because its prerequisite changed; no downstream checks ran in that session. Only own verified bash processes were stopped; no Claude jobs touched.
- Corrected-helper focused run: `& "C:/Program Files/Git/bin/bash.exe" "C:/Users/osrs_/FluxStuff/build-slots/heavy.sh" "codex t216 partial-write regressions" pnpm exec vitest run parked-expiry client-gateway-transport evidence-loop-tool-failure` from Core packages/fluxiq -> exit0; 3files/43tests passed, including all18expiry/lifecycle cases,7transport cases,18parser cases;34.68s.
- Unconfirmed retry records are process-local and operate while this service is alive. They prevent a partial session/index/detail write from being misread as completed, and skip any stored session that moved on. No new durable journal or storage contract is introduced.

- Corrected-helper Core tsc exit0; Core structure passed (203warnings,353baselined) in partial-write gates. Current-source Core build is running.
- Corrected-helper private Core libraries are current: contracts and gateway reused stamps; fluxiq rebuilt source in164771ms. Final full Core web build still running. Fresh downstream stage42697 has acquired its own heavy slot and runs extension check/build/test, domain test, structure in that order.
- Supervisor independently observed final3files/43tests pass; worker source remained frozen during that validation. Earlier supervisor intermediate-revision failure is superseded, not counted as final validation.

- Current-source Core full gates session62239 completed exit0: fluxiq tsc, structure (203warnings,353baselined), and full pnpm build. fluxiq rebuilt164771ms; web rebuilt273910ms and generated17static pages. Fresh downstream extension check exit0 (231015ms); extension build exit0 (28165ms), all Chrome/Firefox/e2e-chromium bundles verified22files each. Extension/domain tests and downstream audit are running next.

- Fresh downstream extension suite exposed two navigation gaps: workerActionResult's explicit field copying dropped the spread checkWait, and the new no-op fixture selected the intentional no-reload-at-check branch. Suite exit1:1677tests/1675pass/2fail/0skip; domain/audit did not start. Fixed only action-runner by attaching the screened fact AFTER navigationResult builds any verdict; corrected own fixture to ordinary preflight then a self-clearing post-reload check with ignored reload. Current Core validation remains valid; downstream gates will rerun frozen corrected source.

- First correction rerun stopped at extension check: local checkWait name collided with the earlier destructured wait (exit1,32012ms). Renamed only new local to clearedWait; no other source changed. Full downstream checks requeued.

- Corrected navigation narrow suite rebuilt under own ignored label codex-navigation-final:20tests passed. Initial PowerShell redirected wrapper reported exit1 despite unit summary20pass due stderr handling; explicit native confirmation completed exit0 with20pass/0fail/0skip in46357.8671ms. Confirmation: heavy label codex t216 navigation narrow confirm, node --enable-source-maps --test .test-build-scratch/codex-navigation-final/navigate-action.test.mjs. TEMP/codex-t216-navigation-confirm.log is authoritative.

- Final corrected downstream extension gates: check exit0 (263620ms); build exit0 (390988ms), Chrome/Firefox/e2e-chromium each22files verified; smoke passed; full unit suite exit0 with1677tests/1677pass/0fail/0skip/0cancelled in128769.7618ms. Own final default bundled test path: apps/extension/.test-build-scratch/default/runtime/tests/{navigate-action,click-landing,result-mapping}.test.mjs. Unlabelled domain suite and audit running next.


## Final validation and handoff

- Supervisor independently ran `heavy.sh 'codex t216 supervisor browser-result regressions' node --test apps/extension/.test-build-scratch/default/runtime/tests/navigate-action.test.mjs apps/extension/.test-build-scratch/default/runtime/tests/click-landing.test.mjs apps/extension/.test-build-scratch/default/runtime/tests/result-mapping.test.mjs` from downstream t216: exit0,65tests/65pass/0fail/0skip,29187.6464ms. This includes failed navigation, refused clicks and outer gateway field screening.
- Supervisor inspected actual corrected final TEMP logs: extension1677/1677 and domain1063/1063, zero failures/skips, current extension check/build stamps, and downstream audit output. Independently reviewed final navigation/click/result mapping, generic transport/parser seam, expiry locking/partial-write retry and boundaries. No new storage or conversation-runtime changes.

- Final downstream heavy session74382 completed exit0. Domain owning unlabelled test command passed1063tests/1063pass/0fail/0skip/0cancelled in54356.5063ms and regenerated ignored domain artifacts. Downstream structure passed135warnings/119baselined. Both repositories git diff --check exited0 (line-ending notices only).
- Final current-source Core: 3files/43tests passed (18expiry/lifecycle,7transport,18parser), supervisor independently repeated them; tsc exit0; structure203warnings/353baselined; full pnpm build exit0. Earlier broad activity/executor/runtime-session/transport run637tests is retained as earlier-revision evidence, not counted as final helper verification.
- Final downstream extension: check/build/smoke exit0; 1677tests/1677pass, no failures/skips. Narrow navigation20tests/nativeexit0. Chrome/Firefox/e2e-chromium22bundle files each verified.
- Exact final TEMP logs (root C:/Users/osrs_/AppData/Local/Temp): codex-t216-extension-check.log; codex-t216-extension-build.log; codex-t216-extension-test.log; codex-t216-domain-test.log; codex-t216-downstream-structure.log; codex-t216-navigation-confirm.log. These contain the corrected final downstream revision.
- Independent supervisor extension regressions can execute existing generated files under C:/Users/osrs_/FluxStuff/fxwork/t216/!FluxIQWebExtension/apps/extension/.test-build-scratch/default/runtime/tests/: navigate-action.test.mjs, click-landing.test.mjs, result-mapping.test.mjs. Do not rebuild them concurrently.
- Source/report now frozen for supervisor append and commit. No excluded files or Claude trees touched. Integration union remains diagnostic+clearedWait on Core evidence-loop-decision.ts exact-key line. Live/browser/Lab/provider behavior and durable retry across process restart are not claimed; process-local unconfirmed retry is the documented bounded contract.
