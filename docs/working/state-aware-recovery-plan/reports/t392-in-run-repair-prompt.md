# t392 unit I: the in-run repair prompt (typed slot and stage instruction)

Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t392/!FluxIQ`, branch `task/t392-executor-integration`, nothing committed.
AS = `packages/fluxiq/src/programs/automation-studio/`.

## Outcome

Partial. Everything in the brief is built and tested. tsc is clean and the structure audit passes.

One test outside my ownership now fails, as expected: `AS/runtime/service/runtime-session/tests/in-run-repair.test.ts`
still asserts the old `metadata.inRunRepair`. The replacement lines are under Open questions, item 1.

## What changed and why

**The typed slot** (`AS/runtime/llm/harness/task-request.ts`).

- `AutomationStudioLlmHarnessInput.inRunRepair?: AutomationStudioLlmInRunRepairContext`. It replaces the untyped
  `metadata.inRunRepair`. The slot holds:
  - `unit`: `{ kind: "node" | "handler" | "part", id }`.
  - `contract`: a discriminated union.
    - Node: definition, label and description, screened `parameters`, `routes`.
    - Handler: `event`, `scope`, `when`, `completionCheck`, `order`, `maxRuns`, `body`.
    - Part: `name`, `interface` (inputs and outputs), `successCheck`, `entries`, `checkpoints`, `steps`.
    - Each kind also has an `absent: true` form, plus a shared `{ kind, withheld: "screened" }` form.
  - `incident`: the incident id, its origin (frame path, node, failure code), handlers run, routes, alternatives, and
    `trueFailure`.
  - `failedAttempt`.
  - `recoveriesTried`: each entry is `{ attemptId, nodeId, kind: retry|handler|state_route|ladder|repair|counted, ...JsonValue }`.
  - `actsCompleted`.
  - `omitted?`: `{ recoveriesTried?, actsCompleted? }`.
- All of these are exported from the harness barrel, so they reach `runtime/llm/index.ts` too.

**Packing and bounds** (`AS/runtime/llm/harness/context-packet.ts`).

- `context.inRunRepair` is a packet slot, placed after `diagnosis`.
- The slot is carried only on a `runtime_patch`. Any other task leaves it out, and its instruction with it, the same way
  the packet treats `resultSummary` (see Open questions, item 2).
- Bounds:
  - Each history keeps its newest 40 entries (`IN_RUN_REPAIR_HISTORY_MAX_ENTRIES`), and `omitted` counts the rest. This
    limits a copy, not what the model can see: every attempt still goes in whole as `recentActions`. The slot's size
    therefore no longer grows with the run's length.
  - The contract, incident, attempt and histories go through `automationStudioWithoutLocators` again.
  - A contract with a credential-shaped string, or with a key the bound domain denies, is replaced by
    `{ kind, withheld: "screened" }`.
  - A history entry with a credential is dropped and counted in `omitted`.
  - No page text enters the slot. The page stays in `failureEvidence`, under today's screening.
- `promptVersion` gains `+in_run_repair` on an in-run request, so a recorded intervention shows which prompt was used.

**Stage instruction** (`AS/runtime/llm/harness/instruction.ts`).

- New constant `AUTOMATION_STUDIO_LLM_IN_RUN_REPAIR_INSTRUCTION`: id `core.in-run-repair`, scope kind `in_run_repair`,
  required, priority 900.
- The packet adds it right after the stage instructions, only when the slot is present.
- It says the following:
  - the run is held at the failing step and keeps what it did;
  - what each field of `context.inRunRepair` means;
  - change only the named unit, and a patch that touches another unit is refused;
  - never repeat a completed act or an unchanged recovery that was already tried;
  - for an interruption met here, prefer `add_handler`, with a `when` the page shows now and a completion check;
  - otherwise use `replace_unit` or the other kinds offered;
  - the re-attempt is the fix's trial, and a fix that does not hold is dropped;
  - never add a speculative handler.
- Its one example is a session-expiry notice on a clinic's appointment booking page. No realistic scenario uses that
  kind of site or act.
- The constant lives in the harness, not in `recovery/`, because the audit forbids `runtime/llm` from importing a value
  out of `runtime/recovery`. `llm/harness/` stays at 25 files.

**Request builder** (`AS/runtime/recovery/in-run-repair/`).

- `request.ts`:
  - fills `inRunRepair` with `{ unit: slotUnit(request.unit), contract, ...history }`;
  - drops `metadata.inRunRepair`, so metadata keeps only `source`, `expectedOutput` and `allowedPatchKinds`;
  - takes `unitContract` as the typed contract.
- `unit-contract.ts` and `history.ts` now return the harness types instead of `JsonObject`. Their behaviour is
  unchanged. `history.ts` exports the `AutomationStudioInRunRepairHistory` type.
- The runtime-session caller compiles unchanged, because it only passes the contract through.

**Tests**

- `AS/runtime/llm/harness/tests/in-run-repair-slot.test.ts` (7 tests):
  - Byte-identity: a non-in-run staged `runtime_patch` dry-run request, with failure evidence, policy, permissions and
    metadata. Its whole serialized request is pinned to sha256 `1de28ba8…cfc93` and 2941 bytes. I captured both from the
    unchanged harness before making any edit.
  - The slot is carried whole, and the instruction comes right after `core.loop-stage.implement`.
  - The instruction's required statements are present.
  - Bounds: 70 recoveries and 500 acts keep 40 of each, with `omitted` set to `{30, 460}`. 5,000 acts stay within 100
    bytes of the size for 500.
  - Screening: locator text is stripped, a contract with a denied key or a credential is withheld, and a history entry
    with a credential is dropped and counted.
  - Not on other tasks: `runtime_diagnosis`, `loop_verification` and `flow_bootstrap` leave out the slot, the instruction
    and the version suffix.
  - Guard: the instruction's title and body name none of the ten scenario ids or any word of them, and no site word.
    They also match nothing in `flow-script-format.test.ts`'s task-word list (minus "request") or "rate limit".
- `AS/runtime/recovery/in-run-repair/tests/request-slot.test.ts` (2 tests):
  - `requestAutomationStudioInRunRepair` fills the typed slot exactly, `metadata.inRunRepair` is absent, the instruction
    and version suffix are present;
  - a handler and a part are named by their own ids.
  - It reuses the session's `in-run-repair-fixture.ts`. That import passes the structure audit.

## Commands run and observed results

All were run in `packages/fluxiq` unless noted.

- `npx tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/check.tsbuildinfo`, final run: no
  output, no errors.
  - An intermediate run failed on one error, because I had first added a new request-refusal code.
    `flow-bootstrap/generation-failure/phase-failure.ts:136` maps every refusal code to a contracts code, and both sides
    are outside my ownership. I removed the code and switched to withholding (see Open questions, item 3).
- `npx vitest run AS/runtime/llm/harness/tests AS/runtime/recovery AS/runtime/flow-bootstrap/generation-failure/tests/request-refused.test.ts`:
  `Test Files 71 passed (71)`, `Tests 697 passed (697)`.
- `npx vitest run AS/runtime/service/runtime-session/tests/in-run-repair.test.ts AS/runtime/llm/deepseek`:
  `Test Files 1 failed | 10 passed (11)`, `Tests 1 failed | 118 passed (119)`.
  - The failure is "makes one request carrying the unit, its contract and the incident ...", with
    `expected undefined to match object { unit: { kind: 'node', …(5) }, …(3) }` at its `metadata.inRunRepair` assertion.
  - This is the expected effect of moving the data into the slot. Every DeepSeek test passes.
- At the Core root, `node scripts/structure-audit.mjs 2>&1 | tail -1`: `structure-audit: passed (315 warning(s), 1160 baselined).`
  - The E2b report saw 314. The extra advisory warning may be my new test file, which takes `llm/harness/tests/` to 21
    files, or a file another worker added; I did not isolate it.
  - `context-packet.ts` is now 640 lines. That is past the 400-line advisory threshold, as it already was at 569, and
    under 800.
- At the Core root, `node scripts/structure-audit.mjs --rule statement-packing 2>&1 | tail -1`:
  `structure-audit: passed (0 warning(s), 452 baselined).`

## Not verified

- No live run and no real provider. The DeepSeek body sends a runtime request's `context` whole (`request-body.ts`
  `providerUserPayload`), so the slot is sent. I read that path but did not exercise it with a real request.
- No pre-send re-check of the slot exists in `request-evidence-check.ts`. A provider-side check would need a new code in
  `llm/provider-contract.ts`, which I do not own. The slot is screened only when the packet is built.
- The full suites were not run, per the twice-daily rule.

## Open questions or contradictions found

1. **Session test to update** (`AS/runtime/service/runtime-session/tests/in-run-repair.test.ts:35-40`, not mine).
   Replace the `expect(metadata.inRunRepair).toMatchObject({...})` block with:
   ```ts
   expect(metadata.inRunRepair).toBeUndefined();
   expect(asked.context.inRunRepair).toMatchObject({
     unit: { kind: "node", id: "read" },
     contract: { kind: "node", nodeId: "read", definitionId: "builtin.data.constant", label: "Read the list", parameters: { values: { value: "read" } }, routes: [{ port: "success", to: "end" }] },
     incident: { incidentId: "incident.1", origin: { nodeId: "read", failureCode: "test.target.not_found" }, trueFailure: true },
     recoveriesTried: [{ kind: "retry", nodeId: "read", attemptNumber: 4 }],
     actsCompleted: [{ nodeId: "open", attemptId: "open.attempt.1" }]
   });
   expect(asked.context.instructions.instructionIds).toContain("core.in-run-repair");
   ```
2. **A misplaced slot is left out, not refused.** The brief does not say which. Refusing would need a new refusal code,
   and that code needs a new `flow_bootstrap.request_refused_*` code in `packages/contracts` plus a row in `phase-failure.ts`.
   Both belong to H (contracts) and the flow-bootstrap owner. If the supervisor wants a refusal, those are the two lines
   to add, and then `packInRunRepair` throws instead of returning `undefined`.
3. **Withholding instead of refusing an unsafe contract** follows the same constraint. The model still gets the unit,
   the incident and the page, without the contract text.
4. **History bound of 40** is a choice. The user's "no limits on elements passed to the model" rule is kept, because
   `recentActions` still carries every attempt whole. The cap only stops a duplicated copy growing with long loops.
