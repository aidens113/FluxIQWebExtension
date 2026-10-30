# t810 / w5-replays: P5b proven offline (recorded replays on before and after Core, plus a headed read with the real client)

Worker report. No source in either tree was edited, no commit, no model call, no paid run. Every replay, build and
browser run ran under `lab-slots/heavy-check.lock`, which I took myself and released.

`SCR` = `C:/Users/osrs_/AppData/Local/Temp/claude/c--Users-osrs--FluxStuff--FluxIQWebExtension/b969a395-6436-4284-bccb-432f7f43683b/scratchpad/t810-w5`
(all scripts, logs, JSON, screenshots).

- **before** = `C:/Users/osrs_/FluxStuff/fxwork/t806/!FluxIQ` (dev base, untouched).
- **after** = `C:/Users/osrs_/FluxStuff/fxwork/t810/!FluxIQ`, replayed after both gate files had a "Follow-up" heading
  (`w1-refute.md:206`, `w2-marks.md:90`) and after I rebuilt Core and the downstream tree from it.

## Outcome

**Done for the brief's replays, the harness and the headed capture. One planned extra was not run (below).**

- **With marks the real client produced, run-mvud43a2's final check (0063 to 0066) is `answers`**
  (`core.result.no_refuted_by_record`) on the after Core, and stays `unsure` / `refutation_unsupported` on the before
  Core and on the after Core without marks. The recorded replies are the same four in every case; no call is invented
  (4 calls made, 0 unrecorded).
- **Without marks, after = before on all 23 judged verifications**, in all three re-ask modes. That includes the
  store false passes, which stay refused: Core no, `computed_fact_failed`, 0 calls.
- **Marks come from the real extension.** A headed, provider-free replay of the saved Flow on social-network-feed
  passed its oracle 3 of 3 and carried `rejectedMarks`. I ran it twice (before and after the final extension fix
  w2 reported); both gave the same 5 marks.
- Not run: the same marks on the two social runs mvskodlp and mvswewhy (the lock was not free in a 9-minute
  window). Their playbacks stay `unsure` here, because their summaries have no marks.

## What changed and why

Nothing in the repositories. In `SCR`:

- `replay.mts` (copied from t795/w6, then changed):
  - the Core is named by path: `W5_CORE_DIR` is a `!FluxIQ` checkout, `W5_CORE_LABEL` names the output files;
  - `--reask=recorded|repeat` (item a);
  - `--marks=<json>` (item b);
  - `--summary=<json>` runs verify on a real summary instead of the reconstructed judge copy (item c);
  - the output also records `refutedRows`, calls made and calls with no recorded reply (`unrecorded`).
- `run-replay.sh`, `replays.sh`, `after-extra.sh`, `table.mjs` drive and summarise them.
- `proof-driver-social.mjs`, `flow-social.txt`, `mkflow.mjs` run the headed read. `realsummary.mts`, `mkmarks.mjs`,
  `dbwalk.mjs`, `dbfind.mjs` rebuild Core's summary from the stored trace and derive the marks file.

### How a re-ask with no recorded reply is served (a)

A recorded reply still goes first to the call whose recheck text it was sent exactly, then to a call whose recheck
has the same first 60 characters. Only a call that matches neither is served by the flag:

- `--reask=recorded`: the call's later recorded replies, in step order (the next unused one). For run-mvud43a2 that is
  0065 and 0066, but those two already match calls 3 and 4 as "same kind", so no call was left to serve.
- `--reask=repeat`: the verification's first recorded reply again (a judge holding its no).
- no flag: such a call is refused with a non-temporary provider error, as in t795/w6. Its outcome is "no answer",
  never a made-up one.

### Marks (b) and their provenance

`--marks=SCR/marks-social-real.json` writes `leftOutMarks` onto the condition rows of the reconstructed summary, and
`marks` onto `leftOutTogether` sets, matching by row label and by cells (`author`, `comments`, `group`, `posted`; not
`text`, which the summary can cut). Nothing is hand-written. The five marks:

| Row (label) | Cells | Mark | Where it came from |
| --- | --- | --- | --- |
| Kim Tran | Urban Growers Network, 73 comments | outside, "Join group", entity Urban Growers Network | `SCR/real-summary-social.json` `reads[0].conditions[0].leftOutMarks[5]` |
| 18 comments | Kettle & Crumb, 18 comments | outside, "Follow", entity Kettle & Crumb | `...leftOutMarks[11]` |
| Rosa Delgado | Cycle Commuters of Harbourside, 96 comments | outside, "Join group" | `...leftOutMarks[12]` |
| Idris Bello | Urban Growers Network, 12 comments | outside, "Join group" | `...leftOutMarks[13]` |
| 40 comments | Kettle & Crumb, 40 comments | outside, "Follow" | `...leftOutMarks[14]` |

The chain is: the real extension's list read (`web.dom.extract_list` on social-network-feed, run in the Lab's visible
browser by `replaySavedFlow`) sent `rejectedMarks` beside `rejectedSamples`. They were stored in the workspace's
`global.sqlite` (`automation.state` row 19, `session.trace.attempts`, the `s10` read, both loop passes). I ran Core's
own `extractionSummaryFromOutputs` and `summarizeAutomationStudioRunResult` (the after tree) over that stored trace,
and wrote the marks file from the resulting `leftOutMarks`/`leftOutCells`. Raw client output for the final pass:
`rejectedMarks[0]` has `{"kind":"outside","said":"Join group","entity":"Urban Growers Network"}` at sampled rows 5 and
13, `Cycle Commuters of Harbourside` at 12, and `{"said":"Follow","entity":"Kettle & Crumb"}` at 11 and 14; condition
2 has none. The marks file is from capture 1 (`t810w5-social-372e0e`); capture 2 (`t810w5-social2-9ad26f`, after
w2's extension fix) regenerated it byte-for-byte equal apart from the `from` field. The earlier copy is
`marks-social-real-capture1.json`.

In the recorded mvud43a2 summary the same rows appear twice (the loop's two passes), so the replay reports
"cond 1: 7/27": 7 of the 27 left-out rows matched (Kim Tran x2, 18 comments x2, Rosa, Idris, 40 comments).

The real client produced **no marks on the 10 rows that conditions 1 and 2 left out together** (sponsored and page
posts: Greenleaf Seeds Co., Brightside Energy, Memories, Tidewater Outdoor ...). `rejectedMarks` covers only the alone
rows. So the together sets carry no marks here.

## Results (table per run and judge step)

Format: `verdict / code`, then `c<calls made>`, and `u<n>` when n calls had no recorded reply. `rr` = number of
`refutedRows` (none of these runs had marks, so none). Modes: no flag, `--reask=recorded`, `--reask=repeat`. Before and
after are identical in every cell, so each cell is one value; where modes differ they are written as `none / recorded /
repeat`. Logs: `SCR/log-<before|after>-<run>[-<mode>].log`, JSON beside them as
`SCR/replay-<run>[-reask-<mode>]-<before|after>.json`. Machine-built version: `node SCR/table.mjs`.

| Run, step (judges as recorded; kind; rows) | before = after (all three modes unless said) |
| --- | --- |
| mvud43a2 0045 build (no yes no no yes; 3 rows) | answers / answers_request, c5 |
| mvud43a2 0063 final (no no no no; 3 rows) | **unsure / refutation_unsupported, c4** (the recorded summary has no marks) |
| mvskodlp 0033 (no no; 6 rows) | does_not_answer / does_not_answer_request, c2 |
| mvskodlp 0042 (no yes yes yes yes; 3 rows) | answers / answers_request, c5 |
| mvskodlp 0058 playback (no no; 3 rows) | unsure / refutation_unsupported, c4 u2 / c4 u2 / c4 u0 |
| mvskodlp 0086, 0110 repair rounds (all no; 0 rows) | unsure / refutation_unsupported, c4 and c5 |
| mvswewhy 0033 (no no; 24 rows) | does_not_answer / does_not_answer_request, c2 |
| mvswewhy 0042 (yes yes; 3 rows) | answers / answers_request, c2 |
| mvswewhy 0055 playback (no no yes yes no; 3 rows) | unsure / refutation_unsupported, c5 |
| mvswh11y 0031 (unknown no; 16 rows) | unsure / refutation_unconfirmed, c2 |
| mvswh11y 0040, 0048, 0051, 0062 (15 rows) | **does_not_answer / computed_fact_failed, c0** (Core no, no judge call) |
| mvtdoyf3 0029 (yes no no; 16 rows) | unsure / refutation_unsupported, c5 u2 / c5 u2 / **answers, c4 u0** |
| mvtdoyf3 0036 (no yes no; 16 rows) | unsure / refutation_unsupported, c5 u2 / c5 u2 / c5 u0 |
| mvtdoyf3 0043, 0052 (no no; 16 rows) | unsure / refutation_unsupported, c4 u2 / c4 u2 / c4 u0 |
| mvtdoyf3 0065, 0083 (13 rows) | **does_not_answer / computed_fact_failed, c0** |
| mvtdoyf3 0124, 0137 (15 rows, incl. the playback) | **does_not_answer / computed_fact_failed, c0** |

`refutedRows` is null in every row above. **The after Core changes none of these 23 outcomes on summaries that predate
marks.** The store false passes (mvswh11y revisions 2 and 3, the judged whole run and the playback; mvtdoyf3 revisions
3 and 5 and the playback) stay a Core no with 0 judge calls. The 16-row revisions are not refuted.

Reading the modes:

- `--reask=repeat` serves the first recorded reply (a "no") to calls that had none. It turns mvtdoyf3 0029 into
  `answers` (c4, no call unrecorded); I did not trace why a repeated "no" lets the lone yes stand there. With `recorded` no
  unused recorded reply was left (u2 stays), so it behaves as no flag.
- mvskodlp 0058 (a playback with a correct result): `unsure` in all modes. Its two nos are unsupported and nothing
  Core holds refutes them (no marks in that summary).

### Marks injected (mvud43a2 only; `--marks=SCR/marks-social-real.json`)

| Step | before Core | after Core |
| --- | --- | --- |
| 0045 build | answers / answers_request, c5 (no row matched; `marksInjected: -`) | same |
| 0063 final | unsure / refutation_unsupported, c4 (the old Core ignores marks) | **answers / no_refuted_by_record, c4 u0, 10 refutedRows**, in all three re-ask modes |

The 10 `refutedRows` (5 per judge call, calls 1 and 2): Rosa Delgado, Idris Bello and Kim Tran by `outside_mark`
(`"Join group" for "Cycle Commuters of Harbourside"`, `... "Urban Growers Network"`); Marcus Reid by `cell_differs`
(`group: "Marcus Reid"`, the post is a person's own, not the group's) and by `not_kept` / `wrong_value` ("left out by
condition 1 ..."). Calls 3 and 4 (0065, 0066) matched as "same kind, wording differs", the wording having changed since
the run. Logs: `SCR/log-after-mvud43a2-marks-{none,recorded,repeat}.log`.

### Core's own summary of the headed read (`--summary=SCR/real-summary-social.json`, step 0063's group only)

| Core | verdict | calls |
| --- | --- | --- |
| before | does_not_answer / does_not_answer_request | c2 (two nos; 0065, 0066 unused) |
| after | **answers / no_refuted_by_record**, 10 refutedRows (same five rows and evidence as above) | c4 u0 |

The after verdict holds in all three re-ask modes (`SCR/log-after-mvud43a2-real-*.log`). The real summary comes from
the headed read, with the recorded judges 0063 to 0066 served. This is the offline check that the marks in a real
summary, not only the injected ones, reach the refutation.

## Headed capture (c)

- **Scenario and task:** social-network-feed, `social-network-feed-recent-group-posts` (`live-tasks.ts:67`), seed
  5101, oracle step `extract-recent-group-posts`, 3 expected rows.
- **Flow:** `SCR/flow-social.txt`, built by `mkflow.mjs` from run-mvud43a2's own steps. The extract_list parameters are
  from `0059-run-web.dom.extract_list/call.json` and the next-page parameters from `0060`. The click selectors are
  from `0053`, `0056`, `0057`. The three optional clicks (cookies, notifications, chat) and the loop (`repeat while`
  the next-page step) are kept. Two changes from the run's own Flow, the same kind t795/w6 made: the evidence handles
  are the literal selectors of that run's playback, and the `done when` line (handle `t1748`) is dropped. The run dir
  holds no saved Flow file; its script is in `0039-tool-core.submit_subflow`. The scenario id in logged selectors was
  `[withheld]`; I put back `social-network-feed`. `extractList.dedupe` is not in the executed parameters, and Core
  refused it as a string, so it is not in my Flow.
- **Driver:** `proof-driver-social.mjs` (t795/w6's, pointed at the t810 trees): Core's acceptor, validator and
  adaptation path, then `replaySavedFlow`, provider-free (`modelProvidersEnabled: false`, `FLUXIQ_TEST_ENV_FILES=none`),
  in the Lab's visible browser. Run state under `C:/Users/osrs_/AppData/Local/Temp/w5r` (outside both repos, short path).
- **Result, both captures:** run `succeeded`, oracle **passed** (3 of 3 rows matched, 15 of 15 fields); `collectedRecords`
  8 across 2 passes; provider calls 0, keys 0 to 0, interventions 0, `resultVerification: unverified` (no model, so no
  Core check ran in the replay itself, which is why the verify step is the offline one above).
  Logs `SCR/goalb-social.log` and `SCR/goalb-social2.log`; screenshots `SCR/proof/t810w5-social-372e0e/` and
  `SCR/proof/t810w5-social2-9ad26f/` (8 each, `zz-after-run-full.png` last).
- **Core's summary:** built from the stored trace (`realsummary.mts`): read `kept` 4, `itemsSeen` 34, condition 1
  15 alone rows with the 5 marks above, condition 2 2 alone rows with none, one together set `[1,2]` of 10 rows with no
  marks. Log `SCR/realsummary.log`, `SCR/realsummary2.log`.

## Commands run and observed results

All heavy ones inside `until mkdir $L ...; rmdir $L`, separate statements; lock waits: first 23:15 to 23:52, second
00:27 to 01:58 (about 1 h 30 m, under the two-hour mark), third not acquired in a 9-minute window.

- Before replays (3 modes x 5 runs): `SCR/replays.sh before`, 15 x rc 0. After: `SCR/replays.sh after`, 15 x rc 0.
  Each is `W5_CORE_DIR=<Core> node --experimental-transform-types SCR/replay.mts <steps> <run> [--reask=..]` from
  `<Core>/packages/fluxiq` (`SCR/run-replay.sh`). Steps dirs:
  `lab-runs/2026-10-29/run-mvud43a2-445c7f17`, `2026-10-28/run-mvskodlp-9966d618`, `run-mvswewhy-e4e469d4`,
  `run-mvswh11y-9d462629`, `2026-10-29/run-mvtdoyf3-47ffaac1`, each `/steps`.
- Marks and real-summary variants: `SCR/after-extra.sh before` and `after-extra.sh after`, 6 x rc 0 each.
- After build: `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build`, rc 0
  (twice: before capture 1, and before capture 2 after w2's fix); downstream `pnpm lab recovery-matrix --list`, rc 0
  (twice). Logs `SCR/goalb-core-build*.log`, `SCR/goalb-down-build*.log`.
- Headed proof: `FLUXIQ_TEST_ENV_FILES=none node SCR/proof-driver-social.mjs SCR/flow-social.txt social` (first try:
  refused `extractList.dedupe` at validate, then fixed in the script), rc 0; again with label `social2`, rc 0.
- `node --experimental-transform-types SCR/realsummary.mts <global.sqlite> <proof.json> <out.json>` with `W5_CORE_DIR`
  at the after Core, rc 0, twice.

## Not verified

- **Marks on the two social runs** (mvskodlp 0058 and mvswewhy 0055 playbacks, whose results were correct and are
  `unsure` here). I did not run `--marks` on them; the lock was not free. The marks file is for the same fixture, but
  those runs may be a different seed, so the rows may not match. Until run, "answers on both social runs" holds only
  for their builds (0042 on both, no marks needed), not their playbacks.
- **Fidelity of the replayed summaries.** The reconstructed judge copy unsaid the row ids and rebuilt `testedLabel`;
  the "real" summary comes from the stored trace with Core's own functions but lacks the loop sum (read `kept` 4 and
  15 alone rows against the recorded run's two-pass 28), the end view, paging and computed facts. The before Core's
  `does_not_answer` on it, against `unsure` on the recorded summary, is a difference of shape that I did not trace.
- Every outcome after an unrecorded call (`u2` rows) is "that call gave no answer", not a model's answer.
- The headed run's `resultVerification` is `unverified` (no model): the verify step there was never run on that run
  by Core itself, only offline on its rebuilt summary.
- Whether the window was in view on screen: I read only the screenshots.
- w2's "Follow-up" has an "Outcome: Done." line but no separate return-contract block like w1's; I took the heading
  and the outcome as the gate.

## Open questions or contradictions found

1. **Marks reach the refutation only through `leftOutMarks` on the condition rows.** The real client sent none on
   rows two conditions left out together, so a post that conditions 1 and 2 left out together can never be refuted by
   its mark. The 10 together rows here are sponsored and page posts, not the ones the judge named, so this did not
   matter for 0063, but it will for a post that fails two conditions.
2. **w2 reports `marks` (not `aloneMarks`) as the key in `build-test/read-rows.ts` and that the domain replay sender
   does not yet write it.** I did not exercise that path (the build-test judge copy of 0045 to 0049 had no marked row).
3. **Marcus Reid is refuted by `cell_differs` and `not_kept`, not by a mark** (the post is his own, not a group's). It
   is the same row the judge named; a client that marked it as outside would be redundant.

## Follow-up (social playbacks with marks; part 2 not done)

Part 1. Both runs match my capture: `entry.json` task `social-network-feed/social-network-feed-recent-group-posts/workflow=recent-group-posts`,
`run.json` seed 5101 (same as the headed capture). So `marks-social-real.json` was reused, not recaptured.
Commands: 12 replays under the lock (`--marks=SCR/marks-social-real.json`, both Cores, 3 re-ask modes), all rc 0.
Logs `SCR/log-<before|after>-<run>-marks-<mode>.log`. Rows matched: mvskodlp 0058 7 of 33 (condition 1), mvswewhy 0055 7 of 27 (condition 3).

| Step | Core | none | recorded | repeat |
| --- | --- | --- | --- | --- |
| mvskodlp 0058 | before | unsure / refutation_unsupported, c4 u2 | same | unsure / refutation_unsupported, c4 u0 |
| mvskodlp 0058 | after | unsure / refutation_unsupported, c4 u2 | same | **answers / no_refuted_by_record**, c4 u0, refutedRows incl. Rosa Delgado |
| mvswewhy 0055 | before | unsure / refutation_unsupported, c5 | same | same |
| mvswewhy 0055 | after | unsure / refutation_unsupported, c5, refutedRows null | same | same |

Reading: mvskodlp 0058 is refuted to `answers` only when its two unrecorded re-asks are served (repeat); with them
unanswered it stays `unsure`. mvswewhy 0055 is not helped by the 7 matched marks (its recorded nos do not name rows the
marks refute; refutedRows null) and stays `unsure`.

Part 2 not done: `w2-marks.md` has no "Follow-up 2" heading yet (grep found none), so no rebuild, recapture or
together-row rerun.
