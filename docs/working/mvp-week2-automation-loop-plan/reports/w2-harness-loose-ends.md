# `w2-harness-loose-ends`: the four deferred items in Core's LLM harness

Path prefix: `AS/` is Core's `packages/fluxiq/src/programs/automation-studio/`.
Core is `F:\!FluxIQ`; downstream is `F:\!FluxIQWebExtension`.

## Outcome

**Partial.** Three of the four are built, wired and observed passing. The fourth
cannot be done inside the file boundary this brief drew, and the brief said to
say so and stop rather than half-apply it, so it is not applied. Its exact
atomic diff is below.

| Item | State |
| --- | --- |
| 1. The recovery context reaches the model | **Built, not yet fed.** The packet slot, the input field and the outbound payload are done and tested. Nothing fills the slot until two lines land in `service.ts`, which this brief forbids. Exact net-zero diff below |
| 2. A named channel for a structured diagnosis | **Built at the boundary, reader not switched.** All four `AS/runtime/llm/**` edits are in and tested. `recovery/structured-diagnosis.ts` still reads `response.metadata`, which is still stripped, so `modelFields` is still empty in the shipped app. One-line diff below |
| 3. The gather instruction | **Done.** Core's `gather` no longer describes tools; the tool policy is a separate Core instruction added only to a request that carries tools |
| 4. `deniedEvidenceKeys` required and failing closed | **Not applied, deliberately.** Seven of the eight call sites are in `AS/runtime/tests/**`, which this brief forbids. Exact diff below; one of the eight is already done |

I also found and fixed a live defect I had introduced myself, midway through:
see *The module cycle* below. It silently removed the opaque handle's pattern and
length bound from the schema the model is sent.

Downstream: **nothing changed.** `domain/src/runtime/llm-evidence/tools.ts`
already declares the seven keys and already has the field required, so the
brief's "check, and fix if needed" resolved to "no change needed".

---

## What changed and why

Every file below is under `AS/runtime/llm/**`.

### 1. The recovery context now has somewhere to go

Three hunks, taken from `w2-1-recovery-context.md` and re-checked against the
files as they stand. All three still applied; the line numbers had moved.

- **`harness/context-packet.ts`** - `recoveryContext?: AutomationStudioRuntimeRecoveryContext`
  on `AutomationStudioLlmContextPacket`, and in the returned object beside the
  `failureEvidence` spread, behind the same task-kind guard: a `flow_bootstrap`
  or `evidence_tool_decision` packet never carries it. A Flow that has never run
  has no failure to describe.
- **`harness/task-request.ts`** - the matching field on
  `AutomationStudioLlmHarnessInput`.
- **`harness/intervention.ts`** - the report's third hunk, **not applied as
  written**, and the file now carries a comment saying why. See *The module
  cycle*. The counts-only record it would have written already exists once, at
  `service.ts:3176`, on the run's `llmGate` metadata.

Both remaining imports are `import type`, so they are erased and add no runtime
edge from the harness into `runtime/recovery`.

`llm/tests/recovery-context-packet.test.ts` (new, 3 tests) holds three things:
the packet carries the context for `runtime_diagnosis` and `runtime_patch` and
for nothing else; the sections reach the **outbound request body** a provider
actually sends, asserted against a stubbed `fetch` through the real DeepSeek
provider; and the recorded intervention holds none of the context's contents.

### 2. A named channel for a structured diagnosis

`metadata` stays stripped. What is added is one recognized field beside it.

- **`harness/structured-response.ts`** - the `diagnosis` variant gains
  `diagnosis?: AutomationStudioLlmDiagnosisFields`, a type with exactly seven
  keys: three bounded descriptions, two three-word verdicts, two booleans. Also
  `AUTOMATION_STUDIO_LLM_DIAGNOSIS_TEXT_MAX_LENGTH = 500`, the same bound the
  runtime's reader already holds the fields to. The strip preserves `diagnosis`
  and keeps dropping `metadata`, staying a named-field allowlist.
