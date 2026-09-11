# Report: audit-targeting

## Outcome

Done. Read-only audit of the element-identity model for Phase 1.3 across this
repository and FluxIQ Core. Sections (a)–(e) below, plus the required closing
"what Level 2 needs that does not exist" list. No source file and no working
document was modified.

Headline: there is exactly **one** live-DOM resolver in the product —
`resolveTarget` in `apps/extension/src/content/action-runtime.ts:61` — it is
strictly first-match-wins across four ordered strategies, it cannot detect
ambiguity, and it has **zero** unit tests. Core already ships a complete
evidence-weighted matcher (`createAutomationStudioElementMatcher`) wired into
the dispatch path, but no production code in either repository ever supplies
the `candidates` array it needs, so it is dead in practice.

## What changed and why

Nothing. The brief is a read-only investigation; `Owns (may edit)` is the
report file only.

## Commands run and observed results

All read-only. No build, no Testing Lab, no browser, no panel.

| Command | Observed result |
| --- | --- |
| `grep -rn "WebAutomationActionVisualTarget" domain/src apps packages --include=*.ts` | 8 hits in 3 files: `domain/src/actions/types.ts` (definition + 2 uses), `domain/src/client/gateway-mapping.ts:7,126`, `domain/src/recording/web-state.ts:4,156,187`. |
| `grep -rn "fingerprint\|resolveTarget\|options\.element\|findClosest" apps/extension/src packages domain/src --include=*.ts` | Live-DOM fingerprint resolution exists only in `apps/extension/src/content/action-runtime.ts` and `element-finder.ts`. All other `fingerprint` hits in `packages/test-runner` are clone-cache content hashes, unrelated. |
| `find apps/extension -name "*.test.*" -not -path "*/node_modules/*" \| wc -l` | `0` |
| `find apps/extension -type d -name tests -not -path "*/node_modules/*" \| wc -l` | `0` |
| `grep -rln "document.querySelector(\|elementFromPoint(\|document.evaluate(\|getElementById(" apps/extension/src --include=*.ts` | 3 files, 9 call sites: `content/action-runtime.ts`, `content/element-finder.ts`, `popup/index.ts` (popup hits are its own UI, not page targeting). |
| `grep -rn "tabId\|frameId" domain/src/client/gateway-mapping.ts` | Only in `createWebAutomationRecordingEvent` (lines 49, 61). `webAutomationActionFromGatewayCommand` (line 112) maps **no** `tabId` and **no** `frameId`. |
| `grep -rn "candidatesFromStateSnapshot" packages apps` (Core) | 4 hits, all inside `fingerprinting/element-fingerprint.ts` plus its own test. No production caller. |
| `grep -rn "elementTargetResolution\|unresolved_no_candidates\|prepareElementTargetAction" --include=*.test.ts packages/fluxiq/src` (Core) | 1 hit: `runtime/tests/io-bridge.test.ts:123`. |
| `grep -n "^test(\|it(\"" .../fingerprinting/tests/element-fingerprint.test.ts` (Core) | 3 tests, 76 lines total. |
| `grep -n "content\|entryPoints\|format" apps/extension/scripts/build-extension.mjs` | Content script is an esbuild `platform: "browser"`, `format: "iife"` bundle of `src/content/index.ts`. |

Everything below is sourced from reading those files directly; each claim
carries a `path:line` or an exported symbol name.

## (a) Target evidence captured today

Capture happens in one place: `describeElement` in
`apps/extension/src/content/describe-element.ts:18`, producing
`DomElementDescriptor` (`apps/extension/src/content/types.ts:11`). That
descriptor is the whole of what leaves the page, both for recording
(`background/connection/gateway-payloads.ts:77 elementTarget`) and for action
results (`runtime/result-mapping.ts:19`).

