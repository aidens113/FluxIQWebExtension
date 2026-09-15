# Report: ex-c-plans-docs

## Outcome

Done. This is a read-only inventory. It covers (a) the statements the new plan must reconcile, (b) an edit list, (c) the protocol requirements, and (d) a sequencing recommendation. The only file created is this report.

## What changed and why

No document was edited. The four deliverables follow.

Abbreviations used for file:line citations:

| Short | File |
| --- | --- |
| MVP | `FluxIQ Web Extension — 30-Day MVP Implementation Plan.md` |
| MAI | `MVP_AGENT_INSTRUCTIONS.md` |
| IDX / CIDX | `docs/working/README.md` / `F:\!FluxIQ\docs\working\README.md` |
| W1 | `docs/working/mvp-week1-web-automation-reliability-plan.md` |
| OQ | `docs/working/mvp-week1-web-automation-reliability-plan/open-questions.md` |
| RANK | `.../mvp-week1-web-automation-reliability-plan/reports/cb-blocker-ranking-final.md` |
| REF | `.../mvp-week1-web-automation-reliability-plan/reports/i-open-questions-refresh.md` |
| LLM | `docs/working/llm-production-automation-plan.md` |
| TFP | `docs/working/automated-testing-facility-plan.md` |
| WC | `docs/architecture/web-capabilities.md` |
| TF | `docs/architecture/testing-facility.md` |
| P | `docs/working/agent-working-doc-protocol.md` |
| NEW / CNEW | `first-class-data-extraction-plan.md` here / in Core |
| CW1 | `F:\!FluxIQ\docs\working\mvp-week1-web-automation-reliability-plan.md` |

### (a) Statements to reconcile, supersede, or reference

**The MVP plan: sequencing and priority. These must be reconciled.**
- MVP:363-369. Week 2 is "Complete the adaptation loop", described as "the primary technological differentiator". No extraction appears in Week 2.
- MVP:648-654. The Week 2 exit criteria end with "If this loop is unreliable, improving it remains higher priority than Week 3 feature expansion." The new plan must argue that the foundation is a prerequisite of the loop, not an expansion of Week 3.
- MVP:658. The heading is "WEEK 3 — SIMPLE UX AND FIRST-CLASS SCRAPING".
- MVP:877-932. Phase 3.7 contains the Support list (889-904), the requirement that a scraper compiles into Flows and Subflows (926-928), and the exit criterion (930-932). Part of this is superseded, because the foundation moves to Week 2.
- MVP:1436-1438 allocates "10% — Scraping Experience". MVP:1470-1472 makes "Priority 4 — Scraping UX" the "acquisition use case". Any change to the allocation is the user's call.
- MVP:1450-1456. Priority 0 is a broken Create → Run → Adapt → Learn → Reuse loop.
- MVP:1484-1492. Rule 1 says every change must name its phase or acceptance criterion. Cite MVP:928, MVP:1373 and MVP:92-96.
- MVP:1496-1502. Rule 2 says Core stays generalized, with no browser assumptions.
- MVP:1506-1513. Rule 3 says to extend what exists and avoid parallel systems, so the plan must build on `web.dom.extract_list`.
- MVP:1572-1576. Rule 9 says changes that affect execution must be tested against FluxBench.

**The MVP plan: statements to reference.**
- MVP:92-96. Phase 1.2 lists extract text, extract attributes, structured extraction, repeating/list elements and pagination.
- MVP:207. Phase 1.4 evidence includes "Repeating structures".
- MVP:303-305. The FluxBench categories include simple, paginated and table extraction.
- MVP:491-497. Phase 2.4 validates against "Expected output".
- MVP:505-542. Phase 2.5 generates action nodes.
- MVP:597-604. Phase 2.7 persists "Updated target identity".
- MVP:680. The Phase 3.1 primary screen has "Extract data from this page".
- MVP:1073. The Phase 4.2 onboarding option is the same.
- MVP:1146. The Phase 4.4 sensitive-data review covers "Exported data". Because export lands in Week 2, this review is pulled forward.
- MVP:1348 and 1373. The first-user test and the acceptance test both include "create a scraper".
- MVP:1636 and 1646 appear in the post-MVP direction.

