# Report: fhl-debug-notes

## Outcome

Done. All eight debug notes were read in full (cause, fix and run sections; UI sections skimmed). Source for every claim is
the note named in brackets, with its section or step numbers. Short names used below:

- **mvskodlp** = run-mvskodlp-9966d618 (social group-posts, round 6b)
- **mvskptb1** = run-mvskptb1-c9cef4fe (photo-social newest-likes, round 6b)
- **mvswewhy** = run-mvswewhy-e4e469d4 (social group-posts, round 6c)
- **mvswh11y** = run-mvswh11y-9d462629 (everything-store deal-wheel, gate round 1)
- **mvrj-6916** = run-mvrj7qg8-6916b3f7 (everything-store office checkout, round 6)
- **mvrj-c20c** = run-mvrj7qg8-c20c132e (social group-posts, round 6)
- **mvrj-b6dc** = run-mvrj7qg9-b6dc94f6 (job-board save-remote, round 6)
- **mvrj-a44a** = run-mvrj7qgf-a44a1427 (photo-social newest-likes, round 6)

Headline finding: in 8 of 8 runs the deciding defect sat in something the framework holds or could compute (a cell, a
toggle witness, a place token, a request-words check, a ledger). In 3 runs (mvskodlp, mvswewhy, mvrj-c20c) the Flow was
already right (the Lab oracle matched the 3 expected rows; mvrj-c20c s.2 for T2/T4/T5) and the run was lost by a judge's false no
that Core could not settle. In 4 runs (mvrj-6916, mvrj-b6dc, mvrj-a44a, partly mvskptb1) the decisive failure was
undo/reset bookkeeping, not a model choice. Only a minority of causes are genuine model-choice errors, and each of those
has a mechanical backstop already proposed in the notes.

## Per-run table

