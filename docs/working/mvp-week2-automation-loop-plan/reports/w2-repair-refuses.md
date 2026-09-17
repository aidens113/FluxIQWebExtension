# w2-repair-refuses — the repair loop proposes a repair where it must refuse

**Worker report.** Brief: find why the six refusal tasks of the 2026-09-17 live
campaign produced a `temporary_target_override` proposal, and fix it without
losing the one repair that must stay a repair. No live provider run was made;
the supervisor reruns these tasks live after integration.

## Outcome

**Done.** Four defects were found, three of them confirmed as the brief
suspected, one partly refuted. The fix is in two places: Core refuses a target
override for a failure class a new target cannot fix, and passes the domain
what the failed node addressed; the domain refuses a proposed control that is
not the one the step acted on. Every one of the six tasks is now refused by a
named reason, and `identity-drift-repair-renamed-save` still resolves, held by
a test on the real Chromium capture of that page.

Seven tests fail in two files I do not own (`tools.test.ts`,
`recovery-selector-hints.test.ts`); both need the recorded target added to their
fixtures, and exact diffs are in **Changes needed in files I do not own** below.

## What the evidence shows

Read from `test-runs/campaigns/2026-09-17T02-23-20-255Z/summary.json` and the
per-run folders. All six failing tasks ran the same shape: **two provider calls,
no exploration**, a failure packet of **3351–3380 bytes**
(`run-mu4y3pm6-5d09061a/evaluation.json`), a validated diagnosis, and one
accepted `temporary_target_override` proposal (`proposalOnly: true`,
`executed: false`, `adaptationCreated: true`). So the model judged each page
from a small packet, with no call available to look further, and nothing between
its answer and a saved proposal but a check that asked the wrong question.

The proposals themselves are gone: each run used an isolated Core data
directory, which is discarded at the end of the run, and no snapshot records the
proposed handle. What each page offered is therefore reconstructed from the
fixtures, and where a conclusion rests on that rather than on a recorded
proposal it says so below.

## The four defects

| # | Suspect | Verdict | Evidence |
| --- | --- | --- | --- |
| a | The domain substitutes the single compatible element for a handle it never issued | **Confirmed** | `domain/src/runtime/llm-evidence/target-override.ts:94-100` (before this change): a handle that was not issued, or that named something the verb could not use, fell through to `resolved.set(name, { element: candidates[0]!, named: false })` whenever exactly one element could fill the parameter. Pinned by `tests/tools.test.ts:113-118` and by the old `target-override.test.ts` row "falls back to the only compatible element". Live-reachable in three of the six: the link guard's interstitial has one clickable element ("Back to the record"), the retired-page notice has one ("Back to the start page"), and the read-only admin console has one fillable control (the customer search). Whether those three runs took that path cannot be proven from the run folders. |
| b | Nothing checks that the proposed element does what the recorded one did | **Confirmed** | Two halves. Core never told the domain what the node addressed: `runtime/live-patch.ts:304-315` (before) built the failed action from `nodeId`, `definitionId` and `outputId` only. And the domain's check asked only whether the model had been shown the control and whether the verb could use it — stated outright by the test it carried, `tests/renamed-save-override.test.ts` "does not tell a pressable wrong control from Save: Discard, named by its own handle, is accepted as Discard". |
| c | A target override is offered for failure classes it cannot fix | **Confirmed for navigation, guards and auth; partly refuted for ambiguity** | Core already classifies `navigation_unexpected` and `page_changed` as `recovery_path_or_reroute` (`runtime/adaptive-orchestrator.ts:164-166`) and `recovery/plan.ts:87-95` narrows the patch kinds to that class — but nothing downstream read the narrowing: `recovery/annotation/annotate.ts:295-338` never passed `plan.allowedPatchKinds`, and `recovery/annotation/patches.ts` never checked a patch kind against it, while `live-patch.ts` `checkRuntimeTargetOverride` never consulted the failure at all. Under a `diagnose_and_adapt` grant the model can only answer with a target override (`llm/deepseek-provider.ts:547`, `minItems: 1, maxItems: 1`), so a navigation failure's patch call could return nothing else. **Ambiguity is different**: Core maps `target_ambiguous` to `action_target_override` (`adaptive-orchestrator.ts:161-163`), and an ambiguity *is* repairable when the proposed control can be told apart from its rivals. What was wrong there was accepting a twin, which is now the domain's refusal rather than a class gate. |
| d | The diagnosis contract has no way, or no prompt, to say "not repairable" | **Partly refuted, partly confirmed** | The contract has the words: `diagnosis.stillAchievable` and `diagnosis.patchNeeded` (`llm/deepseek-provider.ts:68-80`, validated in `llm/harness/provider-result.ts:113-125`). Three things stopped them working. (i) `recovery/plan.ts:158` read only `patchNeeded`, so a model that answered `stillAchievable: "no"` and left `patchNeeded` out still got a patch call, because the deterministic default for a target failure is "yes" (`recovery/structured-diagnosis.ts:205-207`). **Fixed here.** (ii) Nothing in the prompt says when to answer "no": the diagnosis instruction lists the fields (`deepseek-provider.ts:54`) and the target-override instruction asks for a handle "semantically compatible with the failed nodeId and definitionId" (`deepseek-provider.ts:47`), which is exactly the too-weak test the domain was applying. **Diff below; that file is not mine.** (iii) At the patch stage under a proposal grant the model cannot decline at all, because the schema requires exactly one target override. **Diff below.** |

