# t646 read-one-value: worker report

## Outcome

Done, with one gap outside my files (see Open questions, item 1). A Flow can now read one value off the page with
`web.dom.extract` and hand it on as `$step.<label>.value`. The node describes itself in the catalog, in
`describe_nodes` and in `accepted.example`. Core's script-format example now shows this way of reading one value.
No live run was made.

## What changed and why

Tracing the run-time path showed that declaring the port in the domain is not enough. Core keeps an output node's
dispatched answer whole at `outputs.result` (`io-policy.ts`, both dispatch paths). Only a record capture writes a port
(`outputs.records`). Nothing would have put the read value on a `value` port, so `$node.<key>.value` would have failed
`executor.parameter.unresolved_state_path`. The fix therefore needed a small, generic Core mechanism.

Core (`C:/Users/osrs_/FluxStuff/fxwork/t646/!FluxIQ`, `packages/fluxiq/src/programs/automation-studio/`):
- `nodes/contracts.ts`: `AutomationNodePort.resultPath?` is new and optional. It applies to data outputs only and
  gives the dotted path inside the dispatched answer where the port's value lies.
- `nodes/definitions.ts`: `validatePorts` refuses `resultPath` on anything except a data output, or when it does not
  parse with the records-path grammar. The refusal code is `node.port_invalid_result_path`.
- `runtime/executor/node-execution/result-path-outputs.ts` (new; exported from the barrel only, not public): after a
  successful dispatch, it copies the value at each declared data port's `resultPath` to `outputs.<port>`. It never
  replaces a key that is already there (`records`, `result`, `error`). A path that finds nothing adds nothing.
- `runtime/executor/node-execution/attempt.ts`: `dispatchAutomationStudioEffects` now takes the declared output ports
  instead of a branch-route set. It still builds the branch set itself, and it merges the result-path outputs on the
  success branch. This file was not in the brief's owned list. It is the one place every dispatch path meets, and
  record capture also lives there.
- `flow-bootstrap/plan/flow-script-format.ts`: in "a second known way", both parts now read the booking reference
  with `node: web.dom.extract`, `target: t12`, `extract.mode: text`, and hand it on with
  `output: reference = $step.<label>.value`. They no longer use `extract_list` with `extraction.1` and `.records`.
  The doc comment says why. The example still uses rooms on a meeting-room planner.
- `flow-bootstrap/candidate/interface-output-port.ts`: header note only. A declared data port such as `value` was
  already classified as a value, and t639's undeclared-port refusal is unchanged. `route-outputs.ts` needed no
  change.
- Test support: `plan/tests/web-domain-definitions-fixture.ts` now has dom-extract declare the `value` port (with
  `resultPath`) and an `extract` parameter with a description and example, matching the domain. Two tests that had
  added their own `value` port to that fixture had to drop it, because it now duplicates the fixture's port
  (`node.duplicate_port_id`): `authoring/tests/earlier-output.test.ts` and
  `runtime/tests/earlier-output/tests/stored-flow.test.ts`.

Downstream (`C:/Users/osrs_/FluxStuff/fxwork/t646/!FluxIQWebExtension`):
- `domain/src/output-nodes/extract/` (new; barrel `index.ts`):
  - `value-port.ts`: `WEB_AUTOMATION_EXTRACT_VALUE_PORT`, a data port `value` with `resultPath: "result.extracted"`.
  - `catalog-text.ts`: the description (it names `$step.<label>.value`, and its first sentence is within 80
    characters), the tags, and the `extract` grammar. The grammar names all four modes from a total record, so a new
    mode will not compile until it is described. The example is `{mode: "text"}`.
  - `read-parameter.ts`: the `extract` parameter.
- `domain/src/output-nodes/definitions.ts`: `web.dom.extract` now declares outputs `success, failed, value`, uses the
  new catalog text, and uses the described `extract` parameter.
- `domain/src/actions/schemas.ts`: `extractReadSchema` gains descriptions for the read, its `mode` (every mode), and
  `attribute`.
- `docs/architecture/web-capabilities.md`: rewrote the "Extract text" and "Extract attributes" rows. They now describe
  the `value` output and the `extract` parameter. The old attribute row also wrongly said `mode` was not authorable,
  which has not been true since C3.
- No change was needed in `apps/extension/src/content/`. `content/actions/extract.ts` already answers `extracted`,
  `client/gateway-mapping.ts` forwards it, and the dispatcher wraps it under `result`, which gives
  `outputs.result.result.extracted`.
