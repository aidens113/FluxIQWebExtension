# Week review: causes from the run debugs of 2026-09-29 and 2026-09-30

Worker `week-review-causes-early`, 2026-10-06. Read-only; this file is the only write.

## Outcome

Done. Every debug the brief's `git log` command names (104 files, all present on `dev`) was read at its
cause table and conclusion, the causes merged into one table, and each cause checked against `git log dev`
in both repositories.

- **449 runs** are covered: 103 run debugs with causes, plus one stub
  (`t195-slot-4-balance-failures-2026-09-30.md`) that stands for **346 runs with no causes**. Those
  are the relaunch loop's empty-balance runs on `t195-slot-4`, 12:21Z to 17:22Z on 09-30, all
  `bigbox-retail-pickup-order`, $0 each, none past the first provider call.
- Of the 103 debugged runs, **37 were also launched by the unattended relaunch loop** and debugged
  after the fact: 22 by the t193 lead (`bigbox-retail-pickup-cart-redesigned-after-creation`, t193
  runs 10-32) and 15 by t195 workers w17b/w17c (`bigbox-retail-pickup-order`). Those debugs do have
  causes, and they are counted in the table.
- **Not one debugged run passed.** Twelve runs that the Lab scored `passed` were really
  `stopped_for_permission` with no Flow (row 30).
- **Spend:** the run headers state a cost for 97 of the 103 runs, $7.16 in all. The other six
  (`munaiz76`, `muncqlr0`, `munda7ub`, `mune0xh1`, `munojusu`, `munq51ik`) record no accounting or
  give no figure. The `numbers` brief owns the authoritative totals; this figure comes from the debug
  headers only.

### Top causes by runs affected (debugged runs; the 346 stubs excluded)

1. **Mid-build dry runs replayed the whole draft from a reset start page**, and the reset kept the
   site's state (consent, store, cart). That made steps `unreproducible`, repeated real acts, and cost
   minutes. **68 runs.** Fixed in Core `77b269a2`.
2. **The loop let the model burn decisions without progress.** Refused or identical completions,
   no-op amendments, already-answered requests, and the build ending at the call bound while a way
   remained. **36 runs.** Partly fixed: `4fa139fc`, Core `c11fac90`, `b185244f`. Round 2 on 10-05 still
   looped (lane A), per Current State.
3. **The model was not shown the controls it needed.** The 40-control packet cap,
   `handle_not_in_packet`, and recovery packets truncated at 6,000 B. **34 runs.** Fixed in Core
   `711eab8c` and downstream `b507d5fa` (t200), plus F13 `040d7c2b`. Close behind it is the 4,000-byte
   draft cap that cut the instruction to 177 B (**33 runs**, same t200 fix).

By runs alone, the **unattended relaunch loop** (agent process) dwarfs every product cause: 383 runs (346
stubs plus 37 debugged runs, $3.19 on the debugged ones). It is fixed by the Lab guards `5363e39b`.

## What changed and why

Added this report, as the brief asks. Nothing else was edited.

## Cause table

How to read the table:

- **Run ids** are the short form `run-<id>` without the `run-` prefix and the hash suffix. For
  example, `munaiz76` is `run-munaiz76-7026748c`. Every debug is at
  `docs/working/language-driven-flow-loop-plan/debugs/<full id>.md`; those files are the evidence paths.
- **Runs counted:** a run counts for a cause when its debug's cause section names that cause. I matched
  keywords and then checked the lists by hand. A few borderline matches may remain, so treat each count
  as ±2.
- **$:** the summed spend of the runs that show the cause, from the debug headers. The causes overlap,
  so the dollar figures do not add up to the total.
- **Commits:** prefixed `W` (this repository) or `C` (Core). Every commit cited was confirmed on `dev`
  with `git merge-base --is-ancestor` or found in `git log dev`.
- **Status:** `fixed` means a commit on `dev` addresses the cause. A cause fixed only by a lane's
  "WIP … unvalidated" shutdown commit, or with no live proof in these debugs, is marked `partly`.

