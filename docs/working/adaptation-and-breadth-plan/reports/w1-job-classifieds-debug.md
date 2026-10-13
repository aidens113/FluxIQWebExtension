# W1 debug: job-board and local-classifieds breadth builds (first runs)

Pair: Core `fbd06c77`, downstream `58144440`. Read-only debug of two failed
paid builds; no Lab runs, provider calls or commits.

- job-board / job-board-remote-rust-roles: `run-mv6qr7fk-77f30b49`, lane tree
  `fxwork/t342`, $0.0682, 65 model calls (45 decisions, 19 judge calls, 1 chat).
- local-classifieds / local-classifieds-bike-search: `run-mv6qrcdu-a31b44b8`,
  lane tree `fxwork/t262`, $0.0268, 33 model calls (32 decisions, 1 chat).

## Outcome

Done. Both runs are fully walked. The job-board premise in the brief is wrong:
the build **did** submit. It had 12 revisions, nine accepted, and ran 10 test
runs. It ended at the model-call limit, still in the repair loop. The miss
behind every trial is in how numbers are read (`£72k` reads as 72), and the
judges made it worse by repeatedly giving wrong evidence.

The local-classifieds build never left exploration. Three element and
interaction defects each cost a stretch of calls. The run ended on three
repeat refusals of a select on a `role=listbox` popup. The page view prints
that popup as `select`, the resolver then refuses it, and the refusal carries
no wording the model can act on.

## What changed and why

Only this report file was written.

## Run 1: local-classifieds (`run-mv6qrcdu-a31b44b8`)

Instruction: bicycles within 10 miles of Kelford, priced £100-£400, condition
new, like new or good, cheapest first, no sponsored posts.

### Steps, refusals and failures