| Plan evidence | Status | Where |
| --- | --- | --- |
| Stable selector | **Partial** | `selectorFor` (`describe-element.ts:69`) prefers `#id`, then `[data-testid=…]`, then `tag[name=…]`; otherwise it falls back to a positional `nth-of-type` chain capped at 5 levels (`describe-element.ts:76-86`). The fallback is a structural path, not a stable identity. `stableElementId` (`describe-element.ts:130`) separately reads `data-testid`/`data-test`/`data-cy`/`id`/`name` but is used only for snapshot ranking, never written into the descriptor. |
| DOM id | **Present** | `describe-element.ts:36`; `DomElementDescriptor.id` (`types.ts:15`). Also duplicated into `attributes.id`. |
| Role | **Partial** | `describe-element.ts:40-41` reads the explicit `role` attribute only. No implicit ARIA role: a `<button>`, `<a href>`, or `<input type=checkbox>` carries `role: undefined`. Core weights `role` at 10 (`element-fingerprint.ts:99`), so this signal is simply absent for most real controls. |
| Accessible name | **Partial** | `accessibleName` (`describe-element.ts:117`) = `aria-label ?? title ?? alt`. No `aria-labelledby`, no associated `<label>`, no `placeholder`, no text-content fallback — i.e. not an accessible-name computation, just three attributes. Emitted as `descriptor.name` (`describe-element.ts:43`). |
| Visible text | **Present** | `visibleText` (`describe-element.ts:98`, full subtree) and `directVisibleText` (`describe-element.ts:105`, own text nodes only); the choice between them is made at `describe-element.ts:31-33` by element kind. Capped at 500 chars. Written to both `descriptor.text` and `descriptor.visibleText` (`describe-element.ts:35-36`). |
| href | **Present** | `linkHref` (`describe-element.ts:123`), covering `HTMLAnchorElement.href`, the raw `href` attribute, and `xlink:href`. |
| Attributes | **Partial** | `describe-element.ts:59` copies a **fixed allowlist of 24** attribute names, each truncated to 500 chars: `id, class, name, type, autocomplete, data-sensitive, placeholder, title, alt, href, tabindex, aria-label, aria-disabled, aria-expanded, aria-controls, aria-pressed, aria-selected, data-testid, data-test, data-cy, disabled, onclick`. Not captured: `aria-labelledby`, `aria-describedby`, `for`, `value`, `role` (separate field), any other `data-*`, any framework attribute. |
| Nearby label | **Absent** | Verified by grep: no `labels`, no `aria-labelledby`, no `label[for]`, no sibling-text search anywhere in `apps/extension/src/content/`. The only `closest(` calls are exclusion filters (`dom-snapshot.ts:107-108`). |
| Parent/child | **Absent as evidence** | `DomElementDescriptor` (`types.ts:11-32`) has no parent, child, ancestor, or sibling field. The parent chain is walked twice — `xpathFor` (`element-finder.ts:44`) and the selector fallback (`describe-element.ts:76`) — but only to build a path string; nothing about the neighbours survives. |
| Structural context | **Partial** | Implicit only: the `xpath` string (`describe-element.ts:38`), the positional selector, and geometry — `bounds`, `documentBounds`, `isVisibleOnViewport` (`describe-element.ts:19-27`, `visual-bounds.ts`). No landmark, section, heading, table, or list context. |
| Form context | **Absent** | No form id/name/action, no fieldset/legend, no sibling-field set. The nearest thing is element-local: `inputType` (`describe-element.ts:47`), `attributes.name`, and `<select>` `options`/`selectedValue` (`describe-element.ts:49-56`). |
| Previously observed evidence | **Partial, and not usable for identity** | `observedEventElementQueue` (`event-elements.ts:15`) remembers up to 500 elements the user actually touched — but it is an in-page `WeakSet` + array, never serialized, never sent, and consumed only to rank the next snapshot (`dom-snapshot.ts:88-90`, bucket 0 at `dom-snapshot.ts:121`). It is gone on navigation. At page level, `WebReusableEvidenceFingerprint` (`domain/src/runtime/reusable-evidence.ts:20`) does persist a structural digest across runs, but it stores `selectorDigest: digest(selector)` (`reusable-evidence.ts:114`) — a hash — so it can tell you a page looks the same, never which element is which. |
| Historical identity | **Absent** | Nothing writes back what a target previously resolved to. `elementStateId` (`domain/src/recording/web-state.ts:422`) derives the state path from `data-testid`/`data-test`/`data-cy`/`id`, else `name.selector`, else the bare selector — so an element with no stable attribute **changes its state identity whenever its selector changes**, which is exactly the drift case. `confidence` is a two-valued constant, not a measurement: `0.98` when `stableElementId` is present, else `0.88` (`web-state.ts:173`). |

Two further gaps that the plan's list does not name but that Phase 1.3 will hit:

