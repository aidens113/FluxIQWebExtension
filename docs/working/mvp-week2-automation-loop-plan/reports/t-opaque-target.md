# Phase T, decision L2 — an opaque, domain-owned repair target

## Outcome

Done, with two things handed back rather than done: the evidence packet still
describes each element's `selector` to the model (the files that would have to
change are owned by other workers), and the execution path that reads the
resolved target back out of `parameterValues` was not exercised.

## What changed and why

### The contract, in one line

Core's repair target was `{ selector: string }`. It is now
`JsonObject & { handles: Record<string, string> }`: a map from a repairable
parameter the *domain* declared to an opaque handle the *domain* minted, plus
whatever else the domain wrote into its own resolution. Core bounds both sides
of the handle map, checks the whole thing is small JSON, and reads nothing
else. `AutomationStudioRuntimeTargetOverrideFailedAction` in `live-patch.ts`
was already domain-neutral; this is its sibling brought to the same standard.

### Core (`packages/fluxiq/src/programs/automation-studio/runtime/llm/**`)

`harness/structured-response.ts`

- `AutomationStudioRuntimeTargetOverrideTarget` is now the opaque type above.
- Two guards instead of one, and the split is the security property:
  - `isAutomationStudioRuntimeTargetOverrideTarget` — what Core will *carry*.
    Handles must be handles; the value must be JSON; the serialized form must
    be at most `AUTOMATION_STUDIO_RUNTIME_TARGET_MAX_SERIALIZED_LENGTH`
    (4,000). Everything else is the domain's and is not inspected.
  - `isAutomationStudioModelAuthoredTargetOverrideTarget` — what the *model*
    may author. Exactly one key, `handles`, and nothing else. A domain
    resolution is not something a model may write, so the one route by which a
    locator could reach an executed action is closed here.
- New exported bounds, so the guard and the JSON schema cannot drift:
  `AUTOMATION_STUDIO_RUNTIME_TARGET_HANDLE_PATTERN`
  (`^[A-Za-z0-9](?:[A-Za-z0-9_.:-]*[A-Za-z0-9])?$`),
  `..._HANDLE_MAX_LENGTH` (64), `..._MAX_HANDLES` (16),
  `..._MAX_SERIALIZED_LENGTH` (4,000). The pattern is deliberately narrower
  than "a bounded string": no whitespace, brackets, quotes, combinators,
  slashes or parentheses, and it may not start or end on punctuation.

`deepseek-provider.ts`

- The runtime-patch system prompt no longer says "copy selector exactly from
  failureEvidence". It says to fill `target.handles` by copying handles as the
  evidence names them, and to "never write a locator, path, query, or
  expression of your own".
- The reusable-context instruction dropped its web noun: "an executable
  selector, target, patch…" is now "an executable handle, target, patch…".
- `TARGET_OVERRIDE_PATCH_SCHEMA`'s `target` is now
  `{ required: ["handles"], additionalProperties: false }` with
  `propertyNames` and `additionalProperties` both bound to the handle pattern
  and length. The model is offered no field to write a locator into.
- Output parsing uses the strict model-authored guard.
- **`grep -n selector deepseek-provider.ts` now returns nothing.**

`harness/provider-result.ts` uses the strict guard too, and its diagnostic
message changed from "canonical target" to "a target naming only opaque
evidence handles". `harness/index.ts` exports the four new constants and the
new guard.

### Web domain (`domain/src/runtime/llm-evidence/**`)

New `repairable-parameters.ts` — the domain's half of the handle map, and the
reason an `extract_list` repair needs no new contract:

| Definition id | Parameters | Role |
| --- | --- | --- |
| `web.output.dom-type`, `-clear` | `element` | `fillable` |
| `web.output.dom-select` | `element` | `selectable` |
| `web.output.dom-click` | `element` | `clickable` |
| `web.output.dom-keypress` | `element` | `keyable` |
| `web.output.dom-wait_for_selector`, `-extract` | `element` | `observable` |
| `web.output.dom-extract_list` | `item` (required), `field.<key>` | `list_item`, `observable` |

Anything else declares no repairable parameters at all, which is a refusal
rather than an oversight: an action the domain has not declared repairable
does not get its targets rewritten by a model. Every declared name is asserted
to be a name Core will carry as a handle key.

