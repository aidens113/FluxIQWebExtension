# t1037 (W3) replay: framework drafting over five recorded runs

## Outcome
Done. `automationStudioFlowDraftCompose` ran on all five `t1015-bigbox` runs without error and was idempotent on each (composing its own output gave the same steps). Outputs are in `test-runs/t1037/` (ignored).

## How it was run
- Script: `test-runs/t1037/replay.mts`. Command, from that directory: `node --experimental-transform-types --no-warnings replay.mts judge` (and `... addr`).
- Plain `node` type stripping failed: `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX: TypeScript parameter property is not supported in strip-only mode` somewhere in Core's import graph. Adding `--experimental-transform-types` loads Core's `draft/compose/index.ts` and `draft/entry.ts` directly. Vitest was not needed.
- Input per run: the last decide request that holds a `core.flow_draft` entry (the text block starting `,{"callId":"core.flow_draft"`). Runs 2 to 5 ended mid-request, so their last decide has no `response.json`; the token ratio is calibrated on the latest earlier decide that has one (noted per run below).

### How `AutomationStudioFlowDraftStep[]` is rebuilt (approximations)
- `position`, `actionId`, `input`, `words` (from `does`), `callId`, `resultCode`: from the entry. Every step gets `disposition: "taken"`, so the framework decides all of them.
- `effect`: `observe` for the entry's look steps and for `dom-extract_list`; `mutate` for everything else.
- `effectApplied`: the entry's `changed` yes/no. `proposes`: false for looks; for `extract_list`, true only when `changed` is yes; unset for acts.
- `reads`: the extract's `extractList.handle` (`extraction.N`). I take this to name "one list" across pages, which is an assumption; the real host code is not in the recordings.
- `changed` (acts only): parsed from the result's `changed` strings (`tNN "words" appeared|gone`); "and N more" lines are skipped. `toggle` (dom-check only): key is the result's `control` words, `to` is `checked === false ? off : on`. No `chosen`, `acts`, `interruption`, `routing`.
- `stateBefore`/`stateAfter`: an approximation. Variant `judge` (the default) hashes the page address plus the run_node result's `judgeState` (its controls snapshot) and updates it only after `web.output.*` calls; looks keep the current value. Variant `addr` uses the address alone. Both gave identical drafting on all five runs.
- Result read: no `isAskedTable` (the acts/columns contract is not in the recordings), so the last worked read plus other reads of the same `reads` code is the result, per `result-reads.ts`.
- Tool files are matched by `callId` (`initial.core.run_node` is shared by the first call of each decision and matched in order; looks answered without a tool step have no file).

## Side by side (model Flow = `inResult: true` in the recorded entry; framework = `drafted: "in"`)

| Run | Steps | Model Flow | Framework Flow | In model not framework | In framework not model |
|---|---|---|---|---|---|
| mwus396e | 28 | 5 | 5 | none | none |
| mwuuo3zk | 99 | 5 | 8 | none | 31 read (model: exploratory), 33 filter "4 & up", 35 next page (both only taken) |
| mwuxd2v9 | 47 | 7 | 8 | 3 read | 15 press cart, 46 read |
| mwv5m906 | 44 | 6 | 6 | 38 read | 37 read (model: exploratory) |
| mwveg5ls | 71 | 12 | 18 | 3 read, 58 read | 10, 12, 14, 16 reads; 15 next page; 25 read; 34 View cart; 56 read |

Full per-step tables, in order with action and target words, are in `test-runs/t1037/replay.judge.md`. The Flows of runs 1 and 4 are identical in order apart from the 37/38 swap below.

### Left out, count per reason (all five runs, `judge` variant)