- **Browser frame identity never travels with an executable target.**
  `WebAutomationActionVisualTarget.frameId` (`domain/src/actions/types.ts:22`)
  is a `string` and is hard-coded to the *visual* frame id `"screen"`
  (`web-state.ts:59,167`). The real browser frame id is recorded only on
  recording events, as `sourceId: "tab:N:frame:M"`
  (`gateway-mapping.ts:61`), and `webAutomationActionFromGatewayCommand`
  (`gateway-mapping.ts:112-128`) maps neither `tabId` nor `frameId` onto the
  outgoing command. Consequence: `action.frameId` is always `undefined`, so
  `action-runner.ts:48,52` always sends `frameId 0` with
  `topFrameOnly: true`, and `message-handler.ts:36` makes every child frame
  drop the message. **Any target inside an iframe is unreachable through the
  Core → extension action path today**, despite the `iframe-checkout`
  scenario existing.
- **Shadow DOM is observable but not addressable.** Recording sees through
  shadow roots via `event.composedPath()` (`event-elements.ts:22,38`), so a
  shadow-DOM control *is* recorded — but `selectorFor` builds a
  document-rooted selector and every resolution call
  (`document.querySelector`, `document.evaluate`, `getElementById`) stops at
  the shadow boundary. Such a target records cleanly and can never replay.

## (b) How a target is resolved at execution time

The full chain, in execution order.

**Stage 1 — Core, pre-dispatch** (`packages/fluxiq/src/programs/automation-studio/runtime/io-policy.ts:118` `prepareElementTargetAction`).
Runs on every `policy.output.dispatch` effect. Normalizes `parameters.target`
(else the whole `parameters`) into an `AutomationStudioElementTarget`
(`model/action-element-target.ts:74`), then `resolveElementTarget`
(`io-policy.ts:146`):

- `target.candidates` empty → returns
  `{status: "unresolved_no_candidates"}` and passes through untouched
  (`io-policy.ts:147-149`). **This is the branch that always runs in
  production** — see (c).
- Otherwise `elementMatcher.bestCandidate(target.fingerprint, target.candidates)`
  (`io-policy.ts:150`), and the winner is stamped on as `selectedCandidate`
  with confidence and matched/failed signal lists (`io-policy.ts:153-171`).
- No match → hard failure `"Element target could not be matched to any
  runtime candidate."`; below the confidence floor → hard failure naming both
  percentages (`io-policy.ts:151-152`). The floor comes from
  `output.definition.metadata.elementTargetMinConfidence`, else the safety
  level, else `0.5` (`io-policy.ts:174-184`).

**Stage 2 — domain, target shaping** (`domain/src/output-nodes/targets.ts:5`
`outputTargetFromPayload`). Chooses one selector by this precedence
(`targets.ts:14-19`): `selectedCandidate.selector` → `target.fingerprint.selector`
→ `target.selector` → `payload.selector` → `element.selector` →
`visualTarget.selector`. If there is no selector **and** no visual target it
returns `undefined` and the command is dispatched with no `target` field at
all (`io/gateway-output-dispatcher.ts:14-21`).

**Stage 3 — wire mapping** (`domain/src/client/gateway-mapping.ts:112`).
`selector = target.selector ?? parameters.selector`;
`coordinates = target.coordinates ?? parameters.coordinates`;
`visualTarget = target.visualTarget ?? parameters.visualTarget`;
`options = parameters` (the entire payload verbatim — this is the only way
the element fingerprint reaches the page, as `options.element`).

**Stage 4 — the live-DOM resolver** (`apps/extension/src/content/action-runtime.ts:61`
`resolveTarget`). Four ordered strategies, each recording a miss string:

1. `action.selector` → `document.querySelector` (line 64).
2. `action.coordinates` → `document.elementFromPoint` (line 69).
3. Visual-target point → `document.elementFromPoint` (lines 73-78), where the
   point is `bounds` ?? `anchor.bounds` centre, else `documentBounds` centre
   minus current scroll (`pointFromVisualTarget`, lines 93-101).
4. `action.options.element` → `findClosestFingerprint`
   (`element-finder.ts:13`), itself an ordered cascade: `selector` →
   `xpath` (`FIRST_ORDERED_NODE_TYPE`) → `getElementById` →
   `[data-testid=…]` → `tag[aria-label=…], tag[name=…]` → `tag` + **all**
   `classNames` conjoined → exact normalized-whitespace text equality over
   `document.querySelectorAll(tag)`.
5. Only if **nothing was even attempted**, `document.activeElement`
   (lines 85-88).

**What counts as a match:** the mere existence of an element satisfying the
strategy. There is no visibility check, no enabled check, no tag/role
agreement check, and no bounds-agreement check. `describeElement` computes
`isVisibleOnViewport` (`describe-element.ts:22`) and `web-state.ts` computes
`isEnabled` (`web-state.ts:486`), but `resolveTarget` consults neither.

