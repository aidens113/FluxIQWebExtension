# i-final-w10 — final Bench B W10 action mismatch (read-only)

## Contract and scope

- Brief: read-only investigation of final Bench B's W10 action mismatch. I read
  the Week 1 `Current State`, the W10 manifest and tests, the recording intake
  and mapper boundaries, the Flow-lane checks, and bounded fields from the three
  completed W10 bundles in `F:\fxlab-runs\final\b`.
- I did not read raw page data, screenshots, or logs; run evidence below is
  limited to run ids, lanes, variants, counts, action types/statuses, verdicts,
  categories, and timing totals. I made no source change and ran no Lab, build,
  or test command.

## Finding

**High confidence (0.90): this is a recording-driver / navigation-intake race,
not an oracle error, mapper transformation error, start-node defect, or runtime
defect.** Of the offered buckets, it belongs under **corpus/harness error**: the
automated recording script starts its second intentional navigation only tens
of milliseconds after the click navigation, inside the extension recorder's
250 ms navigation debounce and 5 s explanatory-action window. The resulting
recording nondeterministically contains either one candidate (click only) or
two (click then typed navigation).

There is also a naming correction: the failed mismatch bundle is W10 **primary
(unarmed) Flow repeat 0**, `run-mu0bgxeg-bc3e33ff`. The following W10
`broken-link` Flow repeat 0 bundle, `run-mu0bi8c2-2bd81d13`, passed. The latter
is useful comparison evidence, but it is not the failed row.

## Evidence chain

1. **The oracle is faithful to the script.** W10 records a click, waits for its
   landing, then explicitly navigates and checks the final state
   (`apps/scenario-lab/src/scenarios/navigation/scenario.ts:32-41`). The primary
   expectation deliberately requires a successful `web.browser.navigate`; the
   variant overrides it with the failed click that causes the expected
   `navigation_unexpected` result (`scenario.ts:43-60`). The scenario test pins
   both expectations and pins that the variant reuses the primary recording
   script (`apps/scenario-lab/src/scenarios/navigation/tests/scenario.test.ts:17-28`).
   Flow action assertions are presence checks, not exact-list equality, so the
   primary expectation permits the preceding click and correctly detects only
   the missing navigation (`packages/test-runner/src/flow-lane/expectations.ts:6-28`).

2. **The failed Flow was built short.** In `run-mu0bgxeg-bc3e33ff`, the finalized
   recording had 24 entries, the proposal had one candidate, start candidate
   index was 0, and Core executed one `web.dom.click:succeeded`. Core therefore
   reported `passed`, but the fixture oracle reported `failed`; the runner then
   failed `action.dispatch` because no `web.browser.navigate:succeeded` attempt
   existed. This explains the apparently contradictory reported-pass/oracle-fail:
   Core completed the entire one-node Flow it was given, while that incomplete
   Flow stopped on W10's intermediate page and did not reach the declared final
   state. It is a real false success, correctly rejected by the oracle.

3. **Neither Flow start nor runtime lost a node.** The failed row started at
   candidate 0, Core's only action succeeded, and there was no structured
   automation failure. The Flow lane separately checks that the first attempt
   maps to proposal candidate 0 before checking action expectations
   (`packages/test-runner/src/flow-lane/run-flow-lane.ts:168-180,215-220`). The
   persisted-run reader derives that index from Core's first recorded attempt
   and the proposal candidate map
   (`packages/test-runner/src/flow-lane/persisted-flow-run.ts:191-215`). Thus
   neither a wrong start nor runtime early-stop explains the absent navigation:
   it was absent before approval.

4. **The mapper maps a navigation when it receives one.** The host mapper turns
   each executable recorded observation into the corresponding candidate
   (`domain/src/web-panel-host.ts:113-138`), while the input model binds the
   navigation input to `web.browser.navigate`
   (`domain/src/io/input-model.ts:76-82,95-106`). Its direct Core-backed test
   proves a typed navigation is proposed once and the recording-start
   navigation not at all (`domain/src/tests/web-panel-host.test.ts:178-183`).
   The final failed proposal's single candidate is therefore evidence that the
   second navigation did not reach the mapper as an executable typed-navigation
   observation, not that the mapper converted it to a click.