- **`harness/provider-result.ts`** - `diagnosis` joins the diagnosis kind's
  allowlist, and `validateUnknownDiagnosisFields` checks it key by key: unknown
  key, over-long description, non-enum verdict, non-boolean flag and
  not-an-object each get their own code.
- **`deepseek-provider.ts`** - `DIAGNOSIS_FIELDS_SCHEMA` with
  `additionalProperties: false` on the diagnosis output schema, plus a system
  instruction asking the model to fill it. Permitting the object and asking for
  it are both needed; without the instruction a model puts everything in
  `summary`, which is the state this replaces.

The bound lives in `structured-response.ts` rather than being imported from
`recovery/structured-diagnosis.ts` on purpose: the wire contract belongs to the
harness, and a value import the other way is what caused the cycle described
below. **The two constants are now the same number stated twice.** The right
close is for `recovery/structured-diagnosis.ts` to import Core's, which needs an
edit in a directory this brief forbids.

`llm/tests/diagnosis-channel.test.ts` (new, 3 tests): the fields arrive and
`metadata` still does not; five distinct refusals; and the provider asks for the
fields in both the schema and the prompt.

### 3. The gather instruction suits a request with no tools

`AUTOMATION_STUDIO_LLM_EVIDENCE_DECISION_INSTRUCTION` was Core's `gather` stage
instruction verbatim, and Phase 2.2 made every runtime diagnosis a staged
`gather`. A runtime diagnosis carries no tools and no decision schema, so every
diagnosis was told which tool to choose, not to repeat a `toolId`, and to
evaluate the complete variant of a schema that was not in its request.

- **`stages/instructions.ts`** - `gather` gets its own text about finding out
  what is true before deciding, preferring observation, and reporting a gap as a
  gap rather than assuming a value. `AUTOMATION_STUDIO_CORE_LOOP_EVIDENCE_TOOL_POLICY_INSTRUCTION`
  carries the tool policy **by reference**, so there is still exactly one copy of
  that text in the codebase.
- **`stages/registry.ts`** - `automationStudioLoopStageInstructions` takes a
  third argument, `{ toolsOffered }`, and inserts the tool policy between the
  ordering statement and the stage's own instructions when the stage is `gather`
  and the request has tools.
- **`harness/context-packet.ts`** - `toolsOffered` is read off the packet being
  built (`evidence_tool_decision` with a non-empty tool list), not asserted by
  the caller.

**A domain that replaces `gather` still gets the tool policy, and that is
deliberate.** The policy describes Core's own evidence loop - its decision
schema, its complete variant, its `{ok:false,code}` result shape - so it is
mechanism, not what gathering means for a medium. It carries a reserved
`core.loop-stage.` id, so no registration can address it, which is the same rule
Phase S applied to the schema instruction and the injection defence.

`stages/tests/registry.test.ts` gains a test that runs both shapes through the
harness and asserts the instruction ids: with tools,
`order -> tool-policy -> core.loop-stage.gather`; a `runtime_diagnosis` staged as
`gather`, `order -> core.loop-stage.gather` and nothing else. It also asserts
Core's new gather text contains none of `tool`, `schema`, `toolId`,
`complete variant`, `mutating`, so nothing puts the policy back through the
stage instruction. Two existing tests in that file were updated: the replacement
test now expects the tool policy beside the domain's instruction, and the
unstaged-path test now asserts the exploration **policy** rather than the gather
**stage body**, which are no longer the same string.

The neutrality guard - Core's stage prose names no browser concept - now covers
the tool policy too. Writing the new gather text against it caught one trap
worth recording: the phrasing proposed in `w2-2-diagnosis-plan.md` opened with
*"Establish what is actually true"*, and `esTABlish` contains `tab`. The guard
is a substring check, so that text would have failed it.

### 4. `deniedEvidenceKeys` - measured, then not applied

I made the field required and ran the type check. **Exactly eight call sites
break, in four files:**

