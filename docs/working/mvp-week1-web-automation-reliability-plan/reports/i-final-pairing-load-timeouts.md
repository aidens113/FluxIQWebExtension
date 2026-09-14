# `i-final-pairing-load-timeouts` — Stage 4m pairing failures under concurrent load

**Status:** complete, read-only investigation of finalized bundles while the
two benches continued. No process, run file, source file, build, Core checkout,
or shared document was changed.

## Bounded evidence inspected

Only the five named finalized bundles' identifiers, evaluation coordinates,
run timestamps, and the error event's closed `failureCategory` /
`failureDetails` projection were inspected. No page data, event summaries,
screenshots, process logs, credentials, or raw payloads were read or reproduced.

| bench / row / lane | run id | total run (ms) | derived pre-wait phase (ms) | pairing wait (ms) |
| --- | --- | ---: | ---: | ---: |
| B / W09 / Flow | `run-mu0h2wqy-d3df58af` | 47,834 | 32,255 | 15,106 |
| B / W10 / Flow | `run-mu0h5988-fde79b62` | 47,642 | 32,172 | 15,061 |
| B / W14 / recording | `run-mu0hi94h-e3f48158` | 45,102 | 29,504 | 15,084 |
| B / W28 / recording | `run-mu0ionkx-33f5b10f` | 49,178 | 33,585 | 15,076 |
| A / W27 / Flow r0 | `run-mu0ikxzo-59acefd8` | 48,332 | 32,723 | 15,024 |

“Pre-wait phase” is a derivation, not an instrumented phase: error timestamp
minus `waitedMs` minus `run.startedAt`. Finalization followed each error by
409–585 ms. Thus the relevant measured facts are the 15,024–15,106 ms waits;
the 29,504–33,585 ms figures only locate how late in whole-run startup the wait
began.

All five bundles have the same error shape:

- exactly one event, sequence 1, trigger `error`, category
  `gateway.connection`;
- `pairingStage: pre-approval` and `timeoutMs: 15000`;
- last status `connectionState: disconnected`,
  `hasPairingReferenceCode: false`, `hasSessionId: false`, `queueSize: 0`, and
  `msSinceLastMessage: null`;
- no scenario step or action was reached.

This is independent of scenario and lane: five different corpus rows, three
Flow lanes and two recording lanes, across both concurrent benches. All five
are repeat 0 observations at the point inspected.

## What the signature proves

1. **The runner never reached approval.** `pairExtension` sends connect, waits
   for either pairing-with-code or connected, and calls `approvePairing` only
   after that first wait succeeds
   (`packages/test-runner/src/run-scenario.ts:526-531`). Therefore neither the
   approval HTTP route nor the post-approval wait can own these failures.
   `approvePairing` itself is just the authenticated route call
   (`packages/test-runner/src/http-control.ts:105-106`).
2. **The bound, not a scenario assertion, ended each run.** The wait has one
   fixed 15,000 ms deadline and 100 ms polling interval
   (`run-lifecycle/pairing-status-wait.ts:18-19,29-42`). The observed overshoot
   of 24–106 ms is consistent with the last poll/sleep and scheduling; it is
   not evidence of a second phase.
3. **The last observable extension manager had no live or previously messaged
   gateway epoch.** The safe projection is produced at timeout from exactly
   five allowlisted fields (`pairing-status-wait.ts:70-82,89-98`). In
   particular, `msSinceLastMessage: null` means that manager had no numeric
   `lastMessageAt`; it does not merely mean a stale message.
4. **Core startup had passed its existing readiness gates before pairing.** An
   isolated topology waits for the scenario health endpoint, the Core HTTP
   origin, the lazy gateway initialization request, gateway TCP listening,
   login/project creation, and project selection before returning
   (`packages/test-runner/src/coordinator.ts:92-120,122-140`). The browser and
   scenario start page are then opened before pairing
   (`run-scenario.ts:190-211`). TCP readiness is not proof that a subsequent
   WebSocket hello completes promptly.

The prior Stage 3 occurrence had the same pre-approval/one-event/no-step
position, but its then-current bundle did not retain the last status. It
occurred once in 73 concurrent bundles, with 8.78 GB free, and no approval
request was observed; the earlier report correctly left steps inside the
WebSocket hello path unresolved
(`reports/i-stage3-load-failures.md:149-190`). Stage 4m turns this from one
unlocated timing observation into five observations with a specific terminal
extension state.

## Memory and load classification

This is **not supported as a low-free-memory failure**. The shared machine's
15-second sampler nearest the five error timestamps showed 7,409, 7,568,
8,880, 7,088, and 9,002 MiB free respectively; minima in the surrounding
one-minute windows were 6,860–7,409 MiB. Those readings are bounded machine
telemetry, not bundle/page data. They are all above the campaign's 3 GB pause
threshold and the earlier >6 GB rerun criterion. The Stage 4m evidence does
not include CPU, event-loop delay, service-worker lifetime, or WebSocket frame
timing, so **concurrent CPU/I/O scheduling remains a hypothesis, not a measured
cause**.

The strongest mechanism hypothesis is loss/recreation of the extension's
in-memory connection object between connect acknowledgement and later status
polls:

- a new `GatewaySession` starts `disconnected`, with no last message, code, or
  queue (`apps/extension/src/background/connection/gateway-session.ts:82-105`);
