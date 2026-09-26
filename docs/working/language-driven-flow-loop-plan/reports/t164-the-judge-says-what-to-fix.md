# t164 — The judge must say what to fix, with the same context the other modes get

Repository: `F:\!FluxIQ` (Core), branch `dev`. Nothing committed, Core not built.

## Outcome

**Done**, with two parts of the brief deliberately left undone and specified instead,
because both live in `runtime/llm/`, which the brief forbids me to touch.

- **Built:** the judgement is shown each step's authored parameters (the parity gap with
  the repair), and a refutation now carries a structured directive — Core's coded findings,
  Core's fix lines, and the judgement's own screened reading — which reaches the repair
  today through the failure record's `expected` and `actual`, with no caller change.
- **Specified, not built:** the one-sentence change to the verification prompt that
  *encourages* explicitness (requirement 4), and three caller widenings that would close
  the remaining context gaps. Exact text and locations in **Open questions** below.

## 1. What the judge is given today, with the evidence

The verification call is built in `result-verification/verify.ts:159-178`. It hands the
harness exactly this:

```ts
taskKind: "loop_verification",
instructions: [...request.instructions],   // the person's request, as Flow instructions
runDetail,                                  // → context.recentActions
resultSummary: request.summary,             // counts, columns, ≤8 sampled rows, flowShape
deniedEvidenceKeys, policy, provider, ...
metadata: { source: "verifyAutomationStudioRunResult", expectedOutput: "diagnosis" }
```

`llm/harness/context-packet.ts` then decides what actually reaches the model. Two gates in
that file are the whole finding:

```ts
// line 126-130 — the judge IS allowed the result summary
const AUTOMATION_STUDIO_RESULT_SUMMARY_TASK_KINDS = new Set([
  "loop_verification", "runtime_diagnosis", "runtime_patch"
]);

// line 252-254 — the judge is NOT allowed the conversation
...(input.conversation?.length && (input.taskKind === "runtime_diagnosis" || input.taskKind === "runtime_patch")
  ? conversationSlot(input.conversation)
  : {}),
```

**The judge was strictly poorer than the repair it triggers.** Quoting the difference,
item by item:

| Context | Repair (`runtime_diagnosis` / `runtime_patch`) | Judge (`loop_verification`) before | after |
| --- | --- | --- | --- |
| The person's instruction | yes | yes | yes |
| The extracted data (counts, columns, sample rows) | yes (`resultSummary`) | yes | yes |
| **Each step's authored parameters** | yes — `recovery/repair-context/step-parameters.ts`, screened by `parameter-screen.ts` | **no** — `flowShape` was `{ nodeId, definitionId }` | **yes**, same projection |
| The step's own name (`label`) | yes | no | **yes** |
| The conversation so far | yes (`context.conversation`) | **no** | no — needs `context-packet.ts` |
| Per-step record counts / route / comparison | yes (`step-parameters.ts` result half) | no — `recentActions` carries status only | no — needs `context-packet.ts` |
| Page evidence | yes (`failureEvidence`, `explorationEvidence`, `recoveryContext`) | no | no — see note |
| The Flow as a graph | yes (`repair-context/flow-graph.ts`) | no (flat list) | no (flat list) |

The parameters gap is the load-bearing one, and `llm/diagnosis-instructions.ts:27` is the
proof. The judge is told to answer `no` for

> "a Flow with no step that could have narrowed or filtered what the request asked to narrow"

— and it was shown only definition ids, against which *a Flow that filters on the right
field and a Flow that filters on the wrong one are the same list of names*. Five
consecutive live runs were refuted on exactly that evidence. The repair that follows has
been shown the screened parameters since t139; the judgement whose refutation triggers it
had not been.

**Page evidence is genuinely unavailable to the judge, not withheld from it.** A run that
verification looks at finished with no failed step, so there is no failure capture, and the
recovery's exploration packets belong to the repair that has not started yet. The closest
thing that exists is the sampled rows, which the judge already had. I am not proposing to
create page evidence for a clean run.

## 2. What changed and why

All under `packages/fluxiq/src/programs/automation-studio/runtime/result-verification/`.

