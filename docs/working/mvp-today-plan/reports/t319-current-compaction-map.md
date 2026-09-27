# t319 Current MVP-Plan Compaction Map

Status: **Ready to apply; supersedes t306's narrower t219–t296 cut map.**

Snapshot basis: `docs/working/mvp-today-plan.md` is 902 lines. Its authoritative Current State is
66 lines by the protocol boundary (`## Current State` through the line immediately before
`## The Binding Rules`). The active plan exceeds the 800-line compaction trigger.

The plan currently contains worker briefs only through t311. Reports t312–t317 exist outside the
shared plan, but no t312–t318 brief text is present in the active document and no t318 report was
present at this snapshot. Those files therefore do not move the archive boundary. If a shared-plan
brief is appended before application, recalculate the endpoint and hash; do not silently absorb it.

## Exact archive payload

Create one archive:

`docs/working/mvp-today-plan/archive/2026-09-26-run2-through-run3-launch-gate-briefs.md`

Move verbatim, in current order:

- first line: **165**, `### Brief: t219-run2-preflight-delta`;
- last line: **852**,
  ``- Report to: `docs/working/mvp-today-plan/reports/t311-immediate-pre-dry-run-machine-gate.md` ``;
- payload: **688 lines**, **54,607 UTF-8 bytes** after LF normalization with one terminal LF;
- normalized SHA-256:
  `3ea61fef57ed99ca171a5e59a4645605dc36b7472e2cd4a2a00f5091fa6ca79b`.

Select by the exact first and last text, not by future numeric line. Do **not** include current line
853 (the blank before `---`) or the `---` at line 854.

The archive should contain a short H1/introduction, link back to
`../../mvp-today-plan.md`, link to
`./2026-09-26-pre-run-and-run1-coordination.md`, and delimit the unchanged payload with:

```html
<!-- BEGIN VERBATIM t219-t311 -->
<!-- END VERBATIM t219-t311 -->
```

The markers and archive introduction are outside the 688-line/hash calculation. This single
archive replaces t306's not-yet-created t219–t296 archive; do not create both archives or leave two
pointers for one continuous settled brief history.

## Exact active-plan replacement

Retain `## Worker Briefs` and its current opening lines 160–164. Replace only lines 165–852 with:

```md
Completed t219–t311 briefs are in the [run-2 through run-3 launch-gate archive](./mvp-today-plan/archive/2026-09-26-run2-through-run3-launch-gate-briefs.md).
```

Retain the existing blank line after the replacement, then the `---`, `## Work Ledger`, and
everything after it. Future briefs go below the archive pointer; completed report files remain at
their current paths and are not copied into the active plan.

## Retained active skeleton

These headings remain in the active plan, in this order:

1. header block and `## Current State`;
2. `## The Binding Rules` and all four rule subsections;
3. `## Current Runtime And Judge Contracts`;
4. `## Live Validation Contract`;
5. `## Active Order Of Work`;
6. `## Worker Briefs` with the two archive pointers;
7. `## Work Ledger`;
8. `## Open Questions`.

The binding rules, runtime/judge contract, and live validation contract remain useful current
reference and must not be archived. `Active Order Of Work` is also retained, but its stale run-2
steps must be rewritten to the current run-3 launch/debug sequence when Current State is refreshed.

## Current State requirements before declaring compaction complete

Protocol compaction folds settled outcomes into Current State; merely cutting briefs is incomplete.
Keep the section under 150 lines and preserve these facts:

- the purpose and four MVP criteria, with run 2 still the latest accepted failed live measurement;
- live run-1 and run-2 ids, stage/result facts, non-additive run-2 accounting, and streak **0**;
- t217's local correction and its explicit still-unmeasured-live boundary;
- the locally completed t258 production chain: truthful provenance, exact held-grant continuation,
  durable repair apply, authoritative binding read, selected-Subflow zero-provider replay,
  recursive judgement, outer terminal revoke, and fail-closed post-apply behavior;
- test-only status of t290, t293, and t304; they changed no production permission/deadline/UI
  behavior;
- exact final local validation and readiness results accepted from the final reports: Core root
  tests/check, downstream freshness/identity, zero-provider dry-run, and Stage-1 installation/
  attestation, without converting any of them into live proof;
- current next action: immediate one-Lab/process-lock gate, one unchanged live invocation, t266
  capture/privacy order, and full debug before another provider call;
- blocker text matching the latest accepted pre-live report. Do not say `None` if a final machine
  gate or t318 outcome is still pending;
