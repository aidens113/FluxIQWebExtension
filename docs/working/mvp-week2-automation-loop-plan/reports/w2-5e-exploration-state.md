# w2-5e — Exploration state digests and action inputs, and the reducer wired up

Worker report. Work done entirely in the isolated worktree pair
`F:\fxwork\t005\!FluxIQ` and `F:\fxwork\t005\!FluxIQWebExtension`, branch
`task/t005-exploration-state`. Nothing in `F:\!FluxIQ` or
`F:\!FluxIQWebExtension` was edited; this report is the one file written to the
main checkout, as the brief instructed. Nothing was committed.

`AS/` below means
`packages/fluxiq/src/programs/automation-studio/runtime/`.

## Outcome

Done. The exploration runner now records, per action that ran, a caller-supplied
state digest and the argument the action was given; the reducer at
`AS/exploration-reduction/` is wired at
`AS/recovery/annotation/exploration.ts` and its `stateChainIntact` flag is read
and acted on; and the web domain implements the digest from already-sanitized
evidence. The reducer's own input contract was **not** changed — it turned out
to need nothing it did not already declare.

## One contradiction in the brief, resolved and reported

The brief said to add the per-step digest and input to "2.3's trace
(`AS/runtime/recovery/trace.ts`, exporting `AutomationStudioRecoveryTrace`)".
That file is the wrong one and putting the data there would have broken it.
`AutomationStudioRecoveryTrace` is the **four-stage** recovery trace —
`diagnosis`, `recovery_plan`, `exploration`, `resolution`, one event per stage,
each stage recordable exactly once, and content-free by an explicit stated
contract ("An event carries a stage, a status, a Core-authored reason and
counts. It never carries a model's prose, a page's contents or a repair
target"). There is no per-step row in it to put a digest on, and an action's
argument is precisely the kind of content it refuses.

The per-step trace the reducer actually reads is
`AutomationStudioLlmEvidenceLoopTrace`, declared in `AS/llm/evidence-loop.ts`
and surfaced as `AutomationStudioRuntimeExploration.trace` by
`AS/recovery/runtime-exploration.ts`. That is where the per-step record belongs,
and that is where it went. The stage trace is untouched.

A second, smaller correction. The brief stated the digest contract's failure
modes as "Too coarse and the precondition never matches; too fine and an undo
goes unrecognised." Those are the wrong way round, and it matters because the
two failures need opposite fixes. Written correctly (and this is how it is
written in the source):

- **Too fine** — digests differ when nothing the automation depends on changed.
  The undo goes unrecognised, because the reducer spots a reversal only by the
  state returning to a value it already held; and the precondition, which is
  equality on the digest, then names a state that will never recur, so a replay
  that would have worked is refused. Both consequences are the *fine* side.
- **Too coarse** — digests are equal across a step that did change something the
  automation depends on. That step reads as `changed_nothing`, is dropped, and
  the "minimum sequence" is missing the step the success depended on.

## The trace contract added (Core)

New directory `AS/recovery/exploration-state/`, five files plus tests:

| File | What it holds |
| --- | --- |
| `digest-source.ts` | `AutomationStudioExplorationStateDigestSource`, its request type, its phase (`"before" \| "after"`), a failure record, and the digest contract in full |
| `step-record.ts` | `AutomationStudioExplorationStepRecord` |
| `recorder.ts` | `AutomationStudioExplorationStateRecorder`, which wraps one `executeTool` call |
| `reduction-review.ts` | `reviewAutomationStudioExplorationReduction` and its verdict type |
| `index.ts` | barrel, re-exported from `AS/recovery/index.ts` |

### The record

```ts
export type AutomationStudioExplorationStepRecord = {
  callId: string;       // the same call id the evidence-loop trace carries
  toolId: string;
  iteration?: number;   // joined from the trace, by the runner, once
  input: JsonObject;    // the argument the action was given
  stateBefore?: string; // absent means the caller could not say
  stateAfter?: string;
};
```

`AutomationStudioRuntimeExploration` gains three fields, written on **every**
branch of the classifier rather than only the successful one (a step that ran
before a limit stopped the exploration still ran):

- `steps: readonly AutomationStudioExplorationStepRecord[]`
- `stateDigestFailures: readonly AutomationStudioExplorationStateDigestFailure[]`
- `observedState: boolean`

`AutomationStudioRuntimeExplorationInput` gains
`captureStateDigest?: AutomationStudioExplorationStateDigestSource`.

**It is one record, not two.** The brief's reasoning ("two records of one run
… will disagree") is why `steps` is keyed on `callId`, the same key the trace
carries, and why the runner — not any reader — performs the join and stamps
`iteration` on each record from the trace. A reader that joined the two itself
would be free to join them differently. A test asserts the two line up
one-for-one.

### The hook on `executeTool`

The recorder wraps the call itself inside the runner:

```ts
const execution = await recorder.around(call, () => input.loop.executeTool(call));
```

That is the only place both facts exist: the argument, which the loop builds a
signature from and then discards, and the two moments either side of the action.
The "after" of one step and the "before" of the next are **asked for
separately**, deliberately — deriving one from the other would make
`stateChainIntact` vacuous, turning a doubt Core can report into a silence. The
cost is two state captures per step; see *Open questions*.

A digest source that throws never fails the step: the throw is recorded in
`stateDigestFailures`, the step runs, returns, and is recorded without that
digest, and the reduction reports it as a gap rather than assuming the state
stood still.

### Where the domain answers

`AutomationStudioLlmEvidenceRuntimeBinding` (in `AS/llm/harness-options/binding.ts`)
gains an optional

```ts
captureStateDigest?(input: {
  projectId: string; flowId: string; callId: string; toolId: string;
  phase: AutomationStudioExplorationStateDigestPhase; signal?: AbortSignal;
}): Promise<string | undefined>;
```

Optional on purpose: a domain that cannot observe its own state should say
nothing rather than invent a digest. An exploration with no digests is simply
not reduced, and says so.

## The digest contract, as stated in Core

Stated in `AS/recovery/exploration-state/digest-source.ts`, where a domain
implementer reading the hook's type finds it, and repeated in the binding's
doc comment with a pointer back. In full:

> **A digest must be stable across a step that changed nothing the automation
> depends on, and different after a step that did.**

with both failure modes spelt out (as corrected above), and:

> The practical test for an implementer is one question per field: *if this were
> the only thing that differed between two moments, would the same sequence of
> actions do the same thing?* If yes, the field is noise and must stay out of the
> digest. If no, it belongs in.

Plus three consequences: the digest is opaque and compared only for equality, so
nothing derived from a timestamp, a random id or an iteration counter may enter
it; the two sides of a step are asked separately and why; and it is computed
from what has already been sanitized, because a digest exists to be compared and
one over raw material buys nothing while widening what leaves the domain.

Core gained no web, DOM, URL, selector, tab or browser concept. The ratcheted
`web-vocabulary` rule from `25bea03` reports no new instance (observed output
below).

## Wiring the reducer, and honouring `stateChainIntact`

At `AS/recovery/annotation/exploration.ts`, immediately after the
`runAutomationStudioRuntimeExploration({...})` call:

- The digest hook is threaded **in** from that same site, because it is the only
  place holding both the domain that can observe its own state and the project
  and Flow the observation belongs to. The runner asks about a moment; this adds
  the context and passes the question straight through.
- Afterwards, `reviewAutomationStudioExplorationReduction` runs, and the result
  is published as `AutomationStudioRecoveryExplorationResult.reduced`.
- It is computed **only** for `outcome === "evidence_gathered"`. A reduction is
  the path that *worked*; an exploration that was stopped, refused or came back
  empty has no state in which success was observed, and reducing one would
  answer with a fix for a success that never happened.
- The domain's single `classifyRefusal` declaration is reused to classify a step
  outcome (a code the domain reads as a refusal is a step that did not happen),
  rather than asking the domain for a second, differently-worded table.

The verdict reads the flag and two more things. `replayable` is true only when
**all** of these hold:

1. something was bound to observe the state (`observedState`);
2. at least one step could be placed on the chain;
3. `reduction.stateChainIntact` is true;
4. no trace entry went unread for a reason other than `not_an_action` — an
   `unknown_action` or a `no_state_digests` gap means the chain the reducer
   walked was not the exploration that happened.

Point 4 matters as much as point 3: with no digest source at all, every action
becomes a gap, `steps` is empty, and the reducer's honest answer to an empty
exploration — "nothing is needed, from any state", `stateChainIntact: true` —
would read as a fix that does nothing. It is refused with a Core-authored
sentence instead.

**The known trap is covered.** An action with no declared `effect` defaults to
`observe`, so a mutating action whose table forgot to say so is dropped from
every reduction, and the backward slice then finds a non-replayable step where a
producer must have been and sets `stateChainIntact: false`. The wiring refuses
the reduction, and the sentence names both causes Core cannot tell apart ("either
something changed the state between two steps, or an action declared as only
observing is where a state change came from"). A test drives exactly that case
end to end.

## The web digest, and why it widens nothing

New `domain/src/runtime/llm-evidence/state-digest.ts`, exporting
`webLlmStateDigest(evidence: WebLlmPageEvidence): string`, wired as
`captureStateDigest` on `WebAutomationLlmEvidenceRuntime` in
`domain/src/runtime/llm-evidence/tools.ts`.

**How it is computed.** The implementation takes one fresh capture through
`captureEvidence` — the same single path every packet in this repository goes
through, which sanitizes to the exploration budget, strips selectors and refuses
sensitive controls — and hashes a projection of the resulting
`WebLlmPageEvidence`. The capture is deliberately **not** `retain`ed and not
`shown`: no model is ever given it, no handle it issues is resolvable, and
letting it into the packet windows would age out a packet the model does read.
No expected origin is asserted, because an exploration action may legitimately
move the page and the digest has to describe wherever it landed.

**In the digest** (the answer to "would the same actions do the same thing?" is
*no*): location; title; frame `isTop`; per control — tag, frame id, role,
accessible name, visible text, input type, control type, `hasValue`,
`selectedValue`, `href`, `options`, `revealKind`, `expanded`, form, landmark,
heading, list position, table cell; and anything standing in front of the page —
open dialogs and the blocking overlay — because a control behind a modal is not
reachable.

**Out of the digest**, each because it is stamped by what just happened rather
than by the page, and so never returns after an undo:

| Left out | Why |
| --- | --- |
| `navigation` | Go somewhere and come back and the page is the same page, but its type is now `back_forward` and its referrer changed. Include it and no back-navigation is ever an undo — the canonical case. |
| `loading` | `readyState`, `busy`, spinner, pending navigation describe a moment in a page's settling, and flicker between two captures of a page nobody touched. |
| `selectedText` | An interaction moves it; its undo does not move it back. |
| `recent`, `changed`, `focused` | Each is relative to the exploration's own actions: "the exploration touched this", "this differs from the previous capture", and focus follows the last interaction. |
| `truncated`, `captureTruncated`, `elementsTruncated`, `budgetTruncated`, `elementTotal` | Facts about the packet's byte budget, not the page. |
| `target` | The opaque handle is assigned by position on each capture, so it restates position. |
| `failedTarget*`, `repairParameters` | Only ever on a failure packet; an exploration capture is an observation. |

**Element order is deliberately not part of it.** The packet ranks recently
touched elements first, so list order moves with what the exploration did — the
same defect as `recent`, one level up. Element lines are sorted before hashing.
That costs the ability to see a page that reordered its controls and changed
nothing else, and buys an undo that is recognisable. It is the one place the
digest is knowingly coarser than the page, and it is stated as such in the file.

**Exhaustiveness is mechanical.** Both projections are built as
`Record<keyof WebLlmPageEvidence, string>` and `Record<keyof WebLlmEvidenceElement, string>`,
so a field added to the packet or to an element stops the file compiling until
someone decides whether it belongs in the digest — the same reason `present.ts`
makes every key mandatory at its call site. Keys are sorted and each carries its
own name into the text, so adding a field cannot silently shift the others.

**Why it widens nothing.** The input is `WebLlmPageEvidence` — the packet
`sanitize.ts` has already bounded, already stripped of selectors, already
refusing a sensitive control, and which Core is shown anyway. No raw snapshot is
read; `WebLlmSnapshotBinding.selectors` is not an input; and what leaves is
roughly twenty characters (`web-state.v1:<length>:<fnv1a>`) from which nothing
can be recovered. A test asserts a password field the sanitizer refuses does not
change the digest, and that the digest contains no page text.

## Mutations — each run, each observed, each reverted

All three killed at least one test. Reverted after each, and the suites are
green again (observed output below).

### 1. Record the evidence digest instead of the state digest

Applied in `AS/recovery/runtime-exploration.ts`: the recorder's digest source
replaced with `automationStudioExplorationEvidenceDigest(lastEvidenceText)`.

**6 tests failed** across both new files. The decisive one, from
`exploration-state/tests/state-record.test.ts`:

```
× records what the world was, not what the step said, so two steps that
  returned identical evidence still reduce to two actions
- Expected                              + Received
    "call.1",                             "call.1",
-   "state.listing",                    + "0:811c9dc5",
-   "state.first-panel-open",           + "0:811c9dc5",
    "call.2",                             "call.2",
-   "state.first-panel-open",           + "37:2042d527",
-   "state.second-panel-open",          + "37:2042d527",
```

The fixture returns byte-identical evidence from every step while the world
changes twice, which is the exact disagreement the brief named. Under the
mutation `stateBefore === stateAfter` for both steps, both are dropped as
`changed_nothing`, and the reduction comes back empty
(`expected [] to deeply equal [ { index: +0, …(2) }, …(1) ]`).

### 2. Drop the action input from the trace

Applied in `exploration-state/recorder.ts`: `input: call.value` → `input: {}`.

**2 tests failed**, one in each new file:

```
× carries the argument each action was given into the reduced sequence
  AssertionError: expected [ {}, {} ] to deeply equal [ Array(2) ]
- Object { "target": "one" },   + Object {},
- Object { "target": "two" },   + Object {},
```

and, at the wiring level, `publishes the shortest sequence that reached the
state success was observed in` — the sequence still names the action and nobody
can run it, which is the defect the input exists to prevent.

### 3. Ignore `stateChainIntact` at the call site

Applied in `exploration-state/reduction-review.ts`: the
`if (!reduction.stateChainIntact)` branch deleted, so the verdict no longer
reads the flag.

**1 test failed**, exactly the trap case:

```
× refuses the reduction when an action that changed something was declared
  as only observing
  → expected true to be false // Object.is equality
```

`replayable` became true over a broken chain, publishing an empty sequence as a
fix.

## What was validated, with observed output

Core, always from `F:\fxwork\t005\!FluxIQ\packages\fluxiq` (never a repository
root):

- `npx tsc --noEmit` — clean apart from a pre-existing failure, see below.
- `npx vitest run src/programs/automation-studio/runtime/recovery src/programs/automation-studio/runtime/exploration-reduction`
  → `Test Files 25 passed (25)`, `Tests 342 passed (342)`.
- `npx vitest run src/programs/automation-studio`
  → `Test Files 1 failed | 239 passed (240)`, `Tests 1 failed | 2131 passed | 1 skipped (2133)`.
  The one failure was `run-detail-preservation.test.ts` →
  `Error: Test timed out in 15000ms`, in a run whose slowest passing test took
  17.8 s. Rerun alone: `Test Files 1 passed (1)`, `Tests 3 passed (3)`, the same
  test in 4.5 s. Load-correlated and non-reproducible, so environmental rather
  than a defect.
- `node scripts/structure-audit.mjs` (from the Core worktree root) →
  `structure-audit: 1 violation(s) across 1 rule(s)`, and that one is
  pre-existing (below). No `web-vocabulary` finding, no `directory-files`,
  `file-lines`, `exported-values`, `naming`, `failure-as-empty` or
  `swallowed-failure` finding against anything added here.
- `npx pnpm --filter fluxiq build` — succeeded; needed because the downstream
  resolves Core through `dist`.

Downstream, from `F:\fxwork\t005\!FluxIQWebExtension`:

- `DOMAIN_TEST_BUILD_LABEL=w2-5e npx pnpm --filter @fluxiq-web-extension/domain test`
  → `# tests 682`, `# pass 682`, `# fail 0`. The seven new digest tests ran and
  passed (`ok 528`–`ok 534`), confirmed by name.
- `npx pnpm check` → `structure-audit: passed (67 warning(s), 122 baselined)`
  and every workspace project's `check: Done`, including `domain`,
  `apps/extension`, `apps/scenario-lab` and `packages/test-runner`.

New tests added:

- `AS/recovery/exploration-state/tests/state-record.test.ts` — 5 cases: state
  not evidence; the argument surviving into the reduced sequence; the record
  joined one-for-one to the trace; an exploration whose state nothing observed
  refused rather than reduced to an empty fix; a digest that throws leaving the
  step standing and reporting the failure.
- `AS/recovery/annotation/tests/exploration-reduction.test.ts` — 4 cases: the
  canonical four-step wander reduced to the one action that worked with both
  predicates; the undeclared-effect trap refused; no reduction for
  `no_evidence_found`; an unusable reduction with a reason when the domain
  observes no state.
- `domain/src/runtime/llm-evidence/tests/state-digest.test.ts` — 7 cases,
  including the undo case (a page reached by going back digests the same as the
  page first arrived at, despite differing `navigation`, `loading` and
  `selectedText`), the ranking case, and the sanitizer-refusal case.

## Two pre-existing failures on this branch, neither mine

Both confirmed against files `git status` shows I did not touch.

1. `npx tsc --noEmit` in Core reports errors in
   `src/programs/automation-studio/runtime/tests/service-adaptation/tests/subflow.test.ts`
   — `readonly` tuples not assignable to `JsonValue` in
   `AutomationStudioChangeProposalPatch`. Unrelated to anything here; the file
   was last changed by `3bca251`.
2. `node scripts/structure-audit.mjs` fails with
   `[directory-files] packages/fluxiq/src/programs/automation-studio/model/: 29
   source files exceeds the 25-file limit … Baseline for this entry is 28`.
   Also `3bca251`: a 29th file was added to `model/` without re-baselining.
   `pnpm structure:baseline` would record it, but that is a supervisor decision
   about someone else's work, so it was left alone.

These are the only two red things in the trees, and both predate this brief.

## Not verified

- **No live browser validation.** Nothing here was exercised against a real
  page, a real extension build or a real provider. The web digest is proven
  against sanitized snapshot fixtures only; the Core wiring is proven with a
  scripted provider. In particular, nobody has yet observed whether two
  consecutive captures of a real page produce equal digests in practice — see
  the first open question.
- **No cross-repository integration run.** The Core wiring and the web digest
  meet only through a type; no test drives `runAutomationStudioRecoveryExploration`
  with the real `WebAutomationLlmEvidenceRuntime`.
- **`pnpm check` and `pnpm test` at the Core repository root were not run** —
  the brief said Core tests must run from `packages/fluxiq`, so the `-r` root
  scripts were left alone. `apps/web` was not type-checked; nothing there reads
  the changed types.
- **Nothing was committed**, and no baseline was regenerated.

## Open questions for the supervisor

1. **Two captures per step is the cost of an honest chain flag.** Independent
   "after" and "before" captures are what make `stateChainIntact` mean anything,
   but they double the page round-trips during a recovery and there is a real
   chance that on a live page — anything with a clock, a counter, a rotating
   banner or a lazily-arriving control — the chain reports broken most of the
   time and the reduction is therefore almost never `replayable`. That is the
   honest outcome of the design as briefed, and it is better than a silent
   wrong answer, but it should be measured on a real page before anyone builds
   on `replayable`. If the rate is bad, the fix is in the digest projection (a
   field that should have been excluded), not in the flag.
2. **Nothing consumes `reduced` yet.** It is published on
   `AutomationStudioRecoveryExplorationResult` and read by nothing: it is not
   stored, not shown, and not turned into a deterministic path. Whoever owns the
   next phase should say where it goes, and `replayable` is the gate they must
   respect.
3. `model/`'s directory-files baseline needs regenerating by someone entitled to
   decide it, or the audit stays red for every task on this branch.