**Agent instructions (MAI)**
- MAI:46 says "FluxIQ core must remain domain-neutral". MAI:282-284 gives the test for what is generalized and what is browser-specific.
- MAI:69 lists "Scraping UX" among this repository's responsibilities.
- MAI:147-149. Priority 4 is "Improve extraction, repeating structures, pagination, output, and scraper creation". This must be reconciled, because extraction correctness is no longer Priority 4.
- MAI:159-170 is the scope check before coding.
- MAI:194-211 lists the Week 2 areas. Extraction is absent.
- MAI:215-229. Week 3 is "Simple Mode and scraping UX", with "Scraping" at line 228.
- MAI:660-666 says cloud work must not displace scraping.

**The Week 1 plan and its reports**
- W1:8. The scope says "Weeks 2–4 are out of scope". Week 2 content must not be appended to W1.
- W1:85-86. Next steps read "Week 2, starting from `cb-blocker-ranking-final`'s Week 2 ranks and the open questions". This is an edit target.
- W1:507. The Week 2 metric fields are `null`, with the schema already present. New extraction metrics attach here.
- W1:524-535. These corpus rows are the extraction baseline:
  - W04: simple extraction, variant `text-variant`;
  - W05: paginated extraction, variant `short-catalog`;
  - W06 and W07: search and conditional extraction;
  - W08: table extraction, variant `column-reorder`;
  - W09: extract the first row after sorting;
  - W11: extraction from an infinite feed;
  - W15: extraction in a second tab.
- RANK:104. Week 2 rank W2-2 is W05 `short-catalog`: 6/6 failed, 12/12 across both pairs, "Medium-high product gap", owned by "Week 2 recording and domain authoring owner". It is extraction work, and the new plan should claim it. RANK:103 (W2-1, W24) and RANK:105 (W2-3, W13) stay with the adaptation loop.

**Open questions**

The E-numbers are not written in OQ. They are assigned in REF and in the archive ledger at `archive/2026-09-12-finish-week1-ledger.md:3840-3847`.
- **E2**, OQ:54-66 (REF:55). `validateTargetOverrideEvidence` takes `{selector}` (`tools.ts:89`/`91`). Whether the repair lane becomes fingerprint-shaped is "a Week 2 contract decision" (R19). This bears directly on repairing extract nodes, whose item and field targets are both selectors.
- **E53**, OQ:1236-1260 (REF:419). Redaction is signature-based, so an unmarked sensitive field is captured. The decision is the user's, and options 2 and 3 are Week 2 (R17). Persisted, exported datasets make this sharper.
- **E55**, OQ:1315-1353 (REF:452). Defect 1, at OQ:1319-1327: extraction over a virtualised list returns 15 of 240 rows and **succeeds** with no signal. Defect 3, at OQ:1342-1345: scroll cannot move a pane container. OQ:1351-1353 rules these "Week 2 recorder and resolver work".
- **E57**, OQ:1402-1430 (REF:464). `web.dom.extract` by an exact selector took 3,503 ms on a 5,000-element page (OQ:1406-1410). This is Week 2 work (R20).
- **E58**, OQ:1431-1466 and 1467-1496 (REF:476):
  - 2,480 snapshot candidates against the 2,000 cap (OQ:1436-1442);
  - the fact vocabulary accepts only `data-testid` (OQ:1452-1459), which limits how the Lab can assert extraction on realistic pages;
  - `MAX_CANDIDATES = 60` binds (OQ:1486-1489).
- E54 (OQ:1312-1314) and E56 (OQ:1354-1401) are not about extraction.
- OQ:150-178 and OQ:274-281 are reference only. They are settled: `extractList` is lifted and awaited.

