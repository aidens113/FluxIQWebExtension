# t200 report: the model sees the whole page

Task t200, branch `task/t200-model-sees-whole-page` in both trees:
`C:/Users/osrs_/FluxStuff/fxwork/t200/!FluxIQWebExtension` (downstream) and
`C:/Users/osrs_/FluxStuff/fxwork/t200/!FluxIQ` (Core). The task crosses into Core
because the user ordered it (2026-09-30).

The user's order, verbatim: "Remove ANY AND ALL LIMITS ON THE NUMBER OF ELEMENTS
PASSED TO MODEL. DO NOT HIDE INFORMATION OR USE ANY RANKING ALGORITHM."

## Status

- Step 1 (inventory): written below. Every line was located by three read-only
  sweeps, one each for the extension, the domain and Core. The central files were
  then re-read by the lead and match: `dom-snapshot.ts`, `describe-element.ts`,
  `sanitize.ts`, `elements.ts`, `limits.ts`, `context-window.ts`, `shown.ts`,
  `loop-configuration.ts`, `evidence-loop-decision.ts`, `deepseek/preflight.ts`,
  `token-limits.ts`, `session-key-provider.ts` and `deepseek/models.ts`.
- Step 2 (removal): done and validated in both trees. See "Changes" and
  "Ready to commit".
- Step 3 (measurement): not run, because the supervisor stopped all Labs. See
  "Measurement".

## Step 1: inventory

Paths are relative to each tree. The downstream tree's paths start with `apps/`,
`domain/` or `packages/`, and Core's start with `R/`, which stands for
`packages/fluxiq/src/programs/automation-studio/runtime/`.

Categories:

- **A**: count cap, top-N or slice.
- **B**: byte, character or token budget, or text truncation.
- **C**: depth limit.
- **D**: ranking, scoring or relevance selection.
- **E**: a filter that drops a visible or interactive element, or replaces
  elements with a summary.
- **F**: secret screening, which is kept.

### How the page reaches a model

1. **The look.** The domain sends `web.dom.capture_snapshot` with `parameters: {}`
   (`domain/src/runtime/llm-evidence/capture.ts:416-420`). The extension runs it in
   one frame, the top one by default (`apps/extension/src/runtime/action-runner.ts:354,365`),
   through `content/actions/capture-snapshot.ts:29` and then `content/dom-snapshot.ts:72`.
   The result returns as `client.action_result`
   (`background/connection/server-command-channel.ts:210`). **Child iframes are
   never in the look.**
2. **The domain packet.** `sanitizeWebLlmSnapshotWithBindings`
   (`domain/src/runtime/llm-evidence/sanitize.ts:170`) builds `web-llm-evidence.v2`
   from `elements.ts` and `page-evidence.ts`. The same packet feeds the state
   digest and route state (`state-digest/snapshot-states.ts:73-91`), the failure
   packet (`tools.ts:430-481`, `runtime/adapter.ts:401`) and the host runtime's
   state summary and diff (`runtime/host-runtime.ts:127,143,175-204`).
3. **Core's decision context.** For build decisions and the dry run, the
   execution result's `evidence` goes into `R/llm/evidence-loop.ts`, which shows
   the model `automationStudioLlmDecisionContextShown` (`R/llm/decision-context/shown.ts:43`).
   That is a byte window over the evidence (`R/llm/context-window.ts:48`), beside
   a history entry and a draft entry. Repair uses `R/recovery/**` and
   `R/llm/harness/failure-evidence.ts`/`explored-evidence.ts`. Judgement uses
   `R/result-verification/**`.
4. **The provider.** `R/llm/deepseek/preflight.ts` checks the request against the
   profile's token limits. The live profile is `R/llm/session-key-provider.ts:29`,
   and the Lab's is `packages/test-contracts/src/llm.ts:138-140`.

### Extension capture (`apps/extension/src/`)

Element list, `content/dom-snapshot.ts`:

- **A:** `:63,:223` `.slice(0, MAX_SNAPSHOT_CANDIDATES)`, which is 2,000 per frame.
- **A:** `:64,:269` stops the sweep after 50,000 scanned.
- **E:** `:263-265` gathers from selector allow-lists; everything else only reaches
  the capped `*` sweep. `:270` the sweep skips an element without "presentation".
- **E:** `:284` `[hidden], [aria-hidden='true']` dropped. aria-hidden content is
  often visible: a modal sets it on the page behind it.
- **E:** `:285-286` elements under 2px dropped (visually-hidden but interactive
  inputs). `:288` `opacity === 0` dropped (custom checkboxes). `:289-293,:374-397`
  elements with no id, name, text, value, title, alt, placeholder, href or media
  dropped (icon-only buttons, overlay backdrops).
- **D:** `:205` repeat exemplars mark followers. `:206` lead statements promoted.
  `:216-222` sorted by follower, then bucket, then priority. `:325-344` buckets
  0-10. `:363-372` front-layer and drawn-control promotion. `:399-412` priority
  score.
- **E:** `:244` `href` deleted when it repeats the document address.
- **B:** `:108,:158` selection cut to 2,000. **F:** `:154-184` selection
  sensitivity guard; `:166` also withholds the selection past 2,000 candidate
  controls.
- Kept (not page information): `:278` html and body; `:280` the extension's own UI;
  `:283` script, style, noscript and template.

Per element, `content/describe-element.ts` and `content/identity/`:

- **E:** `describe-element.ts:112` sends a 25-name attribute allow-list only.
  **B:** `:114` attribute values cut to 500. `:126,:135` text cut to 500. `:160,:162`
  value cut to 2,000.
- **A:** `:202` options cut to 20. **B:** `:203-204,:207` option value and label
  cut to 200. **E:** `:207` `selectedValue` only when it is among the first 20.
- **E:** `:70-72` non-interactive elements carry only their own text. That is
  correct once every element is listed.
- **B:** `identity/bounded-text.ts:9`. `identity/accessible-name.ts:31` (200).
  `identity/label.ts:25,27` (200 and 80). `identity/context.ts:39` (200).
  `identity/record.ts:105,107` (160 and 120).
- **A/C (search bounds of derived identity heuristics, not page content):**
  - `accessible-name.ts:32` (8 labelledby ids).
  - `label.ts:28,29,77` (4 labels, 4 siblings, 40 parts, depth 8).
  - `context.ts:42-46` (landmark depth 30, heading levels 10, siblings 12,
    subtree queries 24, labelledby 8).
  - `record.ts:103,109` (depth 12, 400 nodes).

Page evidence, `content/evidence/*` (per frame):

- **E:** `dialogs.ts:52`, `regions.ts:31`, `repeating.ts:46`,
  `loading.ts:45,51,56,69` and `forms.ts:51` use `document.querySelectorAll`, so
  they never enter shadow roots. Consent walls often live in one.
- `dialogs.ts`: **A** `:29,:55` 5 dialogs. **E** `:28` selector allow-list.
- `overlays.ts`: **A** `:33,:45` hit-tests only the first 40 ranked entries. **E**
  `:65,:68` skips small and off-viewport candidates. **D+A** `:104-105` sort, then 5
  blockers. **A** `:35,:119` 5 blocked per blocker. **C** `:36,:92` walks 12
  ancestors.
- `forms.ts`: **A** `:33,:34,:44` 8 forms, 30 controls, 16 tokens. **B** `:35,:45`
  200 and 64 characters.
- `regions.ts`: **A** `:25` 20.
- `repeating.ts`: **A** `:25` 2,000 scanned. **D+A** `:36-37` biggest 6. **E**
  `:86-101` a run becomes its first item plus a count. **B** `:29` 160. **A** `:28`
  8 fields.
- `loading.ts`: **A** `:20,:21` 8 indicators and 8 busy regions. **B** `:22` 120.
- `navigation.ts:19,24`: **B** URL and referrer cut to 2,000.
- `lead-statements.ts:51,54,57,60`: **A/D**. It feeds the ranking only.
- `controls.ts`: **D**. Ranking predicates only.