| Run | Task / site | Ending | One-line cause | Fix applied / proposed | Steps cited |
| --- | --- | --- | --- | --- | --- |
| mvskodlp | social-network-feed-recent-group-posts (read) | Failed `core.result.does_not_answer_request`; oracle PASSED 3/3 (s.Status, 1) | Double false no on the playback ("not a joined group") accepted: t771 located the defect from the row's own `group` cell, which proves group identity, not membership; build-yes hold skipped (`trial_not_confirmed`, T2 yes was not first-ask). Flow used a literal 3-group list (s.2) | F1 locate only if request says the value (Core `located-defects`); F2 alt (hold counts rechecked yes); F3 generality note; F4 bound read by the request's end (s.3). F1 later landed as t785 (see mvswewhy) | 0033,0034 (T1 no), 0035, 0038/0040, 0042 no, 0043-0046 yes, 0058,0059 no (s.1); 0087,0110,0113 repair judges |
| mvskptb1 | photo-social-newest-likes (3 lasting likes) | Failed; Lab labelled `performance.budget`, oracle never read (Status) | Playback met the messages dock the build had collapsed once in exploration (site remembers it), no handler; in-run handler never ran (correction: model wrote the condition `fact` as a description, domain read `unknown`, fixed by t787). Also false judged pass: looped like step had no `ensureState`, one witness for 3 passes, proof `shown` without direction, so judged run un-liked B (s.2) | Fix 1 mechanical handler from a layer the build cleared; 2 handler `when` must resolve; 3 toggle-idempotent from trial presses; 4 witness per pass + `contradicted`; 5 Lab budget label; 6 ending names leftovers (s.3) | 0045,0046 dock; 0055,0062,0071,0078,0103,0110,0119,0126 trials; 0082/83,0114/15,0123/24,0129-32 judges; 0099 `t1157`; 0141,0143,0144 playback/repair; 0142 breach |
| mvswewhy | same social task | UNVERIFIED (`runtime.behavior`); oracle PASSED 3/3 | t785 F1 fired on both nos; re-asks split (0057,0058 yes; 0059 no); lone-yes confirmation unreachable from a double no, so `unsure` (s.2). Flow still has literal group list + date regex `(19\|20\|21) September 2026` (s.2, fix 4) | Fix 1 reachable lone-yes (`unsupported-no.ts`); 2 reason text "named one"; 3 located-defects only for the tested column; 4 generality: sign-based group test, date bound in `where` vocabulary, Core-computed discriminating-field hint (s.3) | 0027-0043 builds; 0033,0034 T1; 0035 builder kept list; 0055,0056 no; 0057,0058 yes; 0059 no; 0046-0054 playback |
| mvswh11y | everything-store deal-wheel (read) | FALSE PASS: Core `passed`, oracle `failed` 15/16 (Status) | Judge invented exclusion "ear tips, not earbuds" (0032); advice reached builder unmarked (D1); the one correct no (0041) was wholly refuted on a misread count (D2 `only 20 items` read as stored count); later yeses passed the quote guard via lending and the `name` column-alias (D3) (s.2b) | F1 quote guard: settled condition accounted only by its own sentence + own quote; no column alias; F2 mark unstated exclusion on unsure+no; F3 items-seen is not stored count; tests (s.3) | 0024,0027-0032,0033,0036-0041,0042,0045-0053 (0048,0049,0052,0053 lent quotes),0062,0063 |
| mvrj-6916 | everything-store office-checkout-review (lasting address change) | Blocked, no Flow; Lab said "judged unknown" (Run, Cause 3) | A `modify_existing` press that reloads the page has no witness, no admissible inverse and no honest exit: every undo refused, repeat guard ended three briefs. Unrelated cart list settled act-15 (0110) (Cause 1). Model also never chose the office address (0034/0038) and used a launcher toggle t720 to "close chat" (0041) (Cause 2) | Value witness for lasting presses; own-control inverse; act-to-call invariant (`gate_unsatisfiable`); settle words by witness kind; `undo-claims` attach list only on own page; `outsideBrief` points to plan amendment; Lab verdict from structured data (Recommended fix 1-5) | 0017,0031 Buy Now; 0041; 0047,0050,0051; 0057,0061; 0063-0076; 0102,0110; 0117-0130; 0147,0157,0159,0169; 0182 |
| mvrj-c20c | same social task (round 6) | Failed (draft); Lab "unknown"; Core's last judged test no (0092) | Oracle-correct rows stored in T2, T4, T5 (3 = oracle) but T2 false double no accepted (0052,0053), T4 true yes (0071) held unsure (0070,0072,0073 nos), T5 four false nos refused so unsure (0078-0081); budget ran out with money unspent (s.3, 4). `asked_missing` located by existence not fit; left-out rows reach judge without cells; unlocated advice carried as `earlierAdvice` (s.4 A,B,C) | A fit check by cell; B left-out rows with answer cells; C carry only located defects; Lab verdict from structured data; policy question on lone yes (s.4) | 0041-0045 T1; 0049-0053 T2; 0055,0057-0063; 0067-0073 T4; 0075-0081 T5; 0083; 0092 T6; 0097 |
| mvrj-b6dc | job-board-save-quillmark-remote (3 lasting saves) | Blocked (`gate_unsatisfiable`), no Flow; Lab "unknown", truth `not_tested` | Undo reach marked all unsettled acts `no_admissible_undo` from a list read in place after an undo landed (row stays until next load), counting 3 removals against 2 unspent acts; reset builder believed it (0227,0228). Both subflow trials were judged yes twice (0181,0182,0209,0210) | R1 stale in-place read is not judged; R2 one answer never says both "this page can" and "no call can"; R3 wrap-up runs the witness press; R4 words (`outsideBrief`, `retryRefused`, name unsettled items); R5 Lab verdict (Root cause 1-4, Recommended fix) | 0041,0109,0111,0113; 0162-0168; 0170-0182; 0194-0208; 0214-0216; 0219-0228; 0229 |
| mvrj-a44a | photo-social-newest-likes (round 6) | Failed, no Flow; Lab "judged unknown" though no judge was ever called | Reset-settlement livelock: for a looped pass on another item, `controlOriginal` filed under the step receipt's place token, so settlement said "press back" while admission said `undo_already_back` (0103-0204, 110 steps). Domain place tokens embed page address (`place.ts`), so cell 1 and reel 3 differ (Root causes, decisive; inferred, no ledger trace). Model also took pinned posts as newest (0033-0035) and used a fixed tile handle and a wait for text "Unlike" (0055.., 0092) | Fix 1 one place per act, one function for admission and settlement, `gate_unsatisfiable` closure; 2 Lab `not_judged`; 3 ending names only read leftovers; 4 ordering guidance; 5 UI | 0033-0035,0061-0063; 0071-0075; 0079-0088; 0092; 0098; 0103,0105,0107-0146; 0195-0213 |

