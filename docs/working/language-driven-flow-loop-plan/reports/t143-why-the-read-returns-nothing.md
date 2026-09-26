# t143 — Why the read returns nothing on a page another run read 43 rows from

## Outcome

Done — diagnosis only. No source, test, fixture or other document was changed.

**The headline: it is not the Flow, it is the wait.** Two pairs of runs in this
set have the same node chain and land on opposite sides of the result, so the
draft's shape does not predict the read. What does predict it, across all ten
runs and all fourteen extraction attempts, is how the read's wait *ended*: every
read that returned zero ended at about two seconds, which is
`EMPTY_PAGE_SETTLE_MS` / `PAGE_STILL_MS` exactly — the early settle added at
18:29 that same day in `a05134a`. Every read that returned rows either found its
list immediately or waited between 4.6 s and 14.3 s. The fixture's own gates
clear on a 4 s timer and an 8 s timer. **The read gives up two seconds into a
page that is two to six seconds away from producing the list.**

The six zero-record runs are not one failure. They are four:

| | runs | what happened |
| --- | --- | --- |
| A | `muhu0tjc`, `muhpo10p` | executed, waited ~2 s, matched nothing |
| B | `muhd1vc7`, `muhrf6c4` | executed, **stored rows**, the judge scored the other record set |
| C | `muht9lpw` | never executed — no navigate node, refused on `about:blank` |
| D | `muhrz0at` | executed for 14.3 s, then a second empty read left one record set holding zero |

B is already fixed (`96833cf`, 19:59 — after both runs). C is already diagnosed
in `t137-lost-draft-steps.md`. A and D are the live defect, and both trace to the
same two-second settle.

## What I read

Read-only, in every case: the ten run bundles under `test-runs/`; the extraction
source the brief permits (`apps/extension/src/content/extraction/page-render.ts`,
`list-reader.ts`, `domain/src/actions/extraction/summary.ts`); the judging and
screening seams (`packages/test-runner/src/flow-lane/creation/judgement.ts`,
`creation/authored-nodes.ts`, `flow-lane/extraction-read.ts`); the fixture's
timings and shared steps (`apps/scenario-lab/src/scenarios/everything-store/`);
and, in `F:\!FluxIQ`, `packages/fluxiq/src/programs/automation-studio/runtime/
recovery/repair-context/parameter-screen.ts` — needed to establish that an
authored URL is rewritten, not withheld. Nothing was edited.

## 1. Did the extraction node run, and what did it report?

### Observed, per run

`snapshots/flow-lane.json` → `actions[]` filtered to `web.dom.extract_list`,
with each attempt's `status` and `durationMs`, and `extraction.steps[0]`:

| run | draft chain (node kinds, execution order) | extract attempts | stored (`failure.actual`) | judged |
| --- | --- | --- | --- | --- |
| `muhd1vc7` 12:49 | nav, nav, **extract**, nav, **extract** | 11082 ok, 10068 ok, 1018 fail | "16 records stored, across 2 record sets" | 0 |
| `muher0en` 13:38 | nav, nav, **extract** | 6935 ok, 1108 fail | "15 records stored, across 1 record set" | 15 |
| `muhnh0s5` 17:34 | nav, Not now, Accept, type, Go, Continue shopping, **extract** | 14258 ok, 1025 fail | "8 records stored, across 1 record set" | 8 |
| `muhpo10p` 18:35 | nav, Not now, Accept, type, Go, **extract** | **2576 ok**, 1014 fail | "0 records stored, across 1 record set" | 0 |
| `muhqop38` 19:00 | nav, nav, Continue shopping, **extract**, **extract** | 255 ok, 4631 ok, 1124 fail | "70 records stored, across 2 record sets" | 55 |
| `muhrf6c4` 19:22 | nav, Not now, Accept, nav, Continue shopping, **extract**, **extract** | 14258 ok, **2109 ok**, 1008 fail | "8 records stored, across 2 record sets" | 0 |
| `muhrz0at` 19:37 | nav, Not now, Accept, nav, Continue shopping, **extract**, **extract** | 14264 ok, **2082 ok**, 1008 fail | "0 records stored, across 1 record set" | 0 |
| `muht9lpw` 20:12 | **extract** (nothing else) | 2034 fail, 2017 fail, 2016 fail | — | not_run |
| `muhu0tjc` 20:35 | nav, nav, **extract** | **2089 ok**, 1016 fail | "0 records stored, across 1 record set" | 0 |
| `muhubegx` 20:43 | nav, Not now, Accept, type, Go, Continue shopping, **extract** | 14256 ok, 1020 fail | "43 records stored, across 1 record set" | 43 |