Other ranking inputs:

- `repeat-exemplars.ts:138-146`: **D**. Followers ranked last, so they fall past
  the cut first.
- `event-elements.ts:9`: **A**. The touched queue holds 500 and feeds bucket 0.

Geometry and shadow DOM:

- `visual-bounds.ts:35,49,122,130,140`: **E**. Under 2px gives no bounds, and the
  element is then dropped at `dom-snapshot.ts:286`.
- `shadow-dom/composed-roots.ts:13,16`: **A**. 500 open roots and 50,000 elements
  scanned for hosts.
- `selector/shadow/element-from-point.ts:10`: **C**. Shadow depth 16 in the hit
  test.

Background merge and relay:

- `background/connection/dom-snapshot.ts:73,180`: **A**. 4,000 merged elements.
- `:77,126,138,141-145`: **E**. A frame that does not answer within 150 ms is
  dropped silently.
- `:61-67,336-338,357-358,377`: **A**. Merged dialogs 10, busy regions 16,
  indicators 16, regions 40, repeating 12, forms 16.
- `:392`: **D+A**. Blockers sorted, then 10.
- Manifest `apps/extension/manifest.chrome.json:39-42`: **E**. No
  `match_about_blank`, so about:blank and srcdoc frames get no content script.

Repair and failure text:

- `content/action-runtime/resolve-target.ts:199,583-602`: **A**. 5 candidates, then
  "and N more".
- `content/identity/candidates.ts:107-112`: **A/B**.
- `content/action-runtime/interference/covering-layer.ts:88,95,123`: **A/B**.
- `content/actions/select.ts:57`: **A**. 20 options on failure.
- `content/action-runtime/validation-outcome.ts:47`: **B**. 1,024. This mirrors
  Core's failure-record text limit.

Structure detection (the `detectStructure` look):

- `content/extraction/largest-runs.ts:35,38`: **A/D**. 10,000 scanned, then the
  biggest 24.
- `infer-fields.ts:154,169-178,221-223`: **D/A**.
- `detect-structure.ts:250-258`: **D**. `outranks`.

**F (kept):**

- `shared/sensitive-field.ts:18`.
- `element-traits.ts:161-189`.
- `sensitive-text.ts:45-94`.
- `describe-element.ts:154-201`.
- `identity/*`, where the sensitive readers are used.
- `evidence/forms.ts:85-118`.
- `dialogs.ts:99-105`.
- `gateway-payloads.ts:136-157`.
- `content/actions/value-redaction.ts`.
- Gaps found and not yet screened: `evidence/repeating.ts:88` and
  `loading.ts:53,63` read raw `textContent`.

### Domain (`domain/src/`)

`runtime/llm-evidence/limits.ts`:

- **B:** `:34-38` `WEB_LLM_EVIDENCE_BYTE_BUDGETS`: ceiling 12,000, exploration
  6,000, and failure, which is Core's 6,000. `:66-71` `evidenceByteLimit`.
- **A/B:** `:41-52` `WEB_LLM_EVIDENCE_BOUNDS`: elements 40, url 2,000, text 300,
  selector 500, tag 40, role 80, attribute 200, options 20, placement 80, dialogs 3.

`untrusted-json.ts`:

- **B:** `:18-22` `boundedText` collapses whitespace and slices. Every packet
  string goes through it.
- **E:** `:39-42` `boundedCount` drops an out-of-range count.

`sanitize.ts`:

- **D:** `:192` `frontLayerFirst` reorders, so the order is not document order.
- **A:** `:193` 40 elements.
- **E:** `:205,208` `elementTotal` and `elementsTruncated` summarise what was left
  out.
- **B:** `:206` title cut to 300.
- **B/E:** `:247-259` `renumberedBytes`. `:317-359` `trimToBudget` pops elements,
  then page facts (`selectedText`, title, navigation, loading, elementTotal,
  dialogs, blockedBy, frame, repairParameters), then refuses
  `evidence_budget_exhausted`.

`elements.ts`:

- **B:** `:158,163,168,169` tag 40, role 80, name 300, text 300.
- **E:** `:162` attributes are never published.
- **E/F:** `:175` `sameOriginHref` drops cross-origin links and strips query and
  hash.
- **A:** `:385` options cut to 20.
- **B/E:** `:387-389` option cut to 200, and an empty option dropped.
- **B:** `:245,272-275,298-299,314-317,326,353-356,378,395`.
- **C:** `:130-132` shadow hosts 16 and host selector 512, in the binding only.
- **F (kept):** `:160` a sensitive element is dropped. `:177` values are never
  carried.

`page-evidence.ts`:

- **E:** `:6-9,53-62` regions, repeating, forms, navigation url, busy regions and
  the overlay counts are never read.
- **B:** `:142` `selectedText` 300. `:222-241` document state and navigation type
  40.
- **E:** `:224-226` indicators reduced to a spinner flag.
- **A:** `:267` 3 dialogs.
- **A/D:** `:283-292` only `blockers[0]`.
- **B:** `:270-271,294-296`.

`location.ts`:

- **E/B:** `:10` a URL over 2,000 throws, so the page is not seen at all.
- **E:** `:17-19` origin and path only; every query and hash is dropped.
- **E:** `:22-32` cross-origin href dropped.
- **F (kept):** `:12` embedded credentials.

Ranking and selection helpers:

- `front-layer.ts:29-35,53`: **D**. The modal's controls are moved first.
- `look-alikes.ts:69-100`: `dialog` and `within` are published only on
  look-alikes. This is a disambiguation cue; every element's own text is
  published regardless.

`capture.ts`:

- **E:** `:416-420` the look is asked with `parameters: {}`.
- **B:** `:430-437` exploration budget. `:39,597-598` the refusal envelope budget.

`tools.ts`:

- **B:** `:456-479` failure total budget, and a candidate budget of
  `min(1,024, total/3)`.
- **E:** `:439-441`.

`target/candidates.ts`:

- **A:** `:10,59` 8 repair candidates.
- **D:** `:55-57,84-91` `candidateScore`.
- **B:** `:94-105` fit to bytes.

Handles and identity:

- `target/equivalence.ts:244-247` and `plan-resolution/element-identity.ts:90-114`:
  **E**. A name at or over the 300 bound is treated as "possibly cut" and dropped
  from identity.
- `stable-handles.ts:56-64`: `WEB_LLM_TARGET_HANDLE_MAX_NUMBER = 9_999`, sized to
  40 elements per capture. `:109` restarts numbering past it. The pattern allows at
  most 4 digits.

`node-run/`:

- `run.ts`:
  - **B:** `:92,244-246` look envelope. `:397` budget 6,000.
  - **E/B:** `:398-403` the read is `budget/4`. `:524` an over-budget refusal loses
    its page. `:595-601` `bounded()` drops `pageChanged`, `control` and `read`.
- `read-result.ts:20-63`: **C/B/A**. Depth 6, strings 200, 8 items, 24 keys, and
  a shrink ladder.
- `replay.ts:318-329`: **B/E**. A page over budget is dropped.

`structure/`:

- `packet.ts:118-124`: **B**. Fields popped to fit. `:156` label 80.
- `detect.ts:141,150-155`: **D/B**. The largest list, at 6,000.
- `refusal.ts:77`: **A**. 3 list hints.

Model-facing text:

- `harness-options/options.ts:71`: "Capture bounded structured evidence ... the
  others come after the page's other elements or are left out".
- `options.ts:132` and `tools.ts:302`: "the page's largest list".

State digest and route state:

- `state-digest/snapshot-states.ts:73-91`: taken from the 40-element, 6,000-byte
  packet.
- `route-state/project.ts:17,53`: **B**. Controls joined, then cut to 2,000.
  `:27` **A**. `dialogs[0]` only.

