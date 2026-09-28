# Permission defaults: what asked a person, and what asks now

All paths are in `F:\!FluxIQ` (FluxIQ Core) unless stated. Nothing in
`F:\!FluxIQWebExtension` was touched, and nothing under
`apps/web/src/features/automation-studio/settings/`.

## Outcome

Done. The default now asks a person about a real-world `delete` and a real-world
`move_money`, and about nothing else. Twelve gates that could refuse the
automation's own work were found; nine were removed or flipped open, three were
left with a stated reason. The rule is pinned by a new test file that fails the
build if ordinary work is re-gated.

## 1. The current default, before the change

### 1a. Which action consequences asked a person

`packages/fluxiq/src/programs/automation-studio/runtime/action-permissions/destructive.ts:67-73`
held the whole decision in one table:

```
move_money: true
delete: true
modify_existing: false
send_or_publish: true      <-- deviation
create_new: false
```

**Deviation from the rule: one class.** `send_or_publish` was gated. The rule is
explicit that it must not be: a run that sends is a run whose instruction asked
for the send, so a standing gate asks permission for the request itself. The file
even argued for keeping it ("communicating or publishing on the person's
behalf"), which is the reasoning the rule rejects.

The cost was not theoretical. A send was permitted only if the grant named
`send_or_publish` or the instruction-derivation named it with a quote in the
person's own words. That derivation needs a provider call, needs the model to
name the class, and keeps a claim only where the quote is verbatim, so an
instruction saying "send the seller a message" in so many words still stopped the
run whenever any one of those three missed. `destructive.ts:26-37` records that
this exact failure mode had already cost days of live builds for the other
classes.

`modify_existing` was already correctly ungated (2026-09-26).

### 1b. What a Flow could do about itself, out of the box — the larger deviation

This is the bigger half of the regression, and it is not in the consequence table
at all. `model/flows.ts:223-278`, `defaultAutomationStudioFlowSettingsMetadata()`,
is what every newly created Flow gets. It shipped:

| Setting | file:line | Was | Effect |
| --- | --- | --- | --- |
| `adaptationMode` | `model/flows.ts:270` | `no_llm_intervention` | No repair at all |
| `trainingModeSettings.mode` | `:225` | `normal` | Hard-refuses `invokeLlm` and `createAdaptations` whatever the flags say |
| `allowLlmIntervention` | `:228` | `false` | No repair |
| `allowAdaptationCreation` | `:230` | `false` | No authoring of a repair |
| `proposalApprovalMode` | `:231` | `manual` | Every change waits on a person |
| `allowPromotion` | `:232` | `false` | Nothing learned is kept |
| `requireFirstManualReviewBeforeAutoPromotion` | `:233` | `true` | First promotion blocked outright |
| `adaptationPolicySettings.preset` | `:252` | `locked` | Maps to `no_llm_intervention` at `model/flows.ts:74` |
| `allowCreateRecoveryPaths` | `:255` | `false` | No recovery path |
| `allowModifySubflows` | `:256` | `false` | No re-authoring a subflow |
| `allowCreateSubflows` | `:257` | `false` | No new subflow |
| `allowModifyRouter` | `:258` | `false` | No routing change |
| `allowModifyExpectations` | `:259` | `false` | No expectation change |
| `allowModifyActionTargets` | `:260` | `false` | No retargeting a failed action |
| `allowDeleteOrDisableBehavior` | `:261` | `false` | No removing a step |
| `allowExternalSideEffects` | `:262` | `false` | Acting options withheld |
| `requireApprovalForDestructiveChanges` | `:263` | `true` | Approval forced |
| `requireApprovalForExternalSideEffects` | `:264` | `true` | Approval forced |

The readers' fallbacks agreed, so a Flow whose metadata was merely silent got the
same answer: `runtime/service/flow-settings/training-mode-settings.ts:29,31,33`
(`allowLlmIntervention`, `allowAdaptationCreation`, `allowPromotion` all `false`),
`runtime/service/flow-settings/adaptation-policy.ts:28-31`
(`allowDeleteOrDisableBehavior` and `allowExternalSideEffects` `false`, both
`requireApproval*` `true`), and `settings-readings.ts:16` (`trainingModeValue`
falling back to `normal`).

**How far this deviates.** The rule lists what may never be gated: triggering a
repair, repairing again, editing or re-authoring a Flow or subflow, rolling a
version back, re-running, exploring, extracting, judging its own answer, retrying
a failed node, persisting what it learned. The out-of-the-box default gated
**every item on that list except retrying and extracting**. It is the whole of
the rule's prohibited set, shipped as the default, with no user instruction
behind it.

## 2. What the default is now

Only `delete` and `move_money` ask. Everything else proceeds.

`destructive.ts:67-73` is now `move_money: true`, `delete: true`,
`send_or_publish: false`, `modify_existing: false`, `create_new: false`. The
file's header and the table's doc comment carry the reasoning and the date.

`defaultAutomationStudioFlowSettingsMetadata()` now ships `fully_adaptive` with a
`continuous_adaptive` training mode and an `adaptive` policy: every `allow*` is
`true` and both `requireApproval*` are `false`. The three readers' fallbacks were
flipped to match, so silence permits rather than refuses.

An explicit setting still narrows it, and that is tested: a Flow that writes
`"normal"`, `preset: "locked"`, or `proposalApprovalMode: "manual"` is still read
and still honoured.

## 3. Gates that could refuse the automation's own work

### Removed or flipped open

| # | Gate | file:line | What I did |
| --- | --- | --- | --- |
| 1 | `send_or_publish` in the gated set | `runtime/action-permissions/destructive.ts:71` | Removed from the gated set. A send now proceeds with no grant and no derivation. |
| 2 | The whole locked creation default | `model/flows.ts:223-278` | Flipped to `fully_adaptive`/`adaptive`; every `allow*` true, both `requireApproval*` false. |
| 3 | Reader fallback: repair, authoring, promotion | `runtime/service/flow-settings/training-mode-settings.ts:29,31,33` | `false` → `true`. Silence permits. |
| 4 | Reader fallback: removing a step, acting on a page, forced approvals | `runtime/service/flow-settings/adaptation-policy.ts:28-31` | `false`→`true`, `true`→`false`. |
| 5 | `trainingModeValue` falling back to `normal` | `runtime/service/flow-settings/settings-readings.ts:15-17` | Fallback is now `continuous_adaptive`. `normal` hard-refuses `invokeLlm` and `createAdaptations` at `training-modes.ts:174-176` whatever the allow flags say, so an unwritten mode could not repair. Writing `"normal"` still works. |
| 6 | Two validation rules forcing an approval gate on | `model/validation/adaptation.ts:317-322` | **Removed.** They refused a policy as *invalid* unless it required approval for removing a step of a Flow, and for acting on a page. A gate that cannot be switched off is a mechanism that can refuse the product doing its job. |
| 7 | External side effects force manual review before a change is kept | `runtime/training-modes.ts:369` | **Removed.** It sent essentially every real web automation to a person merely for acting on a page. |
| 8 | `riskLevel` `destructive`/`high` force manual review | `runtime/training-modes.ts:367-368` | **Removed** from the standing path. A rating Core gave a change is not the person's instruction. Kept only under an explicit `mixed` setting. |
| 9 | Structural patch forces manual review | `runtime/training-modes.ts:330` | **Removed** from the standing path. Re-authoring a router or subflow is editing a Flow. Kept only under `mixed`. |
| 10 | `riskLevel !== "low"` forces manual review | `runtime/training-modes.ts:331,348` | **Removed.** |
| 11 | `mode !== "create"` — extending an existing Flow always goes to a person | `runtime/training-modes.ts:344` | **Removed.** Extending a running Flow is re-authoring it. |
| 12 | `proposalApprovalMode === "manual"` refuses invoking the model at all | `runtime/training-modes.ts:297` | **Removed.** It conflated "a person reviews the change" with "the run may not try to repair itself", so a person who wanted to see changes got no repair and therefore nothing to review. The proposal gate still routes the change to them. |

`mixed` was kept as the one place a structural or high-risk change still reaches a
person, because `mixed` means exactly "route the major ones to me" and is a
person's own setting. Under the default `auto`, nothing routes.

### Found and deliberately left, with the reason

- **`GRANT_CAPABILITIES`** — `runtime/llm/grant-capabilities.ts:76-82`. Already
  open: every purpose (`diagnosis_only`, `diagnose_and_adapt`,
  `explore_and_adapt`, `build_and_adapt`, `verify_result`) gets `ALL_TASK_KINDS`
  and `iterates: true`. The historic defect where repair was gated on the grant
  purpose being literally `explore_and_adapt` is already fixed. No change needed.
- **`sideEffectAllows`** — `runtime/llm/harness-options/registry.ts:285-292`
  withholds mutating options when no policy governs the call and the caller did
  not opt in. Neither real path is affected: recovery passes
  `mutationsGovernedByPermission: true`
  (`runtime/recovery/annotation/exploration.ts:196`) and Flow authoring passes
  `allowSideEffectsWithoutPolicy: true` (`runtime/service.ts:1561`); and the
  policy branch now reads `true`. Left as is.
- **Unattended repair authorization** —
  `runtime/result-check-authorization/repair.ts:83-104` refuses an unattended
  repair with no standing spend authorization, past its expiry, or past its cost
  ceiling. This is money, not permission, and the rule permits bounding by cost.
  Left.
- **`preflightAutomationStudioRuntimePatch`** — `runtime/live-patch.ts:151-157`
  refuses patches per the adaptation-policy flags. The mechanism is left because
  each flag is now a person's own setting; with the defaults flipped it no longer
  fires unless somebody set it.
- **`promotionEvidenceRefusal`** — `runtime/training-modes.ts:376-381` still
  declines to keep a change no trial has proved. That is evidence, not
  permission, and it is the ratchet that makes removing the gates above safe. It
  is pinned by its own row so the removals are not later read as covering it.
- **`adaptation_policy.locked_allows_changes`** —
  `model/validation/adaptation.ts:304-316`. Internal consistency of a preset a
  person explicitly chose. Left.

## 4. The mechanical pin

New file:
`packages/fluxiq/src/programs/automation-studio/tests/permission-defaults.test.ts`
(14 tests). It sits above `model/`, `runtime/action-permissions/`,
`runtime/training-modes.ts` and `runtime/service/flow-settings/` because the rule
spans all four. It asserts:

- the gated set is exactly `["move_money", "delete"]`, by list and by count;
- `send_or_publish`, `modify_existing` and `create_new` are each ungated, one row
  per class, so a re-gate fails on a row that names the class;
- the creation default is `fully_adaptive`, may invoke a model, create
  adaptations and keep them, and may re-author every part of itself;
- **silence falls open too** — the readers' fallbacks with no metadata at all;
- a policy that allows the work and requires approval for none of it validates
  (the removed validation rules cannot come back);
- a repair is invoked even when a person reviews the proposal;
- a proved change is kept whatever Core rated it, whether or not it acts on a
  page, and whether it created or extended a Flow;
- a change no trial proved is still not kept.

Existing tests that pinned the old rule were updated rather than deleted, each
with a comment saying what changed and why: `runtime/action-permissions/tests/destructive.test.ts`,
`model/tests/intervention-mode.test.ts`, `runtime/tests/training-modes.test.ts`,
`runtime/recovery/annotation/tests/patches.test.ts`,
`api/handlers/tests/flows.test.ts`,
`runtime/tests/service-flows/tests/creation.test.ts`,
`runtime/tests/service-adaptation/tests/{modes,adaptive-loop,runtime-patches}.test.ts`,
`runtime/service/datasets/tests/service-wiring.test.ts`.

## 5. Validation — commands run and what they printed

Narrowest first.

`npx vitest run src/programs/automation-studio/runtime/action-permissions` — before
the test update, exactly 5 failures, all in `destructive.test.ts`, all asserting
the old `send_or_publish` gate:

```
AssertionError: expected { permitted: true } to deeply equal { permitted: false, ...(2) }
-   "missing": Array [ "send_or_publish" ], "permitted": false, "requestId": null,
+   "permitted": true,
 Test Files  1 failed | 4 passed (5)
      Tests  5 failed | 55 passed (60)
```

After: `Test Files 5 passed (5) / Tests 61 passed (61)`.

`npx vitest run src/programs/automation-studio/tests/permission-defaults.test.ts`:
`Test Files 1 passed (1) / Tests 14 passed (14)`.

`npx vitest run src/programs/automation-studio/runtime/tests/training-modes.test.ts`:
`Test Files 1 passed (1) / Tests 13 passed (13)`.

`npx vitest run src/programs/automation-studio/runtime/tests/service-adaptation
src/programs/automation-studio/runtime/tests/service-flows/tests/creation.test.ts`:
`Test Files 17 passed (17) / Tests 80 passed (80)`.

**Full Core suite**, `npx vitest run` in `packages/fluxiq`, run once all fixes
were in:

```
 Test Files  415 passed (415)
      Tests  4050 passed | 1 skipped (4051)
```

**Core package check**, `pnpm --filter fluxiq check` (`tsc --noEmit`): passes with
no output. This caught two errors vitest did not (`"router_patch"` is not an
`AutomationStudioChangeProposalKind`; corrected to `"edit_router"`), so the
typecheck was run again after the fix and again after the barrel-import fix
below.

**Structure audit**, `node scripts/structure-audit.mjs`: my new test file first
failed the `imports` rule for reaching past a barrel
(`"../runtime/training-modes.ts"`); changed to `../runtime/index.ts` and the
violation is gone. One violation remains and **is not mine**:

```
FAIL  [imports] apps/web/src/features/automation-studio/workspace/commands/workspace-commands.ts:
2 import(s) reach into another directory's files instead of its barrel,
e.g. "../../views/view-registry" at line 3. Baseline for this entry is 1.
```

`git status --porcelain -- apps/web` shows many modified files under
`apps/web/src/features/automation-studio/`, so this is the concurrent web worker's
change. I did not touch it.

### Test-suite flakiness observed, and why it is not these changes

Two further full-suite runs on the same code each failed a **different,
disjoint** set of files, almost every failure at exactly 15,0xx ms — vitest's
default timeout. Every one passes in isolation, and much faster:

- Run 2: `assets.test.ts` (528 ms → 334 ms in isolation),
  `instruction-readiness.test.ts` (15,012 ms timeout → 5,581 ms),
  `flow-run-detail-reader.test.ts` (15,164 ms timeout → 1,670 ms). Isolated:
  `Test Files 3 passed (3) / Tests 12 passed (12)`.
- Run 3: 13 failures across 8 files, including
  `src/programs/database-manager/tests/index.test.ts > SQLiteRepository > filters,
  sorts, counts, and pages records in SQLite` at 15,023 ms. That test shares no
  code with anything I changed. Isolated, the six files I re-ran gave
  `Test Files 6 passed (6) / Tests 24 passed (24)`, with `database-manager` at
  3,365 ms.

A failure in `database-manager` is conclusive that this is machine load, not the
permission changes — consistent with `AGENTS.md` on concurrent runs producing
false failures, and with another worker editing `apps/web` at the same time.

## 6. Not verified

- **No live browser or live provider run.** Everything here is unit and
  service-level. The practical effect of a Flow now repairing itself by default
  on a real site is unmeasured.
- **Existing stored Flows keep the old locked settings.** The change moves the
  default for newly created Flows and for any Flow whose settings are silent.
  Flows already saved with `no_llm_intervention` and `preset: "locked"` written
  into their metadata still read that way, correctly, because it is now
  indistinguishable from a person having chosen it. Whether those should be
  migrated is a decision I did not take. This is worth a deliberate answer: every
  Flow created before today carries the locked settings explicitly.
- **`apps/web` was not checked or built.** Another worker owns the settings UI,
  and the web package may surface these defaults; I did not run its typecheck or
  tests, and did not run the repo-root `pnpm check`, which includes them.
- **The full-suite green result is one run of three.** The other two were flaky in
  the way described above. I did not get three consecutive clean full runs.

## 7. Open questions and contradictions found

1. **Should existing Flows be migrated?** See above. A person who created a Flow
   last week still has one that cannot repair itself, and nothing tells them so.
2. **`decideAutomationStudioLlmInvocationGate` still refuses on
   `policyPreset === "locked" || "observe"`** (`runtime/training-modes.ts:292`). I
   left it because both are presets a person explicitly chose. But `locked` is
   also what `model/flows.ts:74` infers from an *absent* `adaptationMode` combined
   with a stored `preset`, so a legacy Flow can reach it without anyone having
   chosen it. Related to (1).
3. **The conversation read during repair is deliberately uncaught**
   (`runtime/recovery/annotation/annotate.ts:213-222`: "deliberately not caught...
   repairing a Flow while silently pretending the person said nothing is how a
   repair contradicts an instruction they already gave"). With repair now on by
   default, this throw reaches further than it used to — it surfaced as a failure
   in `runtime/service/datasets/tests/service-wiring.test.ts`, where a test closes
   the project database pool. I made that test run deterministically, because its
   subject is the dataset store, and did **not** weaken the uncaught read, which is
   outside this brief and is a deliberate safety property. But it sits in tension
   with the standing rule that the runtime is defensive by default and a
   recoverable fault must never end a run. Worth a decision by whoever owns the
   recovery path.
4. **`hasExternalSideEffects` is now unused as a refusal** but remains on
   `AutomationStudioPromotionGateSharedInput`. It is still passed by callers and
   still typed; I left the field rather than change every call site. It is dead as
   a gate.
