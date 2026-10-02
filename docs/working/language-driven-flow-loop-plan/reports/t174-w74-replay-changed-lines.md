# t174-w74-replay-changed-lines (F43): report

## Outcome

**Partial. The domain half is done. Status: Ready to commit, with one blocker.** A replayed press, type or choice that worked now answers with
F37's `changed` lines. For example, `{ok, code: "core.replay.replayed", said: "the step ran again", changed: ['t939 "Space Grey" gone', 't941 "Space Grey" no longer marked']}`.

The blocker is in files I may not edit. Four rows in t243's `D/state-digest/tests/**` pin the old capture count for a replay step, and they now fail
(see "Open questions"). The change also does not reach the judge yet. Core's build-test summary drops the observation of every mutate step that
was not checked (`R/result-verification/build-test/summary.ts:137`, `step.effect !== "mutate" || checked`). Core's reader keeps `changed`
(probe below). Sending it to the judge is a one-line Core change, and that change belongs to lane D.

Files ready to commit:
- `domain/src/runtime/llm-evidence/node-run/replay.ts`
- `domain/src/runtime/llm-evidence/node-run/replay-answer.ts`
- `domain/src/runtime/llm-evidence/node-run/press-effect/replay-looks.ts` (new)
- `domain/src/runtime/llm-evidence/node-run/press-effect/index.ts`
- `domain/src/runtime/llm-evidence/node-run/press-effect/page-changes.ts` (header comment only)
- `domain/src/runtime/llm-evidence/node-run/press-effect/tests/replay-changes.test.ts` (new)

## What changed and why

- **`press-effect/replay-looks.ts` (new).** It holds the looks a replayed step is compared from.
  - `webNodeReplayLooks(run)` runs at the start of every replay call: reset, step or verify. It takes out the look that the previous replayed
    step left (`inherited`), so a look is never read twice and never outlives the call after it.
  - `look()` takes one capture, restamped with the stable handles. A capture that fails with `RecoverableToolRejection` (page unreadable, or a
    robot check) returns nothing, and the step's answer is unchanged apart from having no lines. Every other error is thrown again.
  - `leave(look)` keeps the look after this step for the next step. At most 16 builds are kept per runtime.
  - The memory is keyed by the gateway (a `WeakMap`) and by the build (project, flow, session). The other memories a build keeps arrive through
    `WebNodeRun` (`context.ts`, built in `tools.ts`). I own neither file, so this one lives here. See "Open questions".
- **`replay.ts`, `replayStep`.** An in-place step (`effect === "mutate"`, not the navigate node) works like this:
  - Just before its command goes out, it takes `found`: the inherited look if there is one, otherwise one capture.
  - After a success it takes one look (`left`) and leaves it for the next step.
  - It answers `replayed` with `changed: webNodePageChanges(node, found, left)`. That is F37's function with F37's bounds: eight entries plus a
    count line, each about 120 characters, compared by handle on the same location only, using the view's words, so withheld words stay withheld.
  - Navigations, reads, verifies, resets and failed steps take no look after and leave nothing.
  - State digests on replay answers are unchanged: a successful replay still reports none. The new looks are not passed to `run.shown` or
    `run.looked`, so they add nothing to the target packets or the shown addresses.
- **`replay-answer.ts`.** `WebNodeReplayAnswer` gains an optional `changed?: string[]`. `webNodeReplayAnswer` takes it as an optional sixth
  argument. The answer-with-page path writes `changed: undefined`, so the key never appears there.
- **The header comments** of `replay.ts` and `page-changes.ts` no longer say that a replay carries nothing more than one line.

## Measured cost

- **Captures per replayed step.** Shown by the test row "a replayed step takes one look after it…":
  - In-place step after a step that left a look: +1 (after only).
  - In-place step with no look at hand (first after a reset, a navigation, a read, a verify or a failed step): +2.
  - In-place step that fails: +1 (the look before).
  - Navigation, read, verify or reset: +0.
- **Milliseconds** (estimated from run `muqk4u32`; nothing was run live):
  - An exploring call is one capture before, the action, and one capture after. A replay is the action alone.
  - s7 exploring took 2,165 ms (0014); its replay took 903 ms (0065). s11 exploring took 1,327 ms (0025); its replay took 72 ms (0069).
  - So one capture on the crossborder item page costs about 630 ms.
  - Dry run 3 (0059-0070) took 33,197 ms. Under the new rule it takes 11 captures: 4 before and 7 after. That is about 6.9 s, or +21%.
  - Without reusing the inherited look it would take 17 captures, about 10.7 s.
- **Judge request characters.**
  - Today: +0, because Core drops mutate observations (above).
  - If Core keeps them, each step adds its `changed` key:
    - s7 (colour un-chosen): 77 characters
    - s12 ("Please select a Color." appeared): 54 characters
    - a cart change (`t12 "3 Cart" was "0 Cart"`): 43 characters
    - the bound (8 entries of 120 characters plus the count line): 1,017 characters at most
  - Against 0071's 17,191-character request, s7 and s12 together add about 131 characters.

## Commands run and observed results

