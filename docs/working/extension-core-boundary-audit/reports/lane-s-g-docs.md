# Lane S-G (t728): downstream docs and comments brought in line with lane S's moves to Core

Worker report. Tree: `C:/Users/osrs_/FluxStuff/fxwork/t728/!FluxIQWebExtension`. Core was read
only. Nothing committed. Docs and comments only; no behaviour change.

## Outcome

Done. Every authored architecture doc that described a moved piece now says Core owns it, names
the Core export and import path, and says what stays downstream. Every source comment that
named a deleted file is repointed, except the `scripts/**` comments (lane H's), which are listed
below with replacement text.

## What changed and why

### `docs/architecture/extension-client.md`

- **Live Activity:** a new "Who owns what" paragraph. Core owns the pacer, headline, unit
  readers, wording and clock in `packages/fluxiq/src/ui/activity-status/` (and `project/`),
  imported from `fluxiq/ui`; every export is named. The extension keeps the relay, send-start,
  send-answer, overlay target/preference, the content overlay and the extension-only message and
  state types.
- Every `background/activity/*.ts` / `shared/activity/*.ts` reference to a deleted file (headline,
  ending-kind, supervisor-ending, run-retry, wording, cut-at-word, not-tried, unit-situation,
  model-thought, activity-display, declined-submission, `shared/activity/project/`) now names
  the `fluxiq/ui` export and its Core file.
- **New section "Recording-capture policy":** Core owns the policy, default and clamp
  (`fluxiq/automation-studio/nodes`, not the barrel), plus the `get-recording-capture-policy`
  endpoint. The extension enforces it: `background/capture-policy/` (reader, `effectiveSettings`,
  `CapturePolicySource`), effective settings for content-attachment and active-recording, and the
  content script's second fence that fails closed. Known gaps: the panel uses the default
  policy, and the gateway hello sends raw flags.
- The `captureInputValues` paragraph now says the flag reaches the content script clamped.
- **Direct-request policy foundation:**
  - The domain's stored `enabled` is Core's clamp (`register(owner, input, capturePolicy?)`).
  - `requestsEnabled` goes through Core's clamp on the default, saved-state, Save and draft paths.
  - It states that **`background/storage.ts` (lane G) still forces `requestsEnabled: false`** on
    every read and write, so a stored `true` cannot survive even under an allowing policy.

### `docs/architecture/testing-facility.md`

- The spend paragraphs (old ~2120-2137) are rewritten. Totals are Core's Flow purse, itemised by
  phase and read from `get-flow-spend` through `ExistingFluxIQControlClient.getFlowSpend`. The Lab
  side is `existing-fluxiq-control/flow-spend.ts`, `live-llm/flow-spend.ts` (`liveLlmRunSpend`) and
  `live-llm/spend-reader.ts`. The `runSpend.source` values are listed, and so is the
  `null`-when-unknown rule. Result checks are counted once under `judge` by Core's flag, with no
  request-id matching.
- The `largestInputTokens` / `byRole` paragraph is replaced: those tallies are no longer
  reported.
- The project-mode bullet "Per-role spend ... `runSpend.stepLog.byRole`" is replaced to match.
- The re-author `calls` sources are now `attempt`, `loop`, `adaptation` and
  `adaptation_unreadable`/`not_recorded`. `loop_decisions` is removed.
- A failed build's instructed classes now come from Core's failure diagnostic, with
  `quote: null`, and are not read from the step log.

### `docs/architecture/build-loop.md`

- **"The Model's Instructions":** the every-domain rules are Core's, in `runtime/llm/deepseek/system-prompt.ts`. The doc
  names each constant and the task kinds it goes to: `AUTOMATION_STUDIO_LOOP_AUTHORING_INSTRUCTION`,
  `..._LIST_AUTHORING_...`, `..._EFFICIENCY_...`, `..._PERSON_LIMITS_...` and
  `..._SUPPLEMENTARY_RECORDINGS_...`. The web instructions are `web-12` and web-only (paging and
  explore-one-page). These constants are module-private in Core, not exports, so the doc names
  the file and the constants.
- **New section "What A Build Remembers":**
  - The four memories are keyed by `automationStudioEvidenceBuildScope()` (`buildId`, `callScope`,
    `opening`) from `fluxiq/automation-studio`. They reset only on `"fresh"`, and the domain parses
    no call ids.
  - They write through to Core's domain build state via
    `automationStudioDomainBuildState(fluxiq, "web-automation")`, under keys
    `web.arrival|shown-addresses|held-literals|own-layers`.
  - Repeated refusals start over on any opening, and their reason is Core's
    `AUTOMATION_STUDIO_REPEATED_ANSWER_REASON`.
  - Cleared way-outs are Flow-scoped (`web.cleared-way-outs`, 256 entries / 60 KiB, `find`).
  - Limits are named: the 64 KiB value bound, and a continued build getting a new `buildId`.
- The held-literals bullet now points to Core's `continuing` opening.

### `docs/architecture/page-evidence.md`

- The system-instructions bullet: version is `web-12`. It lists what the web text still says and
  that the every-domain rules are Core's task prose.
- The card-number bullet: Core owns the rule. Core's screen flags a card run as `secretShaped`,
  and `automationStudioWithoutCardNumbers` comes from `fluxiq/automation-studio`. `withheld.ts`
  calls it **before** the credential screen, and the bullet says why.

### `docs/architecture/web-capabilities.md`

- New paragraph before "A Flow read moves its ordering off the page". Core owns the condition
  judge (blank-is-absent), the number and date readers, row identity, sort, the unsortable count
  and the condition word lists, all from `fluxiq/automation-studio/nodes`. Its parity table
  carries the downstream cases.
- What stays downstream: `condition-grammar.ts` aliases, the wire types, the `domain/client`
  re-export names, `item-filter.ts` with its `state: "present"` observation label, and the
  request binding in `order-rows.ts`.

### Comment-only source edits

- `apps/extension/src/content/activity-overlay/model-prose.ts:8`,
  `overlay-view.ts:5`, `overlay.ts:8-9` and `tests/overlay-view.test.ts:5` now name `fluxiq/ui`
  exports instead of the deleted `pacer.ts`, `model-thought.ts` and `wording.ts`.
- `apps/extension/src/background/activity/activity-relay.ts:3,11,17` named the deleted
  `pacer.ts`, `fan-out-gate.ts` and `unit-history.ts`. It now names `ActivityPacer`, `FanOutGate`
  and `UnitHistory` from `fluxiq/ui`.
- `domain/src/runtime/llm-evidence/node-run/context.ts:33`: the arrivals doc no longer says
  "for the life of the process". It now says the value is keyed by Core's build id and kept in
  Core's durable store (`./build-state/`). This is S-D4 open question 4.
- `packages/test-runner/src/run-scenario.ts:153`: the comment named `live-llm/step-log-spend.ts`.
  It now says the step log gives per-call rows (`call-rows.ts`) and the totals are Core's Flow
  purse (`flow-spend.ts`).
- Left as they are: `live-llm/flow-spend.ts:14` and `live-llm/tests/canonical-judge-spend.test.ts:16`.
  They name `run-spend.ts` / `step-log-spend.ts` explicitly as "removed in t728" and "until t728",
  so they are accurate.
- No README names a moved module (grep of root, `apps/*`, `domain`, `packages/*` READMEs found
  none).

## Stale `scripts/**` comments for lane H (not edited)

1. `scripts/lab/live-campaign/row/build-spend.mjs:13`: replace
   `` `packages/test-runner/src/live-llm/run-spend.ts`). `` with
   `` `packages/test-runner/src/live-llm/flow-spend.ts`, Core's Flow purse). ``