- Sensitive values: the gateway mapping and the runtime adapter already drop `extracted` beside a sensitive element,
  so the port stays empty for one. Saved element fingerprints are untouched. Chrome/Edge and Firefox share this path.

## Commands run and observed results

- Core: `npx vitest run` on the new and affected node-execution, nodes and flow-bootstrap test files gave 11 files,
  156 passed, 1 failed. The failure was the saved-graph `$node.s2.records` assertion. I fixed it and it passed on the
  next run.
- Core: `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap` gave 170 passed and 1 skipped files;
  2180 tests passed and 2 were skipped. An earlier run failed `earlier-output.test.ts` with `node.duplicate_port_id`;
  I fixed that test.
- Core: a vitest run over the other 16 fixture users and executor tests (llm/*, executor, tests/earlier-output,
  model-facing, call-subflow, build-judge, paged-read-proof, node-execution.test.ts) gave 77 files and 757 tests
  passed.
- Core: `npx tsc --noEmit -p tsconfig.json` in `packages/fluxiq` exited 0 with no output, both before and after the
  test edits.
- Core: `npm run build` in `packages/fluxiq` rebuilt dist (build-cache step `fluxiq:build`, 225 s) so that downstream
  sees `resultPath`.
- Core: `node scripts/structure-audit.mjs` printed `structure-audit: passed (378 warning(s), 1156 baselined).`
- Downstream: `DOMAIN_TEST_BUILD_LABEL=t646 node domain/scripts/test-domain.mjs output-nodes actions
  runtime/tests/adapter` gave 426 tests, 426 passed, 0 failed.
- Downstream: the same runner on `output-nodes/tests/definitions runtime/tests/adapter-read-value` gave 23 tests,
  23 passed. That includes the new tests 20 to 23.
- Downstream: the same runner on the extract-pinning tests under node-run, llm-evidence/repairable-parameters and
  io/tests gave 84 tests, 84 passed.
- Downstream: `npx tsc -p tsconfig.json --noEmit` and `npx tsc -p tsconfig.test.json --noEmit` in `domain` both
  exited 0.
- Downstream: `node scripts/check-extension.mjs` from `apps/extension` exited 0.
- Downstream: `pnpm structure:check` printed `structure-audit: passed (195 warning(s), 639 baselined).`

New tests:
- Core `executor/node-execution/tests/result-path-outputs.test.ts` (8 tests): unit cases, then end to end through
  `runAutomationStudioGraph`. A native read dispatches, and the next step's `$node.s1.value` resolves to the value.
  When there is no value, the port stays empty and the next step fails unresolved.
- Core `subflow-candidate/tests/route-outputs.test.ts` (3 tests): `$node.read.value` on dom-extract is a value.
  `.text` is still `subflow.output_unknown_port`, and the message now lists `success, failed, value`. `.success` is
  still `output_not_a_value`.
- Core `nodes/tests/canonical-registry.test.ts`: `resultPath` validation.
- Core `plan/tests/flow-script-format.test.ts`: this is the guidance test that pins the example. Both parts now bind
  `$node.sN.value`, and each read is `web.output.dom-extract` with `target t12` and `extract {mode: text}`.
- Downstream `output-nodes/tests/definitions.test.ts`: the value port and its `resultPath`; the description, the
  grammar naming every mode, and an example that `webAutomationExtractReadValue` accepts.
- Downstream `runtime/tests/adapter-read-value.test.ts`: the runtime adapter path. The value lies at the port's
  `resultPath` in the payload, and `extract` reaches the client. A sensitive control leaves the path empty.

## Not verified

- No live or browser run. I did not run the Playwright content tests, because no extension file changed.
- No full suites (`pnpm check`, `pnpm test`, Core's whole vitest).
- I have not checked a build's trial or exploration replay end to end (see Open questions, item 1).

## Open questions or contradictions found

1. **The replay path does not carry `value` yet.** This is in t648's area, so I did not touch it.
   `domain/src/runtime/llm-evidence/node-run/replay.ts:443` attaches node outputs only for `web.dom.extract_list`
   (`webNodeReplayFlowRows`). A replayed `web.dom.extract` answers no `outputs.value`. Core's draft and replay test
   reads replay outputs for `$step` values: `stored-flow.test.ts` feeds `outputs: { value }` from the replay. So a
   build test that replays a single read and then reads `$step.<label>.value` may fail unresolved. The fix is roughly
   one line: for `web.dom.extract`, return `{ value: payload.extracted }` when it is present. Whoever owns `node-run/**`
   should make it.
2. Debug fix 5's second half is not in this brief, so I did not do it: the `web.handle.unknown` refusal for an
   `extraction.*` handle should say where that handle comes from (`web.detect_repeating_structure`).
3. `extract` with a wrong shape (for example `{"kind":"text"}`) still passes plan validation as an object. At run time
   it falls back to the legacy `options` bag and reads text. A domain parameter contract could refuse it before the
   run. That would be a follow-up.
4. Core's architecture docs do not yet describe `AutomationNodePort.resultPath`. The brief owned only downstream
   `docs/architecture/`. The doc comments on the type and the executor module do describe it.

## Round 2

### Outcome

Done. Round 1's open item 1 (the replay path) and item 4 (Core docs for `resultPath`) are now closed.

### What changed and why

- Downstream `domain/src/runtime/llm-evidence/node-run/replay.ts`: added `replayedReadOutputs`, which replaces the
  inline outputs choice at the replay's return.
  - A replayed `extract_list` still carries its `records`, unchanged.
  - A replayed `web.dom.extract` now carries `{ value: payload.extracted }`. The port id comes from
    `WEB_AUTOMATION_EXTRACT_VALUE_PORT`. A build test that reads `$step.<label>.value` now resolves it, as the Flow's
    run does.
  - An answer with no `extracted` carries no `outputs`. A sensitive control is the case where this happens: the
    gateway mapping drops its value, so the port stays empty.
  - I did not touch t648's `arrival.ts` or `run.ts`, and t648 did not change `replay.ts`
    (`git diff HEAD dev --stat` on `node-run/` lists only arrival.ts, run.ts and shown-addresses.test.ts). The task
    branch does not contain t648 yet; you said you would do the merge.
- `node-run/tests/replay.test.ts`: added a test that a replayed single-value read answers `outputs.value`, that its
  `extract` reaches the client, and that an answer with no `extracted` carries nothing. The existing extract_list
  `outputs.records` test is unchanged and still passes, and so does the test that steps which are not reads carry no
  outputs (now titled "not a read").
- Core `docs/architecture/automation-studio-native-nodes.md`: added a new subsection, "Values a dispatch hands on
  through data ports", under Output safety. It covers:
  - what `resultPath` is, and that the importer sets it on its own port;
  - the validation code `node.port_invalid_result_path`;
  - that the executor copies the value to `outputs.<port>` only after a successful dispatch, in the same merge that
    takes a route;
  - that a failed dispatch or a missing path writes nothing (the binding then fails unresolved);
  - that existing keys are never replaced;
  - how screening and trace withholding apply.
  - `structure-audit --rule docs-links` passes.
- Downstream docs:
  - `docs/architecture/build-loop.md` ("The Rows A List Read Gives The Test") now describes the replayed
    `outputs.value`.
  - The `web-capabilities.md` "Extract text" row now lists the node's outputs as `success`, `failed`, `value`. That
    matches `definitions.ts` and the test that asserts this exact port list. The row also mentions the replay.

### Commands run and observed results

- `DOMAIN_TEST_BUILD_LABEL=t646 node domain/scripts/test-domain.mjs output-nodes actions runtime/llm-evidence/node-run
  runtime/tests/adapter` gave 783 tests, 783 passed, 0 failed. Run alone, `node-run/tests/replay.test` gave 27 of 27
  passed, including the new test 13.
- `npx tsc -p tsconfig.json --noEmit` and `npx tsc -p tsconfig.test.json --noEmit` in `domain` both exited 0.
- `pnpm structure:check` printed `structure-audit: passed (195 warning(s), 639 baselined).`
- Core `npx tsc --noEmit -p tsconfig.json` exited 0.
- Core `npx vitest run src/programs/automation-studio/runtime/executor src/programs/automation-studio/runtime/flow-bootstrap`
  gave 272 passed and 1 skipped files; 3063 tests passed and 2 were skipped.
- Core `node scripts/structure-audit.mjs` printed `passed (378 warning(s), 1156 baselined)`. With `--rule docs-links`
  it printed `passed (0 warning(s), 0 baselined)`.

### Not verified

- No live run.
- I have not checked a build test's replay end to end through Core's walker. This round covers the domain's replay
  answer only; Core's use of replay `outputs` for `$step` values is covered by its existing `stored-flow.test.ts`.
- No full suites.

### Open questions

Items 2 and 3 from round 1 are still open:
- the `web.handle.unknown` hint for an `extraction.*` handle;
- an `extract` parameter contract that refuses a wrong shape before the run.