| # | Cause in plain words | Theme | Runs affected | $ (runs' spend) | Status and evidence |
| --- | --- | --- | --- | --- | --- |
| 1 | Each completion's dry run reset to the start page and replayed the whole draft mid-build. The reset kept consent, store and cart state, so steps came back `unreproducible`, real acts (cart lines, a save) were repeated, and 30-400 s per build went to dry runs. | loop bookkeeping and guards | 68: munaiz76 munoa86g munore4o munovwp3 munpwa5r munri5gr muntc23v muntmwvx muntufao munu4b4y munuks76 munutuvf munuxns5 munv9eqy munvmg0n munvvc3z munvz5x0 munw16g4 munw3g8n munwdqey munwdydi munwmfrs munwq8zd munwwkwq muny5y17 muny76m9 munymcpf munyqgjr munyt4jo munyzo8z munz227o munzbfbj munzfk33 munzihwx munzl2eh munzpdlu munzrj6r munzutb0 munzz9j1 muo00owc muo06beo muo07nnh muo0dyu5 muo0g1ky muo0ks69 muo0qepn muo0r9fk muo0wf2q muo0zggr muo12lnk muo18781 muo1ch23 muo1dxrj muo1la5v muo1ni63 muo1rxmv muo1w558 muo1z05y muo20xvx muo2690x muo2825e muo2b224 muo2fscr muo2gyob muog33va muogfred muogweml muohbi3e | ~$5.9 | **fixed** C `77b269a2` (09-30, t196: "Replays of the draft happen only in judgement and repair, and a lasting step is checked, not rerun"). The reset-keeps-state half still applies to judged test runs; see Not verified. Example evidence: `run-munvvc3z-3eadc185.md`, causes 4-5. |
| 2 | Dry runs ran on a completion the act check had already refused, or on an unchanged draft. Separately, a completion was accepted with no dry run of its final revision, or with a dry run still failing. | judges and verification | 11: munsxchc muntcsge muntmwvx muntu7in muntufao munv9eqy munvvc3z munw3g8n munwmt25 munwq8zd munwwkwq | $0.83 | **fixed** C `05266957` (09-30, "the dry run stops re-replaying an unchanged draft"), then superseded by `77b269a2` |
| 3 | The loop spent decisions without progress. It accepted repeated refused or identical completions, no-op and already-out amendments, and already-answered requests. Reruns and reads that changed nothing counted as progress. The build ended at its call bound while a way remained, or with budget left and no correction path. | loop bookkeeping and guards | 36: muncqlr0 munmmj5n munneauy munnop9n munnq7vz munoa86g munore4o munpjclw munpwa5r munq51ik munri5gr munsxchc muntcsge muntfume muntmwvx muntu7in muntufao munu4b4y munuks76 munutuvf munv9eqy munvqvf5 munvvc3z munw16g4 munw3g8n munwdqey munwq8zd munwwkwq munz227o muo0g1ky muo0r9fk muo1ni63 muo1w558 muoga8at muogweml muohbi3e | ~$2.9 | **partly**. Fixes: W `4fa139fc` (09-29, amendments that change nothing), C `b185244f` (09-30, progress means the Flow advanced), C `c11fac90` (10-01, one general repeat guard), W `c2c10243` (refused re-amendments count toward the stall). Still recurring 10-05: lane A round 2 looped nine rounds on a refused amendment (Current State). |
| 4 | The page packet capped what the model saw at 40 controls. Result cards, sticky Add buttons and links were cut, so presses were refused `handle_not_in_packet`. A handle the model had just been shown was forgotten after a partial look. Recovery playback packets were truncated at 6,000 B. | list reading, extraction and detection | 34: muntmwvx munvvc3z munw3g8n munwdqey munwq8zd munwwkwq muny76m9 munymcpf munyqgjr munyt4jo munz227o munzfk33 munzl2eh munzpdlu munzutb0 munzz9j1 muo00owc muo06beo muo0g1ky muo0ks69 muo0wf2q muo12lnk muo18781 muo1dxrj muo1la5v muo1rxmv muo2690x muo2b224 muo2gyob muog33va muoga8at muogfred muogweml muohbi3e | ~$2.8 | **fixed** C `711eab8c` and W `b507d5fa` (09-30, t200: no element caps, no ranking, no byte budgets); shown-handle fix W `040d7c2b` (F13). In several runs the cap was named only as the likeliest reading. `run-muohbi3e-e5847e5a.md` cause 1 proves it (0 result cards in 40 of 293 elements). |
| 5 | The draft the model reads was capped at 4,000 B. The instruction was cut from about 1,050 to 177 B, and steps were shown without their inputs or not listed at all. An `extract_list` argument over 512 B was hidden. The model completed and amended blind. | model guidance/prompt | 33: muntc23v munuks76 munuxns5 munvmg0n munvqvf5 munvz5x0 munw3g8n munwdqey munwmfrs munwq8zd munwwkwq muny5y17 munyqgjr munz227o munzbfbj munzihwx munzrj6r munzz9j1 muo07nnh muo0g1ky muo0qepn muo0zggr muo1ch23 muo1ni63 muo1rxmv muo1z05y muo2825e muo2fscr muog33va muoga8at muogfred muogweml muohbi3e | ~$3.1 | **fixed** C `711eab8c` and C `b7305903` (09-30, "the last caps … instruction cuts … are gone"). Evidence: `run-muog33va-96469cb2.md` cause 7. |
| 6 | The draft was a transcript of every attempt, not an authored Flow. Refused presses, repeated searches and reads all became steps, giving 38-44 steps for an 11-step task. | loop bookkeeping and guards | 29: munuks76 munuxns5 munvmg0n munvqvf5 munvz5x0 munw3g8n munwdqey munwmfrs munwq8zd munwwkwq munyt4jo munyzo8z munzfk33 munzpdlu munzrj6r munzz9j1 muo07nnh muo0dyu5 muo0g1ky muo0r9fk muo0zggr muo1dxrj muo1la5v muo1w558 muo20xvx muo2b224 muogfred muogweml muohbi3e | ~$2.7 | **fixed** C `b185244f` (09-30, t196: "The model authors the draft, sees its instructed acts as a checklist") |
| 7 | The repair ladder could not fix a failed step. Its patch kinds (target override, wait-retry) could not add, move or dismiss a step. Patch replies failed validation and were not retried. "goal unachievable" ended repair. The patch call was offered kinds its plan refused. | judges and verification (repair) | 22: munnyvbr munoa86g munore4o munpwa5r muntmwvx munu4b4y munwdydi muny76m9 munymcpf munyt4jo munzl2eh munzpdlu munzutb0 muo00owc muo06beo muo0ks69 muo0wf2q muo12lnk muo18781 muo1dxrj muo2690x muo2gyob | ~$1.7 | **partly**: C `d6b50b5a` (09-30, "a failed step the ladder cannot fix is re-authored, applied and re-run; repair-ladder fixes", t193 C2/C3/C6/C9); C `424a70b3` (10-02, t249). No live proof in these debugs. |
| 8 | A click whose page reloaded or navigated (for example "Set as my store") answered `action_failed`/`target_not_found`. Because a refused step carries no replay, it was dropped from the Flow, and later steps ran on a page the Flow never reaches (the towels swatch clicked on the napkins page). | page state, routing and navigation | 23: munu4b4y muny76m9 munymcpf munyt4jo munyzo8z munzfk33 munzl2eh munzpdlu munzutb0 muo00owc muo06beo muo0dyu5 muo0ks69 muo0r9fk muo0wf2q muo12lnk muo18781 muo1dxrj muo1la5v muo20xvx muo2690x muo2b224 muo2gyob | ~$1.9 | **partly**. W `bd6a32d0` (merge `660e4429`, 09-30, t202: "A click that reloads its own page is applied, not dropped") covers the reload case. The broader case (a refused attempt that cleared a layer, `run-munu4b4y-4e15662e.md` cause 1) has no fix found; the nearest is C `6902f21e` (10-02, "a step joining the Flow keeps the whole way its page was reached"). |
| 9 | The diagnosis and repair context dropped the failed target, candidates, step parameters, flow graph and recent nodes to fit an 8,000-byte budget, so the patch author could not see what to fix. | judges and verification (repair) | 24: munnhi5q munnop9n munnyvbr munoa86g munpwa5r muntmwvx munu4b4y muny76m9 munymcpf munyt4jo munzl2eh munzpdlu munzutb0 muo00owc muo06beo muo0ks69 muo0wf2q muo12lnk muo18781 muo1dxrj muo1la5v muo2690x muo2b224 muo2gyob | ~$1.7 | **fixed** C `711eab8c` (09-30). Core `dev` `recovery/context.ts` header: "no byte budget, no per-section item limit and no trim ladder". |
| 10 | The extension UI misreported the build. It showed raw tool ids and codes, "Done" mid-build, a false "Add an AI model key: To do", "Build failed / Build failed", a permission stop shown as failure or "Flow ready", undercounted "Worked for" summaries (two for one build), no ask shown while parked, and no reason on failure. | extension UI | 27: munnop9n munnyvbr munoa86g munovwp3 munsxchc muntc23v muntfume muntu7in munuj2os munuxns5 munv53gt munvmg0n munvz5x0 munw7ffn munwmfrs muny5y17 munyqgjr munz227o munzrj6r muo0zggr muo1ch23 muo1ni63 muo1rxmv muo1z05y muo2825e muo2fscr muog33va | ~$2.3 | **partly**: W `1b2c6d79` and `1c48605b` (09-30, t191 defects 1-9, chat UI round 2), W `6e2e312f` (10-01, t227 chat display fixes), W `80bc6447` (10-05). UI items are still open in Current State (ending paragraph, overlay absent early, start-panel flash). |
| 11 | Nobody answered a permission ask in the Lab, so every declared-point run held about 120 s (a third of some builds) and then went on blind. | Lab, harness and infrastructure | 18: munovwp3 munuj2os muny5y17 munyqgjr munzbfbj munzihwx munzrj6r munzz9j1 muo07nnh muo0g1ky muo0qepn muo0zggr muo1ch23 muo1rxmv muo1z05y muo2825e muo2fscr muogfred | ~$1.6 | **fixed** W `068613f4` (09-30, "Lane D L1: the Lab plays the person at a permission ask, only at the task's declared point"; merge `d6d2c116`) |
| 12 | The instructed-acts completion check accepted Flows that do not do the act. It accepted navigation-only Flows, a chooser-opening click as the act, `create_new` claimed by no step, an `optional` failing step, a press refused for permission, and the removal of failing store steps to pass. It counted acts, not quantity, condition or routing. | judges and verification | 16: munmmj5n munnop9n munoa86g munoeac4 munore4o munovwp3 munpwa5r muntmwvx munu4b4y munuks76 munutuvf munvz5x0 munw7ffn munwdydi munwmt25 muogfred | ~$1.2 | **partly**: C `7f1bc8fd` (09-29, "instructed acts cannot be met by arrival alone or by one step for a plural act"), C `30f65794` (10-01, "completion check tries every act step"), C `4f78cadc` (10-01, "the completion check informs and the judge decides"). The design moved to the judge, so this is no longer a hard gate. |
| 13 | A covering layer blocked steps. Consent walls were not answered in playback, a corner card was missed by the seven fixed viewport probes, a coupon or "Val" card was never dismissed, and no layer was cleared when the target was absent. | page state, routing and navigation | 14: munaiz76 muncqlr0 munnyvbr munoa86g munore4o munpwa5r muntmwvx muntufao munu4b4y munuks76 munvvc3z munw3g8n munwq8zd muoga8at | ~$1.0 (2 unknown) | **partly**: W `f8135495` (09-29, "cookie walls declined"), W `d2f78a51` (10-01, "the interference defence spares its own target's layer"), W `1de5c3f8` (covered press names the popup's close controls). The corner-probe change is in W `c22646d0` (09-30, a lane D "WIP … unvalidated" shutdown commit, `interference/probe-points.ts`). |
| 14 | The build searched badly or wandered. It put the variant or every attribute in the search query, never saw the "no results" line, invented item addresses (one opened napkins for towels), pressed list positions or the wrong brand, and never reached the item. | model guidance/prompt | 14: munoa86g munovwp3 muntufao munuks76 munvqvf5 munvvc3z munwmt25 munwwkwq munyt4jo munzbfbj munzpdlu muo1dxrj muo2fscr muoga8at | ~$1.2 | **partly**: unshown addresses refused (`address_not_shown`, first in W `af5e553e`, a lane A WIP on 09-30); W `e7f9160d` (09-30, the page's short main-region lines, F10 "no results", reach the model); W `50f8f62f` (10-01, an empty find names the site's search fields). No fix found for the model's wandering itself. |
| 15 | A permission was classified wrongly. `move_money` was declared on "Continue to checkout"; an ask was raised for an unnamed control "(step)"; a derived instruction authority could silently permit `move_money`; the instructed consequences differed between runs of one instruction; a withdrawal was declared `modify_existing`; and a task had no declared permission point. | permissions and consequential acts | 12: munnyvbr munoa86g munovwp3 munu4b4y munuj2os munzbfbj munzihwx muo0qepn muo1z05y muo2825e muo2fscr muogfred | $0.82 | **partly**: C `05266957` (09-30, F10, "money, delete and send always ask"), W `f251b0a8` (09-30, every consequential task declares where the Lab answers), C `d9340ecd` (10-02, F42, "the consequence finding asks only about money, delete or send"). No fix found for asks on unnamed controls or for `move_money` on a checkout-entry press. |
| 16 | After a permission refusal the model kept pressing the refused control and claiming it as the act. The claim was refused `step_changed_nothing` (which did not say "needs a person"), so the build could not finish and spent to the ceiling. | permissions and consequential acts | 13: munuj2os muny5y17 munyqgjr munzbfbj munzihwx munzz9j1 muo07nnh muo0g1ky muo0zggr muo1ch23 muo1rxmv muo2825e muogfred | ~$1.1 | **partly**: C `b72fa8a1` / W `78d166f2` (10-01, "a declined permission ask no longer blocks later asks"), C `2a5ad68c` (10-01, "a person's no is a decline"), C `2da9ce41` (10-03, t195: "a build never does an instructed act twice"). No commit names `step_changed_nothing` for a parked press. |
| 17 | The build did a wrong lasting act while exploring. It pressed Confirm on a non-qualifying row (Tom Becker), withdrew a request it was told to leave, saved the wrong item for later, moved a cart line the instruction kept, and pressed Place order as a probe with fields empty. | permissions and consequential acts | 12: munnyvbr munq51ik munsxchc muntfume muntu7in muntufao munwdqey muo07nnh muo0qepn muo0zggr muo1z05y muog33va | ~$1.0 | **partly**: C `2da9ce41` (10-03, never an instructed act twice) and C `77b269a2` (lasting steps checked, not rerun). No guard found that refuses a consequential exploration press on a row the instruction excludes (open in `run-muog33va-96469cb2.md` cause 5). |
| 18 | Lab verdicts were wrong. The Lab scored a permission stop as `passed`, including a stop at an unnamed control. | Lab, harness and infrastructure | 12: muny5y17 munyqgjr munzbfbj munzrj6r munzz9j1 muo07nnh muo0g1ky muo0zggr muo1ch23 muo1rxmv muo2825e muo2fscr | ~$1.1 | **fixed** W `f2f80024` (09-30, "A build that stopped to ask permission is stopped_for_permission, never a pass"), W `54786f7e` (never a pass in campaign rows) |
| 19 | The run's call and cost accounting was wrong. Core ignored the Flow's configured `maxCalls` (48) and ran to 64; thrown builds reported 0 or 1 calls; a failed patch call was charged its 48k/8k reservation ($0.083); re-author calls were missing from `live-llm.json`. | budget, cost and purse | 10: munda7ub mune0xh1 munmmj5n munnop9n munnq7vz munoeac4 munpwa5r muntcsge muntufao munutuvf | ~$0.66 (2 unknown) | **fixed**: C `5dda8d2f` (09-29, "the Flow's call limit binds again"), W `8f764dbe` (09-30, "the Lab counts every call's spend"), C `1d9b199f` (10-01, "a paid but refused reply is charged its real cost"), C `ab781df8` (10-01, one purse per Flow creation) |
| 20 | Robot check or rate limit. The build kept acting on a challenge or 429 page; dry-run and re-author reruns tripped the store's 5-per-8-s limit; a reset onto the check said "could not be put back" rather than asking a person. | page state, routing and navigation | 11: munnhi5q munoeac4 munq51ik munq5s8x muntc23v muntcsge munv53gt munv9eqy munw16g4 munw3g8n muoga8at | ~$0.57 | **partly**: W `0faee6e6` (09-30, t197: "A robot check is never solved by FluxIQ … pauses and asks the person", merge `9047da89`), W `533baaf5` (10-01, a 429/503 landing is `rate_limited` and retryable). The per-origin pace (`background/page-pace/`) came only in the lane C WIP W `518e38fe` (09-30, "unvalidated"). |
| 21 | Lists were read wrong. A 429 page ended a read as success (`truncated: false`); paged reads skipped each page's lazy tail; a positional Next selector visited pages out of order or stopped on page 1; there was no column for an icon-only "Plus" badge; a listing used the partial Friends home instead of "See all"; reads took about 12 s each; `list_never_appeared`. | list reading, extraction and detection | 15: munnhi5q munnyvbr munq51ik munq5s8x muntc23v muntufao munuj2os munv53gt munw7ffn munwdqey muo0g1ky muo0zggr muo1ch23 muo1rxmv muohgblr | ~$1.1 | **partly**: W `8f764dbe` (09-30, "paged reads reveal lazy tails"), W `28ee7f6a` (10-01), C/W `30f65794`/`372e0ee9` (10-01, See-all partial lists), W `32c764c3` (10-01, numbered pager, Next loop, badge text). The positional-Next fix (w12) is in the lane C WIP W `518e38fe`. Paging still failed live on 10-05 (Current State, lane C round 2). No fix found for the 12 s read. |
| 22 | Unusable model replies: `invalid_evidence_decision`/`amendment`, `provider_malformed_response` (13 of 35 re-author decisions in one run), and unusable decisions with no reason code. | model guidance/prompt | 11: munnop9n munoeac4 munri5gr munsxchc muntc23v munvqvf5 munw3g8n munw7ffn muo20xvx muog33va muohgblr | $0.67 | **partly**: C `e41455ce` (09-30, "malformed provider replies recorded"), C `a7174329` (09-30, "An unreadable model reply is asked again, never a bare ending") |
| 23 | Press results lied about effect. A press reported `succeeded` with no cart change (scored candidate at 0.566); a navigation to a `not_found` page succeeded; a press that changed the page answered `action_failed`; a mutating replay always counted as `replayed`. | page state, routing and navigation | 11: munoeac4 munpjclw muntufao munv9eqy munvmg0n munvvc3z munwdydi munwmt25 muny5y17 munyqgjr munz227o | ~$1.0 | **partly**: C `ab1a3bcd` (10-02, F37, "a press result says what changed"), W `415de3c3` (10-02, a press the page refuses fails as `refused_by_page`), C `77b269a2` (a lasting step is checked) |
| 24 | Re-author problems. The re-author ran only for a completed run refuted `does_not_answer_request`, explored from the wrong page, built nothing (14-31 refused completions), wrote two extract nodes to one dataset, and reused the first pass's attempt ids. | judges and verification (repair) | 12 (REAUTHONLY): muny76m9 munymcpf munzl2eh munzutb0 muo00owc muo06beo muo0ks69 muo0wf2q muo12lnk muo18781 muo2690x muo2gyob; also named in munnhi5q munojusu munoeac4 munv53gt munw7ffn munyt4jo munzpdlu muo1dxrj muo1la5v | ~$0.96 (12) | **partly**: C `d6b50b5a` (09-30, failed step re-authored), C `75a3b6d8` (10-02, re-author reruns a carried step where it started), C `58db495f` (10-03, t194 merge) |
| 25 | Every ladder that chose its model rung recorded the diagnosis as a failed call (`recovery.ladder_diagnosis_unanswered`). | judges and verification (repair) | 12: same ids as row 24 (REAUTHONLY) | ~$0.96 | **fixed** C `d6b50b5a` (09-30). `ladder_model_rung_selected` is present in Core `dev` `service/summaries/conversions.ts`. |
| 26 | The judge or result check misjudged or did not run. The result check refused its own summary before sending, so the run went unjudged; the judge was blind to a read's pages, conditions and Plus badge; `required_values_missing` bypassed the wrong-answer route; an `unverified` verdict ended as success. | judges and verification | 10: munnhi5q munnop9n munojusu munq5s8x muntcsge munv53gt munvvc3z munw7ffn munwmt25 muo2b224 | ~$0.50 | **partly**: C `e41455ce` (09-30, the judge sees a condition's read value), C `4ecfc6b4` (10-01), C `58db495f` / `3d98efcb` (10-02 and 10-03, t194 judge fixes). Judges were still blind to stored rows on 10-05 (Current State lane B/C round 1). |
| 27 | The model wrote no row filter, or a wrong one. There was no `where` for rating, price, Plus or accessory; a "charging case" exclusion dropped true earbuds; a `where` kept nothing. | model guidance/prompt | 9: munnhi5q munnop9n munnyvbr munojusu munq51ik munq5s8x muntfume munv53gt munw7ffn | ~$0.33 (2 unknown) | **partly**: W `371e6e7a` (09-30, rejected-row samples reach the model whole), W `22f26582` (10-02, the judge sees each condition's alone rows) |
| 28 | The model could not express a loop or route. `repeat` spans omitted the dialog confirm; `act_needs_repeat` and `no_such_position` refusals did not say what to send; a rerun broke `over` references; loop-redundant steps were left in; the standing instruction forbade the act the Flow needed. | model guidance/prompt | 9: munnop9n munnyvbr munq51ik munsxchc muntfume muntu7in munuj2os munyzo8z muog33va | ~$0.48 | **partly**: C `05266957` (09-30, "loops and routing are guided exactly"), C `b72fa8a1` (10-01, `repeat_span_unknown` names the wrong reference), C `6a9da8ea` (10-05, t264 S4 routing words, stable rerun numbers) |
| 29 | Amendments removed steps that later steps depend on: the consent dismissal, a card close, store picks, "Save for later", eight proved steps. Nothing warned that the kept draft could no longer reach its page. | loop bookkeeping and guards | 9: munore4o munpwa5r muntmwvx munutuvf munvmg0n munwdydi munwmfrs muo1ni63 muo2fscr | $0.82 | **open** for the general case: Current State lists D2-1 ("refuse an edit that leaves a kept step on a page the step before no longer reaches") as not fixed on 10-06. Related: C `bb5d9927` (10-01, "a kept step keeps the press that opened its page"). |
| 30 | Instruction details were never checked: no quantity or size step, the wrong size added, a quantity set after its add. | judges and verification | 10: munaiz76 munnop9n muntmwvx munuks76 munv9eqy munvvc3z munwdqey munwmt25 munwq8zd muoga8at | ~$0.78 (1 unknown) | **partly**: C `7f1bc8fd` (09-29, lane A P1 B, size and quantity requirements), C `98324a2c` (10-03, `choice-order.ts`, a choice made after its act, as information only) |
| 31 | Facility start failures. The renderer crashed on the extension control page; the extension never answered `fluxiq.connect` in 15 s; the control-page navigation was aborted. The root cause was the network guard's canary crashing the service worker. | Lab, harness and infrastructure | 8: muna3yfq munbu244 mundl2j0 mundupr5 munhpy2m muni3pdr munnetuw munoaqcn | $0 | **fixed** W `5903a1e7` (09-29, "The Lab's network guard no longer crashes the extension as it starts"), C `50eb6841` (09-29, a connection that never opens fails after 10 s) |
| 32 | Other Lab labels were wrong. A product failure was stamped as a facility failure; `environment.missing` was reported for a declared-point stop; the final-state oracle checked only the page path; an unplanned patch was mislabelled; the Lab waited 306 s for a record Core never writes; the `resultReauthor` record was missing; a run used a stale extension build. | Lab, harness and infrastructure | 9: munnop9n munoa86g munovwp3 munsxchc muntc23v munw7ffn munzbfbj muo1la5v muo2fscr | $0.61 | **partly**: W `8f764dbe` (09-30, "no Flow is a product failure"), W `a96074dc`/`7b3db972` (10-01), W `af672ea8` (10-01, refuses a live run lacking dev), W `3c2cb612` (09-30, the Lab reads a repaired build's whole trace). No fix found for the path-only oracle or the 306 s wait. |
| 33 | The first Add to cart after a page load is swallowed, and the model read `pageState: unchanged` as done. | page state, routing and navigation | 7: munoa86g munuxns5 munvmg0n munvvc3z munvz5x0 munwmfrs muo0g1ky | $0.74 | **partly**: W `e7f9160d` (09-30, `unchangedPress` hint), the press-again change in W `c22646d0` (09-30 WIP), W `96da6782` (10-01, a twice-ignored press). F19's catalog sentence was reverted (W `379763fb`). |
| 34 | The later pickup slot (3pm-4pm) was chosen while 2pm-3pm was open. | model guidance/prompt | 7: munovwp3 munyqgjr munzz9j1 muo07nnh muo0g1ky muo1ch23 muo1rxmv | $0.70 | **open**. No commit found. |
| 35 | A build threw and ended with the cause hidden. An execution-grant refusal was filed as a provider transport error; `draft-shown` threw on a `did_not_work` row; the throw was filed as `pre_provider_validation_failed`; minutes went unrecorded before the first decision. | Lab, harness and infrastructure | 5: mun5e1ie mun8tgdh muncqlr0 munda7ub mune0xh1 | $0 recorded (3 unknown) | **fixed**: C `befca2f8` (09-29, "A build no longer ends when its packed draft holds a step that did not work"), W `259b0df2` and C `e75dcf29` (thrown issue codes and source lines), C `91262bd2` (09-29, t186 removed call grants) |
| 36 | Model-authored call ids carrying instruction and page words were printed verbatim in `core.log` and the bundle. | Lab, harness and infrastructure | 4: muntmwvx muntufao munu4b4y munvvc3z | $0.30 | **fixed** W `e7f9160d` (09-30, "the build trace prints only assigned call ids"). Confirmed live in `run-munvvc3z-3eadc185.md`, "Positive". The excerpt and page strings in `flow-lane.json` (`run-munu4b4y-4e15662e.md` cause 9): W `d9ee6398` (09-30, the Lab screens authored nodes), so partly. |
| 37 | The unattended relaunch loop kept relaunching after the lane's agent ended, and after the DeepSeek balance ran out. | agent process | 383: the 346 balance stubs on `t195-slot-4` (`run-muo2nioi-e4a9bd18` … `run-muodhgog-5be437d1`) plus 37 debugged: muny76m9 munymcpf munyt4jo munyzo8z munzbfbj munzfk33 munzihwx munzl2eh munzpdlu munzrj6r munzutb0 munzz9j1 muo00owc muo06beo muo07nnh muo0dyu5 muo0g1ky muo0ks69 muo0qepn muo0r9fk muo0wf2q muo0zggr muo12lnk muo18781 muo1ch23 muo1dxrj muo1la5v muo1ni63 muo1rxmv muo1w558 muo1z05y muo20xvx muo2690x muo2825e muo2b224 muo2fscr muo2gyob | $3.19 on the 37; $0 on the 346 | **fixed** W `5363e39b` (09-30, "The Lab refuses any live run that is unbudgeted, after an empty balance, unchanged, undebugged, or looping"). Evidence: `t195-slot-4-balance-failures-2026-09-30.md`. |
| 38 | Instrumentation gaps. Completion-check issue codes, the missing act, decision parameters and malformed-reply shapes were not logged, so several causes stayed "NO EVIDENCE". | Lab, harness and infrastructure | named as a gap in at least 6: munaiz76 mun8tgdh munsxchc muntufao munri5gr munvqvf5 | — | **fixed** C `b9c26036` (10-01, "Every model call of a build is logged as files: the exact request, the raw reply, the parsed decision") |

### Smaller causes, each named in one to three runs

- **munnop9n.** The standing instruction ("never mutate merely to perform an eventual workflow step")
  contradicted "a step you want is run". Folded into row 28.
- **munnop9n, munpwa5r.** Repair cost was booked at the reservation ceiling. Folded into row 19.
- **munoeac4.** The build acted blind on a bot challenge. Folded into row 20.
- **muncqlr0.** A Core-built draft plan failed `maxSummaryLength 240`. The fix was named "t174 F0";
  no commit subject names it, so it is **open/unverified**.
- **muncqlr0.** A build begun on its start location had no arrival step. **Fixed** C `b1a12948`
  (10-01, F31, "a build with a start location opens by navigating there itself").
- **munu4b4y, munv53gt, munw7ffn, munq5s8x.** A node's own retries spent the subflow recovery budget
  and withdrew its authored `failed` route. **Partly fixed:** in the lane C WIP C `4c8753ed` (09-30),
  and test C `85f2219c` (10-02).
- **munsxchc.** The Lab ran an extension build older than its source (`FLUXIQ_LAB_ALLOW_STALE_BUILD=1`).
  **Fixed** by W `2267896e`, `ae5d5dee`, `af672ea8`.
- **munuj2os.** The withdraw-stale task declared no permission point. **Fixed** W `f251b0a8`.
- **munyzo8z.** An authored loop pressed Add to cart 158 times with no exit. Row 28; **open** as a
  specific loop-exit guard.
- **munu4b4y.** A send was pressed with no permission request. **Fixed** C `05266957` (F10).

## Commands run and observed results

- `git log --since=2026-09-29 --until=2026-09-30T23:59 --diff-filter=A --name-only --format= -- docs/working/language-driven-flow-loop-plan/debugs | sort -u`
  printed 104 paths. All 104 exist on disk: 103 `run-*.md` and `t195-slot-4-balance-failures-2026-09-30.md`.
- I extracted each file's `## Cause(s)` and `## Root cause` sections, plus its header verdict and cost
  lines, into a scratch file and read all of them. Only the balance stub has no cause section.
- `grep -i "relaunch loop"` over the 104 files matched 37 run debugs, listed in row 37.
- `git log dev --since=2026-09-27` in both repositories wrote 836 commit lines downstream and 585 in
  Core. Core's checkout is on `task/t280-node-definitions`, so I queried `dev` explicitly, never `HEAD`.
- `git merge-base --is-ancestor <hash> dev` confirmed these are on `dev`: W `5903a1e7`, `0faee6e6`,
  `518e38fe`, `5363e39b`, `8f764dbe`, `040d7c2b`, and C `4c8753ed`, `dff9b004`, `befca2f8`,
  `50eb6841`, `e75dcf29`, `77b269a2`, `b185244f`, `711eab8c`.
- `git log --format='%h %s' <merge>^1..<merge>^2` on the t196 and t200 merges in both repositories
  named `77b269a2`, `b185244f`, `711eab8c`, `b507d5fa`, `8610d2ae`.
- `git log dev -S<symbol>` found these first commits:
  - `ladder_model_rung_selected`: C `d6b50b5a`.
  - `step_only_arrives`, `act_needs_repeat`: C `7f1bc8fd`.
  - `over_not_before`: C `05266957`.
  - `unchangedPress`: W `e7f9160d`.
  - `pressAgain`: W `c22646d0`.
  - `address_not_shown`: W `af5e553e`.
  - `PROBE_FRACTIONS`: W `abbf100d`, `c22646d0`, `e7f9160d`.
- `git show dev:.../recovery/context.ts` has the header line "no byte budget, no per-section item limit
  and no trim ladder (2026-09-30". `git show dev:.../parking/permission-ask.ts` still defines
  `AUTOMATION_STUDIO_PERMISSION_ASK_TIMEOUT_MS = 120_000`; the fix is that the Lab answers the ask.
- I made the run counts with a Python keyword match over the extracted cause sections, then corrected
  them by hand: dropped `munvqvf5` from row 1, whose debug says no dry run occurred; cut row 35 to its
  5 true runs; cut row 30 to 10.

No build, test, Lab, browser or provider command was run.

## Not verified

- **Run counts are a keyword match, corrected by hand where I saw errors.** They may be ±2 per row. The
  dollar figures sum the spend of the runs that show a cause; they are not the cost caused, and the
  rows overlap.
- **Six runs have no cost in their debug,** and the 346 stubs are $0 by their debug's statement. I did
  not open `evaluation.json` or `live-llm.json` to fill the gaps; that is the `numbers` brief.
- **"Fixed" means a commit on `dev` addresses the cause.** I did not check that any fix held live, apart
  from where a later debug in this set says so: rows 36 and 13 (t193 F, store pick).
- **Fixes landed only in a 09-30 "WIP … unvalidated" shutdown commit are marked `partly`:** the
  corner probes, origin pace, positional Next, the retry-budget fix and press-again.
- **The reset-keeps-site-state defect (row 1) may persist in judged test runs and repair reruns,**
  where replays still happen. I did not trace the current Core code for it.
- **I did not read the lane reports or the later round debugs.** Statements that a cause is "still
  open on 10-05/10-06" come only from the plan's Current State.

## Open questions or contradictions found

- **The brief calls the relaunch-loop debugs "auto-generated stubs" with no causes.** Only one file
  fits that description: the balance-failures note for 346 runs. The other 37 relaunch-loop runs were
  debugged by hand after the fact and do list causes, so the report counts them in the table.
- **The Lab scored 12 runs `passed` that were permission stops** (row 18). Anyone reading run
  verdicts from before W `f2f80024` (09-30) needs to know the 09-30 "passes" are not passes.
- **Row 29 (amendments that strand steps) was first recorded on 09-29/30** (runs `munore4o`,
  `munpwa5r`) and recurs as D2-1 on 10-05. It is the oldest open loop-bookkeeping cause in this set.
- **Row 34 (the later pickup slot) recurred in 7 runs with no fix found,** and row 17's guard
  (exploration presses on non-qualifying rows) is open. Both are consequential-act risks.
