# t252-w3-domain report

## Outcome

Done. All six items of the brief are in place. I wrote the tests first and saw 12 of them fail before writing any code. The tests beside each changed file pass (604 of 604), `pnpm --filter @fluxiq-web-extension/domain check` is clean, and the structure audit reports one failure, which was already there before I started (see below). Nothing was committed, and nothing in Core was edited or rebuilt.

## What changed and why

1. **Row scope moved** (D7). `scopedToRow` now lives in the new file `domain/src/output-nodes/targets/row-scope.ts`, exported through the `targets` barrel as `webAutomationScopedToRow`. `native-runtime.ts` imports it. The stale comment is fixed: since t193, a node built from a snapshot handle also carries `context.record` whenever the packet published the record's words. Only a keyed record travels with its list position alone.
2. **Replay applies the row** (D6/D7). In `node-run/replay.ts` (`step`) and `node-run/verify.ts` (`verify`), the incoming `parameters` are scoped with `webAutomationScopedToRow(parameters, value.item)`. This happens before the permission check, resolution and the command, exactly as the native runtime does it.
3. **`outputs.records` on a replayed list read** (D6).
   - `capture.ts` gains an `outputs?: JsonObject` member, a `withNodeOutputs` helper, and `"outputs"` in `WEB_LLM_EVIDENCE_RESULT_KEYS_CORE_READS`. A comment there says this side must land together with Core's P1b.
   - `node-run/replay-answer.ts` adds `webNodeReplayFlowRows`. It runs `webAutomationExtractListDispatch` on the resolved parameters, then Core's `validateAutomationStudioRecords` on `payload.extracted`, using the derived or reconciled record output's schema and `maxRecords`. Those are the same two steps the Flow's capture runs (`record-capture.ts`).
   - When no record output can be parsed, there is no `extracted` array, or the schema refuses every row, there is no `outputs` member. The same holds for a replay answering `changed`, `failed` and so on.
4. **Write mode** (D1).
   - `run.ts` accepts an optional `write` key. A `write` that is not a boolean is refused as `unexpected_input_keys`. The refusal's `instead` still lists only the three call keys, so the existing refusal tests stay unchanged.
   - With `write: true` the call goes through the live path: node, keys, page and start location, handle resolution into the frozen identity, the `target_not_a_handle` check, control words, the missing-`consequences` check, cross-origin and shown address.
   - It skips the covered-target check and the permission gate, so no request is raised, and returns before the gateway action.
   - New file `node-run/written-step.ts`:
     - `webNodeWriteAsked`
     - `webWrittenStepIssue`: the declaration must be readable exactly as the gate would read it (`consequences_unreadable`). Every required schema parameter must be present, or the call is refused `missing_input_keys` with `missing: [...]`. Each given parameter must match its schema `type`, or the call is refused `parameter_not_readable` with `target: <param>`.
     - `webWrittenStep`: answers `resultCode: "core.run_node.written"` and `effectApplied: false`. The draft is `{actionId, effect, input, ranWith (node, parameters, consequences — as live), proposes: true, written: true, replay: {from: {location}}, control}`. The evidence is the outcome alone, with `status: "written"`.
   - New file `node-run/node-call.ts` holds `webNodeCall`, `webNodeShownCall` and `webNodeFlowParameters`, moved out of `run.ts`. The run and the written step share them, and the move keeps `run.ts` under the 800-line limit (now 755).
   - `draft.written?: true` is added to the type. Every `present<WebNodeDraftStatement>` site in `run.ts` now states `written: undefined`.
5. **`$state` leaves** (D3).
   - New file `plan-resolution/state-binding.ts` holds `isWebPlanStateBinding`: exactly `{"$state": {path: <non-empty string>, ...}}`. It is exported from the `plan-resolution` barrel.
   - Plan-time resolution already copied such a leaf untouched, because it holds no `handle`. New tests pin that.
   - Write-mode validation counts a leaf as present and skips its type check.
6. **Instructions** (D8). The Lists line in `system-instructions/instructions.ts` now says repetitive work is a loop: list with a `where` that keeps only the items to act on, act once on one kept item or write the act (`write true`), state repeat, never act on every item, and bind changing values (`{"$input": name}` / `{"$row": field}`). The version is `web-4`. The text is 2,633 characters, so I raised the test's cap from 2,500 to 2,800; Core's limit is 4,000.

