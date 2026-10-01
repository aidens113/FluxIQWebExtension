# Runtime workspace implementation

Status: Complete and frozen after supervisor render-owner follow-up; final focused tests passed. Broad gates and browser certification remain unverified by this worker.

Required exact written brief and Current State read; own frozen runtime-workspace-audit.md remains design evidence. Existing APIs/contracts/shared component shapes inspected read-only. No product/test mutation or heavy job initiated for this brief.

## Exact ownership

Core apps/web/src/features/programs/ProgramLiveViews.tsx and live-views/runtime/{RuntimeLive.tsx,RuntimeInventory.tsx,RuntimeRunDetail.tsx,runtime-snapshot.ts,index.ts,tests/runtime-snapshot.test.ts,tests/RuntimeLive.test.tsx}. Only this report downstream. Eight paths total. No metadata/backend/style/runtime/storage/context-packet/shared-doc/other-worktree edits or commits.

## Prepared implementation shape

- Pure field projection validates snapshot shape, known enums/identity strings/timestamps and omits metadata/parameters/result/page-data/error/trace content before retaining UI state. Public runtime imports are type-only. Separate normalized run extraction is reused through the snapshot projection within the owned files.
- RuntimeLive owns initial/refresh requests, last-success timestamp, safe denied/error/retry/stale notices, section/query/filter/page and visible selection. Read-only global snapshot, client-side50-row pages, honest unpaged network/API limitations.
- RuntimeInventory renders five labelled sections with native controls and structured selected information; client session identities remain distinct, adapter and transport origins remain separate. No dispatch/execution controls or raw JSON.
- RuntimeRunDetail owns lazy get-run read (POST read) for selected visible run; exact identity, request generation and abort guards on scope/selection/unmount. Summary remains explicitly stale/unconfirmed on detail error, with retry.
- ProgramLiveViews lazily mounts RuntimeLive for runtime. Metadata remains preview in this increment, as supervisor explicitly excludes it.
- Owning projection/composition behavior tests cover omitted synthetic sensitive values, malformed shapes,50-row pagination/filter/selection, newest refresh wins, session identities, lazy/mismatched run detail/retry/races and only read endpoint calls.

## Resume

Await explicit supervisor release; no time elapsed substitutes for release. Then implement only these paths, run narrow owning tests via explicit Git Bash/heavy.sh while source frozen, inspect actual output and update this report incrementally. Supervisor owns independent source review and coordinated broad typecheck/test/audit/build. No browser/provider/panel/Lab calls.

## Incremental progress

Supervisor explicitly released exact eight paths after corrected types/build. Implemented safe structural projection, five inventory sections, client-side50-row pages and visible scope/freshness/stale/retry states, lazy selected-run read with exact identity guards and abort/generation/ownership fencing. Runtime composition lazy route added; no metadata/API/style/backend changes. New focused projection/composition regressions cover privacy omissions, malformed enums/shapes, timestamp bounds, session distinctness, nested list bounds, newest-first rows, loading/failure/retry, overlapping refreshes, paging/filter/selection, lazy mismatched run detail/retry and stale scope/unmount callbacks. Preparing first observed narrow run now.

- First focused run7665 exit1:13pass/1fail. Pagination displayed correct51-100 range; the assertion serialized split React text nodes instead of reading visible text. Corrected only the range reader, preserving exact expected numbers, and added detail denial/retry/dispatch privacy/unmount tests.
- Fresh run10706 exit0:2files/16tests,8.22s. Review then added a render-time API scope guard so a previously selected run cannot start a detail request against a newly changed scope before effect cleanup; owning regression verifies no such POST. Final focused rerun pending. No source edits while own checks read source.

## Final observed result and freeze

