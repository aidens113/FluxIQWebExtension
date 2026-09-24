# t124 — Phase 0 steps E3, E4, E5, Core side

Worktree `F:\fxwork\t124\!FluxIQ`, branch `task/t124-phase0-debuggable-run`.
Nothing committed. Resumed after a mid-task machine crash; all edits survived.

## Outcome

**Partial.** E3 complete and proved. E5 complete. **E4 is half a feature and
must not be reported as done**: the whole transit is built, validated and
tested, but nothing produces a timestamp, because the only place that can
produce one is `runtime/llm/evidence-loop.ts`, which I do not own.

## State of each step

### E3 — stop dropping what is already kept: **complete, proved**

`evidence-loop-steps.ts` emitted three fields of the eight the sanitized trace
already retained. It now emits `iteration`, `evidenceBytes` and the provider's
`usage` as well, and `generation-failure.ts` was widened in lockstep.

**`callId` is deliberately withheld, and this is the one place I did not do
what the brief said.** The brief lists it among the four to emit. It must not
be emitted, because it is not Core's string: `runtime/llm/evidence-loop.ts:670`
takes the call id straight from the model's decision (`unusedCallId` returns
what was requested, bounded only to 500 characters), so publishing it puts
model-written text into a record whose module header promises "codes and
identifiers only ... an audit detail that no redaction rule covers". An
existing test has asserted exactly this since the record existed:

    expect(JSON.stringify(failure)).not.toContain("private.call");

My brief's own constraint — "Never weaken redaction ... never prompts, replies
or page content" — outranks "emit them" for this field, so I kept the
guarantee and left the other three plus E4's `at`. `iteration` supplies the
ordering and the join that mattered; the field stays declared and parsed so a
Core-minted call id can travel the day the loop mints one. **This is a
contradiction in the brief and the supervisor should confirm the call.**

### E4 — a timestamp per decision row: **transit complete, producer missing**

Built and tested end to end: `at` (epoch milliseconds) is declared on the trace
row and the published step, preserved by `sanitizeEvidenceLoopTrace`, emitted
by the step builder, and accepted and bounded by the diagnostic parser
(rejected past 2100-01-01, or negative, or fractional).

**No real timestamp flows yet.** All ten `trace.push` sites in
`runtime/llm/evidence-loop.ts` write no `at`; the only `at:` match in that file
is inside a comment. The loop already holds the clock it would use
(`evidence-loop.ts:357`, `const clock = input.budget?.now ?? Date.now`), so the
producer is roughly one added field per push site — but that file is not in my
owned set, so I did not touch it. Until someone does, the 99,375 ms gap is
still undivided. Assign that file to close E4.

I chose to declare `at` on a row type of my own
(`AutomationStudioFlowBootstrapEvidenceTraceRow = AutomationStudioLlmEvidenceLoopTrace & { at?: number }`)
rather than on the loop's contract, so the loop's own callers are unaffected.

### E5 — a per-call ledger for builds: **complete**

`run-call-record.ts` gained `automationStudioLlmBuildCallRecord`, producing the
*same* `AutomationStudioLlmRunCallRecord` a run's calls are itemized in, so the
downstream consumer that hard-codes `observedCalls: []`
(`packages/test-runner/src/live-llm/build-usage.ts:35`) can reuse its existing
`fromProviderCall` reader. `evidenceTraceAuditDetail` now publishes
`providerCalls` and `providerCallsOmitted`.

Design points worth review:

- A build's calls are read back from the evidence loop's trace, which already
  records one row per decision with the provider's reported usage. Nothing
  about how a build runs changed.
- Rows are folded **by iteration**, because a decision that edits the draft and
  re-runs a step writes two rows and costs one call. `sequence` is that
  iteration, which is also what `steps[].iteration` says, so a line and the
  decision it paid for join on it.
- `charged` mirrors what the provider reported, with an unreported figure
  charged as zero — which reproduces the build's own accounting exactly, since
  `addUsage` sums `usage.x ?? 0`. The `tokens`/`cost` flags still say which
  figures were measured; `reserved` on a build means "never measured", not
  "reserved", and is documented as such.