| Run | look | did_not_work | not_the_result | dead_end | repeat | undone | replaced |
|---|---|---|---|---|---|---|---|
| mwus396e | 21 | 0 | 1 (4) | 1 (19) | 0 | 0 | 0 |
| mwuuo3zk | 87 | 1 (2) | 1 (12) | 1 (36) | 1 (68) | 0 | 0 |
| mwuxd2v9 | 38 | 0 | 1 (3) | 0 | 0 | 0 | 0 |
| mwv5m906 | 37 | 0 | 0 | 0 | 1 (38) | 0 | 0 |
| mwveg5ls | 44 | 2 (8, 33) | 2 (3, 57) | 0 | 5 (7, 58, 59, 60, 61) | 0 | 0 |

Step numbers are in brackets. Looks are all detect/find/describe/snapshot/recall. `undone` never fired (no press pairs in these runs; `toggle` is only approximated). `replaced` cannot occur (no rerun replacement in a `taken` rebuild).

## Token and decision tables

Chars are the JSON of the entry's `value.steps`; "whole" adds the instruction, which in these recordings is sent once in the head, so steps-only is the per-request comparison. Tokens use the ratio from the run's own recorded input tokens over its request chars: 0.425 (mwus396e, decide 0087), 0.414 (mwuuo3zk, decide 0312), 0.491 (mwuxd2v9, 0219), 0.425 (mwv5m906, 0160), 0.477 (mwveg5ls, 0292).

| Run | recorded steps chars | old rebuilt (authored:true) steps chars / tokens | new (framework) steps chars / tokens | delta |
|---|---|---|---|---|
| mwus396e | 9518 | 8971 / 3812 | 9282 / 3944 | +3.5% |
| mwuuo3zk | 27286 | 27167 / 11260 | 28360 / 11754 | +4.4% |
| mwuxd2v9 | 13647 | 13033 / 6403 | 13548 / 6656 | +4.0% |
| mwv5m906 | 12429 | 11840 / 5027 | 12330 / 5235 | +4.1% |
| mwveg5ls | 23174 | 22471 / 10714 | 23194 / 11059 | +3.2% |

(The "old rebuilt" figure is below the recorded one because the rebuild lacks `act`, `out`, `runs`, `landed` and other fields the live run added.) Whole-entry chars, old authored vs new framework: 12848 vs 9895, 31044 vs 28973, 16910 vs 14161, 15717 vs 12943, 26348 vs 23807; this gap is the long authored instruction against the short framework one, which does not apply while the guide is sent once.

So the entry does not shrink: each left-out step now shows `out: <reason>` and every look is still listed, which costs about 3 to 4% more per request. The saving is in decisions, not entry size.

| Run | amend_draft decisions | amend_draft answers (applied / partly / refused) | `add: true` occurrences in decisions |
|---|---|---|---|
| mwus396e | 3 | 2 / 0 / 1 | 3 |
| mwuuo3zk | 6 | 3 / 1 / 2 | 5 |
| mwuxd2v9 | 4 | 1 / 0 / 3 | 5 |
| mwv5m906 | 18 | 4 / 1 / 13 | 5 |
| mwveg5ls | 13 | 4 / 0 / 9 | 13 |
| Total | 44 | 14 / 2 / 28 | 31 |

The totals match the audit's 44 amend_draft decisions, 28 refused. Counts come from `decide/decision.json` of kind amend_draft, the `*-answer-amend_draft/meta.json` verdicts, and any `add: true` found anywhere in a decision. Framework drafting makes the `add` ones (31, a no-op under the new design) and the refused ones unnecessary; any amend that exists only to add a step that worked is also unneeded. Remaining edits (repeat, bind, result, drop) are not counted separately here.

## Judgement per run: does the framework draft hold every act that landed and the result read the run needed?

