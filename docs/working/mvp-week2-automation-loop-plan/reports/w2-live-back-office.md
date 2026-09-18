# Live back-office slice (ops-a): ten creation tasks against real DeepSeek

Date: 2026-09-18. Instance `ops-a`. Target `isolated`. Provider `deepseek` /
`deepseek-chat`, real calls, real spend.

Headline: **0 of 10 passed.** Not one of the five state-changing jobs built a
Flow at all, so none of them performed a change, and none reached the
confirmation dialog. The three Flows that were built were all
navigate → extract → end, ignored the filter, returned every row, and each one
reported `succeeded` while the oracle said `failed`.

---

## 1. The prescribed command cannot run at all (blocker, affects every agent)

The command in the brief failed **100% of tasks before a single provider call**,
with this exact error in every run:

```
FluxIQ control request failed:
/api/programs/automation-studio/update-flow-settings (400):
LLM execution limit is invalid.
```

Cause, confirmed by reading both repositories:

- The Lab campaign asks for `--llm-max-total-tokens 56000`
  (`scripts/lab/live-campaign/lab-run/command.mjs`, `CREATE_LIMITS` and
  `REPAIR_LIMITS`, both lines 13 and 39).
- Core refuses anything above 50,000:
  `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\api\handlers\llm-execution-settings.ts:17-19`
  bounds `maxInputTokens`, `maxOutputTokens` and `maxTotalTokens` to
  `(1, 50_000)` each. `56000 > 50_000` throws
  `"LLM execution limit is invalid."` from `bounded-whole-number.ts:5`.
- Core's `dist` copy carries the same 50,000, so this is not a stale build.

This is a genuine cross-repository drift: the extension repo raised the Lab's
creation ceiling to 48k/8k/56k (commits `dc0490d`, `0895b74`, `e066737`) but
Core's API validator was never raised to match. Note the ceiling raise is well
motivated — the comment on `CREATE_LIMITS` records that 8,000 input tokens
produced seven `provider_input_budget_exceeded` failures out of ten — so the
fix belongs in Core's bound, not in the Lab.

**This was not specific to my slice.** At the same moment, the three sibling
campaigns were failing every task with the identical error:

| instance | latest run | first failure |
| --- | --- | --- |
| `prop-a` | run-mu67xb58-0df2d9a7 | same 400, `LLM execution limit is invalid.` |
| `soc-a` | run-mu67xuhk-87dc309a | same 400 |
| `inbox-a` | run-mu67w0fx-47380fa7 | same 400 |

Runs lost to this on ops-a before I stopped the campaign:
`run-mu67s9r0-e95c5b1e`, `run-mu67vfjb-6bbce012`, `run-mu67wud3-8f7c3390`.

### Deviation from the brief, and why

To get any live data I re-ran the same ten tasks with **one change**: the token
ceilings lowered to fit Core's bound, passed as a supported CLI override after
`--`, editing no file:

```
-- --llm-max-input-tokens 42000 --llm-max-total-tokens 50000
```

Output stays 8,000, run tokens 600,000, cost ceiling $0.25. `42000 + 8000 =
50000 ≤ 50000` satisfies both Core checks. The campaign documents this override
("a limit given after `--` replaces its default"), and a `--dry-run` confirmed
the emitted command. Everything else is exactly as briefed:
`FLUXIQ_TEST_ENV_FILES=none`, `FLUXIQ_TEST_TARGET=isolated`,
`FLUXIQ_LAB_INSTANCE=ops-a`.

Caveat: the model therefore had 42,000 input tokens per call, not 48,000. That
is still five times the old default, but it is not the configuration the brief
asked to measure. Once Core's bound is raised these ten should be re-run at
48k/8k/56k.

---

## 2. Results

Campaign `2026-09-18T00-29-12-596Z`. Totals reported by the campaign and
independently recomputed from the ten `live-llm.json` snapshots — they agree:
**78 provider calls, 373,379 tokens, $0.17540**.

