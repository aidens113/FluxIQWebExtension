# Docs request recovery implementation

Status: Complete - owned source/tests frozen for supervisor verification.
Date: 2026-10-01
Worker: recording_controls
Tree: paired t224 Core; report lives in downstream t224.

Read parent Current State, held exact brief, frozen deployment-docs-recovery-audit C1-C5, current docs.tsx/direct tests and ProgramApi response/request types. Source inspection confirms missing owner fences, rebuild lock, direct page retry and same-ID reload. No source/tests or commands requiring heavy execution were changed or run. C6 keyboard/expanded-folder behavior remains a separate brief.

## Exact ownership

All product/test paths are Core apps/web/src/features/programs/:
- live-views/docs.tsx
- documentation-workspace/useDocumentationWorkspace.ts (new)
- documentation-workspace/index.ts (new)
- documentation-workspace/tests/useDocumentationWorkspace.test.tsx (new)
- live-views/tests/docs-recovery.test.tsx (new)
- live-views/tests/docs.test.ts only truthful relocated source assertions; its existing outline/tree behavioral assertions remain intact.

No other source/helper/backend/API/styles/config/baseline/shared documents are owned. Existing tree virtualization, keyboard/folder expansion, outline, sandbox and history helpers stay in the view with unchanged behavior.

## Implementation sequence after release

1. Write deferred scripted hook/component regressions first for original same-ID rebuild stale content, disappeared selection, direct page retry, stale domain/page callbacks and duplicate rebuild. Run narrow reproduction through the shared heavy wrapper. Existing nonrequest behavioral tests remain unchanged.
2. Key a private Docs workspace to actual API identity while outer DocsLive keeps its export and useProgramApi contract. Render-owner ref plus layout teardown fence stale captured callbacks before passive cleanup. Domain replacement immediately removes old filters/page/history handlers. Same-owner snapshot refresh preserves valid search/source/selection and confirmed content.
3. Extract one focused useDocumentationWorkspace hook owning metadata reads, page reads, rebuild, confirmed selection and separate error/busy channels. Abort and generation guards at entry/completion/finally; synchronous pending locks/coalescing. Rebuild supersedes earlier snapshot reads, never silently replays writes. Failed refresh preserves last good snapshot with explicit Retry.
4. Reconcile selection on confirmed metadata to still-valid current page, else URL-requested valid page, else first page. Empty confirmed index clears page/loading/error. Successful rebuild increments current-page revision even if ID unchanged, so fresh get-page is issued. Captured page actions refuse old selection/owner. Page Retry performs only current get-page; Rebuild remains explicit and separately named. Acknowledged rebuild status persists independently of failed subsequent page read.
5. Validate actual rendered snapshot/page fields against direct public Docs contracts: arrays and members, source/page identity/string metadata, warnings strings, html and page identity. Invalid successful payload produces fixed local recovery failure; no arbitrary exception/server text logging. Distinguish valid zero index from no filter matches. Avoid inventing backend contracts.
6. Add defensive rejection/malformed/unmount tests, retained same-owner drafts/content, stale-result races, no available page loading/error clear and retained rebuild acknowledgement. Run narrow hook/view plus unchanged docs helper tests and strict scoped types through heavy wrapper. Inspect owned diff, freeze six paths, update this report with observed commands/counts; supervisor reviews and runs broad gates.

## Planned hook/view boundary

The hook exposes confirmed snapshot/page/selection and read/rebuild busy/error/status plus select/refresh/retry/rebuild actions. The view owns browser URL resolution/history push/pop, filters, explorer and document rendering. Selection returns an acceptance signal so old captured view handlers cannot push history when the hook refuses activation. The API-owner render guard also fences view-only callbacks. Pending page reads are tied to selected ID/revision and owner, not only AbortSignal acknowledgement. Confirmed page retention must never display a prior selected page under new metadata; retained same-page content can stay available while retrying.

## Validation limitations

All current evidence is read-only source inspection. No product edit, test execution, broad gate, browser/provider/panel action, commit or push before release. Local component tests will model lifecycle and navigation; no live focus or browser certification is claimed. No ownership clarification currently required; exact six paths and contracts are sufficient to begin after supervisor release.

