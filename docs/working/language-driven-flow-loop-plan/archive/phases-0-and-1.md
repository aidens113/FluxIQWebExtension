# Archive — Phases 0 and 1

Moved out of `../../language-driven-flow-loop-plan.md` on 2026-09-26 under the
compaction threshold. Both are settled: Phase 0's instrumentation landed on
2026-09-24 and is what makes every debug in this document possible, and Phase 1
was the finding that the complex corpus already existed and needed no building.
They are kept because Phase 0 names each instrument and why it was needed, which
is the reference for anyone adding another.

### Phase 0 — the instrumentation gate

**The loop cannot start until one run can be fully debugged.** The audit's
answer was no, and the supervisor verified its two headline claims directly:
the failed run `run-muf8dstp-0135804a` has no `flow-lane.json` at all where the
passing run has one, and all 32 of its decision rows carry exactly two fields,
`toolId` and `resultCode`, with `web.action.rejected.target_unobserved`
repeated **twenty indistinguishable times** inside a single undivided 99,375 ms
gap. Nothing records which handle was refused, why, what the parameters were, or
when. Of the six debug stages, only stage 1 and a shallow stage 2 can be
answered today.

**The structural problem is that the bundle is thinnest exactly where diagnosis
is needed**: the artifact that would explain a failed build is only written when
the build succeeded. Full detail and the remaining nine gaps are in
[reports/run-evidence-audit.md](../reports/run-evidence-audit.md).

This phase costs no provider calls and comes before the first live run.

| Id | Work | Repo |
| --- | --- | --- |
| E1 | **Write `flow-lane.json` for a failed build.** `flow-lane/creation/lane.ts:160-163` throws before the writer at `run-scenario.ts:389`, losing `authoredNodes`, `route`, `ownPage`, `extraction` and the evidence packets — the whole of stage 3 — on exactly the runs that need them. | L |
| E2 | **Half-landed, reopened as t125 on 2026-09-25.** The domain's 33 reasons exist and are correct; none of them reaches the bundle, because Core's `evidence-loop-decision.ts` gates a tool execution on an `exactKeys` list that names no reason field. `run-mug776kx-0214b287` therefore published fourteen identical `invalid_input` rows. **Carry the refusal's own reason through.** `domain/src/runtime/llm-evidence/tool-rejection.ts:128-176` already computes six closed reasons; the bundle flattens them to one word. Today `nothing_observed_yet`, `handle_not_in_packet` and `page_moved_since_packet` — three defects with three different fixes — are one indistinguishable code. Highest value per line changed. | D, L |
| E3 | **Stop discarding the per-row fields Core already keeps.** `evidence-trace.ts:42-61` retains `iteration`, `callId`, `evidenceBytes` and `usage` per row; they are dropped twice, at Core's `evidence-loop-steps.ts:40-46` and at `build-proposal.ts:314-319` (duplicated at `:329`). Extend `hasExactFields` at `generation-failure.ts:725` in lockstep or the widened record is rejected. | C, L |
| E4 | **Half-landed, reopened as t125 on 2026-09-25**: `at` is declared on the published step and parsed by it, and nothing in `evidence-loop.ts` ever emits one — 0 of 41 rows in the last run carry a timestamp. **A timestamp per decision row**, so 32 steps stop collapsing into one 99,375 ms gap and a stall can be located in time. | C, L |
| E5 | **A per-call ledger for builds.** `build-usage.ts:35-37` hard-codes `observedCalls: []` and `perCallRecords: "not recorded"`. Core's `run-call-record.ts` already does this for runs; a build is simply not a run. | C, L |
| E6 | **Stop hiding 21 of 22 tool calls.** `vocabulary()` at `build-proposal.ts:371-373` filters the whole `core.` prefix, which removes `core.run_node` — nearly every call the model made. | L |
| E7 | **Wire a screenshot adapter.** `run-scenario.ts:123` builds the capture controller without one, so every non-error capture is `capture-unavailable`; the policy allowed 100 and both specimens have zero. Stage 6 cannot show the page as it was when it broke. | L |
| E8 | **Publish `error.details` for `runtime.behavior`.** `run-scenario.ts:515` publishes them only for `recording.contract`, so the details of the failure class this loop actually hits are dropped. | L |
| E9 | **A local-only diagnostic sidecar** — see the decision below — holding the prompts, the replies and the page state at each step, written beside the run and never published or committed. | L |
| E11 | **Done.** The Lab's terminal-detail wait is now derived from the Flow's action-node count: `min(600_000, 90_000 + (n-1) × 91_250)` ms — unchanged at 90 s for one node, 546 s for six, capped at 600 s from seven up. Every term comes from Core's own published constants: 90 s is the existing load-proven fixed cost, 91,250 ms is Core's per-node worst case (a 30 s readiness cap awaited once per attempt × 3 attempts, plus the 250 ms and 1 s backoffs), and the cap is Core's maximum granted run. **The bite was worse than the entry assumed**: the wait's expiry rethrows the request's own HTTP timeout *as the run's result*, so a six-node Flow still executing at second 91 was recorded as a product failure, and deterministic replays reach that path on essentially every multi-node run because the client request bound is 30 s. Granted runs and caller aborts are deliberately unchanged. Proven against a virtual clock, never yet against a real multi-node Flow. | L |
| E12 | **Record resolved parameter values.** The values a node's parameters actually resolved to at execution time are recorded nowhere, so stage 3 cannot tell a node that was authored wrong from one that was authored right and resolved wrong. | C, D, L |
| E13 | **The upstream row rebuilder, found while E3 was landing.** `existing-fluxiq-control/adaptation-evidence-loop.ts:121-130` rebuilds every decision row as exactly `toolId` / `effectApplied` / `resultCode`, stripping the widened members before they reach the consumer E3 fixes. E3 is half-landed without it. Its doc comment states a deliberate policy — "nothing the tool returned and nothing the model wrote is admitted" — which stands; the Phase 0 decision draws the compatible line at identifiers, closed codes, counts, byte sizes and timestamps. | L |
| E14 | **Done 2026-09-25.** `loadTestEnvironment` now records which repository env file each name was read from, weakly keyed to the environment it describes so a provenance record can never be mistaken for a configuration value, and a name the operator set on the command line is never blamed on a file. Both refusals append the source and the escape: `isolated target cannot use existing-install configuration: FLUXIQ_TEST_BASE_URL, FLUXIQ_TEST_GATEWAY_URL. They were read from .env.local in the repository root, not from this command; run with FLUXIQ_TEST_ENV_FILES=none to ignore them for this run without editing the file.` Two regression tests; `dist/tests/target-config.test.js` reports 17 of 17 passing. **A refusal that names its own way out.** Three attempts were spent before the first live run reached the product, because this machine's `.env.local` configures an existing FluxIQ install and neither refusal said where the offending value came from or that `FLUXIQ_TEST_ENV_FILES=none` exists for exactly this case. The escape is documented only in a comment above the function implementing it. | L |
| E10 | **Already done before the phase opened, and the entry was wrong.** It was carried over verbatim from the retired plan's D0a without re-checking it against the current tree. Commit 84e44ce had already made a retried node attributable: `run-flow-lane.ts:452-480` emits `nodeId`, `attemptIndex`, `retry` and `hostTargetResolution`. Verified directly. Only the regression tests were missing, and they have been added. **The lesson is the entry, not the code**: an item inherited from an older document is a claim about a tree that has since moved, and every such item must be re-verified before it becomes work. This was the only inherited entry in Phase 0 — E1 to E9 and E12 came from audits run today against the current tree. | L |

