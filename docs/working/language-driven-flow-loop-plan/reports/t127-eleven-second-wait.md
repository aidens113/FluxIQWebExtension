# t127 — the 11.04-second wait in the build loop

## Outcome

Found, named and removed. The 11.04 s is `web.dom.extract_list` waiting out the
whole of its command deadline for a list that was never going to appear, then
reading the page anyway and reporting `succeeded`. The wait is real and stays;
what it lacked was a stopping rule, and it now has one.

The two ~15.5 s decision gaps are **not** the same fixed wait. They are each one
provider decision plus one whole dry run of the draft, and the same extraction
sits inside them. Detail in *The two 15.5-second gaps* below.

## The exact constant and call path

**Constant:** `RENDER_WINDOW_MS = 10_000` in
`apps/extension/src/content/extraction/page-render.ts`, in practice bound not by
itself but by the command's own deadline, `deadlineFor(action.timeoutMs)` with
`timeoutMs` defaulting to `10_000` (`domain/src/output-nodes/definitions.ts:180`
and `:204`, and written explicitly on every node the run authored).

**Call path:**

```
core.run_node  (Core reruns a draft step; no model attached)
  domain/src/runtime/llm-evidence/node-run/run.ts       -> gateway.executeAction("web.dom.extract_list")
  apps/extension/src/content/actions/extract-list.ts:48 -> extractList(request, { timeoutMs: action.timeoutMs })
  apps/extension/src/content/extraction/list-reader.ts  -> deadlineFor(timeoutMs)   // now + 10_000
                                                       -> awaitListPresent(item, 1, paginate === undefined, progress)
  apps/extension/src/content/extraction/page-render.ts  -> waitUntil(() => matchCount(item) >= 1,
                                                                     RENDER_WINDOW_MS, RENDER_POLL_MS, progress.deadline)
  apps/extension/src/content/extraction/list-wait.ts    -> poll every 50 ms until Date.now() >= deadline
```

`awaitListPresent` discards the wait's outcome — by design, "running out is not a
failure here: the read proceeds and reads what the page holds". So the read then
reads nothing, and `minItems: 0` (which the model wrote) makes nothing a passing
post-condition. The call returns `web.inspect.succeeded`, which is why the row
looks free and costs ten seconds.

## The arithmetic that makes it 11.04 s

- `deadlineFor(10_000)` is evaluated in the content script when the read starts.
- `waitUntil` takes `end = min(Date.now() + RENDER_WINDOW_MS, deadline)`. Both
  are 10_000 ms from moments a few milliseconds apart, so `end` is the command
  deadline and `commandEndsFirst` is true. The loop polls at
  `RENDER_POLL_MS = 50` and returns at the deadline: **10.00 s**, plus or minus
  50 ms.
- The rest is one gateway round trip for the command and one for the evidence
  snapshot Core takes after it. Measured in this same run:
  `core.decision_amend_draft` rows (provider only, no node) have a median gap of
  **3.11 s**; `core.run_node` rows that carry a provider call have a median of
  **3.73 s**. Node run plus snapshot is therefore about **0.6–1.0 s**, and an
  extraction's round trip carries records as well as a packet.
- **10.00 + ~1.04 = 11.04 s**, and it is uniform to the centisecond because it
  is a `Date.now()` deadline, not page work.

The same run's `5.63 s` rerun of the same tool is the control: an extraction that
found its list did not pay the ceiling. The `12.24 s` `action_timed_out` row is
the same 10 s reached down a different branch (`afterListChange`, below) plus the
extra snapshot the failure path takes in `run.ts` (`pageRefusal`).

## How it was pinned down, not guessed

The reruns carry no `nodeId` because a *successful* call deliberately publishes
none (`node-run/run.ts`), so the node had to be identified by elimination:

1. `web.inspect.succeeded` is only ever produced by a `safe` action
   (`domain/src/actions/safety.ts` via `effect.ts`): `wait_for_selector`,
   `wait_for_text`, `extract`, `capture_snapshot`, `assert`, `extract_list`.
2. These rows carry no provider `usage`, so they are Core's own reruns of a
   **draft step** (`evidence-loop.ts:712-735`). `capture_snapshot` never
   proposes, so it can never be in a draft and never be rerun.
3. The draft this build accrued holds exactly one safe node — its
   `web.output.dom-extract_list` (snapshot `authoredNodes`), and the row
   immediately before the six is that node failing `action_timed_out` **with**
   its `nodeId` published.
