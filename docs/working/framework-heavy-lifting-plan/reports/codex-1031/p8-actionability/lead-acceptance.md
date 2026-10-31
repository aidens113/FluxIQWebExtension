# t827 actionability lead evidence

Status: Read-only contract/compatibility design. No API/version frozen or new
source emission. Core0.18/contracts0.4 baseline SDK prepared; downstream full
workspace build skipped. No paid call, panel management or new full suite.

`pnpm.cmd task start runtime-actionability-signal --worktree --core --skip-workspace-build`
->exit0, both t827 branches/worktrees created, offline installs, all3 required
Core SDK packages built (contracts11.6s/Core87.2s/gateway4.8s). Lab CLI bin warning
reflects intentionally unbuilt downstream test-runner output; no Lab launched.

Private Core accepted t826 ledger archived verbatim before the preserved footer,
payload SHA256 057496d0c1c84c2fa0ae9a3199355ada7b0457f85e65740781a2712240d3e7fb,
prior archive prefix retained. Core798lines; Down383lines. Working-doc indexes
regenerated in both main/private trees without baseline changes.

Independent lead source verification after discovery's compatibility finding:

- Core `client-gateway/service/command-ledger/dispatch.ts:230-239`: exact result
  top-key allowlist excludes actionability. Payload/metadata need only be objects;
  accepted results are structured-cloned. A new top-level wire field is unsafe
  for an old Core; an optional closed subfield within existing payload is viable.
- `ClientGatewayInFlightRecordStore` retains command identity/type/committing/time
  and optional place, not a completed result. No actionability belongs there.
- `ClientGatewayCommandReconciliation.settled` keeps the full result in its
  in-memory recent map and removes the in-flight record. Reconciliation can read
  a complete queued action result without rerunning its action.
- `ClientGatewayOutbox.actionResult` retains all result members and normalizes
  interrupted status to unknown. Its message payload object is not rebuilt.
- Actual browser persistence is `background/connection/outbox/store.ts`, which
  writes the entire queue into session storage and reads through readSavedOutbox.
  `background/saved-state.ts:89-105,128-141` filters malformed queue bindings and
  removes invalid byte counts but retains each message/payload unchanged. Thus a
  valid payload.actionability survives storage reload without extending an old
  exact result schema. Future acceptance needs an executable restart/replay test.

Direction under review: portable boolean/closed cause, no geometry/text/DOM;
wire carrier only existing payload.actionability; host typed IO lift after strict
optional parse, no receipt changes or invented host negotiation. Missing stays
unknown; malformed optional controls cannot erase an actual result. A negative
measurement never proves unacted/transient or permits repeating a committing act.
Do not invent actionable:true on success that bypassed a real measurement.


Reader interface acceptance: lead independently ran45contract tests,53Core owning tests, contracts/fluxiq package checks and contracts library builds. Initial audit found2 caught-absence branches and1 leaf import; private typed validation/read outcomes with explicit reasons fixed them without public API/rule/baseline change. Final reader tests53pass, packagechecks exit0, audit1144unchanged.

Phase2 lead command is the exact12-file command in core.md ->240passed/12files,51.25s. Core check found2 new test fixtures missing mandatory withheldValues.numbers; root added empty numeric lists and reran runtime service+withholding ->24pass/2files,3.54s. Final fluxiq check ->exit0,18.3s. Core audit ->passed1144unchanged (481warnings). Three SDK libs rebuilt ->exit0, contracts reuse/Core85.7s/gateway4.5s. Core/contract unique338 tests;24fixture rerun overlaps. No full suite.

First Down structure audit failed10 findings (directory headroom/imports/statement layout). Separate disjoint SolHigh browser and SolMax host repairs moved grouped check test and cohesive location helper, fixed imports/format only. Latest Down audit exit0, baseline615unchanged; footer was outside captured tail, so recorded as exit0 rather than invented output. No rules/limits weakened.

First Domain affected selection335tests ->327pass/8fail,119.68s. Six legacy press request assertions omitted the existing t824 canonical commit floor; one bare-code modal fixture omitted positive pre-dispatch unacted evidence; one new harness fixture navigated to its current URL and was correctly refused as no progress. Root corrected the navigation fixture to a distinct same-scope destination and its fake page location. Max worker owns only the2legacy test files, retaining strict permission/floor guards and adding an unknown-effect contrast. Domain check/build stopped at one missed exhaustive expectation-result builder optional field; root explicitly supplies unknown actionability because that passive evaluator measures status alone. All remaining acceptance is pending these focused reruns.

Lead-added compatibility coverage: actual browser mapper into old allowed top-level envelope and serialized actual outbox storage restart, all4 portable records, failed ambiguous outcome retained; optional browser getter cannot erase succeeded queued result. Lead real-browser assertions extend existing job-board native lost-ack Save and company-website checked/disabled controls, preserving all existing oracles. These tests have NOT run yet; SDK nowready, Domain build must pass first.

Final host correction: four owning selectors ->31 passed, zero failed; JSON snapshot fixture role was then omitted when absent rather than assigned undefined; its three tests pass again. Domain check and build ->exit0. Extension initial selection102 ->94 pass/eight fail: new covered post-press test reused shared CLICK, poisoning command-scoped extra-press history. Lead supplied a fresh command object per case. Owning click+actual outbox rerun ->68/68 pass. Extension typecheck first failed two new outbox validation fixtures missing expected/actual; corrected truthful complete validation records. Final typecheck and provider-free three-test native browser proof running. No production behavior or assertions weakened.

Native browser acceptance: pnpm.cmd --filter @fluxiq-web-extension/extension test:content action-effect/tests/client-floor.spec.ts check-assert.spec.ts --workers=1 --grep [three exact named tests] ->3 passed,1.1m. Headless Chromium134.0.6998.35, UTC, content/page-world bundles and native Core graph on job-board/company-website; no full extension background/panel/Firefox exercised. Save lost acknowledgement: one save, zero unsaves/alternative actions, terminal uncertain; authored positive actionability ignored. Real check positive and disabled negative retain actual fixture server/state oracles. Main ignored HTML test-runs/2026-10-31-t827-browser-report/index.html, logs in sibling t827-validation. No paid calls. Final Core audit ->passed481warnings/1144unchanged.

Extension check then exposed the same new outbox fixtures using gateway completedAt on the browser result (finishedAt). Root corrected both to the actual browser contract; seven outbox tests pass again. Final check/build running; no production changes since browser acceptance.

Extension final check ->exit0 (39.9s), package build ->exit0 (23.4s), verified22files for each Chrome/Firefox/e2e target. Full Down audit found one contract-spread in the new JSON test fixture. Root gave all four fake controls their explicit semantic role instead of conditional fields; three owning tests pass again, final domain check running. Production source remains browser-accepted.

Exact browser command: `pnpm.cmd --filter @fluxiq-web-extension/extension test:content action-effect/tests/client-floor.spec.ts check-assert.spec.ts --workers=1 --grep "canonical committing Save|check: sets the checkbox|check: a disabled control"`. Final affected unit commands are the four host selectors named above (31pass), click/outbox selectors (68pass), outbox alone after finishedAt correction (7pass), harness alone after explicit JSON role (3pass). Initial unique selected Domain335 plus one new unknown-outcome test; extension102; unchanged passes plus focused fixed-file reruns establish current acceptance, not one invented whole-suite pass.

Final domain check after explicit JSON roles ->exit0,10.5s. Final full structure audit (not a test suite): Core passed481warnings/1144baselined; Down passed238warnings/615baselined. Baselines/rules/limits unchanged. Source/tree accepted for paired task commit/integration; no new source or model call.
