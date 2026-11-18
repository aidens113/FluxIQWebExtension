# Instant actions, round 4 (t893): report

## Outcome

Partial.
- **Item 1.** The pushState cause is found and fixed. The replayed press that followed a radius or sort move no longer waits in the worker. Not every replayed click is under 100 ms: the s5 wait remains, and its cause is not found.
- **Item 2.** Found and fixed. A replayed list read went from 1.9 s to 0.7 s.
- **Item 3.** Blocked. On professional-network, exploration ended `stuck_in_a_loop` with this change, where `dev` succeeded. The cause is Core's act gate, met because the read now finishes sooner. Further Lab runs are blocked: the shared Core is 5 commits behind `dev`.

## Item 1: what dropped the readiness proof, and the fix

**Cause.** local-classifieds' Apply and sort call `restart()`, which runs `history.pushState`, clears the grid and refetches. Chrome reports this as `webNavigation.onHistoryStateUpdated`, and it is the only browser event of that move. A probe extension (`scratchpad/t893-probe`) logged every `tabs`/`webNavigation` event through search → radius → Apply ×2 → sort. The push arrived 15-23 ms after the second Apply, with `onHistoryStateUpdated` 5 ms later.

That event bumped the epoch after the look had noted its proof. The worker then dropped the proof and waited in `waitForTabReady`. In the baseline `run-mwaqjkxp-ae3d862c`, the send→content gap was 103/159 ms before the s9 retry and 83 ms before s11.

**Fix.** The proof now follows the document across a move inside it.
- `epochs.ts` adds `documentOf`, which counts only the events that replace the top document (before-navigate, committed, tab replaced).
- `readyFromSnapshot` checks that count and `documentId`. A changed address moves the proof to the new address.

The wait that such a move still needs now happens in the page, in `content/action-runtime/page-work/address-settle.ts`, at the start of `executeContentAction`. Each content script remembers the address where it last found the page settled. An action that finds the address changed asks the page world the same question the worker asked: `pageSettledInPage`, moved to `shared/scheduled-work-settled.ts`, which now takes an abort signal.
- An idle page answers within a task.
- A page that is redrawing is waited for. This keeps round 2's sorted-list case safe, as the unit test shows.
- Where no page world counts, the address must stand still for the old 1 s.
- The 20 s readiness deadline is unchanged, and a wait that runs out proves nothing.

**After-run** (`run-mwas477e-47e0c0b4`). Send→content gap before the press:

| Step | Before | After (3 attempts) |
| --- | --- | --- |
| s9 retry | 103 / 159 ms | 12 / 18 / 12 ms |
| s11 | 83 ms | 15 / 10 / 12 ms |
| s10 | 17 / 152 ms | 75 / 95 / 8 ms |

The wait moved to the look after the move. It now waits for the real feed redraw: 379 / 108 / 677 ms after the s9 press, and the baseline waited 388 ms there in the worker.

Decision-to-press for replayed clicks:

| Step | After (3 attempts) | Under 100 ms? |
| --- | --- | --- |
| s11 | 28 / 21 / 23 ms | Yes |
| s10 | 92 / 109 / 17 ms | Mostly |
| s9 retry | 301 / 308 / 334 ms | No |
| s5 (chip) | 169 / 273 / 229 ms | No |

- **s9 retry.** Its look before the press waits for the redraw, and about 127 ms passes after the content answers before the look's reply arrives (transfer).
- **s5 (chip).** The baseline had 20 ms, and 297 ms through a before-look. The gap comes before the content script starts. The probe shows no browser event after the results page loads (5 s window). It is not my in-page wait either, because the address does not change there. The cause is **not found**.

To find it, the worker's own readiness time per step has to be recorded. Today that is invisible, and the lines that would record it are in excepted files (`runtime/action-runner.ts` line 153; `node-run/timing/timing.ts` `recordWebCommandSpans`). Proposed change:
- In `action-runner.ts`, time `readyFromSnapshot` + `waitForTabReady` into `result.readiness = { startedAt, finishedAt, proven }`.
- In `timing.ts`, add `if (readiness) automationStudioLlmStepLogSpans.record("ready", readiness.startedAt, readiness.finishedAt, readiness.proven ? "proof" : "waited")`.
- Have `readyFromSnapshot` say which check failed (`document`, `status`, `documentId`, `none`) as the detail.

## Item 2: why select and list reads got slower, and the fix

The spans of `run-mwaqjkxp-ae3d862c` show two causes.
1. **Readiness waits.** In attempt 3, about 190 ms of readiness wait came before select s6 and extract s12, the same proof drop as item 1. Round 3's averages include these.
2. **Fixed windows in the read.** A one-page read pays 900 ms for the list to hold still (`page-render.ts`) and another 900 ms after scrolling the list's end into view (`list-wait.ts`), even when nothing more comes. s12 took 2.3 s of content time and s21 0.96 s.

**Fix.** Both windows now also ask the page world (`page-work/page-quiet.ts`), after two animation frames so the page's scroll and `IntersectionObserver` handlers have run. A reveal that started a load is counted work, and its growth is seen first. When the work is done and the document has held still for a task, the window closes. A page that cannot say keeps the 900 ms: no page world, or a hidden tab. The remaining gap is work the page world does not count, chiefly a list fed over a WebSocket.

## Per-kind table, local-classifieds dining tables

Mean ms: step / overhead / decision-to-press. Before is `run-mwaqjkxp-ae3d862c` and after is `run-mwas477e-47e0c0b4`. Attempts 1-3 were right in both runs. Attempt 4 stopped at the known script limit in both.