**Decision: two tiers of evidence, taken by the supervisor 2026-09-24.** The
audit surfaced a real contradiction. `observed-usage.ts:1-4` states the bundle
carries "no prompt, no response, and no page data… so this can be published in
an evaluation" — publishability has been bought by making the bundle
undiagnosable, and stages 2 and 6 of the debug protocol ask for precisely the
three things it excludes. The resolution is not to relax the published bundle.
E1 to E8 are all closed codes, identifiers, numbers and timestamps, which buy
most of the diagnosis with no new redaction surface, and the published bundle
keeps its guarantee unchanged. E9 then adds a separate local-only sidecar for
the prompts, replies and page snapshots, written into the run directory, which
is already ignored and never committed. Nothing in the published artifact
changes; nothing secret leaves the machine.

### Phase 1 — the complex corpus already exists

**Nothing needs authoring to start.** The inventory classified all 134 live
tasks across 27 of 41 fixtures: 76 `navigate-and-extract`, 33 `form`, 19
`extract`, 6 `navigate`. Roughly 115 are multi-node. Full detail, including all
84 instruction texts verbatim, is in
[reports/scenario-inventory.md](../reports/scenario-inventory.md).

**The finding that reframes the last two days: the extract lane contains no
multi-node work at all.** All 19 of its tasks are exactly the catalog's 19
`kind: "extract"` rows, each judged by a dataset whose workflow's entire
declared chain is `extract → checkpoint`, and the campaign confirmed it — all 14
created Flows were `1 nodes: web.dom.extract_list ×1`. That campaign measured
one node authored nineteen times. **It could not have shown whether the model
can build a chain of two nodes, because it never asked for one.**

**Apply the gate by the required chain, not the declared kind.**
`web.dom.extract_list` carries `paginate` (next / loadMore / numbered / scroll)
and `where` (including numeric bounds) internally, so "scrape every product
across all pages" and "only those under 50" are still **one node**.
`product-catalog-all-pages` is declared `navigate-and-extract` and is
single-node. A task qualifies on the chain it actually requires.

**The corpus's own gaps**, to author later and not needed to start: no live task
uses `web.dom.upload` or `web.browser.download` at all, though `file-transfer`
supports both; `storefront-checkout` is a complete 24-step wizard with postcode
lookup, a payment iframe and a `declined-card` branch with zero live tasks; two
per-row drill-down loops are declared and untasked; and the only login's
`expired` variant is untasked.
