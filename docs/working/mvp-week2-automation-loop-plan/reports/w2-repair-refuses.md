# w2-repair-refuses — the repair loop proposes a repair where it must refuse

**Worker report.** Brief: find why the six refusal tasks of the 2026-09-17 live
campaign produced a `temporary_target_override` proposal, and fix it without
losing the one repair that must stay a repair. Redirected mid-task by the
supervisor after the context audit
([w2-model-context-audit.md](./w2-model-context-audit.md)) showed the page
context was sufficient in four of the six: the loop's shape, not the evidence,
produced the substitute targets. No live provider run was made; the supervisor
reruns these tasks live after integration.

## Outcome

**Done.** The loop could not be answered honestly: under a `diagnose_and_adapt`
grant the only schema-valid reply to "repair this" was a control, so a model
looking at a deleted item, a locked record or a retired page had to name one.
It can now decline, in one of five named ways, and Core records that as a
refusal that proposes nothing. Three further changes stop the call being made
when no answer but a substitute could come back, stop a failure class a target
cannot fix from reaching the domain at all, and — as a second line, after the
model has had its say — refuse a proposed control that is not the one the step
acted on. `identity-drift-repair-renamed-save` still resolves, held by a test on
the real Chromium capture of that page.

Eleven tests fail in five files I do not own — seven in two domain test files,
four in three Core test files — and each needs one fixture or path line. Exact
diffs are in **Changes needed in files I do not own**. Nothing of mine is red.

## What the evidence showed, and what the audit changed

From `test-runs/campaigns/2026-09-17T02-23-20-255Z/summary.json` and the per-run
folders: all six failing tasks ran **two provider calls, no exploration**, with
a failure packet of **3351–3380 bytes**
(`run-mu4y3pm6-5d09061a/evaluation.json`), a validated diagnosis, and one
accepted `temporary_target_override` proposal.

My first reading treated the small packet as part of the cause. The context
audit refuted that for four of the six: the packet described enough of the page
to know there was nothing to repair. What remained true, and is now the centre
of the fix, is that the model had no way to say so. The proposals themselves are
gone — each run used an isolated Core data directory that is discarded at the
end of the run — so what each page offered is reconstructed from the fixtures,
and every conclusion that rests on that says so.

## The five defects

| # | Defect | Verdict | Evidence |
| --- | --- | --- | --- |
| 1 | **A patch request cannot be declined.** | **Confirmed** | Under a `diagnose_and_adapt` grant the response schema was one object with `patches: { minItems: 1, maxItems: 1, items: TARGET_OVERRIDE_PATCH_SCHEMA }` (`llm/deepseek-provider.ts:547`, before this change), and a target override must carry at least one handle (`harness/structured-response.ts` `isAutomationStudioModelAuthoredTargetOverrideTarget`). The provider's own reader refused anything but `kind: "runtime_patch"` (`deepseek-provider.ts:662-668`), and the harness refused any kind but the expected one, with `diagnosis` the single exception (`harness/output-validation.ts:14`). So no schema-valid refusal existed at the patch stage. |
| 2 | **Nothing told the model it could decline, or when.** | **Confirmed** | The target-override instruction asked only for a handle "semantically compatible with the failed nodeId and definitionId" (`deepseek-provider.ts:47`), which is the same too-weak test the domain was applying; the diagnosis instruction listed `stillAchievable` and `patchNeeded` without saying when either is "no" (`deepseek-provider.ts:54`). |
| 3 | **The call was made where no answer but a substitute could come back.** | **Confirmed** | `recovery/plan.ts:87-95` already narrows the patch kinds by failure class, and Core classifies `navigation_unexpected` and `page_changed` as `recovery_path_or_reroute` (`runtime/adaptive-orchestrator.ts:164-166`) — but nothing read the narrowing: `annotate.ts` never passed `plan.allowedPatchKinds` and `patches.ts` never checked them. And `recovery/plan.ts:158` read only `patchNeeded`, so a model answering `stillAchievable: "no"` with `patchNeeded` omitted still got a patch call, because the deterministic default for a target failure is "yes" (`structured-diagnosis.ts:205-207`). |
| 4 | **Core asked the domain about failures a target cannot fix.** | **Confirmed** | `live-patch.ts` `checkRuntimeTargetOverride` (before) never consulted the failure at all, so a guard's interstitial and a retired page reached the domain as ordinary repair questions. |
| 5 | **The domain accepted any control the model had been shown.** | **Confirmed** | Two halves. Core never told the domain what the node addressed: `live-patch.ts:304-315` (before) built the failed action from `nodeId`, `definitionId` and `outputId` only. And the check asked only whether the model had seen the control and whether the verb could use it — stated outright by the test it carried, `renamed-save-override.test.ts` "does not tell a pressable wrong control from Save: Discard, named by its own handle, is accepted as Discard". Separately, a handle that did not stand was replaced by the single compatible element (`target-override.ts:94-100`), which made the domain the author of a repair nobody proposed; that path was live-reachable on three of the six pages, each of which has exactly one element the failed verb could use. |

