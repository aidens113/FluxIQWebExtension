# t105 — `deepseek-flash`, a configurable model, and the corrected price list

Worker report. Worktrees `F:/fxwork/t105/!FluxIQWebExtension` and
`F:/fxwork/t105/!FluxIQ`, both on `task/t105-deepseek-flash-model`. No Lab run,
campaign or provider call was made. Nothing was committed or pushed.

## Outcome

Done. The model is a setting on both sides of the boundary, defaulting to
`deepseek-flash`; an id neither repository is configured for is refused by name
before a request is built. The pricing constants are replaced with DeepSeek's
published figures, per model, with the source and date in the code. The "64k is
the model's context" claim is corrected everywhere it appeared; the budget itself
is unchanged, and what raising it would cost is stated below.

## The prices the brief gave are not the published ones

**Read this first.** The brief stated cache hit $0.0028 / 1M, cache miss $0.14 /
1M, output $0.28 / 1M. I fetched `https://api-docs.deepseek.com/quick_start/pricing/`
twice — once summarised, once as raw HTML parsed here — and the table says
something different. `https://api-docs.deepseek.com/quick_start/pricing-details-usd`
redirects to "Your First API Call" and carries no price table at all.

The published table, read 2026-09-23, USD per 1M tokens:

| | cache hit | cache miss | output | context | max output |
| --- | --- | --- | --- | --- | --- |
| `deepseek-flash` peak | 0.006 | 0.3 | 1.2 | 1M | 384K |
| `deepseek-flash` off-peak | 0.003 | 0.15 | 0.6 | | |
| `deepseek-v4-pro` peak | 0.044 | 1.32 | 3.96 | 1M | 384K |
| `deepseek-v4-pro` off-peak | 0.022 | 0.66 | 1.98 | | |

Footnotes on the same page: off-peak is exactly half of peak; peak hours are
01:00–04:00 and 06:00–10:00 UTC, Monday to Friday, excluding Chinese public
holidays, and everything else — including both weekend days in full — is
off-peak. `deepseek-flash` is served by DeepSeek-V4.1-Flash; the legacy ids
`deepseek-v4-flash` and `deepseek-v4-flash-vision-exp` are still *accepted* but
their models are retired, and their requests are served by, and billed as, Flash.

**The brief's ratio claim is right even though its absolute figures are not.** A
cache hit is a fiftieth of a miss (0.006 / 0.3 = 0.003 / 0.15 = 1/50), not the
tenth the old constants implied. So t098's payload reorder is worth **five times**
what it was credited with, exactly as the brief said.

**Core prices at peak, deliberately.** A grant reserves before a call is made; a
reservation that assumed the off-peak discount would let a run overspend the
moment it started inside peak hours. An off-peak run is therefore billed less
than Core estimated, never more. `AUTOMATION_STUDIO_DEEPSEEK_OFF_PEAK_RATE_MULTIPLIER`
records the discount as a named constant without applying it.

The old constants (0.44 miss, 0.044 hit, 1.32 output) match no model on the
current list. 0.044 and 1.32 happen to be `deepseek-v4-pro`'s peak cache-hit and
peak cache-miss rates, which suggests the set was assembled by reading down the
wrong column of an older table.

## What the two r5 runs would have cost

Reconstructed from `test-runs/instances/r5/*/snapshots/live-llm.json` in the main
checkout. Neither run recorded a cache split, so every input token was billed at
the cache-miss rate. My reconstruction under the *old* constants reproduces
`test-runs/campaigns/ten-sites-r5/summary.json`'s `reportedCostUsd` of
`0.17201932` to the last digit, which is what makes the new figure trustworthy.

| run | tokens (in / out) | billed (old) | corrected | change |
| --- | --- | --- | --- | --- |
| `run-mudw1ktb` (plus-earbuds-under-50) | 198,640 / 2,526 build, plus 2 verification calls | $0.09358580 | **$0.06477600** | −30.8% |
| `run-mudwci8d` (first-page-plus-earbuds) | 167,084 / 1,388 build, plus 2 verification calls | $0.07843352 | **$0.05407200** | −31.1% |
| campaign `ten-sites-r5` | 38 calls, 380,539 tokens | $0.17201932 | **$0.11884800** | −30.9% |