**The LLM and testing-facility plans**
- LLM:9-10. `Paired document: none`, and `Related` links only the testing-facility plan.
- LLM:45 and LLM:131. The scenario ladder includes `dynamic-list`, marked "not started".
- LLM:56. Next step 4 says the ladder is not sequenced.
- LLM:1000-1001. Adaptation target validation: "selector-wait/extract retain generic unique-element compatibility". `extract_list` is not mentioned.
- The other LLM grep hits (55, 750, 936) use "repeating" or "extracted" in an unrelated sense.
- TFP:37, TFP:173 and TFP:1333-1340. "Phase 7 Core extraction" means moving **code** into Core, not data extraction. This is a naming collision, so avoid the bare phrase "Core extraction".

**Architecture pages: current truth that the foundation will supersede**
- WC:47. Only 22 of 24 actions have their outcome validated, because "the two extract rows only observe".
- WC:114. `web.dom.extract` returns `result.extracted` and declares `validation: none`.
- WC:115. Attribute mode is partially supported. `mode` and `attribute` appear in no schema, node parameter or recorded payload, so only a hand-built command can reach them.
- WC:116. `extract_list` supports the forms plain selector, empty, `selector@attribute` and `column:<header>`. A missing field reports `output_not_observed`, and all values are strings.
- WC:117. Acting on each item of a list "is a Flow over an extraction, not one action". Core iteration is required for that.
- WC:118. Pagination: `maxPages` is 50 on both sides of the wire, a stop at the cap reports `truncated`, append-style pagination is unexercised, and an infinite feed is `scroll untilStable`.
- WC:112. Scroll cannot address a named scroll container.
- WC:196-199 classifies extract and extract_list as `safe`.
- WC:228-232. Extract and extract_list are "dispatch-only. No recorded user event maps to one". This is superseded once extraction is recordable.
- TF:740-742 and TF:779-780. A recording-script `extract` step proposes no node, apart from the Next clicks of a paginated one.
- TF:891-895. The runner asserts `expected.extracted` through its own reads (`scenario-steps/extract-records.ts`).
- TF:941-945 and TF:958. On the Flow lane, extraction is judged only when the Flow holds an extract node, so it is "usually `not_applicable`".
- TF:818-822 and TF:833 describe the extraction fixtures. `admin-console` has an `extract-customer-list` workflow, with variant `short-book`.
- TF:1418 says the content harness covers list extraction.
- TF:1593. Interactive direct results "discard ... extracted content".

**Core**
- CW1:95-96. "Approving a recording proposal into a node definition drops `expectedState`". A recorded extract node would lose its expectation unless this is fixed.
- CW1:97 says nothing in Core honours `failureRoute`. CW1:101-102 says approving beside existing nodes creates a second root.
- CW1:78-89. Core's parallel test suite is unsound on this machine, so Core dataset work must be verified with `--no-file-parallelism`.
- CW1:127-130. Any Core change that adds ISR, cached `fetch` or `next/image` must account for several Lab servers sharing one production build directory. A dataset preview UI must respect this.

### (b) Edit list for existing documents

1. **MVP, a new phase before Phase 2.1.** Insert it after MVP:371. The number 2.0 avoids renumbering Phases 2.1-2.9.
   ```
   ## Phase 2.0 — Data Extraction Foundation

   ### Objective

   Make structured extraction a real, repairable Flow capability at the start of Week 2, so the adaptation loop can repair extraction like any other automation. Decided 2026-09-15; tracked in `docs/working/first-class-data-extraction-plan.md`.

   ### Build

   - FluxIQ Core: domain-neutral datasets (records with a schema), per-run persistence, preview, CSV and JSON export, iteration over records by later nodes.
   - Web domain and extension: DOM extraction contracts, element picking, repeating-structure and field detection, pagination.
   - Recordable extraction that compiles to ordinary Flow nodes.
   - FluxBench judges FluxIQ's own extracted records on the Flow lane.

   ### Exit Criteria

   A recorded extraction runs as a Flow, persists a dataset that can be previewed and exported, and FluxBench judges its records on the Flow lane.
   ```
