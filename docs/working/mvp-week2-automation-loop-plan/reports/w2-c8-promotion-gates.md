# w2-c8-promotion-gates

Brief: C-8 in `reports/w2-back-half-design.md` section 8. Repository: FluxIQ
Core. `AS/` = `packages/fluxiq/src/programs/automation-studio/`.

## Outcome

**Done.** Nothing was committed.

- Promotion now counts only `trial` and `replay` results.
- The confidence tier replaces the numeric score as what promotion reads.
- Two bootstrap gate helpers exist:
  - an automatic one: may a created Flow be applied without a person?
  - a manual one: may a person apply it?
- Every rule comes from the `flow-change` functions and is not restated.
- A change with no succeeded trial is never promoted automatically.
- A result of any other kind, an unknown status, or a missing or non-number
  time is ignored everywhere.

Three things are left for others, because the brief puts those files off
limits. The exact edits are in "Open questions" below.

1. `service.ts` still passes the old `validated` flag, and still writes the
   old numeric score. So the new tier-based rule is built and tested, but the
   running service does not use it yet.
2. **Most important:** the typed project-store apply path in
   `AS/storage/project/adaptation-store.ts` never calls these gates. Its own
   check still accepts a succeeded result of any kind.
3. Nothing calls the bootstrap helpers yet. That wiring is C-12's job.

## What changed and why

### `AS/runtime/recovery/adaptation-promotion.ts`

- **New: `adaptationConfidence(change)`.**
  - Returns `decideAutomationStudioChangeConfidence(...)` for the change's
    saved results and its risk level.
  - Accepts any object with `validationResults` and `riskLevel`, so it works
    for a runtime adaptation and a Flow Bootstrap adaptation.
  - Promotion reads this, not a score.
- **`adaptationValidationCounts`** now counts only the results that the
  confidence rule counts.
  - It asks the rule about each result on its own, through the private
    helper `countedOutcome`. It does not copy the rule's filter (kind, status,
    finite `checkedAt`).
  - As a result, the counts can never disagree with the tier.
  - Its parameter type was widened. Existing callers are unaffected.
- **`evaluateFlowAdaptationPromotionGates`** (the manual apply gate) now
  reads the tier, through the private helper `applyEvidenceIssue`:
  - `provisional` or `established`: passes.
  - `unverified` with a failure on record: refused, **even with a named
    approval**. On the tier's definition, this state means the latest counted
    result failed.
  - `unverified` with nothing counted: passes only with a named reviewer's
    approval.
  - **Behaviour change:** before, a failure after a success passed, because
    `succeeded >= 1` was enough. It is now refused, which is the tier's
    "contradicted" state.
  - Before, a failure with no success was refused even with an approval.
    That is unchanged.
  - The destructive, disabled, rejected, structural-without-proposal and
    missing-target issue strings are unchanged.
- **New: `evaluateBootstrapAdaptationApplyGates(adaptation)`**, the manual
  apply gate for Flow Bootstrap.
  - It uses the same evidence rule.
  - It never reads the `validated` status. The approval comes from the latest
    `approved` audit event, and only when that event names an actor that is
    not blank and not `runtime`.
  - It refuses `rejected`, `reverted` and `applied` records.
  - It tolerates a record saved without `auditEvents`.
  - It takes a `Pick<AutomationStudioBootstrapAdaptation, "validationResults" | "riskLevel" | "status" | "auditEvents">`.
- **`reviewerApprovalForAdaptation`** behaves the same. It now shares
  `namedReviewer` with the bootstrap reader.
- **`adaptationConfidenceScore`** is marked `@deprecated`. It is kept only
  because `service.ts:4010` still writes it, and nothing reads it (I searched
  all of Core, including `apps/`). Because it builds on the counts, it too
  now ignores wrong-kind results.

### `AS/runtime/training-modes.ts`

- **`AutomationStudioAdaptationPromotionGateInput`** now requires exactly one
  of two fields:
  - `confidence: AutomationStudioChangeConfidenceDecision`, the new field; or
  - `validated: boolean`, the old field, marked `@deprecated` and kept only
    because `service.ts` still passes it.
  - Passing both is a type error. A test checks this with `@ts-expect-error`.
- **`decideAutomationStudioAdaptationPromotionGate`**:
  - When given `confidence`, it applies `promotionEvidenceRefusal`:
    - The tier must be `provisional` or `established`. Anything else,
      including a value that is not a known tier, is refused.
    - `trials >= 1` must hold. If not, it refuses with "A change with no
      succeeded trial is never promoted automatically."
    - A `NaN` trial count is refused.
  - The other checks run in their old order, with the same reason strings,
    through `sharedPromotionRefusal`: destructive, high risk, side effects,
    first manual review, and manual mode. The structural and non-low-risk
    checks follow.
