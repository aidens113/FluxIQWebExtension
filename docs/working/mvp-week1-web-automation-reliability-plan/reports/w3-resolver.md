# Report: w3-resolver

Worker: `w3-resolver`. Wave 3, Phase 1.3 step 3 — target resolution beyond exact
lookup.

## Outcome

**Partial.** Level 1 is done and proven: exact strategies now gate on
visibility, enabled state and tag agreement, count their matches, refuse an
ambiguous target instead of guessing, and carry Core's structured failure record
and the resolution measurement onto the result. Candidate enumeration is done
and is used. A visual point now prefers scroll-corrected `documentBounds`.

**Level 2 scoring is blocked, and not by anything in this repository.** Core's
element matcher cannot be bundled into a content script. The detail and the fix
are in [The Level 2 blocker](#the-level-2-blocker); it needs a Core packaging
change and a build-script change, both outside this brief's Owns and one of them
across the repository boundary. `content/identity/score.ts` was therefore **not
created**: with no matcher there is nothing for it to delegate to, and the only
alternative — reimplementing Core's scoring here — is the approximation the
project forbids.

Two consequences follow, and both are honest gaps rather than defects:

- A control whose selector, id, test id **and** text have all drifted at once is
  still unresolvable. Of the four `identity-drift` modes, none is in that state,
  so all four resolve; a fifth mode that changed text *and* id together would
  not.
- `confidence`, `bestScore` and `runnerUpScore` are absent from every
  `resolution`, rather than filled with a constant. The brief says confidence is
  the measured score and never a constant; with no scorer there is no measure,
  and an invented number would be worse than a missing field.

## The fingerprint path — answering the supervisor's question

The supervisor asked, mid-task, whether the fingerprint the resolver needs ever
reaches the content script, having found that `WebAutomationActionCommand` has
no `element` or `fingerprint` field and that `webAutomationActionFromGatewayCommand`
never reads `target.element`.

**Both of those observations are correct, and the fingerprint reaches the
content script anyway.** It travels through `parameters`, not through `target`.

1. `domain/src/output-nodes/payloads.ts` → `recordedOutputParameters` puts the
   fingerprint **inside the node's parameters**: for `web.dom.click` it returns
   `{ selector, element, visualTarget?, browserFrameId? }`. `element` is
   `elementFingerprint(payload.element)` from `output-nodes/targets.ts`.
2. `domain/src/io/input-model.ts` → `webAutomationRecordedAction` returns those
   as the output node's `parameters`.
3. `domain/src/client/gateway-mapping.ts` →
   `webAutomationActionFromGatewayCommand` ends with `options: parameters`, so
   the whole parameter object, `element` included, becomes `action.options`.
4. `apps/extension/src/runtime/action-runner.ts` forwards the whole
   `BrowserActionCommand` to the frame, so `options` arrives intact.
5. `resolve-target.ts` reads `action.options?.element` — which is what it read
   before this change too.

I did not take this from reading alone. I ran steps 1–3 for real, bundling the
domain source with esbuild and executing it:

```text
outputId: web.dom.click
node parameters keys: [ 'selector', 'element', 'browserFrameId' ]
command.selector: #save-settings
command.options.element: {"selector":"#save-settings","id":"save-settings",
  "visibleText":"Save changes","tagName":"button","role":"","testId":"save-changes",
  "accessibleName":"Save changes","label":"","attributes":{...}}
```

So the plumbing is not the blocker, and the contract work the supervisor is
dispatching for `target.element` is not needed to make a scorer live — though a
`target`-side channel would still be the tidier place for it, since `options`
carries the raw parameters verbatim and nothing declares that `element` is in
there.

One narrowing is worth recording. `elementFingerprint` keeps every signal the
resolver reads — `selector`, `xpath`, `id`, `testId`, `tagName`, `visibleText`,
`classNames`, `name`, `attributes` — and **drops `implicitRole`**, along with
`bounds`, `documentBounds` and `context`. Today that costs only the candidate
family used for the not-found count. A scorer would want `implicitRole`, because
`implicitRole` is the role signal a page that writes no ARIA offers at all, and
Core weighs `role` at 10.

## The Level 2 blocker

Core's matcher (`scoreElementFingerprintCandidates`, `bestElementFingerprintCandidate`,
`DEFAULT_ELEMENT_FINGERPRINT_WEIGHTS`) lives in
`packages/fluxiq/src/programs/automation-studio/fingerprinting/element-fingerprint.ts`
and is published only from the `fluxiq/automation-studio` subpath. Bundling that
subpath for a browser fails outright — not "is large", fails:

```text
X [ERROR] Could not resolve "node:perf_hooks"
    ...automation-studio/testing/scale-graph-store.js:1:28
X [ERROR] Could not resolve "node:crypto"
    ...automation-studio/dsl/source.js:1:27
  (and three more)
```

The barrel re-exports `testing/` and `dsl/`, which import Node built-ins, and
esbuild reports resolution errors before tree-shaking can drop them. There is no
route around it from inside my Owns:

- `fluxiq`'s `exports` map has no deep subpath, so
  `fluxiq/automation-studio/fingerprinting` does not resolve.
- Routing it through `@fluxiq-web-extension/domain/client` does not help: the
  extension build aliases that specifier to the domain **source**, and the
  domain's own `fluxiq/automation-studio` import would then resolve to the same
  dist barrel. No file in `domain/src` re-exports anything from Core today.
- No extension bundle imports any Core runtime module. The
  `browserSafeWorkspacePlugin` in `apps/extension/scripts/build-extension.mjs`
  exists precisely to keep that true, aliasing `fluxiq/client-gateway` to a Core
  source file.

**The fix, and why I did not apply it.** The established pattern in that plugin
is to alias a bare Core specifier to a Core source file, and
`element-fingerprint.ts` is already browser-safe — its only imports are
type-only. So the change is:

1. **In Core**: add `"./automation-studio/fingerprinting"` to `packages/fluxiq`'s
   `exports` map. This is the right half of the fix and it is a Core change, so
   it crosses the repository boundary and needs the user told.
2. **In `apps/extension/scripts/build-extension.mjs`**: alias that specifier to
   `packages/fluxiq/src/programs/automation-studio/fingerprinting/element-fingerprint.ts`,
   beside the existing `fluxiq/client-gateway` alias.
3. **In `apps/extension/tsconfig.json`**: a `paths` entry for the same
   specifier, since TypeScript resolves it through Core's `exports` map too.

I did not do this. `build-extension.mjs` is the one file every content spec in
the wave depends on: nine workers were running `pnpm test:content` while I
worked, and a mistake there would have broken all of them at once. That is
exactly the collision the wave's file partitioning exists to prevent, and it is
a supervisor's call, not mine.

## What changed and why

### `apps/extension/src/content/action-runtime/resolve-target.ts` (52 → 311 lines)

The exact strategies are unchanged in **order** — selector, coordinates, visual
target, fingerprint, focused element — so a failure still names its misses in
the same sequence. What changed inside each:

- **Every strategy now returns all its matches**, not the first. `selector` uses
  `querySelectorAll`; the fingerprint's text fallback walks the tag and counts.
