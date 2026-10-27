# t758/store-refusal: why Core refused store gate run run-mv79nrcx-112c5ed7

Worker report. Read-only investigation; no source, shared doc or tree changed.

## Outcome

Done. At the run's Core commit `73550acb` the refusal was a **product defect**, not a check that lacked support. The result was correct, and the judges' yeses tied the four left-out rows to the request's clause "leaving out sponsored placements". Core turned those yeses into a semantic `does_not_answer` for two reasons:

- **A naming rule the judge was never told.** Core requires a 4-word label prefix (or an id). The judge was told only to name a row "by enough of its label to tell it from the read's other rows". Steps 17 and 29 did that, with aliases unique inside the read at 1, 2 and 3 words.
- **An explanation gap treated as a wrong answer.** The trial became a `no`, the no closed the candidate's digest, unchanged resubmissions were refused, and the build stalled.

On current Core dev (`0305b482`, which differs from tree HEAD `08d95721` only in AGENTS.md) **that exact refusal cannot recur** for `everything-store-first-page-plus-earbuds-deal-wheel`. I checked this with a scratch probe that runs dev's own code on this run's shape (below).

A residual defect remains, smaller than the original: the correction line Core sends the judge for this condition calls a presence exclusion a "bound". The worst outcome observed in the probe is `not_judged` (no promotion that trial), never a closed `no`.

## What changed and why (findings)

### 1. Refusal, model check and request clause, from the step files

Bundle: `C:/Users/osrs_/FluxStuff/fxwork/t524/!FluxIQWebExtension/test-runs/instances/t524-slot-1/run-mv79nrcx-112c5ed7/steps/`.

- **The refusal.** `0016-tool-core.test_candidate/result.json` gives `feedback.code = "candidate.trial_judged_no"`, findings `result.counts_look_right`, `result.summary_withheld`, and `checked[0]`:
  > The check answered yes without quoting, beside each of these rows, words of the request that exclude each; they were left out by condition "the item's text "Sponsored" is absent (a row is kept only when it has no "Sponsored")" alone (Read node.bootstrap.a09155e2b1ba9e12.main.s3) -- <3 row labels>. A row the request's own words do not exclude is one it asks for.

  The read saw 20 items and kept 16. Its one condition rejected 4, all 4 by itself. Stored: 16 rows, `refused: 0`, `missingRequired: 0`.
- **The authored condition.** Step 0012 `call.json` (revision 1) has `"where": [{"field": "div_css-1f5vozn_span", "is": "absent"}]`. Step 0026 (revision 2) has `"where": [{"field": "ad", "is": "absent"}]`. Both are presence tests. In the judge's copy each of the 4 left-out rows has a witness with `readKind: text, state: present, value: Sponsored` (step 0017 `request.txt`, about lines 604-640).
- **The model checks.** All four (steps 0017, 0018, 0029, 0030) answered `answersRequest: yes`, `patchNeeded: false`, `finish reason: stop`.
  - Step 0017's sentence that quotes and names the rows: `...rejected exactly the 4 items whose text contained "Sponsored" — <2-3 word aliases> — all of which are sponsored placements the request excludes.`
  - Step 0018 names the rows in a sentence with no quotation marks (`rejected 4 sponsored placements (<aliases>)`) and quotes "Sponsored" only in a separate sentence about the where condition.
- **The request clause.** The task's `FIRST_PAGE` instruction (`apps/scenario-lab/src/scenarios/everything-store/live-tasks.ts:3` at downstream `6a46e66b`; line 9 on dev) is: "...collect every search result on the first page, **leaving out sponsored placements**, into a table...". The exclusion is the request's own condition.
- **What the judge was told** (step 0017 system prompt): "name each row, by enough of its label to tell it from the read's other rows or by an id it carries" and "name the row in a sentence that also quotes, in double quotes, the request's words that exclude it". It was not told about a 4-word minimum.
- **Prior count-only probe** (`C:/Users/osrs_/FluxStuff/codex-handoff-validation/t524-store-preparation/judge-alias-binding-counts.json`). The three flagged rows have `uniquePrefixWords` 1, 2 and 3 within the read. Steps 17 and 29 have `uniqueAliasInQuotingSentence: true` for all three, with `first4Mentioned: false`. Steps 18 and 30 have `false`: their quote is not in the naming sentence. The fourth left-out row was also among the stored labels, so it was exempt.

### 2. The refusing code at the run commit `73550acb`

All paths below are under `packages/fluxiq/src/programs/automation-studio/runtime/`.

- `result-verification/request-rows/row-naming.ts:18`: `PREFIX_MIN_WORDS = 4`. Lines 21-34 compute the shortest unique prefix, but never shorter than 4 words.
- `result-verification/request-rows/unquoted-rows.ts:35-56` (t515). A left-out row must be named, with that rule, in a sentence that quotes the request's own words. There is no exemption for rows Core could measure.
- `result-verification/verdict.ts:167-177`. A yes with any `unquoted` row becomes `does_not_answer` with code `doesNotAnswer`. `refusedYesReason` is at lines 249-256 and `unquotedLine` (the text quoted above) at lines 266-270.
- `result-verification/build-test/judge.ts:257`. `does_not_answer` becomes a trial `no`.
- `flow-bootstrap/candidate/trial-gate.ts:241`. A `no` closes the digest. Lines 216 and 270 then refuse with `candidate.trial_unchanged_after_no`, which is the stall chain the debug note records.

