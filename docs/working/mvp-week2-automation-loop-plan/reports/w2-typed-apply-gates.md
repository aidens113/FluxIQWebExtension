# Report: w2-typed-apply-gates

Worker report, 2026-09-16. Repository: FluxIQ Core (`F:\!FluxIQ`).
`AS/` = `packages/fluxiq/src/programs/automation-studio/`. Nothing was
committed or pushed. No live calls were made.

## Outcome

**Done, with one required one-line change in `service.ts` that I was not
allowed to make.** Until that line is applied, Core `tsc` fails at that line on
purpose, and the service's typed apply path refuses every change.

1. **Typed apply path: fixed.** `applyApprovedAdaptation` in the typed project
   store now runs the same promotion gates as the file-based path:
   `evaluateFlowAdaptationPromotionGates`, the same function with the same
   issue wording. It judges the change as stored, and fails closed.
   - **Why the gates are passed in rather than imported:** the gates live in
     `runtime/recovery`, which imports `runtime/service`, which imports
     `storage`. A static import from the store would close a module cycle of
     about 140 files. I measured this (see Commands). The store therefore takes
     the gates as a **required** `promotionGates` argument from the caller that
     already imports them. That is the remedy the structure-audit config
     recommends for this kind of cycle.
   - **What refuses:** missing gates, gates that throw, and any answer other
     than `{ ok: true, issues: [] }`.
2. **Does an approved target repair change what a recorded step clicks? It did
   not. It does now, on the typed apply path.**
   - **Observed before the fix**, through a real store apply and a real run of
     the compiled revision that apply produced, with the domain's adapter
     stubbed: the domain was asked to act on `{"selector":"#save",
     "element":{"accessibleName":"Save changes"}}`. That is the recorded
     control. The repair was written to `parameterValues.target`, and a
     `builtin.policy.action` never dispatches that field.
   - **Fixed in the operation builder:** for a policy action, the repair is now
     written into the payload the node dispatches, as `parameters.target`.
     Core's output dispatch already reads an element target from that slot.
     Rollback restores the payload byte for byte, and a test checks it.
   - **A native node was already fine:** it receives `parameterValues.target`
     as `hostContext.target`. A test now pins that too.
   - **Still broken elsewhere (not my files):** the file-based applier and the
     executed-override trial rerun have the same gap. Exact changes are under
     Open questions.

## What changed and why

### `AS/storage/project/adaptation-store.ts` (580 -> 657 lines)

- **New exported type `AutomationStudioAdaptationPromotionGates`:**
  `(adaptation) => { ok: boolean; issues: string[] }`. Its doc comment explains
  why it is passed in rather than imported.
- **`applyApprovedAdaptation(input)`** has a new required input,
  `promotionGates`.
  - **Old check, removed:** `.some(status === "succeeded") || hasReviewerApproval`.
  - **New check:** `promotionGateVerdict(input.promotionGates, detail.adaptation)`,
    passed to `decidePolicy`.
  - **On refusal:** a `policy_blocked` audit event is written as before, and the
    error text is `Adaptation cannot be applied: <issues>`, the same text the
    file-based path uses.
- **`decidePolicy`:**
  - The `validated: boolean` input is replaced by an optional
    `gates: { ok: true } | { ok: false; reason }`.
  - `apply` and `auto_apply` are refused unless `gates.ok === true`. With no
    gates at all, the reason is "its promotion gates were not supplied."
  - The order is unchanged: the disabled-mode check first, then manual mode
    refusing an automatic apply, then the gates.
  - I found no other callers in Core (searched `packages/` and `apps/`).
- **New private `promotionGateVerdict`:**
  - A missing function, a thrown error (its message is included), a
    non-boolean `ok`, a non-string-array `issues`, or `ok: true` with issues
    listed all refuse.
  - `ok: false` with no issues refuses as "its promotion gates refused it."
