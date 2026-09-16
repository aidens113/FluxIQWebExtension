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
