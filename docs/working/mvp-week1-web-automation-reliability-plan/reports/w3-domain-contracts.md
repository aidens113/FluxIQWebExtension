# Report: w3-domain-contracts

Worker: `w3-domain-contracts`. Wave 3, parallel: Phase 1.3 steps 4 and 5 on the
domain side, plus Phase 1.4 step 5.

## Outcome

**Partial.** Three of the four tasks are done and load-bearing end to end. The
fourth — `metadata.elementTarget: true` and `safety.level` "so Core's floor
applies" — cannot be completed in the file the brief named, because Core reads
neither of those off the node definition. The exact one-line fix, in a file I do
not own, is in [The declaration the brief aimed at the wrong
file](#the-declaration-the-brief-aimed-at-the-wrong-file). Do not tick that
sub-task off this report.

| Task | State |
| --- | --- |
| `browserFrameId` through the payload onto `action.frameId` | **Done**, proven end to end by a test |
| `parameterValues.expectedState` for Core's transition comparison | **Done** on the authored/generated path; the recording→proposal path needs a Core change, described below |
| Remove the unproduced `elements.*.<field>` paths | **Done**, with a ratchet test in both directions |
| `metadata.elementTarget` + `safety.level` so Core's floor applies | **Not done where it counts.** Declared on the node definition, which Core does not read for this. `safety.level` is already correct in the file that is read |

## What changed and why

### 1. The frame an interaction was recorded in reaches `action.frameId`

A command addressed to a child frame has to say which frame, and until now the
frame was recorded only inside the gateway event's `sourceId`
(`tab:12:frame:3`) — text that nothing downstream parses. Every replay of an
interaction recorded inside an iframe therefore ran against the top document.

The chain now has all three links, and the middle one was the missing piece:

1. **`domain/src/client/gateway-mapping.ts`** — `createWebAutomationRecordingEvent`
   writes `browserFrameId` into the event `payload`. That is the object
   `GatewayInputHub` hands to the input binding, so it is the only place a
   downstream reader can see the frame. Frame `0` is the top frame and survives
   `compactJsonObject`, which drops only `undefined`.
2. **`domain/src/output-nodes/payloads.ts`** — `webAutomationOutputPayload` now
   carries `browserFrameId` onto the replayable parameters. Two deliberate
   limits: only a `web.dom.*` action takes a frame (a navigation, a tab
   operation and a download act on the tab, and routing one into a child frame
   would address the wrong thing), and a payload that was empty stays empty, so
   a dispatch-only action does not become a command carrying nothing but a
   frame — which would change what `hasExecutableParameters` sees.
3. **`domain/src/client/gateway-action-parameters.ts`** already lifted
   `parameters.browserFrameId` onto `action.frameId`. It needed no change; it
   simply had nothing to read. I did not edit it (not in Owns) and did not need
   to.

`browserTabId` is deliberately **not** carried onto the replayable parameters.
A recorded tab id is meaningless in a later session and pinning replay to it
would send the command to whatever tab now holds that number.

### 2. `parameterValues.expectedState` on every web output node

`domain/src/output-nodes/definitions.ts` now declares an `expectedState`
parameter on all eighteen output nodes.

This is exactly the seam `w3-host-runtime` needs. Core reads
`node.parameterValues.expectedState` in
`runtime/executor/expected-transition.ts`, puts it on the expected transition,
and `runtime/executor/transition-comparison.ts` hands it to the host boundary's
`expectationEvaluator` as `{ conditions, mode, timeoutMs }`. For a
`web.output.*` node, `parameterValues` **is** the declared parameter map, so
declaring the parameter is what puts a value at that path. Without it, no web
node can ever carry a post-condition and Core falls back to
`Object.keys(expected.expectedState ?? {}).length`, which is zero.

The shape written into the description, matching the note in my dispatch and
the `web.dom.assert` vocabulary in `domain/src/actions/types.ts`:

```
{
  conditions: [{ kind, selector?, expected?, timeoutMs? }],
  mode?: "all" | "any",
  timeoutMs?: number
}
```

`kind` is `WebAutomationAssertKind`: `exists`, `absent`, `text`, `url`,
`visible`, `enabled`. A condition carries its own `selector` because it stands
apart from the action's target — a node can assert about an element it did not
act on. **`w3-host-runtime` should confirm its evaluator reads `selector` off
the condition**; that field is the one part of the shape the assert request type
does not already give us, and the two halves have to agree.

No `defaultValue`: an empty condition list would ask the host to prove nothing
and report a pass, which is worse than no expectation at all.

### 3. Ten declared state paths that nothing produced

`domain/src/recording/domain.ts` declared `elements.*` plus ten
`elements.*.<field>` paths — selector, stableId, tagName, text, label, value,
href, visible, enabled, bounds. `web-state.ts` `addElementStateValues` writes
one `json` value at `elements.<id>` and writes nothing beneath it, so all ten
resolved to nothing on every snapshot while being offered to Flow authors and
to the graph generator as bindings. They are removed; the blob stays, and so do
`elements.count` and `forms.*`/`runtime.*`, which `reducers.ts` does write.

The mirror defect was there too: `web-state.ts` writes `browser.permissions`
and the list did not declare it. It is now declared.

A new test, `domain/src/recording/tests/domain.test.ts`, is the ratchet in both
directions — every produced path must be declared, and every declared path must
be produced. It drives the two state builders and the reducer and compares the
resulting value keys against `statePaths`, so neither list can drift again
without a failing test.

## The declaration the brief aimed at the wrong file

The brief says: "web output nodes must declare `metadata.elementTarget: true`
and a `safety.level` so Core's floor applies (`definitions.ts`)". Core's floor
is `elementTargetMinimumConfidence` in
`F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\io-policy.ts`,
and it reads both fields off **`io.getOutput(domainId, outputId).definition`** —
the `DomainOutputDefinition` registered through `defineOutput`, not the
`AutomationStudioNodeDefinition` that `output-nodes/definitions.ts` builds.
Those are two different registries: node definitions go to
`AutomationStudioNativeNodeRuntime` (`web-panel-host.ts`), and the only field of
a node definition Core reads at runtime is `metadata.timeoutMs`
(`runtime/native-node-runtime.ts:77`).

So:

- **`safety.level` cannot be declared in `definitions.ts` at all.** Core's
  `AutomationStudioNodeSafety` has only `privileged`, `requiresOperatorApproval`,
  `requiredPermissions` and `runtime`. Adding `level` is a compile error.
  It is **already correct** in the file Core does read:
  `domain/src/io/manifest-definitions.ts` sets
  `safety: { level: WEB_AUTOMATION_ACTION_SAFETY[action.actionType], ... }`.
  Nothing to do.
- **`metadata.elementTarget: true` has to go on `webAutomationManifestOutputs`**,
  in `domain/src/io/manifest-definitions.ts` — **the file the brief should have
  included in Owns**. I declared it on the node definitions as well, derived
  from the schema row and covered by a test, but on that side it is inert: it
  documents which nodes take an element target and gives the manifest change a
  tested list to copy, and nothing more.

The change, if the supervisor applies it:

```ts
// domain/src/io/manifest-definitions.ts
export const webAutomationManifestOutputs = webAutomationActionDefinitions.map((action) => ({
  id: action.actionType,
  // ...unchanged...
  ...(Array.isArray(action.parameterSchema.required) && action.parameterSchema.required.includes("selector")
    ? { metadata: { elementTarget: true } }
    : {})
}));
```

Three things to know before applying it:

1. **It must be per-action, not blanket.** `prepareElementTargetAction` fails an
   action outright with `element_target.missing_fingerprint` when the flag is
   set and `parameters` carry no fingerprint signal. Declaring it on
   `web.dom.scroll` would break every delta scroll; on `web.dom.assert`, every
   `kind: "url"` assertion; on `web.browser.*`, everything. Deriving it from
   `required: ["selector"]` gives exactly the eight actions that cannot run
   without an element: click, type, clear, select, wait_for_selector, extract,
   check, upload. That derivation is what I implemented and tested on the node
   side, so the two cannot disagree.
2. **The floor it turns on is 0.68 or 0.45.** Core's ladder is `destructive`
   → 0.9, `privileged` → 0.82, `review` → 0.68, `safe` → 0.45, and everything
   else → 0.5. All eight of these actions are `review` or `safe` in
   `actions/safety.ts`, so `web.dom.upload` and the other five mutating ones
   would resolve at 0.68 and `web.dom.extract` and `web.dom.wait_for_selector`
   at 0.45. If a stricter floor is wanted for an action that feels
   destructive — upload replaces a file input's contents — Core reads
   `metadata.elementTargetMinConfidence` per output and it wins over the level.
3. **Candidates still have to arrive.** `resolveElementTarget` returns
   `unresolved_no_candidates` and passes the action through untouched when
   `target.candidates` is empty. Nothing in this repository populates
   `candidates` today, so turning the flag on changes behaviour only once
   something does — which is `w3-resolver`'s and the state pipeline's territory,
   not this brief's.

## The other gap: a recorded action cannot carry an expectation

`expectedState` is declared and readable for an authored or LLM-generated
`web.output.*` node. It cannot reach a **recording-derived** node, and that is a
Core limitation, not something any file here can fix:

- `mapWebRecordingObservation` returns an
  `AutomationStudioRecordingMapperCandidate`, whose fields are `outputId`,
  `parameters`, `sourceObservationIds`, `sourceInputIds`, `expectedConfirmation`,
  `confidence`, `evidence`, `label`, `description`. There is no expectation
  field.
- `appendRecordingProposalToFlow` (Core `runtime/service.ts`) builds
  `parameterValues: { outputId, parameters, confirmationInputId?,
  confirmationTimeoutMs? }`. A candidate's `parameters` land at
  `parameterValues.parameters`, one level below where
  `expectedTransitionForNode` looks.

So writing an expectation into `webAutomationOutputPayload`'s result would have
been inert, and I did not. Closing it needs an `expectedState` field on the
mapper candidate and a line in `appendRecordingProposalToFlow` to lift it — a
small, additive Core change if the supervisor wants recorded steps to carry
post-conditions.

## Commands run and observed results

`DOMAIN_TEST_BUILD_LABEL=w3-domain-contracts` was set on every package command.
Exit status was captured by redirecting to a file and echoing `$?`, never
through a pipe. No `pnpm build`, no `pnpm lab`.

- `pnpm --filter @fluxiq-web-extension/domain check` — run five times against a
  tree nine other workers were editing.
  - Run 1: **exit 2**, three errors, all in
    `src/recording/web-state/action-target.ts` (`w3-state-identity`'s in-flight
    split). None in my files.
  - Run 2, after all my source and test edits: **exit 0**, no diagnostics.
  - Runs 3 and 4: **exit 2**, fifteen errors, every one in
    `src/recording/tests/web-state.test.ts` — `filterStateElements` had started
    returning `WebAutomationStateElementSelection` and that worker had not yet
    updated its own test.
  - Run 5 (final): **exit 0**, no diagnostics, once that worker caught its test
    up. Output was `> tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json`
    and nothing else, and `grep -c "error TS"` on the log returned `0`.
- `pnpm --filter @fluxiq-web-extension/domain test` — run five times.
  - Run 1: **exit 1**, `# pass 130 # fail 1`. The failure was
    `not ok 66 - an unevaluatable condition is not counted, does not reject, and
    does not throw` in `runtime/expectation/tests/evaluate.test.mjs`
    (`w3-host-runtime`'s file, a message-wording assertion).
  - Runs 2–4: **exit 1**, `# pass 50 # fail 0`, aborted by
    `TypeError: filteredElements.map is not a function` raised from
    `recording/tests/web-state.test.ts` — the runtime face of the same
    `w3-state-identity` change. The suite stops there, which is why the count
    drops from 131 to 50.
  - Run 5 (final): **exit 1**, `# tests 193 / # pass 190 / # fail 3`. All three
    failures are in `runtime/llm-evidence/tests/` — `limits.test.mjs:420` and
    `llm-evidence.test.mjs:629` and `:819` — which is `w3-llm-packet`'s
    in-flight split of `llm-evidence.ts`. No failure names a file I own.
  - **All eleven of my new subtests passed in every run in which they executed**,
    by number in the final run: `ok 25` and `ok 26`
    (`output-nodes/tests/definitions.test.ts`), `ok 37`–`ok 41`
    (`output-nodes/tests/payloads.test.ts`), `ok 47`–`ok 50`
    (`recording/tests/domain.test.ts`). `client/tests/gateway-mapping.test.ts`
    is a bare assertion script and printed
    `Web automation gateway mapping tests passed.` on every run.
- `node scripts/structure-audit.mjs` with a scratch `GIT_INDEX_FILE` (a copy of
  `.git/index` with `domain/src/recording/tests/domain.test.ts` and this report
  added by `git add -N`; the real index was never written) — **exit 1**, two
  violations, plus 27 warnings, none of them naming a file I own:
  - `docs/working/README.md is out of date with the documents' header blocks`
  - `apps/extension/src/runtime/tests/result-mapping.test.ts` imports
    `../../content/evidence` past its barrel — `w3-evidence`'s in-flight work.
    It was absent when I started and appeared partway through, without my
    touching that tree.
  Running the same command against the **unmodified** index at the same moment
  gives byte-identical output (`diff` clean), so both violations exist without
  my files and neither is mine. I did not run `pnpm structure:baseline`.

## Not verified

- **No live browser validation.** The frame chain is proven from the recorded
  event to `action.frameId` by a unit test; whether a command with
  `frameId: 3` actually reaches that frame is `w3-frame-plumbing`'s
  `action-runner.ts` and needs a real cross-frame page. Nothing here was
  exercised in a browser.
- **No extension, test-runner or repository-wide check.** I own no file outside
  `domain/`, and `pnpm check`/`pnpm test`/`pnpm build` are the supervisor's.
- **A fully green domain `test`.** The final `check` is exit 0 with my change in
  place, but `test` still exits 1 on three `w3-llm-packet` subtests. No failure
  names a file I own and my eleven pass, but the suite has never been green
  end to end while I held it, so the supervisor should re-run both once the
  parallel wave lands.
- **The `expectedState` condition shape against `w3-host-runtime`'s evaluator.**
  I wrote the shape the dispatch specified and the assert vocabulary implies;
  the two halves were written concurrently and have not been compiled or run
  against each other. The `selector`-on-a-condition question above is the one
  place they could disagree.
- **Whether turning on `metadata.elementTarget` in `manifest-definitions.ts`
  breaks a live Flow.** Reasoned from Core's `prepareElementTargetAction` and
  `resolveElementTarget` sources, not run. Since nothing populates
  `target.candidates` yet, I expect it to be a no-op today, but that is a
  reading of Core, not a measurement.

## Open questions or contradictions found

- **The brief's one defect is ownership drawn around the wrong file.**
  `domain/src/io/manifest-definitions.ts` is where Core reads output safety and
  output metadata; `output-nodes/definitions.ts` is the authoring registry. The
  brief named the second for a change only the first can carry. This is the same
  shape the wave's binding rules warn about, and it is why that sub-task is
  reported as not done rather than shipped inert.
- **The brief's premise about `gateway-mapping.ts` is wrong in a harmless way.**
  It says "`gateway-mapping.ts` already reads `target.element` and
  `target.fingerprint`". It does not — it reads `target.selector`,
  `target.coordinates` and `target.visualTarget`. The function that reads
  `element` and `fingerprint` off an adapted target is `outputTargetFromPayload`
  in `output-nodes/targets.ts`, and it does so on the way *out*, building the
  command's `target`. The fingerprint does survive adaptation onto the wire;
  what it does not do is survive into `WebAutomationActionCommand`, which has no
  `element` or `fingerprint` field at all. **The content script therefore never
  receives the fingerprint and cannot score candidates against it.** If
  `w3-resolver` is meant to use Core's matcher on the page, someone has to add a
  fingerprint field to `WebAutomationActionCommand` in
  `domain/src/actions/types.ts` and read `target.element` in
  `webAutomationActionFromGatewayCommand`. Neither file's change is in any Wave 3
  brief I can see, and `actions/types.ts` is in no one's Owns.
- **`forms.*` is a per-selector state path holding raw input values, marked
  `sensitive: true`.** `reducers.ts` writes `forms.<selector>` from
  `payload.inputValue` with no sensitivity check of its own. `w3-redaction` is
  removing values at the source, which should empty this, but the path itself is
  a second place a password could land if any producer ever sets `inputValue`
  for a sensitive control. Worth a look when that brief reports.
- **`domain/src/recording/` has no barrel.** Modules import `../recording/web-state`
  directly. The structure audit's "a barrel in every directory" rule does not
  flag it today, but `w3-state-identity` is creating `recording/web-state/`, so
  the directory is about to gain one child that has a barrel and several that do
  not. Worth resolving in one place rather than per worker.
