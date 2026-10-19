# A1 - Model calls and model-facing text

Worker report for brief A1 of `docs/working/extension-core-boundary-audit.md`. Read-only audit of `dev` at
`C:/Users/osrs_/FluxStuff/!FluxIQWebExtension` (HEAD 23cb5e1f), compared against Core at
`C:/Users/osrs_/FluxStuff/!FluxIQ`. No source was edited, built or run.

## Outcome

Done. **No production extension or domain code calls a model or a provider.** Nothing in `apps/extension/src` or
`domain/src` imports a provider SDK, reaches a provider host, reads a provider key, or estimates tokens or cost.
All model calls go through Core's own Node process. The Lab and test code likewise never call a provider directly;
they install the provider key into Core's Secret Keys program and read Core's records and step logs afterwards.

What this repository does do is ship a large body of **model-facing text into Core's prompts** through seams Core
declares for that purpose: the domain's system instructions, its exploration tool descriptions, its output-node
catalog text and parameter descriptions, and the wording of its tool results and refusals. That is the intended
seam. Parts of that text, though, state framework rules that apply to every domain: the permission policy, how
recordings relate to instructions, the cost ceiling, and Core's own Flow-authoring grammar (loops, `amend_draft
repeat`, `$input`/`$row`, `done when:`). Those parts are misplaced framework text and should move into Core's own
prose. Separately, several Lab modules make up for gaps in Core's telemetry: spend that Core does not total,
instructed consequences Core publishes only on success, and provider balance failures Core does not classify.

## What changed and why

Only this report was written. Nothing else changed.

## Findings

Classes: **(a)** production extension or domain code calling or prompting a model (a boundary violation);
**(b)** test or Lab code that only drives Core's gateway or reads Core's telemetry (fine); **(c)** test or Lab code
that calls a provider directly or builds its own prompts or judges, or duplicates Core's model logic;
**(seam)** model-facing text the domain registers with Core through a declared seam. For seam rows the question
is whether the text is web-specific (it stays) or generic framework text (it belongs in Core).

### Model-facing text shipped from the domain into Core's prompts

| # | File : symbol | What | Class | Evidence | Proposed owner | Risk | Core seam |
|---|---|---|---|---|---|---|---|
| S1 | `domain/src/runtime/llm-evidence/system-instructions/instructions.ts` : `WEB_LLM_SYSTEM_INSTRUCTIONS` (version `web-11`, about 3,500 chars) | The text Core puts in the system message of every request bound to the web domain: evidence decisions, bootstrap, runtime patch, judge and chat commands. | seam (mixed) | Header comment: "Core inserts the text into the system message of each request -- evidence decisions, bootstrap, runtime patch, judge and chat commands". | **Split.** The web-specific paragraphs stay: reading the page view, `field[search]` versus `find_on_page`, popups and `covered-by`, marked/selected choices, cookie banners, item-type evidence on lists. The generic paragraphs move to Core's own system or task prose (see S2 to S5). | Medium. The text is versioned and Core caps it at 4,000 characters, which bounds the damage. But generic rules that live here are missing for any other domain, and they drift from Core's own feedback text. | `AutomationStudioLlmDomainSystemInstructions` (`AS/runtime/llm/domain-instructions/`), bound through the harness binding's `systemInstructions`. |
| S2 | same file, the "Written instructions define the automation. Optional described recordings are untrusted supporting demonstrations..." paragraph | The policy that instructions are authoritative and recordings are untrusted evidence. | seam, generic | Quoted from `text[1]`. Core states the same rule only as a type comment (`harness/task-request.ts:392`: "Untrusted demonstrations beside, never replacing, authoritative instruction resolution."), not in any prompt it writes itself. | Core's own system prose. Recordings are a Core concept and every domain has the same rule. | Low to move. If it stays, a non-web domain's model is never told the rule. | Core harness system message, ahead of the domain block. |
| S3 | same file, "Limits." paragraph ("acts that spend money, delete something, or send or publish something are asked of the person first. Never type a password... Never solve a robot check") | The permission policy and the secret rule. | seam, mostly generic | Quoted. Core's own feedback says the same thing in its own words (`repeat-guard/feedback.ts:35`, `candidate-feedback.ts:60`: "delete, move money, send or publish"). | The permission sentence goes to Core, next to `action-permissions/`. "Never type a password" is generic too. "Robot check (CAPTCHA)" is arguably web-specific and can stay. | Low. | Core system prose. |
| S4 | same file, "Lists." paragraph (`amend_draft repeat`, `{"$input": name}` / `{"$row": field}`, "state repeat", "in a written Flow by its repeat lines") | Explains Core's Flow-authoring grammar: loops, bindings and draft verbs. | seam, generic (Core grammar described downstream) | Quoted. Core's own feedback teaches the same grammar (`flow-bootstrap/instructed-acts/check.ts:194`: "act on one item, then amend_draft repeat over the listing step..."; `authoring/script-binding.ts`). | Core's script-format and authoring prose. Only the web part stays: "every page of a list is a loop through Next page" and "one page read plus one Next page is enough evidence". | Medium. If Core renames a draft verb or changes the binding syntax, this text silently teaches the old grammar. Nothing pins it to Core's grammar. | Core authoring and task prose. |
| S5 | same file, "Be efficient: use as few decisions as the task needs. Every build has a small cost ceiling." | Budget guidance. | seam, generic, duplicated | Core already says it: `AS/runtime/project-agents/supervisor/guidance.ts:186`: "Be efficient: every build has a small cost ceiling." | Core (it already owns the purse). Delete from the domain. | Low. | Core system prose. |
| S6 | `domain/src/runtime/llm-evidence/tools.ts` : the domain's tool declarations returned with `systemInstructions` (`detect_repeating_structure`, `find_on_page`, `describe_element`) | Tool descriptions for observation tools Core offers next to its own `run_node`. | seam, web-specific (stays) | `tools: Array<{ toolId; description; inputSchema; ... }>` at line 180; the descriptions are at lines 436, 445 and 456. Core holds each one to 2,000 characters. The structure-detection description embeds Core's `AUTOMATION_STUDIO_FLOW_CONDITION_RULES` by import rather than by copy, which is the right pattern. | Stays. | Low. | Harness option bundle and binding `tools`. |
| S7 | `domain/src/runtime/llm-evidence/harness-options/options.ts` : `webAutomationRecoveryHarnessOptionBundle` (8 recovery options: inspect, press, enter_field, wait_for_change, navigate_in_scope, detect, find_on_page, describe_element) | Tool descriptions for Core's diagnose/repair exploration. | seam, web-specific, with one generic sentence | The press description (line 85) spells Core's closed consequence set as literals ("move_money, delete, send_or_publish, modify_existing, create_new") and states the permission policy ("A lasting press the instruction did not ask for is not made: it is put to the person."). The schema on the next line correctly uses Core's `AUTOMATION_STUDIO_ACTION_CONSEQUENCES`. | The descriptions stay. Build the consequence list in the prose from Core's constant, as the schema does. A shared Core sentence for "declare consequences" would remove the duplicated policy wording. | Low (wording drift only; the schema enforces the set). | `AutomationStudioHarnessOptionBundle`. |
| S8 | `domain/src/output-nodes/{extract,extract-list,next-page}/catalog-text.ts` and `output-nodes/definitions.ts` : `catalogTextByOutput`, `WEB_AUTOMATION_*_DESCRIPTION`/`_TAGS` | Node descriptions, tags and parameter grammar that Core's Flow Bootstrap ranks and shows to the model. | seam, web-specific (stays) | The `extract-list/catalog-text.ts` header says Core "shows the model each chosen definition's description, and the description and example of each object or json parameter (`flow-bootstrap/plan/catalog.ts`)". Core sets the bounds: 240 characters per node description, 600 per parameter description. | Stays. This is exactly what a domain contributes. | Low. | `AutomationStudioNodeDefinition` description, tags and parameter descriptions. |
| S9 | `domain/src/output-nodes/definitions.ts` : `expectedStateParameter`, `TARGET_DESCRIPTION` | Parameter descriptions that teach Core's script syntax. | seam, partly generic | "Write it as the step's `done when:` line ... `done when: text t9 contains \"Saved\"`" (line 200). The target description says "in a Flow script, `target: t5`". The grammar is Core's (`script-statements/step-done-when.ts`). | The handle wording stays. The script-syntax examples should come from a Core-exported constant, or Core's script-format prose should own them. | Low to medium (drift if Core's script syntax changes). | Node parameter descriptions. |
| S10 | `domain/src/actions/schemas.ts` (23 `description:` entries), `domain/src/manifest.ts` | Descriptions of the web action types (`web.dom.click` and the rest) carried on node definitions. | seam, web-specific (stays) | For example `description: "Verify a condition about the page and fail when it does not hold."` (line 347). | Stays. | Low. | Node definitions. |
| S11 | `domain/src/runtime/llm-evidence/{tool-rejection.ts, rejection-next/next-sentence.ts, repeated-refusal.ts, node-run/**, page-view/**, page-find/**}` | Tool-result and refusal wording the model reads: the compact page view (`web-llm-page.v3`), refusal `next` sentences, and the `repeatedAnswer` marker. | seam, web-specific (stays), with one overlap | `next-sentence.ts`: "Each sentence is this domain's own fixed words". `repeated-refusal.ts` byte-compares a refusal against the last one for the same project, flow, session and tool, and marks `repeatedAnswer`. Its header says ending the build "is Core's own no-progress guard's job". | Stays. `repeated-refusal.ts` overlaps Core's generic repeat guard (`AS/runtime/llm/repeat-guard/`). A3 should decide whether "this answer is byte-identical to the last" ought to be a Core service applied to every domain's tool results. | Low. | Tool execution results. |
| S12 | `domain/src/runtime/llm-evidence/{sanitize.ts, denied-keys.ts, withheld.ts, location.ts}` | Secret screening of the page evidence before any model sees it. | seam, web-specific (stays) | The index says "`web-llm-evidence.v2`: the secret-screened packet that is the only page data an LLM ever sees". | Stays: URL query rules and DOM attributes are web concepts. | Low. | Evidence packet returned to Core. |

### Production extension and domain code: does anything call a model?

| # | File : symbol | What | Class | Evidence | Proposed owner | Risk | Core seam |
|---|---|---|---|---|---|---|---|
| P1 | `apps/extension/src/background/connection/core-api.ts` : `callCoreProgram` and three other `fetch` calls | The extension's only HTTP: to Core's program API and asset upload, with the pairing token. | not (a). Correct | `fetch(url.toString(), { method: "POST", credentials: "omit", headers: { ... authorization: \`Bearer ${credentials.token}\` } ...})` against `/api/programs/<program>/<endpoint>`. The token is the pairing token, not a provider key. | Stays. | None. | Core program route. |
| P2 | same file : `CORE_CHAT_TURN_TIMEOUT_MS = 40_000` | A client timeout derived from Core's internal model-retry budget. | not (a). A coupling | Comment: "FluxIQ reads it with the model in three attempts and 24 s in all, then answers from the words alone (`conversations/instructions/interpret.ts` in FluxIQ Core)". | Stays, but Core could publish the bound (for example on the turn response or a capabilities read) so the client does not hard-code Core's internal model timing. | Low. | Program API. |
| P3 | `apps/extension/src/background/panel/chat-capabilities.ts` : `CHAT_CAPABILITIES`; `conversation-relay.ts` : `capabilitiesFor` | The chat sends capability **ids only**, and Core supplies each capability's model-facing descriptor. | not (a). Correct, with a latent opening | "Core executes each of these server-side and supplies its own descriptor for it, so only the ids are sent". But `capabilitiesFor` forwards any extra `{id, ...}` object the panel sends. Core's `parseAutomationStudioPanelCapabilities` keeps a client `title`/`summary` for an id outside its command catalog, and that text reaches the model. The panel sends no extra capabilities today (`shared/protocol.ts:209-213` is the only reference). | Stays. Consider dropping the pass-through, or forwarding ids only, so client-written text can never enter Core's chat prompt. | Low (latent). | `append-turn` `capabilities`. |
| P4 | `apps/extension/src/panel/chat/onboarding/model-readiness.ts`, `background/automation-relay/automation-relay.ts:107` | Asks Core's `secret-keys snapshot` whether any model key is enabled. | not (a). Correct | "never a key's value"; `deps.call("snapshot", {}, "secret-keys")`. | Stays. | None. | Core Secret Keys program. |
| P5 | `apps/extension/src/shared/activity/model-thought.ts`, `content/activity-overlay/model-prose.ts`, `panel/chat/stream/step/project-words.ts`, `shared/activity/project/project-card.ts` | Displays Core's activity rows: the model's thoughts, budgets and spend (`spentUsd`, `allowanceUsd`). | not (a). Display only | `Spent ${dollars(card.spentUsd)}`; the values come from Core's project cards. | Stays. | None. | Core activity stream. |
| P6 | `apps/extension/src/content/facts/judge.ts`, `content/action-runtime/assertion-evaluation.ts`, `background/connection/host-lease/ledger.ts` | Named "judge" or "verdict", but these are deterministic DOM and lease checks. No model is involved. | not (a) | `judge.ts`: "One claim judged against the page as it stands: `true`, `false` or `unknown`". | Stays (A3 may look at the fact-check logic as framework). | None for A1. | n/a |
| P7 | `domain/src` as a whole | No provider SDK import, no provider host, no `process.env` key read, no token or cost estimation in production source. | not (a) | The searches below came back empty for production paths. The only token-estimation use is in a test: `domain/src/tests/domain.test.ts:235` calls Core's `estimateAutomationStudioDeepSeekInputTokens` to check that the domain's packet fits. | Stays. | None. | n/a |

### Test, Lab and script code

| # | File : symbol | What | Class | Evidence | Proposed owner | Risk | Core seam |
|---|---|---|---|---|---|---|---|
| L1 | `packages/test-runner/src/live-llm/provider-credential.ts`, `live-llm/secret-key.ts`, `flow-lane/creation/secrets.ts`, `run-scenario/resolve-run-secrets.ts`, `saved-flow-replay/core-provider-keys.ts`, `saved-flow-replay/provider-credential-variables.ts`, `scripts/setup-demo-llm-key.mjs`, `demo-llm-create-ui/flow-settings-ui.ts` | Reads the operator's DeepSeek key from the environment or env files and installs it into Core as an encrypted Secret Key. Later steps carry only Core's key id. | b | `secret-key.ts`: "installed into Core the way a person would: as an encrypted Secret Key ... every later step ... carries only the opaque key id Core hands back." | Stays (test harness setup). | Low. The key handling is redacted and attested (`secret-leak-attestation.ts`). | Core Secret Keys program. |
| L2 | `scripts/provider-secret-environment.mjs` : `PROVIDER_SECRET_ENVIRONMENT_VARIABLES`; `packages/test-runner/src/environment.ts:20` (a second copy of the list) | A list of provider key environment-variable names that are **stripped** from child processes. | b (defensive) | `withoutProviderSecrets(environment)` filters `DEEPSEEK_API_KEY`, `OPENAI_API_KEY` and others. | Stays. The two copies of the list could be one (an A4 matter). | Low. | n/a |
| L3 | `packages/test-runner/src/guarded-browser/lane-network-policies.ts`, `panel-network-policy.ts` | **A mechanical boundary check.** Any provider host reached from a Lab browser, whether the extension or the panel, is a violation. | b (positive) | "an LLM lane's provider calls are made by Core's Node process, so a provider host in either browser is a violation." The test pins `https://api.deepseek.com/chat/completions` as never allowed. | Stays. | None. | n/a |
| L4 | `packages/test-runner/src/live-llm/{observed-usage, build-usage, budget, run-spend, call-rows, max-cost-within-ceiling, build-cost-ceiling, core-default-model}.ts`, `recovery-matrix/records/model-calls.ts`, `saved-flow-replay/provider/free-accounting.ts` | Reads Core's persisted call counts, tokens and costs. Checks that a run stayed inside the caps the Lab sent, and that a replay made zero provider calls. The ceiling and the default model are resolved through Core's own exported resolvers. | b | `observed-usage.ts`: "read back from Core's persisted run detail ... Counts, token totals and a cost figure only: no prompt, no response". `build-cost-ceiling.ts` imports `resolveAutomationStudioLlmRunCostCeilingUsd` from Core. | Stays. | Low. | Core run detail and proposal metadata. |
| L5 | `packages/test-runner/src/live-llm/run-spend.ts` | Sums one run's spend across four Core records: build, run recovery, result-check judge and re-author. | b, compensating for a Core gap | "Core keeps each in a different record ... under-reported every run that judged or re-authored (`run-munw7ffn-fe1cecd2`: $0.0418 recorded of about $0.0861 spent)." | Core should publish one authoritative per-run total, itemised by phase. The Lab would then read that total instead of rebuilding it. | Medium. Two implementations of spend totals can disagree, and this concerns real money. | Core run detail (`llmAccounting`). |
| L6 | `packages/test-runner/src/live-llm/step-log-spend.ts`, `scripts/lab/live-guards/step-log-outcome.mjs` | Recounts calls and cost from Core's `steps/` folders because Core's records miss some calls. | b, compensating for a Core gap | "the chat's own interpreter call, and a failed re-author's calls, reach no record the settlement reads from Core (`run-muqk713g-d08ad3dc`: 35 calls in its step log, 17 in `llm.calls`)". Only counts, provider, cost and token figures are read. | Core: every provider call (chat interpreter, failed re-author) should reach the run's canonical ledger. | Medium (same reason as L5). | Core run ledger. |
| L7 | `packages/test-runner/src/live-llm/step-log-instructed.ts` | Reads the build's instructed consequences from the step log, because Core publishes them only on a successful proposal. | b, compensating for a Core gap | "Core publishes a build's instructed consequences only on its proposal (`metadata.bootstrap`), so a build that ended without one ... reported `instructedConsequences: null` while its step log held the reading". | Core: publish the instructed-consequences reading on a refusal or ceiling-stopped build too. | Low. | Build refusal and outcome record. |
| L8 | `scripts/lab/live-guards/balance-failure.mjs` : `detectBalanceFailure` | Classifies "account out of money" by matching DeepSeek, OpenAI and Anthropic error text and HTTP status in the provider-failure sidecar. | c (provider knowledge duplicated downstream) | `BALANCE_TEXT = /insufficient[\s_-]*(?:balance|quota|credits?|funds)|exceeded your current quota|credit balance is too low|out of credits/iu`. Core has no matching classification: a search for insufficient-balance or quota codes in Core's `packages/fluxiq/src` found none. | Core's provider adapter should classify the failure (for example a `provider.balance_exhausted` code). The Lab guard would then key on Core's code. Core would also benefit, because a product build could stop on an empty balance instead of retrying. | Low to medium. It works today, but a provider changing its wording silently disables the waste guard. | Core provider failure code in run and build records. |
| L9 | `packages/test-contracts/src/llm.ts` : `llmModels`, `DEFAULT_LLM_MODEL`, `LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST`, `LLM_LAB_MAX_CALLS_PER_RUN`, `LLM_LAB_MAX_ESTIMATED_COST_USD`, `llmActionConsequences` | A mirror of Core's DeepSeek model ids, context window, call backstop, maximum cost ceiling and consequence set. | c (mirror of Core constants) | "mirroring FluxIQ Core's `AUTOMATION_STUDIO_DEEPSEEK_MODELS` ... because this package depends only on Core's public contracts". The comments say tests pin several of these to Core's exports. | Core could export them from `@fluxiq/contracts`, which this package already depends on, and the mirror would go away. | Low (tests pin the copies). | `@fluxiq/contracts`. |
| L10 | `packages/test-runner/src/demo-llm-*.ts`, `demo-llm-create-ui/**`, `demo-workspace/**`, `scripts/*demo-llm*.mjs` | Older demo-workspace lanes. They drive Core's panel UI and then assert on provider and model identity (`provider: "deepseek"`) and on token limits in Core's records. | b | For example `build-flow-ui.ts:110`: `if (text(accounting.provider) !== "deepseek" || text(accounting.model) !== DEFAULT_LLM_MODEL) fail(...)`. `limits.ts` sets `maxInputTokens: 4000, maxOutputTokens: 1000` as Flow settings sent to Core. | Stays. Hard-coding DeepSeek as the only provider is a test assumption, not a boundary issue. A4 may judge these lanes stale. | Low. | Core Flow settings and run records. |
| L11 | `packages/test-runner/src/run-expectations/extraction/judgement.ts`, `flow-lane/creation/judgement.ts`, `ui-e2e/journeys/dataset-judgement.ts`, `flow-lane/repair/failed-judgement.ts` | The Lab's "judgement" is a deterministic comparison of records against the scenario oracle. No model is involved. | b (not a model judge) | `dataset-judgement.ts`: "`matchedRecords` against `expectedRecords` ... never a count of rows that came back." | Stays. The model judge (the result check) is Core's; the Lab only reads its verdict and spend. | None. | n/a |
| L12 | `packages/test-runner/src/provider-failure/**` | Keeps Core's reply to a failed build request as a local-only diagnostic sidecar, never published. | b | "`core` is Core's own HTTP reply to the Lab's build request, kept verbatim and bounded." | Stays. | Low (local only). | Core HTTP reply. |
| L13 | `packages/test-runner/src/extension-chat-check/**` (`CHAT_BUILD_MESSAGE`), and the scenario task texts under `apps/scenario-lab/src/scenarios/**` | The person's instructions, typed into the real chat. | b (test input, not guidance) | `CHAT_BUILD_MESSAGE = "Create a flow that lists the name and price of the first three wireless earbuds..."`. | Stays. These are the inputs being measured, not product guidance. | None. | Extension chat to Core `append-turn`. |
| L14 | `packages/agent-orchestrator/**`, `packages/boundary-audit/**`, `packages/real-site-policy/**`, `apps/scenario-lab/src/**` (fixture `fetch` calls) | No model or provider references. Scenario `fetch` calls go to the fixture's own loopback routes. | n/a | Searches came back empty for provider and model terms. | n/a | None. | n/a |

## Confirmed versus suspected

**Confirmed (read and evidenced):**

- No class (a) violation exists. No production extension or domain code calls or prompts a model (P1 to P7). The
  extension's only network calls go to Core with the pairing token. The domain has no provider imports, keys or
  cost logic.
- No class (c) direct provider call or self-built prompt or judge exists in any test, Lab or script code. Every
  model call in a Lab run is made by Core. The Lab installs the key into Core and reads Core's records (L1, L4,
  L10, L11).
