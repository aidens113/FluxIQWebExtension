# `w2-1-recovery-context`: the `recoveryContext` builder, its counts-only summary, and the opaque failed target

## Outcome

**Partial.** Everything in the brief is built, tested and passing except one
thing, and the exception is the file boundary the brief itself drew: the
`recoveryContext` **packet slot** lives in `AS/runtime/llm/harness/`, which I was
told not to edit. The context is built, bounded, prioritized, budgeted, and its
counts-only summary is recorded on every runtime recovery run — but the object
itself does not yet reach the model, because there is no slot to put it in. The
exact three-hunk diff that adds the slot is below, written against the files as
they stand **right now**, mid-edit by the Phase S worker.

Also done, from the coordinator's mid-task message: the barrel-import violation
in `adaptation-promotion.ts`, the Phase H `service.ts` diff (net −4 lines), and
the downstream `domainId` the H diff requires.

`service.ts` is **6757 lines** against its frozen 6758 baseline. The baseline was
not raised and not lowered.

## What changed and why

### Core — new, `AS/runtime/recovery/recovery-context.ts` (+ its summary)

`buildAutomationStudioRuntimeRecoveryContext` builds one bounded, domain-neutral
description of a runtime failure from the persisted run record, the failed trace
attempt, the subflow, and the Flow's known adaptations. Eleven sections in a
fixed priority order, which is also the drop order read backwards:

`failure`, `expected_transition`, `actual_transition`, `state_diff`,
`failed_target`, `recovery_candidates`, `subflow`, `route_context`,
`known_adaptations`, `recent_nodes`, `recording_context`.

Four decisions, each with a test behind it.

**Shapes and names, never values.** Output *ids* and effect *types*, never
`transitionComparison.actual.outputs` and never `attempt.inputs`. The persisted
run record is preferred over the live trace wherever it carries the same fact,
because the persisted copy has already been through `trace-withholding.ts`. The
one exception is `expectedState`, which is authored Flow-document data — the user
wrote it, and without it "expected state" is simply not in the context. The
attempt's `message` is not carried either: the failure record's `expected` and
`actual` are contractually short and free of page content, and the prose is not.

**`candidateId` is not carried** on the failed-target section. It is minted by
whichever domain supplied the candidates, so Core cannot promise it is not a
locator, and Phase T's whole point is that no such string reaches the model.

**Known adaptations are identity and verdict only** — id, status, risk, author,
trigger, validation counts. Never the `patch` (it carries repair targets) and
never `observedState`/`expectedState` (whatever the domain put in them). The
model is told what has been tried and how it went, not handed the old repair to
copy.

**Three omission reasons, not one flag.** This is the part of the brief that
mattered more than completeness, and building it turned up a fourth case the
plan had not named. Every section appears in exactly one of `included` or
`omitted`, always, and an omission says which of:

| reason | means |
| --- | --- |
| `absent` | the run never produced it — no state diff was captured, the failure was not in a subflow, no adaptation matched |
| `byte_budget` | it existed, was built, and was dropped to fit, with `byteCount` saying what it cost |
| `withheld` | it existed and did not pass the bound a domain-supplied value is held to, so Core refused to carry it |

`withheld` is the one the scoping report did not anticipate. Without it, a state
diff that arrived carrying a `selector` key would have been recorded as `absent`
— a refusal reading as an absence, which is the same defect in a new place.
`included.length + omitted.length === 11` is an invariant a test holds.

The trim re-measures the **whole** object each pass, including the `omitted`
entries it is writing, so the budget covers the record of what was withheld
rather than being overrun by it. The bookkeeping is never what gets dropped;
when nothing is left to drop, `byteCount` reports the truth instead of a fiction.
The budget is clamped to `[1_500, 16_000]`, default `4_000` — roughly 1,300
tokens, sitting beside the 3,000-byte failure packet under the same per-call
input allowance.

`AS/runtime/recovery/recovery-context-summary.ts` derives the counts-only
`contextSummary`: schema versions, byte count, byte budget, included section
names with their byte counts, and the full omission list with reasons. Section
*names*, byte counts and reasons — never a section's contents. A test serializes
the summary and asserts that no fragment of any section's content appears in it.

**Recent browser events are deliberately not built.** Decision L11 makes them
conditional on the dry-run diagnoses showing the state diff is not enough, and
that evidence does not exist. The module header says so.

### Core — `AS/runtime/service.ts` (the coordinator)