Times are the bundles' local mtimes (PDT), which match the commit timestamps
below. The trailing ~1 s "fail" attempt in every run is not the extraction
failing: it carries `stage: "verification"` and
`code: "core.result.does_not_answer_request"`, i.e. the Flow's own result check.

### The three answers the brief asks to be kept apart

**"The node never executed" — one run: `muht9lpw`.** `flowShape.nodeCount: 1`,
`navigationNodes: 0`; `ownPage.reached: false`; all three attempts `failed` with
`failure.actual` = `Cannot access contents of url "about:blank". Extension
manifest must request permission to access this host.`;
`extraction.steps[0].status: "not_run"` and `reads: []`. The draft was a single
extraction node with no navigation, so it ran on `about:blank`. Observed. Already
diagnosed in `t137-lost-draft-steps.md` (that report's `declaredConsequences`
quote is this run's) — the model withdrew the earlier steps itself.

**"It executed and matched nothing" — two runs: `muhu0tjc` and `muhpo10p`.**

- `muhu0tjc` is the one run that says so in its own words.
  `extraction.steps[0].reads[0]`:
  `{"recordCount":0,"pagesRead":1,"truncated":false,"fieldNames":["name","price","rating","url"],"missingFields":[],"listPresence":"never_appeared","conditions":{"applied":0,"kept":0,"rejected":[0,0],"unfiltered":false}}`.
  `listPresence: "never_appeared"` is defined at `page-render.ts:88-93` as "the
  wait having run out — on the page settling, on the ceiling, or on the command's
  deadline — with the selector still naming nothing". `conditions.applied: 0`
  means no item was ever tested, so the two authored `where` clauses are not the
  cause: there was nothing for them to reject. Observed.
- `muhpo10p` carries no `reads` (it predates `84215fb`, 20:08). Observed: the
  extract attempt `succeeded` in 2576 ms and `failure.actual` says "0 records
  stored, across 1 record set". Inferred, from the duration matching the settle
  window: the same early-settle path as `muhu0tjc`. The bundle cannot distinguish
  "never appeared" from "appeared and every row was rejected" for this run.

**"It executed, matched rows, and they were not scored" — two runs: `muhd1vc7`
and `muhrf6c4`.** Both stored rows (16 and 8) across **two** record sets, both
report `extraction.unpairedDatasets: 1`, and both judged 0. This is the pairing
defect, and it is not my finding: `creation/judgement.ts:35-47` names
`run-muhrf6c4-9714939f` explicitly — "Core stored '8 records, across 2 record
sets', the judged step measured **0**, and the 8 were in the other one. The Flow
had found the answer and this scored the empty table." `muhd1vc7` has the
identical signature. Fixed in `96833cf` at 19:59, after both runs.

The rows were **not discarded** — they were stored and published; the judge read
the wrong one of two record sets.

**A fourth case the brief's three categories do not cover — `muhrz0at`.**
Observed: two extraction nodes, both `succeeded` (14264 ms and 2082 ms), and
"**0** records stored, across **1** record set" with `unpairedDatasets: 0`. The
14.26 s first read is the same duration that, in the identically-chained
`muhrf6c4`, produced the 8 rows. Observed difference between the two:
`muhrz0at`'s two extraction nodes both carry a `recordOutput` whose `datasetId`
appears in `parametersWithheld` — so a dataset id *was* supplied and screened —
while `muhrf6c4`'s both carry `recordOutput: null`. Inferred, and the leading
candidate: both `muhrz0at` nodes named the same dataset, and the second node's
empty two-second read replaced the first node's rows, collapsing two record sets
into one holding zero. I did not establish Core's default `writeMode` (the node
omitted it: `writeMode: null`, and `writeMode` is *not* in `parametersWithheld`).
`F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\executor\record-summary.ts:102`
shows a `"replace"` mode exists. This is the one zero I could not close.