Release received after supervisor sixth Core gates. Initial reproduction had an incomplete local window fixture (dispatchEvent missing) affecting two cases; corrected only that fixture. Corrected original-source run native1: all 3 substantive regressions fail (unchanged ID did not reload, direct page Retry absent, removed page did not reconcile), 1.90s. Original docs source then changed only in owned path. First edit script encountered CRLF pattern mismatch and truncated owned docs.tsx; immediately reconstructed exact owned HEAD version and reapplied normalized guarded transformations. No other work reset.

New focused hook owns snapshot/page/rebuild lifecycle; private API-keyed workspace resets domain presentation immediately; page-revision reload and metadata reconciliation implemented, fixed local read/rebuild feedback and strict rendered shape checks. First corrected component fix 3/3 passed. Expanded hook 19/19 plus component3/3 observed pass so far; unchanged owning helper suite still pending in current narrow command. All helper/tree/keyboard/folder/security source below view remains untouched. No broader gates or live calls.

Expanded recovery native0: 3 files/26 tests, 11.88s (hook19/component3/unchanged owning4). Component expansion initially exposed two test assumptions: source-aware tree labels are normalized and existing sandbox HTML retains script markup while sandbox/CSP blocks execution. Corrected fixture/assertions to actual preserved contract; no tree/security product change. Final narrow label `codex t224 docs final narrow`: native0, **3 files/34 tests/34 pass,7.84s** (hook22/component8/unchanged docs4), no skips.

Final source includes current-owner/render/page guards; scoped layout cleanup aborts read controllers and rejects obsolete callbacks. Manual snapshot reads coalesce; rebuild synchronously invalidates an older read, locks duplicate submissions and always releases on refusal/rejection. Current aborted replies without an owning cancellation show fixed recovery rather than false selection/indefinite loading. Confirmed metadata/page invalid-shape validation has fixed local feedback and no raw error output. Current page Retry reads without rebuild; rebuild success reloads same ID and reconciles removed selection. Rebuild outcome and viewer-link status render separately so page read failure or old link feedback cannot hide acknowledgement. Zero index has a dedicated message; ordinary filtered no matches remains unchanged.

Final local tests cover same-ID rebuilt page, removed selection, direct Retry, same-owner draft/content retention, domain replacement with immediate content/draft reset, stale callbacks/history suppression, old rebuild completion, synchronous locks, rejection/finally, old snapshot ordering, page-selection response/Retry fences, malformed snapshot/page/rebuild success, explicit missing-page rebuild, zero index, coalesced Retry and aborted-reply recovery. Browser sandbox/CSP attributes tested with synthetic HTML; no live execution/focus claim.

Source comparison against owning HEAD confirms VirtualDocsTree and all following helper source are unchanged byte-for-byte after newline normalization. Existing docs.test.ts unchanged (no relocated assertion required). Exact six owned paths comprise five changed/new files plus unchanged permitted docs.test.ts. No generic API/backend/styles/shared hook/config/baseline changes. Initial strict scoped types native0; final exact-six strict rerun pending session82886 at report update, then owned diff check executes in same command.

Final strict scoped command label `codex t224 docs final scoped types` completed native0 with no diagnostics, using external TEMP/codex-t224-docs-scoped.json extending the real unchanged web tsconfig, incremental disabled only for build-output isolation; includes next-env and exact six roots. No diagnostics excluded. Owned git diff --check native0. Paths are now frozen. Supervisor must independently review, verify and run broad checks. No full gates, live/provider/panel operations, commits, pushes or Claude integration changes performed by this worker.

Supervisor review clarification: hook regression asserts rebuild status is preserved independently of page error. Component regressions use actual shared UI and do not assert persistent local acknowledgement. Two separate StatusText instances preserve hook/link channels but StatusText emits global alerts and returns null; the earlier report wording did not prove persistent local acknowledgement. Supervisor owns the exact docs.tsx persistent-status fix and regression; this worker made no further Docs source changes.
