# t419 — integrated candidate provider-free freeze

## Disposition

**GO for the supervisor to commit this report and perform the final clean-HEAD recapture; NO-GO for
a live/provider launch from this report alone.** At `2026-09-27T18:42:58.0489471Z`, before this
report existed, Core and downstream were clean, had no diff-check errors, and were bound to the
identities below. Corrected-order downstream outputs were fresh 6/6, all 12 markers existed, the E2E
manifest was byte-identical, the three downstream runtime resolutions matched Core byte-for-byte,
and the post-build dry-run returned `ready` with zero provider calls.

This report is now the sole expected untracked path. Its creation intentionally ends the clean-tree
snapshot. The supervisor must commit it and recapture the final downstream HEAD/status before a
candidate can satisfy t407's settled-tree authorization precondition. This report does not authorize
a provider, Lab, browser, panel operation, or live command.

## Clean pre-report repository identity

| Repository | Branch | HEAD | Status | `git diff --check` | Divergence |
| --- | --- | --- | --- | --- | --- |
| Core `F:\!FluxIQ` | `dev` | `f44930aba0640f850f2e09f06ea03c0343d69361` | clean, 0 paths | exit 0 | local `dev` and cached `origin/dev`: `0/0` |
| downstream `F:\!FluxIQWebExtension` | `task/t171-run5-live-validation` | `8ca0c1f9d95942e52c1d0ae33852c2a363537681` | clean, 0 paths | exit 0 | one commit ahead of local `dev` and cached `origin/dev`: `0/1` |

No fetch was performed in this task, so `origin/dev` means the existing local remote-tracking ref.
Core's local and cached remote-tracking refs both resolved to the recorded Core HEAD; downstream's
local and cached remote-tracking refs both resolved to
`b4fd477df01aac94c8b9a3db6f1884e89c5a0bcd`.

## Corrected-order output closure

The t409 build order was applied provider-free: domain, web-panel host, test-contracts, Scenario Lab
(including its owning test-contracts build), test-evidence, extension, then test-runner. The final
successful output writes are in that dependency order. Strict freshness (`output UTC > newest
tracked owner input or named built dependency UTC`) passed 6/6:

| Owner | Output UTC | Newest input/dependency UTC | Result |
| --- | --- | --- | --- |
| domain | `2026-09-27T18:35:46.4460639Z` | `2026-09-27T07:19:57.6615642Z` | PASS |
| test-contracts | `2026-09-27T18:36:06.6515736Z` | `2026-09-27T07:19:57.6615642Z` | PASS |
| Scenario Lab | `2026-09-27T18:36:11.6759415Z` | `2026-09-27T18:36:06.6515736Z` | PASS |
| test-evidence | `2026-09-27T18:36:22.9658986Z` | `2026-09-27T18:36:06.6515736Z` | PASS |
| extension E2E content | `2026-09-27T18:36:37.6214696Z` | `2026-09-27T18:35:46.4460639Z` | PASS |
| test-runner | `2026-09-27T18:36:54.0006666Z` | `2026-09-27T18:36:22.9658986Z` | PASS |

Marker/identity results: 12/12 required leaves present; authored/output E2E manifests byte-identical;
Core-through-junction hashes 3/3 identical. The three direct Core runtime SHA-256 values remain the
exact t409 identities: `9AF59262…F75AF`, `414B586C…B4BE0F6`, and `4C0295D4…EFF1D`.
Runtime resolution remained `fluxiq/dist/index.js`, `fluxiq/dist/core/index.js`, and
`client-gateway-websocket/dist/index.js` from the intended `F:/!FluxIQ` packages.

Two machine-level transients were observed and not concealed: one pnpm launcher load failed before
the host command, one nested `tsc` exited `0xC0000005` before Scenario Lab emitted output, and one
later pnpm launcher parse failed before extension output. `node --check` and `pnpm --version` then
passed; each affected command passed on one bounded retry. No failed attempt wrote the final owner
output, and the final successful write chronology above preserves the required dependency order.

## Post-build provider-free dry-run

Working directory: `F:\!FluxIQWebExtension`. The child process isolated test configuration without
editing `.env.local`:

```powershell
$env:FLUXIQ_TEST_ENV_FILES='none'
$env:FLUXIQ_TEST_TARGET='isolated'
node packages/test-runner/dist/cli.js run everything-store --target isolated --live-llm --llm-profile mvp-hard-scenario --llm-provider deepseek --llm-task create-flow --instruction-task everything-store-plus-earbuds-under-50 --replays 1 --dry-run
```

Exit was 0 with one structured result: status `ready`, provider-call count 0, lane `created-flow`,
target `isolated`, scenario/workflow/task `everything-store` / `plus-under-fifty` /
`everything-store-plus-earbuds-under-50`, expected-dataset judge step
`extract-plus-under-fifty`, and one replay. The instruction was 415 characters with SHA-256
`d4f7835b8fc63ee857b5c15bd6a01f1f08fe3df19446153ad0f443045fd087ef`.

The request retained DeepSeek `mvp-hard-scenario` / `deepseek-flash` and `create-flow`. Its raw
authorization metadata reports 26 calls, 48,000 input, 8,000 output, and 56,000 total tokens per
call, plus 560,000 total tokens and USD 2 under fields labelled `per run`, with USD 0.25 per call.
The independent t420/t421/t422 review confirmed that these `per run` labels apply to **each provider
grant**, not to the complete CLI invocation. This lane may issue two sequential provider grants, so
its derived invocation maxima are 52 provider calls, 1,120,000 tokens, and USD 4; the requested
replay is provider-free. This clarification preserves the captured dry-run metadata and does not
raise or override any grant ceiling. Credential source metadata named the expected variable and
`.env.local`; no value was read into this report. Dry-run metadata does **not** prove credential
validity, and the test-environment isolation flags do not establish a one-variable credential import
contract.

## Scope

No provider was called. I did not start, stop, inspect, or manage Lab, browser, or panel state; open
raw artifacts; stage; commit; push; or edit source/shared plans. Generated outputs were changed only
through their owning build commands. This report is my only authored repository path.