## What changed, and which of the six tasks each change addresses

| # | Change | Where | Tasks it addresses |
| --- | --- | --- | --- |
| 1 | **A model may decline.** A new `no_repair` response — `{ kind, summary, reason }` — with the reason from a closed list of five: `control_gone`, `control_refused`, `several_alike`, `destination_gone`, `person_required`. The patch schema is now a `oneOf` of the patch and the decline, the provider's reader and the harness's parser accept it, and the harness lets it answer a `runtime_patch` call as `diagnosis` already could. | `llm/harness/structured-response.ts` (the union and the vocabulary), `llm/deepseek-provider.ts` (schema and reader), `llm/harness/provider-result.ts`, `llm/harness/output-validation.ts`, `llm/harness/index.ts` | **All six.** It is the only change that lets the right answer be given rather than inferred: save-and-exit and the deleted item are `control_gone`, the read-only editor and the guarded link `control_refused`, the two Continue buttons `several_alike`, the retired page `destination_gone`. |
| 2 | **Core records a decline as a refusal that proposes nothing**: one receipt in `runtimePatchAttempts` (`kind: "no_repair"`, `preflightOk: false`, the reason by name and in words), `llmGate.patchDeclined`, no adaptation and no change proposal. | `recovery/annotation/patches.ts`, `recovery/annotation/annotate.ts` | **All six**, so that a run that declined does not read like a run that was never asked. |
| 3 | **One sentence in each prompt.** The patch prompt now says when to answer `no_repair` and that a control which is merely pressable is not a repair; the diagnosis prompt says when `stillAchievable` is "no" and that the answer ends the recovery without changing anything. | `llm/deepseek-provider.ts` | **All six.** |
| 4 | **The call is not made where only a substitute could come back**: under a proposal grant, no patch call (and no exploration for it) when the plan allows no target override for the failure, or when the failure is a tie between controls the page describes alike. The reason is recorded in `llmGate.patchSkipped`. | `recovery/annotation/annotate.ts` | **guarded link** and **retired page** (the plan allows only a reroute or a recovery path), **unnamed Continue** (the tie), and **locked record** as a second line — Core's deterministic diagnosis already asks for a person there. Deliberately *not* the deleted item, the read-only editor or save-and-exit: those are `target_not_found`, where a repair is often real, and the call is now worth making because it can come back declined. |
| 5 | **A diagnosis that says the result is unachievable stops the patch** whatever `patchNeeded` says — and no longer cancels the exploration, so "let me look first, then refuse" is reachable. | `recovery/plan.ts` | **All six**, whenever the model answers the diagnosis honestly; the exploration half matters most for the two tasks the audit found under-evidenced. |
| 6 | **A failure class a target override cannot fix never reaches the domain.** `checkAutomationStudioRuntimeTargetOverride` asks Core's own classifier (`candidateKind === "action_target_override"`) and refuses with `failure_not_target_repairable`. A target override the plan did not allow is refused before it runs or is proposed; other patch kinds are left alone. | `runtime/live-patch/` (new directory), `recovery/annotation/patches.ts` | **guarded link**, **retired page**, **locked record**. |
| 7 | **The domain refuses a control that is not the one the step acted on** — the second line, after the model has had its say. Four rules: a twin among the controls the verb could use (`target_indistinguishable`); a different kind of control, where a reset is not a submit and a search field is not a text field (`target_not_equivalent`); a name that joins more actions than the recorded one did (`target_not_equivalent`); and nothing surviving that ties it to the recording — neither the name, whole or shortened from the front, nor the recorded form with one control of that kind left in it (`target_unanchored`). With nothing to compare against, `recorded_target_unknown`. | `domain/src/runtime/llm-evidence/target-equivalence.ts` (new), `target-override.ts` | **save-and-exit** (`target_not_equivalent`), **unnamed Continue** (`target_indistinguishable`), **deleted item** (`target_unanchored`), **read-only editor** (`target_not_equivalent`, or `handle_incompatible` for the revenue text), **guarded link** (`target_not_equivalent`), **retired page** (`target_unanchored`). |
| 8 | **Nothing is substituted for a handle that did not stand.** A handle is the model's own or it is refused; `handleResolution` is therefore always `"named"` and `proposedHandles` is gone. | `domain/src/runtime/llm-evidence/target-override.ts` | **read-only editor**, **guarded link**, **retired page** — the three pages with exactly one element the failed verb could use. |
| 9 | **Core tells the domain what the failed node addressed**: `recordedTarget`, the `element` and `target` of the payload the node dispatches, copied by those two keys only so a typed value never rides along. | `runtime/live-patch/failed-action.ts` | Enables 7 for all six, and keeps **renamed Save** repairable (its form anchor). |

