# t1028 report: an answered press is no longer called uncertain

Worker: worker-heavy (Opus). This task is paired across both repositories, on branch `task/t1028-answered-not-uncertain` in each. Core is at `fxwork/t1028/!FluxIQ` and downstream is at `fxwork/t1028/!FluxIQWebExtension`. It builds the lead's accepted recommendation from t1027 (`reports/t1027-sweep-fix-durable-1124.md`).

## Outcome

Done. Core's durable dispatch now stops a required command's answer timer as soon as it takes the answer, the same way it already did for ordinary commands. Before this change, a press that answered could be marked `outcome_unknown` if the timer ran out while the answer was still being saved, and the run then stopped as "Outcome uncertain". With the change, the downstream stall probe passes at 4000 ms. It failed at that stall before the change.

## What changed and why

All the code changes are in Core.

- **`packages/fluxiq/src/client-gateway/service/command-ledger/dispatch.ts`, `accept()`:** the line `if (!entry.observer) entry.timer?.cancel();` is now `entry.timer?.cancel();`, with a comment explaining why. Once the answer is taken, the window is met. What happens after the answer is still bounded three ways:
  - **The caller's abort signal:** `abort` leads to `uncertain(entry)`, which revokes the proof.
  - **Gateway close:** `drain()` leads to `uncertain`.
  - **The runtime's own command deadline:** its stop sets `state.blocked` in the command run, and the observer's `observe()` then throws `command_run.invalid_completion`. The dispatcher reports `outcome_unknown`.

  No new wait or timer was added.
- **`packages/fluxiq/src/client-gateway/service/command-ledger/tests/dispatch.test.ts`:**
  - The `timeout` case was removed from "required %s revokes proof before unknown resolution and drains the late observer". The `abort` and `close` cases are unchanged.
  - New test: "a required answer taken within its window completes even when the window ends while its observer runs". It uses a scripted `startTimer` source called `scriptedTimers()`. Its `fireDue()` fires every wait that is still armed at once, the way a stalled event loop does, and a cancelled wait never fires, the same as `clearTimeout`. The test fires at the moment the observer is held mid-completion. It asserts:
    - no wait was still armed (`fireDue()` returns 0);
    - the result is `completed` / `succeeded`;
    - `uncertain` and `markUnknown` were never called;
    - the press was sent exactly once.
  - New test, in three variants: "a required answer that never came within its window ends unknown (nobody to ask | asked: unknown | asked: unknown, then a late answer) and is never sent again". The window is fired by hand, which makes the test deterministic. Each variant asserts:
    - the result is `outcome_unknown`;
    - the client was asked 0 times when nobody can answer, and 1 time when it can;
    - a late answer is never committed (`commitReceipt` is not called, and the ledger stays `unknown`);
    - `observer.uncertain` is called once and `completed` never;
    - replaying the same context gives `outcome_unknown` with the press still sent only once.
  - `paired()` gained an optional `answersReconcile` flag, which declares the capability metadata key, plus imports for that key and `ClientGatewayTimerSource`.
- **`docs/architecture/automation-studio/client-gateway.md`** (the t329 paragraph): the text now says only cancellation and close revoke the proof. The answer deadline bounds only the wait for the answer and is cancelled once an answer is taken. The paragraph explains why, citing the 2026-11-24 sweep failure and the stall probe. It also names what still bounds the work after the answer, and says an answer that never comes is still asked about or ends `unknown`, never sent again.

Downstream source is unchanged. The stall probe, `domain/src/io/tests/zz-t1028-probe.test.ts`, was a copy of the t1027 probe. I ran it uncommitted and then deleted it, together with its build directory `.test-build-scratch/t1028-probe`. `git status` downstream shows only the t1027 report the lead copied in.

## Commands run and observed results