2. **MVP:652-654, after the loop line.** Add: "Extraction Flows built on Phase 2.0 are held to this same loop; Phase 2.0 is Week 2 work, not Week 3 feature expansion."
3. **MVP Phase 3.7, after MVP:881.** Add: "The engine beneath this experience (datasets, preview, CSV/JSON export, repeating-structure and field detection, pagination, recordable extraction compiled to Flow nodes) is built in Phase 2.0. This phase exposes it in Simple Mode."
4. **MVP:928.** Replace it with: "The resulting scraper compiles down into normal FluxIQ flows/subflows so runtime adaptation can repair it like any other automation. Phase 2.0 builds that compilation; this phase must not bypass it."
5. **MVP:1436-1438 and MVP:1470-1472.** Optional. These change the user's own allocation and priority, so ask first. The candidate addition to 1472 is: "Extraction correctness and repairability (Phase 2.0) is Priority 0/1 work; this priority covers the UX."
6. **MAI:209.** Add an item: `- Extraction foundation: datasets, recordable extraction compiled to Flow nodes, FluxBench extraction measurement`.
7. **MAI:228.** Change "Scraping" to "Scraping UX on the Week 2 extraction foundation".
8. **MAI:149.** Optionally change it to "Improve the scraping experience: field picking, preview and output UX, and scraper creation."
9. **W1:85-86.** Replace with:
   ```
   **Next steps:** Week 2 starts with the extraction foundation in
   [first-class-data-extraction-plan.md](./first-class-data-extraction-plan.md),
   which takes ranked item W2-2 (W05 `short-catalog`) and the extraction defect in
   open question E55; the adaptation phases start from `cb-blocker-ranking-final`'s
   remaining Week 2 ranks (W2-1, W2-3) and the open questions.
   ```
   Also append the plan's link to W1:10 `Related`, and bump W1:6 `Last updated`.
10. **OQ:1353** (E55), after the ruling. Optionally add the line: "**2026-09-15:** defect 1 (virtualised under-read) is claimed by `first-class-data-extraction-plan.md`." Add similar one-line pointers under E53 (OQ, the ruling after 1260) and E2 (OQ:66) only if the plan takes them.
11. **LLM:10.** Append `, [first-class-data-extraction-plan](./first-class-data-extraction-plan.md)`.
12. **LLM:56.** Replace with:
    ```
    4. Scenario ladder expansion and Phase 7 hardening lanes remain beyond the active phase; the document does not sequence them against the reuse work. The `dynamic-list` rung, and any LLM creation or adaptation of extraction Flows, follow the extraction foundation in [first-class-data-extraction-plan](./first-class-data-extraction-plan.md).
    ```
    **Warning:** LLM is 1,577 lines (IDX:22). Under P:174-175 and IDX:35-36, "the next agent to touch it compacts before doing anything else". Either delegate a compaction with this edit, or put the cross-reference only in NEW:10 until the LLM plan is next worked. TFP, at 1,842 lines, has the same trigger. TFP needs no edit.
13. **The architecture pages are not planning edits.** WC:114-118, WC:228-232, TF:779-780, TF:941-945 and TF:1593 change in the same work as the code, under the AGENTS.md documentation-maintenance rule.
14. **Regenerate both indexes.** Both are derived from the header blocks (IDX:3-7).
    - IDX Active table: insert a row between `automated-testing-facility-plan.md` (IDX:21) and `llm-production-automation-plan.md` (IDX:22). Write `Senior supervisor agent`, its line count, the NEW:8 scope verbatim, and `` `first-class-data-extraction-plan.md` ``. Update the footer at IDX:35 from "3 of 10" to "3 of 11". Recompute every row's Lines: W1 shows 717, and I did not measure it.
    - CIDX Active table: insert a row between `automation-studio-scalable-data-architecture-plan.md` (CIDX:24) and `module-size-governance-plan.md` (CIDX:25), with the CNEW:8 scope. Update the footer at CIDX:66 from "16 of 28" to "16 of 29".
    - A stale README is a structure-audit violation that fails `pnpm check` (RANK:67). Regenerate through the owning mechanism, not by hand, and run the audit afterwards.

