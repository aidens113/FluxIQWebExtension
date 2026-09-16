# `w2-diagnosis-channel`: the structured diagnosis reads the named channel

Path prefix: `AS/` is Core's `packages/fluxiq/src/programs/automation-studio/`.
All work is in Core, `F:\!FluxIQ`. Nothing downstream changed except this report.

## Outcome

**Partial.** The reader is moved, the old route is dead and refused out loud,
and my own suite is green at 13/13. The partial part is not a loose end in my
file: **two neighbouring test files are now red (8 tests), both on the brief's
"must not touch" list**, and both need the same two-line fixture change. I
verified that change makes all 8 pass, without editing either file. The exact
text is below under `Owed elsewhere`, and it must land in the same work unit.

| Brief item | State |
| --- | --- |
| Establish the channel before changing anything | **Done.** It is `response.diagnosis`, not a name I invented; evidence below |
| Read the structured diagnosis from it | **Done.** One line, plus the comment that was describing a closed channel |
| A metadata-only diagnosis is not silently accepted | **Done.** Not accepted *and* not silent: the misrouted field names are recorded as a refusal |
| A test proves it | **Done.** Four new tests; `structured-diagnosis.test.ts` is 13/13 |
| Core `pnpm check` passes | **No.** It cannot pass in the shared tree right now, for reasons that are not mine. Observed output below |
| Automation Studio runtime tests pass | **No.** 8 failures I caused in two files I may not edit, 1 failure I did not cause |

## What the channel actually is

I did not invent a name. Phase 2.2's report listed the channel as owed work
(`w2-2-diagnosis-plan.md`, "Owed elsewhere" item 3); another worker has since
landed all four edits it specified. The channel exists end to end today:

- **The type.** `AutomationStudioLlmDiagnosisFields` —
  `AS/runtime/llm/harness/structured-response.ts:27-40`. Seven keys: `expected`,
  `observed`, `changed` (strings), `stillAchievable`,
  `deterministicRecoveryPossible` (`yes`/`no`/`unknown`), `explorationNeeded`,
  `patchNeeded` (booleans). It is a field of the `diagnosis` variant of
  `AutomationStudioLlmStructuredResponse`, at `structured-response.ts:9`.
- **The check.** `validateUnknownDiagnosisFields` —
  `AS/runtime/llm/harness/provider-result.ts:103-134`. Every key by name,
  unknown keys refused, each description bounded to
  `AUTOMATION_STUDIO_LLM_DIAGNOSIS_TEXT_MAX_LENGTH` (500, the same number my
  reader holds), each verdict to its three words.
- **The strip, which now carries it.** `stripAutomationStudioLlmResponseMetadata`
  — `structured-response.ts:144-150`. `diagnosis` is carried *because* every key
  in it was checked by name; `metadata` is still removed from every response
  because nothing checked it.
- **The ask.** `DIAGNOSIS_FIELDS_SCHEMA` with `additionalProperties: false` —
  `AS/runtime/llm/deepseek-provider.ts:58-70`, wired into
  `DIAGNOSIS_OUTPUT_SCHEMA:79`, and the prompt instruction at `:44` tells the
  model the summary is prose nothing acts on and these fields are what the
  recovery is decided from.
- **Its own tests.** `AS/runtime/llm/tests/diagnosis-channel.test.ts` holds the
  producing half: the fields arrive through the harness, `metadata` does not,
  and a smuggled key is refused.

So the sentence my file's header still carried — that the model cannot supply a
field today — was true when it was written and is false now.

## What changed and why

Two files, both mine.

### `AS/runtime/recovery/structured-diagnosis.ts`

**The read.** One line, at what was `:131`:

```ts
const reported = isRecord(response.metadata) ? response.metadata : {};
// becomes
const reported: AutomationStudioLlmDiagnosisFields = response.diagnosis ?? {};
```

`AutomationStudioLlmDiagnosisFields` is a **type-only** import, added to the
existing `import type { … } from "../llm/index.ts"` line. No new value import
from `llm/` — the brief's cycle warning is respected, and nothing in this file
reads an `llm` constant at module scope.