`host-runtime.ts`:

- **B:** `:127,143`, the default packet bound.
- **A:** `:74-75,201-202` diff of 10 added and 10 removed.

`adapter.ts`:

- **B:** `:24,401` Core's failure byte cap. `:434,438` title 300 and selector 500.
- **E:** `:423` a URL over 2,000 is dropped.

`reusable-evidence.ts`:

- **A/B:** `:13-17` 40 elements, 20 actions, 20 capabilities, 24 items and 4,096
  bytes. `:65-67` **throws on a packet over 40 elements**.
- **D:** `:124-126` canonical sort.
- **B:** `:161-179` fit.

**F (kept):**

- `sensitivity/*`.
- `elements.ts:160,177`.
- `sanitize.ts:177-181`.
- `location.ts:12`.
- `denied-keys.ts:24-64` (html, innerHtml, outerHtml, pageSource, cookies,
  headers, selector).
- `read-result.ts:62`.
- `adapter.ts:104-127,245-296`.

The execution result's top-level keys are `WEB_LLM_EVIDENCE_RESULT_KEYS_CORE_READS`
(`capture.ts:275-277`), with `readable()` at `:368-374`. Nothing new is added at
top level; every change rides inside `evidence`.

### Core (`R/` = `packages/fluxiq/src/programs/automation-studio/runtime/`)

Build loop and dry run:

- `R/loop-limits/flow-bootstrap-evidence-loop.ts`:
  - **B:** `:84` `AUTOMATION_STUDIO_EVIDENCE_CONTEXT_BYTES = 24_000`, passed at
    `:136`.
- `R/loop-limits/evidence-loop.ts:27-31`: **A/B**. `maxEvidenceBytes: 1_048_576`
  total, which ends the loop as `evidence_limit`.
- `R/llm/context-window.ts`:
  - **D:** `:51-70` newest result per tool first.
  - **A/B/E:** `:78-89` `choose` skips a whole entry that does not fit, silently.
- `R/llm/decision-context/shown.ts`:
  - **B:** `:44` history entry `min(4,000, window/6)`.
  - **B:** `:49-51` history, draft and budget take their bytes off the window.
- `R/llm/decision-context/entry.ts:28-30` and `compression.ts:54-189`: **B/E**.
  The history ladder: detail cut to codes, calls folded, refusals joined, least
  form.
- `R/llm/decision-context/closed-detail.ts:23-24`: **A**. 8 objects and 4 fields.
- `R/llm/loop-configuration.ts`:
  - **B:** `:327` draft floor 1,280. `:331` default window `min(64,000, total)`.
    `:344` `toolEvidenceBytes = window - 512`. `:355` `draftBytes`.
  - `:368-369`: refuses a window over the 64k-token equivalent.
- `R/llm/evidence-loop.ts`:
  - **B:** `:345-350,458,666` `evidence_limit`.
  - **E:** `:335-336` a no-progress note that does not fit is dropped.
  - **B:** `:421,446,650` `toolEvidenceBytes` handed to the domain.
- `R/llm/evidence-loop-decision.ts:411-419`: **A/C**. `isJsonValue` allows at most
  1,000 array items and 1,000 entries, keys of at most 500, and depth 20. **A page
  with more than 1,000 elements refuses the whole tool result.**
- `R/llm/node-tools/replay-draft.ts:162`: **B**. Replay capture bounded by
  `toolEvidenceBytes`.
- `R/llm/node-tools/dry-run-gate.ts:103,140,144`: **B**. `evidence_limit`.
- `R/flow-draft/entry.ts`:
  - **B/E:** `:80,328-330` a step input over 512 bytes becomes `inputTooLarge`.
  - **A/B/E:** `:114-183` the draft ladder.
- `R/llm/evidence-loop/stall-redirect.ts:64` and `resume.ts:44`: **A**. Core notes.
  `progress-trace.ts:79` goes to the log only and never to the model.
- `R/llm/decision-handlers/answer-check.ts:75-76` and `supersede.ts:21-25`: **E**.
  They replace a superseded Core note or look with the newer one.

Provider and profile:

- `R/llm/harness/token-limits.ts:25`: `AUTOMATION_STUDIO_LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST = 64_000`.
  `:53-60` clamps any larger request.
- `R/llm/session-key-provider.ts:29`: the live profile is 48,000 in, 8,000 out and
  56,000 total.
- `R/llm/deepseek/preflight.ts`:
  - `:36` refuses `maxTotalTokens > 64_000`.
  - `:53-77` `boundedJson`: depth 20, 1,000 children, 20,000 total entries,
    strings of 20,000 characters and keys of 500. Past any of these, the whole
    request is refused.
  - `:116`: the evidence count is at most `maxToolCalls`.
- `R/llm/deepseek/provider.ts:97-100`: `provider_input_budget_exceeded` carries no
  size.
- `R/llm/harness/run.ts:98-103`: `llm_budget.input_limit_exceeded`, with the
  estimated and maximum input tokens in its metadata.
- `packages/fluxiq/src/programs/automation-studio/api/handlers/llm-execution-settings.ts:29-31`:
  64,000.
- `apps/web/src/features/automation-studio/settings/flow-settings-model.ts:10`:
  64,000.
- **The model's context window** is `R/llm/deepseek/models.ts:43-51`
  `AUTOMATION_STUDIO_DEEPSEEK_MODEL_LIMITS`: `deepseek-flash` and
  `deepseek-v4-pro` both have `contextTokens: 1_000_000` and
  `maxOutputTokens: 384_000`. **Nothing enforces it today.**

Repair:

- `R/llm/harness/failure-evidence.ts`:
  - **B:** `:29` `AUTOMATION_STUDIO_LLM_MAX_FAILURE_EVIDENCE_BYTES = 6_000`, which
    refuses at `:78`.
  - **B/C/A:** `:88-92` strings of 2,000, depth 12, 128 children and 512 entries.
- `R/llm/harness/explored-evidence.ts`:
  - **B:** `:38,79` allowance.
  - **A/D/E:** `:83-91` newest first, with the rest `withheldPackets`.
  - **E:** `:137-150` a string over 2,000 withholds the packet.
- `R/llm/harness/json-bounds.ts:26-30`: **C/A**.
- `R/llm/harness/context-packet.ts`:
  - **A:** `:270-271` `stateDiffs` 50 and `routeHistory` 25.
  - **B:** `:359` diagnosis 500.
  - The other slices (`:119,272,291-295`) cover recent actions, runs, subflows and
    capabilities. They are not page information.
- `R/recovery/annotation/annotate.ts`:
  - **B:** `:265-268` failure capture `min(6,000, …)`.
  - **E:** `:286-288` over that, the recovery ends "unavailable".
  - **B:** `:462` exploration share.
- `R/recovery/runtime-exploration.ts:313-327`: default window 64,000.
- `R/recovery/exploration-budget.ts:116-150`: **A/B**. These are stops.
- `R/recovery/context.ts`:
  - **B:** `:261,268-269` 8,000, clamped to 1,500-16,000.
  - **A:** `:272` 8 items per section.
  - **C/E:** `:646-663` `state_diff` bounds.
  - **D:** `:135-150` section priority.
- `R/recovery/context-budget/*`: **B/E/D**. `fit.ts`, `graph-trim.ts`,
  `section-trim.ts`, `steps-trim.ts` and `prose-cap.ts`.
- `R/recovery/repair-context/parameter-screen.ts`:
  - **C/A/B:** `:174-178` depth 3, 12 keys, 6 items, names 80 and 16 withheld
    paths.
  - **E:** `:281-287` a URL is reduced to its origin. `:289` a non-vocabulary
    string, or one over 80, is withheld.
  - **F:** `:215,277`.
