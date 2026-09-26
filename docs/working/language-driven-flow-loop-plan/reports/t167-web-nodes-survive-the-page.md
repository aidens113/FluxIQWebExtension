# t167 — The web nodes survive an ordinary web page, by default

## Outcome

**Done for the browser half, with one hop deliberately not taken and named.**

Every action this extension runs now runs behind a default defence: a recoverable
page fault is waited out and the verb is run again, bounded to five seconds and
never past the command's own `timeoutMs`, with an account of what was absorbed on
the result. No verb has a line of its own for it, no parameter switches it on, and
a node the model wrote with the least parameters it could gets exactly what a
carefully written one gets.

Three further things came out of the audit's findings and are built:

- an unpaginated list read whose post-condition did not hold is now **read again
  in the page**, which is the fault eleven of roughly eighteen reportable live
  runs died on;
- a manifest-permission refusal has its own non-retryable code, so the fault that
  cost `run-muht9lpw-a39aa056` three attempts and then the run is refused once;
- all eighteen web output nodes can no longer throw out of their implementation,
  which is what used to end a session with no attempt row at all.

**The one thing not done, and why.** The recovery account cannot become a
*countable field* on a run's bundle from this repository alone. The declaration
lives in `domain/src/actions/types.ts`, the wire copy in
`domain/src/client/gateway-mapping.ts`, and the projection onto the node's
metadata in Core — three files this task does not own and one repository it must
not touch, and a field added in the extension alone is dropped by
`webAutomationActionResultPayload`, which copies the result field by field. So the
account travels today on the two texts that already reach Core on every result,
and section 7 below gives the exact diff.

---

## 1. What every web node did when the page did not cooperate

Established by reading all fifteen verbs in `apps/extension/src/content/actions/`
before changing anything. The pattern is one line, not fifteen.

| Verb | How it got its target | Target absent | Target arrives late | Target moved | Document replaced |
| --- | --- | --- | --- | --- | --- |
| `click` | `deps.resolveTarget(action)`, once, synchronously | TARGET_NOT_FOUND **immediately** | **fails at ~10 ms** | Level 2 scores it in the same instant; fails if not drawn | `page-identity.ts` relabels the failure PAGE_CHANGED |
| `type`, `clear`, `select`, `check`, `extract`, `upload` | same | same | same | same | same |
| `keypress` | same, when a target is named | same | same | same | same |
| `scroll` | same, inside `scrollToTarget` | same | same | same | same |
| `assert` | `resolveTarget` in a try/catch; absence is an answer | an answer, not a fault | its own poll covers it | covered | relabelled |
| `wait_for_selector`, `wait_for_text` | `waitForCondition`, polling | covered | covered | covered | relabelled |
| `extract_list` | `extractList`, which waits for the list | covered by the t148 wait | covered | — | relabelled |
| `capture_snapshot` | no target | — | — | — | — |

**The finding.** Nine of the fifteen verbs resolved their target exactly once, in
the same millisecond the command arrived, and failed outright if it was not there.
The three verbs that waited are the three whose *whole purpose* is waiting, plus
the list read. So the runtime was not defensive: it was defensive only where the
**model** had remembered to author a wait node in front of the action — which is
precisely the inversion the user's instruction rejects.

Two further shapes, both confirmed:

- **A read's rows were discarded by any fault in reading them.** The list reader's
  row loop had no `catch` at all. One recycled or detached element — what a
  virtualized list does to a read as a matter of course — threw out of
  `extractList`, the verb's catch reported `deps.failure`, and **every row already
  read was lost**. Total instead of partial, in the one node whose whole value is
  the rows.
- **A web node could end the session with no record.** All eighteen output-node
  implementations run through Core's `options.nativeNodeExecutor`, which sits
  outside the only try block in `node-execution.ts`. A throw there reached
  `service.ts`, which ends the session and rethrows: no attempt row, no ladder, no
  repair, no trace row naming the node.

---

## 2. The defence, and where it is

`apps/extension/src/content/action-runtime/recovery/` — six files, 522 lines, none
touching the DOM, so all of it runs in a Node test.

| File | What it decides |
| --- | --- |
| `fault.ts` | Which faults are absorbed and which are refused, and the mutation rule |
| `budget.ts` | What the defence may cost, in milliseconds |
| `attempt.ts` | The loop |
| `account.ts` | What was absorbed, in counts and closed words |
| `record.ts` | Putting the account on the result |
| `index.ts` | The barrel; `actions/execute.ts` is the only caller |