**The old route, refused rather than ignored.** A new
`refuseDiagnosisFieldsSentAsMetadata` runs before any field is read and records
one refusal naming every recognized field found in `response.metadata`:

```
metadata: observed, patchNeeded arrived in response.metadata, which is not the
diagnosis channel and is checked by nothing, so they were not read.
```

Three things about it are deliberate.

- **It refuses, it does not ignore.** The brief asked that a metadata-only
  diagnosis not be *silently* accepted. Dropping it silently satisfies half of
  that: on the run record, a field that was discarded and a field the model
  never sent look identical. The refusal is the difference, and `refusals`
  already rides onto the run through
  `summarizeAutomationStudioRuntimeStructuredDiagnosis`.
- **It records names, never values.** Field names are Core's own vocabulary. A
  value is the model's reading of a page this record deliberately does not
  store, which is `context-summary.ts`'s rule. A test asserts a private string
  placed in `metadata` appears nowhere in the built diagnosis.
- **It fires even when the channel is also present.** So the precedence can
  never be read as "whichever route arrived": the channel is the answer and the
  metadata is refused, both at once.

Why this is worth a refusal at all rather than a quiet deletion: `patchNeeded`
is the one field that can stop the second, billed `runtime_patch` call. The old
route was therefore a way to change what Core spends money on, with a value
nothing at the boundary had checked.

**The comment.** The header's "Known limitation" paragraph described a channel
that was closed and a diff that was owed. It is replaced by a statement of what
the channel is, why `metadata` is not it, and what the refusal is for. The
`source` field's doc no longer says `modelFields` "is empty until Core stops
stripping response metadata".

The reader still re-checks every shape (`boundedText`, `reportedAchievability`,
`reportedBoolean`) although the boundary now checks the same things. That is on
purpose and the test comment says so: this module is also reachable from a
host-supplied `AutomationStudioLlmTaskResult` that never went through
`parseAutomationStudioLlmProviderResult`.

### `AS/runtime/recovery/tests/structured-diagnosis.test.ts`

The `diagnosisResult` fixture now builds `response.diagnosis`; a second fixture,
`metadataOnlyDiagnosisResult`, builds the old route. Four tests added:

1. a metadata-only diagnosis changes no verdict — `modelFields` empty,
   `expected`/`observed` absent, verdicts deterministic, and **`patchNeeded`
   still `true`** although the metadata said `false`;
2. the refusal names the misrouted fields and contains none of their values;
3. a `metadata` with no diagnosis-shaped key (`provider`, `latencyMs`) produces
   no refusal, so ordinary provider metadata is not noise;
4. a response carrying both routes reads the channel and refuses the metadata.

9 tests became 13.

## Commands run and observed results

All from `F:\!FluxIQ`.

```
npx vitest run src/programs/automation-studio/runtime/recovery/tests/structured-diagnosis.test.ts --root packages/fluxiq --no-file-parallelism
  -> Test Files  1 passed (1)
     Tests      13 passed (13)

npx vitest run src/programs/automation-studio/runtime/tests/service-adaptation/tests/recovery-trace.test.ts --root packages/fluxiq --no-file-parallelism
  -> Test Files  1 passed (1)
     Tests       4 passed (4)      (the service-level pin still passes; see below)

npx vitest run src/programs/automation-studio/runtime/recovery --root packages/fluxiq --no-file-parallelism
  -> Test Files  2 failed | 9 passed (11)
     Tests       8 failed | 156 passed (164)
     all 8 in recovery/tests/plan.test.ts and recovery/tests/stages.test.ts

node scripts/structure-audit.mjs
  -> structure-audit: passed (140 warning(s), 254 baselined).  AUDIT_EXIT=0
     Neither of my files is warned about. structured-diagnosis.ts is 266 lines,
     its test 248, both under the 400-line advisory threshold. The 140th warning
     is recovery/context.ts at 447 lines, which I did not touch.

npx tsc --noEmit -p packages/fluxiq
  -> TSC_EXIT=2, and not because of me. Three errors, all in other workers'
     in-flight edits, none naming either of my files:
       recovery/annotation/patches.ts(23,8): '"../../live-patch.ts"' has no
         exported member named 'AutomationStudioRuntimeTargetOverrideTarget'
       recovery/tests/runtime-exploration.test.ts(235,5): Property
         'deniedEvidenceKeys' is missing ... AutomationStudioLlmEvidenceRuntimeBinding
       service.ts(2881,66): ... 'AutomationStudioRuntimeRecoveryAnnotationInput'
         with 'exactOptionalPropertyTypes: true' ... 'graphOptions' ...
```

