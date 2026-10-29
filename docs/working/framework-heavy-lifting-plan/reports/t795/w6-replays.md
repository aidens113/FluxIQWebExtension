# t795 / w6-replays: P5 on real runs (offline replays, one headed proof, downstream checks)

Worker report. No product code or repo file was edited except this report. No model call, no paid or live Lab run, no
mutating git. Every replay, build and Playwright run went under `lab-slots/heavy-check.lock` and released it.
Scratch (all scripts, logs, JSON, screenshots):
`C:/Users/osrs_/AppData/Local/Temp/claude/c--Users-osrs--FluxStuff--FluxIQWebExtension/b969a395-6436-4284-bccb-432f7f43683b/scratchpad/t795-w6/`
(below: `SCR/`).

## Outcome

**Done, with one surprise that needs a lead decision.**

- **Store false passes: fixed as intended.** Every revision that left the ear-tips row out (store 2 rev 3, rev 5,
  playback; store 1 rev 2, rev 3, the judged whole run, playback) is now a Core no
  (`core.result.computed_fact_failed`, basis `core_observation`) with **0 judge calls**. Every 16-row revision is
  **not** a Core no, and the binding double no on store 2 rev 1 (0043/0044) and rev 2 (0052/0053) is no longer
  binding (`unsure`, `refutation_unsupported`, F3).