**Zero matches:** fall through to the next strategy; when all miss, one
`Error` whose message is `No target resolved from <comma-joined misses>.`
(line 89), or `"No selector, coordinates, or active element was available."`
when nothing was supplied (line 90). `actionFailure`
(`action-runtime.ts:46`) turns that into `status: "failed"` with the message
as a free-text string. No structured code, no per-strategy breakdown, no
candidate list, no near-miss diagnostics.

**Multiple matches:** never detected. `querySelector`, `getElementById`,
`evaluate(FIRST_ORDERED_NODE_TYPE)`, and the `.find(…)` at
`element-finder.ts:40` all silently take the first element in document order.
An ambiguous target is therefore indistinguishable from an unambiguous one at
every layer, and the ambiguity is resolved by DOM order rather than by
evidence.

**Fuzzy / evidence-weighted resolution against the live DOM: none.** The only
tolerance anywhere in the page-side path is whitespace normalization before an
**exact** text comparison (`element-finder.ts:39-40, 63`). Core's weighted
scorer exists and is good — `scoreElementFingerprintCandidate`
(`element-fingerprint.ts:135`) compares 19 weighted signals with text
Jaccard/substring similarity, path-token similarity, URL origin/path
similarity, class-name Jaccard, and bounds centre-distance plus area ratio,
and it penalizes missing signals negatively — but it scores candidates
extracted from a `StateSnapshot` (`candidatesFromStateSnapshot`,
`element-fingerprint.ts:184`), never from a live document.

Two ordering defects worth recording now:

- **The scroll-correct visual point is tried second, after the scroll-sensitive
  one.** `pointFromVisualTarget` prefers `visualTarget.bounds` (viewport
  coordinates, captured at record time) over `documentBounds` (which it
  correctly de-scrolls). `webAutomationActionVisualTargetFromElement`
  (`web-state.ts:170-171`) always emits **both**, so `bounds` always wins and
  the scroll correction is unreachable. Replay at a different scroll offset
  hits `elementFromPoint` with a stale viewport point.
- **Resolution happens before scroll-into-view.** `scrollElementIntoView` is
  called only after `resolveTarget` returns, and only for `click`
  (`actions.ts:57-58`). A below-the-fold target therefore fails strategies 2
  and 3 outright, since `elementFromPoint` returns `null` outside the
  viewport.

## (c) Which layer owns resolution, and where Levels 1/2/3 belong

**Today's ownership:**

| Layer | Owns | Key symbols |
| --- | --- | --- |
| Extension content script | *All* live-DOM resolution, and all evidence capture | `resolveTarget` (`content/action-runtime.ts:61`), `findClosestFingerprint` (`content/element-finder.ts:13`), `describeElement`/`selectorFor`/`accessibleName`/`stableElementId` (`content/describe-element.ts`), `xpathFor` (`content/element-finder.ts:44`), `captureSnapshot` (`content/dom-snapshot.ts:34`) |
| Domain | Target *shaping* and precedence, and the record-time element → state/visual-target mapping. No DOM access whatsoever. | `outputTargetFromPayload` (`domain/src/output-nodes/targets.ts:5`), `elementFingerprint` (`targets.ts:36`), `webAutomationOutputPayload` (`output-nodes/payloads.ts:8`), `webAutomationActionFromGatewayCommand` (`client/gateway-mapping.ts:112`), `webAutomationActionTargetFromElement` / `webAutomationActionVisualTargetFromElement` (`recording/web-state.ts:129,153`) |
| Core | The generic fingerprint contract, the weighted matcher, the pre-dispatch resolution hook, and an unused importer resolver seam | `AutomationStudioElementTarget` (`model/action-element-target.ts:43`), `createAutomationStudioElementMatcher` (`fingerprinting/element-fingerprint.ts:112`), `prepareElementTargetAction` (`runtime/io-policy.ts:118`), `AutomationStudioTargetResolverImplementation` (`nodes/importer-sdk.ts:79`) registered via `native-node-runtime.ts:49,90` |

**The seam is already built and is genuinely wired end to end.** Core's
`prepareElementTargetAction` stamps `selectedCandidate` onto `parameters.target`
before dispatch; the web domain's `selectedTargetCandidate`
(`targets.ts:28-34`) reads exactly that field back out and uses the winning
candidate's selector. `domain/src/tests/domain.test.ts:242-253` proves that
handshake works. **The only missing ingredient is the `candidates` array
itself** — nothing in either repository produces one for a web action, which
is why `io-policy.ts:147` always short-circuits to
`unresolved_no_candidates`.