`target-override.ts` now takes the opaque target and returns the domain's own
resolution:

- A parameter the action never declared, or a required one left out, refuses
  the whole repair (`absent`).
- A handle resolves only by exact match against `evidence.elements[].target` —
  the `target.N` names this domain minted. Not found, or found but naming a
  control the failed verb cannot use, falls back to the single compatible
  element, and refuses when there are none (`absent`) or several
  (`ambiguous`).
- The resolution is **fingerprint-first**: `tagName`, `role`,
  `accessibleName`, `visibleText`, then `selector`. That is not a slogan —
  Core's own `DEFAULT_ELEMENT_FINGERPRINT_WEIGHTS` scores `selector` at 14
  against 28 for a test id, 26 for an id and 24 for an accessible name, so the
  selector really is one signal among many. The child frame rides in
  `metadata.browserFrameId`, because a selector is only valid inside its frame.
- A one-`element` repair writes the fingerprint **flat**, which is the shape
  every other element target in this system already has, so Core's existing
  `normalizeAutomationStudioElementTarget` reads it with no new branch. A
  repair with more than one parameter writes `targets`, keyed by the same
  names the handles were.
- `handleResolution` is `"named"` or `"inferred"`, and `proposedHandles` keeps
  what the model asked for when the domain did not use it.

**`matched` is never returned any more, and that is deliberate.** Core writes
the target it is handed straight into `node.parameterValues.target`
(`live-patch.ts:383`), so a target left as the model wrote it would reach
execution as a bare handle map addressing nothing. Every accepted repair comes
back as `resolved`; the "the model got it right first time" signal moved into
`handleResolution` rather than being thrown away. Consequence to be aware of:
`targetResolution: "matched"` will no longer appear in web runs' patch
metadata.

`tools.ts` and the barrel were updated for the new signature and exports.

### Structure audit

The coordinator's `contract-spread` finding was real and is fixed. The
resolution and the fingerprint are now named types built through
`present<T>()` with every field written by name, so a renamed or deleted field
is a compile error rather than a packet that quietly carries less. No path was
added to the audit config and no baseline was updated.

## Commands run and observed results

Core, `F:\!FluxIQ\packages\fluxiq`:

```
npx tsc --noEmit                                          -> CORE_TSC_EXIT=0 (no output)
npx vitest run src/.../runtime/llm/tests                  -> Test Files 7 passed (7)
                                                             Tests 97 passed (97)
npx vitest run src/.../runtime/tests/live-patch.test.ts   -> Test Files 1 passed (1)
                                                             Tests 23 passed (23)
npx tsc -b tsconfig.build.json                            -> BUILD_EXIT=0
node ../../scripts/rewrite-declaration-imports.mjs dist   -> REWRITE_EXIT=0
```

`F:\!FluxIQ`, `node scripts/structure-audit.mjs`:

```
structure-audit: passed (136 warning(s), 256 baselined).
AUDIT_EXIT=0
```

Web extension, `F:\!FluxIQWebExtension\domain`:

```
DOMAIN_TEST_BUILD_LABEL=t-opaque-target node scripts/test-domain.mjs
  -> 1..481  # tests 481  # pass 481  # fail 0  # duration_ms 6637.3792
npx tsc -p tsconfig.json --noEmit    -> SRC_EXIT=0
npx tsc -p tsconfig.test.json        -> TEST_EXIT=0
```

`F:\!FluxIQWebExtension`, `node scripts/structure-audit.mjs`:

```
FAIL  [working-docs] docs/working/README.md is out of date with the documents'
      header blocks. Run "pnpm structure:baseline" to regenerate it.
structure-audit: 1 violation(s) across 1 rule(s).
AUDIT_EXIT=1
```

The `contract-spread` failure the coordinator quoted is gone. The one
remaining violation is the working-document index, which this brief forbids me
to touch — it needs `pnpm structure:baseline` from the supervisor.

### The test the brief asked for

`packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/opaque-target-override.test.ts`,
four cases, all passing:

1. **Nothing browser-shaped reaches the prompt or the schema.** The
   runtime-patch system prompt is asserted not to match `/selector/i`,
   `/css/i`, `/xpath/i`, `/\bdom\b/i`, `/element/i`, `/\bpage\b/i`,
   `/\bclick/i`, `/browser/i` or `/\bhtml\b/i`. The serialized `outputSchema`
   is asserted not to contain `selector`, `xpath`, `css`, `locator` or
   `queryPath`, and `Object.keys(targetSchema.properties)` is asserted to be
   exactly `["handles"]`.
2. **A locator is refused wherever a model could put one** — 17 real CSS and
   XPath locators (`#submit-new`, `input[name="q"]`, `div > .item`,
   `//button[@id='go']`, `a:has(> span)`, `frame[3] >> #card-name`, leading
   and trailing space, …), each tried as a handle value, as a parameter name,
   as the whole target, and alongside valid handles.
3. A handle map and nothing else is accepted from the model.
4. A domain resolution is carried but fails the model-authored guard; an
   oversized one and a cyclic one are both refused.

The domain side proves the complementary claim in
`domain/src/runtime/llm-evidence/tests/target-override.test.ts`: a string that
*is* a valid CSS selector, and that exactly matches an element's selector in
the packet (`p.decoy`, `span`), does not address that element. It is simply a
handle nobody minted, so the repair falls back to the one compatible element
and records `handleResolution: "inferred"`. That whitelist is the real
guarantee; the regex only stops a locator being carried at all.

## Files I was told not to touch

**Both already carry the change.** Another worker applied them before I
reached them, and I verified rather than edited:

- `runtime/live-patch.ts:75-78` — `validateTargetOverrideEvidence?: (target:
  AutomationStudioRuntimeTargetOverrideTarget, failedAction: …)`. Was
  `target: { selector: string }`.
- `runtime/service.ts:357` and `:3106` — same substitution in
  `AutomationStudioServiceOptions.llmEvidenceRuntime.validateTargetOverrideEvidence`
  and in the closure that forwards it.

No diff is outstanding. Two notes on those files for whoever owns them:

- `live-patch.ts:147` (`if (validation.status === "matched")`) is now dead for
  the web domain. It is still correct for a domain that can validate without
  resolving, so I would leave it, but nothing will set it here.
- `live-patch.ts:353` still reads `"Target node and selector resolved against
  this Flow without execution."` — a web noun in a Core structural-check
  detail string. One-word fix: `selector` → `target`.

## Not verified

- **The execution path.** `live-patch.ts:383` writes the resolved target into
  `node.parameterValues.target`, and the flat fingerprint shape was chosen so
  Core's `normalizeAutomationStudioElementTarget`
  (`model/action-element-target.ts:130-155`) reads it unchanged. I did not run
  anything that exercises that read, and no test in either repository covers
  it. This is the one place the change could still be wrong end to end.
- **No live browser validation.** Nothing here was exercised against a real
  page or a real provider.
- **`extract_list` field keys.** `AutomationStudioRuntimeTargetOverrideFailedAction`
  carries only `{ nodeId, definitionId }`, so the domain cannot enumerate the
  failed node's declared field keys. `field.<key>` is therefore *accepted*
  rather than *checked against the node*. A field repair works; it becomes
  exact once the failed node's parameters reach the validator.

## Open questions and contradictions found

### The evidence packet still tells the model every selector

"No selector reaches the model's prompt" is true of Core's own prompt text and
response schema, and I proved it. It is **not** true of the failure evidence
Core embeds in the user message: `WebLlmEvidenceElement.selector`
(`domain/src/runtime/llm-evidence/elements.ts:36`) is still a field of the
packet, so every element is described to the model with its selector beside
its opaque handle.

I did not remove it, because doing so is outside this brief's ownership and
would break things silently:

- `domain/src/runtime/reusable-evidence.ts:111` reads `element.selector` and
  `continue`s when it is absent — dropping the field would make reusable
  evidence produce *nothing at all*, with no error.
- `domain/src/tests/page-evidence-joinery.test.ts` asserts on selectors in the
  packet in several places.
- `domain/src/runtime/adapter.ts:386-389` is what produces the failure-evidence
  packet, so any "model-visible projection" has to be applied there.