- The domain ships model-facing text into Core through declared seams: system instructions, tool descriptions,
  harness option descriptions, node catalog text and tool-result wording (S1, S6 to S12).
- Parts of `WEB_LLM_SYSTEM_INSTRUCTIONS` are generic framework text, not web text: the recordings-versus-instructions
  rule, the permission and secret rule, Core's loop and binding grammar, and the cost-ceiling line (S2 to S5). S5
  duplicates a Core sentence exactly. S4 duplicates Core's own authoring feedback.
- The Lab compensates for three Core telemetry gaps: no single itemised spend total (L5), calls missing from the
  canonical ledger (L6), and instructed consequences published only on success (L7).
- The Lab classifies provider balance exhaustion by matching provider error text, which Core does not do (L8).
- The extension relay forwards arbitrary capability objects. Core keeps a client `title`/`summary` for an unknown
  id, so that text can reach Core's chat prompt. No caller sends one today (P3).

**Suspected (needs a decision or a deeper look):**

- S9: whether node parameter descriptions should carry Core script-syntax examples (`done when:`, `target: t5`)
  or take them from a Core constant.
- S11: whether `repeated-refusal.ts` (byte-identical answer marking) should become a Core-side service applied to
  every domain's tool results. This overlaps A3.
- P2: whether Core should publish the chat-turn time bound instead of the extension hard-coding Core's internal
  24-second, three-attempt model budget.