- **New: `decideAutomationStudioBootstrapApplyGate(input)`**, the automatic
  apply gate for a created Flow. It returns the same decision shape.
  - It applies the same evidence rule.
  - Only `mode === "create"` can auto-apply. `extend`, or a missing or
    unknown mode, goes to a person, because changing a running Flow is
    structural.
  - It then applies the shared refusals.
  - Only `approvalMode === "auto"` can auto-apply. In `mixed` mode the
    existing proposal gate already sends a new Subflow to a person.
  - Only low risk can auto-apply.
  - If `promoteAdaptations` is false, the decision is
    `{ autoApply: false, requiresManualApproval: false }`, the same as the
    runtime gate.
- The shared input type `AutomationStudioPromotionGateSharedInput` is not
  exported.
- The file is 395 lines, under the 400-line advisory limit. It exports 11
  values: it was already 10, the advisory limit is 8 and the hard limit is 15.

### Tests

- **New:** `AS/runtime/recovery/tests/adaptation-promotion.test.ts`, 24
  tests.
- **Extended:** `AS/runtime/tests/training-modes.test.ts`, 5 new tests
  (17 in total).
- They cover each gate, including these fabricated results:
  - `kind: "structural_check"`
  - `status: "passed"`
  - `checkedAt: NaN`
- They also cover:
  - a replay-only record that the tier rates `established` but that is never
    promoted;
  - a hand-built decision that does not hold together;
  - both inputs passed at once.

## Commands run and observed results

**Tests written before the implementation.**
- Command: `npx vitest run .../recovery/tests/adaptation-promotion.test.ts .../tests/training-modes.test.ts`
  (in `packages/fluxiq`).
- Result: **24 failed, 17 passed (41).**
- Some of those were real behaviour failures, not just missing functions:
  - a wrong-kind succeeded result was accepted;
  - a succeeded result with `checkedAt: NaN` was accepted;
  - a failure after a success still passed the apply gate.

**After the implementation.** The same command: **41 passed (41).**

**Deliberate breaks, one at a time, each restored byte-for-byte (`cmp` printed
`RESTORED`).** Each was caught:

| Break | Tests that failed |
| --- | --- |
| M1: drop the no-trial rule | 3 |
| M2: count every result whatever its kind | 1 |
| M3: let an approval override a failure | 3 |
| M4: let `extend` auto-apply | 1 |
| M5: treat the bootstrap `validated` status as an approval | 1 |
| M6: promote `unverified` when the trial count is at least 1 | 3 |

**Type check.** `npx tsc --noEmit` (in `packages/fluxiq`):
- First run: one error in my test (`as const` made `patchKinds` readonly).
  I fixed it.
- Later run: 12, then 3, errors, all in `AS/storage/project/**` tests. That
  is another worker's unfinished storage change, and it was being edited at
  the time.
- No errors in my files.

**Full check.** `pnpm check` (Core root): **exit 0**.
- `structure:test`: `# pass 105`, `# fail 0`.
- `structure-audit: passed (150 warning(s), 254 baselined)`.
- `tsc` for `packages/fluxiq` and `apps/web`: Done.
- The audit printed "1 baseline entries can be lowered". That entry is not
  one of mine: my files have no baseline entries.
- The one warning on my files is the advisory warning that `training-modes.ts`
  exports 11 values.

**Runtime suite, first run.** `npx vitest run src/programs/automation-studio/runtime`:
- Result: **26 failed, 1340 passed.**
- 23 of the failures were `ReferenceError: mapUnmappedAdaptations is not
  defined` in `storage/project/adaptation-store.ts:42`, from the other
  worker's unfinished edit.
- The other 3 had the same cause, surfacing through the API or a failed run.

**Comparison on the 10 failing files: my two source files, then the
committed (HEAD) versions.**
- The `adaptation-store.ts` checksum was the same before and after, so that
  file did not change during the comparison.
- Result: **52 of 52 passed both ways, with identical summaries.** The storage
  edit had landed by then.

**Runtime suite, second run.**
- Result: **4 failed, 1379 passed, 1 skipped (1384).**
- All 4 were `Test timed out in 15000ms`. Another worker's vitest process was
  running at the same time.

**Re-running the 4 on their own.**
- The bootstrap "bridges a generated proposal ID" test passed.
- 3 still timed out.

**Comparison on those 3, mine then HEAD.**
- Result: **14 of 14 passed both ways**, with similar times (17.25 s and
  17.90 s).
- Two of the three never touch these gates (`grep` count 0).
- Conclusion: the timeouts were load, not code.

**Lint.** `npx biome check <my four files>` reported "No files were
processed". This repository's biome configuration ignores these paths, so
lint was not a gate here.

## Not verified

- **No live runs or browser runs**, as the brief says. No service-level test
  exercises the tier path, because `service.ts` does not pass `confidence`
  yet.
- **The whole runtime suite was not green in a single run.** Green was shown
  by the two comparisons and the re-run described above.
- **Nothing calls the bootstrap helpers yet.** Their integration with the
  `trial` review action is C-12's.
- **`pnpm test` and `pnpm build` were not run** for the whole repository.

