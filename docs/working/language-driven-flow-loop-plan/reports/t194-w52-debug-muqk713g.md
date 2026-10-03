# t194-w52: debug of run-muqk713g-d08ad3dc (earbuds, lane C)

## Outcome

Done. `docs/working/language-driven-flow-loop-plan/debugs/run-muqk713g-d08ad3dc.md` is written, with every template
field filled or marked `NO EVIDENCE:`, Stage 1 copied verbatim from `reports/t194-lead-1002L.md`, and the six
questions answered with step folders and quoted fields.

## What changed and why

- New file `debugs/run-muqk713g-d08ad3dc.md`: the debug the Lab needs before lane C's next live run.
- New file `reports/t194-w52-debug-muqk713g.md`: this report.
- No code edited, nothing run live, no provider called, no commits.

Findings that correct what the lead had seen:

1. **Order.** The saved Flow ran at 06:11:05-06:11:37, between 0033 and 0034, not after 0063. 0034/0035 judged that
   run; 0036-0063 are one re-author attempt in two rounds; 0064/0065 are the patch ladder after it.
2. **0033 is the instructed-consequences question** (`instructed: []`), not a completion after a "no".
3. **The build's judge said "yes" and its reply was refused.** 0032 returned `answersRequest: "yes"` with
   `changed: ""`. `R/llm/harness/provider-result.ts:124-127` refuses an empty diagnosis text, so the build test was
   unjudged and `phases.ts:313` finished the build "not verified" (chat screenshot 00013 shows
   `llm_output.invalid_diagnosis_text`). The build-test judge saw counts only, no rows.
4. **The repair could not have worked.** Every re-author rerun read results page 5 alone (1 page, 11 seen, kept 0,
   unfiltered). A Flow-seeded step has no `replay.from` (`R/llm/node-tools/draft-from-flow.ts:23`), so
   `step-place.ts:56-57` runs it in place. `core.log` shows `rerun.5` with no `.place` reset.
5. **`dedupes: false` was misleading.** A `next` read already drops a row repeated from an earlier page
   (`list-reader.ts:33-39`, `:584-587`): conditions kept 12 and 10 were stored, and the oracle found no duplicate.
   The judges, the brief and the diagnosis all rested on "It does not deduplicate" (`accounts.ts:96`).
6. Dedupe was set (`dedupe: "url"`) in 12 of the re-author's decisions and never reached the Flow, because the
   re-author never completed. No amendment changed the name condition. 0059-0063 dropped the Plus condition.

## Commands run and observed results

All reads were of artifacts and source. Nothing was executed against the product.

- Python dumps of every `steps/NNNN-*/meta.json`, `decision.json`, `call.json` and `result.json` (scripts in my
  scratchpad, `w52dump.py`). Observed: 65 step folders; 35 with `costUsd`; sum $0.121156656. `entry.json`
  `costUsd: 0.12085128` = sum minus 0001 ($0.000305376).
- `logs/core.log`: two `loop start` lines after the build (06:11:44, 06:12:06). `tool start callId=rerun.5` at
  06:11:48.816 and 06:12:15.671 had no reset before them.
- Bundle `snapshots/decision-trace.json`: `resultReauthor.attempts[0]` 17 decisions, 11 tool calls,
  `flow_bootstrap.not_doable`, cost $0.061567, and `changes_nothing` refusals at iterations 6-8 and 15-17.
- Bundle `snapshots/extraction-mismatches.json`: 13 expected, 10 observed, 7 matched in place, 10 in any order. The
  missing rows were at 0-based positions 7, 8 and 10.
- `diff` of 0034 vs 0035 `request.txt`: identical.
- `git merge-base --is-ancestor` on Core: `5ba54a0a` (step-place) is in run commit `eed0cc34`. `7c108850`,
  `b17525d9`, `925a4439`, `6be39730`, `a48d28c8`, `5c9cfb51` and `9549a34a` are not.
- `git log -- provider-result.ts`: last change 2026-09-30, so the empty-text refusal is unchanged on dev.
- Screenshots viewed: 00003, 00008, 00012, 00013, 00016, 00017, 00019, 00024.

## Not verified

- Which uncommitted changes the run's trees held. `run.json` says only `dirty: true`. Some dirty work was present:
  the replay account in 0031 and the round-1 opening look.
- Whether dev's round rule (`phases.ts:387`) would actually have stopped after round 0. It needs the round's stop to
  be `repeat_without_progress`, and the trace records no stop word.
- Whether s2/s3 pressed anything in the saved Flow's run. Both report `succeeded` with
  `unresolved_no_candidates`.
- The UI on dev after t193/t242. No live run was made.
- The stored rows of the saved Flow's run at positions 1-7. They were inferred from 0024's read with the same
  parameters, plus the oracle's "7 matched in place".
- I did not locate the writers of `evaluation.json` `llm.calls` or of `run.json` `repositories`.

## Open questions or contradictions found

- Stage 1 (lead's) says columns "price (number), rating (number)" and lists "price as a string with `$`" as a wrong
  answer. The fixture expects strings `$26.99` / `4.2` (`earbud-records.ts:11-12`), and the oracle matched 40/40
  with `$` strings. Either the Stage 1 text or the fixture needs to change.
- The brief says 0035 claims "the read has dedupes:false and that kept rows ... are accessories". It does, but 0035's
  reading never reached the repair: the first call's judgement stands (`agreement.ts:65-70`).
- The brief's "repair round 0036-0063 ... then the saved Flow's run: 0064" has the order reversed (see finding 1).

## Causes (one line each)

| # | Cause | On dev now? |
| --- | --- | --- |
| C1 | `main.s5` name rule `not contains "charging case"` removed 3 asked pairs; the explorer saw them in `rowsAlone` (0019-0025) and kept it | No |
| C2 | Build-test judge's "yes" refused whole for `changed: ""` (`provider-result.ts:124-127`); build finished unverified (`phases.ts:313`) | No |
| C3 | Build-test judge sees a replayed read as counts only (`replay-answer.ts:168-189`) | No |
| C4 | Read account says "does not deduplicate" for a `next` read that drops page repeats; repeats are not counted; `dedupe: "url"` would read false too (`accounts.ts:96`) | No |
| C5 | Result judge 0035 read `removedByItself` rows as kept and pairs-with-case as accessories | Partly (`leftOutOnlyByThis` + instruction, `diagnosis-instructions.ts:43`) |
| C6 | Re-author reruns of the Flow-seeded read ran in place on page 5: seed has no `replay.from` (`draft-from-flow.ts:23`, `step-place.ts:56-57`) | No |
| C7 | Re-author brief steered to dedupe/maxPages (0034's advice, `counts_look_right`); name condition never touched | Partly (follows C4/C5) |
| C8 | Re-author round 1 opened after round 0 ended on refused repeats, Flow unchanged ($0.030) | Yes, `phases.ts:387` (t240), if stop was `repeat_without_progress` |
| C9 | Patch ladder ran after an exploring re-author (0064/0065, $0.009, false `control_gone`) | Yes, `ladder-skip.ts:48` (t195) |
| C10 | Chat shows raw codes/node ids, "Flow ready" beside "not verified", remembered steps as "Didn't work", count-less read cards | Not verified |