Two secondary reasons Core's enforcement is inert for web outputs:

- `outputRequiresElementTarget` needs `metadata.elementTarget === true` or
  `metadata.targetKind === "element"` (`io-policy.ts:128`). The web output
  node metadata is only `{domainId, outputId, parameterSchema}`
  (`domain/src/output-nodes/definitions.ts:60-64`), so Core never *requires* a
  fingerprint for a web action.
- The confidence floor reads `safety.level` (`io-policy.ts:177`), but the web
  definitions set `safety` as `{privileged, requiresOperatorApproval,
  requiredPermissions}` with no `level`
  (`definitions.ts:45-49`), so every web action would default to `0.5`.

**Where the three levels should live:**

- **Level 1 (exact).** Content script, extending `resolveTarget` and
  `findClosestFingerprint` in `apps/extension/src/content/`. This cannot move:
  it is the only layer with a live DOM. What it needs beyond today is
  candidate *counting* rather than first-match (so ambiguity becomes visible),
  plus visibility/enabled/tag agreement gates.
- **Level 2 (evidence-based).** Split by necessity. DOM candidates only exist
  in the page, so **enumeration must be in the content script**; the scoring
  function should be Core's, not a third implementation. Two viable shapes:
  - *(i) Score in Core.* The content script enumerates and returns
    `ElementFingerprintCandidate[]`; Core scores in
    `prepareElementTargetAction` and returns `selectedCandidate`. Fits the
    existing contract exactly and needs no new types — but costs one extra
    round trip per action, and the candidate list must survive the gateway
    payload budget.
  - *(ii) Score in the page.* Import `createAutomationStudioElementMatcher`
    into the content bundle and score against the live DOM in one pass. No
    round trip, and it can use live signals (computed visibility, enabled
    state) that a serialized snapshot loses. `element-fingerprint.ts` imports
    only types and uses no Node built-ins, and the content script is already
    an esbuild `platform: "browser"` bundle
    (`apps/extension/scripts/build-extension.mjs:41,50`), so this looks
    feasible — *not verified*, see below.
  - What is **not** viable is putting Level 2 in `domain/src`: it has no DOM
    and only ever sees the last transmitted snapshot.
- **Level 3 (harness).** Already partly exists, in this repository:
  `validateWebRuntimeTargetOverrideEvidence`
  (`domain/src/runtime/llm-evidence.ts:63`) takes an LLM-proposed selector plus
  the failed action and validates it against the bounded sanitized evidence
  packet the model was given, returning `matched` / `resolved` (a different
  selector is the only action-compatible one) / `ambiguous` / `absent`
  (lines 68-77), exposed on the runtime via
  `validateTargetOverrideEvidence` (`llm-evidence.ts:134,244`). This is the
  right home and the right shape; it needs Levels 1 and 2 beneath it to emit
  the structured failure that triggers it.

## (d) Existing tests that exercise resolution

**Extension: none.** `find apps/extension -name "*.test.*"` returns 0 files
and there is no `tests/` directory anywhere under `apps/extension`.
`resolveTarget`, `findClosestFingerprint`, `pointFromVisualTarget`,
`selectorFor`, `xpathFor`, `accessibleName`, and `describeElement` have no
unit coverage of any kind. This is the single largest test gap for Phase 1.3.

**Extension e2e — one path only.** `apps/extension/e2e/action.spec.ts:26-39`
drives `web.dom.type` and `web.dom.click` through the real content-script
message path against a live scenario page. It supplies an explicit
`selector` every time, so it covers strategy 1 and nothing else: no
coordinates, no visual target, no fingerprint fallback, no zero-match failure
message, no ambiguity. It also hard-codes `topFrameOnly: true`
(`action.spec.ts:49`), so it cannot catch the iframe gap in (a).

**Domain — payload shaping, not resolution.**

- `domain/src/tests/domain.test.ts:229-253` covers `webAutomationOutputPayload`
  and `outputTargetFromPayload`: the fingerprint survives payload
  normalization (233-235), an adapted `target.selector` beats a stale
  top-level one (237), `target.fingerprint.selector` beats it too (238-241),
  and `selectedCandidate` correctly picks `button.save-current` out of a
  candidate list (242-253). That last assertion is the proof that Core's
  Level-2 handshake is honoured on this side.
- `domain/src/tests/domain.test.ts:71-79` covers `filterStateElements`
  ranking and `webAutomationActionVisualTargetFromElement` statePath /
  documentLayerId; lines 113-117 cover two same-`name` radios collapsing to
  two distinct state ids.
