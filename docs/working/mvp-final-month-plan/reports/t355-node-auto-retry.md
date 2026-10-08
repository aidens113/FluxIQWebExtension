# t355 every node retries automatically, in every execution path

Worker: t355-node-retry (worker-high). Worktree `C:\Users\osrs_\FluxStuff\fxwork\t355` (Core-paired, branch `task/t355-node-auto-retry` on both sides). Nothing committed.

## Outcome

Done for the code and the tests. The Lab proof is partial.

- **One named default.** The first attempt plus 3 retries is `AUTOMATION_STUDIO_DEFAULT_NODE_RETRY_POLICY` in Core (`runtime/executor/retry-policy.ts`). It is a floor: no caller can set it lower.
- **Every path now runs under it:**
  - saved-Flow playback (Core graph executor);
  - candidate trials, which ran each step once until now;
  - exploration `core.run_node`, which dispatched once until now;
  - mid-build test replays, which dispatched once and decided "remembered" on one look until now.
- **Lasting acts are checked, not repeated.** Core's act-twice gates and the domain's new `lastingActChecked` mean a press whose effect may have landed is never blindly repeated.
- **Fail-first tests exist for each path.** They pin the default: a late target succeeds on attempt 4, and a target that never appears fails after exactly 4 attempts with the attempts reported.
- **Lab:** one provider-free crossborder-marketplace Flow-lane run, `run-muyta37c-a9368bca`.
  - The busy coupon claim was retried and succeeded: attempt 2 of 4.
  - The never-appearing target failed after exactly 4 attempts, waits 250/1000/2000 ms.
  - The run's verdict is still **failed**. The cause is t347's cause 2, which is not t355's: the recording replays the person's second coupon press after the runtime's retry already collected the coupon.
  - Exploration and trials cannot be exercised provider-free, because both need a model. They are proven only by unit tests.

## The map: what waits and what retries, per path, before t355

Every web command, on every path, reaches the content script through `executeContentAction` (`apps/extension/src/content/actions/execute.ts:136`). That is layer 1. Layer 2 is a retry across whole node attempts, and before t355 only the graph executor had one.

**Layer 1: in-page actionability wait (extension, every path, unchanged by t355).** `recovery/attempt.ts` `runWithRecovery` runs the verb again after a recoverable fault. The verb re-resolves its target each time, so a late, moved or stale target is the same fix. It also clears a layer standing over the target, and waits at a disabled control that is counting down. The ladders are in `recovery/budget.ts:49-82`: target 250/500/1000/2000 ms, blip 250/500, interference 150/400/800, disabled 4x1100. The whole loop is capped at `RECOVERY_BUDGET_MS = 5000` and at the command's own `timeoutMs`. The safety rule is `recovery/fault.ts:276,327`: a verb that changes the page is retried only on faults decided before it dispatched (target absent, covered or hidden, disabled-unacted). `RATE_LIMITED` ("Network busy") is deliberately left to Core (`fault.ts:121` `ABSORBED_ELSEWHERE`). This layer is the "wait for actionability after the page settles" half of the rule.

**Layer 2: node retries, per path.**

| Path | Before t355 | Where |
| --- | --- | --- |
| Saved-Flow playback | Core graph executor: default 3 attempts (1 + 2 retries) at 250/1000/2000 ms, gated by `automationStudioAssessAttemptFault` | `executor/graph-run.ts:427,591`, `executor/retry-policy.ts` |
| Candidate trial | **One attempt per step.** `retryPolicy: { maxAttempts: 1 }` and `maxRetriesPerAction: 0` were forced | `flow-bootstrap/verification/detached-execution.ts:75-76` (old) |
| Exploration `core.run_node` | **One dispatch.** `run.gateway.executeAction` once, and the first answer went to the model | `domain/.../node-run/run.ts:367` (old) |
| Mid-build tests (dry run, part run: `replay: "step"`) | **One dispatch**, plus a one-look short-circuit: a press whose target the first read did not show was answered `remembered` without pressing | `domain/.../node-run/replay.ts:350,353` (old) |
| `replay: "verify"` checks | Assertion checks with their own wait windows (`timeoutMs` per check) | `node-run/verify.ts:149` (unchanged) |