4. Within `extract_list`, a paginated request has exactly three waits the command
   deadline can bound. Two of them — `afterListChange` and `awaitPageRendered`,
   both in the `advancePage` path — can only end a read as `timed_out`, because
   `waitUntil` returns `"timed_out"` (never `"unchanged"`) whenever a `timeoutMs`
   was set, and `list-reader.ts` turns that into `timedOut: true`. Neither can
   produce a *successful* read. `awaitListPresent` is the only wait that can burn
   the deadline and still let the read succeed.

## The change

`apps/extension/src/content/extraction/page-render.ts` — the only source file
changed, plus its new test.

The wait exists for a real condition: the everything store swaps its real result
cards in over eight placeholders 700 ms after load
(`STORE_TIMINGS.resultsHydrate`), and before this wait existed a built Flow read
the placeholders and reported 0 records as clean. That condition is kept. What is
added is the point at which the condition becomes **decidable**:

> `querySelectorAll` can only start matching when a node is added or removed or
> an attribute changes. No CSS selector reads text. So a document that has
> finished loading and has had neither for `PAGE_STILL_MS` is a document whose
> answer is settled, and waiting out the rest of the ceiling cannot discover
> anything.

`documentStillness()` opens a `MutationObserver` on `document` with
`{ childList: true, subtree: true, attributes: true }` — deliberately **not**
`characterData`, which no selector can match on and which a clock or a live
counter would keep firing forever. `settled()` is true only when
`document.readyState === "complete"` **and** nothing has mutated for
`PAGE_STILL_MS = 2_000`. The clock starts when the wait starts, so the page
always gets 2 s of its own.

What this deliberately does **not** do:

- It does not shorten `RENDER_WINDOW_MS` or the command deadline. A page that is
  drawing, fetching into the DOM, spinning a skeleton or toggling a class is not
  still and pays exactly the ceiling it paid before.
- It does not touch the growth settle in the second half of `awaitListPresent`,
  which is a finer statement about the list itself.
- It does not touch `awaitPageRendered` or `afterListChange`. Both have the same
  shape, and `awaitPageRendered` already has its own early-out (pagination
  controls shown plus 2 s). Giving them the stillness rule would convert reads
  that currently report `timed_out` into reads that report fewer records as a
  success — a product-semantics change I could not validate without a live run.
  **Recommended as a separate, live-validated task**; it is where the 12.24 s
  row's cost lives.

`PAGE_STILL_MS` is set to 2 s, the same window `EMPTY_PAGE_SETTLE_MS` already
uses for the neighbouring "the page has drawn its furniture and still no record"
judgement. The only hydration delay measured anywhere in the corpus is 700 ms, so
the margin is 2.9 times. This constant is the one number a future measurement
should move; the risk it carries is a site that goes **completely silent** — no
DOM activity at all — for more than 2 s between load and its results.

## Expected effect on the measured run

Six reruns times (10.0 s to about 2.0 s) is roughly **48 s off a 216 s build**,
on the pessimistic assumption that every one of them was a page with nothing the
selector could name. Where a page is genuinely still drawing, nothing changes.

## The two 15.5-second gaps

They are not a fixed wait, and the same cause does not fully explain them.

Step 38 (`core.decision_unusable` / `llm_evidence_loop.dry_run_refused`, 15.47 s)
and step 39 (`core.decision_complete`, 15.59 s) each stamp **one provider
decision plus the whole dry-run gate that runs after it**
(`AS/runtime/llm/node-tools/dry-run-gate.ts` into `replay-draft.ts`): a reset
navigation followed by every proposed step of the draft, in order, each a
separate gateway call. The draft held seven steps, one of which is the same
`extract_list`. So: about 3 s of provider, 1–2 s of reset navigation, five mutate
steps at a few hundred milliseconds each, and the same ~10 s extraction inside.
The extraction wait is a large part of both, and this change shortens both, but
the residue is a genuine cost of replaying a seven-step draft twice and not a
deadline being exhausted.

`ACK_TIMEOUT_MS = 15_000` in `apps/extension/src/background/action-evidence.ts`
matches the number and was checked and ruled out: it is the Lab evidence
observer's per-boundary ack ceiling, it *rejects* on expiry (which would surface
as a failed action, and none appears), and it fires on every action boundary
rather than twice per build.

`NAVIGATION_END_TIMEOUT_MS` in `runtime/click-landing.ts` was already ruled out
by the brief; I did not re-check it.

## Commands run and observed results

```
$ cd apps/extension && EXTENSION_TEST_BUILD_LABEL=t127-wait node scripts/test-extension.mjs
1..767
# tests 767
# pass 767
# fail 0
# duration_ms 28735.5354
```

The six new rows in `src/content/extraction/tests/page-render.test.ts`, with the
durations that are the measurement:

```
ok 421 - a list that is already there is not waited for at all
  duration_ms: 0.3636
ok 422 - a page that is still working pays the ceiling, because nothing it has done says the list is not coming
  duration_ms: 3013.2053     (deadline 3 s — the ceiling is still paid in full)
ok 423 - a page that has stopped working ends the wait on the settle rather than on the command's deadline
  duration_ms: 2061.1467     (deadline 30 s — this is the 10 s that is gone)
ok 424 - a document that has not finished loading is never still, however quiet
  duration_ms: 3000.0859
ok 425 - a page with no observer to ask is never still either
  duration_ms: 3012.1061
ok 426 - a list that arrives while the page is still working is read the moment it does
  duration_ms: 447.7262      (list drawn at 400 ms)
```

Rows 424 and 425 are the pre-change code path: when stillness can never be
concluded, the wait pays the deadline exactly as it did before. That is the
"before" measurement, taken in the same run as the "after".

```
$ cd apps/extension && npx tsc -p tsconfig.json --noEmit
tsc exit=0

$ cd apps/extension && node scripts/check-extension.mjs
exit=0            (type-checks both projects and bundles every browser entry in memory)

$ node scripts/structure-audit.mjs
structure-audit: passed (104 warning(s), 121 baselined).
exit=0
```

The run's own timings were re-measured rather than taken from the brief:

```
$ node -e "<the brief's snippet>"
8.88s  core.run_node web.inspect.succeeded
12.24s core.run_node web.action.rejected.action_timed_out
11.04s core.run_node web.inspect.succeeded   (x4)
11.05s core.run_node web.inspect.succeeded   (x2)
15.47s core.decision_unusable llm_evidence_loop.dry_run_refused
15.59s core.decision_complete
```

and reproduced in `run-muher0en-508ddb69` (11.04 four times, plus 11.03, 12.04,
11.05, 11.04) and `run-muhd1vc7-0ec27a16` (11.03, 11.04).

## Not verified

- **No live run and no browser run.**
  `pnpm --filter @fluxiq-web-extension/extension test:content` (the Playwright
  content harness) was **not** run, because a live campaign may be in flight and
  it spawns browsers and binds loopback ports. That harness is where the risk
  actually sits:
  `apps/extension/e2e/content/tests/extraction/tests/everything-store-extraction.spec.ts`,
  the row *"the read waits for a list the page has not drawn yet, and stops
  waiting the moment it has one"*, is the exact regression test for this change.
  I read it and the fixture timings it depends on (`resultsHydrate: 700` ms
  against `PAGE_STILL_MS: 2_000` ms, plus `appBanner: 2000` and
  `notifications: 4000`, which mutate the DOM after load and push the stillness
  clock further out) and the margin holds on paper. **It has not been executed.**
  The command is
  `pnpm --filter @fluxiq-web-extension/extension test:content e2e/content/tests/extraction`.
- **The 11.04 s figure itself is inferred, not instrumented.** The identification
  is by elimination over the code (set out above), but no run has been taken with
  the fix in place, so the predicted ~48 s saving is arithmetic rather than a
  measurement. Only a live build on the everything store confirms it.
- **Which page condition actually held during those six reruns** — whether the
  `item` selector named nothing, or named something the `where` conditions then
  emptied — cannot be recovered from the run artifacts: locators are withheld
  from `flow-lane.json` by the redaction policy, and a successful call publishes
  no `nodeId`.
- `apps/extension/dist/` was **not** rebuilt, so nothing a live run loads has
  changed yet. `pnpm --filter @fluxiq-web-extension/extension build` is required
  before the fix reaches a browser.
- No Core file was edited; Core was read only.

## Open questions or contradictions found

1. **A read that waits out its whole budget and finds nothing reports
   `succeeded`.** `minItems: 0` — which the model writes, and which the picker
   preview sends — makes an empty read a passing post-condition, so the loop
   cannot tell "this page has no such list" from "this read worked". That is what
   made a ten-second cost invisible for two runs. The read already knows it
   exhausted its wait; nothing carries that out. Worth a `ListExtractionOutcome`
   field saying the list never appeared, surfaced in the node's outcome, so the
   model can repair the selector instead of re-running the same empty read six
   times. Not done here — it is a contract change across domain and Core
   evidence, not a wait fix.
2. **`awaitPageRendered` and `afterListChange` have the same shape and are
   untouched** (see *The change*). Together they are the 12.24 s row.
3. **The dry-run gate replays the whole draft on every completion attempt**, and
   the draft contains the extraction. Two completions in this build meant two
   full replays. Nothing is wrong with that design, but it means any per-read
   cost in the extraction is paid roughly (reruns + completions) times per build,
   which is why this particular wait was worth 118 s.