`live-patch.ts` was 744 lines; the check moved into `runtime/live-patch/` with a
barrel and it is now 610. `live-patch.ts` re-exports exactly the names that were
public before, so no importer changed.

### The renamed Save, which must stay a repair

It survives on the form anchor: the recorded form is left with exactly one
control of that kind, the renamed submit. `renamed-save-override.test.ts` proves
it on the real capture, and the same file now proves the refusal of
`Save changes and exit` on that capture with Discard removed and the lone
typeless button in Save's slot.

## Commands run and observed results

All Core runs are from inside `packages/fluxiq`, so they take the repository's
own 15-second test timeout rather than vitest's 5-second default.

| Command | Result |
| --- | --- |
| `npx tsc --noEmit -p packages/fluxiq` (Core) | exit 0 |
| `cd packages/fluxiq && FLUXIQ_TEST_ENV_FILES=none npx vitest run src/programs/automation-studio/runtime/recovery src/programs/automation-studio/runtime/llm/stages src/programs/automation-studio/runtime/llm/tests/no-repair-response.test.ts src/programs/automation-studio/runtime/tests/live-patch --no-file-parallelism` | **25 files, 383 passed, 0 failed.** |
| The same command before the implementation | **22 failed / 67 passed** on the first batch of new tests, each for the reason its name states. The decline tests were written before the branch existed and could not resolve their import at all; as the branch landed they failed in turn on the provider's own reader ("DeepSeek returned output that does not satisfy the requested structure") and on the plan's cancelled exploration, which is what they were written to catch. |
| `cd packages/fluxiq && FLUXIQ_TEST_ENV_FILES=none npx vitest run src/programs/automation-studio --no-file-parallelism` | **232 files, 2053 passed, 5 failed.** Two are `tests/opaque-target-execution.test.ts` and two are schema-shape assertions in `llm/tests/deepseek-provider.test.ts` and `llm/tests/opaque-target-override.test.ts`; all four are fixture or path updates in files I do not own, with diffs below. The fifth, `service-recordings/tests/assets.test.ts` "deletes recording batches with one index and pipeline cleanup pass", **passes on its own** (7/7) and is load noise on this machine. |
| `npm run build` in `packages/fluxiq` | exit 0, twice (the domain imports Core's `dist`, so this is what carries the new contract to it) |
| `npx tsc -p tsconfig.json --noEmit` and `npx tsc -p tsconfig.test.json` (domain) | exit 0 both |
| `npx tsc --noEmit -p packages/fluxiq` (Core), rerun at the end | **exit 2, and not mine**: every error is in `runtime/flow-bootstrap/plan/authoring/json-plan.ts` and `matching.ts`, another worker's in-flight files. My own last clean run was exit 0 before their edit landed. `npm run build` fails on the same two files, so Core's `dist` could not be rebuilt at the end; the `dist` on disk does carry every change the domain reads, which is what the domain run below was against. |
| `pnpm --filter @fluxiq-web-extension/domain test` | **663 tests, 656 pass, 7 fail** on the final run (the count grows as other workers add tests). All seven are in `tests/tools.test.ts` (3) and `tests/recovery-selector-hints.test.ts` (4), neither mine; each fails because its fixture's failed action carries no recorded target, so the check answers `recorded_target_unknown`, or because a refusal changed from `ambiguous` to `absent`. An eighth failure appeared and was mine to fix: another worker raised the failure-evidence byte budget to Core's new figure mid-run, and `renamed-save-override.test.ts` asserted a literal 3,000; it now asserts `WEB_LLM_EVIDENCE_BYTE_BUDGETS.failure`, which is what that row was about. |
| `node scripts/structure-audit.mjs` (Core) | **passed** (156 warnings, 354 baselined) when I ran it after my own changes. A rerun at the end reports **27 violations, none mine**: another worker has an untracked new rule in flight (`scripts/structure-audit/rules/web-vocabulary.mjs`, with no baseline recorded yet — it flags pre-existing names such as `DOMException` in `deepseek-provider.ts:792`), and their new `runtime/flow-bootstrap/plan/authoring/` directory trips the prefix-group and naming rules. My new `runtime/live-patch/` directory draws nothing. |
| `node scripts/structure-audit.mjs` (this repository) | **passed** (63 warnings, 122 baselined) on the final run. Mid-task it reported four violations in another worker's uncommitted `packages/test-runner` work; they have since been fixed by that worker. My files draw two advisory warnings: `domain/src/runtime/llm-evidence/` is now 16 files (advisory 15, limit 25) and `live-patch.ts` is 610 lines (advisory 400, limit 800). |

## Changes needed in files I do not own

### 1. `domain/src/runtime/llm-evidence/tests/tools.test.ts` (3 failures)

```diff
-  const clickAction = { nodeId: "continue", definitionId: "web.output.dom-click" };
+  const clickAction = { nodeId: "continue", definitionId: "web.output.dom-click", recordedTarget: { element: { tagName: "button", visibleText: "Continue" } } };
```

```diff
-  // A handle nobody minted resolves to the one compatible element, and the
-  // target says the model's own proposal was not the one used.
-  assert.deepEqual(bound?.validateTargetOverrideEvidence(validationEvidence, { handles: { element: "target.9" } }, clickAction), {
-    status: "resolved",
-    target: { handles: { element: "target.1" }, handleResolution: "inferred", ...resolution, proposedHandles: { element: "target.9" } },
-  });
+  // A handle nobody minted is refused: nothing is put in its place.
+  assert.deepEqual(bound?.validateTargetOverrideEvidence(validationEvidence, { handles: { element: "target.9" } }, clickAction), { status: "absent", reason: "handle_not_issued" });
```

```diff
-  const clickAction = { nodeId: "node.click", definitionId: "web.output.dom-click" };
+  const clickAction = { nodeId: "node.click", definitionId: "web.output.dom-click", recordedTarget: { element: { tagName: "button", visibleText: "Place order" } } };
```

### 2. `domain/src/runtime/llm-evidence/tests/recovery-selector-hints.test.ts` (4 failures)

Its `CLICK` is one constant while each row resolves a differently named control,
so the recorded control has to come from the packet the handle belongs to:

```diff
 const CLICK = { nodeId: "node.save", definitionId: "web.output.dom-click" };
+
+/** What the recording addressed, for a row that resolves the control named by `handle`: the same control. */
+function asRecorded(packet: JsonObject, handle: string) {
+  const element = (packet.elements as Array<{ target: string; name?: string }>).find((candidate) => candidate.target === handle);
+  return { ...CLICK, recordedTarget: { element: { tagName: "button", role: "button", accessibleName: element?.name } } };
+}
```

```diff
-  return runtime.validateTargetOverrideEvidence(carried.packet, { handles: { element: qualified[2]! } }, CLICK);
+  return runtime.validateTargetOverrideEvidence(carried.packet, { handles: { element: qualified[2]! } }, asRecorded(carried.packet, qualified[2]!));
```

```diff
-  return runtime.validateTargetOverrideEvidence(failure, { handles: { element: handle } }, CLICK);
+  return runtime.validateTargetOverrideEvidence(failure, { handles: { element: handle } }, asRecorded(failure, handle));
```

```diff
-  assert.deepEqual(askAsCore(runtime, explored, "explored.2:target.9"), { status: "ambiguous", reason: "handle_not_issued" });
-  assert.deepEqual(askFailure(runtime, failure, "target.9"), { status: "ambiguous", reason: "handle_not_issued" });
+  assert.deepEqual(askAsCore(runtime, explored, "explored.2:target.9"), { status: "absent", reason: "handle_not_issued" });
+  assert.deepEqual(askFailure(runtime, failure, "target.9"), { status: "absent", reason: "handle_not_issued" });
```

```diff
-  const target = resolvedTarget(runtime.validateTargetOverrideEvidence(altered, { handles: { element: "target.1" } }, CLICK));
+  const target = resolvedTarget(runtime.validateTargetOverrideEvidence(altered, { handles: { element: "target.1" } }, asRecorded(altered, "target.1")));
```

Its last row (`evidence_unrecognized` on a structure packet) is unaffected: that
refusal comes before the target is read.

### 3. `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\tests\opaque-target-execution.test.ts` (2 failures)

Its failed attempt says "The target was not found." in a message and carries no
structured failure, so Core classifies it as `action_failed` and the new gate
refuses the override. One line:

```diff
     status: "failed",
     route: "failed",
     inputs: {},
     outputs: {},
     effects: [],
-    message: "The target was not found."
+    message: "The target was not found.",
+    failure: { category: "target_not_found", code: "example.target.not_found", retryable: true }
```

### 4. `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\llm\tests\deepseek-provider.test.ts` (1 failure)

The patch schema is now a `oneOf` of the patch and the decline, so the assertion
reads one level down. The prompt assertions in that row are unchanged and still
pass.

```diff
-    expect(user.outputSchema).toMatchObject({
+    expect(user.outputSchema.oneOf[0]).toMatchObject({
```

### 5. `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\llm\tests\opaque-target-override.test.ts` (1 failure)

Same reason, same shape. Its browser-noun assertions pass: Core's new sentence
and the new reasons are written in Core's own neutral words.

```diff
-    const targetSchema = (user.outputSchema as any).properties.patches.items.properties.target;
+    const targetSchema = (user.outputSchema as any).oneOf[0].properties.patches.items.properties.target;
```

### 6. `F:\!FluxIQ\docs\architecture\automation-studio.md` (refusal table, lines 948-955)

Two rows change wording and five are new; the no-repair vocabulary wants a table
of its own beside them.

```diff
-| `handle_not_issued` | A handle is not one the evidence issued, and nothing else in it could stand in. |
-| `handle_incompatible` | A handle names something the failed action cannot use, and nothing else in the evidence could stand in. |
+| `handle_not_issued` | A handle is not one the evidence issued. |
+| `handle_incompatible` | A handle names something the failed action cannot use. |
+| `target_indistinguishable` | The element a handle names cannot be told apart from another the failed action could use. |
+| `target_not_equivalent` | The element a handle names does something other than what the failed action's own target did. |
+| `target_unanchored` | Nothing that identified the failed action's own target survives on the element a handle names. |
+| `recorded_target_unknown` | Nothing says what the failed action's own target was, so no element can be shown to be it. |
+| `failure_not_target_repairable` | Core's own: the action did not fail for want of its target, so a different target cannot fix it. |
```

## Files I touched outside my brief's list, and why

The redirect asked for a `no_repair` branch and for Core to record it, which
cannot be done inside `structured-response.ts` and the provider schema alone.
Three further files needed a small additive change each, and each is named here
because another worker is active in that directory:

- `llm/harness/provider-result.ts`: the kind is accepted, its one field
  allowlisted, and the reason checked against the closed list (six lines).
- `llm/harness/output-validation.ts`: a declined answer may answer a
  `runtime_patch` call, exactly as a diagnosis already could (one line).
- `llm/harness/index.ts`: the vocabulary, its guard and the result parser are
  exported (four lines).

## Not verified

- **No live provider run.** Every claim about what the model will do rests on
  the campaign's recorded outcomes, the audit and the fixtures.
- **The prompt sentences are unmeasured.** They are written and asserted, but
  no model has answered them.
- **Which of the six proposals came through the substitution.** The proposals
  were discarded with each run's isolated data directory; that the substitution
  was taken on the three single-candidate pages is inference, not a record.
- **Browser behaviour.** Nothing here was exercised in a browser.
- **The Lab's reading of a `no_repair` receipt.** The issue sentence maps to
  `runtime_patch.preflight_rejected` in the Lab's reducer
  (`packages/test-runner/src/existing-fluxiq-control.ts:636-641`), and
  `kind: "no_repair"` is not in its recognized-kind list, so the kind is
  dropped from the parsed attempt. The judge still sees a refused attempt and no
  proposal, which is what a refusal task is judged on, but if the campaign
  should report *why* it declined, the Lab needs the kind and the
  `declinedReason` added — that is `packages/test-runner`, another worker's
  file, and it is not blocking.
- **`pnpm check` / `pnpm test` at repository level**, and the extension build:
  not run. The extension audit already fails on another worker's in-flight
  `packages/test-runner` changes.

## Open questions and contradictions found

1. **A tie is now refused before the model is asked.** Core's classifier treats
   `target_ambiguous` as a target-override candidate, and in principle a tie the
   matcher cannot break *could* be broken by the recorded form, which Core's
   matcher does not score. Under a proposal grant the call is now skipped for a
   tie, which forecloses that. It is the audit's recommendation and it saves a
   billed call; if the supervisor wants the model to have the chance, the skip
   is one condition in `grantSkipReason`.
2. **The form anchor is what keeps the renamed Save repairable.** A control
   renamed outright, outside any form, with no word of its old name left, is
   refused as unanchored. That is the fail-closed reading, and the cost is real:
   such a repair now needs a person, or evidence an exploration gathers.
3. **English conjunctions are the one piece of language knowledge in the rules.**
   A page in another language keeps the other three rules and loses that one.
4. **Declining is not yet possible at the diagnosis stage's own schema.** The
   diagnosis answers with `stillAchievable`/`patchNeeded`, which the plan now
   honours; the `no_repair` shape exists only for the patch call. That is enough
   for the loop as it stands, but the two channels say the same thing in two
   vocabularies, and a later pass might fold them together.
