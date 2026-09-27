# t417 — frozen candidate refresh

## Verdict

**GO to begin the explicit serial staging groups in t413.** After all other report writers stopped,
every dirty entry in both repositories fit the frozen t399/t413 inclusion lists. There are no
unmerged, tracked-ignored, forbidden, or out-of-scope paths; both working-tree diff checks exit 0;
the downstream index is empty; and Core's inherited partial index remains exactly the expected
deletion plus rename with a modified destination. The filename-only sensitive scan has no
unexplained hit.

This is permission to start the explicit staging gates, not permission to commit, merge, finish a
task, push, invoke a provider, or run live validation. I did not stage or inspect ignored/runtime
artifacts, and I did not test, build, commit, operate Lab/browser/panel, or invoke a provider.

## Frozen manifests

| Repository | Branch / HEAD | Exact dirty status | Frozen ownership groups |
| --- | --- | --- | --- |
| downstream | `task/t170-mvp-today-integration` / `5b8429c543fdc27eb892c225641717aed43c5dc4` | 387 entries: 76 modified, 311 untracked | browser/domain 70; facility 60; architecture 4; working record 253 |
| Core | `task/t170-mvp-today-integration` / `d035e1b7d17977951a2a2ec6b5e51570e3f2c537` | 222 entries: 128 modified, 92 untracked, one staged deletion, one `RM` rename | implementation/tests 217; architecture 3; generated references 2 |

Downstream has zero cached entries. Core has exactly these two cached name-status records:

```text
D    packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure.ts
R100 packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/tests/generation-failure.test.ts -> packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/tests/diagnostics.test.ts
```

The three-path move status is still exactly `D` plus `RM`; the current diagnostics destination bytes
are therefore not yet fully staged. Complete this inherited index in place with t413's full Core
implementation pathspec. Do not reset, restore, stash, clean, or commit the partial state.

## Path and privacy gates

- Inclusion review: zero paths outside the four downstream or three Core frozen groups.
- Exclusion review: zero forbidden generated/runtime paths in either candidate manifest.
- Git integrity: zero unmerged entries and zero tracked-ignored paths in both repositories.
- `git diff --check`: exit 0 in both repositories; only line-ending advisories were suppressed.
- Filename-only scan: 387 extant downstream candidates, zero hits; 220 extant Core candidates, five
  hit files. Core has two additional non-extant status paths represented by its delete/rename.

The five Core hit files contain nine matched lines. Redacted manual inspection classified all of
them as synthetic negative-test fixtures:

- provider-refusal credential rejection (one line);
- repair-parameter screening and oversize-token rejection (three lines);
- credential-bearing repair-advice screening (one line);
- sensitive record-summary suppression (one line); and
- repair-context bearer/parameter leakage screening (three lines).

No real credential, provider/page value, request header, pairing or bearer token, local browser
state, raw run content, or machine-local secret was observed. The scan disclosed only file names;
manual review redacted each matching fixture value in its inspection output.

## Handoff

The trees are path-frozen at the counts above, including this report. Begin with the Core
implementation/tests group so its inherited `D` plus `RM` state is completed atomically, then apply
t399 Gate 3 after every explicit t413 group. Any path addition, removal, rename, or edit after this
report invalidates the freeze and requires another candidate refresh before staging continues.