## Per-task table

The six that failed, the one that must keep passing, and the three that were
already right. "Refused by" names what now stops it, in the order the checks run.

| Task (run) | Failure | Cause | Fix | Test |
| --- | --- | --- | --- | --- |
| `identity-drift-refuse-save-and-exit` (`run-mu4y3pm6-5d09061a`) | `web.target.not_found` | (b): "Save changes and exit" is the form's one button, in Save's slot, and nothing compared it with Save | Domain: a name that joins another action to the recorded one is `target_not_equivalent` | `tests/renamed-save-override.test.ts` "refuses Save changes and exit, the different action standing in Save's slot" (on the real capture, with Discard dropped and the lone typeless button in Save's slot); `tests/target-equivalence.test.ts` "a control that joins another action to the recorded one…" |
| `ambiguous-targets-refuse-unnamed-continue` (`run-mu4y6zyc-2b986fca`) | `web.target.ambiguous` | (b): the two Continue buttons share every signal a resolution carries | Domain: a proposal with a twin among the controls the verb could use is `target_indistinguishable` (status `ambiguous`) | `tests/target-equivalence.test.ts` "refuses either of two Continue buttons nothing tells apart" |
| `failure-surfaces-refuse-deleted-item` (`run-mu4y93bn-1a2e059b`) | `web.target.not_found` | (b), and (a) if the model named the deletion notice | Domain: nothing of the recording survives on any button left on that page → `target_unanchored`; the notice itself → `handle_incompatible`, with nothing put in its place | `tests/target-equivalence.test.ts` "refuses any button left on a page whose recorded item was deleted" |
| `failure-surfaces-refuse-guarded-link` (`run-mu4ya9vt-cad840da`) | `web.navigation.unexpected` | (c), and (a): the guard's interstitial has one clickable element | Core: the class gate refuses before the domain is asked; the grant makes no patch call at all. Domain (second line): a link is not the recorded button | Core `tests/live-patch-target-override.test.ts` "refuses an override for a %s failure without asking the domain"; `recovery/annotation/tests/annotate.test.ts` "under a proposal grant, makes no patch call for a %s failure"; domain `tests/target-equivalence.test.ts` "refuses the link guard's way back…" |
| `admin-console-refuse-read-only-edit` (`run-mu4ybggw-b8a18765`) | `web.target.not_found` | (a): the page's one fillable control is the customer search, so any handle that did not stand resolved to it; and (b) | Domain: no substitution, and a search field is not the recorded revenue field (`target_not_equivalent`); the revenue text is `handle_incompatible` | `tests/target-equivalence.test.ts` "never types the recorded revenue into the search box, named or substituted" |
| `navigation-refuse-retired-page` (`run-mu4yd33n-5555aa0a`) | `web.navigation.unexpected` | (c), and (a): the not-found notice has one link | Core: class gate and the grant skip, as above. Domain: nothing ties "Back to the start page" to the recorded "Second page" → `target_unanchored` | Core class-gate rows above; domain `tests/target-equivalence.test.ts` "refuses the not-found page's way back as the recorded link" |
| `identity-drift-repair-renamed-save` — **must stay a repair** | `web.target.not_found` | — | Held by the form anchor: the recorded form is left with exactly one control of that kind, the renamed submit | `tests/renamed-save-override.test.ts` "accepts an override naming the renamed Save, and resolves it fingerprint first" (unchanged expectations, now with the recorded Save passed); `tests/target-equivalence.test.ts` "the one control of its kind in the recorded form stands in for a renamed one, and two do not" |
| `failure-surfaces-refuse-locked-record` | `blocked_by_capability_or_policy` | already correct (no validated diagnosis) | Unchanged, and now refused twice over: Core's deterministic diagnosis calls for a person, and the class gate would refuse an override anyway | Core `annotate.test.ts` blocked-by-policy row |
| `modal-flows-refuse-blocking-offer`, `multi-tab-refuse-blocked-popup` | no validated diagnosis | already correct | Unchanged | — |

## What changed and why

### Core (`F:\!FluxIQ`, on `b0f1407`)

- **`runtime/live-patch/` (new directory, with a barrel).** `live-patch.ts` was
  744 lines; the target-override check moved out and it is now 610. The
  directory holds `refusal-reasons.ts` (the closed vocabulary and the contract a
  domain answers in), `failed-action.ts` (what the domain is asked about) and
  `target-override-check.ts` (the check both the proposed and the executed path
  share). `live-patch.ts` re-exports exactly the names that were public before,
  so no importer changes. `runtime/` stays at 24 source files (a directory is
  not a file for the audit).
- **A failure-class gate.** `checkAutomationStudioRuntimeTargetOverride` asks
  `classifyAutomationStudioAdaptiveFailure(...).candidateKind ===
  "action_target_override"` before the domain is asked, and refuses with the new
  Core-owned reason `failure_not_target_repairable`. It reuses Core's own
  classifier rather than a second list, so a subflow's `action_failed` — which
  Core already treats as a target-override candidate, and which the service
  tests rely on — still passes.
- **The recorded target reaches the domain.**
  `AutomationStudioRuntimeTargetOverrideFailedAction` gained
  `recordedTarget?: { element?, target? }`, read from the payload the node
  dispatches (a policy action's `parameters`, any other node's parameter
  values), copied by those two keys only, so a typed value never rides along. A
  state binding is not a target.
- **The plan's narrowing is now load-bearing.**
  `applyAutomationStudioRuntimeRecoveryPatches` takes `allowedPatchKinds`
  (required, never defaulted) and refuses any other kind before it runs or is
  proposed, saying whether the policy or the failure left it out. `annotate.ts`
  passes `plan.allowedPatchKinds`, and under a `diagnose_and_adapt` grant makes
  no patch call — and runs no exploration — when the plan allows no target
  override, recording why in `llmGate.patchSkipped`.
- **A diagnosis that says the result is unachievable stops the patch.**
  `recovery/plan.ts` refuses a patch request on `stillAchievable: "no"`
  whatever `patchNeeded` says, and drops the exploration that would only have
  served it.
- **Refusal wording.** `handle_not_issued` and `handle_incompatible` no longer
  say "and nothing else could stand in", because nothing does now. Five reasons
  are new: `target_indistinguishable`, `target_not_equivalent`,
  `target_unanchored`, `recorded_target_unknown` and
  `failure_not_target_repairable`. A class refusal reads "Target override cannot
  repair this failure: …", which still contains "target override" and not
  "target node", so the Lab's issue-code reducer
  (`packages/test-runner/src/existing-fluxiq-control.ts:636-637`) maps it to
  `runtime_patch.target_override_rejected` with the reason beside it.

### This repository (`F:\!FluxIQWebExtension`, on `5e583ef`)

- **`domain/src/runtime/llm-evidence/target-equivalence.ts` (new).** Four rules,
  each refusing with one of Core's words: a twin among the controls the verb
  could use (`target_indistinguishable`); a different kind of control, where a
  reset is not a submit and a search field is not a text field, with an unstated
  button type read as unknown rather than wrong (`target_not_equivalent`); a
  name that joins more actions than the recorded one did, counted rather than
  matched against a phrase list (`target_not_equivalent`); and no surviving tie
  to the recording — neither the name, whole or shortened from the front, nor
  the recorded form with exactly one control of that kind left in it
  (`target_unanchored`). With nothing to compare against,
  `recorded_target_unknown`.
- **`target-override.ts`.** The substitution is gone: a handle stands or is
  refused, and an accepted repair is always the model's own handle, so
  `handleResolution` is now `"named"` and `proposedHandles` is gone. Every
  resolved repair now passes the equivalence check first.

A place in a list is deliberately not a distinguishing signal: two "Add to
cart" buttons that differ only by row are refused, because a row number is a
position and not an identity.

## Commands run and observed results

| Command | Result |
| --- | --- |
| `npx tsc --noEmit -p packages/fluxiq` (Core) | exit 0 |
| `FLUXIQ_TEST_ENV_FILES=none npx vitest run src/programs/automation-studio/runtime/recovery src/programs/automation-studio/runtime/llm/stages src/programs/automation-studio/runtime/tests/live-patch --no-file-parallelism` | **23 files, 370 passed, 0 failed.** Before the implementation, the same command on the new tests gave 22 failed / 67 passed, each for the reason its name states. |
| `FLUXIQ_TEST_ENV_FILES=none npx vitest run src/programs/automation-studio --no-file-parallelism` | _(filled in below)_ |
| `npm run build` in `packages/fluxiq` | exit 0 (the domain imports Core's `dist`, so this is what carries the new contract to it) |
| `npx tsc -p tsconfig.json --noEmit` and `npx tsc -p tsconfig.test.json` (domain) | exit 0 both |
| `pnpm --filter @fluxiq-web-extension/domain test` | **653 tests, 646 pass, 7 fail.** All seven are in `tests/tools.test.ts` (3) and `tests/recovery-selector-hints.test.ts` (4), neither of which I own; each fails because its fixture's failed action carries no recorded target, so the check answers `recorded_target_unknown`, or because a refusal changed from `ambiguous` to `absent`. Diffs below. |
| `node scripts/structure-audit.mjs` (Core) | passed (156 warnings, 354 baselined) |
| `node scripts/structure-audit.mjs` (this repository) | **4 violations, none mine**: `packages/test-runner/src/flow-lane/repair/apply-repair.ts` (failure-as-empty), `run-scenario.ts` (835 lines, and an import), `flow-lane/repair/replay-repair.ts` (import). All four are in another worker's uncommitted `packages/test-runner` work. My files draw two advisory warnings only: `domain/src/runtime/llm-evidence/` is now 16 files (advisory 15, limit 25), and `live-patch.ts` is 610 lines (advisory 400, limit 800). |

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

The last row of that file (`evidence_unrecognized` on a structure packet) is
unaffected: that refusal comes before the target is read.

### 3. `packages/fluxiq/src/programs/automation-studio/runtime/llm/deepseek-provider.ts` (prompt)

This is the half of defect (d) that code cannot close. The model is still told
to pick a "semantically compatible" handle, and is never told when to decline.

```diff
-const AUTOMATION_STUDIO_RUNTIME_TARGET_OVERRIDE_INSTRUCTION = "For a target override, fill target.handles with opaque handles copied exactly as failureEvidence names them, one per repairable parameter it offers, choosing handles semantically compatible with the failed nodeId and definitionId. Never invent a handle, never write a locator, path, query, or expression of your own, and never name something that belongs to another action.";
+const AUTOMATION_STUDIO_RUNTIME_TARGET_OVERRIDE_INSTRUCTION = "For a target override, fill target.handles with opaque handles copied exactly as failureEvidence names them, one per repairable parameter it offers. Name the control that does what the failed step's own control did, renamed or moved; a control that does something else, does more than it did, or cannot be told apart from another like it is not a repair, and neither is the nearest thing left on the page. Never invent a handle, never write a locator, path, query, or expression of your own, and never name something that belongs to another action.";
```

```diff
-const AUTOMATION_STUDIO_DIAGNOSIS_FIELDS_INSTRUCTION = "Put your reading of the failure in the diagnosis object, not only in the summary: expected, observed and changed in at most 500 characters each, stillAchievable and deterministicRecoveryPossible as one of yes, no or unknown, and explorationNeeded and patchNeeded as booleans. Omit a field you cannot answer rather than guessing it. The summary is prose nothing acts on; these fields are what the recovery is decided from.";
+const AUTOMATION_STUDIO_DIAGNOSIS_FIELDS_INSTRUCTION = "Put your reading of the failure in the diagnosis object, not only in the summary: expected, observed and changed in at most 500 characters each, stillAchievable and deterministicRecoveryPossible as one of yes, no or unknown, and explorationNeeded and patchNeeded as booleans. Answer stillAchievable no, and patchNeeded false, where the step's intended result can no longer be had: what it acted on is gone with nothing that does the same thing, it is refused on purpose, or only a person can settle it. That answer is the correct one as often as a repair is, and nothing is changed after it. Omit a field you cannot answer rather than guessing it. The summary is prose nothing acts on; these fields are what the recovery is decided from.";
```

**Optional, and a wider change:** under a `diagnose_and_adapt` grant the patch
schema is `{ type: "array", minItems: 1, maxItems: 1, items: TARGET_OVERRIDE_PATCH_SCHEMA }`
(line 547), so at the patch stage the model is required to name a control. With
the two prompt changes above the refusal happens one stage earlier, at the
diagnosis, which is where the plan can act on it — so this is not blocking. If
the patch stage should be able to decline too, it needs `minItems: 0` plus a
reason field, and a receipt for an empty patch response.

### 4. `F:\!FluxIQ\docs\architecture\automation-studio.md` (refusal table, lines 948-955)

Two rows change wording and five are new:

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

## Not verified

- **No live provider run.** Every claim about what the model will do rests on
  the campaign's recorded outcomes and on the fixtures, not on a new run.
- **Which of the six proposals came through the substitution.** The proposals
  were discarded with each run's isolated data directory. The substitution was
  reachable on three of the six pages; that it was taken is inference.
- **The prompt diffs are unmeasured.** They are not applied here, and their
  effect on the model's answers has not been observed.
- **Browser behaviour.** Nothing here was exercised in a browser; the domain
  check and Core's gate are pure functions over a packet and a trace.
- **`pnpm check` / `pnpm test` at repository level** were not run: the extension
  audit already fails on another worker's in-flight `packages/test-runner`
  changes, and the extension build was not touched by this work.
- **The rebuilt Core `dist`.** `packages/fluxiq/dist` was rebuilt so the domain
  could see the new contract. It is ignored by git, but any other worker running
  domain tests now runs against a Core that includes this change.

## Open questions and contradictions found

1. **Ambiguity is repairable in principle, and the brief's suspect (c) reads as
   if it is not.** A `target_ambiguous` failure can be fixed by a target that
   singles one control out; what cannot be accepted is a twin. The gate follows
   Core's own classifier and the twin rule does the refusing, so
   `ambiguous-targets-refuse-unnamed-continue` is refused either way — but if
   the intent is that no ambiguity may ever be repaired, the gate is one line
   away and should be the supervisor's call.
2. **The form anchor is what keeps the renamed Save repairable.** A control
   renamed outright, outside any form, with no word of its old name left, is now
   refused as unanchored. That is the fail-closed reading of the brief, and it
   is a real cost: such a repair would have to come from a person or from
   evidence the exploration gathers, not from this check.
3. **English conjunctions are the one piece of language knowledge in the rules.**
   A page in another language keeps the other three rules and loses that one.
4. **The six runs had no exploration and 3.4 KB of page evidence.** The
   detection tool wired in `5e583ef` and the exploration stage can give a repair
   more of the page, but exploration only runs when the diagnosis asks for it,
   and none of these six asked. Worth watching on the rerun: whether a model
   that explores first stops proposing substitutes, or only proposes better
   ones.