Off-peak the campaign would have been **$0.05942400**.

Two things follow. The campaign was over-charged in our books by about a third,
so every cost ratchet and budget derived from r5 is roughly 31% too conservative.
And the headroom from caching is far larger than we thought: `run-mudw1ktb`'s
build cost $0.0626 all-miss; at a 90% cache-hit rate it would cost **$0.0101**
under the corrected rates, against $0.0199 under the old ones.

## What changed, and why

### The model is a setting, not a string

The failure mode being removed is that every layer compared against the literal
`"deepseek-chat"`. There were six such comparisons across the two repositories,
so DeepSeek withdrawing that alias would have failed every run at once with an
opaque provider 400, and no setting anywhere could have fixed it.

**FluxIQ Core.** New `runtime/llm/deepseek/models.ts` holds the registry:
`AUTOMATION_STUDIO_DEEPSEEK_MODELS` (`deepseek-flash`, `deepseek-v4-pro`),
`AUTOMATION_STUDIO_DEEPSEEK_DEFAULT_MODEL` (`deepseek-flash`),
`AUTOMATION_STUDIO_DEEPSEEK_MODEL_LIMITS` (each model's real context and max
output), a type guard, a resolver, and one refusal sentence every layer shares.
A withdrawn id is told what replaced it — asking for `deepseek-chat` now gets
`"deepseek-chat" was withdrawn by DeepSeek; use "deepseek-flash" instead.
Configured models: deepseek-flash, deepseek-v4-pro.` The file imports nothing, so
a browser surface can list the models without pulling the runtime in behind them.

The DeepSeek modules moved into `runtime/llm/deepseek/` (`models.ts`,
`pricing.ts`, `provider.ts`, `index.ts`). This was forced: a third
`deepseek-`-prefixed sibling trips the structure audit's `prefixGroup` rule at 3,
and the rule's own stated remedy is the directory. Every import now goes through
the directory barrel, as the audit's `imports` rule requires.

Rewired: the provider's construction check (`llm.provider_model_unsupported` now
carries the shared refusal), `execution-grants.ts`'s `validateKeyCompatibility`
(the caller's model, the key's recorded model, or the default; both must be
configured, and where both are named they must agree — "LLM model mismatch." is
kept for genuine disagreement), the grant metadata and `api/contracts/llm.ts`
types, `api/handlers/llm-execution-settings.ts`, and the panel
(`flow-settings-model.ts` now lists Core's set rather than its own;
`blank-flow-authoring-model.ts` and `run-input-model.ts` carry the Flow's model
through and omit it when the Flow names none, so Core resolves the default).

A new package export `fluxiq/automation-studio/llm-models` is what the panel
imports, so the browser bundle gets the registry and not the runtime.

**This repository.** `packages/test-contracts/src/llm.ts` gains `llmModels`,
`LlmModel`, `DEFAULT_LLM_MODEL` and `isLlmModel`, mirroring Core as that package
already mirrors Core's consequence classes and call ceiling.
`live-llm-plan.ts`'s single-model refusal becomes a set check that names the
configured ids; `commands.ts` makes `--llm-model` optional, defaulting to
`DEFAULT_LLM_MODEL`, which is why the retired alias had been typed into every
recorded command line in the repository. The remaining ~40 literal pins across
`test-runner` and the campaign scripts now reference the constant or the type.

### One honest limitation

`scripts/lab/live-campaign/arguments.mjs` still holds the default as a literal,
because `scripts/` resolves no workspace package (`import
"@fluxiq-web-extension/test-contracts"` fails with `ERR_MODULE_NOT_FOUND` from
the repo root, and the only precedent — `scripts/lab/adversarial/conditions.mjs` —
reaches into `packages/*/dist` at runtime, which would make argument parsing
depend on a build). The literal carries a comment naming what it mirrors. Drift
is caught, but at the first run rather than at build time: `planLiveLlmExecution`
refuses an unconfigured id by name before a key is read. If the supervisor wants
this closed properly, the move is to stop passing `--llm-model` from the campaign
at all now that the Lab CLI has a default — I did not do it because the campaign
summary records the model it chose, and that evidence would be lost.

### The context assumption