| Kind | Explore before | Explore after | Replay before | Replay after |
| --- | --- | --- | --- | --- |
| click | 1018 / 816 / 408 | 1905 / 1487 / 556 | 1311 / 405 / 102 | 1581 / 623 / 111 |
| extract_list | 2057 / 291 / 89 | 1103 / 768 / 169 | **1888 / 251 / 52** | **700 / 517 / 97** |
| select | 562 / 503 / 155 | 1039 / 931 / 260 | 377 / 306 / 48 | 583 / 492 / 112 |
| type | 1217 / 1084 / 123 | 1763 / 1551 / 297 | 959 / 834 / 101 | 1241 / 1075 / 158 |
| navigate | 925 / 389 / 146 | 1429 / 802 / 224 | 1037 / 487 / 82 | 1162 / 564 / 188 |

Content time of the replayed read: 1636 → 183 ms. Explored read: 1766 → 335 ms.

**The after-run machine was about 3× slower.** Domain-only CPU spans that this change does not touch rose: `sanitize` 34 → 108 ms and `compose` 26 → 76 ms on explored clicks. CPU load was 100% from other lanes' runs. Every other column carries that load, so the replay walls (26.8 / 27.2 → 32.5 / 31.7 s) are not comparable. The paths also differ:
- s6 is now a failing absent click.
- The select moved to s8 and takes a look before it, after that failure.

The load-matched `dev` rerun I started was refused (see item 3).

## Item 3: second site

- **company-website-apprentices** (`run-mwasu9u5-b34a4f32`, after): exploration was right. Its script refuses a second attempt, so there is no replay.
- **professional-network-accept-messaged-invitations**, form `notes-back`:
  - **`dev` before** (`run-mwat3vd9-9148d57e`): exploration and replay were right. The replay took 20.4 s. Replayed read: 1241 / 231 / 26.
  - **After** (`run-mwaszqeh-cc316c6d`): exploration ended `waiting_for_person`, `stuck_in_a_loop`.
  - **Why.** The read (3 records, 5 left out, identical in both runs) finished in 177 ms instead of 1964 ms. So the script accepted Ximena (t490) before the timed Priya Nair chat popup opened, rather than after. Its next press was `t617 "Close your conversation with Priya Nair"`, which is the line in the view. Core's act gate refused it as `attempt.act_already_done`, naming "Accept: XR Ximena Ruiz…". It was refused three times, then the loop guard ended the attempt.
  - **Owner.** This is Core's `runtime/answer-first/act-record/gate/act-gate.ts` and the domain's `foresee` identity, outside my paths. A different control was taken for an earlier act.
- A load-matched LC `dev` rerun and a PN after rerun were refused by the Lab: the shared Core `fxwork/!FluxIQ` is 5 commits behind `dev` (`pnpm task sync-core`). I did not sync it, because it is shared by every sibling worktree, and I did not override it.

## What changed

- `runtime/navigation-events/epochs.ts`: adds `documentOf`.
- `runtime/navigation-events/index.ts`, `runtime/navigation-events/page-work.ts`: follow the move of `page-settled`.
- `runtime/automation-tab.ts`: the proof follows its document.
- `shared/scheduled-work-settled.ts`: moved from `runtime/navigation-events/page-settled.ts`, now with an abort signal.
- `content/action-runtime/page-work/` (new): `page-quiet.ts`, `address-settle.ts` and a barrel.
- `content/actions/execute.ts`: settles a moved address before the action's clock starts.
- `content/extraction/list-wait.ts` (`waitUntil` takes a `quiet` promise) and `content/extraction/page-render.ts`.
- Tests:
  - `page-work/tests/page-work.test.ts` (9 tests);
  - `shared/tests/scheduled-work-settled.test.ts` (+2);
  - `epochs.test.ts` (+1);
  - `tab-ready-events.test.ts` (sort test rewritten, +1);
  - `extraction/tests/page-render.test.ts` (+5 growth tests). They are merged there because `extraction/tests/` is at the 25-file limit.
- `docs/architecture/extension-client.md`.
- The excepted file `content/action-runtime/results.ts` was not touched.

## Commands run and observed results

- `node_modules/.bin/tsc -p tsconfig.json --noEmit` (extension): no output.
- `pnpm run check` (extension): exit 0. Run again after the restore: exit 0.
- `pnpm run check` (domain, src and test tsc): exit 0.
- `node scripts/structure-audit.mjs`: `passed (246 warning(s), 552 baselined)`.
- `node scripts/test-extension.mjs src/runtime src/background src/page-world src/shared`: 1067/1067 pass.
- `… src/content src/shared navigation-events/tests tab-ready-events`: 1803/1803 pass.
- After the tree swap and restore, the changed-area tests: 302/302 pass.
- Lab (3 GB launcher):
  - LC after: attempts 1-3 right; 4 at the script limit.
  - company-website after: right, 1 attempt.
  - PN after: exploration `stuck_in_a_loop`.
  - PN `dev`: 2 right.
  - LC `dev` rerun: refused, Core behind.

For the `dev` runs, the 19 changed files were tarred to scratch, `git show HEAD:<file>` was written over the tree, and the files were restored afterwards. The index was not touched, and `git diff --stat` was identical after the restore (13 files, +342 / −160).

## Not verified

- The cause of s5's wait.
- Load-matched before/after walls.
- A second site's replay with this change.
- A child frame's action after a top-document pushState no longer waits. Each frame's content script sees only its own address. Not exercised.
- Firefox.
- A WebSocket-fed list.

## Open questions or contradictions

- Core's act gate refuses a different control (a chat's close) as an act already done. Who owns the fix?
- The shared Core needs `pnpm task sync-core` before more Lab runs.
- The coordinator should decide whether to land item 2 before Core's act-gate defect is fixed: on professional-network it turns a right exploration into a loop ending.