- None of these touch a DOM or a resolver.

**Domain — the only ambiguity-aware test in the repository.**
`domain/src/runtime/tests/llm-evidence.test.ts:60-71` exercises
`validateWebRuntimeTargetOverrideEvidence` across all four outcomes:
`matched` (60, 65, 66), `resolved` to a different selector (61-63),
`ambiguous` from a duplicate selector (64) and from multiple compatible
targets (71), and `absent` when nothing is action-compatible (69). Lines
177-178 repeat it through the bound runtime. Note this validates against the
**sanitized evidence packet**, never against a page.

**Core.**

- `packages/fluxiq/src/programs/automation-studio/fingerprinting/tests/element-fingerprint.test.ts`
  — 3 tests, 76 lines: strong identity beats structural path alone; candidate
  extraction from visual layers and state values; contribution details for
  matched and missing signals.
- `packages/fluxiq/src/programs/automation-studio/runtime/tests/io-bridge.test.ts:105-124`
  — the one end-to-end Level-2 test: a target with `fingerprint {visibleText:
  "Save", testId: "save"}` and two candidates resolves to `save` with
  `elementTargetResolution: {status: "matched", candidateId: "save"}`.
  Line 126 adds rejection when a declared element output has no fingerprint.
- Nothing tests the `unresolved_no_candidates` branch that production
  actually takes.

## (e) The Scenario Lab drift cases

**`ambiguous-targets`** (`apps/scenario-lab/src/scenarios/ambiguous-targets/scenario.ts`).
Renders two `<section aria-label="Primary|Secondary">` regions each containing
a `<button>Continue</button>`, plus two `<label>Email <input></label>` pairs —
so visible text, accessible name, and label text are each duplicated, and only
`data-testid` (`choice-primary`/`choice-secondary`,
`email-primary`/`email-secondary`) disambiguates (line 26). The manifest
asserts `label-count:Email == 2` (line 17) and a single successful
`web.dom.click` (lines 18-19). Its e2e test
(`apps/scenario-lab/e2e/scenario-pages.spec.ts:52-54`) clicks via
`getByRole("region", {name: "Secondary"}).getByRole("button", {name:
"Continue"})`.

*What it proves:* that the fixture itself is deterministic and that a
**Playwright** role-scoped locator can disambiguate it. *What it does not
prove:* anything about FluxIQ. No extension, no recorder, and no
`resolveTarget` touch this scenario. It is a fixture waiting for a consumer.
It is also precisely the case FluxIQ silently gets wrong today: a recorded
`Continue` button whose `data-testid` is dropped resolves by
`document.querySelector` to the *first* `Continue` in document order with no
ambiguity signal, and the nearest scoping evidence — the parent section's
`aria-label` — is never captured at all (see "nearby label", "parent/child"
in (a)).

**`llm-target-drift`** (`apps/scenario-lab/src/scenarios/llm-target-drift/scenario.ts`).
A three-mode fixture: `baseline` renders `data-testid="diagnosis-target"`;
`missing` renders nothing; `renamed` renders
`data-testid="diagnosis-target-v2" aria-label="Replacement control"` with
different visible text (lines 64-68). Mode is operator-switchable and
restorable (lines 55-60), and the state carries an explicit oracle —
`recordedTargetTestId`, `renderedTargetTestId`, `targetPresent`,
`expectedResult` (lines 112-117). The manifest records only the stable
baseline action (lines 32-35), declares a `playbackGoal` (lines 36-40), and
sets `evidencePolicy: {trace: "always", reviewRequired: true}` (line 48).

*What it proves:* two node tests
(`scenarios/llm-target-drift/tests/scenario.test.ts`) confirm the state
machine is seeded, switchable, restorable, and — importantly — **repeatably
inert while missing** (lines 18-19: activating twice in `missing` mode is a
no-op returning identical state), and that the manifest records only the
baseline action. The e2e test
(`apps/scenario-lab/e2e/scenario-pages.spec.ts:70-99`) additionally proves
determinism across a reload in `missing` mode (lines 81-86, `expect(second)
.toEqual(first)`) and that the renamed control is genuinely present under a
new test id (line 91). It is wired into the LLM demo workspace as
`flow.web-extension-llm-target-drift`
(`packages/test-runner/src/demo-workspace/diagnosis-ui.ts:17,21`).