`deepseek-flash` carries **1,000,000 tokens of context and generates up to
384,000** in one reply. Core's per-request ceiling of 64,000 was raised to that
number precisely because it was `deepseek-chat`'s whole context window; the two
were the same thing only while one model was permitted. **I did not raise it.**
Every place that claimed the number was the model's now says it is Core's own
budget: `harness/token-limits.ts`, `api/handlers/llm-execution-settings.ts`,
`execution-grants.ts`, `packages/test-contracts/src/llm.ts`, `live-llm-plan.ts`
and the three tests that repeated it.

**What raising it would cost, for the supervisor to decide.** At the corrected
peak cache-miss rate a 64,000-token request costs $0.0192 of input; a
1,000,000-token one costs $0.30. The run budget scales with it: the Lab's default
`maxTotalTokensPerRun` is ten requests, so a 1M ceiling turns a $0.19 worst-case
run into $3.00 — above Core's own `MAX_TOTAL_COST_USD` of $2, at which point
grants start being refused. `AUTOMATION_STUDIO_LLM_HIGH_TOKEN_CONFIRMATION_THRESHOLD`
is derived from the per-call limit, so it moves with it and recovery's reserve
arithmetic stays proportional. My recommendation is a modest raise if any: the r5
builds peaked at 198,640 tokens *across 22 calls*, so no single request came near
64,000, and the measured problem was the transcript being resent every call, not
a ceiling.

## Commands run and observed results

FluxIQ Core (`F:/fxwork/t105/!FluxIQ`):

