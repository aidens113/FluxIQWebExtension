# Live creation run — social scheduler fixture (instance `soc-a`)

Status: **Blocked.** The campaign ran, but no task reached DeepSeek. Every run
died at the same place, before a single provider call, with the same HTTP 400.
No judgement of the fixture was produced, so nothing here says anything about
whether the model can schedule a post, retry failures, or read the queue.

The same failure is hitting the other live instances running right now, so this
is a session-wide blocker rather than anything about this fixture.

## What was run

```
FLUXIQ_TEST_ENV_FILES=none FLUXIQ_TEST_TARGET=isolated FLUXIQ_LAB_INSTANCE=soc-a \
  pnpm lab:campaign social-scheduler-schedule-post \
    social-scheduler-schedule-post-restyled \
    social-scheduler-schedule-post-renamed-composer \
    social-scheduler-retry-failed \
    social-scheduler-retry-failed-quiet-week \
    social-scheduler-week-ahead \
    social-scheduler-week-ahead-reordered-columns \
    social-scheduler-whole-queue
```

with `DEEPSEEK_API_KEY` exported by hand from `.env.local`, as the brief
specified. The key was read and never printed.

Each task is dispatched by the campaign as:

```
pnpm lab run social-scheduler [--variant <v>] --live-llm --llm-profile lab-create-flow \
  --llm-provider deepseek --llm-model deepseek-chat --llm-task create-flow \
  --instruction-task <task> \
  --llm-max-input-tokens 48000 --llm-max-output-tokens 8000 \
  --llm-max-total-tokens 56000 --llm-max-run-tokens 600000 --llm-max-cost-usd 0.25
```

The campaign was stopped by hand after the fourth task started, once the cause
was proven at source level and confirmed across two other scenarios in two other
instances. Continuing would have spent roughly twelve more minutes producing
five more identical facility failures and no information.

## The blocker

Every run failed at evidence sequence 2, in `scenario.execute`, with:

```
FluxIQ control request failed:
/api/programs/automation-studio/update-flow-settings (400): LLM execution limit is invalid.
```

classified as `environment.missing`, boundary `finalized-bundle`.

The cause is an unraised ceiling in Core. It is deterministic — not hardware
noise, not a flaky provider, and it will reproduce on every attempt.

Core commit `37679ce` *"Size the token limits to the model, not to a number
nobody chose"* deliberately moved the per-request budget to **48,000 in /
8,000 out / 56,000 total**, and says in its own message that the ceiling
"existed in four places": the Lab's default budget, the Lab's plan cap, the
grant default, and the provider-side hard rejection. It raised all four.

It missed a fifth, and the fifth is the first gate the Lab crosses:

- `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\api\handlers\llm-execution-settings.ts`
  lines 17–19 still read

  ```ts
  const maxInputTokens  = boundedWholeNumber(tokenLimits.maxInputTokens,  1, 50_000);
  const maxOutputTokens = boundedWholeNumber(tokenLimits.maxOutputTokens, 1, 50_000);
  const maxTotalTokens  = boundedWholeNumber(tokenLimits.maxTotalTokens,  1, 50_000);
  ```

  `boundedWholeNumber` throws `"LLM execution limit is invalid."` for anything
  outside the range. `maxTotalTokens = 56_000 > 50_000`, so the Flow's execution
  settings can never be written — and
  `packages/test-runner/src/live-llm/flow-settings.ts` writes them before any
  run begins, through this very endpoint.

The mismatch is visible from both sides. The Lab's mirror of Core's ceilings, in
`packages/test-runner/src/live-llm/live-llm-plan.ts`, names this exact function
in its comment and has already been raised:

```ts
/** Core's own ceilings (`assertFlowLlmExecutionSettings`, `AutomationStudioLlmExecutionGrantService`). */
/** Core's per-request ceiling, which is deepseek-chat's own 64k context. */
const CORE_MAX_TOKENS = 64_000;
```

So the Lab believes Core accepts 64,000 while Core's validator accepts 50,000.

### A sixth ceiling sits directly behind it

Raising only the handler moves the failure one step deeper rather than fixing
it. `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\llm\harness\token-limits.ts`
line 4 still holds

```ts
export const AUTOMATION_STUDIO_LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST = 50_000;
```