*What it does not prove:* again, nothing about FluxIQ's resolver. Both drift
modes are currently indistinguishable to `resolveTarget` — `missing` and
`renamed` both produce the same `No target resolved from selector
[data-testid="diagnosis-target"].` string, even though `renamed` has an
obvious evidence-based answer (same role, same position, `aria-label` present,
one action-compatible control on the page). `renamed` is the ideal Level 2
acceptance case and `missing` the ideal Level 3 escalation case; neither is
exercised against the extension today.

**Coverage gap across both:** neither fixture produces *two* plausible
candidates after drift, which is the case that separates a correct Level 2
from a lucky one. `ambiguous-targets` has two candidates but no drift;
`llm-target-drift` has drift but at most one candidate. Phase 1.3 wants a
third fixture, or a fourth mode on `llm-target-drift`, that renames the target
**and** leaves a decoy.

## What Level 2 needs that does not exist

In rough dependency order.

1. **A live-DOM candidate enumerator.** Nothing anywhere produces
   `ElementFingerprintCandidate[]` from a page.
   `candidatesFromStateSnapshot` (`element-fingerprint.ts:184`) is called only
   by its own test. Until candidates exist, `io-policy.ts:147` short-circuits
   to `unresolved_no_candidates` on every single web action and Core's matcher
   never runs. This is the one blocking item.
2. **A field-name bridge from `DomElementDescriptor` to Core's fingerprint.**
   Core's `normalizeFingerprint`
   (`model/action-element-target.ts:118-143`) reads `testId` from
   `value.testId`/`value.dataTestId`/`metadata.testId`/`metadata.dataTestId` —
   it never looks in `attributes["data-testid"]`, which is the only place this
   repository puts it (`describe-element.ts:59`). Likewise it reads
   `accessibleName`, while the extension emits the same value as `name`
   (`describe-element.ts:43`), and it reads `label`, which the extension never
   emits at all. Result: `testId` (weight 28), `accessibleName` (24), and
   `label` (20) — the three highest-weighted signals after `id` — are all
   **silently zero** for web-automation targets. Fixing the field names is
   cheap and is probably the highest-value single change in Phase 1.3.
3. **Ambiguity as a first-class result.** Every resolution site takes the
   first match (`action-runtime.ts:64,69,75`; `element-finder.ts:14-40`).
   Level 2 needs a match *count* and the losing candidates' scores, or it
   cannot tell a confident single match from a coin flip.
4. **The missing evidence from (a).** Weighted scoring is only as good as the
   signals: `label` (absent), implicit `role` (absent), form context
   (absent), parent/child and landmark context (absent), `aria-labelledby`
   and `for` (not in the attribute allowlist). Core already weights
   `label` at 20 and `role` at 10 and applies a **negative** contribution when
   a signal the fingerprint declares is missing on the candidate
   (`element-fingerprint.ts:269,276,282`) — so capturing these asymmetrically
   would actively mis-score. They must be added on both the fingerprint and
   the candidate side together.
5. **A real confidence value.** `web-state.ts:173` emits a constant `0.98`
   or `0.88`. Core's floor logic (`io-policy.ts:174-184`) compares against it
   as if it were measured, so today a total guess and a certain match are
   indistinguishable to the gate.
6. **Structured failure output.** `resolveTarget` throws one string
   (`action-runtime.ts:89`) and `actionFailure` (`action-runtime.ts:46`)
   flattens it into `message`. Level 3 needs to know *which* strategies were
   tried, how many candidates each found, and the best score achieved — this
   overlaps Phase 1.5 (failure taxonomy) and the two phases should agree on
   one result shape.
7. **Frame-scoped resolution.** Per (a), no browser `frameId` reaches an
   action, so Level 2 can only ever enumerate candidates from the top frame.
   `WebAutomationActionVisualTarget.frameId` is occupied by the visual frame
   id `"screen"`, so the contract needs a distinct field rather than a
   reinterpretation of that one.
8. **Output metadata so Core actually enforces.** Web output node definitions
   need `metadata.elementTarget: true` (or `targetKind: "element"`) and a
   `safety.level`, or `outputRequiresElementTarget` stays `false`
   (`io-policy.ts:128`) and the confidence floor stays at the `0.5` default
   (`io-policy.ts:182`) — see `definitions.ts:45-64`.
9. **Tests.** A content-script unit suite is prerequisite to changing
   `resolveTarget` safely — there are currently zero. A DOM-capable runner
   must be chosen for `apps/extension`; the package's `test` script today is
   `node scripts/smoke-test.mjs`.

## Not verified

- I did not run any test, build, type-check, or browser. Every behavioural
  claim is read from source, not observed executing. In particular the
  iframe/`frameId` finding and the `bounds`-before-`documentBounds` ordering
  defect are read from code and have **not** been reproduced.