- **The gate.** A match is preferred when it is visible (connected, has a box,
  not `display:none`/`visibility:hidden`), enabled (`:disabled`, which covers a
  disabled `<fieldset>`'s descendants, and `aria-disabled` on it or an ancestor),
  and of the recorded tag. Deliberately weaker than `actionability.ts`, which
  scrolls and hit-tests: resolution must not move the page to answer "which
  element is this?".
- **The fallback that keeps today's behaviour byte-identical for the single-match
  case.** When the gate rejects every match, the matches themselves are the pool.
  A strategy that found exactly one element resolves it whether or not it is
  hidden or disabled — because a hidden target is what an assertion asks about
  and what an ACTION_REJECTED refusal reports, and neither is the resolver's call
  to pre-empt. Only a *choice between* elements is decided by the gate.
- **Ambiguity is a failure.** Two or more in the pool throws
  `TargetResolutionError` with `TARGET_AMBIGUOUS`, naming up to five candidates
  (`button[data-testid="choice-primary"] "Continue"`).
- **Not-found carries the strategies attempted.** The message is byte-for-byte
  the one this module shipped with, because `resolve-target.spec.ts` pins it and
  I do not own that file; the record says the same thing in Core's vocabulary and
  adds how many same-family controls the page did offer.
- **Codes are never written here.** `WEB_AUTOMATION_FAILURE_CODES` and
  `webAutomationFailureRecord` come from `@fluxiq-web-extension/domain/client`.
- **`documentBounds` now wins over `bounds`.** Viewport bounds say where the
  element was on screen at capture time; after any scroll they point at whatever
  has since moved into that spot. That is how a replay clicks a sticky header.
- **`resolveTargetWithDiagnostics(action): { element, resolution }`** is exported
  beside `resolveTarget(action): Element`, whose signature is unchanged so no
  verb had to move.

### `apps/extension/src/content/identity/candidates.ts` (new, 164 lines)

The pool a resolver chooses from: interactive elements in **this** document
sharing the recorded target's tag **or** role family (a `<button>` that became a
`<div role="button">` is the same control to a person), bounded at 600 scanned
and 60 kept. Each is described as Core's `ElementFingerprintCandidate` — a
type-only import, so no Core runtime enters the bundle — built from the same
`identity/` rules `describe-element.ts` assembles a descriptor from, so a
candidate and a recorded descriptor compare fairly.

It is used today, not parked: `candidateLabel` names the elements an ambiguous
failure tied between, and `collectTargetCandidates` supplies the same-family
count a not-found failure reports. It is also the exact input a scorer needs.

**One rule is duplicated, knowingly.** `candidateTestId` repeats the three
attribute names `describe-element.ts`'s `testIdFor` reads. Importing `testIdFor`
would close a module cycle — `describe-element.ts` imports the identity barrel,
which would now import `candidates.ts`, which would import `describe-element.ts`.
The comment in the file says so. The real fix is to move `testIdFor` into
`identity/`, which needs `describe-element.ts` — outside my Owns and explicitly
in Must-not-touch.

### `apps/extension/src/content/identity/index.ts`

Exports `collectTargetCandidates`, `candidateFingerprint`, `candidateLabel` and
the two types. Header updated: the directory now has two callers reading the same
rules from opposite ends.

### `apps/extension/e2e/content/tests/identity-resolution.spec.ts` (new, 12 rows)

Rows on `identity-drift` (all four drift modes), `ambiguous-targets` and
`long-document`. The identity-drift rows replay the descriptor **read off the
baseline page through `web.dom.extract`**, not a hand-written fingerprint, so
what is exercised is a real replay's resolution. Per the supervisor's third
point, the spec header now states its scope explicitly: these rows prove what
the content script does with a descriptor handed to it the way the background
worker hands it over; they are not end-to-end proof of the plumbing that fills
`options`, which lives in the domain and is evidenced separately above.

## The seam that already landed

The brief's shape assumed the resolver could only throw a sentence.
`w3-failure-producers` has already built the other half in `results.ts`:
`actionFailure` reads `failure` and `resolution` structurally off a thrown value
and puts both on the result, naming `TargetResolutionError` in its own comment.
So **nothing here is inert on the failure path** — the specs assert the record
and the measurement on the wire, not the message:

```ts
expect(reply).toMatchObject({
  status: "failed",
  failure: { category: "target_ambiguous", code: "web.target.ambiguous", retryable: false, stage: "target_resolution", ... },
  resolution: { strategy: "selector", candidateCount: 2 }
});
```

**The success path is still open, and it is a brief-ownership gap.** A resolution
that *succeeded* reaches nothing: `buildResult` fills `result.resolution` from
`ActionResultEvidence.resolution`, and no verb passes one, because
`ContentActionDependencies.resolveTarget` is typed to return `Element`. Closing
it means `content/actions/types.ts`, `execute-action.ts` and each verb that
resolves a target — all in my Must-not-touch list. `resolveTargetWithDiagnostics`
is the adoption point and needs no further change here.

## Deliberate divergences from the brief