Wired at **one** seam: `executeContentAction` in `apps/extension/src/content/actions/execute.ts`.

```ts
const { result, account } = await runWithRecovery(action, startedAt, async () => {
  const startedOn = observePageIdentity();
  return reportPageChange(await routeContentAction(action, deps, startedAt), startedOn);
});
return recordRecovery(result, account);
```

That seam, rather than fifteen verbs, because:

- it is unconditional — a verb added tomorrow gets the defence with no line of
  its own, which is what "every single node, whether custom or core" requires;
- **a retry is a re-resolution.** The attempt is a closure over the dispatcher, so
  attempt two calls the verb afresh and the verb calls `resolveTarget` afresh
  against the document as it now is. A target that had not been drawn is found; a
  target that moved is re-scored from scratch; a stale element reference cannot
  survive, because no reference is carried between attempts. There is no separate
  "re-acquire the handle" path because this loop holds no handle;
- the page identity is observed **per attempt**, so attempt two is judged against
  the page it actually ran on rather than the one the command arrived at.

---

## 3. Absorb the transient, refuse the deterministic — where the line is

**The first gate is this repository's own declaration, not a new opinion.** Every
code in the closed set is already bound to a `retryable` flag in
`domain/src/runtime/failure/codes.ts`, answering Core's own question: whether
retrying the same action unchanged can succeed without a person or a Flow edit.
Reading the flag rather than restating it means a code added to the set arrives
here with its answer already decided, and `tests/fault.test.ts` fails if a
retryable code has no fault word.

Retryable, so absorbed: `web.target.not_found`,
`web.validation.output_not_observed`, `web.page.changed`, `web.action.timeout`,
`web.transport.transient`, `web.action.failed`.

Not retryable, so refused at once with no waiting: an ambiguous target, a rejected
target, a state mismatch, an unexpected navigation, an auth wall, a person's
intervention, a blocking dialog, an unsupported or unimplemented type, an invalid
parameter, a browser-permission refusal, and UNKNOWN. Retrying any of those only
spends time, and `tests/fault.test.ts` asserts every one of them for every verb.

**The second gate is the mutation rule, and it is the one that needed writing.** A
retryable code says a retry *can* work; it does not say a retry is *safe*.

- A verb that **cannot move the page by running again** absorbs all six faults.
- A verb that **can** absorbs only `target_absent` — the one fault decided before
  anything was dispatched, because `resolve-target.ts` throws before a verb
  touches the page at all. The other five are decided at or after the point a
  mutating verb has already acted.

**The classification is per command, not per type, and that is the row that
matters.** `web.dom.extract_list` only reads — but it reads by *following
pagination*, and a second attempt at a read that already pressed "next" resumes
from whichever page the first one reached, answering with rows duplicated or rows
skipped. So the question asked is not "does this verb read?" but "can running it
again move the page?", and the command answers it: a request naming no `paginate`
is a pure read and absorbs everything; one naming pagination absorbs only
`target_absent`. Read-only by type: `capture_snapshot`, `extract`, `assert`,
`wait_for_selector`, `wait_for_text`. Everything else, and a type this build does
not know, is treated as moving the page — the safe direction.

**A fetch a node makes.** There is none. `grep` for `fetch(` and
`XMLHttpRequest` across `apps/extension/src/content/`,
`domain/src/output-nodes/` and `domain/src/runtime/` returns nothing: no web node
in this repository makes an HTTP request of its own. The 429/5xx retry the brief
names is the provider call, which is Core's (`t163` fix 2) — this repository has
nothing on that path to make defensive.

---

## 4. A mutating action does not act twice

Stated per verb, because this is the guarantee a defence can most expensively
break.

| Verb | Retried on | Never retried on | Why it is safe |
| --- | --- | --- | --- |
| `click` | `target_absent` | the other five | The gesture is dispatched only after the target resolved and the actionability gate passed. A `target_absent` fault means no pointer event was ever sent. An `output_not_observed` after a click means the click landed and the post-condition did not appear — the page may well have taken the order — so it ends the attempt honestly. |
| `type`, `clear`, `select`, `check`, `keypress` | `target_absent` | the other five | Same: the value, the key and the state change all follow resolution. |
| `upload` | `target_absent` | the other five | A `DataTransfer` is built only after the input resolved. |
| `dialog` | `target_absent` | the other five | Arming an answer twice would answer the *next* dialog too. |
| `scroll` | `target_absent` | the other five | `by`-delta scrolling is not idempotent: twice is twice as far. |
| `extract_list`, paginated | `target_absent` | the other five | Pressing "next" again lands on a different page. |
| `extract_list`, unpaginated | all six | — | Re-reading a page cannot move it. |
| `extract`, `assert`, `capture_snapshot`, `wait_for_selector`, `wait_for_text` | all six | — | Reading twice costs time and nothing else. |