## Failure classes (ranked by runs hit)

Run counts count a run only if the class is cited as a cause or contributing cause in its note.

### 1. Undo/reset bookkeeping and settlement (4 runs decisive: mvrj-6916, mvrj-b6dc, mvrj-a44a; 1 contributing: mvskptb1)

- **What the model does today.** Little. Each note shows Core's ledger/admission/settlement giving contradictory or false
  answers that the model then followed: "settled/unsettleable" from stale in-place reads (mvrj-b6dc s.Root cause 1, steps
  0177,0227); "open" vs `undo_already_back` livelock (mvrj-a44a s.4, 0103-0204); no witness for a reloading
  `modify_existing` press (mvrj-6916 Cause 1, 0157,0169). Model errors only prolonged these: retried a stale handle
  (mvrj-b6dc 0045,0113), repeated refused calls (mvrj-6916 0072-0076), declared an undo with `consequences: []`
  (mvrj-b6dc 0226).
- **Framework could compute/enforce.** All of it. The notes' own fixes: one function answers "is this act's control back
  at its place" for admission and settlement (mvrj-a44a Fix 1); value witness and own-control inverse (mvrj-6916 Fix 1);
  stale in-place reads not judged (mvrj-b6dc R1); mechanical invariant that every act in `actsToUndo` has an admissible
  call or goes to `actsUnsettleable` (mvrj-6916 Cause 1 item 5).
- **If a model choice is wrong anyway.** The repeat guard worked every time (mvrj-6916 "status" table; mvrj-a44a 0182-0193)
  and ended the brief; the closed `gate_unsatisfiable` exit is the proposed catch.
- **Teaching-to-test risk.** None for the framework fixes; they name no site. Risk is in the proposed test fixtures: the
  notes already ask for a generic library or "reservations" fixture (mvrj-b6dc "Tests that fail first"). Keep that rule.

### 2. Judging a question Core could settle or ground from data it holds (4 runs: mvskodlp, mvswewhy, mvswh11y, mvrj-c20c)

- **What the model does today.** The judge (DeepSeek) returns `asked_missing` / `kept_not_asked` / "invented exclusion"
  claims about rows whose own cells contradict them: unjoined groups called joined (mvskodlp 0058,0059; mvswewhy
  0055,0056,0059; mvrj-c20c 0052,0053,0070,0072,0073), an exclusion the request never states (mvswh11y 0032, advice
  "exclude accessory rows") and then yeses without quoting the request for it (mvswh11y 0048,0049,0052,0053,0063).
- **Framework could compute/enforce.** Whether a defect is grounded: the cell proves identity, not "the request asks for
  it" (mvskodlp s.2, point 2); `STATED_COUNT` misread (mvswh11y D2); quote guard lending (D3). Notes propose
  deterministic checks: locate a defect only if its quoted value is in the request or is not merely the value a condition
  rejected (mvskodlp F1, mvswewhy Fix 3); settled condition accounted only by its own quoted sentence (mvswh11y F1);
  left-out rows delivered with answer-column cells (mvrj-c20c B); carry forward only located defects (C).
- **If a wrong choice still passes.** Per mvswh11y, none of the checks judges whether a quote excludes the row
  ("residual risk", s.3 F1); a held yes is re-asked. Per mvskodlp, one yes beside an unsupported no is `unsure`, which is
  not a pass but also not a refutation.
- **Teaching-to-test risk.** Low for the structural checks (they act on request words and cells). Medium for Fix 4b-style
  hints in mvswewhy (naming fields whose value differs between kept and left-out rows): safe only if worded without site
  terms, as the note says. Any prompt text must use a different kind of site (library/club), as the notes' tests already do.