## 2. What differs between the zero runs and the 43 run

### The node chain — and why it is not the explanation

Observed, from `build.declaredConsequences` (`actionKind: "flow_step"`) and from
`authoredNodes` re-sorted by node-id suffix rather than by array order. **The
array is lexicographic, so `s10` sorts between `s1` and `s2`**; read as given it
yields a false chain, which is worth stating because it is an easy mistake to
make from this artifact.

The 43-row run, `muhubegx`, kept every step its exploration had used: navigate →
click "Not now" → click "Accept" → **type into "Search Brightaisle"** → click
"Go" → click "Continue shopping" → extract, `maxPages: 5`, one `where` clause. It
read 43 records over 5 pages with all four declared fields present
(`missingFields: []`).

Now the two controlled comparisons, which are what rule the chain out:

- `muher0en` (15 rows) and `muhu0tjc` (0 rows) have the **same three-node chain**
  — navigate, navigate, extract — and the same exploration shape (`nav.start`,
  `nav.search`, click "Continue shopping", then repeated extracts), and in both
  the draft dropped the "Continue shopping" click the exploration had used. One
  read 15; one read nothing.
- `muhrf6c4` (8 rows stored) and `muhrz0at` (0 stored) have the **same seven-node
  chain**, control for control, down to the accessible names: navigate, "Not
  now", "Accept", navigate, "Continue shopping", extract, extract. One stored 8;
  one stored nothing.

So dropping the search, or dropping the "Continue shopping" click, is neither
necessary nor sufficient for the zero read. `muhqop38` kept the "Continue
shopping" click without typing a search and stored 70; `muhpo10p` typed the
search and dropped the click and stored 0.

### Was a search typed?

Observed: a `web.dom.type` on the input named "Search Brightaisle" is in the
draft of three runs only — `muhnh0s5`, `muhpo10p`, `muhubegx`. The other seven
reached search results by *navigating*, which the exploration trace records as
`nav.search` / `nav-search`. The typed text is withheld (`"text"` in
`parametersWithheld`), so what was searched for is in no bundle.

### Which page the extraction ran on

**No artifact says, for any of the ten runs.** See §3.1 — this is the single
biggest gap, and it is why §2 can only be answered at the level of the chain.

### What the extraction was authored with, as far as the screen allows

Observed. `extractList.item` — the selector that decides whether anything matches
at all — is `null` and listed in `parametersWithheld` in **all ten** runs. That
is a redaction, not an empty value. Every `where[i].read` and its comparison
value is likewise withheld. What is visible: the declared field names, the `where`
item count and each clause's *operator*, `paginate.maxPages`, `minItems` and
`timeoutMs`.

Visible and relevant:

- `minItems: 0` on every extraction node in all ten runs, so no node demanded a
  minimum and none could have failed for want of one.
- `timeoutMs: 10000` on every extraction node, which equals `RENDER_WINDOW_MS`.
- The `where` count varies wildly for the same task: `muhubegx` authored **1**
  clause and read 43; `muhnh0s5` authored **4** (`is`, `not contains`,
  `atLeast 4`, `lessThan 50`) and read 8 against an expected 13. So on the
  "too many / too few" axis the discriminator is the clause count, not the read.
- `muhd1vc7`'s node `s3` is the only one to name a fifth field, `adId`, and the
  only one to declare a field `required: false`.
- `muht9lpw`'s single node declares twelve fields whose names are raw CSS-derived
  keys (`div_css-1f5vozn_span_1`, `a_css-1a9qeh3_img_css-1xcvkir_src`, …), i.e.
  `web.detect_repeating_structure` output carried into the draft verbatim.

### How the draft got to that shape, from the decision trace