## Open questions or contradictions found

### 1. The typed store's apply gate lets wrong-kind results through (most important)

- **Where:** `AS/storage/project/adaptation-store.ts:169-170`.
- **The problem:**
  - `reviewTypedFlowAdaptation` (`service.ts:4798-4810`) applies through
    `store.applyApprovedAdaptation` and never calls
    `evaluateFlowAdaptationPromotionGates`.
  - The store's own check is
    `(validationResults ?? []).some((result) => result.status === "succeeded") || hasReviewerApproval`.
    It counts a succeeded result of **any** kind, and it lets a failure after
    a success through.
  - When a project database exists, this is the main apply path.
- **The fix belongs to C-5 or the supervisor.**
  - The store already imports `decideAutomationStudioChangeConfidence` from
    `runtime/flow-change`.
  - Replace the `.some(...)` with:

    ```ts
    const confidence = decideAutomationStudioChangeConfidence({ validationResults: detail.adaptation.validationResults ?? [], riskLevel: detail.adaptation.riskLevel });
    const contradicted = confidence.tier === "unverified" && confidence.lastFailure !== undefined;
    const validated = !contradicted && (confidence.tier !== "unverified" || await this.hasReviewerApproval(detail.adaptationId));
    ```

- **Related, and not new:** this path also skips the destructive,
  structural-proposal and target checks in
  `evaluateFlowAdaptationPromotionGates`.

### 2. `service.ts` changes that finish the switch to the tier

After these edits, delete `adaptationConfidenceScore` from
`adaptation-promotion.ts`. In `training-modes.ts`, delete the old `validated`
branch from `AutomationStudioAdaptationPromotionGateInput`, and reduce the
evidence line to `const evidence = promotionEvidenceRefusal(input.confidence);`.

1. **Line 111 (imports):** replace `adaptationConfidenceScore` with
   `adaptationConfidence`.
2. **Line 2891:** change

   ```ts
   const validated = adaptationValidationCounts(input.adaptation).succeeded > 0;
   ```

   to

   ```ts
   const confidence = adaptationConfidence(input.adaptation);
   ```

3. **Line 2902:** in the gate call, change `validated,` to `confidence,`.
4. **Line 2913:** change

   ```ts
   validationStatus: validated ? "validated" : "unvalidated",
   ```

   to

   ```ts
   validationStatus: confidence.tier === "unverified" ? "unvalidated" : "validated", confidence: confidence.tier,
   ```

   Only this line writes `validationStatus`.
5. **Line 4010:** change

   ```ts
   confidenceScore: adaptationConfidenceScore(adaptation)
   ```

   to

   ```ts
   confidence: adaptationConfidence(adaptation).tier
   ```

   This follows design 2.5: the tier is saved as `metadata.confidence`.

Until C-10 records replays, every saved result either has no kind (read as a
trial) or is a trial. So on today's data the old `validated` path gives the
same answer as the new one. The replay-only case is the only gap, and replay
results do not exist yet.

### 3. Wiring the bootstrap gates (for C-12)

- In `applyFlowBootstrapAdaptation` (`service.ts:4109`), replace the
  status-word check with:

  ```ts
  const gates = evaluateBootstrapAdaptationApplyGates(adaptation);
  if (!gates.ok) throw new Error(`Flow Bootstrap adaptation cannot be applied: ${gates.issues.join("; ")}`);
  ```

- **Caveat:** `reviewFlowBootstrapAdaptation` records an approval with
  `input.actorId ?? null`. After this change, an approval with no actor no
  longer counts, which matches the runtime path's named-reviewer rule. Any
  test that approves without `actorId` and then applies would need an actor.
  I did not check which tests do.
- After a creation trial, call `decideAutomationStudioBootstrapApplyGate`
  with:
  - `mode: adaptation.mode ?? "create"` (or upgrade the record first);
  - `confidence: adaptationConfidence(adaptation)`;
  - the Flow's `proposalMode` and `promoteAdaptations`.

### 4. Decisions I took where the design left a choice

- **An approval does not override a failure.** It stands in for missing
  evidence, not for evidence against the change. This follows the old
  "failures without success" rule and the tier's "contradicted" meaning.
- **"Never promoted with no trial evidence" applies to automatic
  promotion.** A person may still apply on a succeeded replay, or on their
  own named approval, as design 2.6 and the Apply row of the design's table
  (line 72) say.
- **Automatic creation needs `auto` approval mode and `create` mode.**
  `mixed` and `extend` go to a person, matching the existing structural and
  mixed-mode rules.

### 5. A possible gap in `flow-change` (not mine to change)

`decideAutomationStudioChangeConfidence` does not require a non-blank
`runId`. A saved record cannot have a blank one, because
`validateAutomationStudioFlowAdaptation` rejects it on save. An adaptation
built in memory is not checked that way. If the rule should also ignore a
result with no run, the place for it is the filter in
`flow-change/confidence.ts`. The gates will then follow automatically.