**`contracts.ts`** — new `AutomationStudioResultFlowStepSummary` (adds `label`,
`parameters`, `parametersWithheld` to a step); `flowParametersWithheld` on the summary;
`AutomationStudioResultRepairFinding` and `AutomationStudioResultRepairDirective`; and
`repair?` on `AutomationStudioResultVerification`.

It also **stops re-exporting `AUTOMATION_STUDIO_RESULT_SUMMARY_LIMITS`** from
`../loop-limits/index.ts`; `result-summary.ts`, the module that applies every one of those
bounds, re-exports them instead and the directory barrel still publishes them, so nothing
outside changes. That one line made a *contract* file reach a value out of another
directory whose barrel also carries the evidence-loop budgets, which import values out of
`runtime/llm/harness/` — so reading a byte bound pulled the whole LLM harness into the
evaluation of every module that reads the contract. With `runtime/llm` mid-rewrite this
afternoon that made **five of this directory's seven suites fail to load at all**, on a
module cycle none of them touch. That cycle has since been fixed by whoever owns
`runtime/llm`; the change stands on its own merits and is why the suites run below.

**`result-summary.ts`** — each step carries its `label` and its authored parameters,
screened by `automationStudioScreenedNodeParameters` from
`recovery/repair-context/index.ts`: the same function, the same two screens (the domain's
denied keys and credential shapes; locator-shaped strings) and the same dotted-index
notation for a withheld path that today's t154/t160 work settled. A caller with no
declared-keys list gets no parameters at all, exactly as it gets no sampled rows.

The parameters are spent **out of what the rest of the summary left**. The summary's
4,000-byte ceiling is unchanged, the row sample keeps its priority, and a step left bare
for want of room sets `flowParametersWithheld` — so "runs on its defaults" and "there was
no room to say" do not read alike. That mirrors how `context-packet.ts` packs explored
evidence last.

**`repair-directive.ts` (new, 338 lines)** — builds the directive.

*Core's half*, pure arithmetic over the summary Core already holds, nine coded findings:
`result.no_record_set`, `result.every_row_refused`, `result.no_records_stored`,
`result.required_values_missing` (with the column ids), `result.column_always_empty` (a
column with no value in any sampled row, excluding ones the required-value check already
named), `result.rows_identical` (every sampled row the same row — the classic list-reader
defect), `result.records_truncated`, `result.summary_withheld`, and
`result.counts_look_right`. Each finding that implies a change contributes one imperative
`fix` line naming what to change. `result.summary_withheld` deliberately contributes none:
it is a fact about the account, and a fix line for it would be a change nothing observed.

The empty-result line is worth quoting, because it is the opposite of the tempting advice
and follows the standing rule that a first pass is permissive:

> "Check that the Flow reached the page the request names, then loosen every condition on
> the step that reads rows before narrowing it again: it found nothing at all."

*The judgement's half* — `judgement: { expected?, observed?, advice? }`, read off the
`expected`, `observed` and `changed` the diagnosis channel **already** carries, with the
reply's own `summary` standing in for `advice` where `changed` was empty.

**Nothing new is demanded of the model.** No new response field, no new schema key, no new
parse. Anything that is not a usable string is simply absent; a credential-shaped sentence
is dropped whole; a locator-shaped one is redacted in place (`locator-text.ts`'s rule for a
sentence) and the loss is named in `withheld`. A judgement that answers `no` and says
nothing else produces a valid refutation carrying Core's findings. **No shape of answer can
cost the verdict** — that is asserted from five directions in the tests.

**`core-observation.ts`** — the two refutations Core settles from its own counts now carry
a directive too, built from the same counts, so the cheapest refutations in the system
instruct the repair for the first time and at no extra cost.

It also composes the failure record from the directive, and **this is the mechanism that
makes the whole task work today**. The ladder is entered with this record
(`recovery/refuted-result/attempt.ts`), and of everything the record carries the recovery
context sends the model exactly two fields. Its own comment says why:

```ts
// runtime/recovery/context.ts:427
// one. `message` is deliberately not carried: the record's own `expected`
// and `actual` are contractually short, and the prose is not.
      expected: failure.expected,
      actual: failure.actual
```