- `requestId` widened to `string | null`. A build keeps no reservation and has
  no per-call provider request id, and inventing one would be worse. Downstream
  already types `LiveLlmObservedCall.requestId` as `string | null`; the mirror
  type `ExistingRunProviderCall` still says `string` and a domain worker should
  widen it.
- `providerCallsOmitted` reports the build's calls made outside the loop, which
  leave no trace row, so a reader can tell a short receipt from a whole one.

## The trap: was `hasExactFields` widened in lockstep, and proved?

**Yes, and proved by deliberately breaking it.**

`parseEvidenceLoopCounts` gates each step with `hasExactFields`, which rejects a
record carrying any field it was not told about — and a rejected step returns
`null` for the **whole** diagnostic, so the build's named reason is replaced by
a generic transport failure. The allow-list and the step type were widened
together.

I did not settle for "the new test passes". I temporarily reverted the
allow-list to its old three names and re-ran:

    const EVIDENCE_STEP_FIELDS = ["toolId", "effectApplied", "resultCode"];
    npx vitest run .../flow-bootstrap/tests/generation-failure.test.ts
    -> Tests  12 failed | 38 passed (50)

The 12 include the dedicated trap test *and*, tellingly, the nine
`preserves closed evidence coordinator failure ...` round-trip cases, where
`parseAutomationStudioFlowBootstrapGenerationError(failure)` returned `null`
instead of the diagnostic — Core rejecting its own record, which is exactly the
silent failure mode the brief warned about. The allow-list was then restored and
all 50 pass.

**I also removed the trap structurally rather than only testing it.** The step
type and the allow-list that parses it were in two files, which is how the shape
came to publish three of eight fields in the first place. The step parser now
lives in `evidence-loop-steps.ts` beside the type it must agree with, so
widening a step is one edit in one file. That cut was forced anyway — see below.

## Structure audit: a hard limit was hit and cut

Adding the parse to `generation-failure.ts` took it from 769 to **819 lines**,
past Core's 800-line hard limit:

    node scripts/structure-audit.mjs
    FAIL [file-lines] .../flow-bootstrap/generation-failure.ts: 819 lines
         exceeds the 800-line limit. Split it by diagnosing why it grew.

Diagnosed before cutting, per Core's methodology: it grew because a *second*
module's shape was being parsed inside it. Moving the step parser to the module
that declares the step fixes the placement and the lockstep hazard at once.
`generation-failure.ts` is now 770 lines and the audit passes (exit 0, warnings
only; `generation-failure.ts` remains on the pre-existing 400-line advisory
list, as it was before this task).

## Commands run and observed results

| Command | Observed |
| --- | --- |
| `pnpm check` in `packages/fluxiq` (`tsc --noEmit`), after all my edits incl. the module split | passed, no output |
| `node scripts/structure-audit.mjs` (first attempt) | `FAIL [file-lines] generation-failure.ts: 819 lines exceeds the 800-line limit` |
| `node scripts/structure-audit.mjs` (after the cut) | `structure-audit: passed (183 warning(s), 359 baselined)`, exit 0 |
| `npx vitest run` on the 4 affected test files | `Test Files 4 passed (4) / Tests 92 passed (92)` |
| Trap proof: allow-list reverted, `generation-failure.test.ts` | `Tests 12 failed | 38 passed (50)` — then restored, 50 pass |
| `npx vitest run` (full package, run 1) | `3 failed | 3257 passed | 1 skipped (3260)` |
| `npx vitest run` (full package, run 2) | `3 failed | 3256 passed | 1 skipped (3260)` |
| `npx biome check` on my 5 source files | `No files were processed` — biome's config ignores these paths |

### The full-suite failures, named

Six distinct test names failed across the two full runs; five pass in isolation
and the failing set changed between runs, which is load flakiness on this
machine, not my change:

- `service-flows/.../instruction-readiness.test.ts` — failed run 1, passed run 2 and in isolation.
- `service-adaptation/.../subflow.test.ts` and `service-recordings/.../proposals.test.ts` — failed run 2, pass in isolation (`2 passed / 15 tests`).
- `tests/deepseek-bootstrap-exploration.test.ts` — **genuinely mine**, now fixed (below).
- `service-bootstrap/.../rejections.test.ts > invalid plan structure` — **pre-existing, not mine**, fails deterministically.

**The one real, persistent failure is pre-existing.** It expects issue code
`bootstrap.invalid_subflows` and receives `bootstrap.subflow_has_no_nodes` with
a `path`. Proof it is not mine: `git log -S "subflow_has_no_nodes"` names a
single commit, `50d8e04 "A refused subflow says why, instead of blaming the
array"` — the t123 merge that is this branch's parent — while the test file was
last touched three commits earlier. It is not in my diff and my change touches
no plan-validation issue code. **t123 changed the produced code and left this
expectation behind; someone should fix it.**

## Files changed

Owned by the brief:

- `runtime/flow-bootstrap/evidence-loop-steps.ts` — widened step, `at`, trace row type, and the step parser moved in.
- `runtime/flow-bootstrap/generation-failure.ts` — diagnostic `steps` now the shared step type; allow-list widened; parser delegated; file back under 800 lines.
- `runtime/service/flow-bootstrap-commands/evidence-trace.ts` — `at` preserved; `providerCalls` and `providerCallsOmitted` published.
- `runtime/llm/run-call-record.ts` — `automationStudioLlmBuildCallRecord`, `AutomationStudioLlmBuildCall`, `requestId: string | null`.
- Their tests: `flow-bootstrap/tests/generation-failure.test.ts`, `service/flow-bootstrap-commands/tests/evidence-trace.test.ts`, `llm/tests/run-call-record.test.ts`.

Touched outside the listed set, both mechanical consequences — flagging them
because the brief said I own exactly the files above:

- `runtime/llm/index.ts` — one added barrel export line. Without it the new
  function is unreachable through the directory barrel, and Core's structure
  audit bans importing past a barrel.
- `runtime/tests/deepseek-bootstrap-exploration.test.ts` — a service-level test
  asserting the exact published step shape; its expectation needed `iteration`.

## Not verified

- **No live Lab run**, per the brief. Nothing here is proved against a real build.
- **E4 end to end is unproved by construction**, because nothing emits `at`. The transit is unit-tested with synthetic rows only.
- **Root `pnpm check` does not currently pass**, for a reason that is not mine — see below. My last clean whole-program `tsc --noEmit` was after all my edits and before that interference.
- The downstream extension side (`build-usage.ts`, `ExistingRunProviderCall`) is untouched; `observedCalls` is still `[]` until a domain worker reads the new `providerCalls`.
- The domain worker's widened rejection reason never passes through my files as a distinct field — it arrives as `resultCode`, which I carry unchanged and unflattened (code-shaped values only, whitespace rejected).

## Open questions and contradictions found

1. **Another agent is editing this Core worktree concurrently.** The brief said
   I was the only worker here. During my session, three files I never touched
   were modified: `runtime/llm/harness/provider-result.ts` (11:52:55),
   `structured-response.ts` (11:52:11) and `runtime-patch-schema.ts`. My own
   last edit was 11:38:40. Their in-flight change replaces
   `actionDefinitionIds` with `steps` on the `temporary_action_sequence` patch,
   and **that is what makes root `pnpm check` fail** — every one of the six
   errors is in `runtime/live-patch.ts`, `llm/harness/output-validation.ts` or
   `tests/live-patch.test.ts`, all consumers of their type, and none in any file
   of mine. I left their work alone. Whoever is coordinating should know two
   tasks are live in one checkout, which is exactly the situation AGENTS.md says
   produces false validation failures.
2. **The brief's "emit `callId`" conflicts with its "never weaken redaction".**
   Resolved toward redaction; see E3. Needs the supervisor's confirmation.
3. **E4 needs `runtime/llm/evidence-loop.ts` assigned to someone.** Ten
   `trace.push` sites, one field each, clock already in hand at line 357.
4. `ExistingRunProviderCall.requestId` downstream should widen to
   `string | null` to match a build's line.
