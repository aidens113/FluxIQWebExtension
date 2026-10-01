# Background and Production refresh adapters

Status: Exact five paths implemented; supervisor follow-up target-error correction completed.42 focused tests and corrected scoped strict typing pass; product/tests/report refrozen for supervisor verification. Read compacted Current State, released brief and frozen audit. No other source ownership, shared-hook/backend/styles/shared-doc changes, broad/live calls or commits.

Policy: selected Background history has independent completion-based10s cadence, not snapshot-triggered reads. Mutations request coalesced refresh; acceptance feedback does not claim current snapshot confirmation, and the next normal read reconciles server state. No replayed writes or extra queued loops. Existing Production overlapping-manual refresh regression is explicitly authorized to assert coalescing while preserving target/default/post assertions.

Implementation approach: each exported program adapter creates an API-identity keyed private workspace in its same owned file. Changing API immediately replaces workspace state/drafts/locks; a parent render-owner predicate additionally rejects old callbacks before passive cleanup. Within each workspace, captured old action identity and lifecycle checks protect mutations. This stays in the exact owned files and avoids broad helper extraction.

## Changes

Background snapshot uses shared refresh/feedback with1s estimate clock. A second instance owns only selected task history, with memoized API/task/status/offset identity, signal-bearing detail POST limit50, independent completion10s cadence, retained same-query data/error/stale feedback and owner-query guards. No task means no network detail read. Changing task/filter/page masks old page/detail during render; same-id run selection resolves against fresh page object. Out-of-range total shrink clamps directly to last valid50-row offset. New feedback sits outside existing grid.

Background writes have synchronous shared busy lock and try/catch/finally release; captured old action/task handlers reject before POST. Results for a different current task do not select its run/status, and owner remount prevents old busy/result/error updates reaching new owner. Action acceptance uses existing StatusText/global notification, explicitly separate from snapshot confirmation. Successful run refresh coalesces snapshot/history; other success refreshes snapshot. Reads never replay writes.

Production snapshot uses shared hook/feedback with10s estimate/staleness clock. Same-owner same-target drafts/defaults, run-id selection/log cap/filter and immediate launch/independent per-run locks remain. API identity remount resets foreign drafts/status/locks even when target/run IDs match; parent render guard and layout cleanup reject old actions/refresh callbacks before passive cleanup. Old finally belongs only to old workspace's lock set and cannot release same-id new-owner work. Start acceptance explicitly states snapshot confirmation is separate.

Only authorized existing Production test changed: two manual refresh activations now assert one pending read, preserving confirmed target/default and subsequent launch POST assertions. Other original six behavior assertions preserved; harness adds fake timers/document with cleanup.

## Validation ledger

- First focused session9779 native1,6files/33pass+3fail. New test mistakes: full JSON substring `first` matched static "Newest runs first"; execution fixture used unsupported message field instead of result; action acceptance is existing global StatusText notification rather than local DOM. Corrected synthetic targeting/schema and notification capture; no production contract weakened.
- Corrected session96268 native0,6files/36tests,9.05s. Further targeted lifecycle/permission/selection regressions added.
- Final current focused session22850 `codex t224 operational adapters races40` native0,6files/40tests,8.99s. Background freshness10, Production freshness8, existing Production operations7, shared hook9, unchanged pure/source Background2+Production4. No skips. Existing React renderer deprecation warning only.
- Scoped strict TypeScript session77727 native0, temporary `%TEMP%/codex-t224-operational-adapters-tsconfig.json` extends unchanged web config, names five owned roots plus Next ambient declarations and checks transitive imports; incremental output disabled. No assertion/typeconfig weakening. Scoped tracked diff whitespace check native0.
- Added final mounted/render-owner guard directly to Background history read (same guard already protects snapshots/captured refresh), then froze. Final focused95175 native0,6files/40tests,9.76s. Final scoped27669 native0 on same frozen source.
- No broad gates/build, live/browser/provider/panel calls or commits. Supervisor owns independent review, broad verification and checkpoint.

## Resume

Supervisor independently review five frozen paths and run relevant combined/broad gates. Parent owns global request contracts separately. No shared hook changes are needed or made. Tests establish synthetic frontend behavior; browser layout/focus/load certification remains unperformed.

## Supervisor follow-up: pending launch target error

Supervisor identified that pending start A could fail after the user selected B, putting A's error in B's launch panel because only API ownership was checked. Reproduced both refusal and transport rejection before product edit: targeted `codex t224 production target error repro` native1,2fail/8excluded by name filter. Both fail specifically on foreign Workload not started feedback.

Failure state now carries submitted effective target key `[type,id]`; visible launchError derives only when that key matches current effective target. This masks mismatched errors during render, including type switches sharing an id. Existing named global acceptance feedback and launch lock release remain; B's edits survive and B can launch after A finishes. No Background changes in this correction.

Two regressions: taskA->taskB refused; taskA->routine same-id rejected. Each confirms no foreign launch panel/error, edited B amount19 survives, lock releases, and subsequent B POST uses correct target type/id/parameters. Corrected full focused native0,6files/42tests,7.89s, no skips. Corrected scoped73693 native0 on frozen source.
