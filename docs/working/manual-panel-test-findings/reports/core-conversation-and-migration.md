# Core: starting a conversation, handing the model the panel's vocabulary, and migrating the locked Flows

Worker report. Three Core-side changes, all in `F:\!FluxIQ\packages\fluxiq\`.
Nothing under `apps/web` was edited; two files there were *read* and one test
suite there was *run*, both read-only, and the findings are in §4.

## Outcome

**Done**, all three. Core's full suite, `pnpm --filter fluxiq check`, the
structure audit and the package build all pass, with the observed output quoted
in §5. One finding contradicts the brief's expectation about the `apps/web`
ratchet — see §4.1 — and one judgement call in change 3 deserves the
supervisor's eye, in §3.3.

---

## 1. Change 1 — a person can now start a conversation

Implemented exactly as `ws-d-shell-and-chat.md` §1 specified, four files plus
the handler suite.

| File | Change |
| --- | --- |
| `api/contracts/endpoints.ts` | `openConversation: "open-conversation"`, beside the other five |
| `api/contracts/conversation.ts` | `ConversationOpenRequest`, and the header now says why the asymmetry is about authorship only |
| `api/handlers/conversations.ts` | One more `registry.register`, `programs.write` / `authoring`, after `assertProjectDomainAccess` |
| `api/handlers/tests/domain-scope.test.ts` | Added to `DOMAIN_SCOPED`; the prose count went five → six |
| `api/handlers/tests/conversations.test.ts` | The endpoint added to the shared table, plus two cases of its own and one refusal row |

Two points where I decided something the report left open.

**The subject falls back to the project.** `ConversationOpenRequest` makes
`subjectKind` and `subjectId` optional *together*, and the handler resolves a
missing pair to `{ kind: "project", id: projectId }`. The report proposed
`subjectKind: string` as required and named the project as the right subject for
a person with nothing selected; making it required would have meant the composer
must always send two fields it can derive, and refusing a thread for want of a
subject is the product declining what it was asked for. A named subject is still
carried through, and `requestedSubject` still refuses anything but `project`,
`flow`, `build` or `run` — that refusal is pinned by a new row in the existing
"refuses a payload the collaborator could not make sense of" case.

**No PIN, by construction.** `classification: "authoring"`, the same as
`append-turn`. `programs/tests/endpoint-classification.test.ts` pins the
`destructive` set in full and passes unchanged, so the new endpoint is provably
not PIN-gated: opening a thread deletes nothing and moves no money, and those
are the only two things that may stop for a person.

`openConversation` already continues a subject's open thread rather than minting
a second (`runtime/conversations/conversations.ts:180-183`), so a composer that
calls this on every empty-thread keystroke still yields one conversation.

---

## 2. Change 2 — the model can be handed what the panel can do

Two pieces: a new browser-safe subpath, and the one-line export that stops the
panel keeping its own copy of Core's gate decision.

### 2.1 A browser-safe subpath for the capability vocabulary

New module `runtime/panel-capabilities/`, published as
`fluxiq/automation-studio/panel-capabilities`:

| File | What it is |
| --- | --- |
| `capability.ts` | `AutomationStudioPanelCapability` and its argument type — the exact fields `panelCapabilityVocabulary()` already produces, so the browser hands its list straight across with no translation step to fall out of date. Types only, no import. |
| `parse.ts` | `parseAutomationStudioPanelCapabilities` — forgiving reading of what arrives on a request. Only `id` is required; title, summary and group are filled from the id; a bad entry is dropped rather than the list refused. |
| `vocabulary.ts` | `automationStudioPanelCapabilityVocabulary` — the block of text a model is given, and `automationStudioPanelCapabilityIds` for matching an answer back. |
| `client/index.ts` | The browser-safe barrel the manifest publishes. |
| `index.ts` | The Core-side barrel; re-exported from `runtime/index.ts`. |

**Core declares no capability of its own, and must not.** The panel's registry
stays the single declaration; this is the shape it travels in. Two catalogues
would drift, and a model told about a capability the panel does not have would
offer something that cannot happen. The module is a carrier plus a rendering.

**The rendering is opinionated about one thing, deliberately.** It tells the
model *not* to ask whether it may proceed, and it calls the deleting and
money-moving capabilities "re-authorizing" rather than "needing permission" —
because a model told it needs permission will ask for it, and that is exactly
the failure the corrected defaults exist to remove. Three test cases pin that
wording, including that an empty vocabulary says plainly there is nothing to
operate rather than handing over an empty list a model might read as
"anything goes".

Proven to resolve from `apps/web` after `pnpm --filter fluxiq build`:

```
$ cd apps/web && node -e "import('fluxiq/automation-studio/panel-capabilities')…"
panel-capabilities: AUTOMATION_STUDIO_PANEL_CAPABILITY_MAX, automationStudioPanelCapabilityIds,
                    automationStudioPanelCapabilityVocabulary, parseAutomationStudioPanelCapabilities
