# Lane debug: run-mum06sfc-f1d9403f (everything-store-kettle-to-cart), round 2

Worker lane t172, round 2, debug only, no product code changed.

**Verdict: a Flow was written and ran, but it never added the kettles or moved
the phone case, so it read back the starting cart, with the wrong columns. The
repair was triggered and failed before its first call.** The cart now
extracts, so the fix that round 2 targeted works.

## Answers to the brief

| Question | Answer |
| --- | --- |
| Was a Flow written? | **Yes.** Core accepted `complete` on decision 26: 9 nodes, of which 7 are actions (2 navigate, 3 click, 1 type, 1 `extract_list`). |
| Did it run? | **Yes, every node succeeded.** 2 records were stored. |
| Was the answer right? | **No, 0 of 2 rows matched.** The Flow read the starting cart (Ridgeline phone case and AA batteries) rather than the kettles and batteries, with `quantity` = `"on"`, `price` = `"1"`, and the item column named `title` instead of `item`. |
| Was a repair triggered, and what did it do? | **Triggered, and it did nothing.** The verifier refuted the result correctly, twice, and its advice was right: add the add-to-cart and save-for-later steps, and fix quantity and price. The re-author then failed with `flow_bootstrap.unexpected_error` at `provider_request`, having made **0 provider calls**. |
| Did the targeted fix (1fb57cbc, a two-line cart is a list) work? | **Yes.** `detect_repeating_structure` returned `structure.detected` on the cart (#12), and `extract_list` read 2 of 2 lines in the build and in the run (`listPresence: appeared`, `itemsSeen: 2`). In round 1 every element was refused (`nothing_repeats_around_target`). |
| Did the stall guard (8b56084) do anything? | **Probably.** There was one stall of 4 identical amendments (#16-19). The model then turned to finishing (#20 dry run, #26 `complete`) instead of running out of budget. The redirect text itself is not in the bundle, so this is consistent with the guard firing, not a confirmed observation of it. |
| Next wall | **Completion accepts a Flow that performs none of the instruction's actions**, as long as it produces records: `!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/answerability/check.ts:72`. The cross-check that saw it (`consequenceCrossCheck.verdict: "undeclared"`) is advisory by design (`flow-bootstrap/adaptation.ts:127-133`). |

## Run facts

| Field | Value |
| --- | --- |
| Command | `node scripts/lab/run-lab.mjs run everything-store --live-llm --llm-profile production --llm-provider deepseek --llm-model deepseek-flash --llm-task create-flow --instruction-task everything-store-kettle-to-cart --llm-max-input-tokens 48000 --llm-max-output-tokens 8000 --llm-max-total-tokens 56000 --llm-max-calls 48 --llm-max-run-tokens 600000 --llm-max-cost-usd 0.25` with `FLUXIQ_LAB_ALLOW_BEHIND_CORE=1` |
| Worktree / Core | `F:\fxwork\t172-live-lane-hard-sites` @ bf5227dc; shared Core `F:\fxwork\!FluxIQ` @ 8b56084, rebuilt before the run (see Setup) |
| Build | `proposed`, 27 provider calls (26 loop decisions), 395,245 tokens, **$0.049**, 270 s |
| Run | 10 recorded actions, all `succeeded`, then the verification failure on the extract node |
| Verdict | `failed` / `runtime.behavior`; `core.result.does_not_answer_request` (`output_not_observed`) |
| Repair | verifier 2 calls (3.8k tokens each), `validationOk`; re-author `routed: true`, `applied: false`, `flow_bootstrap.unexpected_error`, stage `provider_request`, `providerInvocation: unknown` |
| End | `unsettled: "recovery"`; total run 362 s |

## Setup (not product results)

- Before the run, the shared Core's `dist` was 51 minutes behind its source
  after the coordinator moved it to 8b56084. I rebuilt it with `pnpm --filter
  fluxiq build` (exit 0). The worktree's domain build was 12 minutes behind
  after the fast-forward. I rebuilt it with `pnpm --filter
  @fluxiq-web-extension/domain build` (exit 0).
- The worktree has no `.env.local`. I loaded `DEEPSEEK_API_KEY` into the
  process environment from `F:\!FluxIQWebExtension\.env.local`, as in round 1.
  The value was never printed.
- Core `dev` is at d67bdfa, one commit past the pinned 8b56084. That commit
  changes panel API routing and a stop handler, not the build loop. So the run
  used `FLUXIQ_LAB_ALLOW_BEHIND_CORE=1` to stay on the pin.
- The first live attempt, `run-mulzn65t-19be3555`, was killed by the
  whole-machine crash after writing one event. Its staging directory was
  removed. Before relaunching, I scanned 10,213 files modified in the last 6
  hours under the worktree, Core's `dist` and Core's web app: none contained
  NUL runs or was empty. Both source trees were clean against their commits.

## The Flow that was written (`flow-lane.json` `authoredNodes`)

| Node | Action | Target | Run result |
| --- | --- | --- | --- |
| s1 | navigate | the store's home page | succeeded |
| s2 | click | button "Accept" (cookie consent) | succeeded, target by selector, confidence 0.57 |
| s3 | merge | - | - |
| s4 | type | input "Search Brightaisle" (text withheld) | succeeded |
| s5 | click | button "Go" | succeeded; the page after it was only 819 bytes of evidence |
| s6 | click | button "Continue shopping" | succeeded (the interstitial after a search) |
| s7 | merge | - | - |
| s8 | navigate | a store URL (withheld; the cart, from what it read) | succeeded |
| s9 | extract_list | fields `title` (text), `price` (text), `quantity` (kind `value`) | 2 records, then refuted |

**The written Flow has no step that opens a kettle, chooses sage green / 1.7 L
/ the Brightaisle offer, sets the quantity to 2, adds to cart, or moves the
phone case to Save for later.** It searches, dismisses the interstitial, and
reads the cart as it was when the page loaded.

## Iteration walk (`snapshots/live-llm.json`)

| # | +s | Tool | Result | Draft rev / steps | Note |
| --- | --- | --- | --- | --- | --- |
| 0 | 0.0 | run_node `dom-capture_snapshot` | `rejected.not_at_start_location` | 0 | Tried to inspect before navigating |
| 1 | 14.6 | run_node | `action.succeeded` | 0 to 1 | Navigate |
| 2-5 | 21-39 | run_node x4 | `action.succeeded`, page changed each time | 1 to 5 / 4 | Accept, type, Go, Continue shopping |
| 6 | 46.3 | detect_repeating_structure | `structure.detected` | 5 | Search results |
| 7 | 60.0 | run_node (inspect) | `inspect.succeeded` | 5 to 6 | |
| 8 | 79.6 | detect_repeating_structure | `already_answered` | 6 | Repeat |
| 9 | 89.9 | amend_draft (rerun d8) | `draft_rerun`, then inspect, page unchanged | 6 to 8 | |
| 10 | 102.4 | run_node | `action.succeeded`, page changed | 8 to 9 / 7 | The last effect of the build; from the Flow, the navigate to the cart |
| 11 | 109.1 | amend_draft (rerun d10) | 1 applied, 1 refused | 9 to 11 / 8 | |
| 12 | 125.7 | detect_repeating_structure | **`structure.detected`** | 11 / 9 | **The cart, as a list. Round 1 refused this.** |
| 13-15 | 130-151 | amend_draft (rerun d12, d14, d15) | `draft_rerun`, inspect, page unchanged | 11 to 17 / 11 | Re-running extraction attempts |
| 16-19 | 158-175 | amend_draft | **`draft_unchanged`, 5 of 5 refused, identical targets (d8, d10, d12, d14, d15), 4 times** | 17 | The one stall |
| 20 | 201.4 | (completion) | `dry_run_refused`; answerability `recordStorePresent: false` | 17 / 12 | First try at finishing |
| 21 | 204.4 | - | `llm_output.invalid_evidence_decision` | 17 | Unusable reply |
| 22 | 209.0 | amend_draft (d3, d6, d16) | 3 applied | 17 to 19 | |
| 23-25 | 216-232 | amend_draft (rerun d17, d18, d19) | `draft_rerun`, inspect, page unchanged | 19 to 25 / 15 | |
| 26 | 256.3 | `complete` | **accepted**; answerability producer and store both present | 25 / 16 | Build ends `proposed` |

Totals: **6 effect-applying actions, all before #11. None of them adds to cart
or saves for later.** 3 structure detections (1 repeated), 12 amendments (4
changed nothing), 1 refused dry run, 1 unusable reply, 1 accepted completion.
The build used 395k of the 600k token grant and $0.049 of $0.25, so it stopped
by choice, not for lack of budget.

## Divergence point and causes

The build diverged at #10 to #12. The model went from the search results
straight to the cart and spent the rest of the build getting a list read from
it. It never went back to the kettle, and Core let it finish.

### Cause 1 (seen in round 1, now the main cause): completion checks only that records are produced

`checkAutomationStudioFlowBootstrapAnswersInstruction` returns `ok: true` as
soon as the plan has a record producer or a record store
(`!FluxIQ/.../flow-bootstrap/answerability/check.ts:72`). Nothing compares the
instruction's lasting actions (put two kettles in the cart, move the phone
case) with the draft's steps. Core computed the contradiction:
`consequenceCrossCheck: { verdict: "undeclared", instructed: ["modify_existing"], declared: [], actions: 46, declaredNothing: 32 }`.
But the cross-check is advisory and runs after the loop
(`flow-bootstrap/adaptation.ts:127-133`), so it refused nothing and was never
fed back to the model. This is the same cause as round 1's classifieds run
(`lane-run-mulxk0ro-36bf090d.md`). It has now let two wrong Flows through as
complete. This is a completeness check that belongs at `complete`, not a
permission gate: nothing needs a person's approval, but the model has to be
told what it has not done yet.

### Cause 2 (new): the extraction columns were bound to the wrong controls, and the item column had the wrong name

The fields were `title` (text), `price` (text), `quantity` (kind `value`),
selectors withheld. Against the fixture's cart line
(`apps/scenario-lab/src/scenarios/everything-store/pages/cart/main.ts:30,36`):

- `quantity`, kind `value`, returned `"on"`. That is the default `value` of
  the line's `<input type="checkbox" aria-label="Select ...">`, so the field
  was bound to the select checkbox and read its `value` property.
- `price` returned `"1"`. That is the text of the quantity stepper's
  `<span aria-live="polite">`, so the price field was bound to the quantity.
- `item` was absent because the model named the column `title`. The
  instruction asks for "columns item, quantity and price", and the oracle
  compares by name.

The selectors are withheld from the bundle, so I cannot say whether the model
wrote them or took them from `detect_repeating_structure`'s inferred fields.
Either way, nothing in the build compared the values read in the dry run
(`"on"`, `"1"`) with what the columns were asked to hold. A checkbox's `value`
of `"on"` is never a quantity.

### Cause 3 (seen in round 1, second occurrence): the re-author fails with an anonymous throw before its first call

`resultReauthor: { routed: true, applied: false, failureCode: "flow_bootstrap.unexpected_error", failureStage: "provider_request" }`,
and the repair's `observed.calls` holds only the 2 verifier calls. This is the
same signature as `run-mulxk0ro-36bf090d`. A plain `Error` is mapped to one
code and its message is dropped
(`!FluxIQ/.../flow-bootstrap/generation-failure/phase-failure.ts:87`).
`logs/core.log` holds only Next.js start-up lines. What I ruled out at
8b56084:

- The purpose guard in the re-author's `generate`
  (`runtime/service.ts:2645`) admits both `build_and_adapt` and
  `explore_and_adapt`. The repair grant is `explore_and_adapt`.
- Every guard in `generateFlowBootstrapAdaptationInternal`
  (`runtime/service.ts:1479-1530`) throws a *named* phase failure
  (`blank_target_required`, `stale_grant_binding`,
  `pending_adaptation_exists`, `active_instructions_required`,
  `node_catalog_unavailable`), so none of them produced this.
- The claim's cost and token checks (`runtime/llm/execution/grants.ts:627-640`)
  cannot fire: the repair grant allows 48 calls, 600k tokens and $2, and had
  spent 2 calls and about 7.7k tokens.

What remains are the grant's availability, lease and scope throws
(`grants.ts:608-624, 641-644, 679-695`, for example "LLM execution grant is
unavailable." once the run lease is over or the grant was revoked), and
`getLlmExecutionBinding` (`runtime/service.ts:1450`). **I could not tell which
one fired.**

### Cause 4 (minor): wasted turns

#0 tried to inspect before navigating (`not_at_start_location`). #8 repeated
a detection already answered. #16-19 re-sent one refused amendment four times.
#21 was unusable. About 7 of 26 decisions changed nothing. Because the build
finished, none of this was fatal this time.

## Ranked for fixers

1. **Cause 1.** Feed the instruction's unperformed lasting actions back at
   `complete`, the way `cannot_answer_instruction` feeds back a missing record
   step. `consequenceCrossCheck` already computes the input.
2. **Cause 2.** Check the dry run's extracted values against the column names
   before accepting: `"on"` in `quantity` and `"1"` in `price` are detectable.
   Keep the instruction's column names.
3. **Cause 3.** Give each guard on the re-author path a closed code before
   trying to fix it. Two runs now end the same way with no name.

## Not verified

- Why the model never opened the kettle. The decisions' content, the
  handles, and the draft's steps at each revision are not in the bundle, and
  the Lab deletes the run root with Core's store.
- Whether the stall redirect was actually sent at #18 or #19. The redirect
  text is not recorded (`noProgressReason: null` is the only related field).
- Which extraction selectors were used, and whether the model or structure
  inference chose them (withheld by the bundle policy).
- Which throw ended the re-author (see cause 3).
- That the page after "Go" was the "Continue shopping" interstitial. I
  inferred it from the 819-byte evidence packet and the next node's target;
  the page text was not recorded.
