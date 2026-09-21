# Extraction Exit Live

Status: Complete; exact production UI path passed after driver-only iteration
Updated: 2026-09-20
Owner: `w2-extraction-exit-live`

## Result

The real production panel and unpacked Chrome extension completed the Phase
2.0 picker-to-dataset path. A user-style pick found eight repeated items, the
extension showed a five-row preview, the confirmation captured eight records,
and deterministic recording generation produced one provenance-bearing
`web.dom.extract_list` action in the ordinary Subflow graph. The panel-started
Flow succeeded, Core durably stored one dataset with eight rows, and the full
record set passed the existing `product-catalog` record oracle.

After reopening the completed run in Runtime Debug, the panel rendered all
eight rows. Both inline export buttons completed: CSV produced a non-empty
953-byte download and JSON a non-empty 1,250-byte download. No export content
or captured row value was logged or included here.

## Isolated environment

- Downstream pair: `F:\fxlab\t027-extraction-exit\!FluxIQWebExtension`,
  detached at integrated t027 head `30772a016b67eae856806052c20b24418cc79082`.
- Core pair: `F:\fxlab\t027-extraction-exit\!FluxIQ`, detached at integrated
  t027 head `949735d22839574a0437de0457802fb6216472a0`.
- Disposable run roots:
  `F:\fxlab-runs\t027-extraction-exit-live` through `...live5`; the passing
  iteration reused only the already-isolated `live5` workspace.
- Production panel/gateway ports: `3385` / `4955`. Both were closed after the
  run. Port `3000`, the user's profile, and the user's store were untouched.
- Browser: Playwright's unpacked-extension Chromium in isolated persistent
  profiles, headless, against the real production panel and Scenario Lab
  `product-catalog` page.
- Passing evidence run:
  `extraction-exit-live-2026-09-21T01-52-37-011Z-1895f8`, verdict `passed`,
  evidence interval 40.049 seconds.

Credentials remained process-local. The report contains no credential,
pairing token, browser state, selector payload, raw recording, extracted cell,
or exported body.

## Live proof

| Boundary | Observed result |
| --- | --- |
| Picker | 8 repeated items proposed |
| Extension preview | 5 sample rows rendered |
| Field review | 7 fields inferred; UI retained/renamed the 4 oracle fields and removed 3 extras |
| Recording confirmation | 8 records captured |
| Recording compilation | 1 ordinary policy action, output `web.dom.extract_list`, source-recording provenance present |
| Panel playback | terminal `succeeded` |
| Durable dataset | 1 dataset, 8 stored rows |
| Record oracle | passed against all expected rows and fields |
| Runtime Debug preview | 8 rows rendered |
| CSV export | completed, non-empty (953 bytes) |
| JSON export | completed, non-empty (1,250 bytes) |

## Live-first iterations

No product source was changed. The first iterations corrected only mistakes in
the ignored, run-scoped driver:

1. The driver foregrounded the extension page after picking, making the active
   page unsupported and disabling Stop Recording. It now leaves the scenario
   page active.
2. The confirmed extraction dialog intentionally remains open so the operator
   can read the capture count; the driver now closes it before stopping.
3. The convenience run-detail adapter omits raw dataset summaries by design;
   the driver now reads the bounded raw run-detail endpoint used by the dataset
   lane.
4. Runtime Debug stayed on its pre-run `0 runs` view after its own successful
   run. Reloading Runtime Debug and opening the completed run exposed the real
   dataset panel.
5. The table first renders one loading-placeholder row. Waiting for loading to
   settle exposed all eight rows.

The fourth item is a real product UX defect, not required driver glue: after a
successful panel-started run, Runtime Debug did not refresh its run count or
focus the completed run. A user must reload and reopen the run before seeing
the dataset preview/export controls. Recommended follow-up: publish/consume the
`runtime-run.changed` mutation on terminal completion (or explicitly refresh
run history and focus the returned run id) so the dataset appears without a
page reload.

## Reusable node capability audit

This journey did not reveal a missing reusable node capability. The recorded
extraction compiled into the existing reusable `web.dom.extract_list` output,
ran as an ordinary policy-action node, persisted its dataset, and satisfied the
oracle. The only product gap observed was panel run-history refresh; it is UI
state synchronization, not a missing node or executor capability.

## Validation and handoff

- Pair installation and Core contract/FluxIQ/gateway builds: passed.
- Scenario Lab build: passed.
- Chrome extension production build: passed.
- Test evidence/contracts and test-runner builds: passed after their explicit
  workspace dependencies were built.
- Exact production UI live path: passed as detailed above.
- Focused unit tests: not run because the successful work made no product
  source change; the live browser path is the validation target.
- Full suites: not run.
- Both isolated source worktrees remained clean. The run-scoped driver and all
  browser/evidence artifacts are ignored disposable files.
- No commit, merge, or push was performed.

