# t196 — state-digest cost and ignored redirects

Lane lead t196, 2026-09-30. **Status: route-state follow-up done, ready for the next integration round.** No live or
Lab run (brief).
Trees: Core `C:/Users/osrs_/FluxStuff/fxwork/t196/!FluxIQ` and extension
`C:/Users/osrs_/FluxStuff/fxwork/t196/!FluxIQWebExtension`, both `task/t196-state-digest-cost` (Core from `f0dbbd6`).
Evidence: `C:/Users/osrs_/FluxStuff/!FluxIQWebExtension/docs/working/language-driven-flow-loop-plan/reports/looking-at-page-repeat.md`
and the t193/t194/t195 bundles named below. Worker reports beside this file: `t196-wD-domain-digests.md` (domain),
`t196-wL-loop.md` (Core loop).

## Fix log

### Follow-up after merge (Core 204119b / downstream cccd1e96): the route-state captures

The walkthrough (`flow-builder-walkthrough.md` §3, and §7 bullet 3) found that build routing still asked the host
for a full page capture in two places: at build start (`route-state.ts` `startAutomationStudioBuildRouting`), and
before every decision whose shown entries had grown (`observing`). A fresh `git status` showed both trees clean, with
dev merged in (Core `f0cdcfc`, downstream `aa8efb52`: t174, t191, t193).

6. **Contract (lead).**
   - An execution result may carry `routeState`: the route state of the page the call left, projected from the call's
     own capture exactly as the host's `observeRouteState` projects a fresh one (`llm/evidence-loop/tool-execution.ts`).
   - The loop accepts the key and never reads it (`evidence-loop-decision.ts`).
7. **Domain (wD2).**
   - Every result that holds a page reports `routeState` from the capture the call already took: a look's capture,
     an action's capture after acting, a refusal's page, a detection's capture, or a replay step that captured.
   - It uses `domain/src/runtime/llm-evidence/snapshot-states.ts`, which replaces `snapshot-state-digest.ts` and
     computes both the digests and the route state.
   - No command was added: captures per decision are unchanged.
   - A test shows each value deep-equals `observeRouteState` on the same page, including trimmed packets and pages
     with a blocker. A mutation run failed 4 of its 15 tests.
   - One existing test, "no refusal carries a word of the page", now excludes `routeState`:
     - `routeState` holds page words by design;
     - the loop never reads it and no trace logs it;
     - the routing context used to get the same value from its own capture.
     I accepted the change.
8. **Core routing (wL2).**
   - `route-state.ts` was split into `route-state/{observe,router-state,build-routing,index}.ts`, with tests in
     `route-state/tests/`.
   - `build-routing.ts` records the `routeState` of every call through a `recording(executeTool)` wrapper, dry-run
     replay steps included. Before a decision it records the newest call's state when a call ran since the last
     decision.
   - It captures only when the newest call carried none.
   - The trigger is now "a call ran", not "the shown count grew". The old rule stopped firing once the window was
     full, so it missed 8–28 post-call states per recorded build.
   - An evidence-guided build takes its start state from the free first look, and captures it right after the look
     only when the look carried none. The one-reply path still captures eagerly.
   - `service.ts`: 3 lines (the import, `start: evidenceGuided ? "first_look" : "now"`, and
     `executeTool: routing.recording(permissions.executeTool)`).
9. **Lead.**
   - Fixed the stale path in `tool-execution.ts`.
   - Docs: Core `docs/architecture/automation-studio.md` (route state from calls) and the extension's
     `docs/architecture/web-capabilities.md`. Reference docs regenerated.
   - Rebuilt the stale `client-gateway-websocket` dist from merged dev source. The extension check needed it for
     t191's `FluxIQClientGatewayOpenError`; this is unrelated to this lane.

**Route-state captures, per decision (build-routing tests) and per replayed build.** "Before" is the old rule.
"Calls report" is the web binding now. "None reports" is a binding without `routeState`.

| Decision | Before | Calls report | None reports |
| --- | --- | --- | --- |
| Build start | 1 | 0 | 0 |
| Free first look | 1 | 0 | 1 (the start, right after the look) |
| Look / action / first re-ask | 1 each (when the shown count grew) | 0 | 1 |
| Answered from memory / amendment | 0 | 0 | 0 |
| Call with no route state (e.g. a replay step that did not capture) | 0 | 1 | 1 |
| Completion with a dry run | 1 | 0 | 1 |

| Build (replayed) | Decisions | Before | After, web binding |
| --- | --- | --- | --- |
| bigbox-run6 | 37 | 7 | 0 |
| crossborder | 22 | 5 | 0 |
| everything-store-run4 | 48 | 6 | 0 |
| run-munneauy (rebuilt) | 15 | 12 | 0 |

In a Lab build, the free first look is refused (`not_at_start_location`) and has no page, so the start still costs
one capture; so does a decision after a dry run whose last replay step did not capture.

**Validation (lead, final code).**
- Core dist rebuilt: `heavy.sh "t196 core build 4"` → exit 0.
- Domain tests against the rebuilt dist: all `llm-evidence/**/tests` plus `runtime/tests/host-runtime.test.ts`, 50
  files through the narrow runner → `# tests 383 # pass 383 # fail 0`.