`build.declaredConsequences` is the only trace that names steps. Observed, for
the 43 run: nine exploration steps (navigate, "Accept", "Not now", "Accept"
again, type into the search box, "Go", a continue click, two extracts), then
`flow_step` `main.s1…s8` with **two** extraction nodes, then `dryrun.1` replaying
all of it, then a re-proposal with **three** extraction nodes (`main.s10, s11,
s12`), then `dryrun.2`, then a final proposal with **one** (`main.s10`), then
`dryrun.3`. So the draft was amended three times and converged downward on a
single extraction node carrying a single `where` clause.

Observed, for `muhu0tjc`: exploration was `nav.start`, `nav.search`, click
"Continue shopping", four extracts, one rerun — and the draft proposed was
`main.s1` open, `main.s2` open, `main.s3` run. **The "Continue shopping" click the
exploration had used is absent from the draft.** Then `dryrun.1` replayed exactly
the reduced chain (`dryrun.1.2` navigate, `dryrun.1.3` navigate, `dryrun.1.12`
extract list) and the loop ended `core.decision_complete`.

Two things follow, both observed. First, the loop **dry-ran the draft and then
completed it regardless of what the dry run's extraction read** — there is no
decision row between `dryrun.1.12` and `decision_complete`. Second, nothing in
the bundle publishes what that dry-run extraction read, so the loop's own
evidence for "this draft works" is not recoverable.

Also observed in `muhu0tjc`'s `build.evidenceLoop.steps`: two of the sixteen
decisions were unusable — `llm.provider_malformed_response` and
`llm_output.invalid_evidence_decision` — immediately before `decision_complete`.
The draft was finalised after the model's last two attempts to say anything were
discarded.

### The mechanism that does explain it

Observed, in `apps/extension/src/content/extraction/page-render.ts`:

```
const RENDER_WINDOW_MS = 10_000;
const EMPTY_PAGE_SETTLE_MS = 2_000;
const PAGE_STILL_MS = 2_000;
...
await waitUntil(() => matchCount(item) >= wanted || still.settled(), RENDER_WINDOW_MS, RENDER_POLL_MS, progress.deadline);
```

and `documentStillness()`:

```
settled: () => document.readyState === "complete" && Date.now() - changedAt >= PAGE_STILL_MS
```

So the wait for the list to *appear* ends as soon as the document has loaded and
been mutation-quiet for two seconds, whether or not a single item has matched.
Introduced in `a05134a`, 2026-09-25 **18:29**, whose own message states the
intent: "A document that has finished loading and had neither for two seconds
cannot discover anything in the rest of the window", and explicitly excludes "a
page still drawing, fetching into the DOM or toggling a class".

Observed, in the fixture
(`apps/scenario-lab/src/scenarios/everything-store/client/timings.ts`):

```
notifications: 4000,
softCheckButton: 1500,
softCheckAuto: 8000,
```

and in `client/soft-check-script.ts`: the browser-check page's button unlocks at
1.5 s and "A shopper who simply waits is passed at `softCheckAuto`. Either way
the page reloads onto what was asked for" — implemented as
`setTimeout(pass, SOFT.timings.softCheckAuto)`. And `workflows/shared-steps.ts`:
the notifications prompt "arrives four seconds after the page loads and whose
backdrop covers the whole page, the cookie banner included, until it is
answered", and the browser check is the one "the session's first search meets".

**A page whose next change comes from a `setTimeout` is mutation-quiet and
`readyState: "complete"`. It is exactly the case `documentStillness` cannot tell
from a finished page.** The soft-check page changes at 8 s; the notification gate
at 4 s; the read concludes at 2 s.

The durations are the evidence, and the separation is clean across all fourteen
attempts: **2089, 2576, 2109, 2082 ms → zero records. 255, 4631, 6935, 10068,
11082, 14256, 14258, 14264 ms → records.** A 255 ms read found its list at once;
every read that had to wait for it and returned nothing stopped on the settle,
not on the 10 s ceiling. Inferred from that: the four ~2 s reads all ended on
`still.settled()`.

