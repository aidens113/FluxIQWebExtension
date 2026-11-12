# B3b: deadline overrides (t899)

## Outcome
Done. A run's `frame.deadlines` now governs the model call, the Flow-less judge, the model-silence backoff and the person wait. No frame: today's behaviour exactly.

## What changed and why (Core, `packages/fluxiq/src`)
- `runtime/llm/harness/run.ts`: `timeoutMs = frame.llmCallMs ?? input.timeoutMs ?? 20 s default`. The 1..45,000 check below it still applies, so a value over the provider maximum is refused unsent (`llm.provider_invalid_timeout`). `request.timeoutMs` is what the providers read (anthropic, deepseek, session-key provider), so the value reaches the provider call.
- `runtime/result-verification/flow-less/judge.ts`: check deadline = `input.deadlineMs ?? frame.judgeMs ?? deadlineMs(frame.llmCallMs ?? input.timeoutMs)`. Its model calls are sent through the harness with `timeoutMs = frame.llmCallMs ?? input.timeoutMs` (the harness also applies the frame itself).
- `runtime/answer-first/keep-going/backoff.ts` (the schedule is read here; `backoff-schedule.ts` unchanged, it is the default): base and cap from `frame.modelSilence`, each falling back to Core's 5 s / 60 s; cap is never below base. Still a schedule of waits only: the count of asks is unbounded (the `count >= 30` guard only avoids overflow).
- `framework/automation-service/service/fluxnode/events/person-sink.ts`: see below.

## Person wait: decision
Findings: the answer-first path wraps the port with `automationStudioAnswerFirstUnboundedPort` (rounds.ts, round.ts, flow-run/person-check-port.ts), which drops `expiresAtMs`, so there the sink never saw an expiry. `flow-stage.ts:75` hands the raw port to `personCheck`, and `person-needed-ask.ts:129` passes `expiresAtMs = now + min(ask.timeoutMs, 300 s)`, which is Core's default. There the old `Math.min` capped a developer's raised `personWaitMs` at 300 s.
Decision: a developer's `personWaitMs` yields nothing to that Core default. When the run's frame sets `deadlines.personWaitMs`, the sink waits `now + personWaitMs` and ignores `wait.expiresAtMs`. With no frame value, the old `min(now + waitMs, expiresAtMs)` holds. The robot-check still pauses for a person (the `person_needed` event is still raised and waited on); nothing is skipped. Not changed elsewhere: the conversation port's own thread expiry (`conversation-port.ts:90`, Core's 300 s ask timeout) is not used by this sink (it waits on run events), so no other change is needed for the FluxNode path. A non-FluxNode caller that uses the thread-based port still expires at Core's 300 s, as before.

## Deadlines table
| Deadline | Default | Bound | Read where |
|---|---|---|---|
| llmCallMs | 20,000 ms (`AUTOMATION_STUDIO_LLM_DEFAULT_TIMEOUT_MS`) | 1..45,000 (contract schema 1,000..45,000; harness refuses outside 1..45,000) | `llm/harness/run.ts` (the judge's calls too, `flow-less/judge.ts`) |
| judgeMs | `max(30 s default, 4*2*timeout... ` per `automationStudioResultVerificationDeadlineMs(callMs)`, i.e. `max(default, 2*asks*callMs + 30 s)` | 30,000..1,800,000 (contract) | `result-verification/flow-less/judge.ts` |
| modelSilence | base 5,000 ms, cap 60,000 ms, doubling | contract-bounded; Core only forces cap >= base | `answer-first/keep-going/backoff.ts` |
| personWaitMs | service default (`PERSON_WAIT_MS`, set in `create-fluxnode-service.ts`); old min with ask expiry | contract 1,000..7 days | `fluxnode/run-fluxnode.ts` passes it; `events/person-sink.ts` reads frame presence |

Note: the judge's old verdict-time deadline for the build-side judge (`verify.ts`) is not touched; only the Flow-less judge was in scope.

## Commands run and observed results
- `pnpm --filter fluxiq exec vitest run src/runtime/llm/harness/tests src/runtime/result-verification/flow-less/tests src/runtime/answer-first/keep-going/tests src/framework/automation-service/service/fluxnode/events` -> after fixing my own test, 38 files, 298 tests; the one failure was mine (fixed); a first run also showed another worker's in-flight `judged-summary.ts` (`automationStudioJudgeCriteriaText is not a function`), gone on the rerun.
- Rerun of the touched files after the last edits: `run.test.ts` + `judge-deadlines.test.ts` -> 24 passed; `person-sink.test.ts` -> 3 passed; `backoff-overrides.test.ts` -> 5 passed (earlier run).
- `node scripts/structure-audit.mjs` (Core root) -> 8 violations before my last fixes. Mine were two (harness tests dir over 25 files because I added a file; a packed statement in `judge-deadlines.test.ts`); both fixed (my harness tests moved into `run.test.ts`). A grep of the final output for my directories shows none. Remaining violations are not mine: docs links in `docs/fluxnodes`, `run-overrides/tests/prompt-text.test.ts` imports, and `provider-task/tests/overrides.test.ts` missing/in flight.

## Tests added
- `llm/harness/tests/run.test.ts` (appended): frame wins over caller timeout; no frame unchanged; 60 s refused unsent; two concurrent frames.
- `flow-less/tests/judge-deadlines.test.ts`: judgeMs cut-off; llmCallMs reaches the judge's call; caller deadlineMs wins; no-frame timeout; two concurrent frames.
- `keep-going/tests/backoff-overrides.test.ts`: base/cap, partial, sentence, no frame, concurrent.
- `fluxnode/events/tests/person-sink.test.ts`: no frame = nearer deadline; frame outlasts ask expiry and still waits; concurrent.

## Not verified
Typecheck (not run, per brief). Full structure audit does not pass at the root because of other workers' files. The judge's llmCallMs is exercised through a hanging mock provider, not a live one.

## Open questions
A caller of the thread-based port still expires at Core's 300 s; confirm that is acceptable for FluxNode (it does not use that port).