- Core `heavy.sh npx vitest run …/runtime/route-state …/runtime/llm …/runtime/flow-bootstrap --maxWorkers=2
  --minWorkers=1` → `Test Files 110 passed (110)`, `Tests 1443 passed (1443)`.
- Core `heavy.sh pnpm check` → exit 0, `structure-audit: passed (195 warning(s), 354 baselined)`, and all four
  packages `check: Done`.
- `pnpm docs:check` → current.
- Extension `heavy.sh pnpm -r check` → exit 0, all packages `Done`. It failed once until the gateway dist was rebuilt.
- Extension structure audit → `passed (124 warning(s), 120 baselined)`.

**Pre-existing, not this lane.** Six tests in `runtime/tests/service-bootstrap/tests/rejections.test.ts` fail
(reported by wL2; I reran the file myself: 6 failed, the rest passed).
- Each fails because the pre-provider rejection diagnostic now carries `issueCodes: ["thrown.Error",
  "thrown.at:…field-readings.ts:6"]`.
- Those codes come from the throw-account work in dev (`80e0ce99`).
- The throw happens in command-field validation, before routing starts, in files this lane never touched.
- `runtime/tests` as a whole also times out at the 15 s default under load. It passes with `--testTimeout=120000`,
  apart from those six.
- The supervisor still needs to run `pnpm structure:baseline` (one entry can be lowered).

### First round (merged)

1. **Core contract (lead).**
   - An execution result may carry `stateDigests: { before?, after? }` from the call's own captures
     (`runtime/llm/evidence-loop/tool-execution.ts`). It is parsed in `evidence-loop-decision.ts`, and a value that is
     not code-shaped is dropped, leaving that side unobserved.
   - A binding declares it with `stateDigestsOnCalls: true` (`runtime/llm/harness-options/binding.ts`).
   - Core dist was rebuilt so the domain compiles against it.
2. **Domain digests from its own captures (wD)** (`domain/src/runtime/llm-evidence/`).
   - Every result carries `stateDigests`:
     - a look: before and after both from its one capture;
     - an action: before from its read before acting, after from its read after;
     - a refusal that carries a page: from that page;
     - a detection: from its own captures.
   - The digest is of the capture sanitized exactly as `captureStateDigest` sanitizes it (`snapshot-state-digest.ts`).
     A test shows the two are equal even when the call's packet was bounded tighter (2,500 bytes, truncated).
   - The binding sets `stateDigestsOnCalls: true`. `captureStateDigest` stays for other callers.
3. **Core loop (wL).**
   - `service/flow-bootstrap-commands/state-digest.ts` passes no hook for such a binding, so the build loop takes no
     digest capture.
   - Each call's states come from the hook or from the result, never both at one point.
   - An answer from memory takes no capture (`decision-handlers/answer-check.ts` rewritten):
     - the first re-ask of a look in an epoch is run once more for real (one capture) and compared by digest;
     - an equal digest is a verified repeat: no progress, the new result replaces the old entry, and the note is
       `llm_evidence_loop.looked_again_unchanged`;
     - a different digest is a page that moved by itself;
     - later re-asks in the same epoch are answered from memory for free.
4. **An ignored redirect bites (wL)** (`decision-handlers/look-withdrawal.ts`).
   - When the decision right after a shown redirect again asks for what the loop holds, looks are withdrawn from the
     next decision until an action runs:
     - observe-only tools are not offered;
     - `core.run_node`'s `node` enum loses the actions seen reporting `effect: observe, proposes: false` (new tool
       field `actionInputKey`, never sent to the provider).
   - A withdrawn look asked for anyway is refused as `llm_evidence_loop.look_withdrawn`. It is never answered and never
     run, and it counts toward the no-progress stop.
   - Every redirect now warns that this will happen.
   - The history records the withdrawal as a `looks_withdrawn` redirect.
5. **Docs (lead).**
   - Core `docs/architecture/automation-studio/llm-flow-bootstrap.md`:
     - per-call digests;
     - the free answer from memory and the one verifying re-run;
     - look withdrawal.
   - Extension `docs/architecture/web-capabilities.md` (capture_snapshot): what a build captures.
   - Core reference docs regenerated (`node scripts/docs-reference.mjs`, 2,680 declarations).

## Captures per decision type (domain tests with a command-counting gateway, wD)

| Decision | Before | After |
| --- | --- | --- |
| Look (free first look or model look) | 3 | 1 |
| Action that runs | 4 (+ the action) | 2 (+ the action) |
| Action refused before acting | 3 | 1 |
| Detection, page-wide / around a target | 3 / 4 | 1 / 2 |
| Look answered from memory | 1 | 0 (first re-ask in an epoch: runs, 1) |
| Withdrawn look (refused) | — | 0 |
| Dry-run replay step (ran / failed) | 0 / 1 | 0 / 1 (Core never digested replays) |

**Action is 2, not the brief's target of 1.** The read before acting is kept. The model decides seconds after its
last look, and the page can move without a command in that time (late results, redirects, timers). Reusing an older
capture would change four things, so it would no longer be exactly as correct:
- which stale handles are refused before acting;
- the control the person is asked about;
- where a dry run resets to;
- `pageChanged`.