- Other repair context: `step-parameters.ts:31` (12 steps), `flow-graph.ts:44-50`,
  `authored-state-screen.ts:112-130`, `refuted-result/brief.ts:41-43` and
  `history.ts:49`.
- `R/route-state/observe.ts:7,49`: **B**. Refuses over 32,768.
- `R/flow-bootstrap/plan/routing-context.ts:76-82,123-163`: **A/B/C/D**. 24 paths,
  6 situations, 24 entries, values of 300, 6,000 bytes and depth 6.

Judgement:

- `R/result-verification/result-summary.ts:14-36`: **A/B**. 4 record sets, 4 or 8
  rows, 24 columns, values of 120, 40 steps and 4,000 bytes. `:132` over 4,000,
  every sample is dropped.
- `run-outcome.ts:512-519`: the same limits.
- `verdict.ts:46`: 12 observed steps.
- `repair-directive.ts:72-79`: bounds on the judge's own output.

Outside Core, but the same ceiling:

- `packages/test-contracts/src/llm.ts:34,138-140`: 64,000, 48,000 and 56,000.
- `packages/test-contracts/src/llm-validation.ts:106-108,165-182`.
- `packages/test-runner/src/web-flow-exploration.ts:5`:
  `DEFAULT_MAX_EVIDENCE_BYTES = 48_000`.

**F (kept):**

- `R/llm/harness/evidence-screen.ts:24-39` (`CREDENTIAL_SHAPES`),
  `request-evidence-check.ts`, `context-packet.ts:323`, `recovery/context.ts:314`,
  `parameter-screen.ts:215,277`, `result-summary.ts:293` and `draft-screen.ts`.
- **Spend ceiling (kept):**
  - `R/llm/flow-execution-limits/run-cost-ceiling.ts:17` ($0.25).
  - `resolution-within-flow-settings.ts:31`.
  - `harness/token-limits.ts:26`.
  - `session-key-provider.ts:32-34`.
  - `loop-budget.ts:106-109`.
  - `run-budget.ts:148-180`.
  - `recovery/annotation/run-budget.ts:126`.

## Target design (decided by the lead)

- **D1 Elements.** Every rendered element of the composed tree is included: every
  open shadow root and every frame.
  - Excluded: `html` and `body`, the extension's own UI, and anything that is not
    rendered. Not rendered means inside script, style, noscript or template, under
    `display:none`, under `visibility:hidden`, or under a `[hidden]` attribute.
    Those elements are neither visible nor interactive.
  - `aria-hidden`, `opacity:0`, sub-2px and nameless elements are included.
- **D2 Order.** Composed document order within a frame, with frames in frame
  order. There is no ranking, no bucket, no front-layer-first and no
  exemplar-follower sort.
- **D3 Per element.**
  - The tag, and every attribute in source order.
  - The element's own text. Interactive and semantic elements also carry their
    full text.
  - The accessible name, all options, state, bounds and whether it is on the
    viewport.
  - No text, attribute or option is truncated.
- **D4 Attributes on the packet** are published as `[name, value]` tuples, not as
  an object keyed by name. Core's denied-key screen walks keys at every depth, and
  `headers` (a standard `td`/`th` attribute) and `selector` are among the domain's
  denied keys.
- **D5 Secret screening is kept.**
  - Sensitive controls are handled as today.
  - Every string the packet publishes is checked with Core's own
    `screenAutomationStudioLlmEvidence(text, []).secretShaped`, which is exported
    from `fluxiq/automation-studio`. A match is replaced by a withheld marker, so
    Core's pre-send check never refuses a page for one token-shaped attribute.
  - URLs keep their query, but a parameter whose name is secret-shaped is
    withheld.
- **D6 No byte budgets.** The domain packet is unbounded. Core's window shows
  every evidence entry, and the history and draft entries always use their full
  form.
- **D7 The context window.**
  - The request limit is the model's context window from
    `AUTOMATION_STUDIO_DEEPSEEK_MODEL_LIMITS`, which is 1,000,000 tokens for both
    models.
  - Every per-request ceiling moves to it: Core's 64k, the profile's 48k/56k, the
    API settings bound, the preflight, the web settings and the Lab contract.
  - A request whose estimated input plus reserved output exceeds the window fails
    loudly. The failure carries a code, the measured estimated tokens and bytes,
    and the window. It never trims.
- **D8 Kept.** The $0.25 per-build spend ceiling and the per-call cost check
  derived from it. Secret and denied-key screening.
- **D9 The look includes child frames**, because robot checks and many consent
  walls are iframes. A frame that does not answer is named in the snapshot, not
  dropped silently.

## Worker partition (dispatched 2026-09-30)

The workers are partitioned by file, and each writes its own report beside this
one.

- **t200-w1-extension** (`worker-high`), downstream. Owns `apps/extension/src/**`
  except the chat UI (`panel/`, `sidepanel/`, `popup/`, `background/panel/`), plus
  `apps/extension/manifest.*.json`.
- **t200-w2-domain** (`worker-high`), downstream. Owns:
  - `domain/src/runtime/**` and `domain/src/page-evidence/**`;
  - `domain/src/tests/domain.test.ts`;
  - `docs/architecture/page-evidence.md`.
- **t200-w3-core-build** (`worker-high`), Core. Owns:
  - in `R/llm/`: `context-window.ts`, `loop-configuration.ts`, `evidence-loop.ts`,
    `evidence-loop-decision.ts` and `session-key-provider.ts`;
  - in `R/llm/`: `decision-context/`, `evidence-loop/`, `decision-handlers/`,
    `node-tools/` and `deepseek/`;
  - `R/llm/harness/{token-limits,token-estimation,run}.ts`;
  - `R/loop-limits/**` and `R/flow-draft/**`;
  - `R/llm/tests/**`, except the harness tests;
  - `api/handlers/llm-execution-settings.ts`;
  - `apps/web/.../settings/flow-settings-model.ts`;
  - `docs/architecture/automation-studio/llm-flow-bootstrap.md`.
- **t200-w4-core-repair** (`worker-high`), Core. Owns:
  - `R/llm/harness/**` except the three files above;
  - `R/llm/tests/harness.test.ts`;
  - `R/recovery/**` and `R/route-state/**`;
  - `R/flow-bootstrap/plan/routing-context.ts`;
  - `R/result-verification/**`.
- **t200-w5-lab-contract** (`worker`), downstream. Owns `packages/test-contracts/**`
  and `packages/test-runner/src/web-flow-exploration.ts`.
- **t200-w6-measure** (`worker-high`). The harness lives outside both trees, in
  `C:/Users/osrs_/FluxStuff/fxwork/t200/measure/`. It takes a baseline on the
  committed code first, then a second measurement on the working tree.

The lead edited `domain/src/page-evidence/types.ts` before dispatch. It adds
`unansweredFrameIds?: number[]` to `WebAutomationPageEvidence`, so the extension
and the domain build against one contract.

## Changes

### Second round and course corrections

- **Four workers were refused on the first dispatch.** The first dispatch sent
  six workers. Four of them (the two Core workers, the Lab contract worker and
  the measurement worker) were refused at the session's 20-subagent limit. They
  were re-dispatched once w1 and w2 returned.
- **Audit a4 (supervisor, 2026-09-30).** Removing the ordering was right. But the
  information behind it had to stay on each element. Two follow-up workers did
  this:
  - **t200-w1b-extension-flags:**
    - `lead-statements.ts` is restored as the flag `leadStatement`, with no cap.
    - `isFrontLayer` is restored as the flag `frontLayer`.
    - Dialogs and blockers carry `kind` (`consent`, `rate_limit`,
      `robot_check`), taken from the existing interference classifiers.
  - **t200-w2b-domain-flags:** each element's own packet entry now carries:
    - `isDialog`, `inDialog`, `covers`, `coversCount`, `coveredBy`, `frontLayer`
      and `statement`;
    - the page-level `dialogs[]` and `blockedBy[]` name the element by `target`,
      with its `kind`;
    - Luhn-valid card numbers are withheld.
