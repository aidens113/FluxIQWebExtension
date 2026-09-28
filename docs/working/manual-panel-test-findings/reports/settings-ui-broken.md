# Settings and permissions UI: why a change did not take effect

Worker report. Scope: `F:\!FluxIQ\apps\web\src\features\automation-studio\settings\`.
No file outside that directory was edited.

## Outcome

Done. Six separate defects were found, all of the reported class, and all fixed.
The product owner's symptom — "I switched it away from its defaults and it
didn't work" — is reproduced by at least three of them independently, so no
single fix would have resolved the report.

## The breaks, with evidence

Line numbers are post-fix unless marked "pre-fix".

### 1. The chosen LLM model was written but never read back

`apps/web/src/features/automation-studio/settings/flow-settings-model.ts:328-329` (pre-fix)

```ts
llmProvider: "deepseek",
llmModel: AUTOMATION_STUDIO_DEEPSEEK_DEFAULT_MODEL,
```

`flowSettingsDraftFromFlow` pinned both to the framework default while
`buildFlowSettingsSavePayload` (pre-fix line 425) wrote the chosen id into
`metadata.llmModel`. Core configures two models (`deepseek-flash`,
`deepseek-v4-pro`), and the form offers both. So choosing `deepseek-v4-pro`
saved correctly, and then `FlowSettingsView.tsx:197` re-derived the draft from
the save response and snapped the control back to `deepseek-flash` in the same
render, under the words "Settings saved." Measured before the fix:

```
LOST (changed round trip):
llmModel: set="deepseek-v4-pro" readBack="deepseek-flash"
```

Fixed at `flow-settings-model.ts:341-346`: the provider and model are read from
the stored metadata. An id Core no longer configures resolves to Core's default
via `isAutomationStudioDeepSeekModel`, so a withdrawn model is never offered.

### 2. A save could never turn a setting back to its default

This is the widest break and the closest match to the report.

Core's `update-flow-settings` merges rather than replaces
(`packages/fluxiq/src/programs/automation-studio/api/handlers/flows.ts:104`):

```ts
metadata: withStatedInterventionMode({ ...(current.metadata ?? {}), ...metadata }, metadata),
```

A shallow merge, so a key the patch leaves out **keeps its stored value**. The
payload builder omitted a key whenever its value looked like a default:
`adaptationPolicySettings` when every adaptation setting was at default,
`llmSecretKeyId` when cleared, `adaptationPolicyId` when reset to
`policy.default`. Measured before the fix, on a Flow storing
`preset: "observe"`, `allowModifySubflows: false`,
`adaptationPolicyId: "policy.custom"`, `llmSecretKeyId: "key.old"`, with the
user resetting all four:

```
patch has adaptationPolicySettings: false | adaptationPolicyId: false | llmSecretKeyId: false
after save: {"preset":"observe","allowModifySubflows":false,"policy":"policy.custom","key":"key.old"}
```

Every reset silently reverted. After the fix:

```
patch has adaptationPolicySettings: true | adaptationPolicyId: true | llmSecretKeyId: true
after save: {"preset":"adaptive","allowModifySubflows":true,"policy":"policy.default","key":""}
```

Fixed at `flow-settings-model.ts:405-437` and `452-466`: every setting the form
owns is stated on every save, defaults included, and the three keys are never
omitted. Stored fields the form does not offer (the external-side-effect pair)
are carried through rather than dropped.

### 3. Stored adaptation settings destroyed the framework defaults beside them

`flow-settings-model.ts:489-492` (pre-fix) built `adaptationPolicySettings`
merged with defaults, then spread `...existingMetadata` *after* it, replacing
the merge with the raw stored object. `trainingModeSettings` was re-applied
after the spread; the adaptation half was not, and that asymmetry was the whole
defect. Any Flow with a stored adaptation setting therefore lost
`maxInterventionsPerRun: 3` and `maxEstimatedCostUsdPerRun: 1`,
`numberInputValue(undefined)` returned `""`, both boxes rendered blank, and the
next save wrote `Number("")` — zero. Adaptation interventions were turned off by
a field nobody typed in. Measured before the fix:

```
adaptation fields: {"maxAdaptationInterventionsPerRun":"","maxAdaptationCostUsdPerRun":""}
IDLE SAVE with stored preset only:
  maxAdaptationInterventionsPerRun: "" -> "0"
  maxAdaptationCostUsdPerRun: "" -> "0"