`pnpm check` was therefore not run whole: its type-check step cannot pass in the
shared tree at the moment, and running it would have reported another worker's
half-landed work as this brief's result.

### Attribution, measured rather than assumed

An earlier full-runtime run showed 13 failures, 5 of them in files I never
touched. Rather than assert they were someone else's, I measured it: I copied my
two files to the scratchpad, `git checkout --`'d them, re-ran the five suspect
files, and restored from the backup.

```
with my change reverted   -> 1 failed | 68 passed (69)
with my change applied    -> 9 failed | 73 passed (82, +structured-diagnosis.test.ts)
```

So exactly **8** failures are mine, all in `plan.test.ts` and `stages.test.ts`.
The one that fails either way is
`service-bootstrap/tests/generation.test.ts > packs opted-in reusable context
only after a fresh creation inspection and records safe provenance`, which is
not mine. The other four failures I saw in the first run had been fixed by
another worker in between — **the tree moved twice while I was working in it**,
which is itself worth the supervisor knowing.

### The fix for the 8, verified without editing the files

Both files hold an identical fixture helper that builds the old route. I
verified the repair by copying each file to a uniquely named probe beside it,
applying the change to the copy, running the copies, and deleting them (the
directory listing afterwards confirms only the eleven original test files
remain):

```
npx vitest run .../w2dc-probe-plan.test.ts .../w2dc-probe-stages.test.ts
  -> Test Files  2 passed (2)
     Tests      29 passed (29)
```

## Owed elsewhere

### 1. The fixture change, in two files I may not touch (blocking)

`AS/runtime/recovery/tests/plan.test.ts:144,148` and
`AS/runtime/recovery/tests/stages.test.ts:191,195` — identical in both, two
lines each, nothing else in either file changes:

```ts
/** Only `ok` and `response` are read; the rest of the result is not consulted. */
function diagnosisResult(metadata: Record<string, unknown> = {}): AutomationStudioLlmTaskResult {
  return {
    ok: true,
    diagnostics: [],
    response: { kind: "diagnosis", summary: "The action could not find its control.", metadata }
  } as unknown as AutomationStudioLlmTaskResult;
}
```

becomes

```ts
/** Only `ok` and `response` are read; the rest of the result is not consulted. */
function diagnosisResult(diagnosis: Record<string, unknown> = {}): AutomationStudioLlmTaskResult {
  return {
    ok: true,
    diagnostics: [],
    response: { kind: "diagnosis", summary: "The action could not find its control.", diagnosis }
  } as unknown as AutomationStudioLlmTaskResult;
}
```

Both strings are unique within their file, so a scripted replacement of
`function diagnosisResult(metadata: Record<string, unknown> = {})` and of
`summary: "The action could not find its control.", metadata }` across those two
files is safe; that is exactly what the probe above did.

No assertion in either file needs touching, including `stages.test.ts:125`'s
`{ modelFieldCount: 2, refusalCount: 0 }` — with the fixture on the channel
there is no `metadata`, so there is no refusal to count. That is observed, not
predicted: it is inside the 29 that passed.

### 2. A test whose name is now wrong, though it still passes

`AS/runtime/tests/service-adaptation/tests/recovery-trace.test.ts:153-178` is
titled *"records the deterministic verdicts, and no model prose, because Core
strips response metadata"*, and its comment calls itself "the pin on the closed
channel ... when the `AS/runtime/llm/**` diff in this phase's report lands, this
fails and is updated deliberately".