- **New private `withAuditedReviewer`** (replaces `hasReviewerApproval`).
  - **Why it is needed:** the gates read the reviewer from
    `metadata.review.approvedBy`. The typed store used to accept an `approved`
    audit event instead.
  - **What it does:** when the stored change has no `approvedBy`, it hands the
    latest named approval from the audit trail to the gates, in that field.
    "Named" means not blank and not `runtime`. Nothing is written.
  - **Why keep it:** without it, older typed approvals recorded only as audit
    events would silently stop counting.
  - Today's service approve action writes both records, so this matters only
    for older rows.
- **Operation builder: new function `actionTargetParameterValues`,** used by
  `graphPatchOperationsForAdaptation`.
  - **A policy action (`builtin.policy.action`):** writes
    `parameters: { ...payload, target }`. A missing payload becomes
    `{ target }`.
  - **A payload that is not a plain object, or is a `$state` binding:** the
    change is refused, and an `apply_failed` audit event is written. It is not
    recorded as applied.
  - **Any other node:** writes `target`, unchanged from before.
  - **An `edit_action_target` with no `after` value:** now refused. The
    file-based path already refused it. Before, it wrote nothing and was
    recorded as applied.
  - **Rollback:** `set_node_parameters` stores the whole value map, so its
    inverse is exact. I did not need to change `graph-store.ts`.
  - **Ready to share:** the function takes a structural
    `Pick<…, "nodeId" | "definitionId" | "parameterValues">`, so it can move
    unchanged into a module both appliers import.
- **New import:** `isAutomationNodeParameterStateBinding`, through the
  `../../nodes/index.ts` barrel. That barrel's value-import closure (69 files)
  contains no `storage`, `runtime/service` or `runtime/recovery` file, so it
  adds no cycle.

### `AS/storage/project/tests/adaptation-store.test.ts` (484 -> 651 lines)

**Existing tests, updated:**

- Every `applyApprovedAdaptation` call now passes the real gates.
- "No executed validation" now expects the gates' wording.
- The route-only fixture and the `edit_recovery` fixture gain a `proposalId`.
  Both patch kinds are structural, and the gates require a linked proposal for
  them. Each test still tests what it tested before.
- `decidePolicy` is now covered for create, for apply with no gates, and for
  apply with a passing verdict.
- `seedFlow` accepts nodes, and a helper `rewriteValidationResults` rewrites a
  stored row's results directly.

**New tests (each observed failing before the fix):**

1. **A change with no counted result is refused.** It covers:
   - a succeeded result with `checkedAt: NaN`, which passes the save
     validator;
   - a row whose only succeeded result has `kind: "structural_check"`. The save
     validator refuses that kind, so the test rewrites the row directly, the
     way an older writer could have saved it.

   Each case gets a `policy_blocked` event, no graph write, and the revision
   stays at 1.
2. **A trial failure after a success is refused, even with a named approval.**
3. **Approvals:**
   - a named approval on the change applies;
   - a named approval recorded only in the audit trail applies;
   - an approval by `runtime` is refused.
4. **The other apply path's refusals, on the stored change:** `rejected` status,
   `destructive` risk, and a route change with no linked proposal.
5. **Failing closed:** gates missing, gates that throw, `ok: "yes"`, a pass
   that lists issues, and `ok: false` with no issues all refuse. The real gates
   then apply the same change.
6. **A policy action is re-pointed through its payload, and rollback restores
   the payload exactly.**
7. **A policy action whose payload is a `$state` binding is refused,** and
   nothing is written.

### `AS/runtime/tests/policy-action-target-repair.test.ts` (new, 178 lines)

This is the end-to-end check the brief asked for.

- **Real parts:** the typed store apply, with the real gates and with
  compilation on; `AutomationStudioProjectCompiledPlanStore.startRunFromArtifact`
  on the compiled revision that apply produced; and Core's real
  `createRuntimePolicyEffectDispatcher`.
- **Stubbed part:** a `RuntimeService` whose only adapter records the
  `parameters` of each `execute_action` command. That is what the domain
  receives.