- **Labs stopped (supervisor).** Step 3's measurement was not run. See
  "Measurement".
- **Seam and cleanup workers:**
  - **t200-w7-core-seams (Core):**
    - `maxEvidenceBytes` is gone from the harness-options contract.
    - Screening of secret-shaped values in explored packets is restored.
    - The harness and the adapter now share one token estimator, so the loud,
      sized refusal always fires first.
    - Each call reserves its own measured tokens against the run budget.
    - The web settings text now reads the window.
    - The bare word `key` no longer withholds a value.
    - The reusable context is ordered by `createdAt`, not by score.
    - Core docs are updated and the reference is regenerated.
  - **t200-w8-lab-exploration (downstream):** removed the Lab exploration's 80-
    and 150-element and 300-, 500- and 80-character caps, and the campaign's
    run-token budget. Updated `testing-facility.md`.
- **The lead's own edits:**
  - `domain/src/page-evidence/types.ts` and `index.ts`: `unansweredFrameIds` and
    `WebAutomationLayerKind`, `kind` on dialog and overlay items, and a docs
    correction.
  - Seven domain test literals: removed the dead `maxEvidenceBytes`.
  - Core `runtime/service/flow-bootstrap-commands/evidence-trace.ts`: removed a
    1 MiB bound on one call's evidence byte count. A page over 1 MiB would have
    thrown there and discarded the whole build record. Added two tests in
    `tests/evidence-trace.test.ts`.
  - `.structure-baseline.json` (downstream): lowered by `structure:baseline` for
    `domain/src/runtime/adapter.ts` and `llm-evidence/page-evidence.ts`, both
    t200 files. Core's baseline was left unchanged: its lowerable entries are
    not t200's.

### What the model now receives

- **The capture** (`apps/extension`):
  - It includes every rendered element of the composed tree, across every open
    shadow root and every frame, in document order. The look merges all frames.
  - A frame that does not answer is named in `unansweredFrameIds`.
  - Every attribute is sent, and no text, value or option is cut.
  - Nothing is ranked. `aria-hidden`, `opacity:0`, sub-2px and nameless elements
    are included.
  - Evidence modules query open shadow roots.
  - The manifests match about:blank and srcdoc frames.
- **The packet** (`domain`, `web-llm-evidence.v2`):
  - Every element, in capture order, with `attributes` as `[name, value]`
    tuples, plus `box`, `onViewport`, `hasClickHandler`, `implicitRole`, `label`,
    `checked` and a non-sensitive `value`.
  - Every option, and the full `href` including cross-origin links.
  - The full location with its query; a secret-named parameter's value is
    withheld.
  - Every dialog and blocker, with the covering marks above.
  - No byte budget, and no `elementTotal`, `elementsTruncated` or
    `budgetTruncated`.
  - Handles run up to 6 digits.
  - Every published string passes Core's `screenAutomationStudioLlmEvidence`
    plus a Luhn card check.
- **Core:**
  - The window shows every evidence entry in call order, and the history and
    the draft are always shown in full.
  - The 24,000-byte window, `toolEvidenceBytes`, the 4 KB draft cap, the 1,280
    floor, the 512-byte step input, the 1 MiB backstop and `evidence_limit`-on-
    bytes are all removed.
  - `isJsonValue` and the preflight JSON check keep only cycle detection and a
    depth-64 recursion guard.
  - Every page-derived cap is removed from repair, the recovery context
    (`context-budget/` deleted), the parameter screen, route state, the routing
    context, the reusable context and the result summary.
- **The window:**
  - `AUTOMATION_STUDIO_LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST` is now the
    model's context window. It is derived from `AUTOMATION_STUDIO_DEEPSEEK_MODEL_LIMITS`
    through `R/llm/model-limits/`: **1,000,000 tokens** for `deepseek-flash` and
    `deepseek-v4-pro`.
  - The live profile is 992,000 in, 8,000 out and 1,000,000 total, and so are
    the Lab contract, the API settings and the web settings.
  - A request over the window is refused before it is sent, with the estimated
    tokens, the bytes and the window in the message. For example: "Packed LLM
    request is an estimated N input tokens (B bytes), over its 992000-token input
    limit ... It was not sent, and nothing was trimmed to fit."
