# t289 Lab and process fixes (lead report)

Brief: `mvp-final-month-plan.md`, "Briefs: fix every open item of the week report", t289 bullet. Trees
`fxwork/t289/!FluxIQWebExtension` and `fxwork/t289/!FluxIQ` (branch `task/t289-fix-lab-process`, both at dev).
Evidence: `reports/week-review/causes-late.md` W11, W18-W20, W22, W23; `friction.md` P3, P4, F14.

## Plan (worker per file partition)

| Item | Worker | Owns |
| --- | --- | --- |
| W23 off-peak guard, pid stop | A (worker) | `scripts/lab/live-guards/rules/{peak,index}.mjs`, guard clock wiring, a stop command, `run-lab.mjs`, `docs/architecture/testing-facility.md` |
| W18 killed-run spend, `environment.missing` | B (worker-high) | `live-guards/{run-outcomes,close-launch,ledger-queries,reconcile-ledger}.mjs`, test-runner spend and refusal classification |
| W19 / R2-U-10 old thread at start | C (worker-high) | extension `background/connection/project-context.ts` |
| W20 slow chat read builds nothing | D (worker-high) | Core `R/conversations/**` |
| W22 `mut4fvkm` terminal failed | E (worker-high, read-only) | its report |
| P3/P4 timeouts, stale builds | F (worker) | Core vitest configs and timeout lines, `scripts/check/**`, `scripts/lab/prelude/**`, `domain-build-staleness.mjs` |
| W11 describedNodes cache prefix | G (worker) | Core `R/llm/harness/context-packet.ts`, `R/llm/deepseek/request-{body,shape}.ts`, `R/llm/node-tools/**` |

Worker reports: `reports/fix-lab-process/<letter>-*.md`.

Dispatch note: only A launched in the first wave (subagent limit). The lead did W20 and W18 itself. C, E, F and then G ran
once slots freed.

## Results (2026-10-06, group 1: every item addressed)

| Item | Status | What changed | Evidence |
| --- | --- | --- | --- |
| W23 off-peak | fixed | New rule `live-guards/rules/peak.mjs`: refuses weekday 01:00-04:00 and 06:00-10:00 UTC unless `lab-slots/OVERRIDE-peak` exists. Added to `RULE_NAMES` (`rules/guard-state.mjs`); test clocks are now UTC. | `a-peak-and-stop.md` |
| W23 pid stop | fixed | `node scripts/lab/run-lab.mjs stop <instance>` (`scripts/lab/stop-run/`): kills the process tree of the pid the ledger `start` names, never a command-line pattern. Refuses with no open launch, a dead pid, or a start older than 6 h. Then reconciles the ledger. | `a-peak-and-stop.md`; refusal observed on a nonexistent instance |
| W18 killed-run spend | fixed (lead) | `run-outcomes.mjs` reads a `.staging-run-*` directory as that run with `verdict: "killed"` and `killed: true`. Its cost and balance failure come from the step log Core writes from the first call (`lab-runs/<date>/<runId>/steps/*/meta.json`, new `step-log-outcome.mjs`). `guardFiles().labRuns` is `lab-runs` beside `lab-slots`. `closeLaunch` passes it through and marks `killed`. The debug rule now asks for a killed run's debug. `unchanged` skips killed runs. A finalized bundle wins over its staging copy. A call in flight at the kill is not counted (no meta yet). | `live-guards/tests/killed-run.test.mjs`: 0/3 before, 3/3 after |
| W18 `environment.missing` | already fixed | Downstream `30c0b76c` (t267 S5) `contractRefusal`: a 400 is `facility.contract`, naming the endpoint. | `dist/tests/existing-fluxiq-control.test.js` test 24 ok |
| W19 / R2-U-10 | fixed (product) | `background/connection/project-context.ts`: `resolve()` asks Core's current context first (1 s bound, answer reused for 1 s) and adopts it. It falls back to the stored project only when Core names none, is unreachable or is slow. A recording keeps its own project. No Lab change: the Lab selects the project before the browser launches. | `c-start-thread.md`; 12 new tests in `connection/tests/core-api.test.ts`: 4 fail before, 110/110 pass after |
| W20 slow chat read | fixed (lead) | Core `conversations/instructions/fallback.ts`: a declared phrase counts only when it is at least half of what was asked (`phraseIsWhatWasAsked`). Lane D's live task "Go through my friend requests ..." matched the one-word phrase `go`, and "run it" reduces to `run`. Read without the model, it therefore ran an unrelated Flow (or answered "no Flows yet") instead of building. t227's `describedJobDecision` (Core `04267ae1`) already built the earbuds, cart and hub tasks. | `instructions/tests/fallback.test.ts`: the new test failed (`run.execute`) before the fix; conversations directory 18 files / 131 tests pass after |
| W22 `mut4fvkm` | cause found; fix is t283's | s6 was state-routed to s9, so s7 and s8 never ran. The Flow has no End node, so `graph-run.ts:692-707` `hasUnvisitedAutomationStudioNodes` (`graph-navigation.ts:13-16`) returned `failed`. The rule is unchanged on dev. Fix (t283, `executor/graph-navigation.ts`): count the nodes a forward state route jumped over as visited. The downstream Lab miss was already fixed by `14cd066b`. | `e-mut4fvkm-terminal.md` |
| P3 timeouts | fixed | 32 heavy Core service test files each get a `vi.setConfig` timeout: 120 s for the 9 slowest, 60 s for the rest. | `f-timeouts-and-stale-builds.md` |
| P4 stale builds | fixed | `scripts/check/core-build.mjs` now also gates the build/test scripts of domain, extension, test-contracts and test-runner (new `gate-name.mjs`). Core `apps/web/vitest.config.ts` refuses a stale or missing `fluxiq`/`contracts` dist and names the command. Each gate refuses rather than rebuilds, because Core is shared by sibling tasks. | `f-…md`; check tests 3 fail before, all pass after |
| W11 cache prefix | was not gone; fixed | After t280, `describedNodes` gained entries in the constant head, which recached the tools and window once per distinct node. Now the call that first describes a node carries the definition on its own window entry (`node-tools/described-nodes-key.ts`, `request-body.ts`). The head keeps only nodes no window entry names. Model wording updated. | `g-described-nodes-cache.md`: the prefix test failed at byte 4,193 before the fix; after it the shared prefix runs to the end of request 1's window |

