# t905 captured-row guard (unit A follow-up)

Worker report, brief `finish-branches/t905-captured-row-guard`. Tree: Core `fxwork/t905/!FluxIQ`, branch `task/t905-result-ledger`, HEAD `f16e969b9`. No git mutation.

## Outcome

Done. The causal red reproduced lost captured-row identity and lost dataset markers. The guard is in, and the affected engine tests, the package check and the unchanged audit pass. Source is left in the working tree for the lead.

## Observed red (source unchanged, HEAD f16e969b9)

The new test `engine/automation/tests/input-use-records.test.ts` runs the real engine: parent `start -> extract (builtin.policy.action, recordOutput products, `note` excluded) -> typed Call Subflow (items = extract.records)`, a child `echo` constant reading `items`, output binding `echo.value -> echoed`. Same flow once without a port and once with an accepting normal authority (approves every open and fork).

`heavy-slot run t905-captured-red2 -- pnpm.cmd --filter fluxiq exec vitest run src/engine/automation/tests/input-use-records.test.ts` -> exit 1; 3 failed / 1 passed (4), 29.93 s. (A first red, `t905-captured-red`, gave the same failures before I labelled each run.)

- Ordinary run (no port): every check passed. Child entry, echoed array and echoed row are the parent's very objects. Saved `echoed` / `call.echoed` are `{ $dataset: { datasetId: "products", recordCount: 2 } }`.
- Accepting authority:
  - The boundary still handed the original array to the runner.
  - The child graph's entry `items`, the echoed array and the echoed row were equal-valued different objects (`Object.is` failed, "serializes to the same string").
  - Saved `echoed` and `call.echoed` were `[{ name: "[withheld]", price: "[withheld]" }, { name: "[withheld]" }]`, not the dataset marker. The saved values differ from the ordinary run in exactly those two keys.
  - The child authority was called once, the authority opened twice, and the child read `sealed / graph_entry_inputs`.
- Not observed: raw row text did NOT appear in the saved trace, because the child's withheld supplied scalars still withheld it, and the excluded `note` was absent in both runs. So the defect I observed is lost dataset/row markers and lost identity, not a plaintext leak.
- Other failures:
  - The nested test failed for a fixture reason: `extract.records.0` is not a resolvable path, because the resolver does not walk arrays. I rewrote it to use Filter List, which keeps the captured row objects themselves.
  - The inspection-failure test read `unsupported_input` where `records_unavailable` was expected.

## The guard (files, why)

- `input-use/owned-capture/{index,context}.ts` (new): `AutomationStudioInputUseOwnedCapture.inspect(owner, original)` answers `clear | captured | unavailable`.
  - It looks only at identity, through the live owner's `captured()` map. It never matches values, hashes, ordinals or markers.
  - The walk is iterative and cycle-safe, so very deep nesting cannot overflow the stack.
  - An accessor (never run), a non-plain prototype, a function, a throwing owner or proxy, or no owner gives `unavailable`. An owner that captured nothing gives `clear`.
- `input-use/frame.ts`: private `#records`.
  - `own(records)` binds the owner once; `captured(original)` asks it; `close()` drops it.
  - The owner is never reachable from options or request data, and it is not inherited: the child options still strip `inputUse`.
- `graph-run.ts#runGraphWithInputs`: `inputUse?.own(runState.records)` runs right after the run's `runState` is created, before any node. With no port it does nothing and adds no await.
- `input-use/controller.ts#handoff` and `integration.ts#handoff` (new): runs before any copy or child authority call.
  1. The parent is not forkable -> `parent_unverified` (no copy).
  2. The inspection of the ORIGINAL `{inputs, declaredInputDefaults, contract, bindings, callInputs}` is `captured` -> `captured_records`; `unavailable` -> `records_unavailable`.
  3. Only `clear` data is copied (`Capture.object`).
  - `child()` now takes `AutomationStudioInputUseRead`. An unknown handoff creates a refused child port, so there is no authority call, no child lease and no `Capture.object` in `frame.prepare`. The child runs on the original objects (`initialize` only shallow-copies the top level).
- `composite/boundary.ts`: uses `InputUse.handoff` in place of the direct `AutomationStudioInputUseCapture.object` copy. Frame projection, cancellation and the no-port path are unchanged.
- `input-use/unknown.ts`: adds the codes `captured_records` and `records_unavailable`.
- Tests:
  - `tests/input-use-records.test.ts` (4 tests): the causal comparison; nested array plus a Filter List row; equal-valued independent data still forks, seals and runs on a lease copy; an unanswerable accessor stays unknown and runs on the original.
  - `input-use/owned-capture/tests/context.test.ts` (4 tests): depth 100 000, cycles, an empty owner, accessor/Date/revoked proxy/throwing owner/missing owner.
- Untouched: `records/summary.ts`, `records/capture.ts`, `service.ts`, owners, dispatch, baselines, public exports, the input-use barrel.

## Commands (all from the Core root through `heavy-slot.mjs run`)

1. `t905-captured-gate`: the brief's vitest dirs plus `src/engine/automation/records`, then `pnpm.cmd --filter fluxiq check`, then `node scripts/structure-audit.mjs`.
   - vitest exit 1: 11 failed / 167 passed files, 39 failed / 1339 passed tests, 1411.9 s.
   - Engine: all passed (input-use 20, boundary 6, graph-run 25, capture 16, session 2, cleanup 2, context 4, records 56), except one assertion of mine in input-use-records. That assertion compared saved values that include Start's wall-clock `startedAt`. It is now excluded from that comparison.
   - The other 38 failures are all in `framework/automation-service/service/answer-first` (10 files), e.g. 12 x "expected an answer, got setup_needed". No file under `framework/` references `inputUse`. With no port, the only new code that runs is `inputUse?.own` (does nothing) and a never-read constant in boundary.
   - check: exit 0, 75.0 s.
   - audit: exit 1, one new violation: statement-packing in my context test, line 44. Fixed by expanding the getter; no rebaseline.
2. `t905-captured-gate2` (after the two test-only fixes): vitest on input-use, composite, tests, records and frames, then check, then audit.
   - vitest exit 0: 40 / 40 files, 397 / 397 tests, 163.7 s. Includes input-use-records 4, context 4, input-use 20, boundary 6, call-subflow 11, call-subflow-pin 10 and graph-run 25.
   - check: exit 0, 23.1 s.
   - audit: exit 0, "passed (554 warning(s), 909 baselined)". No baseline edits. The existing advisory warnings on `input-use/` (18 root files; the new files sit in a subdirectory) and `graph-run.ts` (642 lines, was 640) remain.
   - Logs: scratchpad `gate.log`, `gate2.log`, `red2.log` (session temp).

## Not verified / remaining gaps

- **Stage-B provenance gap (open):** a root or external inherited input from an earlier or unrelated run, or seeded variables, has no live owner here. The root frame's own entry is not inspected (there is no owner before its first node), and a child of a child only knows its own run's records. This guard covers only rows captured by the live parent run, crossing the typed Call Subflow/Call Flow boundary. It is not whole-input or whole-execution coverage. B must authenticate origin through the private dataset/input owner.
- The answer-first failures were not re-run on an unchanged tree. "Not caused by this change" rests on the reasoning above (no `inputUse` reference under `framework/`; the no-port path is unchanged), not on a baseline run. They may be fallout from the t905 dev merge (answer-first/attempt conflicts noted in t905.md).
- I did not edit `codex-t905-node-use-design.md` or the authored runtime-ownership docs: they are outside my owned paths. The codex brief asked for a design update, which the lead still owns.
- Node-use (C1), service wiring, and live or browser behaviour are not covered.
