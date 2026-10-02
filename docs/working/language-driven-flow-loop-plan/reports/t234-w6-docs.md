# t234 W6 report: one purse per Flow creation (Core docs)

## Outcome

Done.

## What changed and why

Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t234/!FluxIQ`:

- `docs/architecture/automation-studio/llm-flow-bootstrap.md`
  - New subsection `### One purse per Flow creation` at the end of
    "Generation command" (after the pricing/caching paragraphs): purse as sole
    cost authority (`runtime/llm/build-purse/purse.ts`, `run.ts`), creation
    span, `FLUXIQ_LLM_RUN_COST_CEILING_USD` $0.10 lowered-only by
    `maxEstimatedCostUsdPerRun`, `automationStudioLlmBuildPurseScope`, the
    creation-spend record (`runtime/flow-bootstrap/creation-spend/`,
    `creation-spend.json`, `runtime/service/creation-spend.ts`, `carriedUsd`,
    cleared at creation end, scheduled-run repairs untouched), worst-case
    holds (3 bytes/token + 16 framing, 2,000 decision reply via
    `AUTOMATION_STUDIO_LLM_DECISION_REPLY_TOKENS`, 8,000 default elsewhere,
    patch ~2,700), loop budget with no held-back decision and no cost ending,
    purse refusal as the only cost ending and what it states, judge held at
    true worst case with `not_judged` on refusal.
  - Session-key profile paragraph: replaced "loop budget: the $0.25 run cost
    ceiling" with a link to the new subsection; reply reservation now says
    8,000 by default, 2,000 for build decisions.
  - t208 unfinished-build paragraph: "shares the build's $0.25 purse" replaced
    by drawing on the creation's one purse, no per-round cost share.
  - Endings table: `evidence_budget_exhausted` trigger now names the purse
    refusal as the only cost ending.
  - Evidence-guided generation: removed "each decision reserves total cost
    divided by its decisions"; states worst-case holds against the purse and
    the ceiling rule.
  - `Website task` paragraph: bound restated as the purse ($0.10 default,
    lowered by the Flow setting). The per-call "USD 0.25 per call" request
    field was left, as it is a per-call client limit, not the build ceiling.
- `docs/architecture/automation-studio.md`
  - "Spend is bounded by the loop's budget": the Flow setting is now the
    ceiling for recoveries; builds use the one purse (linked).
  - "Iterating adaptations" Flow Bootstrap paragraph: per-decision share
    removed; worst-case holds against the purse, loop count informs only,
    purse refusal is the only cost ending.

Left unchanged deliberately: resolution defaults "USD 0.25 per call, USD 2 per
run" (runtime run defaults), the settings API "cost caps above USD 0.25"
validation, and the recovery guard list (recoveries, not builds). No passage
stating a judge half cap existed in either file; the new rule is stated in the
subsection.

## Commands run and observed results

- `node scripts/structure-audit.mjs --rule docs-links` (worktree root) ->
  `structure-audit: passed (0 warning(s), 0 baselined).` exit 0.
- Confirmed source paths exist and
  `AUTOMATION_STUDIO_LLM_DECISION_REPLY_TOKENS = 2_000` in
  `runtime/llm/harness/token-limits.ts`.

## Not verified

The behavioural figures (6,119 replies, 593 max, p99 469, ~2,700 patch
tokens, 3 bytes/token + 16) were taken from the brief, not re-derived.
`automationStudioLlmBuildPurseScope` name taken from the brief, not grepped.

## Open questions or contradictions found

None.