### (c) Protocol requirements for NEW and CNEW

- **Location** (P:98-108, P:249-250):
  - both documents are named `docs/working/first-class-data-extraction-plan.md` in their own repository;
  - reports go to `<effort>/reports/<agent-label>.md`, one file per agent;
  - archives go to `<effort>/archive/YYYY-MM-DD-<topic>.md`;
  - the Core report (`ex-b-core`) lives in Core's own folder (NEW:97).
- **Header** (P:112-138):
  - an H1, then eight fields in this order, one line each, with no blank lines: Status, Status detail (one sentence), Created, Last updated, Owner, Scope (one or two lines), Paired document, Related;
  - Status is one controlled value, with nuance only in Status detail;
  - single-line fields are enforced by `pnpm structure:check --rule working-docs` (P:461-467);
  - both documents conform today (NEW:3-10, CNEW:3-10).
- **Section order** (P:140-150):
  - `## Current State` comes first, under 150 lines, rewritten in place;
  - it must answer what is true now, done, not done, next, and blocked;
  - reference sections come next; `## Worker Briefs` precedes the ledger (P:191-192, as laid out at P:337);
  - then `## Work Ledger`, then `## Open Questions`, each question with an owner;
  - an audit-style check placed Current State within 20 lines of the header (P:387). NEW's is at line 14.
  - NEW's Current State has no explicit **Done** or **Not done** block. Add both at the rewrite.
- **Ledger** (P:152-170):
  - one entry per completed unit, under 15 lines;
  - format `### YYYY-MM-DD — title`, then Agent, Changed, Why, Validation, Outcome, Follow-up;
  - Validation quotes the exact command and its observed output, never a worker's claim; if nothing ran, write `not validated` and say why;
  - Outcome is one of Accepted, Partial, Reverted or Blocked.
- **Compaction** (P:172-184): past 800 lines or 20 ledger entries, compact first. Settled outcomes fold into Current State, detail moves to the archive, a one-line pointer stays, and the compaction gets a ledger entry.
- **Briefs** (P:186-220):
  - written under `## Worker Briefs` before dispatch;
  - fields Repository, Task, Required reads, Owns, Must not touch, Definition of done, Report to;
  - at most 40 lines, partitioned by file, never by topic;
  - workers never edit Current State or the ledger, and use unique filenames.
- **Reports and return** (P:222-245): the report sections are Outcome, What changed and why, Commands run and observed results, Not verified, and Open questions. The return is at most 12 lines.
- **Pairing** (P:247-260):
  - each shared contract has exactly one owning document; the paired side links to it and does not restate it;
  - by default Core owns the domain-neutral dataset contracts and downstream owns the browser and DOM contracts;
  - CNEW:17-19 already assigns the plan, phases and sequencing downstream;
  - a boundary-crossing change gets a full ledger entry in the owning document and a one-line entry in the paired one, naming its date and title;
  - the user is alerted before the first Core edit, and Core work follows Core's AGENTS.md.
- **Index and durability** (P:262-275): update both indexes in the same work unit (neither lists the pair yet), and commit working documents with the work that changes them.

### (d) Sequencing recommendation

Interleave the foundation with the loop; do not run it strictly before or after. This answers NEW:140-142.

1. **Week 2 start, in parallel with Phases 2.1-2.3.** Those phases are harness and runtime context work. Partition these by file against them:
   - Core dataset contracts and per-run persistence;
   - the web extract-node contract: attribute mode made authorable (WC:115), and extraction made recordable (WC:228-232);
   - the W2-2 `short-catalog` fix (RANK:104);
   - Flow-lane extraction judging in the Lab (TF:941-945);
   - a completeness signal for virtualised lists (E55, OQ:1319-1327).

   The shared-file risk is Core's recording-proposal pipeline, including the `expectedState` drop at CW1:95-96. Serialize that area.