- I did not read the 30-day MVP plan or `MVP_AGENT_INSTRUCTIONS.md` (the brief
  does not list them). My reading of "Level 1 exact / Level 2 evidence-based /
  Level 3 harness" comes solely from the parenthetical in the brief itself; if
  the plan defines those levels differently, section (c) should be re-checked
  against it.
- Whether Core's `fluxiq/automation-studio` subpath export is safely bundleable
  into a content script is **unverified**. I confirmed only that
  `element-fingerprint.ts` imports types alone and uses no Node built-ins, and
  that the content bundle is esbuild `platform: "browser"`. The barrel it sits
  behind may pull in Node-only siblings; that needs an actual build to settle.
- I did not audit the side panel or popup for a manual target picker beyond
  confirming `popup/index.ts` is the only other file with DOM query calls and
  that those address its own UI.
- I did not check Firefox-specific differences in frame messaging.
- Core reading was deliberately narrow per the brief: the two named documents'
  state sections plus grep-located contract types. I did not survey Core's
  recording-proposal or adaptation paths, which may populate `candidates` in
  ways my greps for `candidatesFromStateSnapshot` would miss if they build
  candidates by hand.

## Open questions or contradictions found

1. **The brief's required read does not exist.** Core's
   `docs/working/action-visual-entity-target-plan.md` has **no**
   `## Current State` section — its headings are `Progress Log`, `Purpose`,
   `Non-goals and invariants`, `Current model shape`, `Proposed contract`,
   `Resolution rules`, … (`Status: Complete`, phases 1-6 done 2026-08-18). I
   read its header and `Progress Log` instead, as the nearest state-of-record,
   and got the contract type names from there. I did not read the remaining
   sections. Flagging because the brief's instruction was unsatisfiable as
   written.
2. **`elementFingerprintSchema` promises fields the resolver ignores.**
   `domain/src/actions/schemas.ts:11-21` advertises `role` and `href` on the
   element fingerprint, and `domain/src/output-nodes/targets.ts:36-53`
   faithfully carries `role`, `href`, `text`, `value`, and `inputType`
   through. But `ElementFingerprint` in
   `apps/extension/src/content/element-finder.ts:1-10` declares none of them
   and `findClosestFingerprint` never reads them. Five signals are captured,
   validated, transported, and then dropped on the floor at the point of use.
3. **The fingerprint can be lost in transit when Core adapts the target.**
   `outputTargetFromPayload` sources `element` from
   `target.element ?? selectedCandidate ?? target.fingerprint ?? payload.element`
   (`targets.ts:10-13`) and returns it inside the `target` object. But
   `webAutomationActionFromGatewayCommand` (`gateway-mapping.ts:116-128`)
   reads `target.selector`, `target.coordinates`, and `target.visualTarget` —
   never `target.element` — and relies on `options: parameters` to smuggle
   the fingerprint through as `parameters.element`. So when the fingerprint
   comes from an **adapted** target (`target.element` or `target.fingerprint`)
   rather than from `payload.element`, `action.options.element` is
   `undefined` and resolution strategy 4 is skipped entirely. That is exactly
   the drift-recovery case where the fingerprint matters most.
4. **Should Level 2 scoring run in the page or in Core?** Section (c) lays out
   both. The trade is one extra gateway round trip per action (and a candidate
   payload budget) versus bundling a Core module into the content script and
   accepting a second copy of the matcher's version surface. This is an
   architecture decision the supervisor should make before Phase 1.3 work is
   partitioned, because it determines which repository owns the code and
   therefore how the briefs split.
5. **Does `web.dom.wait_for_selector` intentionally bypass all of this?**
   `actions.ts:43-46` calls `deps.waitForElement(action.selector, …)`, which
   is raw `document.querySelector` polling (`action-runtime.ts:147-165`) — it
   never calls `resolveTarget`, so it gets no coordinates, no visual target,
   and no fingerprint fallback. If Phase 1.3 strengthens identity, a "wait"
   that cannot use the strengthened identity will diverge from the "click"
   that follows it.
6. **`filterStateElements` and `snapshotElements` implement the same ranking
   twice.** `domain/src/recording/web-state.ts:490-534` and
   `apps/extension/src/content/dom-snapshot.ts:120-169` carry near-identical
   bucket and score functions (200/100/60/45/35/25 plus a bounds term) over
   different input types. If Level 2 candidate selection reuses this ranking,
   the duplication becomes a correctness risk rather than just a maintenance
   one.