### 3. Later tasks that changed the rule (`git log 73550acb..HEAD`)

| Commit | Task | Date | Effect on this case |
| --- | --- | --- | --- |
| 33835971 | t525 | 10-13 | Added `exclusion-evidence/recheck.ts`: a held yes is re-asked on the same evidence. |
| 316b3604 | t574 | 10-14 | Created `value-readings/settled-rows.ts`: Core settles rows it measured, starting with numeric bounds. |
| ba39584d | t599 | 10-14 | **Core settles presence-test rows** from their witnesses; rows also named by short id (`row-id.ts`). |
| c87e5bbd | t624 | 10-15 | Text-test rows settled. |
| 81c12609 | t636 | 10-15 | **A quote-lacking yes is held (`unsure`), not a no.** |
| 838fa708 | t660 | 10-15 | Request exclusion words count for presence tests on the refuted-no path. |
| 0760e1dd / 437bc303 | t674 | 10-16 | `verdict.ts` and `agreement.ts` split into directories. |
| 7e86daed / d4466ecd | t686 / t687 | 10-16 | Re-ask and condition-keep rules. |
| 8621a757 / 31545563 | t691 | | Stored-elsewhere rows; converse confirming ask. |
| 534c41fb | t752 | 10-21 | Grounded defects on a no. |

Of the brief's candidate list I confirmed t599, t624, t636, t660, t686/t687, t691 and t752 as touching this path. I found no change to the 4-word rule: dev `row-naming.ts:36` is still `PREFIX_MIN_WORDS = 4`.

### 4. The same path on current dev (file:line)

Paths under `.../runtime/result-verification/` unless stated otherwise.

- **Rows are settled.**
  - `value-readings/summary-readings.ts:101-109` pairs each left-out row with its witness. Pairing happens only when the witness count equals the left-out count, which holds here: 4 and 4.
  - `value-readings/settled-rows.ts:110-124` (`presenceKept`): for `is: absent`, a witness `present` settles the row.
- **Settled rows need no quote of their own.** `request-rows/unquoted-rows.ts:140-145` skips settled labels.
  - `boundUnquoted` (lines 233-243) still needs one sentence that quotes the request and names the condition.
  - The accepted names come from `request-rows/summary-reads.ts:211-216`. For the generic wording `the item's text "X" is absent (a row is kept only when it has no "X")`, produced at `read-account/condition.ts:160`, that is only `condition 1`.
- **A missing quote holds the yes.** `verdict/result-verdict.ts:56-68` returns `verdict: "unsure"`, `basis: "model_unconfirmed"`, `code: "core.result.exclusion_evidence_missing"`. It falls through to `does_not_answer` only together with unaccounted or kept-number rows (lines 69-77).
- **A held yes is re-asked**, up to `ASKS_PER_CHECK = 2` (`verify.ts:231`), with the recheck at `verify.ts:329-333` and `exclusion-evidence/recheck.ts:21-34`.
- **A persistently held yes is `not_judged`.** `build-test/judge.ts:347` does this. A `model_unavailable` outcome is also `not_judged` (`build-test/judge.ts:346`).
- **Only a `no` closes a digest.** That is `flow-bootstrap/candidate/trial-gate.ts:483`. `not_judged` is in `TRANSIENT` (`trial-gate.ts:367`) and can be retested up to the per-revision limit (`trial-gate.ts:430-431`).

### 5. Verdict

- **The refusal at `73550acb` was a product defect.**
  - The data was correct. The debug note's private oracle found 16/16 rows, 64/64 fields and 0 extra; I did not rerun it.
  - The exclusion was the request's own condition.
  - Steps 17 and 29 met the judge's written instruction. Core enforced a stricter, unstated 4-word rule, then routed an explanation shortfall as a semantic no that closed the digest.
  - Steps 18 and 30 did genuinely miss the format: no quote in the naming sentence. That was formatting non-compliance, not missing support.
- **It cannot recur on dev in that form.** All left-out rows are Core-settled, so neither the per-row quote nor the 4-word naming applies. A yes missing the one condition quote is held, never a no. A persistent hold is `not_judged` and does not close the digest.
- **Still reachable on dev:**
  - A judge that never writes `condition 1` in a sentence quoting the request is held. After two asks per check the trial is `not_judged`. The revision can be retested, but nothing promotes until a judge complies.
  - The residual defect below makes compliance less likely for this exact condition.

### 6. Residual defect on dev: the held line and recheck call a presence exclusion a "bound"