```
llm/harness-options/tests/binding.test.ts:13          <- mine, already fixed
runtime/tests/service-adaptation/tests/llm-diagnosis.test.ts:109, 208, 239
runtime/tests/service-bootstrap/tests/generation.test.ts:168, 204, 237
runtime/tests/service-bootstrap/tests/rejections.test.ts:79
```

Seven of the eight are under `AS/runtime/tests/**`, which this brief forbids me.
So I reverted the change: a required field applied without them stops Core
compiling, which is the Phase P failure the brief named.

**The same is true of the fail-closed default**, and it is worth being explicit
because it looks separable and is not. Failing closed means
`packAutomationStudioLlmContext` refusing to build a packet when evidence needs
sanitizing and no declaration arrived. Three of those seven fixtures
(`llm-diagnosis.test.ts:109, 208, 239`) bind `captureSanitizedFailureEvidence`
and declare no keys, so they would start throwing at run time. The type change
and the behaviour change break the same files; neither half is safely separable
from the other.

What I did do, inside my own files, is remove one of the eight:
`llm/harness-options/tests/binding.test.ts` now declares
`deniedEvidenceKeys: ["ledgerExport"]` on its slot fixture. The change is
non-breaking today and shrinks the atomic edit to one directory the supervisor
can do in a single pass.

**Downstream needs nothing.** `domain/src/runtime/llm-evidence/tools.ts` already
has `deniedEvidenceKeys: readonly string[]` required on
`WebAutomationLlmEvidenceRuntime` and returns the seven keys from
`createWebAutomationLlmEvidenceRuntime`. Re-checked against the current working
tree, which now contains another worker's in-flight refactor of that file; the
declaration survived it.

---

## The module cycle, and why it matters more than the hunk it cost

Applying `w2-1-recovery-context.md`'s third hunk as written -
`harness/intervention.ts` value-importing
`summarizeAutomationStudioRuntimeRecoveryContext` from `../../recovery/index.ts`
- was correct when that report was written and is not correct now. Between my
first green suite run and my second, the Phase 2.3 worker added
`recovery/runtime-exploration.ts`, which **value**-imports
`runAutomationStudioLlmEvidenceLoop` from `../llm/index.ts`.

Together those close a runtime cycle:

```
llm/index.ts -> harness.ts -> harness/index.ts -> harness/intervention.ts
  -> recovery/index.ts -> recovery/runtime-exploration.ts -> llm/index.ts (partial)
```

`deepseek-provider.ts` builds its output schemas at module load, so
`AUTOMATION_STUDIO_RUNTIME_TARGET_HANDLE_PATTERN`,
`AUTOMATION_STUDIO_RUNTIME_TARGET_HANDLE_MAX_LENGTH` and
`AUTOMATION_STUDIO_RUNTIME_TARGET_MAX_HANDLES` arrived `undefined`. Observed:

```
FAIL llm/tests/opaque-target-override.test.ts
     > keeps every browser noun out of the prompt and the response schema
  -     "maxLength": 64,
  -     "pattern": "^[A-Za-z0-9](?:[A-Za-z0-9_.:-]*[A-Za-z0-9])?$",
  -     "maxProperties": 16,
  -     "propertyNames": { "maxLength": 64, "pattern": ... },
  +     "propertyNames": {},
```

That is a safety regression, not a cosmetic one: the outbound schema stops
telling the model that a handle is a bounded name, and stops constraining it to
the handle vocabulary. It type-checks, and only that one existing test caught it.

The fix is to not make the import: the intervention no longer summarizes the
recovery context, and the comment in that file says why. Nothing is lost -
`service.ts:3176` already writes the counts-only summary onto the run's
`llmGate`, so it existed once already and now still does. The test in
`recovery-context-packet.test.ts` pins the absence with the reason, so the hunk
does not get re-applied by somebody reading the older report.