Timing corroborates. Before `a05134a` (18:29) three runs of this task ran, at
12:49, 13:38 and 17:34, and **none stored zero** (16, 15, 8) — and `a05134a`'s
own message cites the 11.04 s reads in `muher0en` and `muhnh0s5` as the waste it
removed. After 18:29, seven ran and three stored zero: `muhpo10p` 18:35,
`muhrz0at` 19:37, `muhu0tjc` 20:35. Three-versus-three is not decisive on counts
alone; the duration separation and the constants are what carry it.

## 3. Is the read's own account sufficient to answer question 1?

**No.** It is sufficient for exactly one of the six runs (`muhu0tjc`) and
partially for one more (`muht9lpw`). For the other four the account either does
not exist or does not carry the field that would settle it. Named precisely:

1. **Which page the read ran on.** Nothing publishes it. The only URL in the
   bundle is `authoredNodes[].parameters.url`, and Core's screen
   (`parameter-screen.ts:45`, "A string that is an absolute URL is carried as its
   origin, whatever its path") rewrites it — deliberately, because "the path and
   the query are where an order number, a search…" live. **The rewrite is not
   declared**: every navigate node in all ten runs shows
   `"parametersWithheld": []` while its `url` reads `"http://127.0.0.1:<port>"`.
   A draft that navigated to `/search?k=earbuds` and one that navigated to `/`
   are byte-identical in the bundle. Screenshots cannot substitute:
   `evidence-policy.json` has `"screenshots": "events"` and every event in
   `events.ndjson` carries
   `"capture": {..., "screenshotSuppressed": "capture-unavailable"}`.
   *The missing field: a screened page identity beside each extraction attempt —
   a path with its query stripped, or a stable page id — in
   `extraction.steps[].reads[]`.*
2. **The item selector.** `extractList.item` is `null` in all ten runs and listed
   in `parametersWithheld`. Nothing in the bundle says whether the selector the
   draft carried is the one the exploration's successful extract used, and two
   extraction nodes in one Flow cannot be told apart by it. *The missing field: a
   selector fingerprint — a hash, or its match count on the exploration page —
   that discloses nothing about the markup.*
3. **The exploration's own read counts.** `build.declaredConsequences` names each
   exploration extract (`extract.list.1` … `extract.list.4`, `rerun.6`) and
   publishes no record count for any. `live-llm.json` gives
   `exploration.source: "absent"`, `exploration.toolDetail: "not-published"`,
   `exploration.counts.*: null` throughout, and
   `observed.perCallRecords: "not recorded"`. So "the exploration read rows on
   this page and the draft read none" cannot be shown from a bundle, only
   inferred.
4. **Which node a successful trace step ran.** `build.evidenceLoop.steps[].nodeId`
   is populated only when the step was *refused*. Measured across all 159 bundles
   in `test-runs/`: **22** steps name a node and **0 of those 22** carry a success
   code (the 22 are `not_at_start_location` ×9, `blocked_by_dialog` ×5,
   `target_unobserved` ×5, `action_timed_out` ×3); **1151** steps name none. A
   successful exploration step is anonymous.
5. **The dry run's read.** `dryrun.1.12=extract list` is named; its record count
   is not. Nothing in the bundle shows whether the dry run had already read zero
   before `decision_complete`.
6. **Per-page condition counts.** `conditions.{applied,kept,rejected}` are
   per-document, not per-read — `list-reader.ts:200-207`: "A continued read
   carries its predecessor's `filtered` and not its rejected rows, so these
   counts say what this document did". So `muhubegx`'s
   `{"applied":0,"kept":0,"rejected":[0],"unfiltered":false}` beside
   `recordCount: 43, pagesRead: 5` reports the **fifth page alone** and says
   nothing about what the filter did to the first four. I initially read it as
   "the clause was never applied"; it does not support that. The doc comment on
   `WebAutomationExtractionConditionReport` in
   `domain/src/actions/extraction/summary.ts` also warns that `kept` is not
   comparable to `recordCount`. (Cited by name, not line: that file has
   uncommitted insertions from a concurrent task, so its line numbers are
   moving. `page-render.ts` and `list-reader.ts`, cited by line above, are
   unmodified.)
7. **Dataset attribution.** For a Flow with two extraction nodes no artifact says
   which node wrote which record set: `extraction.steps[]` publishes the judged
   one and `unpairedDatasets` a bare count. That is precisely what made
   `muhd1vc7` and `muhrf6c4` unreadable, and it is why `muhrz0at`'s zero is still
   open. *The missing field: a per-node row — node id, dataset id, rows written,
   write mode — and `recordOutput.writeMode` published rather than left as the
   model's omission.*

## 4. The single highest-value change

**Repository: `F:\!FluxIQWebExtension`.** This is extraction execution against
the DOM, which this repository owns; no Core change is needed for it.

> **Brief.** Stop `awaitListPresent` from ending a wait on document stillness
> when the item selector has matched *nothing*. In
> `apps/extension/src/content/extraction/page-render.ts`, the first wait is
> `waitUntil(() => matchCount(item) >= wanted || still.settled(), …)`, and
> `documentStillness().settled()` returns true after `PAGE_STILL_MS` (2 s) of no
> `childList`/`attributes` mutation on a `readyState: "complete"` document. A
> page whose next change comes from a `setTimeout` satisfies that exactly, which
> is every gate this fixture has: `notifications: 4000`, `softCheckAuto: 8000` in
> `apps/scenario-lab/src/scenarios/everything-store/client/timings.ts`, the
> latter a `setTimeout(pass, …)` that reloads the page onto the results. Reserve
> the early settle for the case it was written for — a read that has *already*
> found items and is waiting to see whether more arrive, which the separate
> `LIST_GROWTH_SETTLE_MS` loop below it already handles — and let a read that has
> matched zero items keep paying `RENDER_WINDOW_MS`, the command's `timeoutMs`
> and its own deadline, as it did before `a05134a`. Do not simply raise
> `PAGE_STILL_MS`: the defect is that stillness is read as "settled" on a page
> that is merely waiting on a timer, and no constant fixes that. Update
> `apps/extension/src/content/extraction/tests/page-render.test.ts` — which
> currently asserts the early settle, including a case ending "on the settle at
> 2.06 s of a 30 s deadline" — and
> `apps/extension/src/content/actions/tests/extract-list.test.ts`, adding a case
> for a quiet, complete document that adds its list on a timer after the settle
> window and must still be read. Rebuild the extension bundle
> (`pnpm --filter @fluxiq-web-extension/extension build`) before any live run,
> since `a05134a` shipped without rebuilding `dist`. Keep `a05134a`'s saving
> where it is real: a page that never had a list and never will still costs the
> full window, which is the price of not reporting a gate as an empty page.

**Why this one.** It is the only change that moves more than one run. It closes
`muhu0tjc` (2089 ms, `never_appeared`) and `muhpo10p` (2576 ms) directly; it
removes the empty 2 s second read that, on the leading hypothesis, erased
`muhrz0at`'s 14.26 s dataset; and it removes the empty second record set that the
pre-`96833cf` judge scored in `muhd1vc7` and `muhrf6c4`. Five of the six zero
runs touch it. It is one file plus two test files, in the repository that owns
DOM behaviour, and it reverses a regression that is seventeen hours old.

**Deliberately not chosen, and why.** (a) *Gate draft completion on the dry run's
read* — `F:\!FluxIQ`, the build loop: correct and worth doing, but it would make
the loop reject drafts that a fixed wait would have made good, so it belongs
after this. (b) *Publish the exploration and dry-run read counts* — §3 items 3–5:
this is what made the diagnosis cost a day, but it stops no zero read. (c) *Make
the draft keep the exploration steps it used* — the two controlled comparisons in
§2 show that dropping a step neither caused nor prevented a zero read here.

## Observed vs inferred, in one place

**Observed.** Every number in the §1 table. `muhu0tjc`'s
`listPresence: "never_appeared"` and `conditions.applied: 0`. `muht9lpw`'s
`about:blank` refusal, `navigationNodes: 0`, `status: "not_run"`, `reads: []`.
`muhd1vc7` and `muhrf6c4` storing 16 and 8 rows across two record sets while
judged 0, with `unpairedDatasets: 1`. The pairing defect being already named and
fixed in `judgement.ts`. The constants `RENDER_WINDOW_MS: 10_000`,
`EMPTY_PAGE_SETTLE_MS: 2_000`, `PAGE_STILL_MS: 2_000`, and the settle appearing
in the first `waitUntil`. The fixture's `notifications: 4000`,
`softCheckAuto: 8000`, and the soft check's `setTimeout(pass, …)` reload. The URL
screen collapsing an absolute URL to its origin without recording it in
`parametersWithheld`. 22 of 1173 trace steps naming a node, none of them
successful. `conditions` being per-document. `muhu0tjc`'s draft omitting the
"Continue shopping" click its exploration used, and the loop completing after the
dry run with no decision row in between.

**Inferred.** That the four ~2 s zero reads all ended on `still.settled()` — from
the duration matching `PAGE_STILL_MS` plus the ~1 s round trip the `a05134a`
message documents, not from any field that says so. That `muhpo10p`'s zero has
the same cause as `muhu0tjc`'s — it has no `reads` record. That `muhrz0at`'s
second empty read replaced the first node's rows — from "0 records, 1 record set"
after a 14.26 s read, and from both nodes carrying a screened
`recordOutput.datasetId` where `muhrf6c4`'s carry none. That `a05134a` is the
regression — from the timing and the mechanism, not from a bisect.

## Commands run and observed results

All read-only. `node -e` scripts over the ten bundles under `test-runs/`,
reporting `flowShape`, `authoredNodes` (re-sorted by node-id suffix),
`extraction`, `actions`, `failure`, `build.evidenceLoop.steps` and
`build.declaredConsequences`; one scan of all **159** bundles for
`build.evidenceLoop.steps[].nodeId` against `resultCode`, which returned
`steps with nodeId: 22, of which success-coded: 0; steps without nodeId: 1151`.
`git show -s` for `a05134a` (18:29), `bf3b0c4` (18:46), `96833cf` (19:59) and
`84215fb` (20:08). `grep`/`sed` over the extraction, judging, screening and
fixture files listed in **What I read**.

No build, type check or test was run: this task changed nothing to validate, and
the brief forbids touching the files a fix would touch.

## Not verified

- No live run. The `a05134a` attribution is not confirmed by reverting the settle
  and re-running, which is the check that would close it.
- `muhrz0at`'s dataset overwrite is unconfirmed; Core's default `writeMode` was
  not established.
- Which page any read ran on is unverified for every run, and cannot be verified
  from these bundles (§3.1).
- `muher0en`'s 6935 ms read returning 15 rows is unexplained: ~5.9 s of wait
  after the ~1 s round trip falls between the 4 s notification gate and the 8 s
  soft check, and without a page identity I cannot say which page it read.
- Whether the item match is affected by the notification backdrop. `matchCount`
  is `document.querySelectorAll`, which ignores overlays, but I did not trace
  whether a later stage filters by visibility.

## Open questions and contradictions found

1. **`a05134a` and `bf3b0c4` disagree about what a zero read costs.** `a05134a`
   removed the wait on the grounds that a still page "cannot discover anything";
   `bf3b0c4` added `listPresence` seventeen minutes later so that a zero read
   could say whether the list was ever there. The second exists because the first
   makes zero reads more common. Worth recording in the plan as one decision, not
   two.
2. **A screened value that is rewritten is indistinguishable from a real one.**
   The URL-to-origin rewrite is invisible in `parametersWithheld`, so a reader
   cannot tell a redacted `/search?k=…` from a genuine `/`.
   `parametersWithheld` should list rewritten paths as well as withheld ones, or
   the rewrite should leave a marker. This is a Core change
   (`parameter-screen.ts`) and it will silently mislead every future diagnosis of
   a navigate step.
3. **`conditions` is published as if it described the read.** It describes the
   last document. On the one multi-page read in this set it is `applied: 0`
   beside `recordCount: 43`, which invites exactly the wrong conclusion — I drew
   it before reading `list-reader.ts`. Either publish a per-read total or name the
   field for what it is.
4. **Did the dry run read zero in `muhu0tjc`?** If it did, the loop completed a
   draft it had already watched fail, and that is a larger defect than the wait.
   The bundle cannot answer it. §3.5.
