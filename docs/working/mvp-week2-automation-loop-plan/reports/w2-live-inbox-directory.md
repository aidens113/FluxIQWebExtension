# Live creation run — social-inbox and company-directory (instance `inbox-a`)

Date: 2026-09-17 (runs 2026-09-18T00:18Z – 00:36Z)
Instance: `inbox-a` · Campaign: `2026-09-18T00-16-42-637Z`
Summary: `test-runs/campaigns/2026-09-18T00-16-42-637Z/summary.md`

## Outcome

**Blocked. Nothing was measured about the model.** All 13 tasks ran, all 13
failed, and **not one reached DeepSeek**. Campaign totals:

```
{"tasks":13,"passed":0,"succeeded":0,"failed":12,"noResult":1,
 "judgementsPassed":0,"providerCalls":0,"reportedTokens":0,"reportedCostUsd":0}
```

No run produced `snapshots/live-llm.json` at all — the file is absent in every
run directory, so there is no `observed.calls`, no `observed.accounting`, and no
`exploration` record to report. `evaluation.json` carries `llm.calls: 0` and
`extraction: null` in all twelve runs that produced one. This is not the
"`observed.calls` reads 1 while accounting shows 0 tokens" case (a call refused
locally): no call was ever constructed, because the run failed during setup.

**Zero tokens, $0.00 spent.** The fixtures themselves were never exercised, so
this report says nothing about the twin accounts, lazy loading, missing
headcounts, pagination, or drift variants.

## Root cause (12 of 13 runs)

Every one of the twelve runs that produced a run directory failed at the same
point, with byte-identical error text, recorded as `events.ndjson` sequence 2:

```
FluxIQ control request failed:
/api/programs/automation-studio/update-flow-settings (400):
LLM execution limit is invalid.
```

`evaluation.json`: `verdict: failed`, `failureCategory: "environment.missing"`,
`facilityFailure: {boundary: "finalized-bundle", stage: "scenario.execute",
reason: "unclassified"}`, `flowCreated: false`, `oracleVerdict: null`,
`reportedVerdict: null`.

The message comes from Core:
`packages/fluxiq/src/programs/automation-studio/api/handlers/bounded-whole-number.ts`,
called by `llm-execution-settings.ts::assertFlowLlmExecutionSettings`.

The Lab pins the created Flow's limits through `update-flow-settings`
(`packages/test-runner/src/live-llm/flow-settings.ts`). The campaign sends, per
the logged command line, `--llm-max-input-tokens 48000 --llm-max-output-tokens
8000 --llm-max-total-tokens 56000`. Checked field by field against Core's
**committed** bounds:

| field | value sent | committed bound | result |
| --- | --- | --- | --- |
| `maxInputTokens` | 48 000 | 1 – 50 000 | ok |
| `maxOutputTokens` | 8 000 | 1 – 50 000 | ok |
| **`maxTotalTokens`** | **56 000** | **1 – 50 000** | **rejected** |
| `maxCalls` | 26 | 1 – 64 | ok |
| `timeoutMs` | 25 000 (clamped from 30 000) | 1 – 25 000 | ok |
| `maxEstimatedCostUsd` | 0.25 | ≤ 0.25 | ok |
| in + out vs total | 56 000 vs 56 000 | ≤ total | ok |

`maxTotalTokens` is the single failing value.

### Why the already-written fix did not apply

Core's working tree **already raises that ceiling to 64 000**, with the comment
"64k is deepseek-chat's own context window. These were 50_000, the sixth and
last place holding a ceiling…". Against 64 000 every field above passes.

That edit is **uncommitted** (`git status` shows `llm-execution-settings.ts`
modified against Core `37679ce`) and, decisively, it **postdates the Core build
these runs used**:

- Core source edited at **17:25:40** local (`00:25:40Z`).
- Run 1 built Core's web app, log written **17:20:46** local — five minutes
  earlier. `processExits.core-web-build: 0`.
- **No later run rebuilt Core**: `logs/core-web-build.log` exists only in
  `run-mu67n25f-4066b65c` and in none of the other eleven.

So all 13 runs executed against a Core compiled from the 50 000 source. The
Lab's `core-build` probe scans Core's **build output**, not its source — it
reported `{"state":"quiet","files":2804,"newest":"2026-09-17T22:22:44.560Z"}`
unchanged on every run — so nothing in the campaign notices a Core source change
or triggers a rebuild.

**A rerun will keep failing until Core's web app is rebuilt.** That rebuild is
not a safe unilateral act right now: sibling campaigns are running concurrently
against the same shared Core build, and rebuilding it underneath them deletes
modules their runs import (exactly what the `core-build` quiet probe exists to
prevent). It needs sequencing by the supervisor.

