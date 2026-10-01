# Legacy redirect and launcher history implementation

Status: Complete worker implementation (2026-10-01); source/tests/report frozen for supervisor verification.
Worker: trace_endings
Core workdir: `C:/Users/osrs_/FluxStuff/fxwork/t224/!FluxIQ`

Read Current State, released brief, frozen legacy audit, exact sources and original launcher tests. Preserve all three original cases/assertions. Own ProgramLauncher.tsx, its test, legacy domain-program page and its new owning route test only, plus this downstream report. No AuthShell, operational/backend/navigation consumer/recents schema/shared-doc changes.

Plan: reproduce optional persistence exceptions using actual Next Link callback/router-context continuation, plus actual legacy redirect capture for query losses. Catch only the optional write, retain in-memory update/default Link behavior. Append promised scalar/array query values including repeated/empty entries, omit undefined and force one path-domainId under fixed encoded local program path. No server hash/byte/inter-key ordering promises. Focused/scoped heavy validation, then freeze; no broad/live/provider/panel/commit work.

Initial reproduction harness run `codex t224 legacy launcher reproduce` observed exit1,11failed/3passed,2.17s. It exposed two test harness defects (Next idle fallback requires self; beforeEach returned a redirect mock that Vitest invoked as cleanup), so that run is not valid product reproduction. Corrected only those scoped harness issues and reran against unchanged product source.

Corrected reproduction `codex t224 legacy launcher corrected reproduce` observed exit1,2files/14tests:8failed/6passed,1.94s. Three actual Next Link callbacks threw on optional storage getter/quota/modified-click failures, and five alias cases lost supplied query values. Implemented only optional persistence catch and promised query-value append loop with path domain forced exactly once. Source/tests now frozen for focused and scoped validation.

Initial focused `codex t224 legacy launcher focused` observed exit0,2files/14passed,1.83s. Test review then typed router push mock arguments for strict tuple safety and changed a repeated-domain table row to an object row so Vitest passes the actual array rather than spreading it into arguments. No product change or original assertion change.

Final focused **exit0,2files/14passed,2.19s** under `codex t224 legacy launcher final focused`. Scoped semantic types worker68199 **exit0,4 owning roots,0 owned/global diagnostics,0 excluded dependency diagnostics** under `codex t224 legacy launcher scoped types`. External temp harness uses existing strict web config unchanged and reports outside dependency diagnostic count separately; no repository typeconfig/baseline/build output written. Owned `git diff --check` observed exit0. No active worker command remains.

## Exact final commands

Run from the Core workdir above:

```powershell
& 'C:/Program Files/Git/bin/bash.exe' 'C:/Users/osrs_/FluxStuff/build-slots/heavy.sh' 'codex t224 legacy launcher final focused' pnpm --filter @fluxiq/web exec vitest run src/app/tests/ProgramLauncher.test.tsx 'src/app/domains/[domainId]/programs/[programId]/tests/page.test.tsx'
& 'C:/Program Files/Git/bin/bash.exe' 'C:/Users/osrs_/FluxStuff/build-slots/heavy.sh' 'codex t224 legacy launcher scoped types' node 'C:/Users/osrs_/AppData/Local/Temp/codex-t224-legacy-launcher-scoped-types.mjs'
```

## Changes and limits

- Product: `apps/web/src/app/ProgramLauncher.tsx` catches only optional persistence; `app/domains/[domainId]/programs/[programId]/page.tsx` carries promised query values to a fixed encoded local program destination while forcing one path domain.
- Tests: existing `app/tests/ProgramLauncher.test.tsx` retains all original3 cases/assertions and adds5 actual callback/storage cases; new directly owning alias `tests/page.test.tsx` adds6 actual redirect cases. Actual installed Next Link and a scoped RouterContext fake prove callback continuation, default/modified events, retry and in-memory history, without a replacement Link implementation. Alias tests cover deep-link/start fields, repeats/empty/undefined, conflicting scalar/repeated domain and encoded/external-looking data.
- Only those four assigned Core files and this downstream report changed. No AuthShell/operational/backend/session recovery/navigation consumer/schema/shared docs/other worktree edits; no commits/merge/push, live/provider/panel calls or broad checks/builds.

Server searchParams cannot preserve original byte encoding/interleaving across different repeated keys; per-key value order and multiplicity are preserved. Server redirects cannot read an unseen fragment; no hash inheritance claim. Scoped typing is not full-project verification. No real browser storage failure, navigation/history/hash/focus/visual certification performed; supervisor owns independent review and coordinated broad gates.