**Case 1, a recorded step:**

1. The run before the repair asks the domain to act on "Save changes" /
   `#save`.
2. After the apply:
   - the dispatched payload is `{ selector, element, target: REPAIRED }`;
   - the domain's command target fingerprint is `#apply` / "Apply changes";
   - the recorded `selector` stays beside it.
3. After a rollback, a run of revision 3 dispatches the recorded payload
   exactly, and the same target as the first run.

**Case 2, a native node:** it receives the repair as `hostContext.target`, and
no policy effect is emitted.

## Commands run and observed results

All commands were run in `F:\!FluxIQ\packages\fluxiq` unless noted.

**Baseline, before any edit.**
- Command: `npx vitest run …/storage/project/tests/adaptation-store.test.ts …/service-adaptation/tests/subflow.test.ts`
- Result: `Tests 16 passed (16)`.

**Cycle measurement.** A scratch script (`<scratchpad>/w2tag/closure.mjs`)
follows value imports only.
- From `storage/project/adaptation-store.ts`: 188 files, with no
  `runtime/service/index.ts` and no `runtime/recovery/`.
- From `runtime/recovery/adaptation-promotion.ts`: 328 files, and the chain
  reaches the store:
  `adaptation-promotion.ts -> runtime/service/index.ts -> runtime/service/catalogue.ts -> storage/index.ts -> storage/project/index.ts -> storage/project/adaptation-store.ts`.

**Tests written before the fix.**
- Same two files: `Tests 9 failed | 12 passed (21)`.
- The failures were real behaviour:
  - the store resolved (applied) for the untimed result, the wrong-kind
    result, the contradicted change, the rejected, destructive and unlinked
    route changes, and with no gates at all;
  - the policy-action node got a third top-level key.
- The end-to-end test first failed on a seeding error:
  `Node builtin.policy.action pins legacy`, because an import with no version
  stores `legacy`. I seeded `definitionVersion: "1.0.0"`, as `subflow.test.ts`
  does.
- It then failed on the real finding: `expected { Object (selector, element) }
  to deeply equal { selector: '#save', …(2) }`. The native case passed.
- A temporary `console.log`, since removed, printed what the domain received
  after the repair was applied:
  `{"selector":"#save","element":{"accessibleName":"Save changes","tagName":"button"},"target":{"kind":"element","fingerprint":{"accessibleName":"Save changes","tagName":"button","selector":"#save"},"source":"runtime"}}`.

**After the fix.**
- Same two files: `Test Files 2 passed (2)`, `Tests 21 passed (21)`.
- This was repeated after the final test addition, with the same result.

**Deliberate breaks** (`<scratchpad>/w2tag/mutate.mjs`). Each break was applied
alone and restored byte for byte, and the script printed `RESTORED` each time.
A final `cmp` against a copy taken before the breaks printed `FINAL-IDENTICAL`.

| Break | Result |
| --- | --- |
| M1: skip the gates | 6 failed |
| M2: write the target beside the payload | 3 failed (end-to-end + 2 store) |
| M3: drop the audit-trail reviewer | 1 failed |
| M4a: accept a truthy `ok` | 1 failed |
| M4b: accept a pass that lists issues | 1 failed |
| M5: let missing gates pass | 1 failed |
| M6: merge into a `$state` payload | 1 failed |

My first M4 break was an equivalent mutant: the line it changed could not be
reached, and it was not caught. I replaced it with M4a and M4b, and added the
"pass that lists issues" assertion that M4b needs.

**Storage suite.**
- Command: `npx vitest run src/programs/automation-studio/storage`
- Result: `Test Files 37 passed (37)`, `Tests 188 passed (188)`.

**Type check.** `npx tsc --noEmit`, run twice, the last time at HEAD `8409ca2`.
It exits 2 with two errors:
- `runtime/service.ts(4798,61)`: `Property 'promotionGates' is missing`. This
  is the intended integration point; see Open questions 1.
