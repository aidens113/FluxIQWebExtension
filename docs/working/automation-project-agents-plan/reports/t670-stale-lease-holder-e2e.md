# t670 — stale lease holder e2e (worker report)

## Outcome

Done. A Chromium Playwright spec now loads the real built extension. It connects the extension to a stand-in gateway on loopback and shows the background's host-lease check on the everything-store home page from the Scenario Lab (seed 241). The spec passes. It also fails when the refusal is disabled: I proved that once with a temporary edit and then reverted it.

## What changed and why

- `apps/extension/e2e/lease/index.ts` (new): an empty barrel, the same as `e2e/cancellation/index.ts`.
- `apps/extension/e2e/lease/tests/stale-holder.spec.ts` (new, 227 lines). The stand-in gateway is written inside the spec and not exported, the same way `reconnect.spec.ts` does it. It answers `client.hello` with `server.session_ready` and sends `server.execute_action` with a `lease`. It records every client message and reassembles fragmented client frames: Chrome splits large messages, and an unfragmented reader crashed with a JSON parse error on the first run. The spec runs these steps in order:
  1. Epoch 5 / brief-1 `web.browser.navigate` to the store. This adopts the lease and opens the automation tab.
  2. The extension page is brought to the front. Epoch 5 / brief-1 `web.dom.type` "kettle" into `input[name="k"]` succeeds. The box reads "kettle", and the runtime status names this command and the store tab, even though the extension page is in front.
  3. Epoch 4 / brief-0, which is stale, then epoch 5 / brief-2, a mismatched holder. Each gets the typed refusal: `failed`, failure `{blocked_by_capability_or_policy, host_lease.stale | host_lease.holder_mismatch, retryable false, stage dispatch, effect unacted}`, payload `{status: "refused", code}`, and `actual` contains "seen epoch 5". After a 1.5 s settle, the spec checks that the box still reads "kettle", the runtime status is unchanged, the refusal is the only message the browser sent that names the command, and the `client.recording_event` count has not changed.
  4. Epoch 6 / brief-2 is adopted and types "travel mug" on the store tab. After that, an epoch 5 command is refused as stale and the box stays "travel mug".
- `playwright.config.ts` was not changed: the spec is picked up by `testDir: "."`.

## Commands run and observed results

All commands ran in the worktree.
- `pnpm --filter @fluxiq-web-extension/extension test:e2e:build` printed "e2e-chromium: verified 22 files".
- `npx playwright test -c e2e/playwright.config.ts e2e/lease/tests/stale-holder.spec.ts --reporter=list` (in apps/extension):
  - First run: failed with `SyntaxError: Unterminated string in JSON at position 25134` in the stand-in's frame reader. This was a test defect; I fixed it by reassembling fragmented frames.
  - Second run: `ok 1 ... (13.9s)`, `1 passed (22.8s)`.
- Negative proof: I temporarily changed `leaseRefusal` in `server-command-channel.ts` to `return refusal && undefined;`, rebuilt and ran the spec. Result: `1 failed`. At `lease-stale` the spec expected `status: "failed"`, `code: "host_lease.stale"` and received `status: "succeeded"`, `payload.status: "succeeded"`.
- Revert: I restored the file from a scratchpad copy. `git status --short` shows only `?? apps/extension/e2e/lease/`, and `git diff --stat -- apps/extension/src` is empty. After a rebuild, the spec printed `ok 1 ... (12.6s)`, `1 passed (22.0s)`.
- `pnpm structure:check` printed `structure-audit: passed (201 warning(s), 639 baselined)`, with no warnings for the new files.
- `npx tsc -p tsconfig.test.json --noEmit` (in apps/extension) exited 0.

## Not verified

- The whole e2e suite was not run, as the brief says.
- Firefox was not tested.
- The `fact check` (evaluate_facts) path, the unreadable-lease (`host_lease.missing`) refusal, and a worker restart between grants are not covered here. Unit tests cover them.
- The "nothing recorded" check counts `client.recording_event` messages sent to the gateway. The recording was not on, so it does not show what an active recording would have kept.

## Open questions or contradictions found

None. No product defect was found.