5. **The trigger is a race in rapid consecutive navigations.** The scenario
   driver implements `navigate` as an immediate `page.goto`
   (`packages/test-runner/src/scenario-steps/step-runner.ts:73-85`). In the failed
   bundle, click, landing wait, and explicit navigate completed in 51 ms, 8 ms,
   and 14 ms; the passing variant's recording used 57 ms, 7 ms, and 17 ms.
   Meanwhile the navigation recorder collapses commits for 250 ms, keeps a
   click as an explainer for 5 s, replaces a pending navigation in the same tab,
   and drops a non-typed navigation while an explanation is active
   (`apps/extension/src/background/connection/navigation-recorder.ts:7-12,79-89,92-115`).
   Intake feeds browser transition origin into that debounced path
   (`apps/extension/src/background/connection/recorded-event-intake.ts:105-128`).
   The bundle does not retain the browser transition type, so the precise last
   callback ordering is an inference; the vulnerable timing is direct.

6. **The candidate-count variation predates this final bench.** Stage 2 ran the
   identical W10 `broken-link` recording three times and observed candidate
   counts **1, 2, 1**, with extension/Core action counts **1/1, 2/2, 1/1**
   (`reports/l-stage2.md:1240-1263`). A later partial bench observed both W10
   primary and variant starting at candidate 0 (`reports/l-stage2d.md:477-481`),
   and Stage 2's partial bench had a passing W10 primary Flow
   (`reports/l-stage2.md:1416-1418`). Final B repeats the split back-to-back:
   primary had 24 entries / 1 candidate and failed; `broken-link` had 25 entries
   / 2 candidates and passed with the expected `navigation_unexpected` failure.
   The recording mapper cannot explain a 1/2 candidate oscillation from the
   same script unless its input observations differ.

## Determinism and smallest fix

- **Outcome conditional on the recording is deterministic:** one candidate
  yields click-only, Core reports success, the final-state oracle fails, and the
  expected navigation check fails. Two candidates allow the primary Flow to
  reach the final state; the armed variant fails its first click as intended.
- **Which recording is produced is not deterministic.** The historical 1/2/1
  split and final B's adjacent 1/2 split establish a timing-dependent flake.
- **Smallest defensible fix scope:** the Lab recording driver, not the W10
  oracle. Before a scripted `navigate` that follows a navigation-causing user
  action, wait for the recorder's prior navigation observation to settle (an
  acknowledgement/barrier is preferable; a bound safely above the 250 ms
  debounce is the narrow fallback). This can be localized to
  `packages/test-runner/src/scenario-steps/step-runner.ts` plus its tests. Do
  not weaken `expected.actions`, change the final-state oracle, skip W10, or
  reinterpret Core's one-node success as product success.
- A broader production fix in `navigation-recorder.ts` / `recorded-event-intake.ts`
  would need to preserve the existing redirect-collapse rule while preventing
  a later intentional navigation from replacing or being explained by the
  prior click. That may be desirable, but it is not the smallest Week 1 fix and
  cannot safely be reduced to “record every URL in the debounce window.”

## Required tests and campaign consequence

1. Add a deterministic unit test around the new driver barrier: a click landing
   remains pending, the next scripted navigate cannot begin until that landing
   has crossed the settle bound, and removing the barrier fails the test.
2. Keep the existing mapper test that a typed navigation produces exactly one
   `web.browser.navigate`; add an integration-shaped test if the barrier exposes
   an acknowledgement rather than a fixed clock.
3. Live proof after the fix: W10 primary Flow at least 3/3 with two proposal
   candidates, start candidate 0, attempts containing both
   `web.dom.click:succeeded` and `web.browser.navigate:succeeded`, with both
   reported and oracle verdicts passed. Re-run `broken-link` 3/3 and require two
   proposal candidates even though execution correctly stops on its first
   failed click with `navigation_unexpected`.

**Both final benches must restart from repeat 0 after the fix.** Any driver or
extension change creates a new downstream pin; retaining pre-fix rows would mix
pins and preserve a known timing-dependent false-success hole. Bench A and B
must therefore be regenerated in full at the same pushed downstream/Core pins.

## Verification limits

- No raw recording timeline is retained in the safe bundle, and the Core
  workspace is cleaned after the run, so I could not directly name the missing
  browser transition type or callback order.
- I did not reproduce the race or validate a fix. The confidence comes from the
  source timing contract, the final bundle's candidate/action/verdict chain,
  and the historical candidate-count oscillation.
