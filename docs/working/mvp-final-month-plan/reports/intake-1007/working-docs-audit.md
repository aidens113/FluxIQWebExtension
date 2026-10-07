# Report: intake-docs-audit

## Outcome

Done. All 23 documents marked `Active` in the index were audited from their
header and Current State. In plain terms: only three of the 23 are really live
today (`mvp-final-month-plan.md`, `node-catalog-plan.md`, and the read-list
part of `first-class-data-extraction-plan.md`). About fifteen describe work
that is finished, abandoned, or now owned by this plan, but they are still
marked Active. Several still contain instructions that would mislead a new
agent: "no provider call is authorized", "fourteen fix workers in flight",
"Codex tasks not started", "Supervisor merges lane D next". This plan's own
Current State is under the 150-line limit, but it is written in compressed
shorthand that is hard to read and contradicts itself in places. A rewrite
proposal is at the end of this report.

Only read-only work was done. No working document was edited.

## What changed and why

Only this report file was created. Method:

- Read the protocol and the index in full.
- Ran `git log -1` and measured each document's line count, Current State
  span, dated `###` heading count (a ledger proxy) and `### Brief` count.
- Read every Active document's header and Current State. Went deeper only for
  this plan's Worker Briefs (lines 129-183) and the Codex task ledger.

### Per-document audit

"Last commit" means `git log -1` on the file. Recommended status values use the
protocol vocabulary.