`recovery/tests/attempt.test.ts` drives a click into all four post-gesture faults
and asserts the page was acted on **once** in every case.

---

## 5. A partial answer is never turned into no answer

Two changes, one per shape found.

**The list read's rows survive a fault in reading them.**
`apps/extension/src/content/extraction/list-reader.ts` now wraps the per-item body
and the page advance:

- an item that throws is **skipped and counted**, and remembered so a re-queried
  document does not fault on it repeatedly;
- a `advancePage` that throws **ends the read with the pages it has**;
- both are reported: the outcome gains `itemFaults` and `pageFault`, and
  `actions/extract-list.ts` puts them in the read's own phrase — *"4 items could
  not be read and were skipped, and the move to the next page failed, so the read
  ends with the pages it has"*.

Neither overloads `truncated` or `timedOut`. No cap was reached and no time ran
out, so writing either would make a count a reader groups by say something the
read did not do.

**Already right, and confirmed rather than changed:**

- a timed-out list read already carries its records:
  `actions/extract-list.ts` passes `evidence` with `extracted: outcome.records` to
  `deps.timedOut`, and `action-runtime/results.ts`'s `buildResult` copies
  `extracted` and `extraction` onto the result **whatever the status**;
- the `required`-field default now reports a stated gap rather than failing forty
  good rows (fixed before this task; the audit confirmed it from source);
- the extraction wait is a 10 000 ms render window (likewise). This task composes
  with it and does not re-litigate it: a verb that spent the command's `timeoutMs`
  has no budget left, so the first retry is refused on the elapsed check. That is
  also what stops the two wait verbs being doubled, and why nothing in
  `budget.ts` needs to know which verbs those are.

A read that threw **before it had anything** is still a failure, because there is
no partial answer to give — asserted, so the change cannot drift into hiding a
total failure.

---

## 6. The bound

| Quantity | Value |
| --- | --- |
| Retries, waiting for a target the page has not drawn | 4, at 250 / 500 / 1000 / 2000 ms |
| Retries, any other transient fault | 2, at 250 / 500 ms |
| Deliberate waiting, worst case | **3 750 ms** (target) / **750 ms** (blip) |
| Whole-defence budget, measured from the command's start | **5 000 ms** |
| **Worst-case added wall clock** | **≈ 5 s, plus one further attempt of the verb** |
| Added wall clock when the command's `timeoutMs` is already spent | **0** |

Two ladders because the two classes are not waiting for the same thing. Waiting
for a target is waiting for the *page*, and the page's own measured timings set the
number: the list reads that failed on 2026-09-25 gave up at 2.0–2.6 s against
content that arrived at 4.6 s, so a defence that stops before the evidence says
the page arrives is not a defence. Every other transient fault is a blip — a
navigation race, a detached node, a browser API that threw once — which either
clears at once or is not going to, and 3.75 s spent on a frame that has already
gone is 3.75 s a live run does not get back.

The budget is measured from the command's start, not from the retry decision, so
four attempts cost one budget rather than four. A wait is *clipped* to what is
left rather than refused, so a command with 200 ms left still gets one short
attempt: too much rather than nothing.

Measured cost to the test suite: **62.3 s → 67.5 s**, all of it real backoff in
rows that drive verbs into transient faults through the production path.

---

## 7. Recording what was absorbed — and the hop not taken

`RecoveryAccount` is `{ attempts, absorbed, waitedMs, outcome }`: a count, one
closed word per absorbed fault in order, a duration, and one of `clean`,
`recovered`, `exhausted`. Every value is the loop's own arithmetic, so there is
nothing on it a page could have written and nothing that needs redacting — the
same discipline `domain/src/actions/extraction/summary.ts` holds the read's
account to, and the reason that account can travel for any element.

It reaches Core today on the two texts every result already carries:

- a **recovered success** gains a clause on its validation's `actual` — *"…; the
  execution recovered on attempt 2 after absorbing target_absent, waiting 250 ms"*;
- an **exhausted failure** gains the same clause on the failure record's `actual`,
  with the record rebuilt through `webAutomationFailureRecord` so the code, the
  category, the retryable flag and the stage stay the table's. A record that no
  longer parses would lose the failure rather than annotate it, so the test parses
  the annotated record;