- There is no **static** check that `apps/extension/src` and `domain/src` never import a provider SDK or name a
  provider host. Enforcement today is the runtime Lab browser network policy (L3) plus convention. The extension
  holds `<all_urls>` host permission, so nothing at build time would stop a provider call from being added.
  A structure-audit rule forbidding provider hosts and SDK imports in those two trees would make the boundary
  mechanical.

## Summary

The boundary holds where it matters most: no model call, provider key or cost logic lives in the extension or
the domain, and the Lab never talks to a provider itself. The real findings are of two kinds. First, the domain's
system instructions carry some framework text that should be Core's: the permission policy, the recordings rule,
Core's loop and binding grammar, and a duplicated cost line. Moving it keeps that guidance correct for every
domain and stops it drifting from Core's own feedback. Second, the Lab rebuilds spend totals, recovers instructed
consequences from step logs and classifies balance failures because Core does not publish them. Each of those is
a small Core telemetry seam that would remove a downstream reimplementation touching real-money accounting.

## Commands run and observed results

Searches over `apps/extension/src domain/src domain/scripts packages apps/scenario-lab scripts`, all tracked files,
with `git grep`:

- Provider hosts and endpoints: `api\.deepseek|api\.openai|api\.anthropic|openrouter|generativelanguage|chat/completions|/v1/messages`.
  Three hits, none in production: two copies of the env-var strip list, plus a network-policy test URL.