- **`wait_for_selector` does not use the resolver, and could not be made to.**
  `content/actions/wait-for-selector.ts` calls `deps.waitForCondition`, and the
  `present`/`visible`/`enabled`/`absent` evaluators in
  `content/action-runtime/wait-conditions.ts` call `document.querySelector`
  directly. Neither file is in my Owns, and adding a seam in `resolve-target.ts`
  that nothing calls is the inert change the binding rules forbid. **The brief
  should have included `content/action-runtime/wait-conditions.ts`** (the verb
  itself needs no change — the evaluators are where the lookup happens).
- **The drift modes are four, not five.** The brief lists `selector-only`,
  `text-only`, `moved`, `wrapped`, `aria-variant`. The fixture
  (`apps/scenario-lab/src/scenarios/identity-drift/modes.ts`) has `baseline`,
  `selector-only`, `text-only`, `moved`, `wrapped-aria` — `wrapped` and
  `aria-variant` are one mode, `wrapped-aria` (corpus row W23). All four drift
  modes have a row.
- **`score.ts` was not created.** See above.

## Commands run and observed results

`EXTENSION_TEST_BUILD_LABEL=w3-resolver` was set for every extension command. No
`pnpm build` and no `pnpm lab` was run. Exit status was captured by redirecting
to a file and echoing `$?`, never through a pipe. No domain file was touched, so
no domain command was run.