2. `scripts/lab/live-campaign/row/reported-spend.mjs:29`: replace
   `` (`live-llm.json` `runSpend.totalEstimatedCostUsd`, `run-spend.ts`): every `` with
   `` (`live-llm.json` `runSpend.totalEstimatedCostUsd`, `live-llm/flow-spend.ts`, Core's Flow purse): every ``
3. `scripts/lab/live-guards/step-log-outcome.mjs:13-16`: replace
   "Counted the way `packages/test-runner/src/live-llm/step-log-spend.ts` counts: a complete
   `meta.json` ..." with "Counted on its own, for a run killed before the runner's finalize (the
   runner's totals are Core's Flow purse, `live-llm/flow-spend.ts`): a complete `meta.json` ...".
4. (Behaviour, from S-D5, not a comment.) `scripts/lab/live-guards/balance-failure.mjs` should also
   match Core's codes `llm.provider_balance_exhausted` / `flow_bootstrap.provider_balance_exhausted`.
   `testing-facility.md` ~3548 ("provider HTTP 402, or text such as ... `Insufficient Balance`")
   describes the guard as it is today, so I left it. When lane H adds the code match, add "or
   Core's code `llm.provider_balance_exhausted` / `flow_bootstrap.provider_balance_exhausted`".

## Commands run and observed results

- `node scripts/structure-audit.mjs` printed `structure-audit: passed (210 warning(s), 638 baselined).`
- `pnpm --filter @fluxiq-web-extension/domain check` printed "core-build: FluxIQ Core's build ... is
  current with its source." and then the `domain:check` build-cache line, with no errors. Exit 0.
- `pnpm --filter @fluxiq-web-extension/extension check` printed the same core-build line and then the
  `extension:check` build-cache line (471700 ms), with no errors. Exit 0.
- `git diff --stat` on my paths: 11 files, 267 insertions and 72 deletions. Line endings were
  preserved (all LF).
- A grep for the deleted module names across `apps/extension/src`, `apps/extension/e2e`,
  `domain/src`, `packages/test-runner/src`, `docs/architecture`, `scripts` and the READMEs finds
  only the two accurate "removed in t728" comments and the three lane-H script comments above.

## Not verified

- `pnpm --filter @fluxiq-web-extension/test-runner check` was not run. My only edit there is a
  one-line comment in `run-scenario.ts`, and the brief named only the domain and extension
  checks.
- Markdown anchors (`#recording-capture-policy`, `build-loop.md#the-models-instructions`,
  `#what-a-build-remembers`) were checked by reading the headings, not rendered.
- The doc claims rest on the lane reports and on spot reads of the current source:
  - `storage.ts:41`
  - `capture-policy/`
  - `message-handler.ts`
  - `requests/policy/validation.ts`
  - `instructions.ts`
  - `reauthor-record.ts` sources
  - `registry.ts` bounds
  - the memory keys
  - Core's `activity-status/` and `domain-build-state/` listings and the `system-prompt.ts`
    constants

  I did not re-trace every behaviour claim through the code.

## Open questions or contradictions found

- Core's every-domain prompt sentences are module-private constants in `system-prompt.ts`, not
  exports. The brief asked for "the Core export"; the docs name the file and the constant names
  instead.
- Core's moved activity files still carry doc comments pointing at extension paths (S-B noted
  this). They are in Core, read-only here.
- `testing-facility.md` still says "Until the Lab comparison (A8) passes ...". The per-role
  tallies A8 compared are gone (S-D5 open question 1). If A8 still needs them, the doc and the
  code both need a decision.