### 3. Literal value lists vs per-row membership/sign fields (3 runs: mvskodlp, mvswewhy, mvrj-c20c; the third is the counter-case)

- **What the model does today.** Writes `group equals ["Riverside Allotment Society", "Harbourside Runners", "Old Town
  Bakers' Circle"]` (mvskodlp rev 3, 0038; mvswewhy rev 2, 0036/0038), copying a judge's "e.g." (mvskodlp 0033; mvswewhy
  0033,0034). In mvswewhy it kept the list despite Core's F3 note in the feedback (0035). Every false no then argued from
  the list ("hardcodes three group names": mvskodlp 0058; mvswewhy 0055).
- **Counter-case.** In mvrj-c20c the model did use a per-row sign (`shared startsWith "Shared with Members of"`, rev 2,
  0049) and got the oracle's 3 rows, still judged no (0052,0053). So this class is about generality of the Flow, and the
  deciding failure is class 2.
- **Framework could compute.** Core holds the structure's samples. mvswewhy 4b: name read fields whose value differs
  between kept and left-out rows (e.g. a field "reads '<prefix>…' on every row the condition keeps and none it leaves
  out"). Not verified whether Core holds per-item values for every field (mvswewhy Not verified). Alternatively a submit
  check that a list condition on a column the request defines by relation draws a note (mvskodlp F3; already built as the
  F3 note seen at mvswewhy 0035, and lost to the "e.g." list).
- **If the model still chooses the list.** Correct on today's data, wrong tomorrow; the Lab oracle sees one fixture state
  and cannot catch it (mvswewhy s.3 fix 4). Optional: a fixture variant (a fourth joined group) under the realistic-task
  rule.
- **Teaching-to-test risk.** High if the hint text is worded as "Join group / Shared with Members". Safe if Core computes
  it from data (field differs between kept and left-out) and words it generically.

### 4. Date and number bounds (3 runs: mvskodlp, mvswewhy, mvrj-c20c)

- **What the model does today.** Uses text regexes for dates. `posted matches "(19|20|21) September 2026"` drops 22
  September and later (mvswewhy s.3 fix 4); the pattern in mvskodlp admits "31 September" and every 2027 date (s.2
  "Also contributing"); mvrj-c20c 0053 judge noted it admits Oct to Dec 2026 and 2027 (s.1 T2).
- **Framework could compute.** The `where` vocabulary has presence, number and text only, though `sort` takes `as: date`
  (mvswewhy `flow-script-format.ts` `AUTOMATION_STUDIO_FLOW_CONDITION_RULES`). Fix 4a: a date comparison, e.g.
  `{"field":"posted","atLeast":"2026-09-19","as":"date"}`, a contract change across Core and downstream.
- **If the model still uses regex.** The judge sees it (0059 objected) but nothing mechanical catches a bound loose on
  data the fixture lacks.
- **Teaching-to-test risk.** Low: a vocabulary addition, not guidance. Keep the example date out of guidance text.

### 5. Picking stable targets (3 runs: mvskptb1, mvrj-a44a, mvrj-b6dc)

- **What the model does today.** Fixed tile handle inside a repeat (mvskptb1 rev 1/2, 0055,0062; mvrj-a44a rev 1, never
  tested); stale handle resent after `retryRefused` "the same as before" (mvrj-b6dc 0045,0113); a like step on a handle
  never pressed in exploration (`t1157`, mvskptb1 0099,0103); treating the pinned posts as newest (mvskptb1 0034-0050;
  mvrj-a44a 0033-0035; the grid read offered a pinned-marker field, ignored, mvrj-a44a 0071); `pinned is absent` also
  dropping reels (mvskptb1 rev 7, 0110).
- **Framework could compute.** Core already corrects most by feedback (mvskptb1 s.2 "Contributing (model)" table: all
  corrected by rev 8). Mechanical gaps: ordering/exclusion on rows a lasting repeat walks (mvrj-a44a Fix 4, round 5 fix
  1); reword `retryRefused` (mvrj-b6dc R4); a toggle `ensureState` from trial presses (mvskptb1 fix 3).
- **If a wrong choice persists.** The judges caught it at mvskptb1 0082/0083, 0110; not at 0126.
- **Teaching-to-test risk.** Medium: pinned-posts guidance would mirror the scenario. Needs a different-site example
  (e.g. a pinned announcement in a forum), or Core computing "this field marks first-n rows out of sort order".

### 6. Toggle state (3 runs: mvskptb1, mvrj-6916, mvrj-a44a)

- **What the model does today.** Writes a plain press for a control that toggles: "close the assistant chat" via launcher
  t720 that opened it (mvrj-6916 0041); the like at `t1157` with no `ensureState` (mvskptb1 0119,0126 flipped A, B, C);
  waits for text "Unlike" when the state lives in the accessible name (mvskptb1 0055; mvrj-a44a 0092).
- **Framework could compute.** `ensureState` for any step whose node a trial pass made (mvskptb1 fix 3); one witness per
  pass and a `contradicted` proof for reversal (fix 4); control name from the pass's own diff rather than saved words (UI
  note, s.4); runtime dialogs closed via the dialog's own close control (mvrj-6916 Cause 2, not traced).