- SDK imports and dependencies: `from ['"](openai|@anthropic-ai|@ai-sdk|ai|langchain|deepseek)` and the same names
  in `package.json`. No hits.
- Keys: `api_?key|apikey|DEEPSEEK|bearer` (case-insensitive). Production hits are only the pairing-token bearer in
  `core-api.ts`, redaction patterns, and the domain's denied-key list. The test-runner hits are reviewed above.
- `\bfetch\(` in production code: only `core-api.ts` (Core program API) and `state-assets.ts` (a data URL).
- `fetch(` or `https?://` outside loopback in scripts, packages and the Lab: only fixture-local scenario routes.
- Prompt construction: `role: "(system|user|assistant)"|messages: [|max_tokens|temperature` and
  `systemPrompt|userPrompt|buildPrompt|PROMPT`. No model prompt construction found; the hits were fixture message
  data and an approval-node prompt string.
- Token and cost estimation in domain production code: `estimat\w*tokens?|countTokens|costUsd|pricing|chatCompletion|callModel`.
  Only `domain/src/tests/domain.test.ts`.
- Price tables: `per.?million|PRICE|usdPer|inputPrice|outputPrice`. None found.
- Model-facing text: `description:` in `domain/src/runtime/llm-evidence` and `domain/src/output-nodes`; read
  `system-instructions/instructions.ts`, the tool descriptions in `tools.ts` and `harness-options/options.ts`, and
  `catalog-text.ts`.