Explicit `C:/Program Files/Git/bin/bash.exe` invoking `C:/Users/osrs_/FluxStuff/build-slots/heavy.sh`, label `codex t224 runtime final focused`, session22518 exited0:2files/17tests passed,10.13s. Command in Core apps/web: `pnpm exec vitest run src/features/programs/live-views/runtime/tests/runtime-snapshot.test.ts src/features/programs/live-views/runtime/tests/RuntimeLive.test.tsx`.14 behavioral workspace/composition tests plus3 projection tests. No skips, timeout increases or unhandled errors; expected React test renderer deprecation warnings only. Full observed output saved `C:/Users/osrs_/AppData/Local/Temp/codex-t224-runtime-final-focused.log`.

Scoped tracked composition diff check exit0. Module sizes: snapshot projection57lines, RuntimeLive77, Inventory16, RunDetail49, index4; owning tests46/173. One public implementation export per file, owning barrel preserved, no baseline changes. Exact8owned paths changed; no metadata/backend/styles/runtime/storage/context-packet/shared-doc edits. Earlier Problems/global source and tests remain untouched during Runtime implementation.

Only sanitized structural view models enter UI state. Actual API payloads are not logged, persisted, exported or rendered raw. Arbitrary metadata/parameters/targets/results/errors/trace fields omitted; registered identity/label strings remain contract display data, not a claim that arbitrary strings are secret-safe. Clients with different sessions remain distinct; adapter/direct routing and transports remain separate, actual recorded route fields displayed without capability-based execution inference. Capabilities count is explicitly entries; duplicate ids have distinct keys.

Requests are snapshot GET and selected get-run POST(read) only. Manual refresh/latest request wins, initial/refresh failure and403 retry, snapshot stale/freshness labels,50-row client-side pages, filter/page visible selection, mismatched run id rejection, lazy detail denial/retry, old selection/scope/unmount/captured retry fencing all exercised synthetically. Run/attempt order uses returned timestamps with stable id tie-break. Scope transition hides the old snapshot before any detail requests against the new API owner.

Remaining limits: API snapshot still unpaged/global and includes data omitted by UI; UI paging does not bound network/JSON parsing or provide backend domain authorization. No live feed claimed; freshness requires Refresh. Runtime metadata stays preview by instruction even though functional composition is now present. No live/browser/focus/responsive or production certification performed. Worker did not run broad web types/suite/audit/build; supervisor owns those after coordinated freeze. New snapshot malformed nested optional fields are safely omitted/represented unavailable, not exhaustively validating every backend subtype. Source/tests/report frozen for independent supervisor review and integration; no commits or other-worktree edits.

Supervisor review identified selected detail render must mask old confirmed values/error before passive cleanup when successful refreshed snapshot changes its scope owner. Added derived current-owner display guard (API/run id/snapshot object), keeping existing stale callback fence. New same-run refresh regression observes KeyValue renders before passive effects, asserts old confirmed route never renders under the new snapshot, shows new snapshot summary during deferred detail, then fresh confirmation. Prior17/17 pass covers earlier revision; fresh focused run pending. Exact owned paths only.

Fresh owner-display run61928 through heavy.sh `codex t224 runtime owner display focused`, same two-file command above, exited0:2files/18tests (15workspace/composition +3projection),9.35s. No skips/failures/unhandled errors. Full output `C:/Users/osrs_/AppData/Local/Temp/codex-t224-runtime-owner-display-focused.log`. Scoped composition diff check0. Final RunDetail53lines/workspace test193lines; other owned file counts unchanged. All source/tests and own report frozen again. This result supersedes prior17-test validation for final source; supervisor broad validation remains required.

Supervisor third-batch broad typecheck38949 failed only new test line30: named(type:string) passes string to findAllByType(ElementType). Exact queued correction: narrow this fixture helper type to the intrinsic tags actually used (input/select), preserving assertions/config. Mutation HOLD until root fullsuite30596 finishes and supervisor explicitly releases. Earlier18/18 focused pass does not establish TypeScript success. Read-only freshness audit continues; Runtime product/test source untouched during gates.