- **If wrong anyway.** Judge sees only witnesses; at mvskptb1 0126 both judges said yes because pass 2 had no witness.
  The proposed per-pass witness is the catch.
- **Teaching-to-test risk.** None for the framework fixes.

### 7. Handler conditions / interruptions the build cleared (2 runs: mvskptb1, mvrj-6916)

- **What the model does today.** Writes optional steps for the two prompts it met first and none for a layer it collapsed
  once and the site remembered (mvskptb1 s.2 decisive 1-2, 0045/0046). Handler `fact` written as a description read as
  `unknown`, so the handler never held (mvskptb1 correction; domain `recovery.fact_kind_unread` from t787).
- **Framework could compute.** The handler itself: a press that clears a `COVERING … covers N` layer records
  `layerCleared`, and the submission gets the same handler shape `interruption-learning.ts` builds (mvskptb1 fix 1; "the
  model writes nothing"). Compare mvswh11y, where model-free recovery handled both dialogs (s.1, `interventions: 4`).
- **If wrong anyway.** The Lab's reset-before-playback plus the in-run repair (which failed at mvskptb1 0143,0144).
- **Teaching-to-test risk.** None (mechanical).

### 8. Reading past the request's stated end (2 runs: mvskodlp, mvswewhy)

- Model's Flow has `done when: text … contains "You're all caught up"` yet reads to the list end, keeping the rows that
  every false no then named (mvskodlp s.2 "Also contributing", F4; mvswewhy "Still open", cites the same).
- Framework could enforce: honor `done when` in the read's own position (not verified whether `extractList` has such a
  bound; mvskodlp F4). Catch: exclusion of those rows was correct either way, so outputs were unaffected.
- Risk: low if mechanical; high if guidance quotes the marker text.

### 9. Dedupe (1 run: mvswh11y)

- 0040 judge advised dedupe by url for an organic row equal to a sponsored one; builder added `dedupe by [url]` (0042).
  The framework dedupes automatically in group-post runs (mvskodlp, mvswewhy `collected 8, duplicates 5, kept 3`;
  mvrj-c20c same), so this is a minor class. No framework gap named in the notes.

### 10. Paging (0 decisive runs)

- Paging worked in mvskodlp (0049-0057), mvswewhy (0046-0054) and mvrj-c20c (2 pages then ended). mvskodlp UI shows
  "7 rows from 1 page" mislabel for 2 pages (s.4, minor). No failure attributed to paging.

### 11. Not model-asked: Lab and ending reporting (5 runs: mvrj-6916, mvrj-c20c, mvrj-b6dc, mvrj-a44a, mvskptb1)

- Lab `chatDraftVerdict` matches Core's prose; t753 changed it to `TOLD_DRAFT`, so every project-mode draft reads
  "judged unknown" (mvrj-c20c s.0; same cause in mvrj-6916 Cause 3, mvrj-b6dc "Why the ending says judged unknown",
  mvrj-a44a s.2). mvskptb1 has a different Lab defect: a 3% token under-estimate (14,643 reserved vs 15,093 reported) became
  `performance.budget` and hid the playback failure and oracle verdict (s.2).