- a **clean** execution is not annotated at all. "Nothing went wrong" on every
  result would bury the sentences that matter.

`click.ts` already writes its in-place effect into a validation's `actual` this
way, so this is the file's own idiom rather than a new channel.

**What it is not, yet: countable.** A scan over a run's bundles cannot tally a
sentence — the lesson t143 cost a day to learn and t153 answered by declaring
`listWait` as a field. Making this one countable is four lines in three files
this task does not own, plus Core's projection:

1. `domain/src/actions/types.ts` — `recovery?: WebAutomationRecoveryAccount | undefined;`
   on `WebAutomationActionResult`, and a `recovery.ts` beside `extraction/summary.ts`
   copying it field by field under the same rule (unreadable drops it).
2. `apps/extension/src/shared/protocol.ts` — nothing, if the type is taken from
   the domain as the rest of the result is.
3. `domain/src/client/gateway-mapping.ts` — one line in
   `webAutomationActionResultPayload`: `recovery: webAutomationRecoveryAccountValue(result.recovery),`.
4. Core — `runtime/service/summaries/` projects it onto the node's metadata beside
   `extraction`, exactly as t158 did for `listWait`.

**This must not be done by adding a key to the evidence execution result.** Core
reads that against `exactKeys`, and one key too many is not a field dropped but
**the whole call refused** as `llm_evidence_loop.tool_result_invalid` — every node
run of every live build recorded as a failure that never happened
(`WEB_LLM_EVIDENCE_RESULT_KEYS_CORE_READS`, and t155's report). Nothing here
widens it.

---

## 8. The audit's finding 1 — the verdict from this side

**Core's gate is wrong and this repository's table is right. Do not change the
table to get past the gate.**

`web.validation.output_not_observed` is declared `retryable: true` at stage
`verification` (`domain/src/runtime/failure/codes.ts`). Core's
`automationStudioAttemptIsRetryable` discards the whole `verification` stage
(`retry-policy.ts:90`). Both files carry comments claiming a deliberate reading,
and the audit is right that one must be wrong. It is Core's.

- The **stage** is accurate. The stage vocabulary in this table's own comment says
  `verification` means "while checking a post-condition or an authored assertion",
  and that is exactly where this code is decided.
- The **retryable flag** is accurate. It answers Core's question — can retrying
  the same action unchanged succeed without a person or a Flow edit — and for a
  read the answer is plainly yes: a page that had not finished drawing answers
  differently next time.
- **Core is asking the wrong field.** `retry-policy.ts` uses the stage as a proxy
  for side-effect safety. The stage does not carry side-effect safety; a read and
  a click both fail their post-conditions at stage `verification`, and only one of
  them is unsafe to repeat. The audit's own fix is right: test the node's
  side-effect class, for which `sideEffectClassForNode` already exists.

**Why the tempting fix here is a trap.** Moving this code's stage to `execution`
would let it past the gate today and would make the field mean "what Core will
retry" instead of "where this was decided" — after which nothing can ask the
original question again, and the next reader of the table is misled about a code
whose stage was rewritten to satisfy a gate. I did not do it.

**And this side did not wait for Core.** The same fault, for a read, is now
absorbed in the browser before Core's gate is ever consulted — because the
side-effect question *can* be answered there, off the command's own `paginate`.
An unpaginated list read of a slow page is read again in the page and never
reaches the gate at all. That covers the measured case without either repository
lying about a stage.

**Exact Core change, for t165 or whoever holds `retry-policy.ts`:** at
`retry-policy.ts:90`, admit a `verification`-stage failure to the retry rung when
the node's side-effect class is `"none"` (`sideEffectClassForNode`,
`node-execution.ts:308`), keeping the wholesale exclusion for every other class.
Tests: `runtime/executor/tests/retry-policy.test.ts`,
`runtime/executor/tests/ladder-run.test.ts`.

---

## 9. The audit's finding 2 — a refusal that burns three attempts

`browserActionFailure` (`apps/extension/src/runtime/action-runner.ts`) mapped
**every** worker-side throw to `web.action.failed`, which the table declares
retryable. `test-runs/run-muht9lpw-a39aa056` paid for it: *"Cannot access contents
of url \"about:blank\". Extension manifest must request permission to access this
host."* was retried at 250 ms and 1000 ms, fell to diagnosis and ended the run.
Nothing in the machinery misbehaved; the classifier had nothing better to say.