- Inside the directory I do own, `page-evidence.ts` also carries
  `dialogs[].selector` and `blockedBy.selector`.

Shape of the fix, for whoever picks it up: keep `selector` on the internal
packet type, add a model-visible projection in `llm-evidence` that drops it
(the `selectors` map in `WebLlmSnapshotBinding` already holds the binding), and
call it from `adapter.ts` and from `tools.ts`'s tool results. Two to four
files, all outside this brief.

### Core's sanitizers carry web nouns (reported, not fixed, as instructed)

1. `runtime/llm/harness/failure-evidence.ts:28` — the denylist
   `["html", "innerhtml", "outerhtml", "pagesource", "snapshot", "cookies",
   "headers"]`, applied to every key of the failure evidence a domain submits.
   Five of the seven are browser concepts and two (`snapshot`, `pagesource`)
   are near-generic.
2. `runtime/llm/harness/context-packet.ts:134` — `containsReusableExecutableTarget`
   rejects reusable context whose keys normalize to
   `selector|selectors|target|targets|targetid|…|actiontarget|actiontargets`.
   `selector` is the only web noun; the rest are already neutral.

De-webbing them means replacing "keys Core happens to know are dangerous" with
"keys the domain declared are dangerous". Concretely: add a domain-supplied
denylist to the evidence-runtime binding
(`AutomationStudioServiceOptions.llmEvidenceRuntime`), have Core keep only the
structural bounds it can justify without naming a medium — depth, entry count,
string length, byte budget, and the `target`-family key family, which is
Core's own vocabulary — and move `html`, `innerhtml`, `outerhtml`,
`pagesource`, `cookies`, `headers` and `selector` into the web domain's
declaration. Cost: one new optional field on the service options, one pass
through `boundedFailureEvidenceValue` and `containsReusableExecutableTarget` to
take it, a default that preserves today's behaviour for a domain that declares
nothing, and the web domain declaring the seven. It touches `service.ts` and
two harness files, so it wants its own brief.

### Smaller

- `deepseek-provider.ts` is at 659 lines and 10 exported values, both past the
  advisory thresholds. I added to it rather than splitting it; the schema block
  is a plausible extraction if someone wants the warning gone.
- The Core structure audit reports "1 baseline entries can be lowered", which
  is an improvement someone can record with `pnpm structure:baseline`. I did
  not run it, since baselines are not mine to move.

---

# Follow-up: the leak closed, and the execution read-back covered

The first pass made the type opaque and left the packet still describing every
element's selector to the model. That state was worse than it looked: every
gate was green and the browser concept was still reaching the model, one layer
down. Both follow-ups are done.

## 1. No selector reaches the model

### What the packet carries now

`WebLlmEvidenceElement.selector` is gone. So is `WebLlmEvidenceDialog.selector`
and `WebLlmPageContext.blockedBy.selector`. An element is named by its opaque
`target.N` handle and nothing else; the selector lives in
`WebLlmSnapshotBinding.selectors`, keyed by that handle, and never leaves the
domain.

`sanitizedEvidenceElement` now returns `{ element, selector }` rather than one
joined object. That shape is deliberate: only one of the two may be published,
and returning them joined and deleting a key afterwards is exactly the silent
drop this directory is built against.

The packet version is `web-llm-evidence.v2`. That is not cosmetic. A stored
`.v1` packet both leaks and has a shape no current reader expects, and the
version is what keeps one out of the repair path and the reusable-evidence
cache. `WEB_REUSABLE_EVIDENCE_SANITIZER_VERSION` went to `.v2` for the same
reason: its structural digest is now computed over a different set of facts.

### The selector hint is kept, on the domain's side of the line

Decision L2 wants the repair fingerprint-first *with* the selector as a hint,
and the hint had to survive the packet losing it. The evidence runtime now
retains the binding for the last eight packets it issued, keyed by the packet's
own location and handle list, because Core hands the packet back to
`validateTargetOverrideEvidence` without the project or flow it came from. A
repair on a packet this runtime issued carries the selector; a repair on a
packet it did not, one reloaded from a stored run say, resolves
fingerprint-only, which is weaker rather than wrong, and is tested as such.