- **Old code fails the new test** (I restored line 119 to the old `if (!entry.observer) …` temporarily, then put the fixed file back): `npx vitest run src/client-gateway/service/command-ledger/tests/dispatch.test.ts` → exit 1, `× … a required answer taken within its window completes even when the window ends while its observer runs`, `AssertionError: expected 1 to be +0`, `Tests  1 failed | 23 passed (24)`. My first attempt at this check edited a second line by mistake; I re-ran it changing only line 119, with the same result.
- **New code**, Core `node ../../scripts/vitest-groups.mjs --groups=parallel,real-sql src/client-gateway/service/command-ledger` → exit 0, `Test Files 5 passed (5)`, `Tests 56 passed (56)`, `[vitest-groups] all groups passed: parallel, real-sql`.
- Core `node ../../scripts/vitest-groups.mjs --groups=parallel,real-sql src/client-gateway/service src/framework/automation-service/service/command-run` → exit 0. The parallel group gave `46 passed (46)` files and `372 passed (372)` tests. The real-sql group gave `3 passed (3)` files and `45 passed (45)` tests. Then: `all groups passed`.
- Core `pnpm --filter fluxiq check` → exit 0, `{"build-cache":"build","step":"fluxiq:check","reason":"no stamp; stored in the shared store …","ms":187859,"source":"command"}`.
- Core `node scripts/structure-audit.mjs` → exit 0, `structure-audit: passed (571 warning(s), 903 baselined).`
- Core libraries, `pnpm --filter @fluxiq/contracts --filter @fluxiq/sdk --filter fluxiq --filter @fluxiq/client-gateway-websocket --filter @fluxiq/ui-components build` in the t1028 Core tree → exit 0. Afterwards, downstream `node ../scripts/check/core-build.mjs` printed `core-build: FluxIQ Core's build at …\t1028\!FluxIQ is current with its source.`
- **Downstream stall probe** (not_seen test; the block is set as press number / milliseconds):
  - `T1027_BLOCK_AT=2 T1027_BLOCK_MS=4000 DOMAIN_TEST_BUILD_LABEL=t1028-probe node scripts/test-domain.mjs io/tests/zz-t1028-probe` → exit 0, `T1027PROBE {"status":"succeeded",…,"pressed":["first","first","second"],"asked":1}`, `ok 2 - a lost durable press the browser never received is made again under a new attempt`. Before the fix (t1027) this failed with `run.outcome_uncertain` and `pressed ["first","first"]`.
  - Block 3/4000 → exit 0, `succeeded`, `pressed ["first","first","second"]`, `asked 1`. Before the fix it failed.
  - Block 2/2000 → exit 0, `succeeded`. Before the fix it failed.
- Downstream `DOMAIN_TEST_BUILD_LABEL=t1028 node scripts/test-domain.mjs io/` (from `domain/`, run after deleting the probe) → exit 0, `# tests 65`, `# pass 65`, `# fail 0`.

## Not verified

- Core `node scripts/docs-reference.mjs --check` → exit 1: "docs/reference/framework-reference.md is stale: the public surface changed". I changed no export: only `dispatch.ts` internals, a test and an architecture doc. So I expect this is stale on the base `e3498f9f3` and not caused by this change. I did not confirm that on the base, because that would mean running it in the shared Core or regenerating the reference. It is not in the acceptance list.
- I did not run Core's whole vitest suite or the downstream full suite. That stays with the twice-a-day sweep.
- Nothing was run live in a browser. Lab runs remain out of scope.
- The runtime deadline as a bound on the work after the answer is shown from the code path (`runtime/service.ts` `withRuntimeBounds` → `ClientGatewayCommandOutcome.stop` → command-run `uncertain` sets `state.blocked` → `observe()` refuses). No new test exercises it end to end.

## Open questions or contradictions found

- None blocking. The version is left alone, as the brief said.
- The work after the answer takes about 1.2–1.7 s on a quiet machine. I estimated this in t1027 from the stall thresholds. It is now harmless to the window, but it could still be measured on its own: `observe()` → `live()` → `getRuntimeSession`.