- `runtime/flow-bootstrap/plan/tests/catalog.test.ts(301,66)`:
  `number` is not assignable to `49152`. That file belongs to another worker
  and is modified in the working tree. It is not mine.

There are no errors in my three files, which also shows that
`evaluateFlowAdaptationPromotionGates` fits the new argument type.

**Full check.** `pnpm check` (Core root) exits 2.
- `structure:test`: `# pass 130`, `# fail 0`.
- `structure-audit: passed (152 warning(s), 320 baselined)`.
- `packages/contracts` and `packages/client-gateway-websocket`: Done.
- `packages/fluxiq`: failed, on the same two `tsc` errors.
- Advisory warnings on my files:
  - `adaptation-store.ts`: 657 lines, and its class has 28 methods, one more
    than before;
  - `adaptation-store.test.ts`: 651 lines;
  - `runtime/tests/`: now 25 files, which is exactly the hard limit (the rule
    fails only above 25).

**Showing that the service path works once the `service.ts` line is applied.**
- **Method:** a scratch vitest config and setup file
  (`<scratchpad>/w2tag/vitest.w2tag.config.mjs`, `inject-gates.setup.ts`)
  wrap `applyApprovedAdaptation` so that it supplies
  `evaluateFlowAdaptationPromotionGates` when the caller does not. Nothing in
  Core was changed for this.
- **`subflow.test.ts` without the stand-in:** `1 failed | 3 passed`. The
  failing test is the typed-path test, with
  `Adaptation cannot be applied: its promotion gates were not supplied.`
- **`subflow.test.ts` with the stand-in:** `4 passed (4)`.
- **Runtime suite with the stand-in:**
  `npx vitest run --config <scratch config> src/programs/automation-studio/runtime`
  exited 0, with `Test Files 140 passed (140)` and
  `Tests 1418 passed | 1 skipped (1419)`. That was true in two runs, the second
  at HEAD `8409ca2`, after the other workers' commits `fce62f9`, `1d208ed` and
  `8409ca2` had landed.
- **Runtime suite without the stand-in:** exited 1, with
  `Tests 5 failed | 1413 passed | 1 skipped`.
  - **Mine:** the `subflow.test.ts` typed-path test above, which is expected
    until `service.ts` is changed.
  - **The other four:** two 15-second timeouts (`run-detail-preservation`,
    `instruction-readiness`), a timing budget (`scale-pages`, 583 ms against
    500 ms), and `deepseek-bootstrap-exploration`.
  - **Rechecks:** run alone, one file at a time, `run-detail-preservation`
    passed 3/3, `instruction-readiness` 1/1 and `scale-pages` 3/3. Another
    worker's vitest was running at the time; I saw the process.
  - **`deepseek-bootstrap-exploration.test.ts`:** it references no apply path
    (`grep` count 0). The file and `runtime/flow-bootstrap/**` are modified by
    the live-debugging worker, and it failed with different assertions on
    different runs. It passed in both stand-in runs. It is not mine.

## Not verified

- **The `service.ts` change itself.** I was not allowed to edit the file. Its
  effect was shown only through the scratch stand-in above.
- **The service's own run path for a policy action after a typed apply**
  (`reviewFlowAdaptation`, then `runRuntimeSession`). My end-to-end test runs
  the compiled revision that the store's apply produces, through Core's real
  policy dispatcher. It does not go through the service's projection sync and
  run wiring. `subflow.test.ts` covers that service path for a native node
  only.
- **What the web domain does with `parameters.target`.** Core now delivers the
  repair there. Core's `prepareElementTargetAction` turns it into
  `{ kind: "element", fingerprint: { selector, accessibleName, tagName, … }, source: "runtime" }`,
  which drops `handles`, and the recorded `selector` and `element` stay beside
  it.
  - **What should make it work:** the web domain declares `target`
    ("Adapted Target") as a parameter of its element outputs, according to
    Core's copy in `flow-bootstrap/plan/tests/web-domain-definitions-fixture.ts`.
    That suggests the domain prefers `target`.
  - **Not checked:** I did not read the domain, which the brief put off
    limits. Someone should confirm that `web.dom.click` acts on
    `parameters.target` ahead of `parameters.selector`. Otherwise the click
    still lands on the old control.