- **Kept:**
  - The $0.25 per-build spend ceiling, and the per-call cost check (it now prices
    the call's own measured tokens).
  - Every secret, denied-key and locator screen.
  - Limits on the model's own output: `repair-directive.ts`, the provider-result
    structural check, and `MAX_AMENDMENTS_PER_DECISION`.
  - `answer-check.ts` dropping an identical earlier look, and `supersede.ts`
    replacing a Core note with its newer copy.

### Open items (not done, with reasons)

1. **Core `model/flows.ts:263` default `budgets.maxTokensPerRun: 12000`.** It caps
   an unattended recovery's tokens at 12,000, so a whole-page recovery request
   is refused there. It is not on the build path. It reaches:
   - a locked-default migration (`service/flow-settings/tests/locked-default-migration.test.ts`);
   - the web settings model (`flow-settings-model.ts:122,146,403,508`);
   - about 10 tests.

   Recommendation: drop the default so cost bounds the run. That is a
   settings-migration change, so it was left out of this merge.
2. **Lab spend: `live-llm-plan.ts` reads `--llm-max-cost-usd` as per call.** It
   caps a run at min($2, 0.25 x calls), so a campaign run can spend up to $2. This
   is not t200's defect; it is reported by t200-w8.
3. **Audit a1 items 1c and 1e are not done.** They are the step `id` in the
   draft and the drafting instruction. They are separate fixes that now land on
   t200's `flow-draft/entry.ts` and `evidence-loop-decision.ts`.
4. **Not in scope, and still bounded:**
   - Domain `recording/web-state/**`, the recorded-state projection (1,500
     elements plus evidence caps). It is not a model path today.
   - The failure-record `expected` and `actual` text (1,024 in the contracts
     package).
   - Structure detection's choice of which list `detect` returns. Its caps are
     gone, but the choice is the tool's meaning.
   - The identity heuristics' search bounds in `content/identity/*`. These are
     derived fields; the page text itself is complete.
5. **Cost.** Every decision now carries every page seen so far in full. A build
   may therefore reach the $0.25 ceiling in fewer decisions than before; the
   ceiling stops it, by design. This is unmeasured (see "Measurement").

### Integration conflicts to expect (from audit a4, a1 and the worker reports)

- **Shared with `task/t194-live-judge-answer`:**
  - `apps/extension/src/shared/protocol.ts`;
  - `runtime/action-runner.ts` and `runtime/command-router.ts`;
  - `domain/.../node-run/run.ts`.
- **Shared with `task/t174-live-lane`:**
  - `node-run/{run,replay}.ts`;
  - `capture.ts`, `sanitize.ts`, `stable-handles.ts`, `structure/detect.ts`,
    `tool-rejection.ts` and `tools.ts`;
  - `content/evidence/lead-statements.ts` (t174 F10, now restored as a flag).
- **Shared with `task/t196-state-digest-cost`:**
  - downstream `node-run/replay.ts`;
  - Core `flow-draft/**`, `evidence-loop/**`, `node-tools/**` and
    `decision-handlers/completion.ts`.
- **Core `llm/evidence-loop/progress-trace.ts`:** untouched by t200.

The reports in `docs/working/language-driven-flow-loop-plan/reports/`:

- `t200-model-sees-whole-page.md` (this file);
- `t200-w1-extension.md`, `t200-w1b-extension-flags.md`;
- `t200-w2-domain.md`, `t200-w2b-domain-flags.md`;
- `t200-w3-core-build.md`, `t200-w4-core-repair.md`;
- `t200-w5-lab-contract.md`;
- `t200-w7-core-seams.md`;
- `t200-w8-lab-exploration.md`.

### Changed files, downstream (fxwork/t200/!FluxIQWebExtension)

```text
 M .structure-baseline.json
 D apps/extension/e2e/content/tests/evidence/tests/budget.spec.ts
 M apps/extension/e2e/content/tests/evidence/tests/controls.spec.ts
 M apps/extension/manifest.chrome.json
 M apps/extension/manifest.firefox.json
 M apps/extension/src/background/connection/dom-snapshot.ts
 M apps/extension/src/background/connection/server-command-channel.ts
 M apps/extension/src/background/connection/tests/dom-snapshot.test.ts
 M apps/extension/src/background/connection/tests/recording-evidence.test.ts
 M apps/extension/src/content/action-runtime/in-place-effect.ts
 M apps/extension/src/content/action-runtime/interference/index.ts
 M apps/extension/src/content/capture-settings.ts
 M apps/extension/src/content/describe-element.ts
 M apps/extension/src/content/dom-snapshot.ts
 M apps/extension/src/content/element-traits.ts
 M apps/extension/src/content/event-elements.ts
 M apps/extension/src/content/evidence/changes.ts
 M apps/extension/src/content/evidence/controls.ts
 M apps/extension/src/content/evidence/dialogs.ts
 M apps/extension/src/content/evidence/forms.ts
 M apps/extension/src/content/evidence/index.ts
 M apps/extension/src/content/evidence/lead-statements.ts
 D apps/extension/src/content/evidence/link-address.ts
 M apps/extension/src/content/evidence/loading.ts
 M apps/extension/src/content/evidence/navigation.ts
 M apps/extension/src/content/evidence/overlays.ts
 M apps/extension/src/content/evidence/page.ts
 M apps/extension/src/content/evidence/regions.ts
 M apps/extension/src/content/evidence/repeating.ts
 M apps/extension/src/content/evidence/tests/forms.test.ts
 M apps/extension/src/content/evidence/tests/lead-statements.test.ts
 M apps/extension/src/content/evidence/types.ts
 M apps/extension/src/content/identity/accessible-name.ts
 M apps/extension/src/content/identity/bounded-text.ts
 M apps/extension/src/content/identity/candidates.ts
 M apps/extension/src/content/identity/context.ts
 M apps/extension/src/content/identity/index.ts
 M apps/extension/src/content/identity/label.ts
 M apps/extension/src/content/identity/record.ts
 M apps/extension/src/content/identity/stable-name.ts
 M apps/extension/src/content/repeat-exemplars.ts
 M apps/extension/src/content/shadow-dom/composed-roots.ts
 M apps/extension/src/content/shadow-dom/index.ts
 M apps/extension/src/content/tests/describe-element.test.ts
 M apps/extension/src/content/tests/repeat-exemplars.test.ts
 M apps/extension/src/content/tests/stub-page.ts
 M apps/extension/src/runtime/action-runner.ts
 M apps/extension/src/runtime/command-router.ts
 M apps/extension/src/runtime/index.ts
 M apps/extension/src/shared/protocol.ts
 M apps/extension/src/shared/tests/present.test.ts
 M docs/architecture/page-evidence.md
 M docs/architecture/testing-facility.md
 M domain/src/page-evidence/index.ts
 M domain/src/page-evidence/tests/capture.test.ts
 M domain/src/page-evidence/types.ts
 M domain/src/runtime/adapter.ts
 M domain/src/runtime/host-runtime.ts
 M domain/src/runtime/llm-evidence/capture.ts
 M domain/src/runtime/llm-evidence/elements.ts
 M domain/src/runtime/llm-evidence/enter-field.ts
 M domain/src/runtime/llm-evidence/front-layer.ts
 M domain/src/runtime/llm-evidence/harness-options/execute.ts
 M domain/src/runtime/llm-evidence/harness-options/options.ts
 M domain/src/runtime/llm-evidence/harness-options/tests/detect-option.test.ts
 M domain/src/runtime/llm-evidence/harness-options/tests/options.test.ts
 M domain/src/runtime/llm-evidence/index.ts
 D domain/src/runtime/llm-evidence/limits.ts
 M domain/src/runtime/llm-evidence/location.ts
 M domain/src/runtime/llm-evidence/look-alikes.ts
 M domain/src/runtime/llm-evidence/node-run/read-result.ts
 M domain/src/runtime/llm-evidence/node-run/replay.ts
 M domain/src/runtime/llm-evidence/node-run/run.ts
 M domain/src/runtime/llm-evidence/node-run/tests/person-needed.test.ts
 M domain/src/runtime/llm-evidence/page-evidence.ts
 M domain/src/runtime/llm-evidence/plan-resolution/element-identity.ts
 M domain/src/runtime/llm-evidence/plan-resolution/handle-tokens.ts
 M domain/src/runtime/llm-evidence/plan-resolution/tests/plan-node-identity.test.ts
 M domain/src/runtime/llm-evidence/plan-resolution/tests/record-identity.test.ts
 M domain/src/runtime/llm-evidence/plan-resolution/tests/resolve-plan-node.test.ts
 M domain/src/runtime/llm-evidence/sanitize.ts
 M domain/src/runtime/llm-evidence/stable-handles.ts
 M domain/src/runtime/llm-evidence/state-digest/index.ts
 M domain/src/runtime/llm-evidence/state-digest/snapshot-states.ts
 M domain/src/runtime/llm-evidence/state-digest/state-digest.ts
 M domain/src/runtime/llm-evidence/state-digest/tests/call-route-states.test.ts
 M domain/src/runtime/llm-evidence/state-digest/tests/call-state-digests.test.ts
 M domain/src/runtime/llm-evidence/state-digest/tests/state-digest.test.ts
 M domain/src/runtime/llm-evidence/structure/detect.ts
 M domain/src/runtime/llm-evidence/structure/packet.ts
 M domain/src/runtime/llm-evidence/structure/refusal.ts
 M domain/src/runtime/llm-evidence/structure/tests/badge-column.test.ts
 M domain/src/runtime/llm-evidence/structure/tests/detect.test.ts
 M domain/src/runtime/llm-evidence/target/candidates.ts
 M domain/src/runtime/llm-evidence/target/equivalence.ts
 M domain/src/runtime/llm-evidence/target/index.ts
 M domain/src/runtime/llm-evidence/target/override.ts
 M domain/src/runtime/llm-evidence/target/tests/candidates.test.ts
 M domain/src/runtime/llm-evidence/target/tests/equivalence.test.ts
 M domain/src/runtime/llm-evidence/tests/elements.test.ts
 M domain/src/runtime/llm-evidence/tests/extraction-failure-detail.test.ts
 M domain/src/runtime/llm-evidence/tests/failure-row-values.test.ts
 D domain/src/runtime/llm-evidence/tests/limits.test.ts
 M domain/src/runtime/llm-evidence/tests/look-alikes.test.ts
 M domain/src/runtime/llm-evidence/tests/packet-carries-no-selector.test.ts
 M domain/src/runtime/llm-evidence/tests/page-evidence.test.ts
 M domain/src/runtime/llm-evidence/tests/page-refusal.test.ts
 M domain/src/runtime/llm-evidence/tests/present.test.ts
 M domain/src/runtime/llm-evidence/tests/press.test.ts
 M domain/src/runtime/llm-evidence/tests/recovery-selector-hints.test.ts
 M domain/src/runtime/llm-evidence/tests/renamed-save-override.test.ts
 M domain/src/runtime/llm-evidence/tests/sanitize.test.ts
 M domain/src/runtime/llm-evidence/tests/stable-handles.test.ts
 M domain/src/runtime/llm-evidence/tests/tool-rejection-detail.test.ts
 M domain/src/runtime/llm-evidence/tests/tools.test.ts
 M domain/src/runtime/llm-evidence/tool-rejection.ts
 M domain/src/runtime/llm-evidence/tools.ts
 M domain/src/runtime/llm-evidence/untrusted-json.ts
 M domain/src/runtime/reusable-evidence.ts
 M domain/src/runtime/route-state/paths.ts
 M domain/src/runtime/route-state/project.ts
 M domain/src/runtime/tests/adapter.test.ts
 M domain/src/runtime/tests/host-runtime.test.ts
 M domain/src/runtime/tests/reusable-evidence.test.ts
 M domain/src/tests/domain.test.ts
 M domain/src/tests/page-evidence-joinery.test.ts
 M packages/test-contracts/src/llm.ts
 M packages/test-contracts/tests/llm-contracts.test.mjs
 M packages/test-runner/src/bench/evaluate-run.ts
 M packages/test-runner/src/flow-lane/persisted-flow-run.ts
 M packages/test-runner/src/live-llm/live-llm-plan.ts
 M packages/test-runner/src/live-llm/tests/budget.test.ts
 M packages/test-runner/src/live-llm/tests/live-llm-plan.test.ts
 M packages/test-runner/src/live-llm/tests/live-llm-run.test.ts
 D packages/test-runner/src/run-evaluation/evidence-budget-invariant.ts
 M packages/test-runner/src/run-evaluation/flow-lane-evidence-sizes.ts
 M packages/test-runner/src/run-evaluation/index.ts
 M packages/test-runner/src/run-evaluation/observed-run-evaluation.ts
 D packages/test-runner/src/run-evaluation/tests/evidence-budget-invariant.test.ts
 M packages/test-runner/src/run-evaluation/tests/observed-run-evaluation.test.ts
 M packages/test-runner/src/run-expectations/recording-event-types.ts
 M packages/test-runner/src/tests/commands.test.ts
 M packages/test-runner/src/tests/demo-llm-adaptation.test.ts
 M packages/test-runner/src/tests/web-flow-exploration.test.ts
 M packages/test-runner/src/web-flow-exploration.ts
 M scripts/lab/live-campaign/lab-run/command.mjs
 M scripts/lab/live-campaign/tests/command-line.test.mjs
 M scripts/lab/live-campaign/tests/lab-run-command.test.mjs
 M scripts/lab/live-campaign/tests/tasks.mjs
?? apps/extension/src/content/action-runtime/interference/layer-kind.ts
?? apps/extension/src/content/action-runtime/interference/tests/layer-kind.test.ts
?? apps/extension/src/content/descriptor-attributes.ts
?? apps/extension/src/content/evidence/front-layer.ts
?? apps/extension/src/content/evidence/tests/front-layer.test.ts
?? apps/extension/src/content/identity/normalized-text.ts
?? apps/extension/src/content/rendered-elements.ts
?? apps/extension/src/content/shadow-dom/query-in-order.ts
?? apps/extension/src/content/tests/descriptor-attributes.test.ts
?? apps/extension/src/content/tests/rendered-elements.test.ts
?? apps/extension/src/runtime/look-across-frames.ts
?? apps/extension/src/runtime/tests/look-across-frames.test.ts
?? domain/src/runtime/llm-evidence/attributes.ts
?? domain/src/runtime/llm-evidence/layer-marks.ts
?? domain/src/runtime/llm-evidence/layers.ts
?? domain/src/runtime/llm-evidence/tests/layers.test.ts
?? domain/src/runtime/llm-evidence/tests/whole-page.test.ts
?? domain/src/runtime/llm-evidence/tests/withheld.test.ts
?? domain/src/runtime/llm-evidence/withheld.ts
```

### Changed files, Core (fxwork/t200/!FluxIQ)

```text
 M apps/web/src/features/automation-studio/settings/FlowSettingsView.tsx
 M apps/web/src/features/automation-studio/settings/flow-settings-model.ts
 M apps/web/src/features/automation-studio/settings/tests/settings-view.test.tsx
 M docs/architecture/automation-studio.md
 M docs/architecture/automation-studio/llm-flow-bootstrap.md
 M docs/architecture/automation-studio/persistence.md
 M docs/architecture/package-boundaries.md
 M docs/reference/framework-reference.md
 M packages/fluxiq/docs/reference/framework-reference.md
 M packages/fluxiq/src/programs/automation-studio/api/handlers/llm-execution-settings.ts
 M packages/fluxiq/src/programs/automation-studio/api/handlers/tests/llm-execution-settings.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/activity/tests/observer.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/harness-failure.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/person-needed.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/plan/routing-context.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/tests/person-needed.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/entry.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/tests/accrual.test.ts
 D packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/tests/entry-budget.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/tests/entry.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/tests/routing.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/context-window.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/decision-context/closed-detail.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/decision-context/compression.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/decision-context/entry.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/decision-context/index.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/decision-context/shown.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/decision-context/tests/closed-detail.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/decision-context/tests/compression.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/decision-context/tests/entry.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/decision-context/tests/recorded-windows.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/decision-handlers/amendment.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/decision-handlers/answer-check.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/decision-handlers/answered-request.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/decision-handlers/completion.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/decision-handlers/failed-call.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/decision-handlers/types.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/deepseek/models.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/deepseek/preflight.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/deepseek/provider.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/deepseek/request-body.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop-decision.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/answered-request.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/completion-attempt.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/draft-shown.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/result.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/resume.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/stall-redirect.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/tests/completion-attempt.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/tests/draft-shown.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/tests/resume.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/harness-options/binding.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/harness-options/option.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/harness-options/registry.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/harness-options/tests/binding.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/harness-options/tests/builtin.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/harness-options/tests/registry.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/harness/context-packet.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/harness/explored-evidence.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/harness/failure-evidence.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/harness/index.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/harness/json-bounds.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/harness/provider.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/harness/request-evidence-check.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/harness/run.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/harness/task-request.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/harness/tests/draft-screen.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/harness/tests/explored-evidence-label.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/harness/token-limits.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/loop-configuration.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/node-tools/dry-run-gate.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/node-tools/replay-draft.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/node-tools/tests/dry-run-gate.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/provider-contract.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/session-key-provider.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/context-window.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/deepseek-evidence-preflight.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/deepseek-provider.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/draft-amendment-feedback.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/evidence-loop-draft-shown.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/evidence-loop.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/harness.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/loop-budget.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/recovery-context-packet.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/run-call-record.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/session-key-provider.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/loop-limits/evidence-loop.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/loop-limits/flow-bootstrap-evidence-loop.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/loop-limits/index.ts
 D packages/fluxiq/src/programs/automation-studio/runtime/loop-limits/result-summary.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/loop-limits/tests/flow-bootstrap-evidence-loop.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/recovery/annotation/annotate.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/recovery/annotation/patch-reserve.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/recovery/annotation/run-budget.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/recovery/annotation/tests/annotate.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/recovery/annotation/tests/exploration.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/recovery/annotation/tests/iteration-guards.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/recovery/annotation/tests/patch-reserve.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/recovery/annotation/tests/patches.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/recovery/annotation/tests/run-budget.test.ts
 D packages/fluxiq/src/programs/automation-studio/runtime/recovery/context-budget/essential-sections.ts
 D packages/fluxiq/src/programs/automation-studio/runtime/recovery/context-budget/fit.ts
 D packages/fluxiq/src/programs/automation-studio/runtime/recovery/context-budget/graph-trim.ts
 D packages/fluxiq/src/programs/automation-studio/runtime/recovery/context-budget/index.ts
 D packages/fluxiq/src/programs/automation-studio/runtime/recovery/context-budget/lossless-levels.ts
 D packages/fluxiq/src/programs/automation-studio/runtime/recovery/context-budget/prose-cap.ts
 D packages/fluxiq/src/programs/automation-studio/runtime/recovery/context-budget/section-trim.ts
 D packages/fluxiq/src/programs/automation-studio/runtime/recovery/context-budget/steps-trim.ts
 D packages/fluxiq/src/programs/automation-studio/runtime/recovery/context-budget/tests/trims.test.ts
 D packages/fluxiq/src/programs/automation-studio/runtime/recovery/context-budget/trim-step.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/recovery/context-summary.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/recovery/context.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/recovery/exploration-budget.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/recovery/refuted-result/brief.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/recovery/refuted-result/history.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/recovery/repair-context/authored-state-screen.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/recovery/repair-context/flow-graph.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/recovery/repair-context/index.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/recovery/repair-context/parameter-screen.ts
 D packages/fluxiq/src/programs/automation-studio/runtime/recovery/repair-context/parameter-vocabulary.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/recovery/repair-context/step-parameters.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/recovery/repair-context/tests/flow-graph.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/recovery/repair-context/tests/parameter-screen.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/recovery/repair-context/tests/withheld-notation.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/recovery/runtime-exploration.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/recovery/tests/authored-state-screen.test.ts
 D packages/fluxiq/src/programs/automation-studio/runtime/recovery/tests/context-fit.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/recovery/tests/context.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/recovery/tests/exploration-budget.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/recovery/tests/request-locator-shapes.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/result-verification/contracts.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/result-verification/result-summary.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/result-verification/run-outcome.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/result-verification/tests/result-summary.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/result-verification/tests/run-outcome.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/result-verification/verdict.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/reusable-llm-context.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/route-state/observe.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/route-state/tests/build-routing.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/service/flow-bootstrap-commands/evidence-trace.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/service/flow-bootstrap-commands/tests/evidence-trace.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/tests/deepseek-bootstrap-exploration.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/tests/deepseek-recovery-requests.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/tests/recovery-default-limits.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/tests/refuted-result/tests/repair-context.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/tests/reusable-llm-context-service.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/tests/reusable-llm-context.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/tests/service-adaptation/tests/llm-diagnosis.test.ts
 M packages/fluxiq/src/programs/automation-studio/runtime/tests/service-bootstrap/tests/generation.test.ts
 M packages/fluxiq/src/programs/automation-studio/storage/project/reusable-llm-context-store.ts
 M packages/fluxiq/src/programs/automation-studio/storage/project/tests/reusable-llm-context-store.test.ts
?? packages/fluxiq/src/programs/automation-studio/runtime/llm/harness/tests/run-size.test.ts
?? packages/fluxiq/src/programs/automation-studio/runtime/llm/model-limits/index.ts
?? packages/fluxiq/src/programs/automation-studio/runtime/llm/model-limits/max-context-tokens.ts
?? packages/fluxiq/src/programs/automation-studio/runtime/llm/model-limits/model-limits.ts
?? packages/fluxiq/src/programs/automation-studio/runtime/recovery/repair-context/secret-named-key.ts
?? packages/fluxiq/src/programs/automation-studio/runtime/recovery/repair-context/tests/secret-named-key.test.ts
?? packages/fluxiq/src/programs/automation-studio/runtime/recovery/tests/context-whole.test.ts
```

## Measurement

**Not measured.** The supervisor stopped all Labs on 2026-09-30 and told this
lane not to run the Lab for step 3. The measurement worker (t200-w6) had been
refused at the subagent limit and was not re-dispatched.

A unit-level capture of the ten scenarios is not possible without a browser.
The capture reads computed style and layout (rendering, box, viewport), and
the scenario pages are rendered by the Scenario Lab.

What is recorded:

- **The context window** is 1,000,000 tokens for both `deepseek-flash` and
  `deepseek-v4-pro`. It is set in `R/llm/deepseek/models.ts`
  (`AUTOMATION_STUDIO_DEEPSEEK_MODEL_LIMITS`) and exposed as
  `AUTOMATION_STUDIO_DEEPSEEK_MAX_CONTEXT_TOKENS` in `R/llm/model-limits/`.
- **One estimator** measures every request: UTF-8 bytes / 3
  (`R/llm/token-estimation.ts`). The harness refusal reports those tokens and
  bytes.
- **At the $0.25 ceiling**, a single call near the window (about $0.31 at
  flash's cache-miss rate, per t200-w7) is refused by the spend check. That is
  by design.

**To take the measurement once Labs resume:** for each of the ten scenarios,
capture the start page and the first post-interruption page with the new
extension. Record elements, packet bytes and `estimateAutomationStudioLlmTokensFromUtf8Bytes`
against 1,000,000. Only the ten realistic scenarios, headed, provider-free.

## Ready to commit

**Ready to commit:** every path listed under the two "Changed files" headings
above, plus the ten t200 reports. That is 168 downstream paths and 159 Core
paths, on `task/t200-model-sees-whole-page` in both trees.

**Validation** (run by the lead after every worker finished; heavy commands
through `build-slots/heavy.sh`):

- **Core** (`fxwork/t200/!FluxIQ`):
  - `pnpm --filter fluxiq check` -> `EXIT=0`.
  - `pnpm --filter fluxiq exec vitest run src/programs/automation-studio/runtime/llm src/programs/automation-studio/runtime/flow-bootstrap src/programs/automation-studio/runtime/recovery src/programs/automation-studio/runtime/result-verification`
    -> `Test Files 163 passed (163)`, `Tests 2054 passed (2054)`, `EXIT=0`.
  - `npx vitest run .../service/flow-bootstrap-commands/tests/evidence-trace.test.ts`
    (the lead's edit) -> `Tests 26 passed (26)`.
  - `pnpm --filter fluxiq build` -> `EXIT=0`.
  - Root `pnpm check` -> `# tests 263`, `# pass 263`, `# fail 0`,
    `structure-audit: passed (199 warning(s), 354 baselined).`, `EXIT=0`.
- **Downstream** (`fxwork/t200/!FluxIQWebExtension`):
  - `pnpm --filter @fluxiq-web-extension/domain check` -> `EXIT=0`.
  - `env DOMAIN_TEST_BUILD_LABEL=t200-lead pnpm --filter @fluxiq-web-extension/domain test`
    -> `# tests 990`, `# pass 990`, `# fail 0`.
  - `env EXTENSION_TEST_BUILD_LABEL=t200-lead pnpm --filter @fluxiq-web-extension/extension test`
    -> `# tests 1490`, `# pass 1490`, `# fail 0`.
  - `pnpm --filter @fluxiq-web-extension/extension build` -> chrome, firefox
    and e2e-chromium each `verified 22 files`, `EXIT=0`.
  - `pnpm --filter @fluxiq-web-extension/extension check` -> `EXIT=0`.
    - The first run failed `Could not resolve "fluxiq/automation-studio/nodes"`,
      because it overlapped the lead's own Core rebuild (`tsc -b --clean`).
    - The re-run after the rebuild passed.
  - `pnpm --filter @fluxiq-web-extension/test-contracts test` -> `# tests 155`,
    `# pass 155`, `# fail 0`.
  - `node --test scripts/lab/live-campaign/tests/*.test.mjs` -> `# tests 21`,
    `# pass 21`, `# fail 0`.
  - Root `pnpm check`:
    - output: `# tests 513`, `# pass 512`, `# fail 0`;
    - `structure-audit: passed (128 warning(s), 119 baselined).`;
    - `pnpm -r check` (extension, domain, test-contracts, test-runner):
      `EXIT=0`.

**Not verified:**

- No browser, Lab or live run; the Labs are stopped.
- The whole-page capture's time and size on the ten scenarios.
- Cost per build at whole-page size.
- Real-Chromium behaviour of the all-frames look and of `match_about_blank`.
- The rewritten `e2e/.../controls.spec.ts`, which was compiled but not run.
- The full test-runner suite, which t200-w5 ran at 1678 of 1681. Its 3 failures
  are in files t200 did not touch (`runner-wiring`, `clone-cache`,
  `demo-workspace`) and were not re-checked against dev.