- These are Lab reporting defects with a structured-data fix and zero teaching risk. They hide product causes, which is why
  they matter for the plan.

## Judge nondeterminism

**mvswewhy, steps 0057 vs 0059.** Both are `unsupported-no` re-asks of the two first-ask nos (0055, 0056), each carrying
Core's F1 finding. The note records: "a prompt identical to 0057's (`diff` is empty, 160,796 bytes each)" (s.1 table,
row 0059). Provider: DeepSeek flash at temperature 0 (The run). Outputs:

- 0057: **yes** (0.7), no quotes, no defects; reasoning "both shown with Join group buttons, so not joined ... The
  literal group list is a fragility, not a defect of this result" (s.2).
- 0059: **no** (0.6), same Rosa and Idris defects plus two Kettle & Crumb rows (column posted).
- The note concludes: "an outcome that is a draw between two readings of one packet" (s.2). Related: first asks 0055 (no,
  0.7) and 0056 (no, 0.8) were near identical (0056 cache hit 41,472 of 41,617 input tokens, so about 145 tokens differed),
  both no with different confidence.
- Differences between the two prompts: none (diff empty). So the nondeterminism is on the provider side at temperature 0
  (cause not verified; the note does not investigate).

**Other nondeterminism recorded in the notes (prompt differences not recorded or known to differ):**

- mvskodlp T2: 0042 no, 0043 yes on "the same 3 correct rows" (s.1). Whether the prompts were identical is not stated; 0045
  was a recheck with extra words ("This same evidence was judged before...") so differs. 0058/0059 playback nos: 0059 was
  a cache hit for 40,192 of 40,432 input tokens, "close to the same draw", both no (s.1).
- mvrj-c20c T4: 0070 no, 0071 yes (0.72), 0072 and 0073 no (s.1 table); first and second calls are plain successive
  judgements, whether text differed is not stated.
- mvrj-c20c T5: four nos on the same revision as T4's yes (0078-0081, s.1), so rev 5 yielded yes and no across trials.

**Implication.** Same evidence has produced both answers in at least 3 runs, so a rule that depends on the judge's yes/no
frequency (quorum, lone yes) is not a checking mechanism on its own. Reliability must come from Core grounding the defect
(class 2).

## Not verified

- No source, ledger or step folder was opened; every claim relies on the debug notes as written, including their stated
  inferences. Several decisive causes are flagged as inferred by the notes themselves: mvrj-a44a's place-token chain (no
  ledger trace), mvrj-b6dc's 3-removals-to-2-acts explanation, mvrj-c20c's which defect `notFound` located, and
  mvswewhy's label-mismatch explanation for 0059's Kettle & Crumb defects.
- Counts of "runs hit" are my reading of the notes' cause sections, not independent verification; run overlaps (one run can
  appear in several classes) mean the ranks are not additive.
- mvskodlp's F1 and mvswewhy's t785 relation is as stated in mvswewhy's Status (t785 F1 fired as predicted); I did not
  check the commit.
- Whether any later note (after 2026-10-28) supersedes these fixes.

## Open questions

- Class 3 and 2 together: should Core compute a "discriminating field" hint (mvswewhy 4b) or enforce a stronger rule
  against list conditions on relation-defined columns? 4b depends on whether Core holds per-item values for every field
  (unverified in mvswewhy).
- Lone-yes policy after refused nos: mvrj-c20c names it as a policy question, mvswewhy Fix 1 proposes a reachable
  confirming ask (judgement call, lead decision). With temperature-0 flips shown above, a third ask is a coin toss unless
  the defect is grounded.
- Whether the pinned-post ordering gap (mvskptb1, mvrj-a44a; rounds 1 and 3-5 per mvrj-a44a) should be fixed by guidance
  (high teaching risk) or by Core computing order/exclusion from the grid read's marker field.
- mvrj-6916 asks whether `outsideBrief` should point to plan amendment instead of forbidding a required step; mvrj-b6dc
  R4 asks that a call under `undoes` is never "outside the brief". These overlap and can share one change.
- Which of the Lab's reporting fixes (class 11) should land first, since they hide the product cause in 5 of 8 runs.