- **The file-based applier and the executed-override rerun.** I read both
  (Open questions 2 and 3) but did not exercise them.
- **Live runs, browser runs, `pnpm test` and `pnpm build`:** none were run.

## Open questions or contradictions found

1. **Required `service.ts` change (one argument).** It is at
   `AS/runtime/service.ts:4798`, in `reviewTypedFlowAdaptation`, at HEAD
   `8409ca2`. `evaluateFlowAdaptationPromotionGates` is already imported at
   line 111.

   ```ts
   -        const applied = await store.applyApprovedAdaptation({ adaptationId: input.adaptationId, actorId });
   +        const applied = await store.applyApprovedAdaptation({ adaptationId: input.adaptationId, actorId, promotionGates: evaluateFlowAdaptationPromotionGates });
   ```

   - **Why the argument is required rather than optional:** so that forgetting
     it fails the build.
   - **What happens without it:** at run time the store refuses every typed
     apply with "its promotion gates were not supplied." `subflow.test.ts`
     catches that too.
2. **The file-based applier has the same policy-action gap.**
   - **Where:** `AS/runtime/service/adaptations/patches.ts:57` writes
     `target` beside the payload for every node.
   - **Suggested fix:**
     1. Move `actionTargetParameterValues` from `adaptation-store.ts` into a
        module both appliers already import, such as `runtime/flow-change/`,
        which the store already imports. It needs no changes to move.
     2. Replace line 57 with:

        ```ts
        node.parameterValues = compactJsonObject({ ...parameterValues, ...actionTargetParameterValues({ nodeId: node.id, definitionId: node.definitionId, parameterValues }, structuredClone(patch.after), adaptation.adaptationId) });
        ```

   - **A test that pins the gap:**
     `runtime/tests/service-adaptation/tests/durable-patches.test.ts:90-146`
     builds a `builtin.policy.action` node with
     `parameterValues: { target: … }`, and asserts that `target` is written at
     the top level. It would need to expect `parameters.target` instead.
3. **The executed override's trial rerun has the same gap.**
   - **Where:** `AS/runtime/live-patch.ts:528`, in `applyRuntimePatchToFlow`
     for `temporary_target_override`, sets `node.parameterValues.target`.
   - **Effect:** for a policy-action failed node, the rerun dispatches the
     recorded payload. A "trial" of such a repair would therefore re-click the
     old control. A success or failure recorded from it says nothing about the
     repair.
   - **Suggested fix:** the same mapping as in item 2. I did not exercise
     this; it follows from the executor behaviour observed above.
4. **Recording-definition nodes lose an edited payload.**
   - **Where:** `materializeRecordingNode`
     (`runtime/service/recordings/candidate-definitions.ts:86`), used at
     `service.ts` around 4422.
   - **What happens:** a node whose `definitionId` is a recording definition
     has `parameters` replaced from the definition when it runs. A
     `parameters.target` written by any applier would be dropped there.
   - **Scope:** recorded Flows built by `appendRecordingProposalToFlow` use
     `builtin.policy.action` directly and are not affected. The renamed-save
     run was one of those.
   - I did not change this. Whoever owns recordings should decide whether the
     authored `parameters.target` should survive materialization.
5. **`runtime/tests/` is now at the 25-file hard limit.** The next file added
   there fails the structure audit.
6. **Two behaviour changes on the typed path, both intended.**
   - A route or `edit_recovery` change with no linked `proposalId` is now
     refused. The file-based path already refused both.
   - A `rejected`, `disabled` or `destructive` change is now refused. The typed
     path used to apply them if any succeeded result existed.