| Step | Result (quoted) | Layer | File:function | Kind |
| --- | --- | --- | --- | --- |
| 0020 | `dom-select t471 value "10 miles"` -> `{"ok":false,"code":"output_not_observed"}` and nothing else | Extension (match) + domain (refusal) + page view (vocabulary) | `apps/extension/src/content/actions/select.ts:findOption` (with `by:"value"` it compares only `option.value`, here `"10"`); `domain/src/runtime/llm-evidence/action-failure/refusal.ts:webActionFailureRefusal` (`OPTION_NOT_OFFERED` has no entry in `BY_FAILURE_REASON`, so `detail` is undefined and the client's "closest options are "10" (10 miles)" sentence is dropped); `page-view/element/state-tokens.ts` prints the options by label only, `[1 mile\|2 miles\|...\|10 miles\|...]` | Interaction defect (wrong option form). The refusal is a **bare code the model could not act on** |
| 0022, 0024 | `llm_evidence_loop.repeat_refused` ("You already made this exact call ...") | Core loop (correct) | Core repeat guard | Model repeated the call, because 0020 gave it nothing to change |
| 0025-0028 | Pressing `t283` again **closed** the open dialog ("now closed"), and it was then reopened | Model | - | Wasted: the model guessed "Apply was never pressed" |
| 0030, 0032 | Same select after the page changed -> bare `output_not_observed` twice more | Same as 0020 | Same as 0020 | Same as 0020 |
| 0034 -> 0036 | `describe_element t471` showed `options=[{"value":"10","label":"10 miles"},...]`; `value:"10"` then succeeded | - | - | Recovered, 8 calls after 0019 |
| 0038 | Pressed `t482` "Apply": `succeeded`, `pageChanged:true`, **no `changed` list**. The dialog stayed open and the chip still read "Within 20 mi" (page view at 0038 and 0042 unchanged) | Extension/domain press-effect reporting | `domain/src/runtime/llm-evidence/node-run/run.ts` (no change reported only by leaving out `changed`), `node-run/press-effect/page-changes.ts` | **Interaction defect: a silent no-op press.** The fixture's Apply replaces itself on the first press after a change (`scenario-lab/.../local-classifieds/client/location-element.ts`, "the second press applies"). The model was not told nothing happened and went on as if the 10-mile filter held |
| 0046 | `target_covered` / `covered_by_layer`, `closeWith ["t481"]`: "press one of closeWith to close it, then make this same call again" | Extension covered check (correct) | `refusal.ts:webActionFailureRejectionCode` -> `tool-rejection.ts` `COVERED_NEXT_CLOSE` | **Not a detection defect.** `t294` (Item condition) really was under the location popover that 0038 failed to close. The text was actionable and the model followed it at 0047. But `closeWith` named only "Cancel", so pressing it **threw away the 10-mile radius** (0048: chip still "Within 20 mi") |
| 0060 | `dom-select t1412 "price_asc"` -> `target_unobserved` / `handle_wrong_kind_of_control`, `instead: ["web.handle.wrong_control","web.handle.wrong_control:target","target: {\"handle\": \"tN\"}","extractList: {\"handle\": \"extraction.N\"}"]`, with no `useNode` and no `next` | Domain page view + resolver + refusal text | `page-view/element/kind.ts` `ROLE_KINDS.listbox = "select"` (a `role=listbox` popup prints as `t1412 select` with `option` rows under it); `plan-resolution/control-fit.ts:actsOnTheWrongControl` (the select node needs `tagName === "select"`); `control-fit.ts:fittingNodeCode` (a listbox is not in `PRESSABLE_ROLES`, so no fitting node); `tool-rejection.ts:rejectionDetail` (no `next` sentence for this reason) | **Element-detection defect** (the page view's word invites a node the resolver refuses). The refusal is **non-actionable**: raw resolver codes only. The right move was to press `t1414` "Price: lowest first" |
| 0062, 0064, 0066 | `repeat_refused` x3 -> build ended: "it kept trying without getting any further" | Core loop (correct) | Core repeat guard | Ending. The model never learned what to do instead |

### How far it got and what ended it

It stayed in exploration, with no candidate submitted. Done: consent and
notification prompts dismissed, Bicycles category opened, list detected and
read, radius set but never applied (lost at 0038, then discarded at 0047),
three condition boxes checked (URL `itemCondition=new,used_like_new,used_good`),
and the Sort control opened. It ended on three refused repeats of the select
at 0060. The price filter was never reached.

## Run 2: job-board (`run-mv6qr7fk-77f30b49`)

Instruction: jobs with Rust in the title, fully remote and in the UK, yearly
salary starting at £70,000 or more, every page, each job once, leaving out
day-rate-only, upper-limit-only and no-salary postings. Columns are title,
company, salary as shown, and the job's own link, newest first.

### Why 65 calls and no Flow (answers brief question 3)

The premise is wrong: it was not a stalled exploration. Exploration was
efficient: steps 0002-0028, 14 calls, three pages read. It submitted at
0029 and spent the remaining ~50 calls in the trial-and-repair loop:

| Revision (step) | Trial | What the judges said / what actually failed |
| --- | --- | --- |
| 1 (0030) | refused `evidence_completion_parameters_unresolved` (`recordOutput` written as bare `columns`/`process` keys) | Model shape error. The refusal text was actionable and fixed in one try |
| 2 (0032) | refused `record_output.replace_in_repeat` | Actionable, fixed in one try |
| 3 (0036) | no, 8 rows | `salary atLeast 70000` dropped "£72k – £80k per annum"; `contains "Rust"` kept "Trust & Safety Engineer"; "Up to £95,000" kept; sponsored `pagead/clk` link kept |
| 4 (0052) | no | Regex experiments on salary |
| 5 (0058) | no, 7 rows | Both judges: "not newest-first" and "posted is not among output columns". **False**: the sample they quote is Today, 3, 4, 5, 6, ..., 13 days, which is newest first. Core sorts relative dates as dates (`contracts/src/record-sets/process/read-date.ts`). The model then added an unrequested `posted` column (rev 6 on), which breaks the requested four columns |
| 6 (0064) | unsure (judges split) | - |
| 7 (0074) | no, 6 rows | **Closest to passing**: `\bRust\b`, Remote (UK), `(a year\|per annum)`, not `(a day\|Up to)`, `atLeast 70000`. The only real miss was "£72k – £80k" (judges plus Core's `checked`). The judges also repeated the false sort claim |
| 8, 9 (0080, 0089) | no; 0087 judge truncated (`llm.provider_output_truncated`, 8192 tokens of repeated sentences), re-judged at 0089 | Regexes standing in for a lower-bound check matched the upper bound of ranges. Judge 2 at 0089 said `\bRust\b` "misses Rust inside parentheses" and that the Principal Engineer row was missing. **False**: Core's `checked` refuted it ("Principal Engineer ... is in the result") |
| 10, 11 (0095, 0103) | no | The model followed the false judge and went back to `matches "Rust"`, which brought "Trust & Safety" back (a bare pattern is case-insensitive, `condition-match.ts:webAutomationExtractConditionPattern`) |
| 11 again (0107) | `candidate.unchanged_after_no`, then `repeat_refused` (0109) | Model resent the same script |
| 12 (0111) | accepted, never tested | Call limit reached (45 + 19 + 1 = 65) |

What ended it: "it reached the limit on how many times it may ask the model",
with 10 test runs and the last one judged no. Judge calls count against the
same budget: each repair round costs about four calls (submit decision, test
decision, two judges).

### Refusals and failures, by layer

| Step | Quoted | Layer | File:function | Kind |
| --- | --- | --- | --- | --- |
| 0010 | `already_answered` (detect asked twice) | Core loop (correct) | - | Model redundancy. 0013 and 0027 also recalled rows it already held. 3 calls wasted |
| 0030, 0032 | plan refusals above | Core / domain plan checks (correct, actionable) | - | Model shape errors |
| all trials | `salary atLeast 70000` rejects "£72k – £80k per annum" | Domain read conditions **and** Core processing (kept in parity) | `domain/src/actions/extraction/condition-match.ts:webAutomationExtractConditionNumber`; Core `packages/contracts/src/record-sets/process/read-number.ts:readAutomationStudioRecordNumber` (the first number with no magnitude suffix: "£72k" -> 72) | **Value-reading defect**: the root miss in every trial |
| 0036+ | `contains/matches "Rust"` keeps "Trust & Safety Engineer" | Domain (by design: case-insensitive substring) | `condition-match.ts` `TEXT_HOLDS.contains`, `webAutomationExtractConditionPattern` (flag `i`) | Model choice. The trial account does not say *why* a kept row matched |
| 0058, 0074, 0080, 0103 | Judges: "sort on posted string is not newest-first" | Core trial judge | Core loop-verification judge prompt and evidence | **Judge error**: Core's sort reads "Today" and "Posted N days ago" as dates; the judges are not shown that |
| 0089 | Judge: `\bRust\b` "misses Rust inside parentheses" | Core trial judge | - | **Judge error**. Core's `checked` refuted part of it; the model still followed it |
| 0087 | `llm.provider_output_truncated` (finish `length`, 8192 out, repeating text) | Provider degeneration; no `max_tokens` was sent (request carries only temperature, thinking and response_format) | Core judge call | Cost one test decision and a re-judge |
| 0107, 0109 | `candidate.unchanged_after_no`, `repeat_refused` | Core loop (correct) | - | Model resent an unchanged script |

There were no element-detection or interaction defects in this run. Every
click, type, page-to-page move and list read succeeded. The run failed on how
values are read and how trials are judged.

## Proposed general fixes, ranked by failures removed

1. **Read a magnitude suffix on the first number** ("72k" -> 72000,
   "1.2m" -> 1,200,000; also `K`/`M`, and "thousand"/"million" written out),
   in `condition-match.ts:webAutomationExtractConditionNumber` and Core's
   `read-number.ts` together, through the shared parity table
   `value-reading-cases.ts`. Domain plus Core, cross-repo. Removes the miss
   in all 9 job-board trials: revision 7 would very likely have passed the
   salary checks. Not covered by t507 or t509.
2. **A press that leaves its own dialog open with no visible change says
   so, and is pressed once more when it is not a lasting act.** Write one
   sentence beside `changed`, for example "Nothing visible changed: the
   dialog t467 this control is in is still open". Retry once under the
   every-node-retries rule. Files: `node-run/run.ts` and
   `press-effect/page-changes.ts` in the domain; the extension's click verb if
   the retry lives there. Removes 0038 (the silent filter loss) and with it
   the 0046 refusal and the radius thrown away by Cancel at 0047. Not t507:
   0046 was a correct refusal; the defect is the unnoticed no-op before it.
3. **A select that names an option by its visible label works, or is told
   exactly how to name it.** (a) In `select.ts:findOption`, when a `value`
   matches no option value but exactly one option's normalized label, choose
   that option. This is unambiguous, so it is deterministic. (b) Give
   `OPTION_NOT_OFFERED` a closed reason (`option_not_offered`) and a `next`
   sentence in `refusal.ts` and `tool-rejection.ts`: "the page view lists
   this select's options by label; send the label through `option`, or the
   value describe_element shows". Removes 0020, 0030 and 0032 plus the
   repeats at 0022 and 0024: 5 refusals, about 8 calls. Partial t509 overlap
   only if t509's scope includes the `output_not_observed` path. Its branch
   name, `select-target-observed`, suggests the `target_unobserved` path (0060).
4. **A `role=listbox` popup is chosen by pressing its option.** Either print
   it as a listbox, not `select`, in `page-view/element/kind.ts`, or have the
   `handle_wrong_kind_of_control` refusal for a listbox carry
   `useNode: web.output.dom-click` and a `next` sentence saying "press the
   option row inside it" (`control-fit.ts:fittingNodeCode`, and
   `tool-rejection.ts:rejectionDetail`, which has no `next` for this reason
   today). Removes 0060 plus 0062, 0064 and 0066, which is **what ended
   local-classifieds**. **Covered by t509** if it is scoped as the branch name
   suggests. Make sure it also replaces the raw `instead` codes with wording.
5. **Ground the trial judges in Core's own record of how values were read.**
   Show each sort key's reading (for example "posted read as dates, 7 of 7")
   and, for a numeric bound, the number read from each value it rejected (for
   example `"£72k – £80k per annum" read as 72`). Extend `checked` to test a
   judge's claim about order, or about a condition missing a named row,
   against the stored rows. Core. Removes the false sort claims at 0058,
   0074, 0080 and 0103, the false regex claim at 0089 behind the
   revision 10/11 regression, and the unrequested `posted` column. It would
   also have shown the £72k cause at 0036 instead of 0074. Not t507 or t509.
6. **The trial account says why a kept row matched a text condition when
   the match fell inside a longer word** (for example "kept 'Trust & Safety
   Engineer': 'rust' inside 'Trust'"). Domain read account. Removes the
   "Trust" row that came back in revisions 3, 4, 10 and 11. Not t507 or t509.
7. **`closeWith` on a covering dialog that holds a changed field also names
   its confirm control, and says that Cancel throws the change away.**
   `tool-rejection.ts` `COVERED_NEXT_CLOSE`, plus the covered check that picks
   `closeWith`. Removes the radius thrown away at 0047. This could be part of
   **t507** if t507 touches how a covered refusal names the dialog's controls.
   Otherwise it is separate.
8. Lower priority: judge calls share the build's 65-call budget, so each
   repair round costs about four calls. Consider budgeting judges apart, or
   retrying a truncated judge (0087) without a model decision.

## Commands run and observed results

- `python -I dump.py <steps>` (scratch script) over both runs: printed every
  step's meta, call and result, with the page text elided, plus page views
  read where needed (local-classifieds 0018, 0020, 0036, 0038, 0042, 0058).
- `subs.py` (scratch) over job-board steps 0039-0111: every submitted
  script's `where`/`process` lines, each trial's `said`/`observed`/`checked`
  text, and every judge reply.
- Read: `select.ts`, `refusal.ts`, `tool-rejection.ts`, `control-fit.ts`,
  `resolve-plan-node.ts` (lines 600-640), `page-view/element/kind.ts`,
  `state-tokens.ts`, `run.ts` (lines 455-490) and `outcome.ts` in `fxwork/t262`;
  `condition-match.ts` in `fxwork/t342`; Core `read-number.ts`, `read-date.ts`
  (grep) and `condition-holds.ts` (grep) at `fxwork/!FluxIQ` `fbd06c77`; the
  fixture `location-element.ts`.
- Step counts: job-board 45 decide, 19 judge and 1 chat folders (65 in all);
  0087 `meta.json` shows `finishReason: length`, 8192 output tokens.
- `git branch --list "*t507*" "*t509*"`: `task/t507-dialog-control-not-covered`
  and `task/t509-select-target-observed`, both with no commits past `dev`.

## Not verified

- What t507 and t509 actually cover: both branches have no commits yet, so
  the overlap is read from their names and the brief.
- Whether the 0046 cover is geometrically right. I relied on the extension's
  `coveredBy=["t281"]` and the popover's absolute position; I did not look at
  a screenshot.
- The judge's claim at 0095 that "Halvard £70,000 – £80,000" was left out by
  `atLeast 70000`. The reader returns 70000 for that value, so the claim is
  probably wrong (the row was more likely dropped by location), but I did not
  trace that row.
- Whether rank 1 alone would have passed revision 7: the sponsored
  `pagead/clk` duplicate link was also flagged at 0036 and never fixed.
- How the 65-call cap is configured: inferred from the counts and the
  ending message.

## Open questions or contradictions found

- The brief says job-board ended with "no submit". It submitted 12 revisions
  and ran 10 trials.
- The brief lists 0046 `target_covered` as a t507 case. The control was not
  inside a dialog: it was really under the location popover that the no-op
  Apply at 0038 left open, and the refusal was correct and actionable.
- The brief says classifieds ended on `target_unobserved` at 0060. More
  precisely, it ended on the third `repeat_refused` (0066) of that call; the
  0060 refusal gave the model nothing to change.