```

### 2.2 The gate decision is published, not restated

`runtime/action-permissions/client/index.ts` now also exports
`AUTOMATION_STUDIO_DESTRUCTIVE_ACTION_CONSEQUENCES`. `destructive.ts` imports
only `consequences.ts`, so publishing it costs the browser nothing; the barrel's
own suite now lists `destructive.ts` among the sources it scans for a Node,
gate, service or storage dependency, and a new case asserts the published set is
exactly `["delete", "move_money"]`.

This is what `chat-operates-panel.md` §8.1 asked for. The panel's
`PANEL_CAPABILITY_ASKING_CONSEQUENCES` can now import the decision instead of
restating it — **that edit is in `apps/web` and is not mine.** Until it is made,
the two lists still agree but can still diverge silently.

Verified from `apps/web`:

```
action-permissions: AUTOMATION_STUDIO_ACTION_CONSEQUENCE_PHRASES,
                    AUTOMATION_STUDIO_DESTRUCTIVE_ACTION_CONSEQUENCES,
                    parseAutomationStudioActionPermissionRequest
gated: [ 'move_money', 'delete' ]
```

---

## 3. Change 3 — migrating the Flows the locked default already shipped

New `runtime/service/flow-settings/locked-default-migration.ts`, applied at two
points, with 10 cases in `tests/locked-default-migration.test.ts`.

### 3.1 How a defect's lock is told apart from a person's

This is the part the brief asked me to say plainly, so it gets its own section.

I did **not** use "looks locked" as the test. The rule is: the metadata carries
the defect's lock and nothing a person put there only when **every one of the
gating fields that default wrote is still at the value it wrote**, and the two
`allowRuntimeRecovery` fields are still `true`. One field different anywhere and
nothing is touched at all.

The discriminator that makes this work is narrow and worth naming exactly. A
person choosing `no_llm_intervention` goes through
`withAutomationStudioInterventionMode` (`model/flows.ts`), which writes
`adaptationPolicySettings.allowRuntimeRecovery: false` along with the lock. **The
defective default left that field `true` while locking everything around it** —
an inconsistency nothing deliberate produces. So a Flow a person locked on
purpose fails the fingerprint and is left completely alone, while the defect's
own block matches. The test builds both from the code that produced them rather
than from a literal, and drives the pair against each other.

Seven further "one field different" cases are driven, one per field: a chosen
preset, a chosen training mode, promotion turned on, approval no longer forced,
rerouting allowed, runtime recovery turned off, and a stated mode of its own.
Each leaves the metadata untouched by identity (`toBe(stored)`, not
`toEqual`).

**The residual false positive, stated honestly.** A person who opened the
settings form and saved *without changing anything* produces the defect's block
again and will be migrated. I think that is right — they accepted what was
shown, and what was shown was the defect — but it is a judgement, not a
certainty, and it is the only case where a save is read as an absence of choice.
A person who deliberately locked a Flow through the mode control is not affected.

### 3.2 What is cleared, and what is kept

Cleared (the gates, and only the gates): `adaptationModeVersion`,
`adaptationMode`, `trainingMode`, `proposalMode`, `proposalApprovalMode`;
`trainingModeSettings.{mode, allowLlmIntervention, allowAdaptationCreation,
proposalApprovalMode, allowPromotion, requireFirstManualReviewBeforeAutoPromotion}`;
`adaptationPolicySettings.{preset, proposalMode, allowCreateRecoveryPaths,
allowModifySubflows, allowCreateSubflows, allowModifyRouter,
allowModifyExpectations, allowModifyActionTargets, allowDeleteOrDisableBehavior,
allowExternalSideEffects, requireApprovalForDestructiveChanges,
requireApprovalForExternalSideEffects}`.

Kept, and tested as kept: every budget (`trainForRunCount`,
`minimumStabilityScore`, `recoveryBudget`, `budgets`,
`maxInterventionsPerRun`, `maxEstimatedCostUsdPerRun`), both
`allowRuntimeRecovery` fields, `llmProvider`, `adaptationPolicyId`,
`budgetExhaustedBehavior`, `frozenScopeCount`, and anything else the record
carries. Budgets were never the defect and a person who set one did not choose
to be gated.

**Removal rather than rewriting is the point.** What is left is silence, and
silence now permits — the readers' fallbacks were flipped open on 2026-09-28 and
`merged-metadata.ts` fills the rest from the corrected default. A Flow migrated
this way therefore *tracks* the default from here on instead of freezing today's
answer into its own record. `lockedDefaultSettingsCleared: true` is left behind
so the reason the Flow has no stated mode is on the record, and so the clearing
is visibly attributable rather than silent.

Four cases prove the effect end to end: a migrated Flow may invoke a model,
author a repair and keep what it learned; may re-author every part of itself with
no approval forced on any of it; reads as `fully_adaptive` where before it read
as `no_llm_intervention`; and keeps its original budgets.

### 3.3 Where it is applied, and why not a storage sweep

Two points, both one line:

- `runtime/service/flows/store.ts`, `getFlow` — the single place a stored Flow
  becomes an artifact in memory. Every consumer (runtime, settings UI, the panel)
  therefore sees the migrated Flow, and **the next ordinary save persists it**,
  because `update-flow-settings` and every other read-modify-write starts from
  `getFlow`.
- `runtime/service/flow-settings/merged-metadata.ts` — where a setting becomes a
  decision, so a path reaching settings with metadata straight out of storage is
  still not gated. Clearing is idempotent, so doing it twice costs a comparison.

I chose a read-time migration over a sweep over every project's storage on
purpose: no project has to be visited to be corrected (including ones nobody
opens), and nothing is rewritten on a guess — the clearing writes nothing by
itself. The cost is that a Flow never saved again keeps the old block on disk
while reading as un-gated, which is correct behaviour but is worth knowing.

**Judgement the supervisor may want to revisit:** if a durable, one-shot rewrite
of stored records is wanted instead (an explicit migration with a ledger, the way
legacy Flow migration works), this function is the whole of the decision and a
sweep would call it. I did not build the sweep.

The knock-on the permission-defaults report flagged as open question 2 is now
closed by this: `decideAutomationStudioLlmInvocationGate` refusing on
`policyPreset === "locked"` no longer catches a legacy Flow that reached `locked`
without anyone choosing it, because such a Flow no longer reads as `locked`.

---

## 4. Findings for other workers

### 4.1 The `apps/web` capability ratchet does **not** fail — the brief expected it to

I ran it read-only rather than assuming:

```
$ cd apps/web && npx vitest run src/features/automation-studio/conversation/capabilities
 Test Files  3 passed (3)
      Tests  33 passed (33)