### Three consumers had to move, and one was carrying a real bug

- `reusable-evidence.ts` keyed its element dedup on a digest of the selector
  while the prompt fact dropped it, so two controls that read identically but
  sat at different selectors produced two identical prompt facts. Removing the
  selector removed the duplication as well as the leak: the fact and the dedup
  key are now the same object.
- `host-runtime.ts`'s state diff identified elements by selector. Handles are
  positional, `target.1` is the first element of whichever capture it came
  from, so a diff over handles would have reported that nothing ever changes.
  It now identifies an element by what it is and what it is called (`tag`,
  `role`, `name`, `text`, `form`), and reports `addedElements` /
  `removedElements` instead of `addedSelectors` / `removedSelectors`.
  `WEB_STATE_DIFF_SCHEMA_VERSION` went to `web-state-diff.v2`. Nothing outside
  that file and its test read those fields.
- The blocking overlay used to be reported only when it had a selector. It is
  now reported when it says anything at all: what it is, what it is called, or
  how much of the page it covers.

`adapter.ts` needed no change: it produces the packet through
`sanitizeWebLlmSnapshot`, so it is fixed by the producer. Its failure *report*
still carries `report.selector` into the attempt's trace metadata, which is
operator-facing and is not part of the LLM context (Core's
`compactRecentActionForLlm` allowlists `attemptId`, `nodeId`, `definitionId`,
`order`, `status`, `route`). The serialized-payload test below is what holds
that claim, rather than my reading of it.

`domain/src/page-evidence/**` was not touched. It is the wire contract the
extension produces, where a selector belongs; it is only the packet built from
it that may not carry one.

### The tests a stranger will find

Two halves, in the two places the two claims live.

**Producer** - `domain/src/runtime/llm-evidence/tests/packet-carries-no-selector.test.ts`.
A realistic checkout capture with a selector in every place the wire contract
allows one: elements, the focused element, a child frame, two dialogs, two
overlay blockers, a loading indicator, a busy region, and a sensitive card
field. Then, against the **serialized packet**:

- none of the twelve selectors the page contained appears;
- no key named `selector`, `selectors`, `xpath`, `queryPath`, `css`, `locator`,
  `cssSelector` or `path`;
- and the guarantee that outlives the file - *every key the packet carries, at
  any depth, is one written down in the test*. A field added later fails this
  line whatever it is called and however deeply it is nested. That replaced a
  regex scan for locator-shaped strings, which I wrote first and removed: it
  matched `web-llm-evidence.v2` and would have gone on catching innocent text.

It also asserts the packet is worth reading - six elements, both dialogs, the
overlay - so it cannot pass by describing nothing, and that the binding still
holds every selector, including the child-frame one, and holds nothing for the
sensitive control.

**Transport** - `packages/fluxiq/.../runtime/llm/tests/opaque-target-override.test.ts`,
new case "sends a realistic page to the provider with no way of addressing it
anywhere in the body". The packet in it is that sanitizer's actual output,
pasted rather than imagined. It runs the real DeepSeek provider against a
stubbed fetch and asserts on the **serialized request body**: none of the
page's selectors, no locator-named field, and no occurrence of the substring
`selector` in any case. It then asserts the request is still worth sending:
six elements, the first one exactly, and the overlay.

## 2. The execution read-back

`packages/fluxiq/src/programs/automation-studio/tests/opaque-target-execution.test.ts`,
three cases. `live-patch.ts` and `runtime/tests/live-patch.test.ts` were not
touched.

The round trip is driven through the public path: a real
`temporary_target_override` patch, carrying the exact object the web domain's
`validateWebRuntimeTargetOverrideEvidence` returns, applied by
`executeAutomationStudioRuntimePatch` to a real Flow. The observation point is
the host runtime, because Core hands the host the node it is about to run,
parameters resolved, which is the same object `applyRuntimePatchToFlow` wrote
the target into. A web host reads exactly this. Nothing in the test reaches
into a private function or asserts on a copy of the patch.

What it proves: the target arrives unchanged; the canonical Flow was not
mutated; `normalizeAutomationStudioElementTarget` reads it with no
domain-specific branch and `validateAutomationStudioElementTarget` reports no
errors; the handles ride along untouched; and Core's element matcher picks the
right element out of a candidate set with a decoy, **including after every
selector on the page has changed**, which is the fingerprint-first claim made
concrete rather than asserted.

