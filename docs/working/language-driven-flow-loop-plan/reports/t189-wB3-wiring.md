# t189-wB3: wire the decision history into the evidence loop, and make repeats caught and shown

R = `packages/fluxiq/src/programs/automation-studio/runtime` in Core worktree
`C:/Users/osrs_/FluxStuff/fxwork/t189/!FluxIQ` (branch `task/t189-decision-context`).

## Outcome

Done. All ten steps are implemented. The named suites and tsc pass, and the structure audit passes.
- llm: 73 files, 710 tests. This is the 72 files and 702 tests from before plus my new file of 8 tests.
- flow-bootstrap: 34 files, 691 tests, unchanged.
- recovery: 34 files, 456 tests, unchanged.

As instructed, I did not run or edit `recorded-windows.test.ts` or `recorded-runs.ts`.

## What changed and why

### Step 1: the recorder, recorded at every answer site

- **Context members.** `decision-handlers/types.ts` gains five members:
  - `history`: the recorder.
  - `draftRevision()`.
  - `lastAction`: `{callId, iteration}` of the newest call that ran an action.
  - `dryRunSeen`: `{ran, verdict?}`, filled by the gate callbacks in the loop.
  - `pageMovedReruns`: a Set used by step 6.
- **Where each row is recorded:**
  - **Initial look** (`evidence-loop.ts`): `look` at 0. A failed initial look is recorded as a `look` carrying its failure code, in `failed-call.ts`.
  - **Executed calls, reruns included** (`evidence-loop.ts`):
    - Recorded as `call` with the decision's signature, the `resultCode` (or "ok") and `changed`.
    - `changed` is "yes" only for an applied mutate. This is the same rule the old `call` summary used.
    - `refused: true` when the evidence is an object with `ok === false`.
    - `actionId` comes from `callRecord`. It is omitted when it equals the tool id.
    - A mutate call also sets `lastAction`.
  - **Failed calls** (`failed-call.ts`): recorded as `call_failed`, where the signature is taken from `{tool_call, toolId, input}`. When failures are observed, a failed mutate also sets `lastAction`, alongside the epoch bump it already had.
  - **Answered requests** (`decision-handlers/answered-request.ts`):
    - Recorded as `answered`.
    - `actionId` comes from the answering call's draft step. That step ran the same request, so it is the same node.
  - **Amendments** (`amendment.ts`):
    - Recorded as `amendment`. `applied` is the applied count plus 1 for a rerun.
    - `refusals` are `{step, reason, repeated}` from `amendmentMemory.refusals`. That call is now made once and its result is shared with the feedback. It was already the only call site and it is a no-op for an empty list, so behaviour is unchanged.
    - `withdrewChanged` holds the pre-edit positions of steps that meet all of these:
      - they were `kept` before the edit and are not kept after it;
      - they have `effect: "mutate"`;
      - they have `effectApplied: true`.
    - `undoneTo` is `sameDraftAs`, and `rerun` is the rerun step.
  - **Completions** (`completion.ts`):
    - Recorded as `completion`, with the loop's `draftRevision`, `accepted`, `issueCodes` and the check's `feedback`.
    - `dryRun` is taken from `dryRunSeen`, as follows:
      - The steps whose `replayed !== "replayed"` in the `core.dry_run` value the gate showed.
      - Otherwise `clean`, if `targetMoved` fired, meaning it replayed.
      - Otherwise `not_run`.
    - A completion that ended the loop (threw, cancelled, or hit the evidence limit) is not recorded.
  - **Unusable decisions** (the loop's `catch`): recorded as `unusable`, before `unusable()` can redirect.
  - **Redirects**: recorded as `redirect` with the note's `code`, inside the no-progress `show` callback, and only when the redirect is actually shown.

### Step 2: new `decision-context/shown.ts` (`automationStudioLlmDecisionContextShown`)

- It takes over the draft entry, `draftShown`, the beside-bytes arithmetic and the window call from the loop.
- It adds the history entry, capped at `min(4_000, floor(maxEvidenceContextBytes / 6))`. Its bytes count in the beside bytes the same way the draft's do.
- The order is `[...window, history, draft, budget]`.
- The budget entry is still built in the loop, because it depends on `remaining`.

### Step 3: `context-window.ts` now returns whole entries only

- These are removed because nothing else used them:
  - `historyEntry`, `historyLine`, `HISTORY_CODE`, `HISTORY_INSTRUCTION` and the old constant.
  - The `call` summary field.
  - The `AutomationStudioLlmEvidenceCallSummary` and `AutomationStudioLlmEvidenceRecord` types.
- Users now take `AutomationStudioLlmEvidenceEntry`.
- `AUTOMATION_STUDIO_LLM_EVIDENCE_HISTORY_TOOL_ID` is re-exported from `evidence-loop.ts` via `decision-context/`.
- `llm/index.ts` exports the decision-context barrel. Both paths resolve to the same binding, so there is no clash.

### Step 4: superseded notes leave the window

- New file `decision-context/supersede.ts` (`automationStudioLlmDecisionContextSupersede(evidence, ...toolIds)`).
- Before each push, earlier entries with the same tool id are removed:
  - `core.request_check` (answered handler)
  - `core.no_progress` (`show`)
  - `core.decision_check` (catch)
  - `core.amendment_check` (amendment handler)
  - `core.completion_check` (completion handler)
- At the start of each completion attempt, `core.dry_run` and `core.dry_run.page` are removed.
- Removing entries does not refund `accounting.evidenceBytes`. The backstop still counts everything that was gathered.

### Step 5: the answered note says what it repeats

- `evidence-loop/answered-request.ts` gains optional fields:
  - `timesAsked` and `askedAt`, from the recorder's repeat. As wB1 specified, this count includes the executed call.
  - `answeredAt`, from the answering `call` or `look` row.
  - `lastActionBefore`.
  - `pageUnchanged: true`.
- The instruction is now built rather than fixed:
  - When `lastActionBefore` is at or before `answeredAt`, it says "It was answered at iteration N and no action has run since."
  - Otherwise it says "No action has changed anything since it was answered." That case can only arise for a plain mutate tool, which is keyed on `mutationEpoch`.
  - When `pageUnchanged` is set, it adds "Core checked the page just now: it is unchanged."
  - When `timesAsked >= 2`, it adds "This is the Nth time you have asked it (askedAt); it will get this same answer until an action runs."
  - `not_offered` keeps its fixed text.
- I tightened the base sentences slightly ("the entry named by answeredByCallId, just before this one: ...") to keep the note small.

### Step 6: verify a look before answering it from memory

- New file `decision-handlers/answer-check.ts`, which returns `"run" | "unchanged" | "unverified" | "digest_failed"`.
- It acts only when all of these hold: `captureStateDigest` exists, the answering draft step has `effect: "observe"`, and that step has a `stateAfter`.
- It takes one fresh digest under the call id `core.answer_check.<iteration>`. That id is new each time, so the service hook treats it as a "before" and never pairs it with a step.
- The outcomes:
  - The digest equals the step's `stateAfter`: answered with `pageUnchanged`.
  - The digest differs, and this signature is not yet in `pageMovedReruns`: the request is run instead. `toolRequestSignature` already carries the epoch, so this is once per signature per epoch.
  - The digest throws or returns undefined: answered as before.
- I first wrote the throw path as `return undefined`. The structure audit's `failure-as-empty` rule failed it, so the throw path returns the named outcome `digest_failed`.
- The wrap-up (`not_offered`) is never checked.

### Step 7: the second answer from the same result redirects at once

- `no-progress.ts` `redirect(iteration, now?)`: with `now` set, the `redirectAt` threshold is skipped. `max` still bounds it.
- The answered handler passes `now` when at least two `answered` rows share this signature and this `answeredByCallId`. That means "answered from the same memory". A request re-run in a new epoch gets a new answering call id and starts again.

### Step 8: a repeated refused completion is marked

- When the recorder's repeat has `times >= 2`, the `core.completion_check` value gains `sameAsIteration` (the first iteration) and `timesSent`.
- Each key is added only when the check did not write it.
- The check and the dry run are still asked. A test asserts this.

### Step 9: the decision instruction sentence

- In `evidence-loop-decision.ts`, the sentence now reads: "An entry whose toolId starts with core. is Core's, not a tool result. The core.evidence_history entry is the record of all your decisions so far and what Core answered each; do not make again a decision it shows was refused or answered from memory. Every other core. entry is Core's answer to a recent decision: correct what it names, and when it names an earlier callId, use that entry instead of asking again."

### Step 10: docs

- `docs/architecture/automation-studio/llm-flow-bootstrap.md` gains one paragraph after the draft beside-entry paragraph. It covers the history entry, its rows, its cap and ladder, and the order.
- After the window paragraph it gains:
  - one sentence on whole entries only;
  - a paragraph on the supersede rule;
  - a paragraph on the answered note fields, digest verification, the early redirect and the repeated-completion marks.
- I regenerated with `node scripts/docs-reference.mjs`, which reported 2,668 public declarations. The committed reference was already stale at 2,530, so this diff also carries unrelated drift from earlier merged tasks.

### Existing tests changed, and why

- **`llm/tests/context-window.test.ts`**: the in-window history is gone.
  - The expectations of an `earlier_calls` entry, listed or unlisted calls, and the history's leading position became "no history entry in the window" plus the same whole-entry ids.
  - These are unchanged: the byte bound, the entry-count bound, the random-mix property, the newest-never-displaced rule, and the priority order.
- **`llm/tests/evidence-loop.test.ts`**, for the history entry's presence, the new note fields and superseded notes:
  - **Evidence equalities** gained the history entry at the end. This affects three tests: "runs allowlisted tools", "requires a successful mutation", and "is answered from the earlier result".
  - **"is answered from the earlier result" note**:
    - The note gained `timesAsked`, `askedAt` and `answeredAt`, and the test now also asserts the "no action has run since" and "2nd time" wording.
    - Its `noteBytes < 512` bound became `< 768`. The note is intentionally larger; the draft wording measured 554 bytes in a scratch sizing, and the shipped wording was not measured separately. The accounting equality beside it is unchanged.
  - **"goes past the old 64,000-byte limit"**: the newest page is at `at(-2)` and the history at `at(-1)`. The old 18 in-window lines became the history's 20 call rows, all with `changed: "no"`.
  - **Two window tests moved from a 2,048-byte context with 900-byte pages to the production 24,000 with 12,000-byte pages**, so that one page still scrolls out beside the history. The two tests are "brings the earlier result back into view" and "does not count bringing a result back...". The first test's expected ids now have the history last. The second test's `[0, 0, 1, 2]` expectation is unchanged and now reads the `core.request_check` entry rather than `at(-1)`. See the open question below for why the context changed.
  - **"runs a new request whose call id was already used"**: filters the history out before comparing ids and pages.
- **`llm/tests/evidence-loop-tool-failure.test.ts`**: the failure record is now `at(-3)`, because the history sits between it and the draft. Added an assertion that the history has the `look` and `call_failed` rows.
- **`llm/tests/unusable-decision.test.ts`** ("tells the model why"): the second decision's evidence gained the history entry with the `look` row and a `completion` row.
- **`llm/evidence-loop/tests/stall-guard.test.ts`**:
  - The `redirections()` helper now collects each decision's redirect across all decisions, by call id, and asserts that no decision shows more than one. Previously it read five redirects from the last decision, and superseding makes that impossible.
  - The test's own assertions are unchanged: five redirects, the first at `redirectAt` naming `inspect`, and a countdown of `[5,4,3,2,1]`.
- **`llm/harness-options/tests/registry.test.ts`**: the evidence equality gained the history entry, with both calls as rows.

### New test

`llm/decision-handlers/tests/decision-context-wiring.test.ts`, 8 tests:
- **Repeated refused completion**: only the newest `core.completion_check` is shown, and it carries `sameAsIteration: 1, timesSent: 2`. The check is still called, the history has completion rows at 1 and 2, and a key the check wrote itself is left alone.
- **Answered note fields**: `timesAsked`, `askedAt`, `answeredAt` and `lastActionBefore`, the wording, and the history row with `sameAs`.
- **Early redirect**: the redirect at the second answer, below `redirectAt`. The older note has left, the newest is the "3rd time", and the history lists the redirect.
- **Digest equal**: the answer carries `pageUnchanged`, and the check's call id is `core.answer_check.2`.
- **Digest always differs**: the request is run once and then answered unverified.
- **Digest throws**: answered unverified.
- **Amendment dropping an applied step**: `withdrewChanged: [1]`.

## Commands run and observed results

From `packages/fluxiq`, final runs after the last source edit:

- `bash .../heavy.sh "t189-wB3 llm" npx vitest run src/programs/automation-studio/runtime/llm --maxWorkers=2 --minWorkers=1 --exclude "**/recorded-windows.test.ts"` -> `Test Files 73 passed (73)`, `Tests 710 passed (710)`, 42.77 s.
  - The first run after wiring failed: `Test Files 5 failed | 67 passed (72)`, `Tests 12 failed | 690 passed (702)`. All 12 failures were the intended changes listed above.
- `bash .../heavy.sh "t189-wB3 flow-bootstrap" npx vitest run src/programs/automation-studio/runtime/flow-bootstrap --maxWorkers=2 --minWorkers=1` -> `Test Files 34 passed (34)`, `Tests 691 passed (691)`.
- `bash .../heavy.sh "t189-wB3 recovery" npx vitest run src/programs/automation-studio/runtime/recovery --maxWorkers=2 --minWorkers=1` -> `Test Files 34 passed (34)`, `Tests 456 passed (456)`.
- `bash .../heavy.sh "t189-wB3 tsc" npx tsc --noEmit -p tsconfig.json` -> no diagnostics, `exit=0`. This covers `recorded-runs.ts` and `recorded-windows.test.ts`, which still compile. Earlier runs showed only test-typing errors in my own test edits, which I fixed.
- From the Core root, `node scripts/structure-audit.mjs` -> `structure-audit: passed (198 warning(s), 355 baselined).` plus "1 baseline entries can be lowered". Those are the same counts wB1 and wB2 reported.
  - One intermediate run was `FAIL [failure-as-empty] decision-handlers/answer-check.ts:33`. I fixed it (step 6).
- Extra tests outside the named suites that read Core notes: `npx vitest run .../runtime/exploration-reduction .../runtime/tests/deepseek-bootstrap-exploration.test.ts .../runtime/tests/service-bootstrap` -> `Test Files 17 passed (17)`, `Tests 123 passed (123)`. This ran before the final answer-check rename, which does not change behaviour.
- `node scripts/docs-reference.mjs` -> "Wrote docs/reference/framework-reference.md and packages/fluxiq/docs/reference/framework-reference.md (2668 public declarations)."
- Constraints:
  - `evidence-loop.ts` has 657 lines.
  - The function opening (lines 168-171) and the `automationStudioLlmEvidenceUnusedCallId,` line (line 50) are unchanged.
  - Files per directory: `llm/` 21, `decision-context/` 12, `decision-handlers/` 7 (plus a new `tests/`), `evidence-loop/` 23 (no file added).
  - `service.ts`, `flow-bootstrap/**`, grant code and `progress-trace.ts` are untouched.

## Step 6: do two captures of an unchanged page digest equal?

- **Yes, by construction, from reading the code. I did not run it.**
- `webLlmStateDigest` (`domain/src/runtime/llm-evidence/state-digest.ts`) is FNV-1a plus the length over a projection of the sanitized packet:
  - It reads no clock, counter or capture-assigned id.
  - The projection omits these volatile fields: `loading`, `navigation`, `selectedText`, and `focused`, `recent` and `changed` on elements.
  - It also omits: `target` handles, every truncation or budget flag, and the look-alike marks.
  - It sorts element lines before hashing.
- The domain's own test `domain/src/runtime/llm-evidence/tests/state-digest.test.ts:30-31` digests the same snapshot twice and compares the results. I did not run that test.
- `captureStateDigest` in `tools.ts:350-385` takes a fresh, unretained capture and returns `undefined` only for `page_unreadable` when a start location is set. The core hook `service/flow-bootstrap-commands/state-digest.ts` passes `phase: "before"` for a new call id. The domain ignores `phase` when it hashes.
- The check's call id `core.answer_check.N` matches the domain's `boundedIdentifier` pattern `^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$`.
- **Caveats.**
  - Content that changes by itself changes the digest, and that is the point of the check. Examples: a timer, a rotating banner, a list that loads late.
  - Under an element budget, which elements are included depends on the packet's ranking. Between two captures with no action in between, that ranking should not move, but I have not measured it live.

## Not verified

- No Lab or browser run, as the brief requires. The digest check has not run against a real page, and nothing has been measured against the recorded runs. That is wC's job with `recorded-windows.test.ts`, which I excluded and did not update.
- Dry-run superseding and the completion row's `dryRun` refusal list are not covered by a dedicated test. Only the existing dry-run tests passing speaks to them.
- I did not run `pnpm check`, the full Core suite, or the web domain's tests.

## Open questions or contradictions found

- **Small contexts squeeze the moved result.**
  - At `maxEvidenceContextBytes: 2_048` the history's cap is 341 bytes. Every telling is larger than that, because the ladder instruction alone is 349 bytes. So the least form is sent at 576-737 bytes, over the cap, as wB1 designed.
  - With the answered note at about 573 bytes, a 920-byte answered page no longer fits beside them. I probed this: decision 4 was shown `[core.request_check.4, core.evidence_history]` without `call.1`. From the second answer on, the early redirect (708 bytes) also pushes the note out.
  - At the production 24,000 context, with a 4,000-byte cap, all of it fits. That is why I moved the two tests there instead of keeping 2,048.
  - If loops with contexts under about 4 KB matter, the supervisor may want the history dropped when the least form overshoots its cap. Another option is a shorter least-form instruction; that is wB1's module, which I did not touch.
- **"the second time" (step 5).** I read it as `timesAsked >= 2`, which counts the executed call. So the first answer from memory already says "2nd time". Step 7's "second time answered from memory" counts only `answered` rows.
- **`dryRun: "not_run"` for a draft already replayed clean.** When the gate skips a draft whose signature it already replayed clean, nothing moves the target. The row then says `not_run`, not `clean`, following the brief's literal "clean when it ran".
- **The initial look can never be verified.** Its draft step records no `stateBefore` or `stateAfter`; that code is unchanged. So an answer that comes from the initial look is always unverified.
- `evidence-loop/draft-shown.ts` shows as modified in the tree. That is the lead's t174 fix, not mine.