```

It passes with `open-conversation` in Core's map, for two independent reasons,
both read from `tests/coverage.test.ts`:

1. The ratchet measures **only endpoints the panel actually posts**
   (`panelEndpointUse`), and the panel does not post `open-conversation` yet.
2. `MUTATING_VERBS` has no `"open-"` prefix, so even once the composer posts it,
   the ratchet will not require a capability or an excuse for it.

So the WS-D worker does **not** need to add a `PANEL_ENDPOINTS_WITHOUT_A_CAPABILITY`
line to land `startConversation`. If starting a thread *should* be covered — and
I think it should, since a person can plainly ask for it — somebody has to add
`"open-"` to `MUTATING_VERBS` and then declare a `conversation.start` capability.
That is a deliberate decision in a file I do not own, and it is invisible today
rather than loud, which is worth knowing.

### 4.2 Core's `dist` had to be rebuilt

`apps/web` imports these subpaths by package name, resolving through
`packages/fluxiq/package.json` exports to `dist/`. A new subpath does not exist
until Core is built, so I ran `pnpm --filter fluxiq build` and verified both
subpaths import from `apps/web`. Anyone who re-clones or cleans will need the
same build before the panel can import the vocabulary.

### 4.3 The Core check failure the chat-operates-panel worker saw is gone

That report recorded `pnpm --filter fluxiq check` failing on `"router_patch"` in
the permission worker's new `tests/permission-defaults.test.ts`. It is corrected
in the tree now and the check is clean (§5).

---

## 5. Commands run and observed results

**Narrowest first — the endpoint and its neighbours:**

```
$ npx vitest run src/programs/automation-studio/api/handlers/tests/conversations.test.ts \
    src/programs/automation-studio/api/handlers/tests/domain-scope.test.ts \
    src/programs/tests/endpoint-classification.test.ts
 Test Files  3 passed (3)
      Tests  20 passed (20)