- `node scripts/structure-audit.mjs` → `structure-audit: passed (176 warning(s), 360 baselined).`
  (First run: `16 violation(s) across 1 rule(s)` — the `imports` rule demanding
  the new directory's barrel. Fixed, not baselined.)
- `pnpm check` → `structure:test` 182/182, `task:test` 20/20, audit passed,
  then `packages/contracts check: Done`,
  `packages/client-gateway-websocket check: Done`, `packages/fluxiq check: Done`,
  `apps/web check: Done`.
- `pnpm --filter fluxiq exec vitest run --maxWorkers=2` →
  `Test Files 355 passed (355)`, `Tests 3062 passed | 1 skipped (3063)`.
- `pnpm --filter @fluxiq/web test` → `Test Files 245 passed (245)`,
  `Tests 1313 passed (1313)`.
- `pnpm --filter @fluxiq/contracts test` → `53 passed`;
  `pnpm --filter @fluxiq/client-gateway-websocket test` → `3 passed`.
- `pnpm --filter fluxiq build` → clean; the new export resolves:
  `models export ok: [ 'deepseek-flash', 'deepseek-v4-pro' ] deepseek-flash`.
- `node scripts/docs-reference.mjs` → `Wrote docs/reference/framework-reference.md
  and packages/fluxiq/docs/reference/framework-reference.md (2314 public declarations).`

This repository (`F:/fxwork/t105/!FluxIQWebExtension`):

- `node scripts/structure-audit.mjs` → `structure-audit: passed (99 warning(s), 121 baselined).`
- `pnpm check` → `lab:test` 88 pass / 0 fail, `task:test` 116/116, audit passed,
  and `check: Done` for all ten workspace projects including
  `packages/test-runner` and `domain`.
- `pnpm test` → exit 0; `test-runner` 1331/1331, `domain` 762/762,
  `apps/extension` 740/740, `apps/scenario-lab` 571/571, `test-contracts`
  125/125, and the four smaller packages all `# fail 0`.

Tests that pin the new behaviour, all observed passing:

- `runtime/llm/deepseek/tests/models.test.ts` (new, 6 cases): the default is
  `deepseek-flash`; the set has more than one member; no retired id is accepted;
  each model's published context and max output; a provider built with each
  configured id reports that id in its metadata; and `deepseek-chat`,
  `deepseek-reasoner`, `gpt-9` and `""` are each refused at construction with
  `llm.provider_model_unsupported` and the shared sentence, before any transport.
- `runtime/llm/tests/provider-cache-prefix.test.ts`: the three rates are pinned to
  0.3 / 0.006 / 1.2, the hit-times-fifty identity replaces hit-times-ten, and the
  arithmetic is pinned at `estimate(1000,0,1000) = 0.000006`,
  `estimate(1000,0,0) = 0.0003`, `estimate(1000,1000,0) = 0.0015`, plus
  `deepseek-v4-pro` at `0.00528` and `0.000044`.
- `live-llm/tests/live-llm-plan.test.ts`: every id in `llmModels` reaches the plan
  as itself; an absent `--llm-model` plans as `deepseek-flash`; `gpt-4` and
  `deepseek-chat` are each refused with `Core is configured for deepseek-flash,
  deepseek-v4-pro`.
- `apps/web .../runtime-views.test.tsx`: a Flow naming no model sends no `model`
  and lets Core resolve; one naming `deepseek-v4-pro` carries it; one still naming
  `deepseek-chat` sends no model rather than the retired id.

Corrected expectations elsewhere, each recomputed by hand from the new rates:
`estimate(12,5)` 0.00001188 → 0.0000096; the maximum live profile
`estimate(4000,1000)` 0.00308 → 0.0024; the cached-call figure 0.0002156 →
0.0001554.

## Not verified

- **No live provider call.** Nothing in this task confirms DeepSeek actually
  accepts `deepseek-flash` from our credential, or that a real reply's `usage`
  block still carries the cache fields. The supervisor's live verification is the
  only thing that closes this.
- Core's full `pnpm build` (the Next.js app build) was not run; `pnpm check`
  type-checks `apps/web`, and `pnpm --filter fluxiq build` succeeded.
- `pnpm package:lint` / `publint` was not run, and the new
  `./automation-studio/llm-models` export is the kind of thing it inspects. Its
  `dist` target exists and imports cleanly.
- The r5 recomputation is arithmetic on recorded token counts, not a re-run.
- Historical reports under `docs/working/*/reports/` still say `deepseek-chat`.
  Left alone: they are the record of what was actually run.

## Open questions and contradictions

1. **The brief's prices were wrong** (see the top of this report). The direction
   of the correction still holds — the old constants were too high on input and
   far too high on cache hits — but every derived figure should come from
   0.3 / 0.006 / 1.2, not 0.14 / 0.0028 / 0.28.
2. **Should `deepseek-chat` be refused, or accepted as an alias?** I refuse it.
   A Flow saved with `llmModel: "deepseek-chat"` now fails its settings validation
   with a message naming the replacement, rather than silently running on a
   retired alias. That is a deliberate loud break; say if you want a migration.
3. **`deepseek-v4-pro` is permitted but untested.** Including it is what makes the
   set genuinely plural rather than one string in a new costume, and its pricing
   is correct, but no run has ever used it.
4. **Off-peak.** Roughly four fifths of the week is off-peak. Scheduling campaigns
   outside 01:00–04:00 and 06:00–10:00 UTC on weekdays halves the bill for free.
   Core cannot assume it; the operator can.

## What Core's paired working document should record

- `runtime/llm/deepseek/` exists: `models.ts` (the configured set, the default,
  each model's real limits, one refusal sentence), `pricing.ts` (per-model peak
  rates with the source URL and date), `provider.ts`, `index.ts`. Import through
  the barrel — the structure audit's `imports` rule enforces it.
- The permitted model is now a set with `deepseek-flash` as the default. Five
  single-string checks were replaced: the provider's construction check, the
  grant's key-compatibility check, the settings handler, the panel's form, and the
  panel's build gate.
- `AUTOMATION_STUDIO_DEEPSEEK_PEAK_*` are now 0.3 / 0.006 / 1.2 for the default
  model, sourced to DeepSeek's price list of 2026-09-23. A cache hit is 1/50 of a
  miss. `estimateAutomationStudioDeepSeekCostUsd` takes an optional model.
- `AUTOMATION_STUDIO_LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST` is unchanged at
  64,000 and is now documented as Core's own budget, not the model's context;
  `AUTOMATION_STUDIO_DEEPSEEK_MODEL_LIMITS` carries the model's real 1M / 384K.
- New package export `fluxiq/automation-studio/llm-models` for browser surfaces.
- `docs/architecture/automation-studio.md`,
  `docs/architecture/automation-studio/llm-flow-bootstrap.md`,
  `docs/architecture/automation-studio/persistence.md` and both generated
  `framework-reference.md` files are updated.