Two more defects sat in Core's playback gate:

- **The page's own wait was dropped.** `domain/src/runtime/adapter.ts` `clientReportedFailure` rebuilt the client record without `retryAfterMs`. Core retried a too-fast press on its backoff table instead of on the wait the page named.
- **Core could not see that a web press acts.** A Flow's web node carries none of the domain definition's `metadata.effect`, and `automationStudioNodeRepeatCannotAct` reads node metadata only. So to Core every web output looked as if repeating it could act on nothing. A press whose confirmation was lost (`output_not_observed`, stage `verification`) was eligible for re-pressing on the graph path.

**Why trial step 2 got no retry** (`run-muyrpbnk-fef374e7`, step 0032, whole trial 7.9 s): the trial ran under `maxAttempts: 1` / `maxRetriesPerAction: 0`, so Core made no second attempt whatever the fault was. If the fault was `RATE_LIMITED` (the coordinator's round-4 evidence), layer 1 also passes it up untouched (`ABSORBED_ELSEWHERE`), so nothing retried it anywhere. If it was `web.target.not_found` (what the trial feedback shows), layer 1 had already waited up to about 5 s inside the command, so the target was not resolvable in that window. That points at the locator, which t356 owns (`element-identity.ts`), not at a missing retry. Either way, the trial now gets the same three node retries as playback.

## What changed and why

**One named default, one owner.** `AUTOMATION_STUDIO_DEFAULT_NODE_RETRY_POLICY` in Core `runtime/executor/retry-policy.ts` is now `{ maxAttempts: 4, backoffMs: [250, 1000, 2000] }`: the first attempt plus 3 retries (user rule, 2026-10-07). It is now a floor. `automationStudioNodeRetryPolicy` never returns fewer attempts than the default, whatever a declaration, a run option or `maxRetriesPerAction` asks for. Those can only raise it, and the allowance caps only above the default. A retry ends early only through the per-fault assessment (`defensive/assess.ts`), which refuses to repeat an act whose effect is uncertain. Flows stored with the old `maxRetriesPerAction: 2` therefore still get 3 retries.

Core files:
- `runtime/executor/retry-policy.ts`: the default is 4 attempts, with the floor and the cap only above it.
- `runtime/executor/outside-graph/retries.ts` and `index.ts` (new): `automationStudioDispatchWithNodeRetries`. It runs one node outside a graph run under the same default, the same `automationStudioAssessAttemptFault` act-twice gates, and the same `automationStudioBoundedRetryWaitMs`, which honours and bounds a page's `retryAfterMs`. It is exported from `executor/index.ts`, and so from `fluxiq/automation-studio`.
- `runtime/flow-bootstrap/verification/detached-execution.ts`: the trial no longer overrides `retryPolicy` or `maxRetriesPerAction`. Its zero subflow-recovery, reroute and LLM budgets stay.
- `model/flows.ts`: the settings default `maxRetriesPerAction` is now 3. A test pins it to `DEFAULT.maxAttempts - 1`, because the model layer imports no runtime value.

Downstream files:
- `domain/src/runtime/llm-evidence/node-run/retries/` (new: `dispatch.ts`, `look.ts`, `wait.ts`, `index.ts`):
  - `webNodeDispatchWithRetries` wraps a gateway dispatch in Core's helper. It describes the node to Core by the domain's read-or-change fact (`metadata.effect` from the catalog). It reads the client's record field by field, and treats a failure with no record as final.
  - `webNodeLookUntilPresent` gives a decision taken on one read the same four looks.
  - `webNodeRetryWait` is a held, abortable timer. Core's default timer is unreferenced, which let the test process exit mid-wait.
- `node-run/run.ts`: exploration dispatches through `webNodeDispatchWithRetries`. When it took more than one attempt, the model sees `attempts: N` on the outcome or on the refusal packet.
- `node-run/replay.ts`: a replayed step dispatches with retries, and the "remembered" short-circuit now looks four times (250/1000/2000 ms) before it calls a target absent.
- `node-run/outcome.ts`, `tool-rejection.ts`, `written-step.ts`: an optional `attempts` field on the outcome and the rejection packet. `toolRejection` takes it as a 4th parameter.
- `runtime/adapter.ts`:
  - `retryAfterMs` is carried across the hop.
  - New `lastingActChecked`: for a mutating action, a retryable failure found at `verification` or `confirmation` that is not `unacted` leaves with `retryable: false`, so Core's graph retry never re-presses an act that may have landed.
  - Unacted faults, `target_resolution` faults and reads keep their retries.

Tests (fail-first, observed below):
- Core `executor/outside-graph/tests/retries.test.ts` (new, 9 tests): a late target succeeds on attempt 4 with waits 250/1000/2000; a never-appearing target fails after exactly 4 attempts with 4 faults reported; busy then clear succeeds; a lost confirmation or ambiguous press is not repeated; a read is repeated; `retryAfterMs` is honoured; nothing is dispatched after abort.
- Core `retry-policy.test.ts`: the default, the floor, the cap above the default, and the settings default kept in step.
- Core `detached-execution.test.ts`: the trial retries a busy refusal (2 dispatches), a late target (4), and a never-appearing target (4, failed); a producer-refused failure gets 1.
- Domain `node-run/retries/tests/dispatch.test.ts` (new, 8 tests): exploration busy then clear (2 presses, `attempts: 2`), late target (4, `attempts: 4`), never-appearing target (4 presses, refusal `attempts: 4`), lost confirmation not re-pressed (1), first-try success says nothing; replay busy then clear (2); replay late target pressed rather than remembered.
- Domain `runtime/tests/adapter.test.ts`: the press's lost confirmation leaves non-retryable; a read keeps its retry; busy keeps its retry and `retryAfterMs`; not-found keeps its retry.
- Updated for the new default (counts only): Core `ladder-run`, `node-execution`, `optional-failed-route`, `state-routing-run`, `repair-rerun` tests; domain `adapter-redaction.test.ts` (typing's lost confirmation is now `retryable: false`).

## Commands run and observed results

- Core, fail-first. I swapped the HEAD versions of `retry-policy.ts` and `detached-execution.ts` back in, then ran `npx vitest run .../verification/tests/detached-execution.test.ts .../executor/tests/retry-policy.test.ts .../executor/tests/node-retries.test.ts`. It printed `Tests 10 failed | 44 passed (54)`. Among the failures: "retries a busy refusal that clears…", "…a target that never appears…", "is the first attempt and three retries…" and "never runs a node below the default…". I then restored my versions.
- Core, after the fix:
  - `npx vitest run runtime/executor runtime/flow-bootstrap/verification runtime/service/candidate-trial runtime/service/flow-settings runtime/service/runtime-adaptation runtime/tests/executor.test.ts model` printed `Test Files 73 passed | 1 skipped (74)`, `Tests 842 passed | 2 skipped (844)`. The 9 count-pinned failures it first showed are the test updates listed above.
  - `npx vitest run runtime/activity/wording/tests runtime/recovery/refuted-result runtime/service/runtime-adaptation runtime/tests/policy-model.test.ts runtime/tests/refuted-result runtime/tests/service-recordings runtime/tests/service-adaptation runtime/llm/node-tools runtime/flow-bootstrap/candidate` printed `Test Files 94 passed (94)`, `Tests 822 passed (822)`.
  - After the move into `executor/outside-graph/`: `npx vitest run .../executor/outside-graph` printed `Tests 9 passed (9)`.
- Core checks:
  - `pnpm check` (packages/fluxiq, tsc --noEmit) passed.
  - `pnpm build` (packages/fluxiq) passed, three times; the last build is current.
  - `node scripts/structure-audit.mjs` printed `structure-audit: passed (288 warning(s), 508 baselined)`. It first failed on executor directory size and the `node-` prefix, which I fixed by moving the helper into `outside-graph/`.
- Domain, fail-first. I swapped the HEAD versions of `node-run/run.ts` and `replay.ts` back in, then ran my narrow runner (it bundles only the named tests, exactly as `domain/scripts/test-domain.mjs` does, into `domain/.test-build-scratch/t355`) on `node-retries.test.ts`. It printed `# pass 3 # fail 5`. Failing: busy press, late target, never-appearing target, replay busy, replay late target. I then restored my versions.
- Domain, after the fix:
  - The same runner on the new test printed `# pass 8 # fail 0`.
  - On all of `node-run/**/tests` plus `runtime/tests/adapter*.test.ts` (38 files) it printed `# tests 322 # pass 321 # fail 1`. The one failure was `adapter-redaction`'s retryable expectation for typing; I updated it, and the rerun of both adapter files printed `# pass 43 # fail 0`.
  - On `runtime/tests`, `llm-evidence/tests`, `action-failure/tests`, `io/tests` and `runtime/failure/tests` (48 files) it printed `# tests 357 # pass 357 # fail 0`.
- Domain and extension checks:
  - `pnpm check` (domain: tsc for src and tests) passed.
  - `pnpm build` (apps/extension) passed: chrome, firefox and e2e-chromium each verified 22 files.
  - `pnpm check` (apps/extension) passed.
  - `node scripts/structure-audit.mjs` (downstream) reported no FAIL lines and no `as never`. It had first failed on contract-spread, directory size and `run.ts` at 812 lines; I fixed all three, and `run.ts` is now 800 lines.
- Lab, provider-free and headed, on the realistic scenario crossborder-marketplace: `FLUXIQ_LAB_INSTANCE=t355-retry FLUXIQ_TEST_ENV_FILES=none node scripts/lab/run-lab.mjs run crossborder-marketplace --flow` produced `run-muyta37c-a9368bca`, verdict failed (oracle failed). From `snapshots/flow-lane.json`:
  - Actions 0-13 succeeded: welcome wait, dismissals, search, results, listing tab, options, quantity.
  - Action 14, the "Get coupons" click (entry 51), failed `web.action.rate_limited` (`effect: unacted`, "the page answered the press … that it was busy"). Action 15, its retry, succeeded with `retry: {attemptNumber: 2, maxAttempts: 4, backoffMs: 250}`. It is listed in `recoveredFailures`.
  - Action 16, the scroll, succeeded.
  - Actions 17-20 are the recorded second coupon press (entry 57): `web.target.not_found` four times. They are attempts 1-4 of `maxAttempts: 4`, with backoff 250, 1000 and 2000 ms, and each attempt spent about 4.0 s in the in-page wait. The terminal reason is `recovery.exhausted`.
- Lab cleanup: after the run, `Get-CimInstance Win32_Process` filtered on node, chrome or chromium with `t355` in the command line returned nothing.

## Not verified

- **Exploration and candidate trials in a live browser.** Both need a model. The brief allows no provider call, so these paths are proven by unit tests only. A provider-free Lab run covers the playback path only.
- **The full suites** (`pnpm check`, `pnpm test`, Core's whole vitest run) were not run, per the twice-a-day rule. Only the directories touched or plausibly affected ran.
- **Extension content tests.** No extension source changed, so none were run; the extension build and check ran.
- **Docs.** `docs/architecture/` and Core docs that state the old three-attempt default were not updated (not in my owned paths). See open questions.

## Open questions or contradictions found

1. **Evidence mismatch on trial step 2.** The trial feedback (0032 `result.json`) says `web.target.not_found`; the coordinator's round-4 evidence says the page's "Network busy" (`web.action.rate_limited`). The trial retry fix covers both. If it really was not-found after layer 1's 5 s wait, the locator (t356, `element-identity.ts`) is the cause, and retries alone will not fix it.
2. **Cost of a never-appearing target.** Each node attempt includes layer 1's wait of up to about 5 s, so a target that never appears now takes roughly 4 x 5 s plus 3.25 s of backoff, about 23 s. Before t355 that was about 5 s in exploration and about 16 s in playback. The rule asks for exactly this, but it lengthens builds that probe absent controls.
3. **Ambiguous execution-stage faults on a press.** `web.action.failed`, `web.action.timeout`, `web.page.changed` and `web.transport.transient` remain retryable for a mutating web node on the graph path, as they were in playback before t355. Trials now get them too. Core's ambiguous-effect gate never fires for web nodes, because Flow nodes carry no `metadata.effect`. The structural fix is for Core to read the node definition's `metadata.effect`, or for the plan compiler to stamp it on the node. `lastingActChecked` covers only the clear found-after-acting case. `transport.transient` mixes "content script not injected yet" (unacted) with "port closed mid-press" (ambiguous), so blanket refusal would remove the most common too-early-after-navigation retry.
4. **The exploration covered-target refusal** (`node-run/run.ts`, `webCoveredTarget`) still refuses on one look, by design (C4: it hands the layer to the model). Layer 1 would clear such a layer automatically if the press were sent. That was left as it is.
5. **Core structure audit:** "1 baseline entries can be lowered" is printed. I did not run `pnpm structure:baseline`, because it rewrites a shared file.
6. **Docs to update** with the new default and the floor: `docs/architecture/testing-facility.md` (if it states three attempts), Core's executor or defensive-policy docs, and the Current State user rule. These are supervisor-owned.

## Follow-up after the dev merge: the Lab's Flow-run bound, and the docs

**Cause.** `packages/test-runner/src/flow-lane/terminal-run-wait.ts` already derived its bound from Core's published constants, from one source: `TERMINAL_DETAIL_NODE_WAIT_MS = READINESS_CAP_MS x DEFAULT.maxAttempts + every backoff`. So with the new policy it moved by itself, from 91,250 ms to 123,250 ms per node (4 x 30 s + 250 + 1,000 + 2,000 ms). Only the four tests, and the comments, still stated the old literals.

**Changed:**
- `flow-lane/terminal-run-wait.ts`: comments only. The per-node figure is now 4 x 30 s + 3.25 s = 123.25 s. The cap now binds from six nodes; it was seven. The paragraph on why the 10-minute cap still holds is added (below).
- `flow-lane/tests/terminal-run-wait.test.ts`: states 4 attempts, 123,250 ms, and 3,250 ms of backoff. Five nodes = 583,000 ms (9.7 min), still under the cap; six nodes reaches the cap.
- `flow-lane/tests/persisted-flow-run.test.ts`: the "node count earns" case uses five nodes, 583,000 ms. Six is now the cap.

**The cap still makes sense.** The derived bound is the worst case: every attempt spends its full 30 s readiness ceiling. What a node really costs when its target never appears is about 23 s: four in-page waits of about 4-5 s plus 3.25 s of backoff. `run-muyta37c-a9368bca` showed four attempts of about 4.0 s each. A nineteen-node Flow in which every node met that would finish in about 7.3 min, under the 10-minute cap. Only readiness ceilings that are spent in full at six nodes in a row reach the cap, and that run is stuck.

**Docs.**
- Downstream `docs/architecture/web-capabilities.md` ("Default browser recovery"): adds the node-level layer (the first attempt plus 3 retries on every path, the domain `retries/` seam, `attempts` shown to the model, the lasting-act rule, about 23 s per never-appearing target).
- Core `docs/architecture/automation-studio.md`: the default paragraph said "three attempts". It now describes the first attempt plus 3 retries as a floor on every path, the outside-graph helper, and `maxRetriesPerAction` 3.
- Core `model/policies.ts` `RetryPolicy` comment: its example ("3 means two retries") now shows the floor.
- Core `docs/reference/framework-reference.md` (and the package copy) regenerated with `pnpm docs:reference`. The diff is large (534+/381-) because the reference was already stale against dev; it is generated, never hand-edited.
- No downstream doc stated three attempts. `testing-facility.md` does not state the per-node figure.

**Commands run and observed results:**
- `pnpm build` (packages/fluxiq) passed. `pnpm build` (test-runner) passed.
- `node --test dist/flow-lane/tests/*.test.js` printed `# tests 252 # pass 252 # fail 0`. The coordinator reported 4 failures before this change.
- `pnpm check` (test-runner) passed. Its first run refused because Core's build was stale after the `policies.ts` comment edit; after the rebuild it passed.
- `pnpm check` (packages/fluxiq) passed.
- Core `pnpm docs:check` printed "Deterministic framework reference is current".
- Both structure audits passed: downstream `176 warning(s), 182 baselined`, Core `288 warning(s), 508 baselined`.