- Builds the recovery context once per runtime recovery, from what
  `maybeAnnotateRunDetailWithRuntimeLlm` already holds.
- Records `summarizeAutomationStudioRuntimeRecoveryContext(...)` on the run
  detail's `llmGate` metadata, beside the existing `failureEvidence` provenance.
  This is the durable, counts-only record of what the context held and what it
  withheld, and it is readable by the Lab without the Lab ever holding page data.
- **Passes `subflowId` into both harness calls.** This was a real gap the MVP
  capture table flagged as "No: the runtime call does not pass it", and the slot
  has existed in the packet all along, so it needed no `llm/` edit. Asserted in
  `service.test.ts`.

Net **+4 lines** on `service.ts`, absorbed by the −4 the Phase H diff bought.

### Downstream — the failed target as an opaque handle

The web domain now marks, in the failure packet, which of its opaque handles the
failed action was aiming at. That is the one page fact Core cannot supply: Core's
failed-action identity is an attempt, a node and a definition id, and carries
nothing about the control. Without a mark the model is shown up to forty elements
and left to guess which one it was asked to repair.

`domain/src/runtime/llm-evidence/sanitize.ts` gains one option and three packet
fields, and exactly one of the three is present on a failure packet (and none on
any other kind):

- `failedTarget: "target.N"` — the handle of the element the action addressed;
- `failedTargetMissing: true` — the control is not among the elements described
  (it left the page, or, read together with `budgetTruncated`, the trim cut it);
- `failedTargetUnknown: true` — the producer did not say which control the action
  addressed, so the packet marks none.

The marking happens **before** the trim, so its bytes are inside the budget, and
`popElement` flips `failedTarget` to `failedTargetMissing` if it pops the element
the handle named — a handle that pointed at nothing would be worse than no
handle.