**Two things for whoever owns the boundary next.** The type-only imports
`llm/harness/{context-packet,task-request}.ts` now make of `recovery/index.ts`
are erased and are safe, but they are still the harness depending on a feature
module's type. And `runtime/recovery` importing the evidence loop out of
`runtime/llm` means this cycle is now one careless value import away in either
direction, with a failure mode that is silent, schema-shaped, and type-clean.

---

## The diffs I could not apply

### 1. `AS/runtime/service.ts` - the two lines that make item 1 live (net 0 lines)

`recoveryContext` is already built at `service.ts:3025`. Both harness calls need
it. **Neither line is added: the property rides on an existing line**, so the
file stays at 6757 against its 6757 baseline.

Line 3035 (six leading spaces), the `runtime_diagnosis` call:

```ts
      ...(failureEvidence ? { failureEvidence } : {}), ...(this.llmEvidenceRuntime?.deniedEvidenceKeys ? { deniedEvidenceKeys: this.llmEvidenceRuntime.deniedEvidenceKeys } : {}), recoveryContext,
```

Line 3063 (eight leading spaces), the `runtime_patch` call:

```ts
        ...(failureEvidence ? { failureEvidence } : {}), ...(this.llmEvidenceRuntime?.deniedEvidenceKeys ? { deniedEvidenceKeys: this.llmEvidenceRuntime.deniedEvidenceKeys } : {}), recoveryContext,
```

That is the whole of it. Until it lands, Phase 2.1 is still inert in the shipped
app: the context is built, budgeted, summarized and persisted, and the model is
still told almost nothing about what went wrong.

### 2. `AS/runtime/recovery/structured-diagnosis.ts` - the reader, one line

`:131`:

```ts
  const reported = isRecord(response.metadata) ? response.metadata : {};
  // becomes
  const reported = isRecord(response.diagnosis) ? response.diagnosis : {};
```

The doc comment at `:75` ("empty until Core stops stripping response metadata")
should go with it, and `AUTOMATION_STUDIO_STRUCTURED_DIAGNOSIS_TEXT_MAX_LENGTH`
at `:52` should become an import of Core's
`AUTOMATION_STUDIO_LLM_DIAGNOSIS_TEXT_MAX_LENGTH` rather than a second copy of
`500`.

**The pin in `tests/service-adaptation/tests/recovery-trace.test.ts:154` will
not fail when this lands, contrary to what `w2-2-diagnosis-plan.md` predicted.**
Its stub returns `metadata: { observed: ..., patchNeeded: false }`, and
`metadata` is still stripped, so `modelFields` stays `[]` and the test stays
green either way. To make it mean what it was written to mean, the fixture must
send `diagnosis: { observed: "PRIVATE_OBSERVED_TEXT", patchNeeded: false }` and
assert `modelFields: ["observed", "patchNeeded"]` with `patchNeeded: false`. The
two prose-leak assertions still hold after that, because the summary omits
`expected`/`observed`/`changed` by construction.

### 3. `deniedEvidenceKeys` required - one character, plus seven fixture lines

`llm/harness-options/binding.ts:50`, delete the `?`:

```ts
  deniedEvidenceKeys: readonly string[];
```

and update the doc comment above it, which currently explains why it is
optional. Then, in `AS/runtime/tests/`, one property per literal:

```ts
// service-adaptation/tests/llm-diagnosis.test.ts:109, 208, 239
//   - the web domain's real declaration, matching the one already at :182,
//     so these assert the production contract rather than a Core default
deniedEvidenceKeys: ["html", "innerHtml", "outerHtml", "pageSource", "cookies", "headers", "selector"],

// service-bootstrap/tests/generation.test.ts:168, 204, 237
// service-bootstrap/tests/rejections.test.ts:79
//   - bootstrap fixtures that capture no failure evidence; `[]` is the honest
//     claim, and is visible to a reviewer where an absent field is not
deniedEvidenceKeys: [],
```

None of those four files has a line-count baseline and all are between 255 and
305 lines against the 400-line advisory, so these can be added as new lines.