| task | changes state | Flow built | reported | oracle | disagree | calls | tokens | cost | flow shape | rows obs/exp/matched | failure |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| support-desk-triage-backlog | yes | **no** | – | – | – | 11 | 51,129 | $0.02420 | – | – | `evidence_unusable_decision` / `bootstrap.unknown_parameter` |
| support-desk-sla-breaches | no | yes | succeeded | **failed** | **YES** | 4 | 21,598 | $0.01035 | 2 nodes: navigate×1 + extract_list×1 | 320/12/**0** | – |
| support-desk-sla-breaches-recovered | no (drift) | yes | succeeded | **failed** | **YES** | 2 | 11,160 | $0.00526 | 3 nodes: navigate×1 + extract_list×1 | 320/3/**0** | – |
| support-desk-reply-and-resolve | yes | **no** | – | – | – | 11 | 43,299 | $0.02058 | – | – | `evidence_unusable_decision` / `bootstrap.unknown_parameter` |
| support-desk-escalate-longest-breach | yes | **no** | – | – | – | 14 | 83,148 | $0.03796 | – | – | `evidence_tool_failed` (`web.handle.unknown_field`) |
| order-operations-partial-refund | yes | **no** | – | – | – | 10 | 49,927 | $0.02342 | – | – | `evidence_repeat_without_progress` |
| order-operations-batch-export | no | yes | succeeded | **failed** | **YES** | 4 | 19,134 | $0.00909 | 3 nodes: navigate×1 + extract_list×1 | 280/13/**0** | – |
| order-operations-batch-export-quiet-week | no (edge) | **no** | – | – | – | 5 | 20,076 | $0.01005 | – | – | `evidence_unusable_decision` / `bootstrap.required_input_unconnected` |
| order-operations-line-items | no | **no** | – | – | – | 10 | 40,843 | $0.01900 | – | – | `evidence_repeat_without_progress` |
| order-operations-dispatch-run | yes | **no** | – | – | – | 7 | 33,065 | $0.01549 | – | – | `evidence_unusable_decision` / `bootstrap.unknown_parameter` |

`exploration` was `null` in all ten runs — bounded exploration was never
requested or granted anywhere in this slice.

---

## 3. The four failure shapes I was told to look for

**Shape 1 — reported `passed` while the oracle says `failed`: CONFIRMED, and in
every case where a Flow actually ran.** All three Flows recorded
`status: "succeeded"` in `snapshots/flow-lane.json` alongside
`oracleVerdict: "failed"`. Each action is even marked
`succeeded/matched` individually. The run is only saved from claiming success
by the extract-count check downstream. A consumer reading `status` alone would
be told all three worked.

**Shape 2 — navigate → extract → end that ignores the filter: CONFIRMED, 3 of
3.** Every Flow built in this slice is the same two-action shape,
`web.browser.navigate` + `web.dom.extract_list`, with no filter, search, or
row-selection action anywhere:

- `sla-breaches`: returned **320** tickets, expected 12, matched **0**.
- `sla-breaches-recovered`: returned **320**, expected 3, matched **0**.
- `batch-export`: returned **280** orders, expected 13, matched **0**.

`presentFields` equals `expectedFields` in all three (72/72, 18/18, 65/65), so
the model picked the right columns and simply never narrowed the rows. It read
the whole table off the first screen.

**Shape 3 — rows found but all refused by validation: NOT SEEN.**
`invalidRows: 0` and `storeTruncated: false` in all three extracting runs. The
rows were real; there were just far too many of them.

**Shape 4 — a state-changing job that reads correctly and never performs the
change, yet reports success: NOT SEEN, because something worse happened.** No
state-changing job got far enough to run. All five failed during authoring, so
the run correctly reported failure rather than a false success. There is no
false-success bug hiding here — there is a total inability to author the change.

**Locally-refused calls: none.** In all ten runs `observed.calls` equals
`observed.accounting.calls` and tokens and cost are non-zero, so every counted
call reached DeepSeek. `unrecordedCalls` is `null` and `interventions` is `0`
throughout.

---

## 4. What actually stopped the five state-changing jobs

None of them produced a Flow, so nothing on any page changed. Reading the
evidence loop call by call from `build.evidenceLoop.steps`, exploration itself
worked — the failure is in turning what was seen into a Flow node.

- **triage-backlog** (11 calls, $0.0242). Inspected the page, detected the
  repeating ticket structure, applied `web.reveal_safe` successfully, detected
  structure again — then every attempt to emit a Flow was refused:
  `bootstrap.invalid_parameter_value`, then `bootstrap.unknown_parameter` three
  times in a row. It exhausted the budget on rejected decisions.
- **reply-and-resolve** (11 calls, $0.0206). Same ending:
  `bootstrap.unknown_parameter` four times. Note `web.reveal_safe` was rejected
  `target_unsafe` once and `no_progress` once along the way.
- **escalate-longest-breach** (14 calls, 83,148 tokens, $0.0380 — the most
  expensive). This one **did navigate between screens**: eight successful
  `web.navigate_same_origin` calls interleaved with structure detection. It
  died on `web.handle.unknown_field` and then
  `flow_bootstrap.evidence_tool_failed`.
- **partial-refund** (10 calls, $0.0234). Hit
  `bootstrap.required_input_unconnected`, `bootstrap.unknown_parameter` and
  `bootstrap.invalid_parameter_value`, then looped and was cut off with
  `flow_bootstrap.evidence_repeat_without_progress`. It never reached the
  confirmation dialog — the dialog was never exercised because no refund action
  was ever authored.
- **dispatch-run** (7 calls, $0.0155). `bootstrap.unknown_parameter` twice, plus
  a `web.reveal_safe` refused `target_unsafe` and a repeat detected as
  `already_answered`.

Not one Flow in the whole slice contains a `web.dom.click`, `web.dom.select` or
`web.dom.fill` node. **Zero state-changing actions were authored across 78
provider calls.**

### Cross-screen reading

At least one job per fixture was supposed to read a value on one screen and use
it on another. Only `escalate-longest-breach` and, weakly, `partial-refund` and
`line-items` attempted navigation at all (`web.navigate_same_origin`), and all
three failed before authoring. The three Flows that were built each contain
exactly one `web.browser.navigate` node and then extract from wherever they
land — they do everything from the list and never navigate a second time. So
the cross-screen pattern was never demonstrated end to end.

---

## 5. Blockers worth fixing, in the order they cost the most

1. **Core's 50,000 token bound vs the Lab's 56,000 request.** Blocks every live
   campaign on this machine outright. One-line change in
   `llm-execution-settings.ts`, or revert the Lab's ceiling — but the Lab's
   ceiling is the better-argued of the two.
2. **The model cannot author a state-changing node.** Five of five failed, with
   `bootstrap.unknown_parameter` dominant (3 tasks), then
   `required_input_unconnected` and `invalid_parameter_value`. Core's message is
   "Node parameter is not declared by its definition."
   (`flow-bootstrap/authoring/normalise.ts:40`, `assemble.ts:167`,
   `plan/validation.ts:160`). This is the single thing standing between this
   slice and any result.
3. **Run artifacts record the issue code but never the offending parameter.**
   Core builds the path as `${path}.parameters.${key}`, but nothing in the run
   directory keeps it — `core.log` is 348 bytes and `bundle.complete.json`
   holds no authoring issues. From a finished run you cannot tell *which*
   parameter the model reached for, which makes blocker 2 much harder to fix
   than it needs to be. Worth capturing the issue paths into the snapshot.
4. **Filters are ignored by every Flow that gets built.** Three for three, the
   model reads the whole table. Whatever is in the prompt about narrowing rows
   is not landing.
5. **`status: "succeeded"` on a Flow whose oracle failed.** Three for three.
   Worth deciding whether `status` should mean "ran without error" or "did the
   job", because right now it reads as the latter and means the former.

---

## 6. What I did not verify

- The three passing-shaped extractions were judged only by record counts and
  field names from `flow-lane.json`; I did not open the extracted datasets to
  confirm the 320/280 rows are the right rows.
- No manual browser validation. Everything here is from run artifacts.
- The specific parameter names Core rejected are not recoverable from the
  artifacts (see blocker 3), so "the model cannot author a change" is an
  inference from the issue codes, not from seeing the rejected JSON.
- These are single observations per task. This machine has faulty RAM, but that
  is not a plausible explanation here: the failures are uniform, reproducible in
  shape across ten tasks and two fixtures, and every one carries a specific
  validation code rather than a crash.
- The ten tasks were **not** run at the briefed 48k/8k/56k ceiling. See §1.

## 7. Artifacts

- Campaign summary:
  `F:\!FluxIQWebExtension\test-runs\campaigns\2026-09-18T00-29-12-596Z\summary.md`
- Per-run: `F:\!FluxIQWebExtension\test-runs\instances\ops-a\<runId>\`, with
  `snapshots\live-llm.json` (calls, accounting, build loop),
  `snapshots\flow-lane.json` (reported status, oracle verdict, `flowShape`,
  actions, extraction) and `evaluation.json`.
- `createdFlowShape` is **not** a field of `evaluation.json`; it is `flowShape`
  in `snapshots\flow-lane.json`. Worth correcting in future briefs.
