# Fix F9: targeted scroll with no mode

## Outcome

Done. A `web.dom.scroll` command that names an element (a selector or a recorded fingerprint) and sends no `scroll` request now maps to `{ mode: "toElement" }`, so the extension's verb resolves the target, and a target it cannot find fails the way any other target does. Scrolls with an explicit mode, scrolls whose request was sent but could not be read, and scrolls that name no element all behave as before. The extension needed no change.

## What changed and why

- **Where the fix belongs.** `gateway-action-parameters.ts` `scrollRequestValue()` reads only `parameters.scroll`. It does not know the action type or the command's target (`command.target.selector` or `element`), so it cannot tell a targeted scroll from a positional one. The one place that knows the action type, the target and the lifted parameters is `webAutomationActionFromGatewayCommand` in `domain/src/client/gateway-mapping.ts`, so that is where the fix is wired in. On the extension side, `apps/extension/src/content/actions/scroll.ts` (read only) already runs `toElement` through `deps.resolveTarget`, and with no request it makes the legacy move to `options.x/y`. That move is what caused the false "succeeded": Core writes `x: 0`/`y: 0` defaults on every scroll step.
- **New `domain/src/client/targeted-scroll-request.ts`.** It holds one function, `webAutomationTargetedScrollRequest(actionType, lifted, sent, namesElement)`. It returns `{ mode: "toElement" }` only when all of these hold: the action is `web.dom.scroll`, nothing was lifted, no raw `scroll` parameter was sent, and an element is named. In every other case it returns the lifted value unchanged.
  - **What counts as naming an element.** Only a selector or a fingerprint. Coordinates, or a visual target on its own, are positions, so they keep the legacy move.
  - **Requests that were sent but could not be read** (for example `{until: ...}`) are not reinterpreted. They stay off `action.scroll`, and the verb refuses them from `options.scroll` as before.
- **`domain/src/client/gateway-mapping.ts`.** The selector and element are now computed once, before the return object. `scroll` is set from the new function after `...lifted`. `options` is still the raw parameters, unchanged.
- **New test `domain/src/client/tests/targeted-scroll-request.test.ts`.** It covers:
  - target and no mode, given as a wire selector, a parameter selector, a recorded element, or alongside Core's `x: 0`/`y: 0` defaults;
  - explicit `by`, `untilStable` and `toElement`, with and without a target;
  - an unreadable request beside a target;
  - no target, and coordinates only;
  - a click with a target, which gets no scroll.

  The test was written first and failed before the change (`deepStrictEqual`, `actual: undefined`).

## Commands run and observed results

- Before the change: `DOMAIN_TEST_BUILD_LABEL=f9-scroll node scripts/test-domain.mjs client/tests/targeted-scroll-request` (in `domain/`) failed with ERR_ASSERTION, `actual: undefined`, expected `[Object]`.
- After the change, the same command exited 0.
- `DOMAIN_TEST_BUILD_LABEL=f9-scroll node scripts/test-domain.mjs client/tests/targeted-scroll-request client/tests/gateway-command-parameters client/tests/gateway-mapping`: tests 28, pass 28, fail 0.
- `DOMAIN_TEST_BUILD_LABEL=f9-scroll node scripts/test-domain.mjs src/client/tests` (the whole `client/tests` folder): tests 44, pass 44, fail 0.
- `pnpm --filter @fluxiq-web-extension/domain check`:
  - First run: the Core gate was current, `tsc` ran, and no error was printed.
  - A later rerun was refused by `core-build.mjs`, because Core's `brief-ports.ts` is newer than its dist. The other worker is editing Core. Per the brief, I did not rebuild Core.
- So I ran the two `tsc` passes directly against Core's current dist:
  - `npx tsc -p tsconfig.json --noEmit`: exit 0.
  - `npx tsc -p tsconfig.test.json --noEmit`: exit 0.
- `node scripts/structure-audit.mjs`: "structure-audit: passed (212 warning(s), 638 baselined)". The only warning on a file I touched is the existing advisory file-lines warning on `gateway-mapping.ts`, which went from 557 to 564 lines.

## Not verified

- No live browser run. I did not check end to end that the extension resolves the target and fails honestly when the target is missing. That rests on reading `scroll.ts` `scrollToElement` and `deps.resolveTarget`.
- No extension tests and no whole suites were run.
- The typecheck ran against a Core dist that is behind Core's source, because of the concurrent Core edits.

## Open questions or contradictions found

- The brief named `gateway-action-parameters.ts` as the owner. It cannot own this decision, because it never sees the action type or `command.target`. The change is in `gateway-mapping.ts` plus a new focused module beside it.
- A run whose Flow relied on a targeted scroll with no mode, and which happened to "pass" by jumping to the top, will now resolve the target instead. That is the intended change in behaviour.