The third case is the one that makes the other two worth having. A target
carrying only its handles passes
`isAutomationStudioRuntimeTargetOverrideTarget`, is carried, is written into
the node, is executed, and the rerun succeeds - and
`normalizeAutomationStudioElementTarget` returns `null` for it. That is the
failure mode you named: a repair that applies, reports success and points at
nothing. The test pins it, so the round trip cannot pass vacuously.

## Commands run and observed results

Core, `F:\!FluxIQ\packages\fluxiq`:

```
npx tsc --noEmit                                        -> CORE_TSC_EXIT=0 (no output)
npx vitest run src/.../runtime/llm/tests                -> Test Files 7 passed (7)
                                                           Tests 98 passed (98)
npx vitest run src/programs/automation-studio/tests      -> Test Files 1 passed (1)
                                                           Tests 3 passed (3)
npx vitest run .../runtime/tests/live-patch.test.ts      -> Test Files 1 passed (1)
                                                           Tests 23 passed (23)
npx tsc -b tsconfig.build.json                           -> BUILD_EXIT=0
node ../../scripts/rewrite-declaration-imports.mjs dist  -> REWRITE_EXIT=0
```

`F:\!FluxIQ`, `node scripts/structure-audit.mjs`:

```
structure-audit: 1 baseline entries can be lowered. Run "pnpm structure:baseline" to record the improvement.
structure-audit: passed (137 warning(s), 256 baselined).
AUDIT_EXIT=0
```

Web extension, `F:\!FluxIQWebExtension\domain`:

```
npx tsc -p tsconfig.json --noEmit    -> SRC_EXIT=0
npx tsc -p tsconfig.test.json        -> TEST_EXIT=0
DOMAIN_TEST_BUILD_LABEL=t-opaque-target node scripts/test-domain.mjs
  -> # tests 485   # pass 485   # fail 0   # duration_ms 7804.2188
```

`F:\!FluxIQWebExtension`, `node scripts/structure-audit.mjs`:

```
structure-audit: passed (56 warning(s), 17 baselined).
AUDIT_EXIT=0
```

`contract-spread` is clean, and so is `working-docs` - the index was
regenerated on your side between my two runs. No path was added to the audit
config and no baseline was updated in either repository.

The domain suite went from 481 tests to 485. Thirty-five of the existing 481
failed the moment the field was removed, and every one was a fixture or an
assertion rather than a defect: `present<T>()` turned the deletion into a
compile error in eleven files, which is the mechanism working as designed and
is why none of them could be missed.

## Not verified

- **Still no live browser and no live provider run.** Everything here is
  offline.
- **The extension side was not exercised.** Nothing under `apps/extension`
  reads `WebLlmEvidenceElement`, which I checked by grep, and the wire contract
  it produces is unchanged, but no extension test was run for this.
- **The retained binding is in-memory and per-runtime-instance.** A repair
  validated by a different process, or more than eight packets after the one it
  belongs to, resolves fingerprint-only. That is the designed fallback and it
  is tested, but the eviction bound itself is a judgement rather than a
  measurement.
- **The `web-state-diff.v2` field rename.** I searched both repositories for
  `addedSelectors` / `removedSelectors` and found only `host-runtime.ts`, its
  test, and stale `.test-build` output. If a consumer exists outside these two
  repositories, it will break.

## Open questions

- `runtime/llm/tests/evidence-loop-provider.test.ts:142-144` still declares
  hypothetical domain tools (`web.click_safe`, `web.fill_safe`) whose input
  schemas take a `selector`. That is a Core test of Core carrying whatever tool
  schema a domain declares, so it is not a leak - Core must carry them - but it
  now teaches a shape the web domain does not use (its tools are `inspect`,
  `navigate` and `reveal`, and only `reveal` takes an argument, an opaque
  handle). Worth renaming when someone is next in that file; I left it rather
  than perturb its token-budget assertions.
- The Core sanitizer de-webbing scoped in the first half of this report is
  unchanged and still wants its own brief.