So `expected` now says what was wanted **and what would produce it** —
`"A result that answers the request: <the judge's expected> To fix: <fix lines> <advice>"` —
and `actual` says the observation plus what the check observed. Both bounded to the
record's own 1,024 characters before the record is built. A refutation that does not
instruct there does not instruct at all.

**`verdict.ts`** — builds the directive for a `does_not_answer` and nothing else. An
`unsure` carries none, because nobody judged the result wrong and `attempt.ts` already
refuses to build a repair from one ("a repair planned from it would be a change to a Flow
on evidence that nothing was wrong with it"). Verdict meanings, codes and `reason` strings
are untouched.

**`verify.ts`** — passes the reply's `summary` as `summaryText`. **`agreement.ts`** — the
first call's directive stands for two agreeing refutations, with a comment saying why two
readings are not spliced. **`run-outcome.ts`** — records `repair` on the run through
`automationStudioRecordedResultRepair`, which carries `findings`, `fix` and `withheld` and
**not** `judgement`: the run's metadata stays Core's own words, which is the rule
`verdict.ts`'s header states, while the model's screened reading travels only inside the
failure record, where a sentence written outside Core has always travelled.

### One existing assertion was deliberately flipped

`tests/verdict.test.ts` held `it("never records the model's own prose")` over the whole
verification object. That was right while a refutation was a verdict and a code; it is
incompatible with the user's instruction. It is replaced by two tests that split the rule
where it actually belongs: the judgement's reading reaches the failure record (so a repair
can act on it), and the **run record** carries no model prose — asserted in
`tests/run-outcome.test.ts` against the real metadata. An `unsure` still carries no prose
anywhere, so the old rule survives intact wherever it still applies.

### Cost, measured

For a realistic five-step web Flow (navigate, type, click, extract-list with one `where`
condition, end) and a four-row sample, the `resultSummary` went from **710 to 1,262 bytes
— +552 bytes, about 138 input tokens** at four bytes per token. A verification makes one or
two calls, so **+138 to +276 input tokens per judged run**. Against the 441,531 input
tokens a live build spent, that is 0.03–0.06%.

The worst case is unchanged: the summary's own ceiling was 4,000 bytes and still is, and
the parameters take only what the rest of the summary left. **Output tokens: zero extra.
Provider calls: zero extra.** Nothing new is asked of the model, so there is nothing new to
generate.