Then the fail-closed default, in `harness/context-packet.ts:81`, replacing
`input.deniedEvidenceKeys ?? []`: throw when `input.failureEvidence` or
`input.reusableContext` is present and no declaration arrived. Apply it in the
same edit as the seven fixtures, not before.

**One contradiction in the brief, for the record.** It said the three files
holding these call sites "are free now", and also said not to edit
`AS/runtime/tests/**`. The call sites are in `AS/runtime/tests/**`. I took the
explicit prohibition as binding over the belief about availability.

---

## Commands run and observed results

Core, from `F:\!FluxIQ`:

```
npx tsc --noEmit -p packages/fluxiq
  -> TSC_EXIT=0, no output.
     (an intermediate run read 1 error in recovery/tests/exploration-budget.test.ts:50,
      the Phase 2.3 worker's untracked file, which they fixed while I ran; no error
      was ever reported against a file I own)

npx vitest run src/programs/automation-studio/runtime/llm --root packages/fluxiq --no-file-parallelism
  -> Test Files  14 passed (14)
     Tests      134 passed (134)
     (baseline before this work: 12 files / 127 tests)

npx vitest run src/programs/automation-studio/runtime --root packages/fluxiq --no-file-parallelism
  -> Test Files  95 passed (95)
     Tests      871 passed (871)
     Duration   254.89s
     (an earlier run of the same suite read 92/796 before the Phase 2.3 worker's
      recovery files landed; the 95/871 run includes them)

node scripts/structure-audit.mjs
  -> structure-audit: passed (140 warning(s), 254 baselined).
     AUDIT_EXIT=0

wc -l .../runtime/service.ts  -> 6757  (baseline 6757, untouched)
```

Downstream, from `F:\!FluxIQWebExtension`:

```
domain> npm run check                 -> CHECK_EXIT=0, no output
node domain/scripts/test-domain.mjs   -> # tests 495  # pass 495  # fail 0
                                         TEST_EXIT=0
node scripts/structure-audit.mjs      -> structure-audit: passed (57 warning(s), 17 baselined).
                                         AUDIT_EXIT=0
```

Both downstream commands were run twice: once before another worker's
`domain/src/runtime/llm-evidence/` refactor landed in the tree, and once after.
`check` and the suite were green both times.

The audit was run three times and was **red in the middle one**, which is worth
recording because it was red for something none of mine:

```
FAIL [file-lines] packages/test-runner/src/run-scenario.ts: 853 lines exceeds the 800-line limit.
structure-audit: 1 violation(s) across 1 rule(s).   AUDIT_EXIT=1
```

Another worker had grown that file past the limit and brought it back to exactly
800 within minutes. The final run, after my report file was written, reads
`structure-audit: passed (57 warning(s), 17 baselined).` with `AUDIT_EXIT=0`. I
did not touch that file. It is sitting on the limit, not under it.

One new advisory warning in Core is mine:
`harness/structured-response.ts: 9 exported values is past the 8-value advisory
threshold`, from `AUTOMATION_STUDIO_LLM_DIAGNOSIS_TEXT_MAX_LENGTH`. The
alternatives were a second copy of `500` in the provider, or an import that
bypasses the harness barrel - a ratcheted finding the baseline may not be raised
for. The audit passes; no baseline moved.

### Failures I hit, and what each was

1. **Two in `stages/tests/registry.test.ts`**, both expected and both mine: the
   replacement test's instruction-id list, and the unstaged test asserting the
   gather stage body where it meant the exploration policy. Updated, then green.
2. **`llm/tests/opaque-target-override.test.ts`** - the module cycle, above.
   Real, caused by my own edit combining with another worker's, fixed by not
   making the import. It passed before that worker's file landed and passes now.
3. **65 files of churn under `domain/.test-build/`** - I ran the domain suite
   from inside `domain/`, which writes `// src/...` path comments where the
   committed artifact has `// domain/src/...`. Re-running
   `node domain/scripts/test-domain.mjs` from the repository root regenerated
   them identically to HEAD. The downstream tree carries nothing of mine.