2. **Before Phase 2.4.** Recorded extraction must compile to Flow nodes, with Core iteration over records.
   - Phase 2.4 judges "expected output" (MVP:491-497), and silent under-read is exactly a false success.
   - Phases 2.5 and 2.7 fix the repair and target-identity shape (MVP:530, MVP:597-604). Decide E2's repair lane (OQ:54-66) with the multi-selector extract target in view, or it will be designed without it.
3. **With Phases 2.6-2.9.** Run the extraction drift variants through the loop: W04 `text-variant`, W08 `column-reorder`, and a new item-selector drift. Phase 2.9's proof of deterministic reuse (MVP:636-642) should include at least one extraction workflow.
   - Pull a minimal version of Phase 4.4's exported-data review (MVP:1146) into Week 2, because export ships there. It is tied to E53.
   - Measure extraction cost on `member-directory` (E57, E58), but defer optimizing it.
4. **Week 3.** Phase 3.1's entry point (MVP:680) and the Phase 3.7 UX (picker, field add/remove/rename, Simple Mode preview, current-page or all-pages choice) are built on the foundation.
   - Timebox steps 1 and 2 to roughly the first half of Week 2, so MVP:654's priority on the loop holds.

## Commands run and observed results

None, as the brief required: no shell commands, and no audits, `wc`, or git. I used only the Read, Grep and Glob tools.
- Read: every file and range named in the brief. In addition:
  - OQ, the entries at 54-66, 150-184, 268-287 and 1236-1261;
  - WC:106-121, TF:1592-1593, TFP:1-60 and 1330-1354, LLM:1-80 and 990-1004;
  - REF:55-76 and 419-490, RANK:60-114 and 160-172;
  - NEW and CNEW in full.

  The extra ranges were taken only to resolve grep hits and E-code definitions.
- Grep: extraction and scraping terms across the MVP plan, MAI, OQ, LLM, TFP, WC and TF. `E(2|5[3-8])` across the Week 1 folder showed the definitions are in REF, not OQ.
- Glob: NEW and CNEW both exist. `first-class-data-extraction-plan/reports/` did not exist before this report.

## Not verified

- Line counts for index rows. `wc` was not allowed, and IDX's 717 for W1 is unconfirmed.
- Whether a script regenerates the READMEs, and the exact checks the `working-docs` audit rule makes. Its source was outside the brief.
- Whether NEW and CNEW are committed. I ran no git.
- NEW:26-33's claims, for example "W04 and W08 have no Flow lane". `ex-d-test-facility` owns those. TF:941-945 is consistent with them.
- W1's phase sections for 1.2 and 1.4, the W1 archives, and the other ex-* reports.

## Open questions or contradictions found

1. MVP:654 and MVP:1470-1472, with MAI:147-149, put extraction below the loop. The decision needs the justification in (d), and the user may want MVP:1436's 10% allocation revised.
2. W1:3 is `Status: Active`, while W1:4 and W1:20 say Week 1 is complete. Re-statusing it to Complete moves its index row. The follow-ups at W1:74-83 may be why it is still Active.
3. Neither index lists the new pair, and a stale README fails the structure audit (RANK:67).
4. Editing LLM (1,577 lines) or TFP (1,842 lines) triggers compaction under P:174-175.
5. The E-numbers are absent from OQ, except "E58" at OQ:1467 and OQ:1496. Cite OQ lines, not the IDs alone.
6. TFP's "Phase 7 Core extraction" collides with this effort's vocabulary.
7. CNEW:10 says the reports are downstream, but `ex-b-core` reports into Core's folder (NEW:97, CNEW:30).
8. MVP:125, Phase 1.2's rule to "validate expected outcomes", conflicts with WC:47 and WC:114, where extract only observes. Datasets need a completeness or count expectation.
9. CW1:95-96. Approving a recording proposal drops `expectedState`, which would strip a recorded extract node's expectation.