What that 552 bytes buys, from the same measurement: the judge now sees
`n2 web.output.type` with `text: null, parametersWithheld: ["text", "selector"]` (the
person's search term and the selector withheld, the *shape* carried) and
`n4 web.extract.list` with `maxRows: 250, where: { count: 1, items: [{ field: "role",
matches: "admin" }] }` — which is exactly the evidence needed to say whether the clause the
request asked for reached a parameter.

## 3. Commands run and observed results

From `F:\!FluxIQ\packages\fluxiq`:

- `npx tsc --noEmit` → **clean of anything in my files, on every run.** It moved under me
  three times because another worker is building `runtime/llm/provider-retry/` right now: one
  run was clean; one reported six errors in `runtime/llm/harness/run.ts` (`providerRetry` does
  not exist on `AutomationStudioLlmHarnessInput`, `providerRetryDiagnostics` not found), gone
  on the next run; the last reported two in
  `runtime/llm/provider-retry/tests/call.test.ts` (`Object is possibly 'undefined'`) in a
  directory that did not exist when I started. Filtering every run for `result-verification`
  returned nothing.
- `npx vitest run src/programs/automation-studio/runtime/result-verification` →
  **8 files, 119 passed, 0 failed.** (Brief's figure to beat: 87. New: `repair-directive.test.ts`
  17, and additions to `verdict` 13, `result-summary` 17, `core-observation` 11, `run-outcome` 43.)
- `npx vitest run src/programs/automation-studio/runtime/tests` →
  **74 files, 482 passed, 4 failed.** The brief's figure was 493; the tree collects 486 now,
  and did so before I touched anything — another worker's `flow-bootstrap/generation-failure`
  split moved tests. My baseline measurement of this same command before any edit was
  **482 passed, 4 failed**: identical.
  - `service-flows/tests/representation.test.ts`, 2 tests, "seeds a rerun from the failed
    attempt…" — `detail?.metadata?.runtimePatchAttempts` is `undefined`. **Proven not mine:**
    I copied my directory aside, `git checkout`ed `result-verification` to HEAD, deleted my
    two new files, re-ran that suite alone and got the same two failures; then restored.
    The path runs through `executor/recovery-ladder.ts`, `recovery/context.ts` and
    `service.ts`, all modified by other workers.
  - `deepseek-bootstrap-exploration.test.ts` "asks again after a decision that runs past its
    deadline" and, under load, `service-adaptation/tests/modes.test.ts` and
    `service-flows/tests/instruction-readiness.test.ts` — deadline-timing tests. `modes` and
    `instruction-readiness` **passed when re-run alone** (2 files, 5 tests, all passed). The
    `deepseek-bootstrap-exploration` one passed alone at 14:2x and failed alone at 14:5x,
    while `llm/harness/run.ts` was being rewritten around it.

From `F:\!FluxIQ`:

- `node scripts/structure-audit.mjs` → **1 violation**, `[directory-files]
  runtime/llm/tests/: 26 source files exceeds the 25-file limit` — not mine. **Nothing in my
  files.** Two advisory `warn` lines on `result-verification/run-outcome.ts` (604 lines) and
  `tests/run-outcome.test.ts` (798): both files were already past the 400-line advisory
  before this task (591 and ~737) and both are under the 800 hard limit. I kept the test
  file under the limit by merging two of my new tests into one, and moved the run-record
  projection out of `run-outcome.ts` into `repair-directive.ts`, which shrank the coordinator
  from 618 to 604.
  - The audit was **not** passing outright before my work: at my first run it reported 7
    violations across 4 rules, including `[imports] executor/contracts.ts` and the `llm/tests/`
    count. Both belong to other workers; the `executor` one was fixed by its owner during
    my task.

Tests added, one per thing the brief asked for:

- a refutation carrying instructions the repair can act on — `run-outcome.test.ts`
  "records Core's fix on the run and hands the judgement's own reading to the wrong-answer
  route" (asserts `failedTraceAttempt.failure.expected` contains the judge's `expected`,
  `"To fix:"`, and the advice), plus nine finding-by-finding tests in
  `repair-directive.test.ts`;
- a terse judgement still producing a valid refutation — `verdict.test.ts` "stands on
  Core's own findings when the judgement says nothing beyond no";
- a malformed suggestion not costing the verdict — `verdict.test.ts` "does not let a
  malformed suggestion cost the verdict" (wrong type, whitespace, 900-character field) and
  "drops a credential-shaped suggestion, keeps the verdict, and says something was
  withheld", plus `repair-directive.test.ts` "ignores anything that is not a usable string
  without refusing the directive";
- the screening rules holding on everything newly shown — `result-summary.test.ts` "leaves
  a step bare when its parameters are not what the Flow authored, and names the paths"
  (denied key and the person's typed text both out, paths named), the URL-origin case with
  its dotted path, `run-outcome.test.ts` "carries each step's authored parameters to the
  judgement, screened" (asserts the request's serialized context contains neither
  `hunter2` nor `team=ops`), and the locator/credential cases above.

## 4. Not verified

- **No live run.** Nothing here was exercised against a real provider, so I have not seen a
  real DeepSeek judgement produce a directive, and I have not seen a repair act on one. The
  claim that the repair *can* act on it rests on reading `recovery/context.ts:427-452` and
  on the test that inspects the failure record the ladder is entered with — not on a repair
  actually reading it.
- **The prompt is unchanged**, so the model is not yet *encouraged* to be explicit. What it
  writes into `expected`, `observed` and `changed` today is what the directive carries; the
  quality of the advice is therefore whatever the existing instruction already elicits.
- **The cost figure is one measured scenario**, not a distribution. A Flow with forty
  parameter-heavy steps will hit the 4,000-byte ceiling and shed parameters from its tail;
  I asserted that it stays inside the ceiling and that the row sample survives, but I have
  not measured how often a real Flow loses parameters that way.
- **Core was not built** (the brief forbade it), so nothing downstream of a Core build —
  the web-extension repository's checks among them — has seen these types.
- **Two `runtime/tests` failures and one flaky deadline test remain**, attributed to other
  workers above but not fixed, and one of them (`deepseek-bootstrap-exploration`) I could
  not get a stable reading on because its dependencies were changing under me.