- **Root cause.** `verdict/unquoted-line.ts:4` is `PRESENCE_CONDITION = / is (?:present|absent)\)$/u`. It recognises a presence test only when the condition name ends in `is absent)`.
  - The t482 lacking-text wording (`read-account/condition.ts:160`) ends `...has no "Sponsored"))`, so the regex fails.
  - The line then falls to the numeric-bound branch (lines 28-29): "quote ... the request's words that state its bound ... If the request states no such bound, those rows are ones it asks for."
  - That line is what `exclusion-evidence/recheck.ts` sends to the judge. It contradicts the presence wording that `settled-rows.ts:118-121` puts on the judge's copy ("asking for only rows without it"), and it invites a literal judge to answer no on a correct result.
  - The kind of settled row is re-parsed from wording instead of carried from `settled-rows.ts`. The same mismatch probably affects settled text-test rows (t624) and the bound-name derivation (`summary-reads.ts:211-216`); not verified.
- **Owning files.**
  - `packages/fluxiq/src/programs/automation-studio/runtime/result-verification/verdict/unquoted-line.ts`
  - Structurally, the settled kind should travel on the unquoted entry: `request-rows/unquoted-rows.ts` / `types.ts`, from `value-readings/settled-rows.ts` through `request-rows/summary-reads.ts`.
- **Fail-first test shape.** Put it beside `result-verification/tests/judge-accounts-for-rows.test.ts` (t599 block), on a non-store catalogue.
  - Read: `where: [{ read: { kind: "text", css: ".badge" }, is: "absent" }]`, `conditions.seen: ["Promoted"]`.
  - Every alone-left-out row witnessed `{ state: "present", value: "Promoted" }`.
  - Request "...leaving out promoted items...". The yes quotes "Promoted" but never names `condition 1`.
  - Expect `verdict: "unsure"`, `exclusionEvidenceMissing[0]` to contain "the request's words asking for what that condition tests", and not to contain "bound". Today it says "the request's words that state its bound" (observed in the probe below).

## Commands run and observed results

- I read the step files directly: `0016` result, `0017`/`0018` meta, decision and response, the step 0017 request prompt clauses, and the `0012`/`0026` where clauses. Quoted above.
- `git grep` / `git show 73550acb:` / `git log 73550acb..HEAD` / `git log -S PRESENCE_CONDITION` in `fxwork/t758/!FluxIQ`. I ran no command that changes the index, branch or history.
- `git diff --stat HEAD dev` (Core) printed `AGENTS.md | 18 +++++++++++++-----`, with nothing under automation-studio.
- **Scratch probe** against dev's source: `C:/Users/osrs_/AppData/Local/Temp/claude/c--Users-osrs--FluxStuff--FluxIQWebExtension/b969a395-6436-4284-bccb-432f7f43683b/scratchpad/t758-store-refusal/probe.test.ts` with `vitest.probe.config.mjs`, run with the tree's vitest 2.1.9. It uses stand-in labels with this run's structure (aliases unique at 1, 2 and 3 words, labels of 16 words or more) and Core's own `summarizeAutomationStudioRunResult` and `automationStudioResultVerdict`. Output: `Tests 8 passed (8)`.
  - The wording came out `the item's text "Sponsored" is absent (a row is kept only when it has no "Sponsored")`, with `SETTLED 3`.
  - Step 17-shaped reply: `unsure core.result.exclusion_evidence_missing`, one line ("...names condition 1 (...) ... the request's words that state its bound...") and no rows listed.
  - Step 18-shaped reply: the same.
  - Either reply plus `Condition 1 leaves out what the request excludes: "leaving out sponsored placements".` gives `answers core.result.answers_request`.
  - `verifyAutomationStudioRunResult` with scripted replies:
    - held, then compliant: 3 calls, `answers`.
    - held, held: 4 calls, `unsure core.result.exclusion_evidence_missing basis model_unconfirmed`.
    - held, then a literal no ("the request states no bound..."): 2 calls, `unsure core.result.verdict_unavailable basis model_unavailable`. That is not a closed no.

## Not verified

- I made no live run and no model call. Whether a real judge on dev writes `condition 1` beside a quote is unmeasured.
- The probe's summary is reconstructed with stand-ins, not the run's captured summary. I did not check that the domain's real read output on dev still emits aligned `leftOutObservations` for this read, which settling requires.
- Revision 2's `field: "ad"` (a named column): whether `boundNames` accepts "ad" as a name, as the settled sentence then offers, is untested.
- How a real no carrying t752 `defects` is weighed in agreement. My scripted no had no defects.
- The private dataset oracle was not rerun. I did not read reports t515a/t515b; the t515 rule came from the code headers.

## Open questions or contradictions found

- The judge prompt on dev still says "by enough of its label to tell it from the read's other rows" (`llm/diagnosis-instructions.ts:153`), while `row-naming.ts:36` demands 4 words or an id. That is moot for settled rows, but it is still the same mismatch for unsettled ones. The recheck text does say "full displayed name or exact distinguishing identifier".
- The debug note concluded "keep the conservative naming rule". That is defensible for safety, but it is not what the judge is told.