```

Fixed at `flow-settings-model.ts:517-518` (both merged maps re-applied after the
stored metadata) and `331-335` (the read names the default explicitly).

### 4. A blank required limit validated as zero

`flowLimitsInterfaceErrors` tested `Number(value)`, and `Number("")` is `0` —
an integer inside every range — so a blank box passed validation and saved as a
real zero. Fixed at `flow-settings-model.ts:94-98`: a blank required number is
refused.

### 5. A catalog summary redrew saved settings as defaults

`FlowSettingsView.tsx:127-141` (pre-fix) adopted `props.flow` on a revision
change without checking `metadata.summaryOnly`. A summary carries no settings
metadata, so `flowSettingsDraftFromFlow` filled every control with framework
defaults. The mount path guards this (`FlowSettingsView.tsx:36` and `:61`) and
`model/project-change-reconciliation.ts:79` applies the same rule elsewhere —
the adopt path was the one place missing it. A store refresh after a save pushes
exactly that shape: same Flow, newer `updatedAt`, no detail. Fixed at
`FlowSettingsView.tsx:133`.

### 6. The permission defaults were the opposite of Core's

The panel kept its own copy of the adaptation policy defaults. Core's resolver,
`packages/fluxiq/src/programs/automation-studio/runtime/service/flow-settings/adaptation-policy.ts:32-35`,
now resolves a Flow that stored nothing as:

| Setting | Core | Panel (before) |
| --- | --- | --- |
| `allowDeleteOrDisableBehavior` | `true` | `false` |
| `allowExternalSideEffects` | `true` | `false` |
| `requireApprovalForDestructiveChanges` | `false` | `true` |
| `requireApprovalForExternalSideEffects` | `false` | `true` |

So the settings screen described a Flow that does not exist, showing a standing
approval gate Core does not apply. Worse in combination with fix 2: once every
save states every field, the panel would have written its stale answer back over
Core's, defeating the concurrent permission-defaults change. The panel's values
were aligned to Core's rather than redefined, and a test now reads Core's source
and fails the build if the two drift (`tests/settings-round-trip.test.tsx`,
"shows the permission defaults Core actually runs a Flow under"). Core itself was
not edited.

## Making a failure visible

New module `settings/persistence-check.ts`. A rejected save was already
reported; the silent case was not. After an accepted save, what the person asked
for is compared against what the response says is stored, and any setting that
did not survive is named in the UI instead of "Settings saved.":

> Saved, but this setting did not take effect: Model. The value shown is what is
> stored.

Wired into `FlowSettingsView.tsx:200-204` and `SubflowSettingsView.tsx:144-149`.
Whitespace and structured-default re-spacing are normalized before comparing, so
the warning only ever names a real loss.

## Round-trip audit of the whole surface

Every one of the 56 Flow settings survives change -> persist -> read back; the
exhaustive test fails if a setting is added without coverage. Nothing on the
surface writes nowhere. These are editable-in-principle but effectively fixed or
read-only, and are reported rather than changed:

- `authorizedDomainIds` — rendered as a read-only list (`FlowSettingsView.tsx:320`); no editor. Round-trips.
- `trainForRunCount`, `minimumStabilityScore` — no control exists, and no reachable path sets the `train_for_runs` / `train_until_stable` modes that use them: the mode grid sets `adaptationMode`, and `applyFlowAdaptationMode` only ever yields `normal` or `continuous_adaptive`. They round-trip and are validated, but are unreachable from the UI.
- `llmProvider` — one option (DeepSeek); the select cannot change anything.
- `llmRetryCount` — `min=0 max=0`, and validation refuses non-zero.
- `adaptationPolicyId` — the select offers `policy.default` plus a "Custom" entry only when one is already stored; a different policy cannot be chosen, only reset.
- `proposalApprovalMode`, `adaptationProposalMode`, `allowRuntimeRecovery`, `allowAdaptationCreation`, `allowPromotion` — derived from the mode and preset controls by design, not directly editable.

The Subflow save was already dense (every field stated on every request), so it
never had break 2. It gained the silent-drop warning.

## Commands run and observed results

```
npx vitest run src/features/automation-studio/settings
  Test Files  6 passed (6)
  Tests  46 passed (46)