- explicit connect first sets `connecting`; a failed socket reports `error`
  and schedules `reconnecting`, while an open socket reports `pairing` or
  `connecting` (`gateway-session.ts:108-148,217-231,301-307`);
- an actual server message records `lastMessageAt` before handling it
  (`background/connection/server-command-channel.ts:68-81`);
- the background singleton is reconstructed from storage on a new worker
  epoch, but construction does not reconnect it
  (`apps/extension/src/background/index.ts:10-26`).

Consequently, persistent `disconnected` + null last-message is not the normal
state of the same `GatewaySession` after the runner's awaited connect call.
It is consistent with a service-worker epoch reset (or another path that
replaced/explicitly disconnected the manager). There is no epoch identifier
in the bounded evidence, so that distinction is **not proven**. A server
disconnect is less consistent because receipt would set `lastMessageAt`; the
runner sends no disconnect in this phase.

**Root-cause confidence:** high (0.95) that all five share one pre-approval
handshake/lifecycle signature and that the 15-second runner bound is the
immediate failure gate; moderate-high (0.8) that the observed `disconnected`
object is a fresh background/service-worker epoch; low (0.35) that concurrent
load caused the epoch reset specifically. Memory exhaustion is contradicted
by the available telemetry.

## Smallest bounded fix and ownership

The first fix belongs in the downstream **test-runner pairing orchestrator**,
not the approval client and not Core:

1. Extract the private pairing sequence from `run-scenario.ts:526-533` into a
   focused `run-lifecycle` module so it can be tested deterministically.
2. Treat the response to the initial `fluxiq.connect` as the first status
   observation instead of discarding it (`run-scenario.ts:527`). This closes
   the response-to-first-poll observation gap.
3. During the same absolute pre-approval deadline, if a subsequent status is
   the exact cold state (`disconnected`, no reference, no session, no last
   message), reissue connect with bounded backoff/attempt count and inspect
   that response immediately. Do not reset the original deadline, do not
   approve without a reference code, and do not retry `error`, `reconnecting`,
   or a state that has evidence of a server message.
4. Preserve the existing safe timeout projection and add only bounded
   `connectAttempts` / background-epoch evidence if needed. Never publish the
   code, session, URL, errors, or settings.

That seam is recovery for a transient control-plane lifecycle loss; simply
widening 15 seconds to 30 seconds cannot recover a manager that remains
`disconnected`. Conversely, changing extension auto-connect semantics on every
service-worker wake would affect normal users, persisted destinations, and
network/security expectations. It is not the smallest Week 1 facility fix.

If the new deterministic proof below shows there was no worker replacement,
ownership should move to `apps/extension/src/background/index.ts` plus
`connection/gateway-session.ts`: preserve an explicit, non-secret desired-
connection marker and reconnect safely on worker reconstruction. That is a
product lifecycle change and needs a separate security/compatibility review;
the present evidence is insufficient to authorize it.

## Required tests and falsification

- Pairing-orchestrator unit test: connect response already contains
  pairing-with-code; approval happens immediately and exactly once without a
  status poll.
- Deterministic epoch-loss test: initial response is nonterminal, first poll
  is the exact cold `disconnected` projection, one bounded reconnect response
  supplies the code, approval occurs once, and post-approval reaches connected.
- Deadline test with injected clock/sleep: reconnects retain the original
  15-second deadline; transport latency and sleeps consume its remainder and
  no call starts after expiry.
- Refusal tests: no reconnect on `error`, `reconnecting`, code-bearing,
  session-bearing, or message-bearing status; malformed/extra-key responses
  fail closed; approval never receives an absent value.
- Cleanup/precedence tests: reconnect or approval rejection preserves the
  primary categorized failure and the topology/browser cleanup remains
  bounded.
- Mutation: restore the one-shot/discarded-connect-response behavior and show
  the immediate-observation and epoch-loss regressions fail, then restore the
  intended source exactly.
- Diagnostic live proof before claiming the mechanism: expose only a random
  non-secret background epoch id and connect-attempt/state-transition counts
  in a private test response. A forced worker restart between connect and poll
  must reproduce cold `disconnected`; the recovery must pair within the
  original deadline. Remove or keep those fields closed and test-only after
  the proof.

## Rerun matrix and acceptance treatment

These five are genuine failed executable cells and block final Week 1 bench
acceptance; they are not expected-failure rows or disclosure-only observations.
After a fix is checked and pushed at one downstream/Core pin pair:

1. Rerun the exact five cells once in isolation (>6 GB free) to prove there is
   no scenario-specific failure: B W09 Flow, W10 Flow, W14 recording, W28
   recording, and A W27 primary Flow.
2. Rerun those five cells for three repeats under the same two-concurrent-bench
   topology. Require 15/15 pairings, zero pre-/post-approval timeouts, no
   harness activation, and no secret/leak finding. Record pre-approval latency
   or bounded attempt counts for successes so the deadline is finally based on
   measured pairing data.
3. Because a runner handshake change affects every executable cell, restart
   both full repeat-three final benches on fresh roots at the new pushed pin;
   do not splice repaired cells into the current campaigns. Apply the existing
   memory/leak stop rules and compare A/B only after both complete.

If isolated runs also show epoch changes, the lifecycle defect is independent
of concurrent load. If only concurrent runs do, load is a trigger but not a
license to classify failures away. If epoch remains stable while status becomes
`disconnected`, the service-worker hypothesis is falsified and the next owner
is the extension gateway state transition path, instrumented with closed-set
transition counts rather than page or transport payloads.
