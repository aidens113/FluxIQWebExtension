# Global question queue

Latest state: Supervisor released only the two fixture typing corrections after full Core suite63749 passed293files/1775tests. Those corrections are applied and frozen. Shared focused run90915 through heavy.sh `codex t224 fixture typing focused` exited0,6files/66tests,10.39s; all global/Problems behavioral and existing architecture/host/view/transport tests pass. Scoped diff check0. `body` now asserts mock-call presence before indexing; absent onListProblems is omitted instead of explicitly undefined. Expectations/typeconfig/product code unchanged. Full observed log `C:/Users/osrs_/AppData/Local/Temp/codex-t224-fixture-typing-focused.log`. Supervisor must rerun broad types/build; worker does not claim TypeScript success from Vitest. Source/test/report frozen again.

Status: Complete and frozen after supervisor stale-handler follow-up; fresh narrow validation passed.

Owns only Core app/GlobalConversationPrompt.tsx and new app/tests/GlobalConversationPrompt.test.tsx plus this report. Problems files remain frozen. No runtime/API edits, shared docs, commits, broad checks or live calls.

Current defect: only the first open conversation is read. An idle/dismissed newest thread masks older pending questions. Dismissal calls poller sync before the dismissed ref updates; unmount/Studio transition does not fence completed reads/answers. A detail read always reads the first100 turns although public detail has hasMore/sinceTurnId.

Public contract evidence: api/handlers/conversations.ts list endpoint accepts limit only, returns conversations without list cursor/offset; global listing stops at its bound across accessible projects. get-conversation accepts sinceTurnId/limit and returns nested conversation/turns/hasMore. Runtime thread.ts confirms forward page shape. No list-pagination contract will be invented. Proposed bounded candidate/detail scan, pending-count prioritization, candidate rotation when a read budget is exhausted, explicit retry/error and read/mutation generation fencing; page bounds remain honest rather than claim no waiting asks after an incomplete scan.

## Incremental implementation and evidence

- Reproduction explicit Git Bash/heavy.sh `codex t224 global question reproduction`: exit1, 6 failed / 2 passed. Newer idle/dismissed conversation, successful answer with stale server copy, later turn page, failed candidate and permission feedback all reproduced defects.
- Candidate bound25, total detail-request bound12 per poll, per-thread page bound3 of100 turns. Prioritize positive pending summaries, rotate between candidates when the budget is exhausted, preserve selected conversation first so the visible question does not jump on each beat. Carry per-thread forward cursor across polls; reset when updatedAt or the public summary revision changes, candidate disappears or detail read fails. A found ask retains the start cursor of its page for fresh status checks. No unlimited turn read or invented summary cursor.
- Read generation and mount/Studio lifetime fencing prevent old reads/mutations publishing. Dismissed/answered ids update their ref synchronously before sync; immediate mutation ref guard prevents duplicate answer submission. Failed answers preserve the waiting question. Filter dismissed turns before selecting the newest pending ask so dismissing a newer ask also exposes older asks in the same page.
- Permission/read failure uses fixed safe notice, retry and Studio review link; failed candidate does not mask a readable later candidate. An incomplete scan/list-at-bound uses explicit bounded-review feedback. Public list pagination is unavailable: questions outside the returned25 summaries cannot be guaranteed discovered by this API; Studio review is the actionable destination. No "no questions" claim is rendered.
- First corrected focused run session1974 observed exit0, 2 files / 32 tests (12 new behavioral +20 existing architecture),11.90s. Added actual301-turn continuation and additional stale-dismiss/same-thread/unmount cases before final run; no source edits during active checks.

## Final verification and freeze

Final explicit `C:/Program Files/Git/bin/bash.exe` invoking `C:/Users/osrs_/FluxStuff/build-slots/heavy.sh`, label `codex t224 global question final focused`, session37650 exit0: 2 files /35 tests passed,9.65s. Command in Core apps/web: `pnpm exec vitest run src/app/tests/GlobalConversationPrompt.test.tsx src/features/automation-studio/conversation/tests/conversation-architecture.test.ts`. New15 behavioral tests and existing20 architecture tests pass; no skips, timeout increases, unhandled errors or expectation weakening. Expected React test renderer deprecation warnings only. Prior session24459 also passed35/35 before final revision-version and visible-cap feedback refinements; final run above validates those refinements.

Actual synthetic continuation checks 300 no-ask turns in three bounded100-turn pages, then asks turn301 on the next poll from turn.long.300. A second regression changes summary revision within an unchanged timestamp and asserts the stale cursor resets. Bounds/rotation test overdelivers30 summary entries from mock, verifies only25 retained and12 maximum detail calls per scan, finds candidate20 on the following scan. Same-page dismissal, duplicate answer guard, obsolete dismissal refresh, late detail after unmount, permission failure/retry and unsuccessful answer retention are exercised.

Scoped diff check exit0. View298 lines, owning test186 lines; no export/baseline growth. Full final output: `C:/Users/osrs_/AppData/Local/Temp/codex-t224-global-question-final-focused.log`.

Own source/test/report frozen. Problems source/test remain untouched throughout this task. No broad tests/typecheck/build, live/browser/accessibility certification, runtime/API changes, commits or other-worktree edits. Supervisor owns independent review, coordinated broader gates and integration. List summary pagination remains an existing API limitation; visible cap/review feedback covers it without claiming complete discovery.

## Supervisor stale-handler follow-up

Supervisor identified that a captured dismiss/answer callback from an old render could act after a different question was published. Added current-state identity guards comparing project, conversation and ask ids, plus answer action ask identity before mutation lock or POST. New regression captures both old callbacks, publishes a new question through polling, invokes both, and asserts no requests/answer POST and no current-question clearing. Problems remains untouched. Earlier35-test pass covers prior revision only; fresh focused validation pending.

Fresh same two-file focused command through heavy.sh label `codex t224 global question stale handler focused`, session42807 exit0: 2files/36tests passed (16behavioral +20architecture),9.23s. Initial output truncated to500tokens (repetitive renderer warnings), final totals observed untruncated. Completion evidence saved `C:/Users/osrs_/AppData/Local/Temp/codex-t224-global-question-stale-handler.log`. Scoped diff check exit0. Final view301lines/test201lines. Own files/report frozen again for supervisor broad gates; no Problems changes or additional source ownership.

## Supervisor broad typecheck follow-up

Root broad web typecheck caught three mock.calls index accesses passed to body(any[]) as possibly undefined (test lines40/62/136). Source freeze remains active during root fullsuite63749. Pending narrow fixture helper fix: assert the guaranteed mock-call presence where fixtures establish it; no typeconfig or runtime assertion weakening. Await explicit release before editing/rechecking. Earlier focused36/36 establishes runtime test behavior, not broad TypeScript success.
