# w1-recorder-hygiene report

Worker `w1-recorder-hygiene`, Wave 1 Batch A, Phase 1.1 step 3.

## Outcome

Done. Both brief items are implemented in the two owned files, and nothing
else was edited by hand. `check`, `build` and `test` pass. The structure
audit output is byte-identical before and after. `test:e2e` ran three times
and was never fully green. The failures come from the environment and do
not touch the changed code: the headless-shell browser cannot launch on this
machine, and Playwright worker processes crashed natively. See below. The
spec that drives content actions, `action.spec.ts`, passed every time it
ran.

## What changed and why

### 1. `apps/extension/src/content/dom-events.ts`

- The `input` and `change` listeners now `return` when `!event.isTrusted`.
  The check sits right after the recording check and before
  `rememberEventPathElements`, the same position the pointerdown, click,
  keydown and wheel listeners use.
- Why: replay's `dispatchInputEvents`
  (`content/action-runtime.ts:142-145`) fires an untrusted `input` and
  `change` after `web.dom.type`, `web.dom.clear` and `web.dom.select`. The
  recorder recorded them as a fresh user `dom.input` or `dom.change`, on top
  of the background runtime confirmation (audit-recording Finding 4).
- Returning before `rememberEventPathElements` also means a replayed field
  is not marked as user-observed, matching the click path.
- The header comment now names which paths guard and why. `submit` and
  `scroll` stay unguarded, as the brief asked only for input and change.

### 2. `apps/extension/src/background/connection/runtime-status.ts`

- `runtimeConfirmationForActionResult` now spreads `confirmedValue(result)`
  into the `web.dom.type` confirmation (`dom.input`, `textEntered`) and the
  `web.dom.select` confirmation (`dom.change`, `optionSelected`). All other
  branches are unchanged; `web.dom.clear` still carries `""`.
- **Where the value comes from:** `result.element.value`. That is the
  descriptor the content script builds with `describeElement` after the
  action ran (`content/actions.ts:67`, `:81`). `describeElement` sets
  `value` only while `captureSettings.inputValues` is on
  (`content/describe-element.ts:40-41`). So the confirmation follows the
  recording's input-value setting, as the recorder's own events do.
  `selectedValue` is deliberately not used as a fallback, because the
  content script emits it whatever the capture setting is.
- **Why not the command's `text` or `value`:** the function receives only
  the result, and its only caller, `background/connection.ts:650`, is
  outside my ownership. The field's value after the action is also what the
  recorder would capture from a user.
- **Redaction rule applied:** `isSensitiveFormControl`, defined in
  `apps/extension/src/content/element-traits.ts:108-113`. A field is
  sensitive when any of these hold:
  - its input type is `password`;
  - its `autocomplete`, lowercased, is `current-password`, `new-password` or
    `one-time-code`, or starts with `cc-`;
  - it has `data-sensitive="true"`.
- **How it works in the worker:** the worker only has the wire descriptor,
  not the element. So the same rule is written over `DomElementDescriptor`
  in a private `isSensitiveElementDescriptor`. It reads `inputType`,
  `attributes.autocomplete` and `attributes["data-sensitive"]`, all of which
  `describeElement` captures (`describe-element.ts:48`, `:60`).
- **When redacted:** the `inputValue` key is left out entirely rather than
  set to `undefined`, because `exactOptionalPropertyTypes` is on.
- **Downstream effect:** for non-sensitive fields,
  `webAutomationOutputPayload` (`domain/src/output-nodes/payloads.ts:16-17`)
  now gets the text or value instead of falling back to `""`
  (audit-recording Finding 5).

## Commands run and observed results

**Type check.** `pnpm --filter @fluxiq-web-extension/extension check` ran
`tsc -p tsconfig.json --noEmit`: exit 0, no diagnostics.

**Build.** `pnpm --filter @fluxiq-web-extension/extension build`: exit 0
(`build\content\index.js 47.3kb`, …). This regenerated the tracked
`apps/extension/build/background/index.js(.map)` and
`apps/extension/build/content/index.js(.map)` through the owning script, so
they show as modified in `git status`. Other workers' builds also write
there.

**Smoke test.** `pnpm --filter @fluxiq-web-extension/extension test`:
`Extension smoke test passed.`, exit 0.

**Structure audit.** `node scripts/structure-audit.mjs`, before and after
the edits: both printed
`structure-audit: passed (27 warning(s), 19 baselined).` A `diff` of the two
full outputs is empty. No line names either file, and there is no "can be
lowered" line.