1. **mwus396e: yes, matches the model's Flow exactly.** Step 4 (an earlier read of a different list) went out as `not_the_result`; step 19 (a third Next page after a loop already covered it) as `dead_end`. No misjudgement.
2. **mwuuo3zk: all landed acts are in, and it has a read the model's Flow lacked.** The model's Flow ends at the Pickup filter (27) with no read at all (its reads were failed, dropped or exploratory). The framework adds read 31 as the result. Questionable: 31 comes before 33 (rating filter) and 35 (next page), so the result read is of the list before those filters; this is the "last worked read" rule when the final reads failed (96 to 99, all `did_not_work`). Step 36, a second Next page that did not move the address, correctly went out as `dead_end`; 68, the same "4 & up" press again, as `repeat`. Step 2, a failed navigation, as `did_not_work`.
3. **mwuxd2v9: all acts in (store, Add, cart click).** Reads: framework keeps 10, 14 and 46 (all `extraction.4`) and drops 3 (a different list, `extraction.1`); the model kept 3, 10, 14. I could not tell from the recording whether 46 holds cart rows: its result location is the scenario root, not `/cart`. If 46 is a root page read, the framework ends on a read the task did not need; if it is the cart, it has the read the model's Flow missed.
4. **mwv5m906: equal in substance.** Framework keeps 37 and drops 38 as `repeat`; the model did the reverse (37 exploratory, 38 kept). Same list handle, same fields, nothing changed between them, so the first copy staying is by design. Step 6 (the pre-add read of `extraction.3`) is in both Flows.
5. **mwveg5ls: all landed acts in (type, sort, Set as my store, product click, Add to cart, View cart); result is questionable.**
   - The framework Flow lists the paging unrolled: reads 6, 10, 12, 14, 16 and Next page 11, 13, 15 (the model had one read and two Next page presses, then the `repeat` edit). Correct per the rules (each is a step that worked, and Next page changed state between them), but it is the work the model's `repeat` edit is for.
   - Step 58 (name, price, rating plus one more field) was dropped as `repeat` of 56 (name, url, price plus two): same `extraction.3` handle, nothing changed between, though the fields differ. If the real host `reads` code is per list as I approximated, the second-copy rule cannot tell two reads of one list with different fields apart and keeps the first, which here has the wrong columns. This is the one step I would call a probable misjudgement. I could not check the host's real `reads` code.
   - Step 34 (View cart) is in the Flow but the following reads (56 to 61) all read the search page 3 list, so the cart read the run needed never happened in any form; neither Flow has it. The framework's result read (56) and the model's (58) are both a search-list read.

### Misjudgements and risks found (not tuned to)
- Second-copy rule: reads with different fields on one list are treated as copies (mwveg5ls 58).
- "Last worked read" result rule: when later reads fail, the result read can precede acts the Flow still contains (mwuuo3zk 31 before 33/35).
- No misjudgement of an act: every `mutate` step that landed and was not a detour or repeat is in.
- Entry size: no reduction in the steps list (+3 to 4%).
- Unexercised: `undone` (no toggle pairs), `replaced`, model-owned steps (all rebuilt as `taken`).

## Commands run and observed results
- `node load.mts` (plain node): ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX (parameter property). With `--experimental-transform-types`: imports load.
- `node --experimental-transform-types --no-warnings replay.mts judge` and `... addr`: exit 0, five runs each, `compose idempotent: true` on all. `cmp.mts` shows judge vs addr differences: none on all five.
- Outputs: `test-runs/t1037/replay.judge.md`, `replay.addr.md`, `replay.*.summary.json`, `run-*.{judge,addr}.composed.json`, `out.*.txt`. Helpers: `insp.mts` (step inspector), `cmp.mts`.

## Not verified
- Real `stateBefore`/`stateAfter` digests and `reads` codes (the host's); `toggle` and `changed` are parsed from result text; `isAskedTable`, `result`, `acts` not available, so result-read choice uses the fallback.
- Whether mwuxd2v9 step 46 holds the cart rows.
- Token figures are estimates from a per-request char ratio; the rebuilt "old" entry lacks fields the live entry had.
- Final correctness of any Flow against its oracle; nothing was run live.

## Open questions or contradictions
- Should the second-copy rule (or `reads`) take the read's field set into account? Does the real host `reads` code do so?
- Should the result read be required to follow the last act that changed the list it reads?