- The extension chat path: read `conversation-relay.ts` `turnPayload` and `capabilitiesFor`, and
  `chat-capabilities.ts`.
- Core comparisons (read-only): `AutomationStudioLlmDomainSystemInstructions`; Core prose matching the domain
  sentences ("cost ceiling", "Be efficient", "demonstration", "move money"); `$row` and `amend_draft repeat` in Core's
  authoring code; `parseAutomationStudioPanelCapabilities`; insufficient-balance or quota codes (none in Core).
- Static enforcement: provider terms in `packages/boundary-audit` and `scripts/structure-audit`. None found.
  Manifest `host_permissions` is `<all_urls>`.

No builds, tests or browser runs were executed; the brief made this a read-only audit.

## Not verified

- I did not read all 243 files (about 25,000 lines) of `domain/src/runtime/llm-evidence`. I sampled the index, the
  system instructions, the tool and harness descriptions, rejection-next, repeated-refusal, permission and
  exploration-terms. Other result wording there is assumed to be web-specific tool-result text, like the files
  sampled.
- I did not check whether Core actually inserts the domain block where the instruction file's comment says
  (after Core's JSON and injection rules, before its task prose). The comment and the binding type were the evidence.
- The test pins claimed in `test-contracts/src/llm.ts` comments (tests pinning the mirrors to Core exports) were
  not opened.
- `apps/extension/e2e/**` and `packages/*/tests/**` were only covered by the broad searches, not read.
- The extension's Firefox and Chrome manifests were checked only for `host_permissions`.

## Open questions or contradictions found

- The domain's system instructions and Core's feedback state the same loop grammar and permission policy in two
  places with no pin between them (S3, S4). Should Core own that prose, with the domain block limited to web reading
  rules? I recommend yes.
- Core accepts client-written capability `title`/`summary` for unknown ids into the chat prompt (P3). Is that an
  intended extension point? If not, Core should drop unknown ids, or the extension should stop forwarding them.
- The memory note says live runs stop at the first empty-balance error, but that detection lives only in the Lab
  (L8). Core product builds have no equivalent classification.
