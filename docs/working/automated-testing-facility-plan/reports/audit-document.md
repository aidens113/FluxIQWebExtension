# Report: audit-document

Audit of `docs/working/automated-testing-facility-plan.md` (1842 lines) as a
document, against `docs/working/agent-working-doc-protocol.md`. Read-only on
source; the only file written is this report.

## Outcome

Done. All six questions answered below. No source file was modified.

## What changed and why

Nothing in the repository. This is a document audit.

## Commands run and observed results

- `wc -l docs/working/automated-testing-facility-plan.md` -> `1842`
- `grep -n "^#\{1,4\} "` -> 63 headings. No `## Work Ledger`, no
  `## Open Questions`, no `## Worker Briefs` anywhere in the file.
- `git log -5 --date=short -- docs/working/automated-testing-facility-plan.md`
  -> `47293274 2026-09-10 Complete working-document rollout phases 2 and 3`;
  before that `22abc03e 2026-09-06`, `5876e003 2026-09-05`,
  `dd963f79 2026-09-05`, `5e9d97e7 2026-09-04`. **The document has not been
  touched in 18 days**, while the repository worked through 2026-09-27.
- `ls packages` -> `agent-orchestrator boundary-audit real-site-policy
  test-contracts test-evidence test-matrix test-runner` (7 packages; the
  document's proposed layout at 817-874 names 2).
- `ls apps` -> `extension scenario-lab` (both exist).
- `ls packages/test-runner/src` -> `auth-cli.ts`, `clone-cache.ts`,
  `clone-source-exporter.ts`, `cli.ts`, `coordinator.ts`, `allocation.ts`
  present, plus ~25 `demo-llm-*` modules the document never mentions.
- root `package.json` scripts -> `demo:record`, `demo:run`,
  `demo:setup-local` still exist; `lab` is now
  `node scripts/lab/run-lab.mjs`, and `check` is now
  `pnpm structure:test && pnpm lab:test && pnpm task:test && node
  scripts/structure-audit.mjs && pnpm -r check` — a different command from
  the `pnpm check` every validation claim in this document refers to.
- `grep -n "automated-testing-facility" docs/working/README.md` -> line 22,
  listed under `## Active` with size `1842 ⚠`.
- `grep -n -o -E "(https?|wss?)://..."` -> 6 URLs total, all loopback or
  playwright.dev/pptr.dev documentation.

---

## 1. Protocol conformance

### What conforms

- **Header block (lines 3-10).** All eight required fields are present, in the
  protocol's order, one physical line each, with no blank line between them:
  `Status` (3), `Status detail` (4), `Created` (5), `Last updated` (6),
  `Owner` (7), `Scope` (8), `Paired document` (9), `Related` (10).
- **`Status` value (line 3)** is `Active`, a controlled value.
- **`## Current State` (line 14)** exists, sits directly after the header's
  `---`, and runs to line 146 = **133 lines, under the 150-line cap**. It is
  written as rewrite-in-place prose with Done / Not done / Next steps /
  Blockers / Where to look, which is the shape the protocol asks for.

### Deviations that are *predates-the-protocol* history

The document was created 2026-09-04 and finished its substantive work
2026-09-06. The protocol was authored 2026-09-10 and this document was
retrofitted the same day by worker `cs-testing-facility`, under a brief that
said in terms: *"Do not reorder, delete, compact, or reword any existing
content; do not touch the ledger or open questions."* Everything below is a
direct consequence of that deliberate limit and should not be charged to the
document as a defect:

| # | Line(s) | Deviation |
| --- | --- | --- |
| P1 | (absent) | No `## Work Ledger` section anywhere. `## Execution Log` (162) is the pre-protocol equivalent. |
| P2 | 164-178, 180-662 | Ledger content is a 12-row status table plus ~20 free-prose paragraphs. None uses the required `### YYYY-MM-DD — <title>` heading with `Agent` / `Changed` / `Why` / `Validation` / `Outcome` / `Follow-up` bullets, and none is under 15 lines (the Phase 10 block at 180-252 alone is 73). |
| P3 | (absent) | No `## Open Questions` section, though the document carries at least five live unresolved decisions (real-site policy, Core promotion second consumer, CI runner, external-install certification, persistent-workspace reset command). |
| P4 | (absent) | No `## Worker Briefs` section, though the document names ~15 workers (`phase0_contracts`, `phase1_scenarios`, `phase2_extension_fixture`, `phase3_topology`, `phase4_evidence`, `clone_contracts`, `clone_source`, `clone_destination`, `post_crash_hardening`, `phase12_target_cli`, `phase12_allocation_lock`, `phase12_manifest_docs`, `core_invariants`, `core_ui_scope`, `core_failure_audit`, `facility_router_subflow`) and records their individual results. No brief is recoverable. |
| P5 | 149-1523 | Section order is inverted. History (`## Status` 149, `## Execution Log` 162, `## Implementation Validation` 664) precedes the reference sections (`## Goals` 707 through `## Metrics` 1267), and more history is appended *after* the plan (`### Top-level graph compatibility escape audit` 1524, `## Final Implementation And Live Validation` 1686). The protocol wants Current State, then reference, then ledger, then open questions. |
| P6 | 420-482 | `### Phase 12: persistent isolated topology` — a phase *specification* — is filed under `## Execution Log`, not under `## Implementation Phases` (1268) where Phases 0-10 live. |
| P7 | (absent) | Phase 11 has no specification section at all. It is "implemented and live validated" in the table (177) and described at length in execution notes (254-419), but was never written down as a plan. |
| P8 | 166-178 | Per-phase status vocabulary is uncontrolled: eight distinct phrasings across twelve rows — `validated`, `implemented and locally validated`, `validated primitives; dispatch remains human-triggered`, `validated defer`, `safeguards validated; execution deferred`, `implemented and locally validated; live external certification pending`, `implemented and live validated in persistent isolation`, `implemented and live validated`. Nothing can be triaged mechanically, which is the exact problem the protocol's `Why This Exists` (its lines 76-80) was written to fix. |

### Deviations that are *real defects now*

These are either true regardless of when the protocol landed, or were
introduced/left by the 2026-09-10 retrofit itself:

| # | Line(s) | Defect |
| --- | --- | --- |
| **D1** | whole file | **1842 lines, uncompacted, 18 days after the compaction-on-touch rule.** The protocol's `Compaction` rule says the next agent to touch an over-800-line document compacts *before doing anything else*. The 2026-09-10 retrofit touched it and **added 146 lines instead**, taking it from 1696 to 1842. The index (README line 22) marks it `1842 ⚠`. This is the single clearest defect. |
| **D2** | 149-160 | **`## Status` is a second, rival source of truth.** Twelve lines of 2026-09-04 status prose that `## Current State` (14-146) now supersedes almost sentence for sentence — compare 149-160's *"live certification of the `existing` lane remains pending"* with 85-89. The protocol's tie-break rule covers `Current State` vs *a ledger entry*; it does not cover a competing `## Status` section, so an agent reading top-down hits stale truth twelve lines after authoritative truth. Delete outright. |
| **D3** | 9 | **`Paired document: none` is wrong.** The document records substantial FluxIQ Core work that it drove and owns the narrative for: Core Flow representation metadata, the PIN-authorized legacy migration endpoint, edge-upsert `flow_id` re-homing, Core deriving route-decision/Subflow-entry/action-attempt counts, Subflow navigation hydration (67-75, 1640-1648, 1691-1700, 1755-1758, 1767-1779), plus the Runtime Debug connector fix (356-358). The protocol's `Cross-repository pairing` requires one document in each repository naming the other, and one full ledger entry in the owning document with a one-line entry in the pair. Neither exists. |
| **D4** | 10 | **`Related:` links nothing.** It is prose that states *"no FluxIQ working documents are linked from this document"* — which is a description of the defect, not a field value. The successor documents that now own the Lab (`lab-port-allocation-plan.md`, `language-driven-flow-loop-plan.md`, `flow-authoring-and-defensive-runtime-plan.md`, `mvp-week1-web-automation-reliability-plan.md`) are all unlinked, so nothing tells a reader this document was overtaken. |
| **D5** | 7 | **`Owner` names a retired workflow mode.** *"Primary agent under the `Execute Plan With Subagents` workflow, with rotated phase subagents"*. `AGENTS.md` now calls the mode `Execute Plan With Workers`, and the roles `senior supervisor agent` and `worker`; `primary agent` and `subagent` are no longer repository vocabulary. The protocol asks for `<role, agent, or area>`; this is a 30-word sentence carrying 6 stale labels. |
| **D6** | 8 | `Scope` is one physical line but ~6 rendered lines of prose against the protocol's `<one or two lines>`. Minor, but it is what makes the README index row (line 22) unreadable. |
| **D7** | 1136 vs 77-78 | Reference section contradicts `Current State` on evidence policy (see §5). A reference section left uncorrected is worse than a stale ledger entry, because the protocol's tie-break rule does not reach it. |
| **D8** | 900 vs 422 | `## Runner Topology` still says *"The runner must expose two explicit, mutually exclusive target modes"* when four shipped (see §5). |
| **D9** | 504, 582-583, 1526 | Three "in progress / remains in progress" sentences that later text resolves but never retracts (see §5). A reader who greps for open work finds three false positives. |
| **D10** | 419-420 | No blank line between the end of the Phase 11 paragraph and the `### Phase 12` heading. Cosmetic, but it is why the heading reads as part of the preceding prose. |

---

## 2. Compaction proposal

**Current: 1842 lines. Target: 440-480 lines.** Comfortably under the 800
threshold, with room for the ledger to grow.

Archive destination, per the protocol's `Compaction` step 2:
`docs/working/automated-testing-facility-plan/archive/2026-09-28-<topic>.md`,
three files. Each removal point gets a one-line pointer (step 3), and the
compaction itself gets a ledger entry (step 4).

### Section-by-section disposition

| Lines | Section | Now | Action | After |
| --- | --- | --- | --- | --- |
| 1-12 | Header | 12 | Keep; fix `Status`, `Owner`, `Paired document`, `Related`, `Last updated` | 12 |
| 14-146 | `## Current State` | 133 | **Rewrite in place.** Once the status is `Complete` (§3) most of `Done` collapses into the Execution Log table; keep `Not done`, `Blockers`, `Where to look` | ~60 |
| 149-160 | `## Status` | 12 | **Delete.** Wholly superseded by Current State (D2) | 0 |
| 162-178 | Execution Log table | 17 | Keep. Normalise the Status column onto a controlled set (`validated` / `deferred` / `certification pending`) | 17 |
| 180-419 | Execution Log prose (Phase 10 & 11 notes, repeat live validations, demo isolation correction, layout regression, Subflow completion) | 240 | **Archive** → `…-phase-10-11-execution-notes.md`. Summarise as 3 protocol ledger entries | ~40 |
| 420-482 | Phase 12 specification | 63 | **Move** into `## Implementation Phases` after Phase 10; compress the 8 steps to 4 | ~25 |
| 484-524 | Phase 12 execution updates | 41 | **Archive** → same file. One ledger entry keeping the `Credential recheck required` blocker and its resolution | ~12 |
| 526-662 | Phase 9 step notes (Steps 2-15) | 137 | **Archive** → `…-phase-9-step-notes.md`. One ledger entry | ~12 |
| 664-687 | `## Implementation Validation (2026-09-04)` | 24 | Keep the gate table **verbatim** — it is the only place a command and its observed result are paired, which is exactly what the protocol's `Validation` line demands. Reformat as a ledger entry | ~22 |
| 689-706 | `## Executive Decision` | 18 | Keep; trim the Playwright-vs-Puppeteer paragraph | ~12 |
| 707-730 | `## Goals` / `## Non-goals` | 24 | Keep as is | 24 |
| 731-764 | `## Audit Findings` | 34 | **Archive** → `…-2026-09-04-repository-audit.md`. This is a snapshot of the repository *before* the facility existed (*"The extension test only verifies that five files exist"*, line 745) and is certainly false now | 2 (pointer) |
| 765-816 | `## Architectural Boundary` | 52 | Keep the placement test (769), the dependency-direction diagram (794-802), the `Core must never import this repository` rule (804) and the promotion checklist (806-815). **Archive the 20-row ownership table** (773-791) — `AGENTS.md`'s `Automated Testing Facility Boundary` now carries the operative version | ~26 |
| 817-874 | `## Proposed Repository Layout` | 58 | **Archive.** Superseded by reality: it names 2 packages, there are 7 (`agent-orchestrator`, `boundary-audit`, `real-site-policy`, `test-contracts`, `test-evidence`, `test-matrix`, `test-runner`). Replace with a pointer to `docs/architecture/repository-layout.md` | 3 |
| 875-1009 | `## Runner Topology`, target modes, CLI contract, Flow execution, cookie session | 134 | Keep the topology tree (877-894) and the parallel-run invariant (896). Compress the four target-mode and cookie-cache subsections, which now restate shipped behaviour at specification length. **Fix line 900's "two … target modes"** | ~45 |
| 1010-1023 | `## Browser Strategy` | 14 | Keep | 14 |
| 1025-1076 | `## Scenario Contract` | 52 | Replace the `WebScenario` TypeScript literal (1029-1058) with a pointer to `packages/test-contracts/src/scenario.ts`, which is now the authority. Keep the 10-scenario corpus list (1062-1075) **verbatim** | ~20 |
| 1077-1114 | `## Test Layers` | 38 | Keep, compress Layer 1-3 bullets | ~22 |
| 1115-1177 | `## Evidence And Human Review` | 63 | **Rewrite, do not just trim.** Contains the contradicted deduplication/0.5-1 FPS sampler policy (1136) and optional-WebM policy (1123). Keep the run-bundle tree (1140-1162), the `run.json` contents rule (1164), the never-retain list (1166) and the retention defaults (1170-1174) | ~32 |
| 1178-1188 | `## Test-control Seams` | 11 | Keep verbatim — it is the rule that stops test hooks shipping | 11 |
| 1189-1237 | `## Agent And Subagent Workflow` | 49 | Compress hard. Roles/dispatch/loop (1201-1225) are superseded by `AGENTS.md`, the working-doc protocol and `packages/agent-orchestrator`. Keep the CLI surface (1193-1199) and the promotion gates (1227-1236) | ~18 |
| 1238-1261 | `## Failure Taxonomy` | 24 | **Preserve verbatim. Must not be compacted.** This is a live vocabulary — `AGENTS.md` quotes `performance.budget` by name when explaining the one-live-run rule — and the 17 category strings are load-bearing identifiers | 24 |
| 1262-1267 | `## Metrics` | 6 | Keep verbatim | 6 |
| 1268-1523 | `## Implementation Phases` 0-10 | 256 | **Archive the step lists** → `…-phase-0-10-specifications.md`. Every phase is delivered; the durable part is each phase's *Acceptance* block, which is the contract the facility must keep meeting. Keep Acceptance only, one block per phase | ~55 |
| 1524-1685 | `### Top-level graph compatibility escape audit` | 162 | **Compress to ~35, archive the rest.** See "must be preserved" below | ~35 |
| 1686-1789 | `## Final Implementation And Live Validation (2026-09-05)` | 104 | **Archive** → the phase-10-11 notes file. Convert to two ledger entries: the ownership fix + its live results (1711-1736), and the three follow-up regressions (1738-1788) | ~26 |
| 1790-1811 | `## Initial CI Shape` | 22 | Keep, compress the prose | ~16 |
| 1812-1829 | `## Key Risks` | 18 | **Keep verbatim.** Every row is a still-live mitigation, several of which are the only written record of why a safeguard exists | 18 |
| 1830-1837 | `## Recommended Defaults To Confirm In Phase 0` | 8 | Fold into Current State or Open Questions; Phase 0 closed long ago | ~4 |
| 1838-1842 | `## Documentation Sources` | 5 | Keep | 5 |
| — | **new** `## Open Questions` | 0 | Add. Five entries, each with an owner (see §3) | ~20 |

**Rough total: ~468 lines**, plus three archive files totalling ~950 lines.

### What MUST be preserved, and why

1. **`## Failure Taxonomy` (1238-1261), verbatim.** The 17 category strings are
   referenced by name outside this document — `AGENTS.md` cites
   `performance.budget` in the one-live-run-at-a-time rule. Renaming or
   dropping one silently breaks that reference.
2. **`## Key Risks` (1812-1829), verbatim.** Rows like *"Existing installation
   is damaged by the runner"* and *"Test hooks ship"* are the only written
   justification for safeguards that are still in the code. Compacting a
   mitigation deletes the reason someone later restores the hole.
3. **The Core invariant produced by the escape audit (1562-1606, 1635-1648,
   1691-1700).** This is a **cross-repository contract still in force**:
   modern top-level Flows reject public graph writes; runtime must enter
   through the parent Router and the selected Subflow; legacy single-graph
   Flows survive only through an explicit marker or the PIN-authorized
   migration endpoint. Any future agent that writes a graph to a top-level
   Flow ID will be rejected by Core and will not know why unless this
   survives. It is also the strongest argument for `Paired document` (D3) —
   Core should own this text and this document should link it.
4. **The `## Implementation Validation` gate table (668-680).** It is the only
   place in 1842 lines where a command is paired with its observed result, in
   the form the protocol's `Validation` rule demands.
5. **The 10-scenario corpus list (1062-1075).** Named fixtures the Lab still
   runs.
6. **`## Test-control Seams` (1178-1188)** and the never-retain list (1166).
   Both are security invariants stated nowhere else in this document.
7. **The persistent-workspace ownership rules (449-453, 462-466).** They are
   why `pnpm task prune` and the `test-runs/` policy behave as they do, and
   the "no automatic reset/delete command" decision (464-466) is still true.

### What is safe to reduce to a few lines

- The entire 2026-09-04 repository audit (731-764) — a description of a state
  that no longer exists.
- The proposed repository layout (817-874) — contradicted by `ls packages`.
- All Phase 9 step-by-step notes (526-662) and all Phase 10/11 execution notes
  (180-419) — 377 lines whose only surviving value is "it shipped and here is
  the run that proved it", which is four ledger entries.
- The remediation plan at 1633-1670 — all eight items are done (1691-1709).
- The Phase 0-10 step lists (1270-1523 minus the Acceptance blocks).

---

## 3. `Active` vs `Complete`

**Recommendation: change `Status` to `Complete`,** with `Status detail`
rewritten to name the three certifications that were never run and where they
now live.

### Why `Complete`

1. **The protocol's own definitions decide it.** `Active` = *"Work is in
   progress or queued."* `Complete` = *"Delivered and validated. Retained for
   reference."* Nothing in this document is in progress or queued. All twelve
   Execution Log rows (166-178) read `validated`, `implemented and locally
   validated`, or `implemented and live validated`. Zero rows are open.
2. **The four remaining items are not work this document is executing.** Read
   against the ledger:
   - `existing` and `clone` live certification (85-92) — gated on external
     installation credentials, project and Flow *that were never supplied to
     any run*. The document itself classes this at 88-89 as *"a certification
     gap, not an unimplemented runner path"*, and repeats it at 638-640.
   - Linux Chromium + the scheduled three-repeat baseline (93-94) — gated on a
     CI Linux runner that does not exist; 682-683 records the Xvfb
     configuration as complete but *"not executable on this Windows host"*.
   - Phase 8 real-site execution (95-96) and Phase 7 Core promotion (97) —
     **deliberate policy deferrals**, with a recorded `defer` verdict (679)
     and an explicit gate (*"no reviewed target policy was supplied"*, 680).
   A document whose only open items are (a) inputs nobody intends to supply and
   (b) decisions already taken to defer is not active work. It is a delivered
   thing with known, deliberate limits.
3. **The evidence of inactivity is in git.** Last commit touching the file:
   `47293274`, 2026-09-10 — and that commit was the protocol retrofit, not
   facility work. The last substantive commit is `22abc03e`, 2026-09-06. The
   repository has run heavy work through 2026-09-27 under *other* documents
   (`language-driven-flow-loop-plan.md`, `mvp-today-plan.md`,
   `lab-port-allocation-plan.md`, `flow-authoring-and-defensive-runtime-plan.md`),
   several of which own the Lab this document built. The facility is now
   infrastructure that other efforts consume, which is precisely `Complete`'s
   *"retained for reference"*.
4. **`Active` has a measurable context cost.** README line 22 puts it in the
   `## Active` table with `1842 ⚠`. `/resume` reads the Active rows. Every task
   start in this repository therefore pays for the largest document in
   `docs/working/`, for an effort nobody is executing. Moving it to `Complete`
   is the cheapest single context saving available in the index.

### Alternative considered and rejected

`Paused` — *"Deliberately stopped; may resume."* This fits the real-site and
Core-promotion deferrals, but not the document as a whole: the deliverable
shipped and is in daily use (`packages/test-runner`, `apps/scenario-lab`,
`pnpm demo:record` / `demo:run`, the 10-scenario corpus). `Paused` would
wrongly imply the facility is not available.

### Where the remaining items should go

Move them out of `Current State`'s `Not done` into a new `## Open Questions`,
each with an owner, per the protocol:

| Item | Lines today | Proposed home |
| --- | --- | --- |
| `existing` lane live certification | 85-89, 114-118 | Open Question here, owner: user. It certifies what this document built, so it stays here; it is blocked on an input, not on work. |
| `clone` lane live certification | 90-91 | Same. |
| Linux Chromium lane + 3-repeat baseline in CI | 92-94, 119 | Open Question here, owner: senior supervisor agent. Gated on CI existing at all. |
| Phase 9 Step 5 additive Core improvements (session endpoint, registered cancellation, command correlation, capability discovery) | 99-104, 120-121 | **Re-home to FluxIQ Core's own working document.** Core owns these APIs; this document should link, not track. Doing so also fixes `Paired document` (D3). |
| Phase 8 real-site execution | 95-96, 122-123 | Re-home to whichever document now owns the real-site lane, then link. `flow-authoring-and-defensive-runtime-plan.md` states it does *not* cover the real-site lane, so the supervisor should confirm the owner before moving. |
| Phase 7 Core promotion | 97, 123 | Open Question here, owner: senior supervisor agent, gated on a second consumer. |
| No reset/delete command for a persistent workspace | 106-107 | Open Question here, owner: senior supervisor agent. Decision recorded at 464-466. |
| Core web-package pre-existing TS errors | 108-110 | Drop from this document — explicitly unrelated (1733-1736). Belongs to Core. |

---

## 4. Checkable claims, for cross-checking

`Last updated: 2026-09-10`; last substantive edit 2026-09-06. Everything below
is a claim someone can verify. **Staleness likelihood is my judgement, not a
verification** — I did not run any of these checks.

### 4a. Dates (all 2026-09-04 / -05 / -06; none later)

Lines with a date token: 5, 6, 16 (×2), 21, 55, 67, 130, 133, 134, 141, 142,
145, 151, 180, 195, 213, 225, 238, 254, 275, 297, 324, 339, 369, 384, 484,
507, 526, 563, 576, 632, 664, 1482, 1515, 1524, 1528, 1539, 1608, 1686, 1738,
1749, 1767.

**Highest-risk:** line 6 (`Last updated: 2026-09-10`) is now wrong in spirit —
the content is 2026-09-06 and the repository is at 2026-09-27. Lines 16 and
141-145 (`Where to look` pointing at "the most recent dated checkpoint") point
a reader at 2026-09-06 as current.

### 4b. Run ids — evidence bundles that may no longer exist on disk

| Line(s) | Id | Kind |
| --- | --- | --- |
| 28, 169, 676 | `run-mtnla9cz-a4da1119` | isolated full-topology run |
| 47, 635 | `run-mtnpc74q-89d850a9` | isolated regression |
| 52, 248 | `run-mtnrj7ws-717a780f` | isolated regression |
| 496 | `run-mtnvh2gt-787ce5f4` | Phase 12 first live run |
| 65, 516, 517 | `run-mtnvptuo-800f61c7`, `run-mtnvqwj5-169346f1` | Phase 12 sequential pair |
| 678 | `run-mtnlid1v-def3d560`, `run-mtnlixjt-05233872`, `run-mtnljjuj-097e55ff` | three-repeat baseline |

**Very likely stale:** `test-runs/` is an ignored, disposable directory and
`pnpm task prune` removes stale build/run state. None of these bundles is
likely to be re-inspectable. Claims *about* them (artifact counts: 15 at 676,
10 at 636/248, 15 at 518) are unverifiable now.

### 4c. Runtime run ids and durable Core identifiers

| Line(s) | Id | Claim |
| --- | --- | --- |
| 58, 407 | recording `client.extension-bbe5ab04-…1788718034927` | final Phase 11 recording |
| 59, 410 | run `8db01689-…` | passed, 37 pairs / 74 screenshots |
| 60, 418 | run `e23d811e-…` | second independent run, 37 pairs / 74 screenshots |
| 74, 1782 | run `3e996492-…` | post-fix `demo:run`, 6 actions / 1 Router decision / 1 Subflow entry |
| 281 | project `34cc76c0-…` | reused demo project |
| 282 | Flow `flow.web-extension-demo` | reused demo Flow |
| 283 | recording `client.extension-5bdf49b4-…1788581072665` | first live recording |
| 315 | run `6b7dc744-…` | playback without LLM |
| 329, 330 | runs `9b996b58-…`, `69ad3100-…` | repeat cycle pair |
| 360 | run `e59ae7c8-…` | post-isolation-correction playback |
| 382 | run `bc44c1a3-…` | post-layout-fix playback |
| 1555 | project `08672748-…` | the *malformed* persistent project |
| 1556 | Flow `flow.b48b9824-…` | the malformed parent Flow, 6 graph_nodes / 0 subflows / 0 routers |
| 1714 | recording `client.extension-1737c03f-…1788661907053` | |
| 1716 | run `f977b001-…` | |
| 1745 | recording `client.extension-12020cdc-…1788663676267` | |
| 1747 | run `b314c621-…` | |
| 1764 | run `8e92eae8-…` | clean-workspace run |

**Very likely stale:** all of these live in
`test-runs/web-extension-demo/fluxiq-root/.fluxiq` (1718-1719) or
`test-runs/web-extension-demo-clean` (1760), both ignored and disposable.
Line 1555-1556 in particular describes a Flow the document itself says *"must
be treated as invalid test data"* (1603) and then migrated (1621-1631) — so
the row counts quoted at 1556-1558 were already historically false by 1720.

### 4d. Test counts — the largest and most checkable stale surface

| Line | Claim |
| --- | --- |
| 32 | local three-repeat baseline `3/3` |
| 34 | Phase 6 primitives `16/16` |
| 39 | Phase 8 safeguards `7/7` |
| 80 | **test-runner `116/116`** (the headline count) |
| 81 | **Core `542/542` tests across 88 files** |
| 82 | Core Automation Studio service `89/89` |
| 167-174 | per-phase: `16` direct, `8/8`, `13/13`, `8/8`, `16/16` + `10/10` + `5/5`, `16/16`, `6/6`, `7/7` |
| 191, 234, 245, 1506 | test-runner `89/89` |
| 269, 293 | `92/92` |
| 319, 336 | `108/108` |
| 320 | Core runtime UI `6/6` |
| 358 | Core connector `13/13` |
| 367, 378 | `111/111` |
| 414, 1730, 1764 | `116/116` |
| 493 | `103/103` |
| 523 | `107/107` |
| 534, 545, 552 | `24`, `26`, `24/24` |
| 560 | `46/46` |
| 593 | `49` tests, Scenario Lab `16/16` |
| 607, 620, 634 | `60/60` |
| 626 | `33/33` |
| 674, 675 | extension E2E `8/8`, scenario-site `10/10` |
| 1542 | `114/114` |
| 1731 | Core `542/542` |

**Almost certainly stale.** `ls packages/test-runner/src` shows ~25
`demo-llm-*` modules that post-date this document entirely; the suite cannot
still be 116 tests. `pnpm check` itself is now a different command
(`structure:test && lab:test && task:test && structure-audit && -r check`),
so every *"`pnpm check` passes"* claim (245-247, 269-270, 319-320, 366-367,
480-482, 523-524, 633, 671, 1543, 1729) refers to a gate that no longer has
the same contents. **Cross-check `116/116` and `542/542` first — they are
quoted in `Current State` (80-82), so they are what a resuming agent believes.**

### 4e. File and directory paths

| Line(s) | Path | My cheap check |
| --- | --- | --- |
| 737 | `apps/extension` | EXISTS |
| 873, 856 | `packages/test-contracts` | EXISTS |
| 862 | `packages/test-runner` | EXISTS |
| 840 | `scenario-lab` | EXISTS as `apps/scenario-lab` (document places it at repo root, 840) — **path wrong** |
| 1768 | `scripts/run-demo-workspace-flow.mjs` | EXISTS |
| 42, 548 | `test-runs/.auth` | ignored dir; `packages/test-runner/src/auth-session.ts` + `auth-cli.ts` exist |
| 49, 1494 | `test-runs/.clone-cache` | `packages/test-runner/src/clone-cache.ts` exists |
| 55, 285, 341, 1718 | `test-runs/web-extension-demo` | ignored; likely pruned |
| 1760 | `test-runs/web-extension-demo-clean` | ignored; likely pruned |
| 64, 508 | `.identity/credentials.json` | inside the above |
| 102, 627 | `/api/auth/session` | Core route, claimed **absent** on the audited revision — **most likely to have changed**, since Core has moved a lot |
| 645 | `fluxiq_session` cookie name | Core contract |
| 817-871 | the whole proposed layout tree | **stale**: names 2 packages, `ls packages` shows 7 |
| 1194-1199 | `pnpm lab scenario create` / `run` / `inspect` / `compare` / `matrix` | root `package.json` now binds `lab` to `scripts/lab/run-lab.mjs`, a different harness from `packages/test-runner/src/cli.ts`. **Cross-check whether these five subcommands still exist under `pnpm lab`.** |
| 42, 554-561 | `lab auth status｜clear`, `--fresh-login` | `auth-cli.ts` exists; binding unverified |
| 1502 | `lab clone-cache status｜refresh｜clear` | `clone-cache.ts` exists; binding unverified |
| 54-56, 254 | `pnpm demo:setup-local`, `demo:record`, `demo:run` | all three EXIST in root `package.json` — **not stale** |
| 1832 | "GitHub Actions, matching core's current CI" | no CI observed in this repository; Linux lane still unrun (92-94) |

### 4f. Version and environment claims

| Line | Claim |
| --- | --- |
| 168 | "Pinned Chromium 134 / Playwright 1.51.1" — **check against `apps/extension` devDependencies**; very likely bumped |
| 676 | "Chrome/134.0.6998.35" |
| 278-279 | panel at `http://127.0.0.1:3000`, gateway at `ws://127.0.0.1:4777/client` — **check against `lab-port-allocation-plan.md`, which exists precisely because port allocation changed** |
| 519 | ports `61420/61421/61422`, `61481/61482/61483` |
| 670 | "all 11 workspace projects resolve from the committed lockfile" |
| 671, 672 | "all 10 executable workspace packages" — `ls packages` + `ls apps` + `domain` now suggests **more than 10** |
| 1543 | "across all ten checked packages" |
| 75, 1702, 1626-1627 | workspace schema `0.3` (and `0.2` as migration input) |
| 1031 | `schemaVersion: "0.1"` for `WebScenario` — check `packages/test-contracts/src/scenario.ts` |

---

## 5. Self-contradictions

Six, quoted from both sides.

### C1 — Evidence policy: deduplication and low-FPS sampling (real, unresolved)

`Current State`, lines 76-78:

> "Evidence policy is strictly event-only: one physical JPEG immediately before
> and one immediately after every test-issued state-changing action; timed
> sampling and deduplication are disabled."

Reference section `### Capture triggers`, line 1136:

> "Rate-limit triggers, hash frames, and drop exact duplicates while preserving
> the event with the prior image digest. An optional 0.5-1 FPS sampler runs
> only during long uninstrumented waits."

Confirmed on the Current State side again at 1725: *"no periodic low-FPS
capture remains"*, and at 306-308. Line 1123 also still offers optional WebM
(*"Keep low-resolution WebM for failures"*) against 77-78's event-only rule.
The reference section was never updated when the policy changed. **This is the
worst of the six**, because the protocol's tie-break rule ("Current State
wins") is stated only for ledger entries, so a reader taking 1136 as the design
is not obviously wrong.

### C2 — Number of target modes (real, unresolved)

`### FluxIQ target modes`, line 900:

> "The runner must expose two explicit, mutually exclusive target modes:"

Line 422:

> "This phase adds `persistent-isolated` as a fourth explicit target."

And `Current State` 41-66 describes four: `isolated`, `existing`, `clone`,
`persistent-isolated`. Line 900 was never updated by Phases 10 and 12.

### C3 — "No Core files were changed" vs Core changes (reconciled in place, but the ledger lines stand)

Execution Log row 176:

> "…live clone certification awaits a configured external source. **No Core
> files were changed.**"

and line 251-252:

> "**No FluxIQ Core files were changed.**"

and 523-524:

> "…full `pnpm check`, `pnpm test`, and `pnpm build` pass. **No FluxIQ Core
> files were changed.**"

against `Current State` 67-75:

> "The 2026-09-05 top-level graph compatibility escape audit is closed. **Core
> now enforces Flow representation metadata** … a PIN-authorized legacy
> migration endpoint exists, edge upserts re-home `flow_id`…"

`Current State` 20-22 explicitly reconciles this (*"The facility phases
themselves record that no FluxIQ Core files were changed, but the 2026-09-05
… audit did drive Core-side ownership changes"*), so an agent reading top-down
is warned. But the three "no Core files" sentences are never annotated at
their own locations, and this is the same fact that makes
`Paired document: none` (D3) wrong.

### C4 — Phase 9 "remains in progress" (stale, never retracted)

Line 582-583:

> "The remaining findings were assigned as Steps 13-15 and **Phase 9 remains in
> progress** until they are integrated and revalidated."

against Execution Log row 175 (*"implemented and locally validated; live
external certification pending"*) and `Current State` 41-47 (*"Phase 9 … is
integrated; full isolated regression `run-mtnpc74q-89d850a9` passed"*). Steps
13, 14 and 15 are in fact recorded later in the same section (585, 611, 595),
so the work closed — but the sentence at 582-583 was never struck.

### C5 — Phase 12 "acceptance remains in progress" (stale, never retracted)

Line 503-504:

> "**Live two-invocation acceptance remains in progress** until that correction
> is integrated and rerun with a fresh validation workspace."

against lines 515-517, twelve lines later:

> "Two fresh sequential headed Chromium runs against the same workspace,
> `phase12-live-v2`, passed: `run-mtnvptuo-800f61c7` and
> `run-mtnvqwj5-169346f1`."

### C6 — The escape audit's own status (direct, in-document)

Line 1526, under `### Top-level graph compatibility escape audit`:

> "Status: **implementation in progress.**"

against line 1688, under `## Final Implementation And Live Validation`:

> "Status: **complete** for the requested parent Flow / Router / Subflow
> ownership fix and the two persistent-isolated demo scripts."

and `Current State` line 67:

> "The 2026-09-05 top-level graph compatibility escape audit **is closed.**"

Three status declarations for one piece of work, two of them using the word
`Status:` outside the header block with values that are not in the protocol's
controlled vocabulary.

### Also worth noting (not strictly a contradiction)

The remediation plan at 1633-1670 lists eight items in dependency order and is
written in the imperative future (*"Define a Core-owned representation
invariant…"*, *"In Core, reject non-empty graph writes…"*). All eight are
reported done at 1691-1709 and 1755-1758. A reader who greps for open work
finds eight false positives. Same for the "Validation required before closing
this defect" list at 1672-1684.

---

## 6. Leakage check

**No secret value is present in the document. Nothing needs redacting.** I
checked every line matching `password|token|secret|cookie|PIN|credential|TOTP|
bearer` (60+ hits) and every URL.

### What was checked and found clean

- **Credentials.** Every mention is a *variable name* or a policy statement,
  never a value. Lines 114-117 list `FLUXIQ_TEST_USERNAME`,
  `FLUXIQ_TEST_PASSWORD`, `FLUXIQ_TEST_PIN`, `FLUXIQ_TEST_PROJECT_ID`,
  `FLUXIQ_TEST_FLOW_ID`, `FLUXIQ_TEST_TOTP` as names to supply. The PowerShell
  block at 913-924 uses placeholders only: `"<test-user>"`, `"<password>"`,
  `"<authorization-pin>"`, `"<existing-project-id>"`, `"<existing-flow-id>"`.
- **Line 277** is the one to read carefully, and it is *reassuring*:
  > "`pnpm demo:setup-local` created the dedicated local test identity and
  > hardened ignored `.env.local` **without disclosing its generated password
  > or PIN.**"
  The generated credential is explicitly not recorded.
- **Line 498-499** names a failure mode, not a value: *"ordinary isolated
  bootstrap generated a new password/PIN and attempted to replace the
  persisted identity."*
- **Real-site targets.** None. Phase 8 (174, 680, 1342-1346) states repeatedly
  that no target and no secret is configured and no real site was contacted.
  The only external hostnames in the file are three documentation links at
  1840-1842 (`playwright.dev` ×2, `pptr.dev`).
- **User data.** None. All fixture data is synthetic (line 167 notes
  *"synthetic secret non-retention behavior is covered"*; 1073 describes a
  *"Sensitive input"* fixture with *"password/payment-like fields"* — a fixture
  category, not data).
- **Bearer tokens.** Line 1181 (*"A random per-run bearer secret authenticates
  the controller"*) and line 438 (*"controller token per invocation"*) are
  design statements; no token appears.

### Two lines worth the supervisor's eye, neither a secret

- **Lines 278-279** disclose the local topology:
  > "The repository-local FluxIQ panel was started at `http://127.0.0.1:3000`,
  > with the production client gateway listening at `ws://127.0.0.1:4777/client`."
  Loopback only, and the same values are already in `AGENTS.md`-adjacent
  tooling. No action needed. Line 519 similarly lists ephemeral high ports.
- **~22 durable identifiers** (§4c) — project, Flow, recording and runtime-run
  UUIDs from the local isolated demo workspace, e.g. project
  `08672748-…` and Flow `flow.b48b9824-…` at 1555-1556. These are not
  credentials and the installations are disposable local ones, so there is no
  disclosure risk. **But note the document holds itself to a stricter rule
  than it follows**: its own Phase 12 Step 6 (454-456) requires the run
  manifest and human report to record the target *"without exposing absolute
  private paths, credentials, cookies, tokens, recorded values, or internal
  database content"*, and lines 1554-1560 report exactly internal database
  content (*"six live `graph_nodes` rows, zero live `subflows` rows…"*) keyed
  by real project and Flow ids. Harmless here; worth not repeating, and a
  reason the compaction should archive rather than restate those rows.

---

## Not verified

- I did not run `pnpm check`, `pnpm test`, `pnpm build`, or any test suite.
  Every count in §4d is transcribed from the document, not measured.
- I did not open any file under `test-runs/`, so I cannot say whether any run
  bundle or demo workspace still exists.
- I did not read `packages/test-runner/src/cli.ts` or
  `scripts/lab/run-lab.mjs`, so the `pnpm lab` subcommand question in §4e is
  flagged, not answered.
- I did not check FluxIQ Core, so the Core claims (`542/542`, `89/89`,
  `/api/auth/session`, the representation invariant) are listed as checkable,
  not checked.
- I did not read the other four reports in this directory
  (`audit-evidence-and-demo.md`, `audit-orchestrator-and-gates.md`,
  `audit-phases-0-5.md`, `audit-topologies.md`), per the worker reading rule,
  so my staleness judgements may duplicate or conflict with theirs.
- Line-number arithmetic for section lengths in §2 is derived from heading
  positions; individual section totals may be off by one or two lines.

## Open questions or contradictions found

1. **Who owns the real-site lane now?** §3 proposes re-homing Phase 8, but
   `flow-authoring-and-defensive-runtime-plan.md`'s scope line says it
   explicitly does *not* cover the real-site lane. The supervisor should name
   the owner before anything is moved.
2. **Should the Core half of the escape audit be lifted into a paired Core
   document?** It is the strongest reason `Paired document: none` is wrong
   (D3), and Core owns the invariant. Doing it is a cross-repository edit and
   therefore a supervisor decision.
3. **Is the `pnpm lab` CLI in this document still the `pnpm lab` in
   `package.json`?** Root `package.json` binds `lab` to
   `scripts/lab/run-lab.mjs`, while `packages/test-runner/src/` still contains
   `cli.ts`, `auth-cli.ts` and `clone-cache.ts`. If the surface moved, lines
   42, 554-561, 1193-1199 and 1502 are all wrong and should be corrected
   during compaction rather than archived as-is.
4. **The retrofit made the problem worse.** The 2026-09-10 commit added 146
   lines to a document already 896 lines over the compaction threshold,
   because its brief forbade compacting. Worth a lesson: a retrofit brief for
   an over-threshold document should compact first, then retrofit.