## Second, separate failure (1 of 13)

`social-inbox-answer-mention-restyled` returned **`no-result`** — no run
directory, so it is not one of the twelve above. It died in the facility build:

```
ENOENT: lstat 'F:\!FluxIQWebExtension\domain\dist\runtime\llm-evidence\capture.d.ts'
ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL @fluxiq-web-extension/domain@0.1.0 build
{"status":"failed","category":"environment.missing",
 "message":"pnpm --filter @fluxiq-web-extension/test-runner... build exited with 1"}
```

This is a shared-checkout build race: `domain`'s `clean-dist.mjs` removed
`domain/dist` while another concurrent agent's build was compiling against it.
An artifact of several agents sharing one working tree, not a product defect.
The campaign's RAM-fault retry did not cover it (that retry only applies to the
known hardware signatures), so the task was abandoned after the attempt.

## Per-task results

All thirteen carry the same story. `live-llm.json` is absent in every case, so
`observed.calls`, `observed.accounting` and `exploration` have no values to
quote; `extraction` is `null`, so `expectedRecords` / `observedRecords` /
`matchedRecords` / `presentFields` / `pagesFollowed` were never computed.

| # | task | verdict | runId | blocker |
| --- | --- | --- | --- | --- |
| 1 | social-inbox-answer-mention | failed | run-mu67n25f-4066b65c | Core 400 |
| 2 | social-inbox-answer-mention-restyled | no-result | — | domain build race |
| 3 | social-inbox-answer-mention-moved-send | failed | run-mu67sisv-bbdeb11f | Core 400 |
| 4 | social-inbox-unanswered-backlog | failed | run-mu67tth4-aa258628 | Core 400 |
| 5 | social-inbox-unanswered-backlog-quiet | failed | run-mu67uqgh-dda2ca7f | Core 400 |
| 6 | social-inbox-first-screen | failed | run-mu67w0fx-47380fa7 | Core 400 |
| 7 | social-inbox-open-conversation | failed | run-mu67yb0y-2c895bc5 | Core 400 |
| 8 | company-directory-register-page | failed | run-mu67zbfc-8be3a5c0 | Core 400 |
| 9 | company-directory-logistics-sector | failed | run-mu68091y-06885b91 | Core 400 |
| 10 | company-directory-logistics-sector-relabelled | failed | run-mu6823vt-bada572d | Core 400 |
| 11 | company-directory-no-companies | failed | run-mu6839r6-ec081955 | Core 400 |
| 12 | company-directory-company-profile | failed | run-mu6842f8-c601fa5a | Core 400 |
| 13 | company-directory-last-page | failed | run-mu684tto-aa24a380 | Core 400 |

"Core 400" is in every case exactly
`update-flow-settings (400): LLM execution limit is invalid.`, confirmed by
reading the last `events.ndjson` summary of each of the twelve run directories
individually, not inferred from the campaign verdict line.

The three failure shapes the brief asked me to hunt for — a `reportedVerdict`
that disagrees with `oracleVerdict`, a Flow that ignores the filter, and rows
refused by record validation — **could not occur here**. Both verdict fields are
`null` and no Flow was built (`flowCreated: false`) in any run.

## What to do next

1. **Rebuild FluxIQ Core's web app** so the 64 000 ceiling takes effect, once
   the concurrently running campaigns can tolerate it. Committing Core's
   `llm-execution-settings.ts` change belongs with that.
2. Re-run this exact 13-task slice afterwards; the command is unchanged.
3. Consider whether the Lab should fail loudly when Core's *source* is newer
   than Core's *build*. Today the probe watches build output only, so a Core fix
   can sit in the tree while every live run silently tests the old ceiling —
   which is precisely what happened across this whole slice.

## Not verified

- Nothing about model behaviour on these fixtures: twin-account
  disambiguation, lazy-load page counts, the state left by `answer-mention`,
  missing-headcount handling, pagination depth, the empty `no-companies`
  result, or any drift variant.
- That rebuilding Core actually clears the 400. The arithmetic says it should
  (56 000 ≤ 64 000) and the field-by-field check above is reproducible, but no
  run has yet been made against a rebuilt Core.
- Whether the `restyled` build race recurs when agents are not sharing the
  checkout.

## Commands run

```
FLUXIQ_TEST_ENV_FILES=none FLUXIQ_TEST_TARGET=isolated FLUXIQ_LAB_INSTANCE=inbox-a \
  pnpm lab:campaign <13 task ids>
```

Exit code 1. Full log kept in the session scratchpad; no secrets in this report.