- no claim of a repaired live Flow, persisted live repair, live zero-provider replay, recursive
  fourth live judgement, or first pass before the finalized run bundle proves it.

Update `Status detail` and `Last updated` with that same boundary. Do not preserve the current stale
header sentence saying t229's narrow fix is next.

## Ledger requirements

Retain the five existing ledger entries verbatim. They are under the 20-entry trigger and remain
the accepted history of opening, runs 1–2, t217, and the previous compaction.

Before the new compaction entry, integrate the settled post-run-2 work as at most two normal
entries, each under 15 lines:

1. **Run-2 repair path completed locally** — implementation/reviews plus the t290/t293/t304
   test-only reconciliations; record exact observed focused/root results and keep live proof absent.
2. **Final validation and provider-free launch readiness** — final Core check/root evidence,
   downstream freshness/identity, zero-call readiness, and installed Stage-1 attestation; record the
   precise remaining live action and streak 0. If the latest t318 result is not actually available,
   mark that portion Partial rather than infer it.

Then append the required compaction entry:

```md
### 2026-09-26 — Compacted run-2 through run-3 launch-gate worker briefs
- Agent: supervisor with t306 and t319
- Changed: this plan and `mvp-today-plan/archive/2026-09-26-run2-through-run3-launch-gate-briefs.md`
- Why: The active plan exceeded 800 lines and settled briefs obscured current live-launch state.
- Validation: archived payload -> 688 lines and SHA-256 `3ea61fef57ed99ca171a5e59a4645605dc36b7472e2cd4a2a00f5091fa6ca79b`; active heading/link and `git diff --check` verification -> passed.
- Outcome: Accepted
- Follow-up: execute only the Current State's next action; reports remain the detailed evidence.
```

Replace `passed` with the actual observed result if any verification fails; never paste this worker
claim unchanged without supervisor verification.

## Line-count impact

Exact structural effect on the current 902-line snapshot:

| Operation | Active-plan lines |
| --- | ---: |
| Current file | 902 |
| Replace 688-line payload with one pointer (`-687`) | 215 |
| Add one seven-line compaction entry plus separating blank (`+8`) | **223** |
| Add the two recommended seven-line ledger entries plus blanks (`+16`) | **239** |

Current State is presently 66 lines. If its refresh is held to 80 lines, the fully integrated plan
is at most **253 lines** (`239 + 14`), far below the 800-line trigger and 150-line Current State
limit. The exact final formula is `239 + (refreshed Current State lines - 66)`; report the measured
number rather than assuming the 80-line target.

Nested archive size does not affect the top-level working-document index, which indexes
`docs/working/*.md` rather than archive files.

## Safe apply order

1. Stop concurrent writers to `mvp-today-plan.md`; re-read its line count/headings.
2. Extract the exact first/last-text-bounded payload; require 688 lines and the recorded hash.
3. Prepare the refreshed Current State/status/Active Order and the two evidence ledger entries from
   accepted reports, keeping all live claims at streak 0.
4. Create the new archive with links, markers, and verbatim payload.
5. Rewrite Current State/status/Active Order, replace the active payload with the one pointer, and
   append the two evidence entries plus compaction entry in one supervisor-owned edit.
6. Re-extract the archive marker payload and require the same line count, endpoints, bytes/hash.
7. Verify active headings, both archive links, Current State line count, ledger-entry lengths, and
   final whole-file line count.
8. Run `git diff --check` on the plan/archive, then the repository's owning working-document index/
   structure workflow. Inspect the regenerated index instead of hand-editing it.
9. Only after documentation verification resume the Current State's live-launch sequence.

Read-only verification pattern before and after the cut:

```powershell
$p = 'docs/working/mvp-today-plan.md'
$l = Get-Content -LiteralPath $p
$s = [Array]::IndexOf($l, '### Brief: t219-run2-preflight-delta')
$e = [Array]::IndexOf($l, '- Report to: `docs/working/mvp-today-plan/reports/t311-immediate-pre-dry-run-machine-gate.md`')
$payload = $l[$s..$e]
$bytes = [Text.Encoding]::UTF8.GetBytes(($payload -join "`n") + "`n")
$sha = [Security.Cryptography.SHA256]::Create()
try { ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant() }
finally { $sha.Dispose() }
```

Require nonnegative indices, 688 lines, the exact first/last lines, and the recorded hash before
editing. Afterward, hash only the text between archive markers.

## Scope

This task read the protocol, current active plan, and t306, and performed read-only line/hash
measurements. It did not edit a shared plan/archive/index, run tests/build/dry/live/provider/browser/
Lab commands, or commit/push. This report is the only file written.