Two codes added to `domain/src/runtime/failure/codes.ts`:

| Code | Category | Retryable | Stage |
| --- | --- | --- | --- |
| `web.browser.permission_denied` | `blocked_by_capability_or_policy` | **false** | `dispatch` |
| `web.transport.transient` | `action_failed` | true | `execution` |

`domain/src/runtime/failure/browser-api.ts` (new) reads the browser's own message
into one of them, and is used by `classify.ts` on both its error path and its
message-only path, and by `browserActionFailure` in the worker.

**Reading a message is against this repository's grain, and the file says why it
is acceptable here.** The sentence is not a producer's — it is
`chrome.runtime.lastError.message`, written by the browser, stable because
extensions have parsed it for a decade, and it is the *only* thing the browser
gives. The alternative is not a structured answer; it is no answer. So the reading
is confined to one exported function and a short phrase list, and a miss returns
`undefined`, which keeps the caller's existing code — this reading can only ever
sharpen a classification, never produce a wrong refusal. A producer that already
classified itself is never re-read, which `browser-api.test.ts` asserts with an
AUTH_REQUIRED record whose `actual` contains the words "permission denied".

The new refusal is non-retryable, so my own loop refuses it automatically through
the table — which `fault.test.ts` asserts by name, since the whole point of giving
it a code is that it is not retried.

---

## 10. The audit's finding 3 — a node that cannot throw

`domain/src/output-nodes/native-runtime.ts`'s implementation body is now inside a
try/catch that returns a failed `AutomationNodeExecutionResult` carrying
`output_node.implementation_threw` (`graph_validation_or_unknown_node`, not
retryable, stage `dispatch`), with no effects and the thrown message in `actual`.

Not retryable and stage `dispatch` because nothing was dispatched: the node's own
parameters could not be turned into a command, which is a fault in the Flow rather
than in the page, and the same parameters will not parse differently next time.

This is the half that does not depend on Core. Core gaining the guard around
`nativeNodeExecutor`, `dispatchAutomationStudioEffects` and `compositeExecutor`
is still needed and is t165's — a fault that becomes a structured failure record
is a fault the runtime can act on, and a fault that escapes as an exception is one
nobody can, so this makes sure the web nodes produce the former.

Both rows in `tests/native-runtime.test.ts` provoke the throw through a getter on
the context's own parameters, which is what a real fault looks like at that point.

---

## 11. Commands run and observed results

| Command | Before | After |
| --- | --- | --- |
| `pnpm --filter @fluxiq-web-extension/domain test` | `# tests 837`, `# pass 837`, `# fail 0`, exit 0 | `# tests 847`, `# pass 847`, `# fail 0`, exit 0 |
| `pnpm --filter @fluxiq-web-extension/extension test` | `# tests 791`, `# pass 791`, `# fail 0`, exit 0, `duration_ms 62337` | `# tests 830`, `# pass 830`, `# fail 0`, exit 0, `duration_ms 67461` |
| `pnpm --filter @fluxiq-web-extension/domain check` | — | passed, no output |
| `pnpm --filter @fluxiq-web-extension/extension check` | — | passed, no output |
| `pnpm --filter @fluxiq-web-extension/extension build` | — | **succeeded** — `dist/chrome`, `dist/firefox`, `dist/e2e-chromium` written; `build/popup/index.js 206.9kb`, `build/sidepanel/index.js 206.9kb`, `build/page-world/index.js 4.0kb` |
| `node scripts/structure-audit.mjs` | — | **passed (107 warnings, 121 baselined)** |

**+39 extension tests, +10 domain tests, one test file's expectation changed.**

**Structure audit.** Passed. No finding names any file this task created. Every
finding on a file this task *edited* was already red before it: `list-reader.ts`
(524 → 573 lines) and `actions/tests/extract-list.test.ts` were both already past
the 400-line advisory threshold, as were
`apps/extension/src/content/action-runtime/` and `.../actions/` on the 15-file
directory threshold. The new `recovery/` directory is six files, the largest 140
lines. `pnpm structure:baseline` was **not** run.

**Two things observed that were not mine.**

1. The extension suite failed **once**, on the first baseline run, with
   `# pass 581`, `# fail 0` and then
   `Error: A resource generated asynchronous activity after the test ended ...
   "TypeError: document.addEventListener is not a function"`, exit 1. Re-running
   unchanged gave 791 passing and exit 0. A flaky async leak in the suite,
   present before this task.
