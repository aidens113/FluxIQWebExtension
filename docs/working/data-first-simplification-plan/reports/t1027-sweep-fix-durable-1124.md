# t1027 report: the 11-24 sweep's durable-press failure

Worker: worker-heavy (Opus). Tree `fxwork/t1027-sweep-fix-durable-1124`, branch `task/t1027-sweep-fix-durable-1124`.

## Outcome

Blocked at the Core boundary. No source was changed.

The failure is not a regression from today's merges, and the not_seen proof is read correctly. Neither the product's not_seen handling nor the test fixture is wrong.

The cause is a timing race in Core's durable dispatch, `packages/fluxiq/src/client-gateway/service/command-ledger/dispatch.ts`. For a required (observed) command, the answer-window timer stays armed after the answer has been accepted. If it fires while the receipt is being committed and the observer is completing, the accepted answer is revoked as `outcome_unknown`. The run then stops as "Outcome uncertain", even though the browser answered on time. The sweep starved the event loop enough to lose that race. Fixing this means changing Core, which this brief does not allow me to touch.

## What changed and why

Nothing is changed in the tree. I added a temporary probe test, `domain/src/io/tests/zz-t1027-probe.test.ts`, to reproduce the failure. I deleted it and its build directory afterwards. A copy is at `C:\Users\osrs_\AppData\Local\Temp\claude\bc302d3e1bd85154\b9e846ce-920f-4917-ba85-cff713b3e423\scratchpad\zz-t1027-probe.test.ts`. The probe is the real test with one change. Right after the scripted client schedules its answer to press N (`T1027_BLOCK_AT`), it busy-waits for `T1027_BLOCK_MS` to starve the event loop. It also logs the run.

### What the evidence shows

1. **Not a regression.** Since 2026-11-15, no commit touches the code path, downstream or in Core. I checked `domain/src/io`, `domain/src/runtime`, `domain/src/output-nodes` and `domain/src/client`. In Core I checked `client-gateway`, `runtime`, `engine/automation/command-scope` and `engine/automation/step-loop`, and none of today's merges (t1013, t1014, t1016, t1017, t1018, t1019, t1020) are in that path. The test dates from `b58433ef7` (2026-10-10, t427). The armed timer comes from Core `a64c6d8d7` (t329, 2026-10-07): `entry.phase = "reserved"; if (!entry.observer) clearTimeout(entry.timer);`. Today it reads `if (!entry.observer) entry.timer?.cancel();` in `accept()`. Running the test at earlier commits would prove nothing, because it passes at the current commit unless the event loop is starved (point 2).
2. **It passes when the event loop is not starved.** It passed in isolation, 5/5 tests. With 12 copies in parallel on 8 cores it passed 12/12, at 21 to 25 s each. A full domain suite rerun at this commit passed 3208/3208. In that rerun the test took 9.9 s, and the other tests in the same file took 7.5 to 15.5 s.
3. **Starving the event loop reproduces the sweep's exact failure.** Each line below is a probe run on the not_seen test:
   - Stall 4000 ms after the retried "first" press is answered → `failed`, `run.outcome_uncertain`. The message matches the sweep log word for word: "Outcome uncertain: The step's answer never came back … Nothing on the page shows whether the step took effect; it was not done again." It recorded `pressed ["first","first"]` and `asked 1`.
   - Stall 4000 ms on the "second" press → the same failure, with `pressed ["first","first","second"]`. So the race is not specific to not_seen. Any answered required command can lose it.
   - Stall 2000 ms on the retried press → it fails the same way.
   - Stalls of 1500, 1000, 500 and 0 ms → it passes.
4. **How it happens.** `asked` stays 1, so the window timer did not find the entry still `waiting`; otherwise it would have asked the client again. So the timer fired during `reserved`: the answer had been accepted, and the receipt commit and `observer.completed(proof)` were still running. In that state, `answerNeverCame` calls `uncertain(entry)`. With an observer present, that aborts the entry, the proof is revoked, the result is `outcome_unknown`, the domain dispatcher reports the outcome unknown, and the run fails with `executor.required_outcome_unknown` and stops as Outcome uncertain.
5. **The fixture's margin is thin.** The node's `timeoutMs` of 200 plus `COMMAND_ANSWER_MARGIN_MS` (3000) gives a 3.2 s window. The probe shows that on a quiet machine the observed completion after the answer takes most of it: a stall of about 1.5 s still passes, and 2 s fails. The completion runs `command-run/controller.ts` `observe()`, which calls `live()` twice and does storage reads and commits. The sweep ran every test file's import in one process alongside three other packages' suites, which is enough to use up the remaining 1.2 to 1.7 s.
6. **Lasting-act safety holds.** In every failing probe, the retried or second press was never repeated. The latch is conservative. The defect is a false "Outcome uncertain" stop on a press that really answered, not a repeated press.