| # | Document (lines) | Last commit | Owned/superseded by this plan? | Still live in it | Recommend status / action |
| --- | --- | --- | --- | --- | --- |
| 1 | agent-git-workflow-plan.md (562) | 2026-09-17 | No. This is process tooling, and AGENTS.md "Branches And Worktrees" already carries it | Only the Core-side paired-branch half (an Open Question) | **Complete**, mark complete. Move the leftover to an Open Question. Its Current State also has ~30 lines of pre-design narrative ("Before this work...") that belong below it |
| 2 | agent-token-efficiency-plan.md (516) | 2026-09-10 | No. This is global tooling, now owned by `F:\!AgentBrain` | Phase 4 "measure after two weeks", which is overdue, and two user steps | **Paused** ("Phase 4 waits on metrics; brain is the owner"), or Complete if the user drops Phase 4. Its Current State is stale: it says "Opus 5" and "eight auto-memories". The brain now has more |
| 3 | agent-working-doc-protocol.md (498) | 2026-09-10 | No. This is the standing convention | It is the rulebook. The "Not done" item (compaction on touch) is still being breached, see below | Keep **Active** or move it to docs/architecture (its own Open Question). Fix the stale `F:\!FluxIQ` paired path. Its 3 historical Worker Briefs (cs-*) were for dead workers: archive them |
| 4 | automated-testing-facility-plan.md (523) | 2026-09-28 | Partly. The Lab is substrate for this plan's live gates | 7 open defects: CI red because of unset secrets, e2e in no gate, Phase 7 gate unsatisfiable, existing/clone lanes never run, Core `cancelRuntimeSession` 404 | Keep **Active**, but compact. Current State is ~143 lines, at the 150 cap. Move the "Verified working" and "Corrections" lists to an archive and keep only open defects. The Status detail is a paragraph, not one sentence |
| 5 | bootstrap-no-proposal-investigation.md (278) | 2026-09-20 | Yes. Superseded by later bootstrap and candidate work (t033 era is long merged or obsolete) | Nothing actionable. It names a panel on :3000 that is not running | **Archived**. 15 briefs left for dead workers |
| 6 | codex-tasks-2026-09-30.md (151) | 2026-09-30 | No | Nothing. Says "none started", but commits matching all five tasks are on dev, all 2026-09-30: `d9820ec2` docs/Lab architecture, `efc92b69` Lab results, `9fee5fb2` relays+deep link, `3dc66aee` cleared-check facts, `1310723d` whole-build traces | **Complete**. Mark complete and correct the table. The match is by commit subject only, see Not verified |
| 7 | first-class-data-extraction-plan.md (719) | 2026-10-06 | Live work is owned here by its own statement ("Owner of the live work: mvp-final-month-plan.md") | Read-list S7 (retire old paging) and the live proof of S1-S6. Core-side dataset work | Keep **Active** and compact. Current State is ~131 lines, and ~110 of them are 2026-09-15/09-20 history (X0-X5 narrative, "Core is committed as 0e5c447"). Keep only the 2026-10-07 paragraph plus open items |
| 8 | flow-authoring-and-defensive-runtime-plan.md (618) | 2026-09-24 | Yes. It says itself it is superseded for measurement by language-driven loop, which is in turn superseded by this plan | A "design backlog" of workstreams A-D from 09-24 | **Superseded** -> mvp-final-month-plan / consultant revision. Archive |
| 9 | fluxiq-conversations-plan.md (361) | 2026-09-22 | No, but conversations shipped in other ways (live-activity chat, extension chat) | Unknown. It says four workers t083-t086 were dispatched 09-22, and nothing has been recorded since | **Paused** or Complete after a supervisor check of whether t083-t086 merged. As written, it has 4 briefs for dead workers |
| 10 | general-flow-authoring-plan.md (594) | 2026-10-03 | Partly. t252 is integrated (language-driven plan states this); P5 `$step` is still refused | P5 earlier-output binding; P4 docs; F7 stored-node consequences | **Complete** for t252 (P1-P3). Move P5/F7 into this plan's backlog. Its "Next: supervisor merges lane D" is stale. 9 dead briefs |
| 11 | language-driven-flow-loop-plan.md (663) | 2026-10-03 | Yes. This plan absorbed its live loop and A-D gates ("Live acceptance stays strict") | Binding operating rules (purse, chat start, four slots), which are duplicated in this plan and in memory | **Superseded** -> mvp-final-month-plan. Keep its `debugs/` folder, which this plan links. Its Current State also has a stray line after the closing `---` (protocol breach) |
| 12 | live-activity-chat-plan.md (463) | 2026-09-29 | No | P4 browser proof, "handed to the live lane's next run". Later live rounds ran, so it is probably exercised but not recorded | **Complete**, with the P4 proof noted as an open item, or fold the P4 checklist into the live-run UI review. 7 dead briefs |
| 13 | llm-production-automation-plan.md (1577 ⚠) | 2026-09-10 | Yes. Its scope (instruction-only creation, adaptation) is wholly overtaken by the Week 2, loop and final-month plans | Reusable sanitized context, disabled by default, which nothing plans to finish | **Archived**. It is over 800 lines and was never compacted. Owner is the "root coordination agent", a dead role. Its Current State is followed by a duplicate legacy header block. Do not compact, just archive |
| 14 | manual-panel-test-findings.md (311) | 2026-09-28 | No | Inbox for user findings. PANEL-002/003 retests; it names a :3000 host from 09-20 | Keep **Active** as an inbox, but refresh the Current State: host details are stale. Last updated header (09-20) disagrees with its last commit (09-28) |
| 15 | module-size-governance-plan.md (312) | 2026-09-11 | No | Extension unit-test runner (this may have landed since: the testing-facility audit counts "extension 832" tests); demo-workspace split | **Complete** (Phases 1-2), with leftovers moved to Open Questions. Its Current State starts at line 19, so the header is not directly followed by it |
| 16 | mvp-final-month-plan.md (281) | 2026-10-07 | The owner | Everything | Keep **Active**. Rewrite the Current State (proposal below). Index line count is stale (266 vs 281) |
| 17 | mvp-live-continuation-2026-10-03.md (520) | 2026-10-03 | Yes. Codex's 10-03 continuation, absorbed by this plan's 10-05 start and the Claude stopping point | A8 accepted Flow evidence, B7/C4/D next steps (all later reworked) | **Complete** (or Superseded -> this plan). 33 briefs for dead workers, the worst in the repo. Current State is ~11 KB of compressed prose |
| 18 | mvp-today-plan.md (325) | 2026-09-27 | Yes | Nothing. It says "no provider call is authorized" and "GitHub auth expired": both are false now and both contradict this plan | **Superseded** -> mvp-final-month-plan. The Current State is ~125 lines of run-1..4 history: archive it |
| 19 | mvp-week2-automation-loop-plan.md (703) | 2026-09-20 | Yes. Overtaken by week2-exit, then loop, then final-month | A 10-item open list from 09-17, partly fixed since (call cap, evidence) | **Superseded** -> mvp-final-month-plan. Current State is ~143 lines, at the cap |
| 20 | node-catalog-plan.md (113) | 2026-10-07 | Sequenced by this plan; it owns the node backlog | Ranked backlog rows; 57-vs-67 task discrepancy (now resolved by t312/316/318 per this plan: 67 total) | Keep **Active**. Update the 57/67 paragraph, which contradicts this plan's "exact ten additions/67 total" |
| 21 | repository-state-audit.md (137) | 2026-09-13 | No | Deferred Core risks (failureRoute ignored, unsafe default service storage). Next steps are Week 1 benches | **Complete**. Move the four "broader issues" to Open Questions or the Core audit. Next steps are stale |
| 22 | structural-agent-plan.md (120) | 2026-10-06 | Mostly. Its stages are now the consultant revision's P0-P2, executed as t296-t337 | A1-G30 problem list; script/request feasibility design | **Superseded** -> consultant revision, keeping the problem list as reference. Header has Created 10-07 but Last updated 10-06 (impossible). It says "nothing of this plan is built", which is false after t296-t337 |
| 23 | week2-exit-plan.md (521) | 2026-09-22 | Yes | Says "fourteen fix workers in flight" and "uncommitted work in worktrees t066/t071-t074" | **Superseded** -> mvp-final-month-plan. 23 dated `###` headings, so the ledger likely passes the 20-entry compaction trigger. 18 dead briefs |

