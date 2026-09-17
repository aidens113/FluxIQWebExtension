# C2.5d downstream half — fingerprint-first repair target

**Outcome: Done, with no code change.** Both defects were real when the brief
was written. Both have since been fixed on this branch by three commits that
post-date the brief. Defect 2 was resolved in the *opposite* direction to what
the brief instructs, deliberately and for a reason I verified independently, so
applying the brief's instruction would reintroduce a defect diagnosed from a
live run. I changed no source.

## 1. What Core's target contract actually is today

The brief's path, `packages/fluxiq/src/programs/automation-studio/harness/
structured-response.ts`, does not exist. The file is at
`packages/fluxiq/src/programs/automation-studio/runtime/llm/harness/structured-response.ts`,
and the type is at **:127**:

```ts
export type AutomationStudioRuntimeTargetOverrideTarget = JsonObject & {
  handles: Record<string, string>;
};
```

**Core's phase T landed.** The target is opaque and domain-owned exactly as the
brief predicted. `handles` is the only key Core and a domain agree on; Core
bounds both sides of that map and reads neither. Every other key is "the
domain's own resolution of those handles, in the domain's own vocabulary", which
Core carries and never looks inside. The doc comment states the prior shape
explicitly: "it was `{ selector: string }`, and a non-browser domain had no way
to answer it."

Two guards enforce the split (:143 and :156):

- `isAutomationStudioRuntimeTargetOverrideTarget` — what Core will *carry*:
  bounded handle tokens, valid JSON, and a serialized length within
  `AUTOMATION_STUDIO_RUNTIME_TARGET_MAX_SERIALIZED_LENGTH` (4,000). It does not
  and must not check what the domain put in it.
- `isAutomationStudioModelAuthoredTargetOverrideTarget` — the stricter guard a
  *model's* output must pass: `handles` and nothing else. This is what closes
  the one path by which a locator could reach an executed action through the
  model.

So the downstream half could be built against the contract. It already has been.

## 2. Defect 1 — persisted repair is selector-only

**Reproduced at `ee25ac9` ("Wave 3"), which is the commit the brief was written
against. Already fixed at HEAD.**

At `ee25ac9`, `domain/src/runtime/llm-evidence/target-override.ts` was exactly
as the brief describes:

```ts
export function validateWebRuntimeTargetOverrideEvidence(
  evidence: WebLlmPageEvidence,
  target: { selector: string },
  failedAction: AutomationStudioRuntimeTargetOverrideFailedAction
): ... {
  ...
  return { status: "resolved", target: { selector: resolved.selector } }
```

and `tools.ts:91` carried the matching `target: { selector: string }` on
`validateTargetOverrideEvidence`. Selector-only on both sites, as claimed.

At HEAD the resolution is fingerprint-first. `resolvedTarget()` returns:

| Field | Source |
| --- | --- |
| `handles` | the handle the model itself named |
| `handleResolution: "named"` | that the handle is the model's own, never substituted |
| `tagName`, `role`, `accessibleName`, `visibleText` | the identity |
| `selector` | a hint, and **absent** where the binding is gone |
| `metadata` | frame, input/control type, form, list index and total |

This is stronger than the brief asked for. The brief wanted the fingerprint
returned *together with* the selector; the code returns the selector only where
the caller still holds the binding that issued the handle, and resolves
fingerprint-only otherwise — "weaker, not wrong", since Core's matcher weights a
selector 14 against 28 for a test id and 24 for an accessible name.

I confirmed the shape is one something actually reads:
`domain/src/output-nodes/targets/targets.ts:outputTargetFromPayload` reads a flat
element fingerprint plus a selector, with the adapted fingerprint's selector
ahead of the payload's. The fingerprint is written flat precisely so Core's
element-target normalizer and the DOM outputs need no new branch.

Landed in `9d323a1` ("Stop describing selectors to the model"), `c356174`
("Tell the model what it may repair"), `4f4efde` ("Refuse a repair Core cannot
stand behind").

## 3. Defect 2 — extract-list can never be repaired

**Reproduced at `ee25ac9`. Deliberately resolved the other way at HEAD. I did
not apply the brief's instruction, and it should not be applied.**

At `ee25ac9` the brief's description was accurate to the line:

```ts
return definitionId === "web.output.dom-wait_for_selector"
  || definitionId === "web.output.dom-extract";
```

`targetCompatibleWithFailedAction` accepted `dom-extract` and not
`dom-extract_list`, so an extract-list target failure always returned `absent`.
That function no longer exists anywhere in the repository.

**Why accepting `dom-extract_list` would be wrong.** The refusal at HEAD is not
an oversight carried forward; it is a fix. `domain/src/runtime/llm-evidence/
repairable-parameters.ts` deliberately omits the list extraction, and
`target-override.ts` refuses it in Core's own word, `action_not_repairable`.
I verified the stated reason against the code rather than trusting the comment:

`domain/src/output-nodes/extract-list/dispatch.ts:webAutomationExtractListDispatch`
reads `nodeParameters.extractList`, `nodeParameters.timeoutMs` and
`nodeParameters.recordOutput`. **It never reads `target`.** A resolved repair is
written by Core into the node's `target`, so a repaired extract-list target is
saved where nothing reads it. The commit message for `4f4efde` and the test
comment both record the observed consequence: the repair was "applied" and the
run went exactly as before.

The row and its fields were once offered here as `item` and `field.<key>`, which
is the design the brief is reaching for. It was removed because it produced a
silent no-op. An extraction is repaired, when it is, by re-issuing its
`extractList` request as a parameter override — not through the target map. Until
that exists, refusing tells the model and the run record the truth.

Accepting `dom-extract_list` in `ELEMENT_ROLE_BY_DEFINITION_ID` is precisely
mutation B below, and it breaks six tests.

**This is the supervisor's to settle.** If an extract-list repair is wanted, the
work is the `extractList` re-issue path, not this map.

## 4. What I changed

Nothing. All four files I own are byte-identical to `HEAD`:

- `domain/src/runtime/llm-evidence/target-override.ts`
- `domain/src/runtime/llm-evidence/tools.ts`
- `domain/src/runtime/llm-evidence/tests/target-override.test.ts`
- `domain/src/runtime/llm-evidence/tests/tools.test.ts`

`git status` shows them clean after both mutations were reverted. No test was
added, because every behaviour the brief asks for is already covered — the
mutations prove it.

## 5. How sanitization is preserved

The fingerprint widens nothing that leaves the boundary.

Every field in `elementFingerprint()` is read from `WebLlmEvidenceElement` — the
already-sanitized packet element — and nothing else: `tag`, `role`, `name`,
`text`, `inputType`, `controlType`, `form`, `frameId`, `item.index`,
`item.total`. No raw HTML, no cookies, no headers, no page text beyond what the
sanitizer already permits. These are the same values the model was already shown
in the packet, so the fingerprint carries nothing the model did not already have.

The one field not in the packet is `selector`, and it moves *inward*, not
outward: it comes from `WebLlmSnapshotBinding.selectors`, a domain-side map the
sanitizer builds and which the packet never carries.
`WebLlmEvidenceElement.target` documents this — "There is deliberately no
`selector` beside it... The selector lives in `WebLlmSnapshotBinding.selectors`,
keyed by this handle, and never leaves the domain." `tools.ts` reinforces it from
the other side: `deniedEvidenceKeys` now lists `"selector"`, because "after the
repair target became opaque it is ours to deny." The selector reaches Core only
inside a resolved target that the domain itself authored, never through the
model, which `isAutomationStudioModelAuthoredTargetOverrideTarget` enforces.

`present<T>()` is used for all three contract types written here —
`WebResolvedRepairTarget`, `WebRepairElementFingerprint`,
`WebRepairElementMetadata` — every field by name, no spread. The structure audit
reports no contract-spread violation in this directory.

## 6. Mutations

Each was applied, run, and reverted; `git status` confirmed clean afterwards.

**Baseline (unmutated):** `# tests 663 / # pass 663 / # fail 0`, exit 0.

### Mutation A — drop the fingerprint from the returned target

`resolvedTarget()` changed to return `{ handles, handleResolution: "named" }`
only. **13 tests failed** (`# tests 663 / # pass 650 / # fail 13`), exit 1:

```
not ok 477 - a repair naming a control only the exploration revealed resolves with the selector behind that handle
not ok 479 - a failure packet and explored packets of the same page, with the same element count, never lend each other selector hints
not ok 480 - an exploration of more than eight packets never evicts the failure packet's hints, and drops the oldest explored binding first
not ok 483 - accepts an override naming the renamed Save, and resolves it fingerprint first
not ok 488 - Core proposes a recorded click repair, from the output the recording dispatches
not ok 489 - Core still proposes a click repair, carrying the flat fingerprint the domain resolved
not ok 530 - resolves a repair from the opaque handle the model was shown, fingerprint first
not ok 539 - a recorded action is repaired as the verb its output names
not ok 541 - without the binding the repair is fingerprint-only, which is weaker rather than wrong
not ok 543 - carries a child-frame element's frame beside the selector that works inside it
not ok 545 - a click on a list row still resolves flat, with the row's position as metadata
not ok 549 - binds from the production host seam and selects the sole trusted web client without requiring stale pairing project metadata
not ok 551 - a repair on a packet this runtime issued gets its selector hint back, without the packet ever carrying one
```

The protection is real and well covered, including the round trip through Core
(477, 488, 489, 551) rather than only the unit shape.

### Mutation B — extract-list compatibility

The brief's literal mutation cannot be run: there is no extract-list
compatibility at HEAD to drop. I ran the equivalent probe in the direction that
matters — **adding** `"web.output.dom-extract_list": "observable"` to
`ELEMENT_ROLE_BY_DEFINITION_ID`, i.e. restoring the pre-`4f4efde` state the brief
asks for. **6 tests failed** (`# tests 663 / # pass 657 / # fail 6`), exit 1:

```
not ok 487 - Core keeps no proposal for a list extraction repair, and records why
not ok 492 - every declared parameter name is a name Core will carry as a handle key, and says what its handle is
not ok 494 - a list extraction declares nothing a target repair may re-point
not ok 497 - a failure packet offers the parameters the failed action declares, and `element` where the verb is not known yet
not ok 544 - a list extraction is refused as not repairable, whatever it names, before any handle is resolved
not ok 552 - post-failure evidence names the parameter a repair fills, and nothing for an action that offers none
```

Test 544 is in `tests/target-override.test.ts`, a file I own. The deliberate
refusal is locked down by tests in the same place the brief wanted the change,
which is the clearest possible signal that the change must not be made blind.

This mutation touched `repairable-parameters.ts`, which is outside my owned set.
It was transient, reverted with `git checkout --`, and confirmed clean.

## 7. Validation

```
DOMAIN_TEST_BUILD_LABEL=w25d-target pnpm --filter @fluxiq-web-extension/domain test
# tests 668
# pass 668
# fail 0
EXIT=0
```

(668 rather than the earlier 663: the agent working concurrently in
`domain/src/runtime/expectation/` added five tests between my first and last run.
All pass.)

```
node scripts/structure-audit.mjs
  FAIL  [working-docs] docs/working/mvp-week2-automation-loop-plan.md: "## Current State" is 177 lines, over the 150-line budget.
  FAIL  [working-docs] docs/working/README.md is out of date with the documents' header blocks. Run "pnpm structure:baseline" to regenerate it.
structure-audit: 2 violation(s) across 1 rule(s).
EXIT=1
```

**Both failures are the supervisor's working documents, not code, and pre-date
me** — I changed no file. `docs/working/mvp-week2-automation-loop-plan.md` is
modified in the working tree by the supervisor as I write this. Nothing in
`domain/src/runtime/llm-evidence/` fails. That directory carries two standing
*advisory* warnings, both pre-existing and neither worsened by me:

```
warn [directory-files]   domain/src/runtime/llm-evidence/: 16 source files is past the 15-file advisory threshold.
warn [exported-values]   domain/src/runtime/llm-evidence/vocabulary.ts: 10 exported values is past the 8-value advisory threshold.
```

## 8. Observation, not a defect

`domain/src/runtime/llm-evidence/tools.ts` contains one **raw NUL byte** at
offset 20748, inside `packetKey()`:

```ts
return `${evidence.location}\x00${JSON.stringify(evidence.elements)}`;
```

It is committed and intentional-looking as a separator, and it is behaviourally
identical to the `\0` *escape* used two functions below in `evidenceScope()`. The
cost is that `grep`/`rg` classify the whole file as binary and print
`Binary file ... matches` instead of the matching line, which will cost the next
agent time. Replacing the raw byte with the two-character `\0` escape is a
zero-behaviour-change edit. I did not make it: it is outside the brief, and I
would rather flag it than make an unrequested edit to a file another step may
touch.

## 9. Not verified

- **No live browser or live-provider run.** Everything here is source reading and
  the domain test suite. That the fingerprint-first repair survives a real
  cosmetic page change against a real model is not something I exercised.
- **Core-side behaviour was read, not run.** I did not run Core's test suite, and
  I did not edit Core. `isAutomationStudioRuntimeTargetOverrideTarget`'s
  4,000-character serialized bound versus a large real fingerprint (long visible
  text, many metadata fields) is a limit I read but did not probe; a fingerprint
  that exceeded it would be refused by Core as an invalid resolved target.
  Worth a check if extraction-scale targets are ever carried.
- **The concurrent `expectation/` work.** My test runs compiled the whole domain
  including another agent's in-flight edits. The final green run reflects their
  tree state as well as mine; my own files were clean at every run.
- **Single observation.** Each mutation was run once. Given this machine's known
  RAM fault the counts (13 and 6) could in principle differ on a rerun, though
  both failed deterministically in the expected places, and the baseline and
  final runs were both fully green.
