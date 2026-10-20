# lane-sync-1020 report

## Outcome
Done. All four trees fast-forwarded to dev in both repositories, installed, Core built, core-build current, extension built. Every command exited 0.

## What changed and why
No files edited. Per tree: `git merge --ff-only dev` (both repos), `pnpm install --frozen-lockfile` (both), Core build of contracts/fluxiq/client-gateway-websocket, `node scripts/check/core-build.mjs`, extension build. Trees run one at a time.

## Commands run and observed results
| Tree | Ext HEAD (=dev) | Core HEAD (=dev) | ff ext | ff core | install ext | install core | core build | core-build check | ext build |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| t563 (task/t563-a8-lab-comparison) | 628cc737 | ca23a8ba | 0 | 0 | 0 "Done in 1.3s" | 0 "Done in 1.9s" | 0 "packages/fluxiq build: Done" | 0 "...is current with its source." | 0 build-cache stored, 40800 ms |
| t719 (task/t719-site-reset-undoable-acts) | 628cc737 | ca23a8ba | 0 | 0 | 0 "Done in 3.5s" | 0 "Done in 2.9s" | 0 "packages/fluxiq build: Done" | 0 current | 0 stored, 41423 ms |
| t566 (task/t566-a8-lane-4) | 628cc737 | ca23a8ba | 0 | 0 | 0 "Done in 1.3s" | 0 "Done in 3.6s" | 0 "packages/fluxiq build: Done" | 0 current | 0 stored, 28796 ms |
| t567 (task/t567-a8-lane-4b) | ddf41bf4 | ca23a8ba | 0 | 0 | 0 "Done in 1s" | 0 "Done in 2.7s" | 0 "packages/fluxiq build: Done" | 0 current | 0 "no stamp; stored", 33916 ms |

Last line of each ff merge: ext " delete mode 100644 scripts/worktree/tests/path-identity.test.mjs", core " create mode 100644 scripts/web-build/web-build-key.mjs".

## Not verified
No Lab/live run, no tests (out of scope).

## Open questions or contradictions found
t567's extension repo resolves `dev` to ddf41bf4 while the other three trees resolve it to 628cc737; each worktree's `dev` ref should be shared, so t567 may be a separate clone with a stale local `dev`. Supervisor should check whether t567 holds the latest dev.
