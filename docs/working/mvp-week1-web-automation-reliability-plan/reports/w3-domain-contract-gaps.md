# Report: w3-domain-contract-gaps

Worker: `w3-domain-contract-gaps`. Wave 3, follow-up: the three contract defects
Wave 3's briefs left unowned.

## Outcome

**Done**, with three findings the supervisor should read before integrating,
because two of them contradict the brief and one of them changed my own design
mid-task.

| Task | State |
| --- | --- |
| 1. A typed element fingerprint on `WebAutomationActionCommand` | **Done**, and both paths are live. Reframed by the supervisor mid-task; see [Task 1](#task-1--the-fingerprint-is-a-declared-contract-now-not-a-repair) |
| 1b. `implicitRole` no longer dropped by `elementFingerprint` | **Done** (the grant the supervisor added) |
| 2. `validation` carried through the result mapping | **Done** |
| 3. `metadata.elementTarget` on the manifest outputs | **Done**, but it does **not** do what the brief said it does. See [Task 3](#task-3--the-flag-is-real-the-confidence-floor-was-never-off) |

Domain `check` exit 0 and domain `test` exit 0 with **200 of 200 passing**. The
three `w3-llm-packet` failures the brief warned about were already gone when I
started: my baseline run, before any edit, was 195/195 green.

Nothing here is inert, and each of the three was proved by **executing** the
path, not by reading it — the standard `w3-resolver` set. The probe output is
quoted below.

## Task 1 — the fingerprint is a declared contract now, not a repair

The brief said the fingerprint never reaches the content script and called it
the root of the headline audit finding. That premise is wrong, and I had reached
the same conclusion from `reports/w3-resolver.md` before the supervisor's
correction arrived: the fingerprint travels inside `options`, because
`webAutomationActionFromGatewayCommand` ends with `options: parameters` and
`resolve-target.ts` reads `action.options?.element`.

So this became what the correction called it: promoting an untyped bag entry to
a contract the compiler checks. What landed:

- **`domain/src/actions/types.ts`** declares `WebAutomationElementFingerprint`
  and an optional `element` field on `WebAutomationActionCommand`.
- **`domain/src/client/gateway-mapping.ts`** fills it from the dispatched
  command, through `elementFingerprint` — the *same* normalizer that put the
  value on the wire, imported from `output-nodes` rather than restated, so the
  two ends cannot drift.
- **`options` is untouched.** `w3-resolver`'s landed resolver keeps working
  unchanged, and a test asserts the two say the same thing so they cannot drift
  while both exist.

### The shape, and why it is not a third one

`w3-resolver`'s report existed by the time I reached this, so I matched it
rather than inventing a shape. It imports `ElementFingerprintCandidate` from
`fluxiq/automation-studio` for the candidate side; the reference side of Core's
matcher is `ElementFingerprint` in
`packages/fluxiq/src/programs/automation-studio/fingerprinting/element-fingerprint.ts`,
which `createAutomationStudioElementMatcher` scores candidates against. So:

```ts
export type WebAutomationElementFingerprint = ElementFingerprint & {
  text?: string | undefined;   value?: string | undefined;
  name?: string | undefined;   href?: string | undefined;
  inputType?: string | undefined; implicitRole?: string | undefined;
};
```

Core's type, widened by exactly the extra keys `elementFingerprint` already
emits. Declaring only Core's half would have hidden fields the page already
reads — `content/element-finder.ts` looks elements up by `name`, and
`resolve-target.ts` falls back to `implicitRole` for the candidate family. The
import is type-only, as `AutomationStudioFailureRecord` in the same file already
is, so no Core runtime enters the content bundle. The extension's `check` passes
with it (`BrowserActionCommand = WebAutomationActionCommand`).

### The design change I made mid-task, and the measurement that forced it

I first ordered the sources `target.element`, then `target.fingerprint`, then
`parameters.element`, reasoning that the dispatched target is the adapted one
and therefore the better one. **Executing the path proved that backwards for
every dispatch that happens today**, and had I shipped it the declared field
would have been strictly *worse* than the untyped bag beside it.

Core's `prepareElementTargetAction` runs on **every** policy output dispatch
(`runtime/io-policy.ts`, called at lines 31 and 83). It normalizes an element
target out of the parameters and writes it back as `parameters.target`. Its
`normalizeFingerprint` reads only the parameters' own top-level keys and never
looks inside `parameters.element`, so with no runtime candidates to match it
produces a lossy copy — and `outputTargetFromPayload` prefers that over
`payload.element`. Measured, running Core's real
`normalizeAutomationStudioElementTarget` against a recorded `web.dom.click`:

```text
Core normalized target : {"kind":"element","fingerprint":{"selector":"#save-settings",
                          "statePath":"web.elements.save.changes"},"source":"runtime"}
has candidates         : false

BEFORE io-policy   target.element : 11 identity signals
AFTER  io-policy   target.element : {"selector":"#save-settings"}      <- 1 signal
```

The rule now is explicit: when Core matched a runtime candidate
(`parameters.target.selectedCandidate` is set) the target's copy describes the
element the page really has and wins; otherwise the recorded
`parameters.element` is the richer and equally current description and wins.
Both branches are tested, and after the fix:

```text
AFTER io-policy
  target.element  : {"selector":"#save-settings"}
  command.element : 11 signals, testId "save-changes", implicitRole "button"
  options.element : 11 signals  -> declared === options
```

**This leaves a separate, real defect in a file I was not granted for it.** The
wire `target.element` still collapses to a bare selector on every dispatch, and
every other consumer of `command.target` sees that. The fix is a one-line
reordering in `output-nodes/targets.ts` `outputTargetFromPayload`: prefer
`payload.element` over `adaptedFingerprint`, since a normalized-but-unmatched
fingerprint is a lossy re-derivation of the same recorded element, while a
selected candidate (already ahead of it in the chain) is not. I did not make it:
the supervisor's grant on that file was for the `implicitRole` narrowing
specifically.

### The narrowing (task 1b)

`elementFingerprint` in `output-nodes/targets.ts` now emits `implicitRole`. It
matters because `describe-element.ts` sets `role` **only** when a `role`
attribute was authored, so on a page that writes no ARIA the recorded element
reached the browser with no semantic signal at all. `resolve-target.ts` already
reads `role ?? implicitRole` when it counts the same-family controls a not-found
failure reports, so this is load-bearing today, not only for a future scorer.
Proved on the executed path: `implicitRole: "button"` now arrives on both
`command.element` and `command.options.element`.

### The one line this needs that I do not own

`resolve-target.ts` `recordedTarget()` still reads `action.options?.element`.
That is correct and deliberate — both paths must be live — but nothing reads the
declared field yet. `w3-resolver`'s report names the follow-up precisely: "if it
lands, `recordedTarget()` in `resolve-target.ts` is the one function that has to
read the new field, and it is four lines." Prefer `action.element` and fall back
to `action.options?.element`.

## Task 2 — the validation now reaches the domain

`webAutomationActionResultPayload` in `gateway-mapping.ts` now carries
`validation`. It is the only place the evidence for a failure lives:
`OUTPUT_NOT_OBSERVED` is defined as carrying `expected` and `actual`, and
`runtime/failure/classify.ts` rule 5 reads them off the outcome's validation.
Until now the domain could name a failure and never show why.

Passed through exactly as the producer wrote it. `w3-redaction-followup` is
redacting `expected`/`actual` for sensitive controls at the producer in
`content/actions/`, and a second rule here would be a second rule to keep in
step — the duplicated-rule mistake that leaked a card number in Wave 1. Nothing
in the function logs a validation value.

Four cases are tested: a failed validation with both sides, a passed one (it is
evidence too), a `none` with its reason, and a result that carries none at all
staying absent rather than gaining an invented one — `gateway-payloads.ts`
replays stored results through this function.

**Adjacent gap, deliberately not shipped:** `resolution`
(`WebAutomationTargetResolution`) is dropped by the same function. Adding it is
one word in a file I own, but nothing reads it yet — `w3-resolver` reports that
`resolution` cannot even reach a successful result today — so it would be
exactly the inert change the wave's binding rules warn about. Worth doing in the
same brief that fixes the producer side.

## Task 3 — the flag is real; the confidence floor was never off

`metadata.elementTarget: true` is now declared on the eight element-targeted
entries of `webAutomationManifestOutputs`.

I verified `w3-domain-contracts`'s claim about where Core reads it, and it is
correct: `elementTargetMinimumConfidence` (`runtime/io-policy.ts:291`) reads
`output.definition.metadata.elementTargetMinConfidence` then
`output.definition.safety?.level`, and `prepareElementTargetAction:203` reads
`output.definition.metadata?.elementTarget`. `output` is
`io.getOutput(domainId, outputId)`, whose `definition` is the
`DomainOutputDefinition` registered from `webAutomationManifestOutputs`
(`domain/src/io/web-automation-io.ts:42`, `domain/src/web-panel-host.ts:54`) —
not the authoring node definition. `safety.level` was already correct there.

**But the brief's title claim is wrong.** "The element-target confidence floor
never applies" is not what this flag controls. Reading `prepareElementTargetAction`
line by line: `outputRequiresElementTarget` is referenced at lines 203 and 205
and **nowhere else in the file**, both inside the `if (!target)` branch.
`resolveElementTarget(target, elementTargetMinimumConfidence(output))` is called
*after* that branch, unconditionally. So the floor already ran, flag or no flag,
for any output whose parameters normalize to an element target — which for these
eight is always, because `selector` is a required parameter and Core's
normalizer picks it up.

What the flag actually buys is the `!target` branch: an element-targeted output
dispatched with no element signal at all now **fails** with
`element_target.missing_fingerprint` (category `graph_validation_or_unknown_node`)
instead of being dispatched to the page. That is the right behaviour — an action
that cannot run without an element should not be sent without one — but it is a
behaviour change, not the switching-on of a dormant floor, and it is the one
risk in this task. See [Not verified](#not-verified).

### How membership is decided, and the deviation from the brief

The brief said to copy `w3-domain-contracts`'s list rather than derive
membership a second way. I derived it instead, from
`parameterSchema.required.includes("selector")` — **the same rule, from the same
source, that `output-nodes/definitions.ts` already applies** — and put the
hand-written list of eight in the test instead, where an independent restatement
belongs and where it catches an unintended change on either side. A literal list
in the source would disagree with the node side the moment a ninth
selector-required action is added; deriving from the shared schema means they
agree by construction *and* the test proves it. This is the pattern
`w3-failure-codes` used for its code table.

`domain/src/io/tests/manifest-definitions.test.ts` holds five tests: the list
restated by hand; the manifest and the node definitions agreeing output by
output; both following the schema row; a non-targeted output declaring no
element-target metadata at all; and every element-targeted output carrying a
`safety.level` Core's ladder recognizes, so the 0.5 default fallback can never be
what applies. The resulting floors are 0.68 for the six mutating actions
(`review`) and 0.45 for `extract` and `wait_for_selector` (`safe`).

## Commands run and observed results

`DOMAIN_TEST_BUILD_LABEL=w3-domain-contract-gaps` on every domain command,
`EXTENSION_TEST_BUILD_LABEL=w3-domain-contract-gaps` on the extension one. Exit
status captured by redirecting to a file and echoing `$?`, never through a pipe.
No `pnpm build`, no `pnpm lab`, no `pnpm structure:baseline`.

- `pnpm --filter @fluxiq-web-extension/domain check` — **exit 0** four times
  (baseline before any edit, after the source edits, after the tests, and
  finally after the source-order fix). `grep -c "error TS"` on the final log: 0.
- `pnpm --filter @fluxiq-web-extension/domain test` — **exit 0**.
  - Baseline, before any edit: `# tests 195 / # pass 195 / # fail 0`. The three
    `w3-llm-packet` failures the brief warned about had already been fixed.
  - Final: `# tests 200 / # pass 200 / # fail 0`. The five new subtests are
    `ok 18`–`ok 22` in `io/tests/manifest-definitions.test.ts`.
    `client/tests/gateway-mapping.test.ts` is a bare assertion script and
    printed `Web automation gateway mapping tests passed.`, which it only does
    when every assertion in it — including my seventeen new ones — has held.
- `pnpm --filter @fluxiq-web-extension/extension check` — **exit 0**, 0 `error
  TS`. Not in my definition of done; run because a new field on
  `WebAutomationActionCommand` is a new field on `BrowserActionCommand`.
- **Executed the dispatch path twice**, bundling the domain source with esbuild
  and running it, rather than reasoning about it:
  - Probe 1: recorder descriptor → recording event → node parameters → wire
    target → action command, and an action result → gateway payload. Output:
    `command.element` carries 11 signals, `declared === options: true`,
    `implicitRole on wire: button`, `frameId: 2`, and the result payload keys
    include `validation` with both sides of the comparison.
  - Probe 2: the same, with Core's real `normalizeAutomationStudioElementTarget`
    applied first, reproducing `prepareElementTargetAction`'s two lines. This is
    the probe that caught the source-order defect; both its runs are quoted
    under [Task 1](#the-design-change-i-made-mid-task-and-the-measurement-that-forced-it).
- `node scripts/structure-audit.mjs` with a scratch `GIT_INDEX_FILE` (a copy of
  `.git/index` with the new test file and this report added by `git add -N`; the
  real index was never written) — **exit 1**, three violations, none mine and
  none in `domain/`:
  - `apps/extension/src/runtime/tests/result-mapping.test.ts` importing
    `../../content/evidence` past its barrel;
  - `apps/extension/src/shared/protocol.ts`, two imports past the same barrel —
    this one appeared between my first audit run and my last, without my
    touching that tree;
  - `docs/working/README.md is out of date with the documents' header blocks`.

  Running the same command against the **unmodified** index at the same moment
  gives byte-identical output (`diff` clean), so staging my new test file and
  this report changes nothing, and no warning names a file I own. The first and
  third were already reported by `w3-domain-contracts`.

## Not verified

- **No live browser validation, and Task 3 is the one change that needs it.**
  Turning `metadata.elementTarget` on means Core now refuses an element-targeted
  action whose parameters carry no normalizable element signal, where it
  previously dispatched it and let the page fail with `TARGET_NOT_FOUND`. I
  reasoned from Core's source that this cannot fire for a well-formed node,
  because `selector` is a required parameter for all eight and Core's normalizer
  reads it off the parameters — but a `selector` bound from state that resolves
  empty at runtime would now fail at the policy layer with
  `element_target.missing_fingerprint` and the category
  `graph_validation_or_unknown_node`, which is a worse name for that failure
  than the browser's. **A Lab run should exercise at least one element-targeted
  action end to end** before this is trusted.
- **The `element` field has no consumer yet.** It is populated and typed and the
  test proves it agrees with `options.element`, but `resolve-target.ts` still
  reads the `options` path, by design. Until the four-line follow-up above
  lands, the declared field is a contract rather than a behaviour.
- **`implicitRole` was proved to arrive; it was not proved to improve a
  resolution.** Nothing scores with it yet — `w3-resolver` reports Core's
  matcher cannot be bundled into a content script until Core publishes a
  browser-safe `fingerprinting/` subpath. The one live consumer is the
  same-family count in a `TARGET_NOT_FOUND` record.
- **No repository-wide `check`, `test` or `build`.** Those are the supervisor's,
  and nine other workers were editing this tree.
- **The redaction interaction.** I carry `expected`/`actual` through verbatim; I
  did not verify that `w3-redaction-followup`'s producer-side redaction is in
  place, so if it is not, a sensitive control's value could now travel further
  than it did before this change. Worth checking that the two landed together.

## Open questions or contradictions found

1. **The wire `target.element` is degraded on every dispatch**, not just for the
   fingerprint field. Measured: 11 identity signals before Core's io-policy step
   and 1 after, because Core's normalization builds its fingerprint from the
   parameters' top-level keys and `outputTargetFromPayload` then prefers it over
   `payload.element`. This is a plausible second cause of the audit's "Core's
   element matcher never receives candidates and its top signals are zero for
   web targets" and it is not fixed by any Wave 3 brief. The fix is one line in
   `output-nodes/targets.ts`; I was granted that file only for the `implicitRole`
   narrowing, so I did not take it.
2. **The brief's premise for Task 3 does not match Core.** The confidence floor
   was never off. The flag controls only whether a missing fingerprint is a fast
   named failure. Worth correcting in the plan, because the audit's targeting
   section may be resting on the same misreading.
3. **`elementFingerprintSchema` in `domain/src/actions/schemas.ts` does not
   declare `implicitRole`** — nor `text`, `value` or `inputType`, all of which
   `elementFingerprint` emits. That schema is what a Flow author sees when
   binding the `element` parameter, so the four are invisible in the UI. One
   file, four lines; not in my Owns.
4. **Should `elementFingerprint` fold `implicitRole` into `role` when no `role`
   attribute was authored?** The candidate side already does — `candidates.ts`
   computes `role = getAttribute("role") || implicitRole(element)` — so a matcher
   comparing `fingerprint.role` against `candidate.role` compares an absent
   value against a present one and scores nothing, even though both sides know
   the role. Carrying `implicitRole` separately is the conservative half of the
   fix; collapsing it into `role` is the half that makes Core's weight of 10
   actually count, and it changes the meaning of an existing field, so I left it
   for a decision rather than making it.
5. **`domain/src/actions/types.ts` is in nobody's Owns and needed a change.**
   `w3-domain-contracts` said so too. It is the file the whole action vocabulary
   lives in; it should have an owner in Wave 4.