and `resolveAutomationStudioLlmTokenLimits` clamps any requested limit above it
back to 50,000 while emitting an `llm_budget.absolute_token_ceiling` **error**
diagnostic. Commit `37679ce` raised the literal `50_000` inside
`validateDeepSeekRequest` to `64_000` but left this shared constant alone, even
though `deepseek-provider.ts` still imports it and enforces it in
`estimateAutomationStudioDeepSeekCostUsd` (line 162). A third 50,000 bound sits
in `api/handlers/llm-generation.ts` line 212, for flow-bootstrap generation
limits.

These two were read from source, not observed failing — the run never got past
the first gate. They are named so the next attempt does not rediscover them one
at a time.

### It is not confined to this fixture

The newest run in each live instance, read from its `summary.json`:

| Instance | Run | Started | Verdict | First failure |
| --- | --- | --- | --- | --- |
| `camp-a` | `run-mu65ogx2-bf0eb017` | 23:23 | passed | — |
| `camp-b` | `run-mu65puv2-cb9813fe` | 23:24 | failed | `flow_bootstrap.provider_input_budget_exceeded` |
| `camp-c` | `run-mu65rmko-3097ac40` | 23:26 | failed | `flow_bootstrap.provider_input_budget_exceeded` |
| `camp-d` | `run-mu65t11f-5cefaf62` | 23:27 | passed | — |
| `camp-e` | `run-mu660p1e-efa4194c` | 23:33 | failed | `flow_bootstrap.evidence_tool_failed` |
| `prop-a` | `run-mu67u9jl-611dfefa` | 00:24 | failed | `update-flow-settings (400): LLM execution limit is invalid.` |
| `inbox-a` | `run-mu67uqgh-dda2ca7f` | 00:24 | failed | `update-flow-settings (400): LLM execution limit is invalid.` |

The shape is legible: the 23:2x runs were made under the old limits and failed
with `provider_input_budget_exceeded`, which is precisely what `37679ce` set out
to fix. The three instances started after the raise — `soc-a`, `prop-a`,
`inbox-a`, across three unrelated scenarios — all now fail at the settings write
instead. The raise traded one blocker for another and currently stops every live
creation run.

## Per-task results

| Task | Judgement | Run id | `observed.calls` | Tokens / cost | Exploration |
| --- | --- | --- | --- | --- | --- |
| `social-scheduler-schedule-post` | no-result (facility failure) | `run-mu67lsgq-5abb7ac2` | no `live-llm.json` written | 0 / $0 | none |
| `social-scheduler-schedule-post-restyled` | no-result (facility failure) | `run-mu67q6sl-6a47b25b` | no `live-llm.json` written | 0 / $0 | none |
| `social-scheduler-schedule-post-renamed-composer` | no-result (facility failure) | `run-mu67r6jp-8ff1838e` | no `live-llm.json` written | 0 / $0 | none |
| `social-scheduler-retry-failed` | not reached (started, stopped before any artifact) | — | — | 0 / $0 | — |
| `social-scheduler-retry-failed-quiet-week` | not reached | — | — | — | — |
| `social-scheduler-week-ahead` | not reached | — | — | — | — |
| `social-scheduler-week-ahead-reordered-columns` | not reached | — | — | — | — |
| `social-scheduler-whole-queue` | not reached | — | — | — | — |

Each observed run's `evaluation.json` reads identically:

- `verdict: "failed"`; the single invariant `runner-verdict` failed with
  `actual: "failed: environment.missing"`
- `oracleVerdict: null`, `reportedVerdict: null` — **no verdict disagreement to
  report, because neither side produced a verdict.** The
  `reportedVerdict: passed` / `oracleVerdict: failed` divergence the brief asked
  about could not arise here.
- `flowCreated: false`, `actions: []`, `extraction: null`, no `createdFlowShape`
- `snapshots/` holds only `redaction-attestation.json`. There is no
  `snapshots/live-llm.json` at all, which is the strongest available evidence
  that no provider call was attempted. This is one step earlier than the
  "`observed.calls: 1` with 0 tokens and $0" shape the brief warned about: that
  shape means a call was refused locally after being recorded, whereas here the
  run never reached the point of recording one.

Total spend against DeepSeek for this campaign: **zero calls, zero tokens,
$0.00.**

## Ground truth the run never got to test

Read from the fixture so the next attempt can judge without rediscovering it.
`apps/scenario-lab/src/scenarios/social-scheduler/tests/scenario.test.ts`
asserts these counts, so they are the manifest's own numbers rather than an
estimate:

| Task | Expected records | Why |
| --- | --- | --- |
| `whole-queue` | 280 | `QUEUE_SIZE` — every row, no filter |
| `week-ahead`, `week-ahead-reordered-columns` | **14** | Northwind Trails, range `next-7` |
| `retry-failed` | **10** | posts that failed in the last seven days |
| `retry-failed-quiet-week` | **3** | the variant's calmer week |

A `week-ahead` run that returns 280 records has built the
navigate → extract → end Flow the brief warns about and ignored the filter
entirely. 14 is the only correct answer, and the built Flow must contain a step
that narrows — the recording uses two `select` operations on
`testid:account-filter` and `testid:range-filter` before the extract.

The instructions the tasks carry:

- **schedule-post**, all three variants: *"Schedule a post to the Northwind
  Trails account for the morning of 24 September at nine o'clock, saying: Trail
  clean-up on Saturday: meet at the Harbour Loop car park at nine, gloves and
  bags provided. Then confirm it is sitting in the queue."* Judged by
  `playback-goal`. Its success facts are the toast
  `Post scheduled to @northwind-trails for <slot>` **and** the queue header
  stats recomputed after the compose — so the state left behind, not the run
  finishing. `renamed-composer` is passable only by a repair: the recorded
  submit control lost its test id and now reads *Add to queue*, with *Save as
  draft* beside it, which schedules nothing and fails the oracle.
- **retry-failed**, both variants: *"Find every post that failed to go out in
  the last seven days, put all of them back in the publishing queue, and then
  give me a table of what was retried with columns account, post and status."*
- **week-ahead**, both variants: *"Export the coming week's schedule for the
  Northwind Trails account as a table with columns account, post, scheduled and
  status."*
- **whole-queue**: *"Scrape the whole publishing queue, every post in it, into a
  table with columns account, post, scheduled and status."*

### The account trap, corrected for whoever runs this next

The brief framed this as "two accounts share a display name, so a task naming
one account must reach the right one". Reading
`apps/scenario-lab/src/scenarios/social-scheduler/accounts.ts`, the shared name
is **"Northwind Outdoors"** — `@northwind-outdoors` on Chirp and
`@northwind.outdoors` on Photogram. A second pair, `@northwind-co` and
`@northwind-clips`, share the avatar letters **NC**.

**No task in this slice names either ambiguous pair.** Every account-specific
task names *Northwind Trails*, which is unique. The live hazard for these eight
tasks is therefore adjacent rather than identical: all eight accounts begin
"Northwind", and one is *"Northwind Outdoors EU"*, so a prefix or fuzzy match
can still land on the wrong account. The correct target is
`acc_photogram-northwind-trails` — option value `photogram-northwind-trails`,
handle `@northwind-trails`, network Photogram. The check the brief asked for
still stands: read which account the work landed on, not merely whether the run
succeeded. But exercising the twin-name trap proper would need a task that names
"Northwind Outdoors", and this slice has none.

## What was not verified

- Nothing whatsoever about the model's behaviour on this fixture. No Flow was
  built, no action executed, no record extracted, no account chosen.
- The five unrun tasks are reported as "not reached", not as failures of the
  fixture or of the model.
- The fifth ceiling is confirmed by the live 400. The sixth
  (`AUTOMATION_STUDIO_LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST`) and the
  `llm-generation.ts` bound are static source reads at Core `HEAD = 37679ce`,
  with unrelated uncommitted edits present in Core's working tree from
  concurrent work. They have not been observed failing.

## What would unblock it

One change, in Core, because this is Core's own contract and not something to
approximate downstream: raise the three `50_000` bounds in
`assertFlowLlmExecutionSettings` to `64_000`, matching the ceiling `37679ce` set
in the other four places and the `CORE_MAX_TOKENS = 64_000` the Lab already
mirrors. Expect `AUTOMATION_STUDIO_LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST` to
need the same treatment immediately afterwards, since
`resolveAutomationStudioLlmTokenLimits` will otherwise clamp 56,000 back to
50,000 and raise an error diagnostic in its place.

A check that fails the build would have caught this: the ceiling is a single
number duplicated across six sites in two repositories, and the Lab's mirror
already documents which Core symbols it is copying.

No source file was edited and nothing was committed by this run.