Net: 3 stay **Active** and live (16, 20, 7), with 3 and 4 Active as substrate,
and 14 as an inbox. Mark 6 **Complete** (1, 6, 10, 12, 15, 21) and 6
**Superseded** (8, 11, 18, 19, 22, 23), plus 17 Complete or Superseded. Mark 2
**Archived** (5, 13), and 2 Paused or verify (2, 9). The index would go from
23 Active to about 6.

### Protocol breaches found

1. **Over size.** `llm-production-automation-plan.md` is 1577 lines and
   `extension-runtime-capabilities-plan.md` (Complete) is 1165, both
   uncompacted since 2026-09-10. Close to the 150-line Current State cap:
   automated-testing-facility (~143), mvp-week2-automation-loop (~143) and
   first-class-data-extraction (~131), each mostly history.
2. **Current State bloat / history in Current State.**
   first-class-data-extraction, mvp-today, mvp-week2, automated-testing-facility
   and agent-git-workflow all keep dated narrative where only current truth
   belongs.
3. **Unreadable compressed prose.** `mvp-final-month-plan.md` (Current State
   and briefs), `mvp-live-continuation-2026-10-03.md`, and
   `language-driven-flow-loop-plan.md` are the worst. They have glued tokens
   ("Core6c449022/down62ceaac8", "root48", "Chromium2/2", "36/36",
   "provision21840 completed0/READY"), lines up to 1,097 characters, and
   undefined jargon ("pinned readers", "sole accepted CAS promoter",
   "nonrepair capture").
4. **Brief budget.** This plan's three active briefs (t334/t335/t337) total
   9,154 characters on about 30 lines, with lines up to 1,097 characters. That
   is within 40 lines by count but far over the budget in substance, and they
   do not use the protocol brief format (Owns / Must not touch / Definition of
   done).
5. **Briefs left for dead workers.** mvp-live-continuation 33,
   bootstrap-no-proposal 15, week2-exit 18, general-flow-authoring 9,
   live-activity-chat 7, fluxiq-conversations 4, agent-token-efficiency 4,
   agent-working-doc-protocol 4 (cs-*), repository-state-audit 3,
   mvp-week2 4, first-class-data-extraction 2, node-catalog 4. In this plan,
   the t334/t335/t337 briefs name worker labels (`p0_build_identity`,
   `p0_acceptance`, `p0_cancel_control`) reused from earlier P0 units. Whether
   those workers are still live is for the supervisor to confirm against
   intake B.
6. **Header defects.** structural-agent-plan has Created after Last updated.
   manual-panel-test-findings has Last updated (09-20) older than its last
   commit (09-28). automated-testing-facility's Status detail is a paragraph.
   Several Paired document fields point at `F:\!FluxIQ` copies, which AGENTS.md
   says are stale. llm-production has a duplicate legacy header after its
   Current State. language-driven has content after its Current State `---`.
7. **Index stale.** README line counts lag (mvp-final-month 266 vs 281), and 6
   documents are marked Active whose own text says they are superseded
   (flow-authoring, language-driven via mvp-live-continuation) or complete
   (agent-git-workflow).

### Compaction proposal for THIS document's Current State

Problems in the current lines 14-105 (92 lines, 1,378 words, 15 lines over
200 characters):

- **Duplicate framing.** Line 16 says twice that later doc commits "are not
  product completion".
- **Contradictory staleness.** "Planning review completed locally 2026-10-06"
  (45), "Claude's stopping point" (51-57), "Verified by source/history
  inspection" (59-67), "Evidence correction" (69-73) and "Do not repeat landed
  work" (75-78) are all 10-06 planning-time snapshots. Line 66-67 says "The
  planning audit performed no product checks", and line 103 says "no paid run
  has started". Both read as current but describe 10-06.
- **The table carries receipt minutiae** (test counts, commit pairs per row)
  that belong in the ledger or archive. Unit status and what is missing is
  what a reader needs.
- **The t332 discovery paragraph (41)** is a reference finding, not current
  state.
- **The Schedule (106-127)** dates P0 to Oct 6-9 and P5 to Oct 10-16. Those are
  passed or slipping with no note, but it is outside Current State.

Proposed replacement, target under 60 lines, plain sentences, no glued tokens:

1. **Where we are (5 lines).** Deadline Nov 10, freeze Oct 29. Latest pushed
   product heads (one pair). One sentence: no A-D lane has passed. The default
   product path status is whatever intake A concludes (e.g. "successful builds
   produce draft-only Flows; nothing promotes them yet"). No P0 closure,
   promotion or qualification is claimed.
2. **Integrated units (table, 4 columns: unit range / what it gives /
   default-on or opt-in / what is still missing).** Collapse the 18 rows into
   about 8 groups: fences, identity, cancel, candidate/receipts, graph
   import/snapshot, journal/admission/consumed-outcome, original-ID/routing
   guards, typed browser nodes, fixtures/67 tasks, requests-OFF/user-scripts.
   Move all test counts and commit hashes to the archive file already linked.
3. **In flight (one line per unit):** t334, t335, t337, each with worktree,
   state (authored/released/held) and next gate. Point at intake B for
   detail.
4. **Required before promotion (numbered list of 6-8 links in plain
   English).** For example: native execution produces a real consumed effect;
   requirement interpretation; declared browser start; private oracle;
   closed writer host; original-ID adoption; single promoter. Each link marked
   exists/partial/absent (from intake B). This replaces the dense paragraph at
   line 39.
5. **Next order (5 lines).** Keep line 80-83 content, and add a decision point:
   is the infrastructure chain MVP-blocking, or should it be deferred to the
   hardening window (per intakes A/B)?
6. **Binding rules (keep, 8 lines).** Live acceptance strictness, user
   decisions on recording/JS/requests/full suites/panel. These are already
   short. Keep them.
7. **Pointers (3 lines).** Consultant revision, archive, ranked backlog,
   audit reports, intake-1007 reports.

Move to a new archive file `archive/2026-10-07-planning-snapshot.md`: lines
41 (t332 discovery), 45-78 (planning review, stopping point, source
inspection, evidence correction, do-not-repeat list) and 99-104 (audit report
note). Also mark the Schedule rows with actual vs planned dates, or replace
them with "re-baseline after intake". Rewrite the header Status detail as one
plain sentence.

## Commands run and observed results

- `cat agent-working-doc-protocol.md README.md; wc -l *.md`: protocol read.
  The index lists 23 Active, 1 Paused and 7 Complete documents, 14,092 lines
  total.
- Per-document loop `git log -1 --format='%ad %h %s' --date=short`, plus line
  counts, Current State span, dated `###` count and brief count: the values
  are in the table above. For example, mvp-final-month-plan has 281 lines,
  Current State at 14-106, 17 dated `###` headings and 6 briefs.
- `awk` extraction of each header plus Current State into scratch files
  `intakeC-cs*.txt`, which were read in full.
- `awk` on mvp-final-month-plan lines 14-105: 1,378 words, 11,720 characters,
  15 lines over 200 characters, max line 1,065. Briefs at lines 154-183:
  9,154 characters, max line 1,097.
- `git merge-base --is-ancestor <c> dev` for the five Codex-task commits: all
  `on-dev`, all dated 2026-09-30.
- `ls ../fxwork`: about 120 task worktrees are still present (t174-t337 plus
  named ones such as qualification-final). This is relevant to "briefs for
  dead workers" and to `pnpm task prune`.

## Not verified

- That the five 2026-09-30 commits are the Codex tasks. The match is by
  subject only. The Codex document has no ledger entry for them.
- Whether fluxiq-conversations t083-t086, live-activity P4, and the
  module-size "extension has no unit runner" item were completed later. I
  did not search the code.
- Dated `###` counts are a ledger proxy. week2-exit-plan's 23 may include
  non-ledger headings.
- Current State line spans include the trailing `---`, so they are
  approximate (plus or minus 2).
- Paused and Complete documents were not audited beyond the index, per the
  brief.
- Whether the t334/t335/t337 worker labels refer to live or dead agents.

## Open questions or contradictions found

- node-catalog-plan says the 67 scope has "10 unaccounted tasks". This plan
  says t312/t316/t318 delivered "exact ten additions/67 total". One of them is
  stale.
- mvp-today-plan says "no provider call is authorized" and "GitHub auth
  expired". language-driven and this plan record later paid runs and pushes.
  An agent reading the index alone could act on the stale ban.
- structural-agent-plan says "nothing of this plan is built". This plan's
  table lists integrated acceptance fences (t296), candidate draft (t299) and
  related units that are that plan's stages.
- This plan's Current State says t334 is "authored", and its brief says
  "READY ... source release". It also says t337 is "HOLD" while the brief
  title says "READY". The supervisor should settle each unit's single state.
- About 120 fxwork worktrees are still present, many for long-merged units. A
  `pnpm task prune --dry-run` pass may be warranted. This is outside this
  brief.