2. A mid-task domain run showed two failures in
   `domain/src/runtime/llm-evidence/tests/press.test.ts` —
   *"with no permission check to ask, a declared consequence is refused rather
   than taken"* expecting `web.action.rejected.permission_required` and getting
   `web.action.succeeded`, and *"a refusal with no run behind it to ask…"*. Those
   are the permission-gate removal another worker is doing in the same checkout
   (`press.ts` had been written 14 minutes earlier and `permission.ts` and
   `press.test.ts` were both modified). They cleared on the next run without any
   action from me. I did not touch that machinery.

---

## 12. Files changed

**New**

- `apps/extension/src/content/action-runtime/recovery/{fault,budget,attempt,account,record,index}.ts`
- `apps/extension/src/content/action-runtime/recovery/tests/{fault,budget,attempt,record}.test.ts`
- `domain/src/runtime/failure/browser-api.ts`
- `domain/src/runtime/failure/tests/browser-api.test.ts`

**Edited**

- `apps/extension/src/content/actions/execute.ts` — the one wiring point
- `apps/extension/src/content/extraction/list-reader.ts` — item and page faults absorbed
- `apps/extension/src/content/actions/extract-list.ts` — the faults named in the read's phrase
- `apps/extension/src/content/actions/tests/{execute,extract-list}.test.ts`
- `apps/extension/src/runtime/action-runner.ts` — `browserActionFailure` classifies
- `domain/src/runtime/failure/{codes,classify,index}.ts`
- `domain/src/runtime/failure/tests/codes.test.ts` — the pinned vocabulary table
- `domain/src/output-nodes/native-runtime.ts` — the implementation cannot throw
- `domain/src/output-nodes/tests/native-runtime.test.ts`

Nothing under `F:\!FluxIQ` was touched. Nothing under `packages/` was touched.
`domain/src/runtime/llm-evidence/` was not touched. No commit was made.

---

## Not verified

- **No live browser run.** Every claim here is from Node unit tests with the page
  injected as dependencies, plus type-checking and a successful build. The defence
  is in the content bundle a live run loads, and the numbers it will actually pay
  against a real slow page are unmeasured. The e2e Playwright specs under
  `apps/extension/e2e/content/` were not run.
- **The list reader's own catch is proven at the verb's boundary, not in the
  page.** `list-reader.ts` needs a real `document`, so the two new absorption
  paths are covered by type-checking and by the verb-level contract test that
  asserts a faulted outcome answers with its rows and names what it skipped. A
  fixture proving the DOM throw itself belongs in
  `e2e/content/tests/extraction/`.
- **The browser-message phrase lists are from the browsers' documented wordings
  and the one message in `run-muht9lpw-a39aa056`**, not from a live reproduction
  of each. A wording no phrase matches keeps the old `web.action.failed`
  behaviour, so a miss is a missed sharpening rather than a regression.
- **Whether the audit's "11 of ~18 runs" is fully covered by the browser-side
  absorption.** It is covered for an unpaginated read. A paginated read that fails
  its post-condition still needs Core's gate fixed (section 8).
- **`pnpm check`, `pnpm test` and `pnpm build` were not run whole**, as the brief
  instructed, because other workers were active in both repositories.

## Open questions or contradictions found

1. **The `paginate` test is structural, not behavioural.** A paginated read that
   failed on its *first* page never pressed anything and would be perfectly safe
   to retry, but this refuses it. The conservative answer costs a recoverable
   read; the alternative needs the reader to report whether it advanced, which is
   a member on the outcome and another wire hop. Worth doing if the live evidence
   shows paginated first-page reads failing.
2. **`web.transport.transient` has a fault word in the recovery loop that the loop
   will never use**, because that code is produced in the background worker, not
   in the content script. It is mapped because the totality test requires every
   retryable code to have a word — which is the right pressure — but a reader of
   `fault.ts` should know the mapping is for completeness rather than for a path.
3. **`ACTION_FAILED` covers both "the verb threw" and "the worker threw", and only
   the second now gets sharpened.** A DOM exception inside a verb still lands on
   `web.action.failed`. Giving those their own codes would tell a repair whether
   to look at the page or the extension, and is not done here.
4. **The recovery account and the extraction read's account will want merging.**
   Both describe what one command survived, and they are two shapes reaching Core
   two ways. If section 7's wire hop is taken, the right move may be one
   `recovery` member that the read's own `itemFaults`/`pageFault` fold into,
   rather than a second parallel account.