The full reasoning is in `t196-wD-domain-digests.md`, task 3.

## Core loop, per decision (`decision-handlers/tests/state-digest-cost.test.ts`, wL)

With a `stateDigestsOnCalls` binding, no decision type makes a digest-hook call:
- free look, action, look, first re-ask and "look again" each make 1 `executeTool`;
- later re-asks and withdrawn looks make 0.

With a legacy hook binding, each executed call makes 2 hook calls and an answer from memory makes 0 (it used to make 1).

## Before and after per build

**run-munneauy, rebuilt with the real loop** from its recorded shape (wL, `state-digest-cost.test.ts`):

| | Decisions / provider calls | executeTool | Digest-hook calls | Answered from memory | Ended |
| --- | --- | --- | --- | --- | --- |
| before (recorded; hooks derived from f0dbbd6) | 18 / 18 | 9 | 28 | 9 | `repeat_without_progress` at 18 |
| after, `stateDigestsOnCalls` | 15 / 15 | 9 | **0** | 3 | `repeat_without_progress` at 15 |

- Decision 8, the first re-ask, is run once more and verified unchanged.
- Decisions 9–11 are answered from memory.
- The redirect after 10 is ignored at 11, so looks are withdrawn from 12.
- The looks scripted at 12–15 are refused, not answered.

**Captures and wall time on the four recorded shapes.**
- Method: each recorded step (`snapshots/flow-lane.json`) is classified and costed with the table above
  (`scratchpad/t196-measure.cjs`).
- The ms per digest capture is the median of the build-trace gaps that are one digest capture each ("loop start" →
  "tool start", "tool end" → "decide start"), where the log has them.
- "After, captures only" leaves the decisions as recorded. Only run-munneauy was replayed, so only its row includes
  the decisions that withdrawal saves.

| Build | Decisions | Provider calls | Captures before | Captures after | ms per digest capture | Build ms before | Build ms after (captures only) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| t193 run-munneauy | 18 → 15 (replayed) | 18 → 15 | 39 | 12 (replayed; 13 on the recorded 18) | ~120 (no trace in bundle) | 46,461 | ≈ 43,300; ≈ 38,500 with the 3 decisions withdrawal saves (≈ 1.6 s each) |
| t193 run-munnq7vz | 64 | 63 | 146 | 57 | 111 (45 samples) | 179,890 | ≈ 170,000 |
| t194 run-munnhi5q | 32 | 25 | 75 | 35 | ~120 (no trace in bundle) | 343,580 | ≈ 338,800 |
| t195 run-munnop9n | 41 | 32 | 77 | 35 | 57 (30 samples) | 158,944 | ≈ 156,600 |

- Captures fall by 55–69% on every shape, and all of what remains is the calls' own reads.
- Provider calls change only where withdrawal ends a stall earlier (run-munneauy −3). run-munnq7vz had 5+ answered
  runs, so it is the build most likely to be shortened further; that needs a live run to know.

## Validation (lead, final code)

- Core `heavy.sh "t196 core check" pnpm check` → exit 0. `structure-audit: passed (195 warning(s), 354 baselined)`;
  contracts, client-gateway-websocket, fluxiq and apps/web `check: Done`.
- Core `npx vitest run src/programs/automation-studio/runtime/llm --maxWorkers=2 --minWorkers=1` → `Test Files 69
  passed (69)`, `Tests 658 passed (658)` (baseline 68/651).
- wL: flow-bootstrap + recovery + service + service-bootstrap state-digest test → `109 passed`, `1463 passed | 1
  skipped`.
- Core dist rebuilt with the final code (`heavy.sh "t196 core build 2" pnpm --filter fluxiq build` → exit 0).
- All 47 domain `llm-evidence` test files against it (wD's narrow runner, `heavy.sh`) → `# tests 350 # pass 350
  # fail 0`.
- Extension `heavy.sh "t196 ext -r check" pnpm -r check` → exit 0, every package `Done`.
- Extension `node scripts/structure-audit.mjs` → `passed (124 warning(s), 120 baselined)`.
- Core `pnpm docs:check` → `Deterministic framework reference is current.`

## Not verified

- No live run: the side-panel effect and live wall time come from the next integration round's live lanes.
- The one-capture-per-action target was not met: an action takes 2 (see above).
- Recovery's annotation exploration still calls `captureStateDigest` directly (a full capture), because `recovery/**`
  is outside this lane. Builds are unaffected.
- The per-build capture counts are costed from recorded shapes, not counted from the extension; the per-type costs are
  counted in domain tests.
- A detection capture is assumed to digest like a plain capture.

## Notes for integration

- Core and domain must land together: the domain's results carry `stateDigests`, which older Core rejects as an
  unknown key (`tool_result_invalid`).
- `evidence-loop.ts` is 740 lines (limit 800).
- The older t189 replays run with `lookWithdrawal: false` and no hook, so they still reproduce their logs.
- The regenerated reference docs will conflict with any other lane that regenerates them; regenerate after merging.
