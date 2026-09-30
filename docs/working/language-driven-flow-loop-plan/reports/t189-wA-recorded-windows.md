# t189-wA: what each decision was shown, rebuilt from three recorded live runs

Brief t189-wA. Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t189/!FluxIQ`, branch
`task/t189-decision-context`, on the current code with nothing but the two new test files
added. `R` = `packages/fluxiq/src/programs/automation-studio/runtime`.

## Outcome

Done. Two new files replay run 6 (bigbox), crossborder and run 4 (everything-store) through
the real `runAutomationStudioLlmEvidenceLoop`. The replays match the three logs exactly: every
decision kind, every call id in order, every result code and every dry-run call id. They also
capture what each decision was shown. All 12 tests pass.

One defect in the current, non-test code showed up along the way. I did not fix it, because
non-test files were out of bounds for this brief. See "Open questions" item 1.

## What changed and why

- `R/llm/decision-context/tests/recorded-runs.ts` (new). It holds each run's `[FluxIQ build-trace]`
  log, transcribed one decision per line, plus the annotations the log cannot carry:
  - which calls ran read nodes;
  - the content of each amendment;
  - each completion check's answer.

  Its driver, `replayRecordedRun(name, { pageBytes?, detectBytes?, pastLog? })`, returns
  `{ shown, trace, result, rebuilt, logged, answered, coreEntries }`:
  - `shown` is the exact `evidence` array each `decide` call received.
  - `rebuilt` is the replay written back out in the log's own format.
  - `coreEntries` is every Core note the loop is known to have written. A note is known either
    because some window carried it, or because the trace implies it: a refused check, an
    answered request, or a refused amendment.

  Everything the driver answers comes from the log, looked up by call id: results, reruns and
  dry-run steps. So the loop, not the script, decides which calls happen, under which ids, and
  in which dry-run positions.
- `R/llm/decision-context/tests/recorded-windows.test.ts` (new).
  - (a) One test per run checks `rebuilt` against `logged`, and checks that the run ends where
    the log ends. It also checks that every decision scripted as answered from memory was
    recorded `llm_evidence_loop.already_answered`.
  - A seventh test records the defect below.
  - (b) One test per chosen decision prints the window with `console.table` and asserts it
    against pins: the callIds shown, the earlier Core notes missing, the history lines, and a
    total at or under the 24,000-byte window. The pins record what the current code does. They
    are findings, not a contract.

## Commands run and observed results

- `node <scratch>/verify.mjs`: an independent re-transcription of each `core.log` compared with
  the fixture's `LOG` text. Output: `run-muncqlr0-3348202b MATCH 37 decisions`,
  `run-munda7ub-d9214e3b MATCH 22 decisions`, `run-munaiz76-7026748c MATCH 47 decisions`.
- From `packages/fluxiq`:
  `npx vitest run src/programs/automation-studio/runtime/llm/decision-context/tests/recorded-windows.test.ts`.
  Output: `Test Files  1 passed (1)` and `Tests  12 passed (12)` (Duration 17-20 s).
- `npx tsc --noEmit -p tsconfig.json` (whole package): exit 0, no errors.
- `node scripts/structure-audit.mjs` (Core root): the only line about the new files is the advisory
  `warn [file-lines] ... recorded-runs.ts: 673 lines is past the 400-line advisory threshold`. It
  reported no violation.
- The first run of the tests hit the defect. Run 6 died with
  `Error: Cannot measure malformed or unknown packed draft shape`
  (`evidence-loop/draft-shown.ts:171`, called from `evidence-loop.ts:562`). To see the entry, I
  wrapped `automationStudioLlmEvidenceLoopDraftShown` with `vi.mock` in a throwaway test, which
  I have since deleted. The entry was a packed `step_rows_v1` draft whose rows 2 and 5 carry the
  disposition `"did_not_work"`.

## Findings: what the chosen decisions were shown

Sizes are the default 5,800-byte pages and 2,000-byte detections, so the byte figures are the
replay's. Which entries are shown and which are dropped depends on those sizes. Core notes (the
`core.completion_check.*`, `core.dry_run.*`, `core.request_check.*`, `core.no_progress.*` and
`core.amendment_check.*` entries) carry no call summary. **A dropped Core note therefore leaves no
trace at all: `core.evidence_history` lists only tool calls.**

Summary of what was lost:

- **Run 6, decisions 26 and 37.** Both are after the long answered-from-memory runs.
  - 26 had lost 12 of the 21 earlier notes; 37 had lost 16. All were request-check or
    no-progress notes. Only the latest three of each survived at 26, and only the latest one of each at 37.
  - Every completion and dry-run refusal was still shown at 26 and 37.
  - At 37, the page from dry run 1 (`dryrun.1.4`, 5,861 bytes) and its refusal
    `core.dry_run.1` are still in the window. That is a quarter of the window spent on a replay
    of two steps that were dropped at decision 23.
- **Crossborder, decisions 13 and 14.** Nothing was lost. Decision 14 was shown both identical
  refusals, `core.completion_check.12` and `.13`, side by side.
- **Run 4, decision 30.** Nothing was lost.
- **Run 4, decision 47.**
  - Dropped with no trace: the completion-check refusals from 40 and 44, and the request check
    from 8. Only the newest refusal, `.46`, is shown.
  - Still shown: the refusal from dry run 1 and its page (`core.dry_run.1`, `dryrun.1.3`),
    although dry runs 2, 3 and 4 all replayed clean. A refusal that is no longer true stays in
    front of the model, because it remains the newest entry of its tool id.
  - `core.evidence_history` lists one call and counts 25 as `unlisted`.
- **Run 4, decision 47, draft entry.** `draftShown` is
  `{"bytes":3953,"budget":4000,"steps":20,"instructionBytes":154,"withoutInput":3}`. The draft
  was cut down to the minimal instruction (154 bytes against 1,052 earlier), and the 3 oldest
  steps lost their arguments.
- **Run 6, decision 22.** 18 entries. 8,398 of its 23,919 bytes are request-check and no-progress
  notes (seven `core.request_check.*` and six `core.no_progress.*`).

### bigbox-run6, decision 15

10 entries, 23892 bytes. Draft entry as recorded (`draftShown`): `{"bytes":2358,"budget":4000,"steps":5,"instructionBytes":1052}`.

| # | callId | toolId | bytes |
| --- | --- | --- | --- |
| 0 | `core.evidence_history` | `core.evidence_history` | 971 |
| 1 | `core.no_progress.8` | `core.no_progress` | 812 |
| 2 | `core.request_check.9` | `core.request_check` | 492 |
| 3 | `core.no_progress.9` | `core.no_progress` | 812 |
| 4 | `open-store-picker-2` | `core.run_node` | 5866 |
| 5 | `pick-millbrook` | `core.run_node` | 5861 |
| 6 | `snap-store-list` | `core.run_node` | 5862 |
| 7 | `core.request_check.14` | `core.request_check` | 503 |
| 8 | `core.flow_draft` | `core.flow_draft` | 2422 |
| 9 | `core.budget.15` | `core.budget` | 291 |

- Earlier Core notes present: `core.no_progress.8`, `core.no_progress.9`, `core.request_check.9`, `core.request_check.14`
- Earlier Core notes absent, with no trace anywhere in the window: `core.request_check.6`, `core.request_check.7`, `core.request_check.8`
- `core.evidence_history` lines: `initial.core.run_node` web.inspect.succeeded changed=no; `dismiss-privacy` web.action.rejected.target_unobserved changed=no; `snap2` web.inspect.succeeded changed=no; `dismiss-privacy-2` web.action.succeeded changed=yes; `open-store-picker` web.action.rejected.target_unobserved changed=no; `snap3` web.inspect.succeeded changed=no

### bigbox-run6, decision 22

18 entries, 23919 bytes. Draft entry as recorded (`draftShown`): `{"bytes":2362,"budget":4000,"steps":5,"instructionBytes":1052}`.

| # | callId | toolId | bytes |
| --- | --- | --- | --- |
| 0 | `core.evidence_history` | `core.evidence_history` | 1081 |
| 1 | `core.no_progress.9` | `core.no_progress` | 812 |
| 2 | `pick-millbrook` | `core.run_node` | 5861 |
| 3 | `core.request_check.14` | `core.request_check` | 503 |
| 4 | `core.request_check.15` | `core.request_check` | 503 |
| 5 | `core.request_check.16` | `core.request_check` | 503 |
| 6 | `core.no_progress.16` | `core.no_progress` | 813 |
| 7 | `core.request_check.17` | `core.request_check` | 503 |
| 8 | `core.no_progress.17` | `core.no_progress` | 813 |
| 9 | `core.request_check.18` | `core.request_check` | 503 |
| 10 | `core.no_progress.18` | `core.no_progress` | 813 |
| 11 | `core.request_check.19` | `core.request_check` | 503 |
| 12 | `core.no_progress.19` | `core.no_progress` | 813 |
| 13 | `snap-store-list` | `core.run_node` | 5862 |
| 14 | `core.request_check.20` | `core.request_check` | 503 |
| 15 | `core.no_progress.20` | `core.no_progress` | 813 |
| 16 | `core.flow_draft` | `core.flow_draft` | 2426 |
| 17 | `core.budget.22` | `core.budget` | 291 |

- Earlier Core notes present: `core.no_progress.9`, `core.request_check.14`, `core.request_check.15`, `core.no_progress.16`, `core.request_check.16`, `core.no_progress.17`, `core.request_check.17`, `core.no_progress.18`, `core.request_check.18`, `core.no_progress.19`, `core.request_check.19`, `core.no_progress.20`, `core.request_check.20`
- Earlier Core notes absent, with no trace anywhere in the window: `core.request_check.6`, `core.request_check.7`, `core.no_progress.8`, `core.request_check.8`, `core.request_check.9`
- `core.evidence_history` lines: `initial.core.run_node` web.inspect.succeeded changed=no; `dismiss-privacy` web.action.rejected.target_unobserved changed=no; `snap2` web.inspect.succeeded changed=no; `dismiss-privacy-2` web.action.succeeded changed=yes; `open-store-picker` web.action.rejected.target_unobserved changed=no; `snap3` web.inspect.succeeded changed=no; `open-store-picker-2` web.action.succeeded changed=yes

### bigbox-run6, decision 26

13 entries, 23800 bytes. Draft entry as recorded (`draftShown`): `{"bytes":2892,"budget":4000,"steps":7,"instructionBytes":1052}`.

| # | callId | toolId | bytes |
| --- | --- | --- | --- |
| 0 | `core.evidence_history` | `core.evidence_history` | 1392 |
| 1 | `core.request_check.18` | `core.request_check` | 503 |
| 2 | `core.no_progress.18` | `core.no_progress` | 813 |
| 3 | `core.request_check.19` | `core.request_check` | 503 |
| 4 | `core.no_progress.19` | `core.no_progress` | 813 |
| 5 | `core.request_check.20` | `core.request_check` | 503 |
| 6 | `core.no_progress.20` | `core.no_progress` | 813 |
| 7 | `dryrun.1.4` | `core.dry_run.page` | 5861 |
| 8 | `core.dry_run.1` | `core.dry_run` | 1708 |
| 9 | `core.completion_check.22` | `core.completion_check` | 1778 |
| 10 | `open-store-picker-3` | `core.run_node` | 5866 |
| 11 | `core.flow_draft` | `core.flow_draft` | 2956 |
| 12 | `core.budget.26` | `core.budget` | 291 |

- Earlier Core notes present: `core.no_progress.18`, `core.request_check.18`, `core.no_progress.19`, `core.request_check.19`, `core.no_progress.20`, `core.request_check.20`, `core.completion_check.22`, `core.dry_run.1`, `dryrun.1.4`
- Earlier Core notes absent, with no trace anywhere in the window: `core.request_check.6`, `core.request_check.7`, `core.no_progress.8`, `core.request_check.8`, `core.no_progress.9`, `core.request_check.9`, `core.request_check.14`, `core.request_check.15`, `core.no_progress.16`, `core.request_check.16`, `core.no_progress.17`, `core.request_check.17`
- `core.evidence_history` lines: `initial.core.run_node` web.inspect.succeeded changed=no; `dismiss-privacy` web.action.rejected.target_unobserved changed=no; `snap2` web.inspect.succeeded changed=no; `dismiss-privacy-2` web.action.succeeded changed=yes; `open-store-picker` web.action.rejected.target_unobserved changed=no; `snap3` web.inspect.succeeded changed=no; `open-store-picker-2` web.action.succeeded changed=yes; `pick-millbrook` web.action.succeeded changed=yes; `snap-store-list` web.inspect.succeeded changed=no; `nav-start` web.action.succeeded changed=yes

### bigbox-run6, decision 37

10 entries, 23909 bytes. Draft entry as recorded (`draftShown`): `{"bytes":3909,"budget":4000,"steps":11,"instructionBytes":1052}`.

| # | callId | toolId | bytes |
| --- | --- | --- | --- |
| 0 | `core.evidence_history` | `core.evidence_history` | 1829 |
| 1 | `core.request_check.20` | `core.request_check` | 503 |
| 2 | `core.no_progress.20` | `core.no_progress` | 813 |
| 3 | `dryrun.1.4` | `core.dry_run.page` | 5861 |
| 4 | `core.dry_run.1` | `core.dry_run` | 1708 |
| 5 | `core.completion_check.22` | `core.completion_check` | 1778 |
| 6 | `core.completion_check.26` | `core.completion_check` | 1287 |
| 7 | `open-store-picker-6` | `core.run_node` | 5866 |
| 8 | `core.flow_draft` | `core.flow_draft` | 3973 |
| 9 | `core.budget.37` | `core.budget` | 291 |

- Earlier Core notes present: `core.no_progress.20`, `core.request_check.20`, `core.completion_check.22`, `core.dry_run.1`, `dryrun.1.4`, `core.completion_check.26`
- Earlier Core notes absent, with no trace anywhere in the window: `core.request_check.6`, `core.request_check.7`, `core.no_progress.8`, `core.request_check.8`, `core.no_progress.9`, `core.request_check.9`, `core.request_check.14`, `core.request_check.15`, `core.no_progress.16`, `core.request_check.16`, `core.no_progress.17`, `core.request_check.17`, `core.no_progress.18`, `core.request_check.18`, `core.no_progress.19`, `core.request_check.19`
- `core.evidence_history` lines: `initial.core.run_node` web.inspect.succeeded changed=no; `dismiss-privacy` web.action.rejected.target_unobserved changed=no; `snap2` web.inspect.succeeded changed=no; `dismiss-privacy-2` web.action.succeeded changed=yes; `open-store-picker` web.action.rejected.target_unobserved changed=no; `snap3` web.inspect.succeeded changed=no; `open-store-picker-2` web.action.succeeded changed=yes; `pick-millbrook` web.action.succeeded changed=yes; `snap-store-list` web.inspect.succeeded changed=no; `nav-start` web.action.succeeded changed=yes; `open-store-picker-3` web.action.succeeded changed=yes; `open-store-picker-4` web.action.succeeded changed=yes; `pick-millbrook-2` web.action.succeeded changed=yes; `open-store-picker-5` web.action.succeeded changed=yes

### crossborder, decision 13

8 entries, 19586 bytes. Draft entry as recorded (`draftShown`): `{"bytes":2593,"budget":4000,"steps":6,"instructionBytes":1052}`.

| # | callId | toolId | bytes |
| --- | --- | --- | --- |
| 0 | `core.evidence_history` | `core.evidence_history` | 805 |
| 1 | `detect1` | `web.detect_repeating_structure` | 2071 |
| 2 | `core.request_check.3` | `core.request_check` | 511 |
| 3 | `nav5` | `core.run_node` | 5851 |
| 4 | `extract1` | `core.run_node` | 5855 |
| 5 | `core.completion_check.12` | `core.completion_check` | 1545 |
| 6 | `core.flow_draft` | `core.flow_draft` | 2657 |
| 7 | `core.budget.13` | `core.budget` | 291 |

- Earlier Core notes present: `core.request_check.3`, `core.completion_check.12`
- Earlier Core notes absent, with no trace anywhere in the window: none
- `core.evidence_history` lines: `initial.core.run_node` web.inspect.succeeded changed=no; `nav1` web.action.succeeded changed=yes; `nav2` web.action.succeeded changed=yes; `nav3` web.action.succeeded changed=yes; `nav4` web.action.succeeded changed=yes

### crossborder, decision 14

9 entries, 21131 bytes. Draft entry as recorded (`draftShown`): `{"bytes":2593,"budget":4000,"steps":6,"instructionBytes":1052}`.

| # | callId | toolId | bytes |
| --- | --- | --- | --- |
| 0 | `core.evidence_history` | `core.evidence_history` | 805 |
| 1 | `detect1` | `web.detect_repeating_structure` | 2071 |
| 2 | `core.request_check.3` | `core.request_check` | 511 |
| 3 | `nav5` | `core.run_node` | 5851 |
| 4 | `extract1` | `core.run_node` | 5855 |
| 5 | `core.completion_check.12` | `core.completion_check` | 1545 |
| 6 | `core.completion_check.13` | `core.completion_check` | 1545 |
| 7 | `core.flow_draft` | `core.flow_draft` | 2657 |
| 8 | `core.budget.14` | `core.budget` | 291 |

- Earlier Core notes present: `core.request_check.3`, `core.completion_check.12`, `core.completion_check.13`
- Earlier Core notes absent, with no trace anywhere in the window: none
- `core.evidence_history` lines: `initial.core.run_node` web.inspect.succeeded changed=no; `nav1` web.action.succeeded changed=yes; `nav2` web.action.succeeded changed=yes; `nav3` web.action.succeeded changed=yes; `nav4` web.action.succeeded changed=yes

### everything-store-run4, decision 30

9 entries, 23046 bytes. Draft entry as recorded (`draftShown`): `{"bytes":3432,"budget":4000,"steps":12,"instructionBytes":1052}`.

| # | callId | toolId | bytes |
| --- | --- | --- | --- |
| 0 | `core.evidence_history` | `core.evidence_history` | 2197 |
| 1 | `core.request_check.8` | `core.request_check` | 511 |
| 2 | `core.request_check.12` | `core.request_check` | 496 |
| 3 | `cartview2` | `core.run_node` | 5856 |
| 4 | `cartdetect2` | `web.detect_repeating_structure` | 2075 |
| 5 | `dryrun.1.3` | `core.dry_run.page` | 5861 |
| 6 | `core.dry_run.1` | `core.dry_run` | 2263 |
| 7 | `core.flow_draft` | `core.flow_draft` | 3496 |
| 8 | `core.budget.30` | `core.budget` | 291 |

- Earlier Core notes present: `core.request_check.8`, `core.request_check.12`, `core.dry_run.1`, `dryrun.1.3`
- Earlier Core notes absent, with no trace anywhere in the window: none
- `core.evidence_history` lines: `initial.core.run_node` web.action.rejected.not_at_start_location changed=no; `nav1` web.action.succeeded changed=yes; `dismiss1` web.action.succeeded changed=yes; `search1` web.action.succeeded changed=yes; `submit1` web.action.succeeded changed=yes; `continue1` web.action.succeeded changed=yes; `detect1` web.structure.detected changed=no; `detect2` web.structure.detected changed=no; `snap1` web.inspect.succeeded changed=no; `extract1` web.inspect.succeeded changed=no; `extract2` web.inspect.succeeded changed=no; `cart1` web.action.succeeded changed=yes; `cartextract1` web.inspect.succeeded changed=no; `cartdetect1` web.structure.detected changed=no; `cartextract2` web.inspect.succeeded changed=no; `search2` web.action.succeeded changed=yes; `detect3` web.structure.detected changed=no; `cartview1` web.action.succeeded changed=yes

### everything-store-run4, decision 47

9 entries, 23899 bytes. Draft entry as recorded (`draftShown`): `{"bytes":3953,"budget":4000,"steps":20,"instructionBytes":154,"withoutInput":3}`.

| # | callId | toolId | bytes |
| --- | --- | --- | --- |
| 0 | `core.evidence_history` | `core.evidence_history` | 1449 |
| 1 | `core.request_check.12` | `core.request_check` | 496 |
| 2 | `cartdetect2` | `web.detect_repeating_structure` | 2075 |
| 3 | `dryrun.1.3` | `core.dry_run.page` | 5861 |
| 4 | `core.dry_run.1` | `core.dry_run` | 2263 |
| 5 | `cartextract5` | `core.run_node` | 5859 |
| 6 | `core.completion_check.46` | `core.completion_check` | 1546 |
| 7 | `core.flow_draft` | `core.flow_draft` | 4017 |
| 8 | `core.budget.47` | `core.budget` | 333 |

- Earlier Core notes present: `core.request_check.12`, `core.dry_run.1`, `dryrun.1.3`, `core.completion_check.46`
- Earlier Core notes absent, with no trace anywhere in the window: `core.request_check.8`, `core.completion_check.40`, `core.completion_check.44`
- `core.evidence_history` lines: `search2` web.action.succeeded changed=yes; `detect3` web.structure.detected changed=no; `cartview1` web.action.succeeded changed=yes; `cartview2` web.inspect.succeeded changed=no; `cartextract3` web.inspect.succeeded changed=no; `rerun.23` web.inspect.succeeded changed=no; `addkettle1` web.action.succeeded changed=yes; `rerun.24` web.inspect.succeeded changed=no; `saveforlater1` web.action.succeeded changed=yes; `rerun.26` web.inspect.succeeded changed=no; `cartextract4` web.inspect.succeeded changed=no; plus 15 unlisted

## Fidelity assumptions (every choice the log does not settle)

1. **Tools.** `core.run_node` is the real `automationStudioLlmRunNodeTool`, with its
   `initialObservation` set to a snapshot. `web.detect_repeating_structure` is declared
   `effect: "observe"` with no `repeatPolicy`; the web domain's own declaration was not read.
   With `after_mutation` set, the repeat at crossborder decision 3 would be `already_observed`
   instead of `already_answered`.
2. **Read nodes propose steps (this departs from the brief).** The brief said "inspect/detect
   proposes false". The web domain proposes every node except the snapshot
   (`domain/src/runtime/llm-evidence/node-run/catalog.ts:94`). The logs prove it: run 4's dry
   runs replayed positions 26, 28, 29 and 30, all of them `web.inspect.succeeded` reads, and
   crossborder's replayed position 9 (`extract1`).
   - Read calls: run 4 `extract1`, `extract2`, `cartextract1`-`5`, `rerun.23`, `rerun.24` and
     `rerun.26`; crossborder `extract1`. They answer `effectApplied: true`, `effect: observe`,
     `proposes: true`, with a replay statement.
   - Snapshots (`snap*`, `cartview2`, the initial look) answer `effectApplied: false`,
     `proposes: false`.
   - Detections carry no draft statement.
3. **Refused actions** follow the domain: `{ok:false, code, node}` plus the page,
   `effectApplied: false`, `effect: mutate`, `proposes: true`, and no `ranWith` or `replay`.
   Run 4's refused initial look is shaped the same way; the domain's `notThereYet` may carry no
   page.
4. **Arguments.** Each action's request names a unique handle, `target.<callId>`. Each read's
   names `list.<callId>`. Every snapshot sends the same request.
   - An answered-from-memory decision repeats the latest look in the same attempt epoch
     exactly. That covers run 6 decisions 6-9 and 14-20, crossborder 3, and run 4 decisions 8
     and 12.
   - The driver refuses to script a repeat when no look was made in the epoch.
5. **Page packets** are exactly `pageBytes` (5,800) and detections exactly `detectBytes` (2,000).
   Each packet names its call id and the world counter, so no two answers are ever identical.
   The live pages may have repeated byte for byte, which the no-progress guard would have
   counted.
6. **Digest.** A counter that moves when an action applies, when a dry run resets, and when a
   replayed action step runs.
7. **Amendments.** Content was not logged. Constrained choices:
   - Run 6: 21 drops 12; 23 drops 4 and 11.
   - Crossborder: 8 marks 2 and 5-8 exploratory; 10 marks 9 exploratory; 15 keeps 9.
     Completions 12 and 13 ran no dry run, so nothing was proposed then. That also fits
     `bootstrap.invalid_subflows`.
   - Run 4: 15 marks 11 and 12 exploratory; 20 marks 15 and 17 exploratory; 32, 38 and 42
     rerun 23, 24 and 26 with corrected read arguments.

   Every other amendment is a settings-only edit, `{change: keep|exploratory, settings:
   {unloggedAmendment: <iteration>}}`, of the newest kept step. It applies, refuses nothing and
   writes no evidence entry. Those are run 6 decisions 11, 27-30, 32 and 35; crossborder 11,
   16-18 and 21; and run 4 decisions 21-23 (step 18), 26, 28, 31, 33, 35-37 and 39 (step 20).
   As a result, no window in these replays contains a `core.amendment_check.*` note. The live
   runs may have had refused amendments.
8. **Completion checks.** Shaped like `refused()`, with Core's instruction sentences copied at
   this commit.
   - Run 6, decision 22: limits plus `cannotReach`; I chose a summary of 312 characters against
     the 240 limit, and cannot-reach steps `d4`, `d11`.
   - Run 6, decision 26: `missingActs` naming `a2` (add_to), with steps that changed something
     `d21`, `d22`.
   - Crossborder, decisions 12 and 13: `flow_bootstrap.evidence_completion_plan_invalid` with
     `bootstrap.invalid_subflows`.
   - Crossborder, decision 19: `missingActs` naming `a1`.
   - Run 4, decision 29: the check passed, so the refusal is the dry run's alone. This is a
     choice; the log is silent.
   - Run 4, decisions 40, 44, 46 and 47: the placeholder `recorded.unlogged_completion_refusal`,
     because run 4 logged no checks.
9. **Limits.** `automationStudioFlowBootstrapEvidenceLoopLimits({ maxCallsPerRun: 48 })`
   (48 iterations, 49 tool calls, a 24,000-byte window, a no-progress limit of 8, 16
   amendments). Its budget is used with a fixed `now`, and there is no token or cost budget.
   `unusableDecisions` and `propagateDecisionErrors: true` are set, and no `completionSchema`
   is passed. Run 4's 16th amendment is its last allowed one (decision 42), and its wrap-up
   starts at decision 46. Both match the log.
10. **Endings.**
    - Run 6 and crossborder are stopped by the loop's own signal after their last logged call,
      so they end `llm_evidence_loop.cancelled` at the top of the next iteration.
    - Run 4 ends at decision 48, on an answer the loop cannot read (`invalid_decision`). The
      live run ended there on `llm.execution_grant.uses_spent`.
11. **Core-note catalog.** A note that no window ever carried is caught only when the trace
    implies it. A `core.no_progress.*` note is caught only through a window. Every new note is
    the newest entry of its tool id and is chosen first, so none should be missed. I did not
    check that with a second run, because a wider window changes what the no-progress guard
    counts.

## Not verified

- That the live windows had these byte sizes. Real packets vary in size, handles have
  different lengths, and live amendments may have been refused. Which entries were dropped
  depends on all of these.
- The web domain's real declaration for `web.detect_repeating_structure`.
- No Lab or browser run was made, as the brief required.

## Open questions or contradictions found

1. **Defect in the current code (not fixed; non-test files were out of bounds).**
   - `flow-draft/entry.ts` `stepRow` writes the shown disposition. For a step that did not work,
     that is `"did_not_work"` (`shownDisposition`).
   - `llm/evidence-loop/draft-shown.ts` `isDraftStepRow` accepts only `kept`, `dropped` and
     `exploratory`.
   - So once a draft that holds a refused action outgrows the object form and is packed,
     measuring it throws `Cannot measure malformed or unknown packed draft shape`. The throw
     happens inside the decision's try block, and with `propagateDecisionErrors: true` the
     whole build fails.
   - Run 6 hits this when it builds decision 38's draft. The test
     `bigbox-run6: the draft entry the loop builds after the last logged decision cannot be
     measured` records it and flips when the defect is fixed. The live run 6 exited `code=1`
     right after decision 37 with no `decide start iteration=38` line. That is consistent with
     this defect, but I did not confirm it: the t174 build may not have had packing.
2. **Brief versus domain on read nodes.** See assumption 2.
3. **`llm/decision-context/` has no barrel.** It holds only `tests/` until the other worker
   creates the source files. The structure audit reported no violation for it.