## Lead validation (observed)

- Core `node scripts/build-cache/cli.mjs fluxiq:check` exit 0; `structure-audit:check` passed.
- Core vitest: node-tools, deepseek, harness, harness-options tests, `provider-cache-prefix.test.ts` and `conversations/` gave
  "Test Files 85 passed (85), Tests 779 passed (779)". Consumers (activity wording, evidence-loop tests, build-routing,
  state-digest, action-of, repeat-guard, decision-handlers) gave "38 passed (38), 447 passed (447)".
- Core `pnpm.cmd build` exit 0.
- Downstream: `node --test` over live-guards, lab, stop-run, check and prelude tests gave "tests 82, pass 82, fail 0".
  `node scripts/check/core-build.mjs` printed "current with its source". Extension connection and panel-relay bundles
  (run-subset, 25 files) gave "tests 259, pass 259". `pnpm.cmd --filter` check exited 0 for extension, test-runner,
  test-contracts and domain. `node scripts/structure-audit.mjs` printed "passed (172 warning(s), 118 baselined)". The
  only new warning is advisory: `scripts/lab/live-guards/` has 16 files against a 15-file threshold.

## Remaining

- W22 instrumentation (t289): the creation snapshot (`flow-lane/creation/authored-nodes.ts` and the `AuthoredFlowNode`
  contract) still keeps action nodes only. Add control node ids and an edge list so a bypassed path can be proven.
- Core fix for W22 belongs to t283 (`executor/graph-navigation.ts`).
- G's open follow-ups, in t287-owned files: the repeat guard and `noProgress` see a node's first result (which carries
  its definition) differ once from later identical results. `failed-call.ts` drops the marker on an invalid result.
- C's residual risk, in `core-api.ts`: Core's snapshot still lists closed sessions with their old project.
- F: `task/start.mjs` builds only an unbuilt Core, so a stale paired Core is now refused at its `pnpm build`. The
  `runtime-stream-store` million-event test is unchanged.
- Not verified anywhere: no live, Lab or browser run, so the panel's moment 01 and the peak refusal at a real peak
  time have not been observed live. The real `taskkill` path never ran.
