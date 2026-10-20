# Lane S F1: host words for the shared activity headline

## Outcome

Done. The shared activity headline no longer words a wait on the person
itself; each host passes its own words, and the pacer requires them.

| Host | Question (`waiting_permission`) | Check only a person can pass | Pause |
| --- | --- | --- | --- |
| Web extension (unchanged) | Waiting for you: answer in the FluxIQ panel | Waiting for you: finish the check on the page | Paused: your turn on the page |
| Core web panel | Waiting for your answer | Waiting for you: finish the check in your browser | Paused: your turn on the page |

The web panel's answer wording is what it said before the pacer was shared.
Its check sentence is new (it had no check case): the person finishes the check
on the site in their browser, not in the panel. The pause stays shared, since it
reads correctly in both hosts.

## What changed and why

Core (`C:/Users/osrs_/FluxStuff/fxwork/t728/!FluxIQ`):

- `packages/fluxiq/src/ui/activity-status/host-words.ts` (new): type
  `ActivityHostWords = { answer; check }`, exported from the barrel.
- `headline.ts`: `activityHeadline(kind, outcome, words, situation?)`. `words`
  is a required positional argument; the hard-coded `WAITING` table is gone,
  only `PAUSED` stays shared.
- `pacer.ts`: `ActivityPacerOptions.hostWords` is required and threaded through
  `displayFor` / `thoughtDisplayFor`.
- Tests: new fixture `tests/test-host-words.ts` with words that belong to
  neither host, so a passing assertion proves the words came from the input.
  `pacer`, `headline`, `candidate-trial`, `candidate-trial-live` and
  `supervisor-ending` tests now pass it. Two new tests check that each host's
  words appear: one in `headline.test.ts` and one in `pacer.test.ts`, both
  covering the answer and the check, with the extension's words and the panel's.
- `apps/web/.../conversation/activity/host-words.ts` (new):
  `CONVERSATION_ACTIVITY_HOST_WORDS`, exported from the barrel. It is passed by
  `paced-status.ts` and by `steps/messages.ts`, the one other caller of
  `activityHeadline` (which passes "failed" only).
- Web tests: `pacing.test.ts` now expects "Waiting for your answer", and a new
  test covers the check sentence. `paused.test.ts` has a new test that a
  waiting run reads "Waiting for your answer" and never contains "FluxIQ panel".

Downstream (`C:/Users/osrs_/FluxStuff/fxwork/t728/!FluxIQWebExtension`):

- `apps/extension/src/background/activity/host-words.ts` (new):
  `EXTENSION_ACTIVITY_HOST_WORDS` holds today's exact sentences. The barrel
  exports it and re-exports the `ActivityHostWords` type.
- `activity-relay.ts` passes it to `new ActivityPacer` (the only construction
  in the extension; nothing in the extension calls `activityHeadline`).
- `tests/activity-relay.test.ts`: a new test asserts both literal extension
  headlines through the relay.

## Commands run and observed results

- `cd C/packages/fluxiq && npx vitest run src/ui/activity-status`: 15 files, 128 tests passed.
- `pnpm --filter fluxiq check`: no type errors. The build cache said "not
  stamped, because inputs changed while it ran" because other workers were
  editing packages/fluxiq.
- `pnpm --filter fluxiq build`: finished without errors (also not stamped, for
  the same reason). A second build by another worker then cleaned and rebuilt
  dist. I waited for its tsc process to finish and confirmed that
  `dist/ui/activity-status/host-words.js` exists and that `pacer.js` contains
  `hostWords`.
- `cd C/apps/web && npx vitest run src/features/automation-studio/conversation/activity`: 9 files, 57 tests passed.
- `pnpm --filter @fluxiq/web check`: no type errors; the build cache stored the result.
- `cd D/apps/extension && EXTENSION_TEST_BUILD_LABEL=lane-s-f1 node scripts/test-extension.mjs background/activity`:
  the first attempt failed with ERR_MODULE_NOT_FOUND on `fluxiq/dist/ui/index.js`,
  because the other worker's build had cleaned dist. After that build finished:
  46 tests, 46 passed, 0 failed, including "a wait is headed in the extension's own words...".
- `pnpm --filter @fluxiq-web-extension/extension check`: core-build reported
  "Core's build ... is current with its source", and extension:check stored its result.
- `node scripts/structure-audit.mjs` in C: passed (417 warnings, 1152
  baselined). In D: passed (208 warnings, 625 baselined). `pacer.ts` is 439
  lines (it was 436), which is only an advisory warning.

## Not verified

- No live browser check of either the extension overlay or the web panel.
- Full suites were not run, as the narrow-check policy requires.

## Open questions or contradictions found

- The panel's check sentence ("finish the check in your browser") is my
  choice. The supervisor may prefer different words.
- Extension display fixtures in `content/activity-overlay` and `panel/chat`
  tests still quote the extension's literal sentences. That is correct, since
  the extension's wording is unchanged, so I left them alone.