### Why I did not change the test

I did not change the test. Raising the node `timeoutMs` would only widen a real-clock window and hide a Core hazard, which the root-cause rule forbids. The test pins no behaviour that a named commit changed. Moving it onto a channel-scoped session with a virtual timer source would stop it testing the live paired path it is meant to prove.

### Live risk (inference, not measured live)

A required run whose press answers close to its `timeoutMs + 3000` window, on a busy machine, can be stopped as Outcome uncertain even though the press answered.

### Recommended Core fix (a Core task, a decision for the lead)

Core pins the current behaviour on purpose. In `command-ledger/tests/dispatch.test.ts:100`, the "timeout" case of "required %s revokes proof before unknown resolution and drains the late observer" expects it, and t329's architecture text says "Deadline, cancellation and close revoke the proof before success resolution". So this is a design change, not a slip:

- Once `accept()` has reserved a command's answer, the answer window has been met. Cancel the answer timer for observed commands as well. Keep the abort-signal revocation, the close revocation, and the runtime deadline (`timeoutMs + 3000 + 15000` in `runtime/service.ts`) as the bounds on the commit and observer work.
- In `dispatch.test.ts:100`, keep the `abort` and `close` cases. The `timeout` case becomes "an answer accepted before its window ran out completes, even when the window ends during the observer". Use the gateway's `startTimer` option to fire the window deterministically while the observer is gated.
- Add a Core test that an answer that really never came still reconciles or goes unknown.
- Separately, it would be worth measuring why the observed completion takes over a second (`observe()` → `live()` → `fingerprint()` → `getRuntimeSession`).

## Commands run and observed results

- `DOMAIN_TEST_BUILD_LABEL=t1027 node scripts/test-domain.mjs io/tests/gateway-output-dispatcher-durable-reconcile` (from `domain/`) → exit 0, 5/5 ok.
- 12 parallel `node --test-name-pattern="never received" .test-build-scratch/t1027/io/tests/gateway-output-dispatcher-durable-reconcile.test.mjs` → 12/12 `ok`, `duration_ms` 21580 to 25110.
- Probe runs (`T1027_BLOCK_AT`/`T1027_BLOCK_MS`): `2/4000` → exit 1, `T1027PROBE {"status":"failed",…"failureCode":"run.outcome_uncertain",…"pressed":["first","first"],"asked":1}`. `3/4000` → exit 1 with `pressed ["first","first","second"]`. `2/2000` → exit 1. `2/1500`, `2/1000`, `2/500` and `0/0` → exit 0, `"status":"succeeded"`.
- `DOMAIN_TEST_BUILD_LABEL=t1027-full node scripts/test-domain.mjs` (full domain suite, in the background) → exit 0, `# tests 3208`, `# pass 3208`, `# fail 0`, `# duration_ms 834292`.
- Acceptance check `DOMAIN_TEST_BUILD_LABEL=t1027 node scripts/test-domain.mjs io/tests/gateway-output-dispatcher` → exit 0, `# tests 57`, `# pass 57`, `# fail 0`.
- Whole `io` directory, `DOMAIN_TEST_BUILD_LABEL=t1027 node scripts/test-domain.mjs io/` → exit 0, `# tests 65`, `# pass 65`, `# fail 0`.
- `pnpm --filter @fluxiq-web-extension/domain check` → exit 0. The output said "core-build: FluxIQ Core's build … is current with its source" and the step was restored from the shared store: `{"build-cache":"reuse","step":"domain:check",…}`.
- `node scripts/structure-audit.mjs` → exit 0, `structure-audit: passed (259 warning(s), 551 baselined).`

## Not verified

- I could not re-read the sweep log. `fxwork/t1021/!FluxIQWebExtension` was removed while I was working. I captured its failure block earlier: test 341, `duration_ms 11650`, the message above, and the other tests in the file at 4.4 to 5.9 s.
- I did not measure event-loop delay inside the original sweep process. "Starvation in the sweep" is inferred from the reproduction and the duration spread, not measured there.
- I did not instrument or time the exact post-answer completion inside Core. The 1.2 to 1.7 s figure comes from the stall thresholds.
- Nothing was run live in a browser.

## Open questions or contradictions found

- Core's pinned t329 contract, that a deadline revokes the proof before success resolution, conflicts with the user's rule that only an act whose effect is uncertain is held back. Here the press answered and its receipt was committed, yet the run stops as uncertain. Whether to change t329's timeout case is a decision for the lead, and it needs a Core task in a nested layout.
- The task brief's premise was "the product now holds back a press that provably never reached the browser". It does not: the not_seen press is made again (`pressed ["first","first"]`, `asked 1`). What is lost is the re-made press's own answer.
