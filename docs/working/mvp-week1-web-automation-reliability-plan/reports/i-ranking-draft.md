# i-ranking-draft — the Phase 1.6b blocker ranking, drafted before the benches report

Brief: "## i-ranking-draft" in `briefs/finish-week1.md`. Read-only. `{braces}` mark a figure a named report fills.
Criteria by number: 1 actions reliable, 2 evidence useful, 3 deterministic fallback, 4 failures classified,
5 bench repeatable, 6 blockers ranked. "Archive" means `archive/2026-09-12-finish-week1-ledger.md`, cited by heading.

## Outcome

**Done, as a draft.** Nine items rank as Week 1 blockers. Six of them are waiting on a Lab observation, not a fix:
- the four single-row rechecks in `l-stage2d`;
- the two benches, `l-stage3a` and `l-stage3b`.

Three findings need a ruling before the figures arrive, because they decide how the figures are counted (Q1-Q4):
- **Criterion 4's denominator.**
- **Whether ruled-out rows count against criterion 1.**
- **Two criterion 2 proofs that no dispatched report runs.**
- **A and B running concurrently,** where criterion 5 says "consecutive".

## 1. Ranked list

| # | Item | What fails | Criterion / Lab row | Rank | Observation that changes the rank |
| --- | --- | --- | --- | --- | --- |
| R1 | W15 `multi-tab` starts at the wrong node | `l-stage2c`: 0 of 6. The Flow began at a tab close: the first node by id, where `entry.10` sorts before `entry.9`. Fixed by Core `20bb3b4` and runner `b5c5db2` | 1 (W15 unarmed 3/3); 4 (`popup-blocked` expects `output_not_observed`) | Week 1 blocker | `l-stage2d` run 1: unarmed 3/3 and `popup-blocked` 3/3, with `startCandidateIndex` 0 → closed. A failure that starts correctly is a new defect, still a blocker |
| R2 | W25 `too-slow` reports Core's code | `l-stage2c`: right category, but code `output_dispatch.timed_out`, not `web.action.timeout`. Fixed by `b54df69` (3,000 ms margin) and `f41072e` | 4 | Week 1 blocker | `l-stage2d` run 3: `web.action.timeout` 3/3 and the run passes → closed |
| R3 | W17's file name reaches a saved attempt | `l-stage2c`: the name was still in Core's workspace. Fixed by `f-upload-validation-names` and Core's execution withholding | 2 (leak rows); 1 already 3/3 | Week 1 blocker | `l-stage2d` run 4: name and content each found 0 times, SQLite included → closed. Above 0 → the run stops, still a blocker |
| R4 | W05 `short-catalog` | Predicted: the first Next click fails `target_not_found` where the variant expects success. Core has no "is Next present" output, and no mapper builds a loop | 1 (W05 is in W01-W19) | Blocker until ruled; then ruled out | `l-stage2d` run 5 records that node and category → ruled out, per archive "i-w05-short-catalog". A different node or category → stays a blocker, to diagnose |
| R5 | `--repeat 3` never run | `l-stage2c`'s bench stopped after 5 of 67 rows | 5 | Week 1 blocker | `l-stage3a` and `l-stage3b` both finish, and every metric is within tolerance → closed. Any metric outside → still a blocker, named with both values |
| R6 | Drift recovery and context are unobserved in the Lab | W20-W23 recovery, W26 context, and W29 refusal are proven by unit and harness tests only | 3 | Week 1 blocker (proof gap) | Both benches: W20-W23 pass 3/3 with harness activation 0; W26 passes; `no-context` gives `target_ambiguous`; W29 gives `target_not_found`. Watch W21 `text-only`: design A's known cost is a shortened label with nothing exact left, which refuses instead of recovering. A refusal there needs a decision, not a fix |
| R7 | The classification rate has never been measured | Earlier Flow-lane history lost every structured failure (open question "Every Flow-lane structured failure has been deleted") | 4 | Week 1 blocker (proof gap) | Both benches report failure classification accuracy ≥ 90% on the agreed denominator (Q1) |
| R8 | Two criterion 2 proofs have no dispatched run | The `sensitive-input` leak assertion and the "16 items" are in no briefed report. `sensitive-input` is not in the week1 corpus | 2 | Week 1 blocker (proof gap) | A named Lab run of `sensitive-input` with 0 findings, and a row quoting the 16 items. Or a ruling that the content harness (222 passed at `f840b75`) carries the 16 items (Q3) |
| R9 | A recording held short, or an action dropped | Once dropped silently. It now fails as `recording.persistence` on both lanes (`g-recording-completeness`), root cause fixed in Core's ordered start | 1, 5 | Week 1 blocker only if seen | Any `recording.persistence` failure, or `recordedActions` differing between extension and Core, in either bench → blocker. None → close-out, closed |
| R10 | Core audits a runtime confirmation as a lost action (`i-leftover-sizing` 7d) | Core's audit wording | 1, 5 via `recording.persistence` | Later | That failure whose discard kinds are runtime confirmations → Week 1 blocker |
| R11 | W28 `iframe-checkout` | `l-stage2c`: 2 of 3; run 2 stopped after a scroll. Covered by `b5c5db2`'s start guard | None directly (outside W01-W19); 5 (±1 workflow) | Week 1 close-out (ruling queued) | `l-stage2d` run 2 3/3 → closed. A verdict flipping between A and B beyond tolerance → blocker for 5. A child frame's evidence missing → reopens B4 |
| R12 | Rows that passed without being judged | Six Flow-lane rows once passed with no Flow built (H2, fixed). Paginated extraction is judged by neither lane (`extractionExpectation: "not_applicable"`) | 1 | Week 1 close-out check | Any Flow-lane row passing with no Flow built → blocker. W05 unarmed passing does not prove paginated extraction; that stays Week 2 |
| R13 | False failures, and harness activation above 0 | Unmeasured at `--repeat 3` | 1, 3, 5 | Close-out check | Harness activation above 0 on any run, or false failure in either direction → blocker |
| R14 | Plan text conflates two vocabularies | Plan line 504 still says the runner's allowlist "derives from" `codes.ts` | None (documentation) | Week 1 close-out | None; a two-sentence edit |
| R15 | Phase 1.6b steps 4-5: docs and Week 2 entry points | Architecture pages without history are done (`d-arch-history`). Core's LLM page is in flight (`d-core-llm-reachability`). Entry points are in `i-week2-entry-points` | 6 | Week 1 close-out | Lab results that contradict a page's claim → page edit |
| R16 | A stored event keeps the full URL, query included (`i-leftover-sizing` 3) | Query tokens are stored at rest | None, unless a declared secret rides in a URL | Week 2 entry | A week1 scenario with a declared secret in a URL → Week 1 blocker for 2 |
| R17 | Redaction relies on markings | An unmarked sensitive field is captured and replayed (open question; the user's decision) | 2, as a stated limit | Week 2 entry | The user choosing option 2 or 3 for Week 1 |
| R18 | Wrong control on identifier-less recordings | Near-miss scores 0.633 against drift 0.690. D13 also moves candidates across the `destructive` gate | 3 (safety) | Week 2 entry (user decision) | A W29 run that clicks instead of refusing → Week 1 blocker |
| R19 | Resume, and the Flow a Week 2 run changes | Retry reruns from the start. The shipped app gives no provider without a grant. The patch lane is selector-keyed | Week 2 phases 2.7-2.8 | Week 2 entry | None in Week 1 |
| R20 | Capture cost and capacity caps on real-size pages | 3.5-5.3 s per failed action at 5,000 elements. The 2,000-candidate cap and `MAX_CANDIDATES` 60 are reached | Metrics: latency, evidence size | Week 2 entry | A bench p95 latency outside tolerance traced to capture → blocker for 5 |
| R21 | Realistic-fixture defects | Virtualised list under-reads; open shadow root; scroll container not moved. The fixtures are not in the corpus | None as written | Later | Adding those fixtures to the corpus |
| R22 | `i-leftover-sizing` 1, 2, 5, 6, 7a, 7b, 7c, 7e | Timeout precedence; split literal in freed SQLite pages; second root on append; duplicate edges; `hello` identity; `failureRoute`; node-definition `expectedState`; `dataDir` | 2's leak rows (item 2 only, a false clean); otherwise none | Later | Per that report: none needs a Lab run. For 7e, a stray `recordings/` directory after a run |
| R23 | Tooling and type hygiene | Among them: `pnpm lab` rewrites tracked build files; the domain test runner stops at the first throw; `WebAutomationRuntimeError.code` is a `string` with no producer; the typed `element` field is write-only (not re-verified at HEAD); the extension stays idle after Core refuses a start | None as written | Later | A bench `ambiguous_or_unknown` row traced to one → blocker for 4 |

## 2. Ruled out of Week 1

| Item | Recorded reason | Where |
| --- | --- | --- |
| Firefox; C8 | Week 4, Phase 4.9 "Firefox build where practical" | Archive "c-remaining inventory, and the scope it settles" |
| CS1b, a coded late-event frame to the client | The exit criteria do not require it (CS1b′ was Week 1, and landed) | Same; "i-flow-lane-errors: a failing Flow-lane run loses its own observation" |
| B7, C7 | Week 2 contracts | "c-remaining inventory…" |
| C5 | Needs a real Core | "c-remaining inventory…" |
| B4, `capture_snapshot` top frame only | Stays unless the Lab evidence run misses a child frame's items | "c-remaining inventory…" |
| PB10b, a Core candidate field | Unless the bench shows a step without a post-condition passing wrongly | "c-remaining inventory…"; "Finish-Week-1 session: fifteen settled entries archived" |
| D5, `failure.ts` reading `cause.code` | Unless the bench shows `unknown` rows | "i-flow-lane-errors…" |
| Core similarity metadata; B.3, a tier-aware floor | The predicate reads Core's contributions as they are; B.3 is Week 2 | "i-resolver-safety: why the resolver acts wrongly, and D14 amended" |
| D4, comparing Core's `actionCount` | Counts non-action entries, so it could hide a lost action; B1 covers pinned rows | "g-flow-lane-followups: … D4 is not Week 1" |
| Raw snapshot bytes | No exit criterion names them, and they need a new extension producer | "g-bench-coverage stopped on a brief defect; lanes decided" |
| Per-lane latency distributions | A and B mix lanes identically, so they still compare; labelled "all lanes" | "g-bench-coverage: every unarmed week1 row runs on both lanes"; "g-w29-row" |
| Landing marker for a wrong landing served 200 | Week 2; the "no navigation" claim was rejected | "W10 and W27 take E4; three negative variants declare a failed click" |
| Soft 404 served 200; sign-in page served 401 | Week 2 | "w19-e4: a click that lands on a refused page fails as navigation_unexpected" |
| A sign-up form's URL claim reading as `auth_required` | Week 2 heuristic | "w19-e2 and the E1 event id land" |
| Honouring `failureRoute` (Core) | A deferred seam. No ruling heading found in this archive; the reason is quoted from P7's entry | Current State; "i-recording-capability-gaps…" |
| Node definitions dropping `expectedState` | Week 2 | "w19-c2: Core carries a mapper's expected state into the Flow…" |
| W24 `unannounced` | Needs a recorded-payload contract change, a claim builder, an evaluator rule, and a corpus-wide pass. **The row stays and counts against criterion 4** | "i-stage1-failures: W18 ran on the wrong page…" |
| W13 `banner-absent` (P7) | Needs a new Core node outcome on the `failureRoute` seam; a loose rule would let W12 skip its invite | "i-recording-capability-gaps: … an optional dismissal is Week 2" |
| W05 `short-catalog` (pending R4) | A real product gap: no "Next present" output and no loop mapper. Declaring the failure expected was rejected | "i-w05-short-catalog: … ruled out of Week 1 once the Lab shows its failure" |
| A Lab producer for paginated extraction | A recording never yields an extract node; authoring one is Week 2 | "g-flow-lane-expectations…" |
| A literal split across freed SQLite pages | Recorded as a known limit, because Core withholds before writing | "g-attestation-sqlite and g-attestation-sqlite-reader…" |
| Changing a Flow while it runs | Week 2, and needs a resume design | Plan ledger "i-leftover-sizing and i-week2-entry-points…" |

**Open questions that bear on a criterion.** Where a tag is stale against Current State, the stale tag is named.
- **Criterion 1:**
  - "Credentials at replay" is tagged OPEN; the W18 secret leg is settled.
  - "The expired auth-gate workflow cannot report `auth_required`" is tagged OPEN; W19 passed 3/3 in `l-stage2c`.
  - "A recorded action can be silently dropped" is tagged OPEN; it is now guarded (R9).
  - "The content harness fails … under default Playwright concurrency" is standing guidance for reading the harness proof.
- **Criterion 2:**
  - Redaction relies on markings (R17).
  - A client's type is self-asserted, so the guards are defence in depth only (R22, 7a).
  - `capture_snapshot` runs in the top frame only (B4).
  - Merged multi-frame events are larger, an accepted trade-off.
- **Criterion 3:**
  - The checkbox-state and landmark-name entries are tagged OPEN; B5 is settled.
  - The typed fingerprint field is write-only.
  - Candidates are not sent on the wire (a design question).
  - D13's `destructive` gate; the identifier-less near-miss and its two constraining facts (R18).
- **Criterion 4:**
  - "Every Flow-lane structured failure has been deleted" (R7).
  - "An unusable parameter has no rejection channel" is tagged OPEN; B3 is settled.
  - The runtime error type has no producer.
  - The three vocabularies (R14).
  - The extension stays idle after Core refuses a start.
- **Criterion 5:**
  - Snapshot cost, and the member-directory caps (R20).
  - `connection.ts` at its limit is tagged OPEN; the split is settled.

## 3. Criterion rows: what closes each

| Criterion | Closing observation | Report and field |
| --- | --- | --- |
| 1 Actions reliable | Content harness green at the pin, and every W01-W19 row passing 3/3 on the Flow lane with `startCandidateIndex` 0 | `l-stage3a` and `l-stage3b`: per-row verdicts and the criterion row counts; `startCandidateIndex`; `flowCreated`. `l-stage2d` run 1 for W15. The harness gate is in the plan ledger (222 passed at `f840b75`), not a Lab report |
| 2 Evidence useful | Sanitized packet within budget with `truncated` visible; 0 leak findings on every run; W17 name and content 0; `sensitive-input` leak 0; the 16 items | `l-stage3a`/`b`: evidence size p50/p95 and truncation count (from `evidencePackets`), and redaction attestation findings. `l-stage2d` run 4. `l-stage3-demo`: the demo attestation. `sensitive-input` and the 16 items: **no report** (R8, Q3) |
| 3 Deterministic fallback | W20-W23 recover with harness activation 0; W26 passes; `no-context` gives `target_ambiguous`; W29 gives `target_not_found` | `l-stage3a`/`b`: fuzzy recovery rate; harness activation rate; those rows' verdicts and reported categories |
| 4 Failures classified | Failure classification accuracy ≥ 90% on the agreed set | `l-stage3a`/`b`: the Flow-lane accuracy in `metrics.ratesByLane`, its run count and misses, and each negative row's reported category. `l-stage2d` runs 1 and 3 |
| 5 Bench repeatable | Every rate within ±1 workflow and latency p95 within 25%, A against B | `l-stage3a` against `l-stage3b`: `metrics.ratesByLane`, p95 per action type and run duration ("all lanes"), and differing verdicts, through `i-bench-compare-prep`'s script |
| 6 Blockers ranked | This list, with its placeholders filled and each failing row ranked by frequency (fails in A and B, or one), MVP-loop impact and reproducibility | The Phase 1.6b ledger entry, from `l-stage3a`/`b` verdicts, `recording.persistence` discard kinds and counts, and `l-stage2d` run 5 |

The demo (`l-stage3-demo`: `demo:record` exit, `demo:run` exit, no provider) is Phase 1.6b step 3. It confirms 1 and 2; it is never their only proof.

## 4. Placeholders

| Placeholder | Filled by | Field |
| --- | --- | --- |
| {W01-W19 Flow-lane rows at 3/3, A and B} | `l-stage3a`, `l-stage3b` | per-row verdicts, criterion 1 row counts |
| {accuracy, runs, misses, A and B} | same | Flow lane of `metrics.ratesByLane`, failure classification accuracy |
| {fuzzy recovery; harness activation; false failure both ways; initial and replay success, per lane} | same | `metrics.ratesByLane` |
| {packet p50/p95 bytes; truncation count} | same | evidence size |
| {p95 per action type; run-duration p95} | same | action latency distributions |
| {leak findings per run} | same, `l-stage3-demo` | redaction attestation |
| {verdicts differing A against B} | supervisor comparison | per-row verdicts |
| {`recording.persistence` count; discard kinds and counts} | `l-stage3a`/`b`, `l-stage2d` | `recordingDiscards` |
| {W15 unarmed x/3; `popup-blocked` x/3; `startCandidateIndex`; `stoppedWithoutFailedAttempt`} | `l-stage2d` run 1 | `flow-lane.json` |
| {W25 `too-slow` code, x/3} | `l-stage2d` run 3 | the failure record's code |
| {W17 name count; content count} | `l-stage2d` run 4 | workspace search |
| {W05 failing node; category} | `l-stage2d` run 5 | `flow-lane.json` failure |
| {W28 x/3; scroll frame ids and counts} | `l-stage2d` run 2 | kept recording |
| {demo exits; demo attestation} | `l-stage3-demo` | exit codes |
| {lowest free memory} | each Lab report | for labelling single observations |

JSON key names other than those quoted come from `i-bench-compare-prep` (task 4 of its brief).

## What changed and why

Only this report. Nothing tracked changed; no Lab worktree or run directory was touched.

## Commands run and observed results

No shell command ran. I used Read, Grep and Glob only:
- **The plan:** Current State, Objective, "How Week 1 Is Proven", Phase 1.6b, Metrics, the corpus table, the three ledger entries, and a grep that found "allowlist derives from it" at line 504.
- **The open questions and two reports:** `open-questions.md` in full; `i-leftover-sizing.md`; and `i-week2-entry-points.md`, which I read in full although only task 1 was needed.
- **The archive:** heading and keyword greps, and the entries cited in section 2.
- **Beyond the brief's Read list:** the `l-stage2d` and `l-stage3` briefs, their amendments, and `i-bench-compare-prep`, which I needed to name report fields.

## Not verified

- **No ranking rests on code read at HEAD.** Stale open-question tags are judged against Current State only.
- **Unread reports:** `l-stage2d.md` (untracked, possibly partial), `i-bench-triage.md` and `c-remaining.md`. So the Stage 2 per-row reasons, and B7, C5 and C7's own wording, are unread.
- **The 33-run figure in Q1** is derived from the corpus table, not from a bench report.
- **The pins:** whether `d639415` changed any code after `f840b75`'s harness gate.

## Open questions or contradictions found

1. **Q1, criterion 4's denominator.**
   - The Objective names W14, W19 and W27 variants: 5 variants, 15 runs, so at most 1 miss.
   - Metrics and Current State use every negative variant: W10, W14, W15, W19, W24, W25, W26, W27 ×3 and W29, which is 33 runs.
   - With W24 counted as ruled "against criterion 4 as measured", 3 misses leave 30/33 = 90.9%. One more miss gives 87.9%, a failure.
2. **Q2, criterion 1.** W05 `short-catalog` and W13 `banner-absent` are both inside W01-W19 and both ruled out. Does "W01-W19 pass 3/3" exclude them, or cover unarmed rows only?
3. **Q3, criterion 2.** No briefed report runs `sensitive-input` or names the 16 items (R8).
4. **Q4, criterion 5.** It says "two consecutive runs", but the `l-stage3` amendment runs A and B concurrently under load. Is the latency p95 comparison valid, and are timing failures single observations?
5. **Current State's ruled-out list omits items the archive rules out:** PB10b, D5, B.3, Core similarity metadata, the soft 404 and 401 cases, the sign-up heuristic, paginated extraction, and the split-literal limit.
6. **Stale tags in `open-questions.md`:** credentials at replay, checkbox state, landmark name, W19 `auth_required`, unusable parameter, `connection.ts`, and the silently dropped action.