- **Social: no fact fails** on either run. But **both correct builds now fail to reach yes** on the recorded replies.
  The baseline Core (t563, `7a822e42`, the t795 branch's base) gives `answers` on the same replies. The cause is the
  new together-rows quote guard (F1 a). It holds each yes over 10 sponsored or page posts (no group, no date) that
  several conditions left out together. Traced to file:line below.
- **Goal B: proven headed and provider-free.**
  - Rev 5's Flow stored 15 rows. Core's check refuted it with `core.result.computed_fact_failed` and named the
    ear-tips row (conditions 3 and 4).
  - Rev 1's Flow stored the oracle's 16 rows. Its check ended `unverified` with `core.result.no_model_available`, so
    no Core no.
- **Goal C:** `node scripts/check/model-text.mjs` exit 0; `node scripts/structure-audit.mjs` exit 0.

## What changed and why

Nothing in either repository. Scratch artifacts:

- `SCR/replay.mts` drives the real `verifyAutomationStudioRunResult` with a scripted provider. Parameters:
  - `W6_CORE=t795|t563` picks the Core tree.
  - One verification per recorded judge `context.runId`.
  - Summary and instructions come from the verification's first judge request. Before use: row ids are unsaid,
    `testedLabel` is rebuilt (accounts.ts rule: the condition left rows out alone and tests the rows' first column),
    and `recheck`, `paging` and `computedFacts` are dropped.
  - `confirmAnswer: true` for `build-test.*` runs (as `build-test/judge.ts:321` sets it).
  - `deniedEvidenceKeys` is the web domain's list.
- How a call is answered:
  - A recorded reply goes to the call whose `recheck` text it was sent exactly.
  - Otherwise it goes to a call whose recheck has the same first 60 characters (the same re-ask kind, reworded since
    the run).
  - Otherwise the call is **UNRECORDED**. The provider throws a non-temporary `llm.provider_auth_failed`, so no answer
    is invented. The outcome after an unrecorded call is therefore "that call gave no answer". It is not what a model
    would have said.
- `SCR/held-probe.mts` runs the quote guard (`automationStudioResultLeftOutRowsUnquoted`) and the verdict reader on
  single recorded yeses, to find why each is held.
- `SCR/proof-driver.mjs`, `SCR/flow-rev5.txt`, `SCR/flow-rev1.txt`: Goal B (below).

## Goal A: offline replays (0 model calls)

Columns:

- **calls made**: calls the replay made.
- **unrec.**: calls with no recorded reply.
- **t563**: the same replay on the baseline Core (pre-P5, same base commit `7a822e42`).

Codes are shown without the `core.result.` prefix.

### Store false pass 2: run-mvtdoyf3-47ffaac1 (t563 tree, gate-es)

Shared facts: `columns/holds`, `repeated/holds`, plus `left_out_accounted` (holds or fails, as shown).

| Rev / trial (judges) | Rows | left_out_accounted | t795 verdict / basis / code | Calls / unrec. | t563 baseline |
| --- | --- | --- | --- | --- | --- |
| rev 1, 0025 (0029 yes, 0030 no, 0031 no) | 16 | holds | unsure / model_disagreed / refutation_unsupported | 5 / 2 | unsure / verdicts_disagree |
| rev 1, 0033 (0036 no, 0037 yes, 0038 no) | 16 | holds | unsure / model_disagreed / refutation_unsupported | 5 / 2 | unsure / verdicts_disagree |
| rev 1, 0040 (0043 no, 0044 no) | 16 | holds | **unsure** / model_unconfirmed / refutation_unsupported | 4 / 2 | **does_not_answer** (the binding no) |
| rev 2, 0048 (0052 no, 0053 no) | 16 | holds | unsure / model_unconfirmed / refutation_unsupported | 4 / 2 | does_not_answer |
| rev 3, 0061 (0065-0068, all no) | 13 | **fails** | **does_not_answer / core_observation / computed_fact_failed** | **0** / 0 | unsure / refutation_unsupported |
| rev 3, 0080 (0083-0086, all no) | 13 | **fails** | **does_not_answer / core_observation / computed_fact_failed** | **0** / 0 | unsure / refutation_unsupported |
| rev 5, 0120 (0124 no, 0125 yes, 0126 no, 0127 yes) | 15 | **fails** | **does_not_answer / core_observation / computed_fact_failed** | **0** / 0 | **answers** (the false pass) |
| playback 0137 (yes) | 15 | **fails** | **does_not_answer / core_observation / computed_fact_failed** | **0** / 0 | **answers** (the false pass) |

What the failing facts said:

- Rev 3: *"Core's check: the request asks for every result ("collect every search result on the first page"), and no
  words of its own leave out these 3 rows a read left out of the result: condition 2 (brand (read "Pulsebud" on a row
  it kept) is present) left out "Replacement Ear Tips …", "Brightaisle Basics Sport …", "Oakhaven Sound Grove …"."*
- Rev 5 and playback: *"… conditions 3 and 4 (name not contains ["Ear Tips"]; name not contains ["Replacement"]) left
  out "Replacement Ear Tips for Wireless Earbuds, Memory Foam Eartips, 3 Pairs (S/M/L), Black". Not one word of these
  conditions is the request's own …"*

Every expectation in the brief held:

- Rev 1 is neither refuted nor a Core no. The 0043/0044 double no is not binding.
- Rev 3, rev 5 and the playback are a Core no, from rows left out by unstated conditions, with no judge call.

**Unrecorded asks:**

- Every rev 1 and rev 2 trial asks 2 new calls: the t752 "list each defect" re-asks, and for the yes/no splits the
  t771 lone-yes confirmation (`CONFIRM_LONE_YES`).
- So F3 makes each of these nos re-askable, and the final rev 1 verdict depends on two answers no run has given.
  Offline it settles at `unsure`.

Replayed again without the `testedLabel` reconstruction (`SCR/replay-store2-notl.log`): the output is identical.

### Store false pass 1: run-mvswh11y-9d462629 (t563 tree, gate-es)

| Rev / trial (judges) | Rows | left_out_accounted | t795 verdict / basis / code | Calls / unrec. | t563 baseline |
| --- | --- | --- | --- | --- | --- |
| rev 1, 0027 (0031 unknown, 0032 no) | 16 | holds | unsure / model_unconfirmed / refutation_unconfirmed | 2 / 0 | the same |
| rev 2, 0036 (0040 no, 0041 no) | 15 | **fails** | does_not_answer / core_observation / computed_fact_failed | 0 / 0 | does_not_answer / does_not_answer_request |
| rev 3, 0045 (0048 yes, 0049 yes) | 15 | **fails** | does_not_answer / core_observation / computed_fact_failed | 0 / 0 | unsure / verdict_unavailable (1 unrec.) |
| judged whole run (0051-0053, all yes) | 15 | **fails** | does_not_answer / core_observation / computed_fact_failed | 0 / 0 | unsure / exclusion_evidence_missing (1 unrec.) |
| playback 0062-0063 (yes, yes) | 15 | **fails** | does_not_answer / core_observation / computed_fact_failed | 0 / 0 | unsure / exclusion_evidence_missing (1 unrec.) |

- The 15-row revisions fail on *"condition 3 (name not contains ["Ear Tips"]) left out "Replacement Ear Tips …""*.
- As expected: the ear-tips exclusion revisions are a Core no, and the 16-row revision is not.
- On the baseline, t790's guard already held the false yeses, but only as `unsure`, so it never gave a no.

### Social: run-mvskodlp-9966d618 (t566, rr6b-slot-3)

| Trial (judges) | Rows | Facts | t795 verdict / code | Calls / unrec. | t563 baseline |
| --- | --- | --- | --- | --- | --- |
| T1 rev 2, 0029 (0033 no, 0034 no) | 6 | columns, repeated, kept_bounds: all hold | does_not_answer / does_not_answer_request (basis model) | 2 / 0 | the same |
| **T2 rev 3, 0038 (0042 no, then 0043-0046 yes)** | 3 (= oracle) | columns, repeated: hold | **unsure / refutation_unconfirmed** | 3 / 0 (0045 and 0046 not reached) | **answers** (5 / 0) |
| playback 0058-0059 (no, no) | 3 (= oracle) | columns, repeated: hold | unsure / refutation_unsupported | 4 / 2 | the same (4 / 2) |
| repair round 0086-0089 (all no) | 0 | repeated: holds | unsure / refutation_unsupported | 4 / 0 | the same |
| repair round 0110-0114 (all no) | 0 | repeated: holds | unsure / refutation_unsupported | 5 / 0 | the same |

- The playback matches the debug's F1 expectation on both Cores. Both nos are unsupported, and each is re-asked once.
  Those two re-asks were never recorded.
- **T2 does not match the debug** ("verdict yes"). Cause below.

### Social: run-mvswewhy-e4e469d4 (t566, rr6c-slot-3)

| Trial (judges) | Rows | Facts | t795 verdict / code | Calls / unrec. | t563 baseline |
| --- | --- | --- | --- | --- | --- |
| T1 rev 1, 0029 (0033 no, 0034 no) | 24 | columns, repeated, kept_bounds: all hold | does_not_answer / does_not_answer_request | 2 / 0 | the same |
| **T2 rev 2, 0038 (0042 yes, 0043 yes)** | 3 (= oracle) | columns, repeated: hold | **unsure / verdict_unavailable** | 2 / 1 | **answers** (2 / 0, first-ask confirmed) |
| playback 0055-0059 (no, no, yes, yes, no) | 3 (= oracle) | columns, repeated: hold | unsure / refutation_unsupported | 5 / 0 | the same (5 / 0) |

T2 on t795:

- The first yes (0042) is held by the quote guard, so Core sends it the exclusion-evidence recheck. That recheck was
  never recorded, so the unrecorded call ends the check as "no answer".
- With a real model it would be one more paid call. A yes would have to name each of the held rows.

The playback:

- The debug's fix 1 (a lone-yes confirmation after a double no) is in the code (`agreement/unsupported-no.ts:119`). It
  is not reached on either Core, because call 1's re-asked yes (0057, then 0058) is itself held.
- On t795, `SCR/held-6c.log` shows two holds on 0058:
  - `bound` on condition 3: the quote is not in the sentence that names the condition (t790 D3);
  - the new together groups.
- On the baseline (`SCR/held-6c-t563.log`), 0057 and 0058 are held by the t790 bound rule alone. There are no
  together groups there. 0042 is unheld (`answers`).
- So the playback outcome is unchanged by t795, and so is the unreached confirmation.

**No Core no came from any fact on either social run, as expected.** "every home-feed post" is not an
every-result request: `request-rows/every-result.ts` counts no row noun for "post".

### The surprise: correct social builds no longer reach yes (cause traced)

`SCR/held-6c.log` and `SCR/held-6b.log` (t795 Core) show what the guard holds:

- **social 6c, 0042** (the first-ask yes that baseline confirms): held only for together groups.
  - `conditions 2, 3 and 4 (posted is present; group equals [...]; posted matches [...])`: 10 rows ("Greenleaf
    Seeds Co.", "Brightside Energy", "Memories", "Tidewater Outdoor", …).
  - `conditions 3 and 4`: 2 rows ("Tom Becker", "Aisha Khan").
  - Verdict `unsure / exclusion_evidence_missing`.
- **social 6b, 0044 and 0046** (the yeses that baseline takes): held only for `conditions 1 and 2 (group equals
  [...]; posted matches ...)`, 10 rows of the same kind.

Where in the code:

- `request-rows/unquoted-rows.ts:165` reads each read's `leftOutTogether` sets as groups (`{ together: true }`, F1 a).
- `request-rows/summary-reads.ts:174-181` (build-test reads) and `:198-203` (run reads) turn each set into a group.
- `togetherCondition` at `request-rows/summary-reads.ts:260-270` builds every such group with no `settled` and
  `testedLabel: false`.
- So at `unquoted-rows.ts:181-187` each row must be named in a sentence quoting the request. One quote per condition
  does not settle them.
- In these runs each member condition is one Core settles for its own rows (`settledKind: text` or presence). A row
  that fails two or three settled conditions is still never settled, because a group is never settled.
- The yeses accounted for the left-out rows as a class ("personal posts, suggested-group posts …, a followed page")
  and did not name the 10 page or sponsored posts.

Nothing is refuted. The effect is a correct build that does not finish on these replies. Live, it would cost one or
more extra rechecks and could end unconfirmed.

**Options (judgement call for the lead; not done here):**

- Treat a together group whose every member condition has settled this row, and whose conditions the request states,
  as settled. One quote per condition would then cover it.
- Or apply F1 a only where the request asks for every result: the case the debug was about. There, `left_out_accounted`
  now already settles it without a judge.

The store false passes do not depend on F1 a any more: `left_out_accounted` fails first and no judge is asked.

## Goal B: headed, provider-free proof on everything-store

- **Task:** `everything-store-first-page-plus-earbuds-deal-wheel`, from
  `apps/scenario-lab/src/scenarios/everything-store/live-tasks.ts:58`. Workflow `first-page-earbuds`, variant
  `deal-wheel`, seed 241, oracle step `extract-first-page`, 16 expected rows.
- **The scripts:** rev 5 is the read from 0118's script and rev 1 the read from 0023's (`SCR/flow-rev5.txt`,
  `SCR/flow-rev1.txt`).
  - The run's evidence handles (`t121`, `t934`, `extraction.8`, `extraction.2`) were replaced by the literal
    selectors the run's own playback executed (0134, 0135 and 0136 `call.json`). The sponsored field stays as a field,
    as in 0118.
  - The `done when` line (handle `t924`) was dropped.
  - The navigate URL uses the workspace's retained scenario origin.
  - The `where` lists are the run's own: rev 5 has 4 conditions, rev 1 has `sponsored is absent` only.
- **Driver:** `SCR/proof-driver.mjs`, adapted from `t790-proof-driver.mjs`. It compiles the Flow through Core's
  acceptor, validator and adaptation path (`compileMatrixFlow`), then runs `replaySavedFlow` (provider-free,
  `modelProvidersEnabled: false`, `FLUXIQ_TEST_ENV_FILES=none`).
- **Where the state lives:**
  - The first attempt ran with the run state under scratch, and both replays died at pairing: *"IO error:
    .../LOCK: File not found. (ChromeMethodBFE: 15::LockFile::4)"*. The browser profile path under the long scratch
    directory is the likely cause (Windows path length; inferred, not proven).
  - The rerun keeps the run state (workspace, browser profile) at `C:/Users/osrs_/AppData/Local/Temp/w6r`, outside
    both repos. `proof.json` and the screenshots are in `SCR/proof/`.
- **Build, under the lock:**
  - Core: `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build`, rc 0
    (`fluxiq:build` rebuilt, 80.7 s).
  - Downstream: `pnpm lab recovery-matrix --list`, the prelude t790 used, rc 0. It rebuilt `domain`, `extension`
    and `test-runner`, and reused `test-contracts`, `scenario-lab` and `test-evidence`.

| Flow | Stored | Oracle | Run status | Core result check | Model |
| --- | --- | --- | --- | --- | --- |
| rev 5 (`t795w6-rev5-bd1876`) | 15 rows; missing "Replacement Ear Tips for Wireless Earbuds, Memory Foam Eartips, 3 Pairs (S/M/L), Black" | failed (15 of 16) | failed, `output_not_observed` | **refuted: `does_not_answer`, basis `core_observation`, code `core.result.computed_fact_failed`**, reason names conditions 3 and 4 and the ear-tips row (stored record) | keys 0, interventions 0, harness 0, `llm.gate.training_mode` |
| rev 1 (`t795w6-rev1-aa3f6d`) | 16 rows, all matched | **passed** (16 of 16, 64/64 fields) | succeeded | **unverified: `performed: false`, `core.result.no_model_available`**. No Core no. | providerCallCount 0, calls 0 |

Notes on the two runs:

- Both stored records were read from the workspace's own object store (`events.0.payload.metadata.resultVerification`).
- The rev 5 action list ends with `result_verification:failed`.
- The rev 5 replay also reports *"Core published no provider call accounting for the replay"*: `coreProviderCallCount`
  is null on the failed run, while the key count stayed 0 → 0.

**UI (screenshot `SCR/proof/t795w6-rev5-bd1876/05-after-run.png`).**

- The page shows a toast: *"Couldn't fix your Flow. Run failed: it saved 15 rows, but the check found they don't
  answer what you asked, and the fix didn't finish."* With no model, the repair that follows a refutation cannot run,
  and the toast says so honestly.
- The rev 5 failure's `expected` text puts a generic paging directive first (*"To read past what step … s5 read, move
  that same list on to its next page … Where the request asks only for what its first part shows … leave the read as
  it is"*) and Core's fact only after it. For a first-page request that is noise ahead of the real finding. It comes
  from `repair-directive.ts` through `computedNo` (`verify.ts`). Minor; not changed.

## Goal C: downstream checks (t795 downstream tree)

- `node scripts/check/model-text.mjs`: exit 0. Output: *"model-text: ok (209 scenario tokens, 379 model-facing Core
  files, 11857 string literals)"*.
- `node scripts/structure-audit.mjs` (the command `docs/architecture/repository-layout.md` names): exit 0. Output:
  *"structure-audit: passed (232 warning(s), 616 baselined)"*. The warnings are advisory `file-lines`.

## Commands run and observed results

Every heavy command ran inside
`until mkdir /c/Users/osrs_/FluxStuff/lab-slots/heavy-check.lock; do sleep 20; done; …; rmdir …`.

- `W6_CORE=<t795|t563> node --experimental-transform-types SCR/replay.mts <steps> <label>`, from each Core's
  `packages/fluxiq`, for the 4 runs on both Cores: 8 runs, all exit 0. Logs: `SCR/replay-<label>-<core>.log`, with
  JSON beside them.
- `SCR/held-probe.mts`:
  - on t795 for 6c 0042/0058 and 6b 0044/0046: exit 0;
  - on t563 for 6c 0042/0057/0058: exit 0. 0042 is `answers` with nothing unquoted; 0057 and 0058 are held only
    `bound` on condition 3 (and on condition 4 for 0057).
- Core build: rc 0. `pnpm lab recovery-matrix --list`: rc 0.
- Proof driver:
  - first attempt (run state in scratch): both `gateway.connection` at pairing;
  - rerun: rev 5 `verdict: failed` (expected: oracle 15/16, Core refuted), rev 1 `verdict: passed`.
- `node scripts/check/model-text.mjs`: 0. `node scripts/structure-audit.mjs`: 0.

## Not verified

- **What the summaries can and cannot show.** The replays rebuild verify's input from the judge's copy of the
  summary. Row ids are unsaid and `testedLabel` is rebuilt. Fields the judge copy drops or adds cannot be restored
  exactly. Store 2 gives the same result with and without the rebuild; the other runs were not cross-checked that way.
- **Unrecorded asks.** Every outcome downstream of an UNRECORDED call is "no answer", not a model's answer. This
  covers the final verdicts of store 2 rev 1 and rev 2, social 6b playback and social 6c T2.
- **The deal wheel in Goal B.** Whether it appeared during the proof is unknown: `harnessActivations` was 0 for both
  runs, and I did not inspect each screenshot.
- **Headed mode.** The replay browser is the Lab's (`openReplayBrowser`, headed by the Lab rule). I did not check the
  window on screen, and saw only the screenshots it took.
- **Coverage.** Store 2's 0048 trial (rev 2) was added beyond the brief's list. Nothing about the build loop
  (`closedDigests`, the builder) was replayed, only the verifications.

## Open questions or contradictions found

1. **F1 a (together rows held to the quote rule) makes correct builds fail to reach yes** on both social runs. The
   baseline gives `answers` on the same replies. Cause and options are above. Lead decision: settle a group whose
   member conditions each settled the row and are the request's own, or scope F1 a to every-result requests, which
   `left_out_accounted` already covers.
2. With F3, store 2 rev 1's nos become re-askable, and each rev 1 trial costs 2 more calls live (the t752 re-asks,
   and the lone-yes confirmation). Whether they come back yes is unknown. If they do not, rev 1 stays unsure: never
   locked, but never finished either.
3. A Core no's failure `expected` leads with a generic paging directive before the fact's own sentence (Goal B
   note).