- **Narrow test runner.** `node <scratchpad>/w74-run-tests.mjs runtime/llm-evidence/node-run/tests runtime/llm-evidence/node-run/press-effect/tests`.
  It is a scratch esbuild bundler, built like `scripts/test-domain.mjs` but limited to these directories, writing to
  `domain/.test-build-scratch/w74-replay/` (gitignored).
  - At HEAD, before any source change: `# tests 164 # pass 164 # fail 0`.
  - With the new test file and HEAD sources: `# pass 17 # fail 5` in press-effect/tests. The failing rows were "a replayed press of the chosen
    colour…", "a replayed Add to cart…", "a replayed step takes one look after it…" (`expected: 2, actual: 0`), "a step that failed leaves no
    look…" (`expected: 2, actual: 0`) and "what changed reaches Core's build-test judge…".
  - One row, "a replayed step that changed nothing, and a replayed navigation, say no changes", passed at HEAD as well. It is a guard against
    over-reporting, not a failing-first row.
  - After the change: `# tests 170 # pass 170 # fail 0`.
- **Domain check.** `bash …/heavy.sh "t174-w74 domain check" pnpm --filter @fluxiq-web-extension/domain check`.
  - The first run failed with TS2375 in my test (`warning: undefined` under `exactOptionalPropertyTypes`). I fixed the test's `Item` type.
  - The second run passed: `{"build-cache":"build","step":"domain:check","reason":"no stamp; stored in the shared store …","ms":49165}`. The
    tree included w71's concurrent edits at that time.
- **Structure audit.** `node scripts/structure-audit.mjs` gave `structure-audit: passed (157 warning(s), 118 baselined).` None of the warnings
  are on my files.
- **Wider sibling tests.** `w74-run-tests.mjs runtime/llm-evidence/state-digest/tests runtime/llm-evidence/tests` gave `# tests 231 # pass 226 # fail 5`:
  - `state-digest/tests/call-route-states.test.ts`: "page captures for one decision (dry-run replay step that ran): still 0…" `expected: 0, actual: 2`;
    "…(dry-run replay step that failed): still 1…" `expected: 1, actual: 2`.
  - `state-digest/tests/call-state-digests.test.ts`: "…(dry-run replay step that ran): 0 digested around the call, 0 digested on it" `expected: 0, actual: 2`;
    "…(dry-run replay step that failed): 1 digested around the call…" `expected: 1, actual: 2`.
  - `tests/capture-after-action.test.ts` "the default wait is ended by cancellation without running out its interval" failed twice when bundled
    with 190 other tests (`expected: true, actual: false`, which is its `< 240 ms` wall-clock assertion). Run alone
    (`node .test-build-scratch/w74-replay/runtime/llm-evidence/tests/capture-after-action.test.mjs`) it gave `# pass 6 # fail 0`. It only
    exercises `captureAfterAction`, which I did not touch. It is a timing flake under load, not this change.
- **Core seam probe.** `node <scratchpad>/w74-core-seam.mts` imports the read-only, built Core `dist/…/build-test/{observation,summary}.js`.
  - Reader: `{"value":{"ok":true,"code":"core.replay.replayed","said":"the step ran again","changed":["t939 \"Space Grey\" gone","t941 \"Space Grey\" no longer marked"]},"withheld":false}`.
    The reader keeps the key and its text whole.
  - Summary, for a kept mutate step with that observation: `[{"step":7,"action":"web.output.dom-click","outcome":"replayed"}]`, with no `observed`.

## Not verified

- No live run or provider call was made, as the brief required. The milliseconds are estimates from the muqk4u32 step timings, not a measurement
  of this code.
- No committed seam test. Core's build-test reader and summary are not in Core's public exports (`fluxiq/automation-studio` does not export
  them), so a domain test cannot import them. The committed row covers the domain's half instead: `changed` is in neither `WEB_LLM_VIEW_KEYS` nor
  `WEB_LLM_DENIED_EVIDENCE_KEYS`, and no entry is locator-shaped. The Core side is shown only by the scratch probe above.
- A change the page makes some time after the press, such as a cart count fetched later, shows up only if it lands before the look after the
  step. This is the same bound F37 has. With a reused look, a late change from step N is reported on step N+1 rather than lost.
- I did not run the full domain suite, `pnpm check`, or `apps/extension` checks.

## Open questions or contradictions found

1. **Contradiction with t243's tests (blocker for a green `domain test`).** `D/state-digest/tests/call-route-states.test.ts` and
   `call-state-digests.test.ts` pin a replay step that ran at 0 captures and one that failed at 1. The brief's change has to add a look after the
   step and, with nothing at hand, one before it, so these become 2 and 2. Those files are on the common rules' do-not-touch list (t243).
   Whoever owns them, t243 or the supervisor, must change the two `DECISIONS` entries:
   - "dry-run replay step that ran": `captures: { old: 2, now: 2 }`. Digests stay `"none"`, because a successful replay still reports no states.
   - "dry-run replay step that failed": `captures: { old: 2, now: 2 }`, digests `"after"`.

   In `call-route-states.test.ts` the matching titles ("still 0" / "still 1") need the same numbers. The other choice is to drop the before-look
   when nothing is at hand, which removes `changed` from the first in-place step after every reset.
2. **Core does not send it to the judge yet.** `summary.ts:137` includes `observed` only for a non-mutate or checked step. For a replayed press
   to reach the judge, the condition must also keep a replayed mutate step's observation, or at least its `changed` key. That file is Core, and
   per the causes table it is lane D's judge context.
3. **Where the look memory lives.** The `WeakMap` keyed by the gateway works, but it is module state. Its natural home is `WebNodeRun`, as
   `arrivals` and `addresses` are: create it in `tools.ts` and declare it in `context.ts`, then pass it to `webNodeReplayLooks`. That is a
   two-file follow-up outside my ownership.