**Tests added or changed:**
- `output-nodes/targets/tests/row-scope.test.ts` (new)
- `plan-resolution/tests/state-binding.test.ts` (new)
- `node-run/tests/replay.test.ts`: row scope on `step` and `verify`, `outputs.records`, no outputs otherwise, and the key-list entry.
- `node-run/tests/run.test.ts`: six write-mode tests.
- `system-instructions/tests/instructions.test.ts`

## Commands run and observed results

- **Filtered test runs.** `domain/scripts/test-domain.mjs` takes no file filter: it always bundles every `src/**/tests/*.test.ts`. So I used a scratch runner (`<scratchpad>/t252-w3-run-tests.mjs`) with the same esbuild options. It writes only to `domain/.test-build-scratch/t252-w3` and runs only the test files named on the command line.
  - Before any code was written, the new tests run with `DOMAIN_TEST_BUILD_LABEL=t252-w3` gave `# pass 29 # fail 12`, and `row-scope.test.ts` failed to build with `No matching export ... "webAutomationScopedToRow"`.
  - Final run over every test file beside changed code (79 files: `output-nodes/tests`, `output-nodes/targets/tests`, `runtime/llm-evidence/tests`, all `node-run/**/tests`, all `plan-resolution/**/tests`, `system-instructions/tests`): `# tests 604 # pass 604 # fail 0`, exit 0.
  - An intermediate run of the same files showed 2 failures in `tests/tool-rejection-detail.test.ts` and `tests/tools.test.ts`. They expect `instead` to be exactly the three call keys. I fixed this in the code (`ACCEPTED_KEYS` is separate from `CALL_KEYS`), not by editing those tests.
- `pnpm --filter @fluxiq-web-extension/domain check` -> exit 0, and `tsc` printed nothing. Core's dist built cleanly against the domain, so files Core's workers have in progress did not affect it.
- `node scripts/structure-audit.mjs` -> exit 1 with one violation: `FAIL [working-docs] docs/working/README.md is out of date with the documents' header blocks`. This was there before I edited anything; I ran the audit before my changes and saw the same failure. It comes from the untracked `general-flow-authoring-plan.md`. `README.md` is a shared document I may not edit; running `pnpm structure:baseline` fixes it. No rule fired on any file I touched. One file-count warning to note: `node-run/` and `node-run/tests/` are now both at 25 source files, which is the limit, so the next file there must go into a subdirectory.

## Not verified

- **No end-to-end run against Core.** Core does not yet accept `outputs` on a tool execution result, `written` on a draft, or `write` in the call (that is P1b). Until P1b lands, current Core refuses every replayed list read whole (`unknown_key`). This domain change must not reach `dev` before Core's P1b.
- **No live browser run.** Everything above ran against stub gateways.
- **The rows are only as good as the client's `extracted`.** The replay still dispatches the parameters from `webAutomationExtractListAloneRowsAsked`, not the Flow's dispatch parameters, which may narrow the columns. The rows are then validated against the Flow's schema, which drops columns by allowlist, so they should match. I have not compared the two against a real page.
- **Bindings nested inside `extractList` are not supported.** A `$state` inside a `where` condition value goes through the extraction slot's condition and request readers, which would refuse it. That is outside these files; bindings are supported at parameter-leaf level only.
- **Bindings sitting where the target should be.** A written element step whose only target is a `$state` leaf, with no handle, is refused `target_not_a_handle`, as a live call would be.

## Open questions or contradictions found

- **"Words" or "control".** D1 lists the written draft's last fields as `control, words`; the brief says `control`. I emitted `control` only, matching the brief and the existing draft type.
- **The key-list rule.** The `capture.ts` rule says to widen `WEB_LLM_EVIDENCE_RESULT_KEYS_CORE_READS` only after Core's list learns the key. The brief has this side add `outputs` first, so the supervisor must merge P1b and P2 together.
- **Rows reach Core whole.** `outputs.records` rows are whole page text, as the Flow saves them; only `exclude` fields are dropped. Core must carry them on `outputs`, not show them to the model or the judge unscreened.
- **A written look stays a look.** `write: true` on the snapshot (look) node is handled by the look path before any write logic, so it answers as an ordinary look and not as written. I did not add a refusal for it.