```

**The new module and the barrel it sits beside:**

```
$ npx vitest run src/programs/automation-studio/runtime/panel-capabilities \
    src/programs/automation-studio/runtime/action-permissions
 Test Files  8 passed (8)
      Tests  77 passed (77)
```

**The migration:**

```
$ npx vitest run src/programs/automation-studio/runtime/service/flow-settings
 Test Files  2 passed (2)
      Tests  19 passed (19)
```

One case failed first and was a wrong assertion of mine, not a defect:
`trainingModeSettingsFromMetadata` nests the budgets
(`training.budgets.maxInterventionsPerRun`), and I had asserted them flat.
Corrected and re-run green.

**Core package check** — three real type errors first, all mine, all fixed
(`jsonObjectFromUnknown` returns `JsonObject | null` not `| undefined`, twice;
and `exactOptionalPropertyTypes` refusing `metadata: JsonObject | undefined` on
the artifact):

```
$ pnpm --filter fluxiq check
> tsc --noEmit
(no output — clean, exit 0)
```

**Core's full test suite**, run after every fix was in:

```
$ npx vitest run            # packages/fluxiq
 Test Files  419 passed (419)
      Tests  4078 passed | 1 skipped (4079)
   Duration  183.51s
```

No failures and no flakiness on this run, which is worth noting against the
permission-defaults report's §5 (it saw two of three full runs fail on
timeout-shaped, disjoint sets). The live-provider suite
`deepseek-bootstrap-exploration.test.ts` ran its 11 cases in 173s and passed.

**Structure audit:**

```
$ node scripts/structure-audit.mjs
structure-audit: passed (189 warning(s), 355 baselined).
```

No new violation from the new directory or files. (189 warnings is the standing
advisory count for this tree, unchanged.)

**Package build**, so the new subpath resolves:

```
$ pnpm --filter fluxiq build
> tsc -b tsconfig.build.json --clean && tsc -b tsconfig.build.json && node ../../scripts/rewrite-declaration-imports.mjs dist
(clean, exit 0)
$ ls dist/programs/automation-studio/runtime/panel-capabilities/client/
index.d.ts  index.d.ts.map  index.js  index.js.map
```

**Read-only run in `apps/web`** — see §4.1.

---

## 6. Files changed

New:

```
runtime/panel-capabilities/capability.ts                     the contract (types only)
runtime/panel-capabilities/parse.ts                          forgiving reading of what a browser sends
runtime/panel-capabilities/vocabulary.ts                     the text a model is given
runtime/panel-capabilities/index.ts                          barrel
runtime/panel-capabilities/client/index.ts                   the browser-safe barrel
runtime/panel-capabilities/tests/vocabulary.test.ts          6 cases
runtime/panel-capabilities/tests/parse.test.ts               6 cases
runtime/panel-capabilities/client/tests/index.test.ts        3 cases
runtime/service/flow-settings/locked-default-migration.ts    the migration
runtime/service/flow-settings/tests/locked-default-migration.test.ts  10 cases
```

Modified:

```
package.json                                       ./automation-studio/panel-capabilities subpath
api/contracts/endpoints.ts                         openConversation: "open-conversation"
api/contracts/conversation.ts                      ConversationOpenRequest; header reasoning
api/handlers/conversations.ts                      the open-conversation registration
api/handlers/tests/conversations.test.ts           the endpoint, two new cases, one refusal row
api/handlers/tests/domain-scope.test.ts            DOMAIN_SCOPED gains it; prose five -> six
runtime/action-permissions/client/index.ts         publishes the gated consequence set
runtime/action-permissions/client/tests/index.test.ts  destructive.ts scanned; new case
runtime/index.ts                                   exports panel-capabilities
runtime/service/flow-settings/index.ts             exports the migration
runtime/service/flow-settings/merged-metadata.ts   clears the locked block before resolving
runtime/service/flows/store.ts                     clears the locked block on every Flow read
```

All paths relative to `packages/fluxiq/src/programs/automation-studio/` except
`package.json`.

Nothing was committed; the supervisor commits.

---

## 7. Not verified

- **Nothing was run in a browser or against a live provider by me.** No panel, no
  unpacked extension, no DeepSeek call of my own. (The full Core suite's own
  live-provider cases ran and passed, but they exercise Flow bootstrap, not any
  of this.)
- **The vocabulary has not actually reached a model.** The subpath exists, the
  rendering exists and both import from `apps/web` — but nothing in Core yet
  calls `automationStudioPanelCapabilityVocabulary` on a real request, because
  the path from a typed message to a model choosing a capability is the
  composer-to-model loop, which is `apps/web` plus a further Core piece nobody
  has built. The brief asked for the crossing; the crossing is what I built.
- **No stored Flow was actually migrated.** The migration is proven against
  metadata constructed from the code that produced it, not against a Flow read
  out of a real project database. What is unproven is that some real record from
  before 2026-09-28 matches the fingerprint byte for byte — if a record carries a
  field I did not enumerate at a value the default did not write, it will be left
  alone and the person stays gated. **This is the item most worth checking
  against a real project**: open a Flow created before today in the panel and
  confirm its settings read as fully adaptive.
- **The `lockedDefaultSettingsCleared` marker is not surfaced anywhere.** It is
  in the metadata; no UI shows it and nothing reads it back.
- **`automationStudioFlowSettingsFingerprint` will change for a migrated Flow**,
  which invalidates an outstanding LLM execution grant bound to it. I reasoned
  this is correct and harmless — a locked Flow could not use a grant anyway — but
  I did not drive it.
- **The downstream `F:\!FluxIQWebExtension` repository was not checked or built.**
  Every change here is additive, but I ran neither its typecheck nor its tests.
- **`apps/web`'s own typecheck and full suite were not run.** Only the capability
  suite, read-only, to establish §4.1.

---

## 8. Open questions and contradictions found

1. **The brief expected the `apps/web` ratchet to bite, and it does not** (§4.1).
   The gap is invisible rather than loud. Somebody has to decide whether
   `"open-"` belongs in `MUTATING_VERBS`.
2. **Should the migration also rewrite storage?** (§3.3.) Read-time clearing
   corrects everything a person can see or run, and persists on the next save.
   A one-shot sweep with a ledger is the alternative; this function would be
   the whole of its decision.
3. **The one case the migration reads as an absence of choice** is a person who
   saved the settings form without changing anything (§3.1). I migrate them. If
   that is wrong, the fingerprint cannot be narrowed further — nothing in the
   record distinguishes that save from no save at all — and the answer would have
   to be a stored marker on future saves.
4. **`PANEL_CAPABILITY_ASKING_CONSEQUENCES` can now import Core's decision**
   (§2.2), and until somebody in `apps/web` makes that one-line change the copy
   is still a copy. It agrees today.
5. **The `conversation.start` capability does not exist**, so once the composer
   can open a thread, a person can do something from a button that they cannot
   ask the chat window for — the exact asymmetry the capability registry was
   built to eliminate.