**E2E.** `pnpm --filter @fluxiq-web-extension/extension test:e2e`: the
extension specs run in headed Chromium; `network-policy:16` uses Playwright's
default headless shell.

- **Run 1: `1 failed` / `7 passed (10.6s)`.**
  - Failed: `e2e\network-policy.spec.ts:16:1 › aborts and records a real
    browser request to an unexpected destination`, with
    `Error: browserType.launch: Target page, context or browser has been
    closed` while launching
    `ms-playwright\chromium_headless_shell-1161\chrome-win\headless_shell.exe`.
  - Passed: `action.spec.ts:4`, both `install-and-content` specs, both
    `resilience-and-isolation` specs, and both pure network-policy specs.
- **Run 2, the one rerun the brief allows:** the command died with
  `ELIFECYCLE Command failed with exit code 3221225477` (0xC0000005, a native
  access violation). My grep filter discarded the rest of the output, so I
  cannot say which step crashed.
- **Run 3, full output captured: `3 failed` / `5 passed (3.3s)`, 6 workers.**
  - `install-and-content.spec.ts:4` and `resilience-and-isolation.spec.ts:4`
    failed with
    `Error: worker process exited unexpectedly (code=3221225477, signal=null)`.
    Both had passed in run 1.
  - `network-policy.spec.ts:16` failed with the same headless-shell launch
    error as run 1.
  - Passed: `action.spec.ts:4`, which drives `web.dom.type`, `web.dom.click`
    and `web.dom.capture_snapshot` through the real content-script path;
    `install-and-content.spec.ts:17`; `resilience-and-isolation.spec.ts:12`;
    and the two pure network-policy specs.
- **Why I attribute these failures to the environment:**
  - A bare `chromium.launch({ headless: true })` probe with no test code
    fails with the identical error:
    `headless probe: FAILED: browserType.launch: Target page, context or
    browser has been closed`. The probe is
    `C:\Users\mrjoh\AppData\Local\Temp\claude\f---FluxIQWebExtension\2677150e-fabf-4de7-a29b-ed7919f99ef7\scratchpad\w1-recorder-hygiene-headless-probe.mjs`.
  - `network-policy.spec.ts:16` loads no extension code.
  - The worker crashes are native access violations that hit different specs
    in different runs, while other workers were active in the tree (new
    untracked `packages/test-contracts/src/*.ts` appeared during my run).

**Scratch harness A: redaction.** File:
`C:\Users\mrjoh\AppData\Local\Temp\claude\f---FluxIQWebExtension\2677150e-fabf-4de7-a29b-ed7919f99ef7\scratchpad\w1-recorder-hygiene-confirmation-harness.mjs`.
It bundles the real `runtime-status.ts` with esbuild, together with the real
domain `WEB_AUTOMATION_INPUT_IDS`, and calls
`runtimeConfirmationForActionResult` on 22 results. Result: `22/22 passed`.

| Case | Result |
| --- | --- |
| type, plain text field | `inputValue: "hello"` |
| type, `password` (also `PASSWORD`) | no `inputValue` key |
| type, `autocomplete` `current-password`, `New-Password`, `one-time-code`, `cc-number` | no `inputValue` key |
| type, `data-sensitive=true` | no `inputValue` key |
| type, `data-sensitive=false` with `autocomplete=email` | value kept |
| type, empty value | kept as `""` |
| type, capture off, or no element | no `inputValue` key |
| select, plain | `inputValue: "b"` |
| select, `data-sensitive=true`, or `autocomplete=cc-exp-month` | no `inputValue` key |
| select, only `selectedValue` present (capture off) | no `inputValue` key |
| clear, click, navigate, keypress, scroll | unchanged |
| extract | `undefined` |

**Scratch harness B: the trusted-event guard.** File:
`C:\Users\mrjoh\AppData\Local\Temp\claude\f---FluxIQWebExtension\2677150e-fabf-4de7-a29b-ed7919f99ef7\scratchpad\w1-recorder-hygiene-trusted-harness.mjs`.
It bundles the real `recorder.ts` and `dom-events.ts` into a headed Chromium
page with `chrome.runtime.sendMessage` stubbed, and counts the `dom.input`
and `dom.change` messages. The replay steps fire the exact event pair
`dispatchInputEvents` fires. It runs once with the `HEAD` copy of
`dom-events.ts`, injected by an esbuild onLoad plugin so the repository is
untouched, and once with the working copy:

```text
== dom-events.ts @ HEAD
  replayed web.dom.type (untrusted input+change on text): 1 -> dom.input("replayed")
  replayed web.dom.select (untrusted input+change on select): 1 -> dom.change("b")
  user typing via keyboard (trusted): 1 -> dom.input("typed")
  user select via ArrowDown (trusted): 1 -> dom.change("c")
  Playwright selectOption: 1 -> dom.change("a")
== dom-events.ts @ working
  replayed web.dom.type (untrusted input+change on text): 0 -> (none)
  replayed web.dom.select (untrusted input+change on select): 0 -> (none)
  user typing via keyboard (trusted): 1 -> dom.input("typed")
  user select via ArrowDown (trusted): 1 -> dom.change("c")
  Playwright selectOption: 0 -> (none)
```

The first headed run had a harness bug: `page.evaluate` received the
argument array as one parameter, so the values read `"undefined"`. I fixed
it and reran. The counts were the same in both runs.

## Not verified

- **Through the background and the gateway.** I did not check that a
  replayed action during recording now produces exactly one event on the
  gateway stream. Nor did I check that the confirmation's `inputValue` comes
  out of `webAutomationOutputPayload` as `text` or `value`. Both need a
  paired recording session. The supervisor's content-harness specs are meant
  to cover this.
- **Real descriptors in harness A.** Harness A uses descriptors I wrote by
  hand, not ones `describeElement` produced from real password or card
  fields.
- **Firefox.** I did not test the Firefox build.
- **A fully green `test:e2e` run.** See above.

## Open questions or contradictions found

1. **The brief assumes a recorder redaction that does not exist for
   values.** The brief says "the same sensitive-field redaction the recorder
   applies". But the recorder's own `inputValue` carries a password field's
   value whenever `captureSettings.inputValues` is on, which is the default.
   - This happens on `dom.input` (`content/recorder.ts:83`, `:104`, through
     `readElementValue`) and on `dom.change` (`content/dom-events.ts:99`).
   - `describeElement`'s `descriptor.value` (`describe-element.ts:40-41`)
     carries it too.
   - `isSensitiveFormControl` is applied only to `hasValue` and
     `selectedValue`.
   - The header of `describe-element.ts` says "Sensitive values are filtered
     here, not by the caller". The code does not do that for `value`.

   So the confirmation is now stricter than the recorder. I applied the rule
   the recorder *defines*.
2. **The same confirmation event still carries the secret elsewhere.**
   `sendRuntimeActionConfirmation` (`background/connection.ts:648`) also
   sends `element: result.element` and `result.snapshot`. For a password
   field, `element.value` holds the typed secret, per item 1. Fixing that
   needs `describe-element.ts` or `connection.ts`, both outside my
   ownership. I recommend redacting at the source in `describeElement` and
   in the `readElementValue` call sites in `recorder.ts` and
   `dom-events.ts`. That would also make the worker-side check a second line
   of defence rather than the only one.
3. **The sensitivity rule now exists in four copies.**
   - `content/element-traits.ts:108` works on a DOM element.
   - `background/connection/runtime-status.ts` works on the descriptor; it
     is new in this change.
   - `domain/src/runtime/llm-evidence.ts:454` works on the descriptor.
   - `domain/src/runtime/reusable-evidence.ts:198` works on the descriptor.
     Its line 200 also lists `hidden`, `file` and `credit-card`; I did not
     read the rest of it.

   One exported, DOM-free descriptor predicate in `domain` could serve all
   of them. Separately, the rule compares the whole `autocomplete` string,
   so a multi-token value such as `billing cc-number` is not treated as
   sensitive.
4. **Trade-off of the trusted-event guard.** Harness B shows that
   Playwright's `selectOption` dispatches untrusted events. Regression specs
   must therefore choose options with the keyboard or mouse, or they will
   see no `dom.change`. Likewise, when a custom widget sets a hidden native
   `<select>` or input and dispatches a synthetic `change` or `input`, that
   change is no longer recorded; only the user's trusted clicks are. This
   matches the click path's policy, as the brief asked. I flag it only
   because it may matter on real sites.
5. **A redacted `type` confirmation replays as an empty string.** Its `text`
   still falls back to `""` (`payloads.ts:16`), so replaying it types an
   empty string into the sensitive field. A secret or parameter binding
   would be needed; that is out of scope.
6. **This machine cannot run `network-policy.spec.ts:16`.** Playwright's
   `chromium_headless_shell-1161` fails to launch here, so that spec cannot
   pass until the headless shell is fixed or the project is configured to
   use the full Chromium channel.