---

## Not verified

- **No live provider and no live browser.** Every provider here is a stub or a
  stubbed `fetch`. Whether a real DeepSeek model actually fills the `diagnosis`
  object when asked is unproven; the schema permits it and the prompt asks for
  it, and that is all that was testable offline.
- **The model does not receive the recovery context yet**, and will not until the
  two `service.ts` lines land. Nothing should read "item 1 done" as "the model
  now gets the context".
- **`modelFields` is still empty in the shipped app.** The channel is open at the
  boundary; the reader still reads `metadata`. Item 2 is half a change until the
  `recovery/structured-diagnosis.ts` line lands, and the two must ship together
  or the phase reads as complete while nothing reaches the runtime.
- **The `toolsOffered` condition only ever fires for `evidence_tool_decision`.**
  If a future caller carries tools under another task kind, it will get the
  gather text without the tool policy. The condition is narrow on purpose, but it
  is a condition, not a property of the request.
- **`AUTOMATION_STUDIO_LLM_DIAGNOSIS_TEXT_MAX_LENGTH` and
  `AUTOMATION_STUDIO_STRUCTURED_DIAGNOSIS_TEXT_MAX_LENGTH` are both 500 and can
  drift.** Nothing asserts they agree.
- **The downstream check and suite ran against Core's previously built `dist/`,
  not against my `src/`.** Core's `dist/` was not rebuilt. Everything I added to
  Core's surface is an optional field or a new export, so nothing the domain
  imports changed shape, but the domain has not been compiled against the new
  Core sources.
- **`pnpm check`, `pnpm test` and `pnpm build` were not run whole** in either
  repository. Two other workers have uncommitted edits in `AS/runtime/recovery/`,
  `packages/test-runner/` and `domain/src/runtime/llm-evidence/`, so a
  whole-repository gate would report their state, not mine.
- **`apps/web` was not type-checked** with any of these changes. Nothing in
  `apps/*/src` references `llmEvidenceRuntime` or the harness input, so the
  eight call sites counted for item 4 are the whole set inside
  `packages/fluxiq`; that grep is the evidence, not a compile.

## Open questions and contradictions found

1. **The brief forbade `AS/runtime/tests/**` and also said the files holding
   item 4's call sites are free.** They are the same files. Resolved in favour of
   the prohibition; item 4 is a diff, not a change.
2. **`runtime/recovery` and `runtime/llm` now import each other's values.** The
   cycle above is closed for today by one import I chose not to make, not by
   anything structural. `scripts/structure-audit/config.mjs` has an empty
   `importBoundaries`, and this is exactly the kind of edge it exists for. A rule
   forbidding `runtime/llm/**` from importing `runtime/recovery/**` would make
   the failure mechanical instead of waiting for one schema test to notice.
3. **`recovery/structured-diagnosis.ts` will read a field the harness defines,
   with its own copy of the harness's bound.** When the reader switches to
   `response.diagnosis`, it should import
   `AUTOMATION_STUDIO_LLM_DIAGNOSIS_TEXT_MAX_LENGTH` rather than keep `500`.
4. **A domain cannot replace Core's tool policy, by design, and nobody has asked
   to.** If a domain's evidence loop genuinely works differently, the only route
   today is replacing `gather` - which does not remove the tool policy. That is
   the right default; it is worth knowing it is a closed door rather than an
   oversight.
5. **`w2-2-diagnosis-plan.md`'s prediction that the `recovery-trace.test.ts` pin
   would fail is wrong**, and the next reader of that report will be misled. The
   correction is in *The diffs I could not apply*, item 2.
6. **`packages/test-runner/src/run-scenario.ts` is at exactly 800 lines**, its
   hard limit, having briefly been at 853 and failed the downstream audit while I
   was running. Not mine, and green now, but the next line added to that file
   fails the gate.