## 5. Open questions and contradictions found

### (a) Requirement 4 could not be built where it belongs — exact text supplied

The judge's own instruction lives in
`packages/fluxiq/src/programs/automation-studio/runtime/llm/diagnosis-instructions.ts:27`
(`AUTOMATION_STUDIO_RESULT_VERIFICATION_INSTRUCTION`), which is inside `runtime/llm/` and
so forbidden to me. The brief anticipated this ("the prompt … wherever that lives under
`result-verification/`"); it does not. I considered and rejected the two routes that would
have reached the prompt from my own files: appending a Core-authored entry to
`request.instructions` would make Core's ask indistinguishable from the person's and would
pollute `instructionIds`, and putting prose in the request's `metadata` is exactly the
unvalidated channel `structured-diagnosis.ts` closed.

Append this to that constant, and nothing else needs to change — the fields it names are
the ones the directive already reads:

> When you answer no, say in `observed` which rows or columns are wrong, and in `changed`
> what to change to fix it: name the clause of the request the result does not satisfy, and
> the step whose parameters would have to change, by its `nodeId` in
> `resultSummary.flowShape`. A bare verdict is not the job — the repair that follows is
> given what you write here and nothing else. If you have no suggestion, answer no without
> one rather than inventing one: a refusal with no advice is still a valid refusal and
> nothing fails for it.

The last sentence is load-bearing and is already honoured by the code: a terse judgement
produces a valid refutation, asserted in `verdict.test.ts`.

### (b) Three caller widenings I did not make

1. **`llm/harness/context-packet.ts:252`** — add `"loop_verification"` to the gate that
   carries `conversation`, the way line 126 already lists it for `resultSummary`. The
   conversation is, in that file's own words, "the channel the person says what they meant
   in, and a repair that cannot read it repairs blind" — and the judge that decides whether
   the person got what they meant cannot read it. This is the largest remaining gap and it
   is one set membership.
2. **`llm/harness/context-packet.ts:433` (`compactRecentActionForLlm`)** — it drops
   `attempt.metadata.recordCount`, which `refuted-result/attempt.ts` relies on to find the
   node the result came out of and which `repair-context/step-parameters.ts` carries to the
   repair. So the judge cannot see that the extract step stored 240 rows and the step after
   it stored 240 too — i.e. that the narrowing step did nothing. Adding `recordCount` to
   `RECENT_ACTION_FIELDS` and to `isAutomationStudioLlmRecentActionContext` would cost a few
   bytes per action.
3. **`recovery/refuted-result/attempt.ts`** — carry `outcome.repair` onto the attempt (and
   on into the recovery context as its own section) rather than only inside
   `expected`/`actual`. What I built is deliberately the route that works with no change
   outside my files, and it works, but the repair reads Core's fix lines as prose inside a
   sentence rather than as the structured list they are. A section named `repair_directive`
   carrying `findings` and `fix` would let the patch stage act on a code.

### (c) A contradiction worth recording

`verdict.ts`'s header said, before today, that "the model's `expected`, `observed` and
`changed` stay where every other diagnosis leaves them: unrecorded" — and the user's
instruction of 2026-09-26 requires the judgement's suggestions to reach the repair. Those
cannot both hold in full. I resolved it by splitting the rule rather than dropping it: the
**run record** carries Core's words only (unchanged in substance), and the **failure
record** carries the judgement's screened reading, which is what `locator-text.ts` was
written for — a domain's own `expected`/`actual` sentences reaching the model through
exactly that field, with exactly those screens. If the supervisor disagrees, the cheapest
alternative is (b)(3): a structured section carrying only Core's coded findings, and the
judge's prose discarded — which costs the one thing the user asked for by name, "possible
suggestions".

### (d) A person still cannot see the fix

`apps/web/src/features/automation-studio/runtime/RunDetailPanels.tsx:172` reads the
verification as a `Record<string, unknown>` by named field, so the new `repair` key is
ignored and nothing breaks — but a person looking at a refuted run is still shown only
"Refuted". Surfacing `resultVerification.repair.fix` there is a small, self-contained
follow-up outside my files.