`domain/src/runtime/adapter.ts` is where the real failure packet is built, and it
is the site that had the Phase T leak. `failureDiagnostics` was writing
`selector: "#pay"` into the runtime command's metadata, which Core persists onto
the attempt. It now writes `failedTarget` / `failedTargetMissing` — the handle,
never the selector — and grep found no production consumer of the old field
(only the domain's own test, updated). `tools.ts`'s Core-path recapture passes
`failedAction: {}`, so it says `failedTargetUnknown` rather than leaving the model
to read silence as "the target is still there".

### The three items from the coordinator's mid-task message

1. **`adaptation-promotion.ts`** imported `../service/json-values.ts` directly.
   `service/index.ts` already re-exported it, so the fix folded both imports into
   the barrel: `import { adaptationRequiresChangeProposal, isJsonRecord } from "../service/index.ts";`.
   The audit no longer reports it.
2. **Phase H's `service.ts` diff applied as written**, all five hunks: the named
   `AutomationStudioLlmEvidenceRuntimeBinding`, the `automationStudioHarnessOptionRegistry(...)
   .evidenceLoopBinding(...)` line, and the two call sites. `service.ts` went
   6757 → 6753. Eight Core test fixtures then needed `domainId`; they were given
   it **on existing lines**, because `service.test.ts` (4787) and
   `service-flow-bootstrap-generation.test.ts` (1004) are both exactly at their
   own frozen line baselines and a naive two-line addition failed the audit.
3. **`domainId` downstream.** The report's line numbers (`tools.ts:212-217`)
   pointed at the snapshot-capture metadata, not the binding. The field belongs on
   the runtime object: `WebAutomationLlmEvidenceRuntime` gained `domainId: string`
   and `createWebAutomationLlmEvidenceRuntime` returns
   `domainId: WEB_AUTOMATION_DOMAIN_ID`.

## The diff `AS/runtime/llm/harness/` still needs — for the supervisor to apply

Three hunks, written against those files **as they stand in the working tree
now**, which the Phase S worker is actively changing. Re-read before applying.
Nothing here was compiled, because applying it would have collided with that
worker.

**1. `context-packet.ts`** — add the slot to `AutomationStudioLlmContextPacket`,
after `failureEvidence?: JsonObject;` (currently line 37):

```ts
  /** The standardized recovery context. Runtime tasks only, like `failureEvidence`. */
  recoveryContext?: AutomationStudioRuntimeRecoveryContext;
```

with the import:

```ts
import type { AutomationStudioRuntimeRecoveryContext } from "../../recovery/index.ts";
```

and, inside `packAutomationStudioLlmContext`'s returned object, beside the
`failureEvidence` spread:

```ts
    ...(input.recoveryContext && (input.taskKind === "runtime_diagnosis" || input.taskKind === "runtime_patch") ? { recoveryContext: input.recoveryContext } : {}),
```

The task-kind guard is the point: a `flow_bootstrap` packet must not carry it,
and the mutation target for a test is to remove that condition.

**2. `task-request.ts`** — add to `AutomationStudioLlmHarnessInput`, beside
`failureEvidence?: JsonObject;`:

```ts
  recoveryContext?: AutomationStudioRuntimeRecoveryContext;
```

**3. `intervention.ts`** — inside `contextSummary`, beside the `failureEvidence`
provenance spread:

```ts
      ...(request.context.recoveryContext ? { recoveryContext: summarizeAutomationStudioRuntimeRecoveryContext(request.context.recoveryContext) } : {}),
```

with `import { summarizeAutomationStudioRuntimeRecoveryContext } from "../../recovery/index.ts";`.
The summarizer already exists and is tested; this is a call, not new logic.

**Then, in `service.ts` (mine), one property on each of the two harness calls:**

```ts
      recoveryContext,
```

That is **+2 lines** on a file with 1 line of headroom, so whoever applies it
buys the line back first. The cheapest place is the five-line `explicitCallLimit`
ternary at ~2944-2948, which folds to one line and returns four.

## Commands run and observed results

Core (`F:\!FluxIQ`):

- `npx tsc --noEmit` in `packages/fluxiq` — **clean, no output.** Run four times:
  after the H diff, after the recovery modules, after the coordinator wiring, and
  again after the Phase S worker's `llm/harness/` edits landed in the tree.
- `npx vitest run src/programs/automation-studio/runtime/recovery/tests/recovery-context.test.ts`
  — `Test Files 1 passed (1) / Tests 18 passed (18)`.
- `npx vitest run src/programs/automation-studio/runtime/recovery src/programs/automation-studio/runtime/tests/service.test.ts`
  — the three recovery files all green (`diagnosis-chain` 3, `llm-invocation` 6,
  `recovery-context` 18); `service.test.ts` 108 tests, 1 failed — see below.
- `npx vitest run src/programs/automation-studio/runtime` (whole runtime suite) —
  `Test Files 4 failed | 55 passed (59) / Tests 6 failed | 711 passed (717)`,
  213 s.
- `node scripts/structure-audit.mjs` — `structure-audit: passed (137 warning(s),
  256 baselined).` The `[imports]` FAIL on `adaptation-promotion.ts` is gone. It
  also says `1 baseline entries can be lowered` — that is `service.ts` at 6757
  against 6758, deliberately left, because lowering it removes the one line of
  headroom the packet-slot diff above needs.
- `wc -l .../runtime/service.ts` — **6757** (6757 at start → 6753 after the H
  diff → 6757 after my four lines).

Downstream (`F:\!FluxIQWebExtension`):

- `npx tsc -p tsconfig.json --noEmit` in `domain` — **clean.**
- `npx tsc -p tsconfig.test.json` in `domain` — **clean.**
- `node domain/scripts/test-domain.mjs` — `# tests 490 / # pass 490 / # fail 0`,
  7.2 s. Includes the five new failed-target tests and the rewritten adapter
  assertion.
- `node scripts/structure-audit.mjs` — `structure-audit: passed (56 warning(s),
  17 baselined).`

### The six Core failures, and which of them are real

**Two are load noise on this machine, and both pass alone** (each had failed at
~15 s, the timeout):

- `service.test.ts > turns mapped observations into reviewed Flow actions without
  making action inputs policy state` — alone: `✓ … 6718ms`, `Tests 1 passed`.
- `service-flow-bootstrap-adaptation.test.ts > bridges a generated proposal ID
  through the standard Adaptation Audit get, approve, and apply endpoints` —
  alone: `✓ … 7123ms`, `Tests 1 passed`.

**Four are real, reproduce alone, and are the Phase S worker's in-flight change
to `AS/runtime/llm/harness/failure-evidence.ts`, not mine.** That file is `M` in
`git status` along with eight other `llm/` files and a new `llm/stages/`
directory. The diff replaces the hard-coded seven-key denylist (`html`,
`innerhtml`, `outerhtml`, `pagesource`, `snapshot`, `cookies`, `headers`) with a
`deniedKeys: readonly string[] = []` parameter the domain is meant to declare —
and **the default is empty**, so nothing is denied until every caller passes one:

- `llm/tests/harness.test.ts:181` — `expected [Function] to throw an error`; a
  packet with a `snapshot` key is no longer refused.
- `llm/tests/harness.test.ts:193` — same, for `selector` in a reusable-context
  `promptProjection`.
- `llm/tests/deepseek-provider.test.ts:81`.
- `runtime/tests/service.test.ts:819` — `expected 1 to be +0`. `providerCalls` is
  1 because malformed evidence now passes the gate and the provider is called.

The last of those is in a file I own, and I did **not** fix it, deliberately.
Their own doc comment says "the evidence-runtime binding requires the
declaration, so it cannot be forgotten into nothing" — so the binding is about to
gain the field, and the fix is one argument at
`service.ts:2976`:

```ts
const sanitized = sanitizeAutomationStudioLlmFailureEvidence("runtime_diagnosis", captured, this.llmEvidenceRuntime.deniedEvidenceKeys);
```

plus the web domain declaring its keys. Passing a hard-coded list from
`service.ts` now would put back exactly the browser vocabulary they are removing,
and their binding shape was still changing while I ran. It is theirs to close;
the call site is mine to change when they hand over the field name.

## Not verified

- **The model never sees `recoveryContext` yet.** It is built and its summary is
  persisted, but until the three hunks above land there is no packet slot. Nobody
  should read "2.1 done" as "the model now gets the context".
- **The three hunks above were never compiled.** They are written from the
  current shape of files another worker is editing; the types they reference all
  exist and are exported from `./recovery/index.ts`, but `tsc` has not seen them.
- **No live browser validation.** The failed-target marking is exercised against
  fixture snapshots in `sanitize.test.ts` and against the adapter's fixture
  payload, not against a real page. Whether `actionResult.element.selector` from
  a real extension client matches a described element's selector byte-for-byte is
  unproven; a mismatch shows up as `failedTargetMissing`, which is a wrong answer
  that reads as a plausible one, so it is worth one manual run on W13 or W24.
- **The Lab proof for 2.1 is not done** — `deterministic-dry` runs on W13
  `banner-absent` and W24 `unannounced`, asserting each section's name and byte
  count from `contextSummary`. It needs the packet slot first, and it is Lab
  files this brief did not own.
- **`recoveryContext` byte budget of 4,000 is reasoned, not measured.** No real
  failure has been through it; the fixture contexts run ~1.3 kB.
- **`recent_nodes` overlaps the packet's own `recentActions`.** Judged worth its
  ~300 bytes so the context reads on its own for 2.2's recovery plan and 2.5's
  adaptation record, and placed next to last so the budget drops it early. If the
  supervisor disagrees, deleting one entry from the section list is the whole
  change.
- **Core's full `pnpm check` / `pnpm test` / `pnpm build` were not run** — only
  the automation-studio runtime suite, the type check and the audit, per the
  brief. With another worker mid-edit in `llm/`, a whole-repo run would have
  reported their state, not mine.

## Open questions or contradictions found

1. **The brief asked for the packet slot and forbade the directory it lives in.**
   Both `context-packet.ts` and `intervention.ts` are under `AS/runtime/llm/`.
   Resolved as instructed — diff in the report — but it means the phase cannot be
   called finished by this worker alone.
2. **`AS/runtime/tests/` is at exactly 25 files, its directory budget**, and
   `service.test.ts` is at exactly its 4787-line baseline. There is no room for a
   new test file or a new test in that directory. The recovery-context coverage
   for the coordinator therefore rides on existing lines inside an existing test.
   Somebody should split `service.test.ts`; it is 4,787 lines against an 800-line
   limit and is now blocking ordinary work.
3. **The scoping report's step 4 named `tools.ts:172-203` as the place to mark
   the failed target.** That is Core's post-failure *recapture*, which is handed
   no target at all — so it can only ever say `failedTargetUnknown`. The place
   that actually knows is `adapter.ts:369`, on the dispatch path, which had the
   selector in hand and was putting it into Core's attempt metadata. Both are
   done; the second is the one that produces a real handle.
4. **Phase H's downstream note pointed at the wrong lines** (`tools.ts:212-217`
   is the snapshot metadata, not the binding). Harmless, but the next reader of
   that report will be misled.
5. **`AutomationStudioLlmFailureEvidenceCaptureInput` carries no failed-target
   identity**, which is why the Core recapture path can never mark one. If the
   loop later wants the recapture to mark a target, that type needs a
   domain-opaque handle or fingerprint on `failedAction` — an `llm/harness/`
   change, and a Phase T-shaped decision about what Core is allowed to carry.