**It did not fail, and it should not have.** It sends its fields through
`response.metadata`, the parser strips them before my reader sees them, and the
deterministic verdicts stand — which is now a test of the *refused* route rather
than of a closed channel. It is worth keeping and worth renaming to something
like *"ignores a diagnosis a model sent through metadata instead of the
channel"*, with the comment about the owed diff removed. The file is not mine.

### 3. There is no end-to-end test of the channel through the service

The producing half is covered (`llm/tests/diagnosis-channel.test.ts`), and the
reading half is covered (mine). Nothing runs a service session whose stub
provider answers with `diagnosis: { … }` and asserts that
`metadata.llmGate.structuredDiagnosis` comes back with `modelFields` populated
and `patchNeeded` honoured. The two halves meet at
`AutomationStudioLlmStructuredResponse`, so a type error would be caught, but a
wiring mistake between the harness result and
`buildAutomationStudioRuntimeStructuredDiagnosis` would not. That test belongs
beside the pin in item 2, in a file I do not own.

## Not verified

- **No live provider and no live browser.** Every provider in every run above is
  a stub. Whether DeepSeek actually fills the `diagnosis` object when asked —
  and how well — is untested by anything I ran.
- **`pnpm check`, `pnpm test` and `pnpm build` were not run whole**, in Core or
  downstream. The package type check fails on other workers' in-flight edits, as
  quoted above. The structure audit and the owned suites were run directly.
- **The full Automation Studio runtime suite was last seen at 13 failures**, of
  which I have accounted for 8 as mine and 1 as pre-existing. The other 4 were
  fixed by another worker mid-session; I did not re-run the whole suite
  afterwards, because the tree kept moving and a whole-suite number would not
  have attributed cleanly to anyone.
- **`apps/web` was not built, type-checked or tested.** Nothing I changed alters
  a type it reads — `modelFields` and `refusals` were already on the summary —
  but the web run-detail model was not exercised.
- **Downstream (`F:\!FluxIQWebExtension`) was not run at all.** Nothing there
  changed and nothing there imports this module.
- **Core's `dist/` was not rebuilt.**

## Open questions and contradictions found

1. **The brief's definition of done cannot be met inside the brief's file
   boundary.** "The Automation Studio runtime tests pass" and "must not touch any
   other file under `AS/runtime/recovery/`" are in conflict: moving the reader to
   the channel necessarily breaks two fixtures that build the old route, because
   those fixtures existing is exactly the thing being removed. I obeyed the
   boundary and verified the repair out of tree. This is the supervisor's call to
   apply, and it is the only thing standing between this tree and green.
2. **`source: "model"` still means "a diagnosis call succeeded", not "the model
   contributed".** A response that carries no `diagnosis` object at all still
   sets `source: "model"` with `modelFields: []`. That was true before this
   change and I left it, because `modelFields` is the honest signal and two
   fields saying the same thing would be one too many. If a reader anywhere
   treats `source === "model"` as "the model had an opinion", it is wrong, and it
   was wrong before today.
3. **The reader's bound and the boundary's bound are two copies of 500.**
   `AUTOMATION_STUDIO_STRUCTURED_DIAGNOSIS_TEXT_MAX_LENGTH` (mine) and
   `AUTOMATION_STUDIO_LLM_DIAGNOSIS_TEXT_MAX_LENGTH` (the harness's) are
   independent constants with the same value, and the producing side's comment
   says the duplication is deliberate — the boundary refuses, the reader records.
   I agree with the reasoning and note the hazard: nothing fails if the two drift
   apart, and the symptom would be a silent behaviour change (a refusal recorded
   on the run instead of at the boundary, or the reverse). A test asserting they
   are equal would cost one line and close it.
4. **`explorationNeeded` from a model now reaches a stage that still does
   nothing.** Phase 2.2 recorded exploration as always `skipped`. With the
   channel open, a model can set `explorationNeeded: true` for the first time,
   and `plan.ts` and `stages.ts` already read it. Whether 2.3's exploration work
   expects that flag to arrive from a model — rather than only from Core — is
   worth confirming with whoever owns it, because today it can.