| Command | Exit | Observed |
| --- | --- | --- |
| `pnpm --filter @fluxiq-web-extension/extension check` | **0** | `tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json`, no diagnostics. (An earlier run reported two errors in `src/content/evidence/changes.ts`, `w3-evidence`'s file; the rerun was clean.) |
| `pnpm ... test:content -- content/tests/identity-resolution.spec.ts` | **0** | `12 passed (4.6s)`. All twelve new rows. |
| `pnpm ... test:content` (full suite) | **1** | `159 passed`, 18 failed. Three are mine and intended; fifteen are other workers'. Breakdown below. |
| `pnpm ... test` (unit) | **1** | `# tests 143 / # pass 142 / # fail 1`. The one failure is `content/actions/tests/value-redaction.test.mjs` → "a withheld value is named by its length and never by its content", a new `w3-redaction` test in a file I do not own. Reran once: identical. An earlier run before that test existed was `139 pass / 0 fail`. |
| `node scripts/structure-audit.mjs` with a scratch `GIT_INDEX_FILE` (copy of `.git/index` with my two new files added; the real index was never written) | **1** | `2 violation(s) across 2 rule(s)`. **Neither is mine**: `[imports] apps/extension/src/runtime/tests/result-mapping.test.ts` reaching into `../../content/evidence` (w3-evidence), and `[working-docs] docs/working/README.md is out of date` — which was already failing before I started. Diffing the finding lines against a pre-change run shows no new finding naming any file I own. |
| Bundle probe: `bundleExtensionEntry("content", <scratchpad>)` | **0** | `175358 bytes`, up from the tracked `build/content/index.js` at `133020`. Written to the scratchpad only; `build/` and `dist/` untouched. |
| Bundle probe: esbuild `platform: "browser"` on `import { scoreElementFingerprintCandidate } from "fluxiq/automation-studio"` | **fail** | Five `Could not resolve "node:crypto"` / `"node:perf_hooks"` errors. This is the Level 2 blocker. |
| Domain probe: `webAutomationRecordedAction` → `webAutomationActionFromGatewayCommand`, bundled and run | **0** | Output quoted above; `command.options.element` carries the fingerprint. |

### The three content rows I broke, and what each should become

All three are in `e2e/content/tests/resolve-target.spec.ts`, which is **not in my
Owns**. Its own header says "Phase 1.3 changes resolution and must change these
assertions with it", so the file anticipated this — **the brief should have
included it**. Each pins behaviour this step deliberately replaces, and each has
a replacement row in `identity-resolution.spec.ts` that passes:

| Row | Pins today | Now | Replacement |
| --- | --- | --- | --- |
| `on ambiguous-targets › selector: an ambiguous selector takes the first match in document order` (line 49) | `succeeded`, `choice-primary` | `failed`, TARGET_AMBIGUOUS | "an ambiguous selector fails TARGET_AMBIGUOUS and names what tied" |
| `on ambiguous-targets › fingerprint: matching text takes the first match; a test id is exact` (line 73) | first half `succeeded`, `choice-primary` | `failed`, TARGET_AMBIGUOUS. Its second half (a unique test id) still passes | "an ambiguous fingerprint text fails TARGET_AMBIGUOUS; a unique test id still resolves" |
| `on long-document › visual target: viewport bounds win over document bounds, even when stale` (line 173) | `succeeded` on the wrong element | `failed`, TARGET_NOT_FOUND | two rows: "document bounds win over the viewport bounds recorded beside them" and "stale viewport bounds no longer click whatever scrolled into their place" |

The simplest resolution is to delete those three rows: every one of them is
replaced. The rest of that file still passes and is still worth keeping.

### The fifteen other content failures, for the record

Not mine, and each rerun once with the same result. Rows 1–9 and 14–18 all fail
the same way — `code: "web.action.disabled"` (etc.) is now `"web.action.rejected"`,
which is `w3-failure-producers` collapsing ACTION_REJECTED onto the single code
the closed set names, exactly as `reports/w3-failure-codes.md` said it should.
Row 10 is `redaction.spec.ts`, `w3-redaction`'s own new file.

## Not verified

- **No live browser validation of a real replay.** Everything here ran in the T2
  content harness (the real content bundle in real Chromium on a Scenario Lab
  fixture) with no extension, no background worker and no gateway. The
  gateway-to-`options` hop was proven by executing the domain modules directly,
  not by watching a Flow run.
- **No `pnpm build`, no `pnpm lab`, no `pnpm check` at the repository root** —
  the first two are the supervisor's per the wave's binding rules, and the root
  check is not meaningful while nine workers are mid-edit. The structure audit,
  which is the first thing root `check` runs, was run directly.
- **The content bundle grew 32%** (133,020 → 175,358 bytes, unminified). The
  cause is the runtime import of `@fluxiq-web-extension/domain/client`, which is
  the whole domain client barrel — schemas, capabilities, output nodes, recording
  state, gateway mapping — pulled in for the failure codes. It is the first
  runtime domain import in the content bundle. `results.ts` imports the same
  barrel, so this cost is now shared rather than mine alone, but nobody has
  decided it is acceptable. A narrower `./failure` subpath on the domain package
  plus an alias in the esbuild plugin would remove most of it.
- **No unit tests for `candidates.ts`.** My Owns names the two source modules and
  the e2e spec, not `content/identity/tests/`. Enumeration and candidate
  description are therefore covered only through the resolver's behaviour.
- **Frames.** Enumeration is single-document by construction (`document`
  only). Cross-frame resolution is `w3-frame-plumbing`'s and was not exercised
  here.
- **The candidate caps (600 scanned, 60 kept) were not measured against a large
  real page.** They are judgement, chosen so a resolution cannot become a
  full-document walk on every action.

## Open questions or contradictions found

1. **Core packaging is the real blocker on Phase 1.3's headline capability.**
   Until `fluxiq` publishes a browser-safe subpath for `fingerprinting/`, no
   browser-side code in this repository can use Core's element matcher — this
   brief, and any later one that wants scored resolution. The three-part fix is
   listed above. It needs the user told, because part of it is in Core.
2. **`resolution` cannot reach a successful result.** Named above; the fix
   touches `content/actions/types.ts`, `execute-action.ts` and each resolving
   verb. Worth one brief of its own, since it is the same one-line change at
   every call site.
3. **`wait_for_selector` still resolves through `document.querySelector`.** The
   brief asked for the opposite; `wait-conditions.ts` is the file it needed.
4. **`options` is an undeclared contract.** The fingerprint reaches the page only
   because `gateway-mapping.ts` copies the whole parameter bag into `options` and
   the resolver happens to look for `element` there. Nothing types it, nothing
   documents it, and a rename on either side breaks resolution silently with
   every gate green. The supervisor's `target.element` contract work would fix
   this properly; if it lands, `recordedTarget()` in `resolve-target.ts` is the
   one function that has to read the new field, and it is four lines.
5. **`implicitRole` is dropped on the wire** by `output-nodes/targets.ts`
   `elementFingerprint`, so a page that writes no ARIA gives a live replay no
   role signal at all. It costs nothing today; it would cost a scorer real
   accuracy. `w3-domain-contracts` owns that file.
