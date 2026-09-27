# t323 — Final validation sequence after run-3 documentation

Status: **Complete report-only sequence; no validation command was run**

This sequence assumes run 3, its bounded evidence review, both active-plan updates, MVP-plan
compaction, and all report writing have settled. It does not require opening `test-runs/` again.

## Stop conditions before validation

Do not start while a live Lab/browser/provider/test-runner/Scenario-Lab process is still active, a
Lab build lock exists, or an agent is editing either checkout. A worktree isolates files, not CPU,
ports, browsers, or build outputs; only one live Lab run may exist at once. Do not remove profiles,
locks, run directories, or generated output to manufacture a clean state.

Capture both repositories' branch, HEAD, full status, and changed-path names. First classify every
post-t309 change as one of: nested report/debug documentation, top-level authored documentation,
generated working index/baseline, test-only, production source, or generated build output. Stop if
an unexplained source/test path exists.

## Narrow-to-full order for the expected doc-only closeout

1. Finish authored changes first: renamed/completed run-3 debug, both Current State/ledger updates,
   MVP-plan compaction/archive, and any architecture text. Do not regenerate the index between
   concurrent edits.
2. In the downstream repository, regenerate only the working-document rule:

   ```powershell
   pnpm structure:baseline --rule working-docs
   ```

   Require exit 0. Review only `.structure-baseline.json` and `docs/working/README.md`: the index
   must be the deterministic top-level-doc table/footer; any baseline change may only lower/remove
   `working-docs` debt. No `--adopt`, no unscoped baseline update, and no hand edit of the index.
3. Check the generated pair before broader validation:

   ```powershell
   git diff --check -- .structure-baseline.json docs/working/README.md
   pnpm structure:check
   ```

   Require no stale-index, header, Current State, ledger, or compaction failure.
4. Re-observe the six output/dependency timestamp comparisons from t309. Run 3 may have regenerated
   ignored output even when authored source did not change, so t309's timestamps must be observed
   again. Do not rebuild merely because a timestamp moved; require strict `output > newest tracked
   input/dependency` for test-contracts, test-evidence, domain, extension, Scenario Lab, and test
   runner.
5. If all authored changes are documentation-only and all six comparisons remain fresh, run the
   downstream full relevant gate:

   ```powershell
   pnpm check
   ```

   This expands the already-green structure rule into structure tests, Lab launcher tests, task/
   worktree tests, the full structure audit, and recursive package checks. It is the required final
   downstream check for the documentation/index tree.
6. Run a final whitespace/scope check over the authored and generated documentation paths, then
   recapture both repositories' branch/HEAD/status fingerprints and the six freshness comparisons.
   The captured identity must be after index generation and after every documentation edit.

For this doc-only closeout, do **not** run downstream `pnpm test` or `pnpm build`: documentation,
the generated index, and a lowered working-doc baseline do not affect executable behavior. The
repository rule says check/test/build when scope warrants; these two do not add evidence for a
documentation-only delta and can rewrite ignored output needlessly.

## Core sequence and acceptance rule

If Core branch/HEAD, the three final test working blobs, and all production-owner blobs remain the
t309 values, run no new Core command. Keep accepted:

- t290 81/81, t293 51/51, and t304 web 11/11 plus nearest Core 30/30;
- the final root results: contracts 53/53, gateway 3/3, FluxIQ 3,994 passed plus 1 skipped across
  413 files, web 1,346/1,346 across 246 files;
- t298 Core `pnpm check` exit 0 in 22.20 seconds and its three-test diff-check.

Downstream documentation cannot invalidate Core tests/checks. An exact post-doc Core status
fingerprint may differ only if Core itself changed; if it did, do not reuse t298 by date alone.

If Core has doc-only edits, run Core `pnpm structure:check` and then Core `pnpm check`; retain prior
Core tests/builds. If Core source or tests changed, use the changed-path branch below.

## If classification is not doc-only

### Test-only change

Run the narrow affected test matrix first, then the owning package check, then the repository root
test and check. A test-only edit does not require a production build or downstream output rebuild,
but it invalidates any earlier root-test identity that did not include that test blob.

### Core production change

From Core, run affected focused tests, then:

```powershell
pnpm check
pnpm test
pnpm build
```

Rebuild any downstream output that consumes changed Core `dist`, then rerun the complete six-way
freshness comparison and affected downstream checks/tests. A Core production edit invalidates
t298/t309's production-drift verdict even if the old commands once passed.

### Downstream production change

Run affected package checks/tests first and rebuild the owning output through its package script.
Rebuild stale dependents in topological order only: Core contracts/gateway first when changed;
downstream test-contracts and domain; extension/Scenario Lab/test-evidence as their inputs require;
test runner last after domain/test-evidence. Then require all six strict freshness comparisons and
run:

```powershell
pnpm check
pnpm test
pnpm build
```

Never hand-edit `dist`, `build`, `.test-build`, `.script-build`, Lab instances, or other generated
state. Use unlabelled domain test only when the domain test build itself must be regenerated.

## Prior evidence: retain versus refresh

| Evidence | After downstream doc-only edits |
| --- | --- |
| t290/t293/t304 focused results | Retain if their Core working blobs match t309. |
| t298 Core root test/check | Retain if Core source/test identity matches t309. |
| t309 no-production-drift verdict | Retain substantively after confirming the same source/test blobs; recapture the final repository fingerprint because plans/index/debug changed downstream status. |
| t309 six-way freshness | Re-observe timestamps after the live run; rebuild only a stale owner/dependent. |
| Provider-free dry-run | Retain as pre-live readiness evidence; doc edits do not invalidate it, but it is not post-run product evidence. |
| Run-3 integrity/evidence review | Retain from its bounded debug/report; do not reopen raw artifacts merely for doc validation. |
| Earlier one-Lab GO | Expired snapshot. It authorizes nothing later; repeat immediately before any further live run, not for a docs-only check. |
| Downstream working-index check | Must rerun after final top-level plan/compaction edits and scoped regeneration. |
| Exact downstream status fingerprint | Must recapture last, after README/baseline generation and all reports/docs settle. |

## Privacy and generated-data boundary

No validation step needs `.fluxiq`, `test-runs`, provider sidecars, browser profiles, credentials,
cookies, authorization material, recorded rows/page data, or raw run output. Keep run artifacts and
all build outputs ignored and uncommitted. The only intended generated documentation writes are
`docs/working/README.md` and, if the ratchet improves, `.structure-baseline.json`.

If validation exposes an unexpected file write, source/test drift, active Lab process, or lock,
stop and classify it; do not clean, delete, reset, or rerun around it.

t323 ran no check, test, build, browser, provider, Lab, or live command; opened no `test-runs`
content; and changed no shared documentation, generated state, commit, or source. This report is
its only write.