```

Guards confirmed to bite. With the model read-back and summary guard reverted:

```
× keeps every changed setting through change, save and read back
  → expected [ 'Model' ] to deeply equal []
× keeps a chosen LLM model rather than reading the framework default back over it
  → expected 'deepseek-flash' to be 'deepseek-v4-pro'
× saves the chosen model and keeps showing it
× does not let a catalog summary redraw saved settings as defaults
  Tests  4 failed | 5 passed (9)
```

With the adaptation-defaults fix reverted:

```
× leaves a setting untouched by a save that changed nothing
  → {"adaptationPolicySettings":{"preset":"observe"}}: expected '' to be '3'
  Tests  4 failed | 5 passed (9)
```

```
npx tsc --noEmit            (apps/web)
  1 error, in conversation/tests/conversation-view.test.tsx — not this work.
  No error in settings/.

node scripts/structure-audit.mjs
  structure-audit: 5 violation(s) across 4 rule(s)
  All in conversation/capabilities/catalog.ts, conversation/turn-commands.ts
  and packages/.../tests/permission-defaults.test.ts — other workers' files.
  My own violation (a 5th "settings-" prefixed file, baseline 4) was fixed by
  naming the new module persistence-check.ts.

pnpm --filter fluxiq check
  3 errors, all in packages/fluxiq/src/programs/automation-studio/tests/
  permission-defaults.test.ts — the concurrent permission worker's new file.
  No Core file was edited by this work.

npx vitest run            (whole web app)
  Test Files  1 failed | 249 passed (250)
  Tests  3 failed | 1390 passed (1393)
  All 3 in architecture-contract.test.ts, naming
  conversation/capabilities/catalog.ts (841 lines) — not this work.
```

## Not verified

- No live browser run. The round trip is proven at the model layer and through
  the real form driven under `react-test-renderer`, not against a running Core
  server and a real DeepSeek-configured project.
- Core's merge semantics are read from `flows.ts:104` and modelled in the test,
  not exercised live. If Core's handler changes to replace rather than merge,
  the dense write stays correct but the test's model goes stale.
- The permission-default alignment is pinned to Core's source as it stands now.
  The concurrent worker's Core edits are mid-flight; if their values move again,
  the pinning test will fail and name the drift, which is the intent.
- I did not re-run Core's own test suite, only its type check.

## Open questions for the supervisor

1. **Core exports no adaptation-policy defaults constant.** The panel mirrors
   them and a test pins the mirror to Core's source text. The real fix is a
   public subpath export from Core — it already does this for
   `automation-studio/llm-models` — so the panel can import the values. That is
   a Core change and outside this brief.
2. **`trainForRunCount` and `minimumStabilityScore` are unreachable.** They are
   validated and persisted but no control can set them. Either give them
   controls or remove them; right now they are dead weight that a reader of the
   draft will assume works.
3. **Three architecture-contract tests and Core's type check are currently red**
   from concurrent work in `conversation/capabilities/` and
   `tests/permission-defaults.test.ts`. They were red before this work and are
   not affected by it, but `pnpm check` will not pass until those land.
