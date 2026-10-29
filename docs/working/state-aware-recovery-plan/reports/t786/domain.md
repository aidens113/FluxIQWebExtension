# t786-domain report: matching a stale web target again by identity

Worker: t786-domain (worker-heavy). Tree: `C:/Users/osrs_/FluxStuff/fxwork/t786/!FluxIQWebExtension`, branch `task/t786-stale-target-reacquire`. No commits, no model calls, no Lab runs. Core was not edited.

## Outcome

**Done.** The web domain now matches a stale row or control by its identity. Both host methods are wired, and the build's exploration and replay paths each supply a `reacquire` callback. All of it is covered by new unit tests, which pass. Both domain typechecks and the structure audit pass.

Caveat: Core's compiled `dist` in the paired tree is **stale against Core's source**. The Core worker's retry loop, which now calls `reacquire`, exists in Core `src` but not yet in `dist`, and the domain compiles and tests against `dist`. So none of these tests ran through Core's real retry loop. The callbacks are tested directly, as the brief allowed. I checked by reading Core's landed `src` that its call signature matches what the domain supplies.

## What changed and why

### New: `domain/src/runtime/target-reacquire/` (pure matchers and host methods)

| File | Export | What it does |
| --- | --- | --- |
| `text.ts` | `webReacquireText` | Normalises text for comparison: whitespace collapsed, trimmed, lower case. |
| `volatile-text.ts` | `webReacquireVolatileText` | True when the whole value is only a number, count, price or time ("13 likes", "$1,299.00", "6 min ago", "Oct 28, 2026", "2d 4h left"). Also true for a value made of several such parts joined by `·•|;,`. Has its own patterns: Core's `readAutomationStudioRecordNumber` would read "iPhone 15" as 15. |
| `row-key-columns.ts` | `webReacquireRowKeyColumns(parameters, stale)` | **Declared identity:** the read's `dedupe.by`, from `extractList.dedupe`, the top-level `dedupe`, or `recordOutput.process.dedupe`. A recorded action's `{outputId, parameters}` wrapper is unwrapped. Volatile columns are dropped, and a dedupe over every column means "whole row" and declares nothing. **Otherwise:** columns named id, url, uri, href, link, permalink, slug, sku, asin or key (snake or camel case), or holding a link. Image, thumb, avatar, icon and similar columns are excluded. |
| `row-match.ts` | `webReacquireRow({stale, candidates, keyColumns})` | **Keyed:** compares `automationStudioRecordRowIdentity` over the key columns. **Unkeyed:** every word column (in either row) must be equal; volatile columns may differ. Answers: one match `found` (that candidate); none `gone`; several `unmatched/ambiguous`; a stale row with fewer than 2 identifying values (key or word values, `WEB_ELEMENT_IDENTITY_MINIMUM_SIGNALS`) `unmatched/unidentifiable`. |
| `element-match.ts` | `webReacquireElement({stale, candidates})` | Compares the signals from `webElementIdentitySignals`: kind fields, wordings, id, testId, name, drawing, and the classNames set. A candidate matches when every signal both carry agrees and at least 2 agree. Selector, xpath, positions and handles are never compared. Words are skipped when `readsWords` is set. If several match, exactly one whose `context.record.text` equals the stale one wins; otherwise `ambiguous`. That record check never produces `gone`. A candidate is a fingerprint or `{ element: fingerprint, ... }`, and the candidate is answered as given. |
| `reacquire-target.ts` | `webAutomationReacquireTarget(request)` | The host `reacquireTarget`. `row` lineage uses the row matcher with the source's key columns. `output` lineage uses the element matcher when the stale value names a control, the row matcher when it is a plain record, and `unidentifiable` for a scalar. |
| `source-places.ts` | `createWebSourcePlaces`, `WebSourcePlaces` | Remembers each attempt's `from.location` from the host's own captures, for the last 64 attempts. `before_action` wins; later points only fill an attempt that has none. |
| `return-to-source-place.ts` | `webAutomationReturnToSourcePlace`, `WebSourcePlaceDispatch` | **Nothing recorded:** `same_place`. **Recorded:** reads the current URL with a snapshot; if the page can't be read, `unavailable`. Same location: `same_place`. Different: navigates with `web.browser.navigate {url}` and answers `returned`, or `unavailable` if the move fails. |
| `index.ts` | barrel | |

### Wiring

**`domain/src/runtime/host-runtime.ts`**
- Adds `reacquireTarget` and `returnToSourcePlace` to the boundary.
- `captureStateSnapshot` now records each attempt's location, on both the fresh path and the t480 reuse path (`ended.from`).
- The header gains a paragraph about this.

**`node-run/retries/reacquire.ts` (new)**
- Types `WebNodeReacquire` and `WebNodeReacquired`, plus `webNodeRetryReacquire`, which converts the domain answer into Core's `AutomationStudioNodeRetryReacquire`.
- `found`: dispatches the same command with the found parameters, and each answer is pushed onto `answers`.
- `gone`: a synthesized failed result with Core's `AUTOMATION_STUDIO_TARGET_GONE_CODE` (`category target_not_found`, `retryable false`, `stage target_resolution`, `effect unacted`). It deliberately does not use the page's not-found, which `replay.ts` would read as "remembered" and pass.
- A finder that throws answers `unavailable`.

**`node-run/retries/dispatch.ts`**
- `webNodeDispatchWithRetries` takes an optional 6th argument, `reacquire?: WebNodeReacquire`, and passes it to Core.
- `WebNodeRetriedDispatch` gains `reacquire?`, the outcome as Core reports it.

**`node-run/retries/replayed-reads.ts` (new)**
- `webNodeReplayedReads(run)` remembers each replayed list read: its command, the parameters to read its rows back with, and the rows.
- Kept per build slot and session, in a `WeakMap` keyed on the long-lived `run.stores.extractions`: 4 reads per build, 16 builds.
- `sourceOf(row)` finds the read whose rows hold that exact row.
- Why this exists: a replay pass call carries only `item`, never the read it came from.

**`node-run/retries/replay-row-reacquire.ts` (new)**
- `webNodeReplayRowReacquire(run, {item, parameters, metadata, readRows})` re-sends the source read once, with no retries.
- It matches the row and re-scopes with `webAutomationScopedToRow(parameters, freshRow)`.
- No source, a failed re-read or an empty answer: `unavailable`.

**`node-run/retries/looked-up-reacquire.ts` (new)**
- `webNodeLookedUpReacquire(run, {definitionId, handle, parameters, look})` looks again with `webNodeLookUntilPresent` until a look is not `gone`.
- It builds candidates from the fresh packet in the step's own frame, using `webPacketElementFingerprint` with the binding's selector, shadow hosts, dialog and drawing.
- On a match it returns the parameters with the fresh `selector` and `element`, keeping `readsWords`.
- The fresh look is passed to `run.looked`.
- `look` is injected by `run.ts`, so this file closes no import cycle. A throwing look propagates and becomes `unavailable`.
- No handle, no `element`, or a `$state` target: no finder.

**`node-run/replay.ts`**
- The step dispatch passes `webNodeReplayRowReacquire(...)`.
- A successful `extract_list` replay remembers its command and rows.

**`node-run/run.ts`**
- The main dispatch passes `webNodeLookedUpReacquire(..., look: () => readablePage(run, run.request))`.
- This changes three lines and adds none, so the file stays at the 800-line hard limit.

**`retries/index.ts`**: exports the new functions.

**`docs/architecture/element-identity.md`**: new section "Finding a stale target again (t786)".

### Decisions and judgement calls

1. **Identity floor for rows.** I counted key values and word values together. A literal "fewer than two key values" floor would make a single declared key, such as a URL, unusable.
2. **Key columns decide outright.** When a row has key columns, word columns are not also compared, as D4 orders it. One consequence: a link column whose URL changes on every render, such as a tracking parameter, reads as `gone`.
3. **No fuzzy rescue for toggled words.** A toggled word label ("Like" becoming "Liked") is a word column, so it differs. A class set that changes with state does the same for a control. Both go to `gone`, per the "exact, never fuzzy" rule.
4. **Record words only break ties.** They narrow several element matches to one but never produce `gone`, because card words often contain counts.
5. **`returnToSourcePlace` is `unavailable` when the current page can't be read.** A page that can't be read can't be re-read either.
6. **What `gone` shows in the build's runs.** In node-run, a gone item becomes a failed result whose refusal word is the generic `action_failed`, because `executor.target.gone` is not in the domain's refusal map. Replay reports it as "the step did not run (action_failed)". I did not add new words, since trial-feedback words were off limits.

## Commands run and observed results

All commands ran in `C:/Users/osrs_/FluxStuff/fxwork/t786/!FluxIQWebExtension`.

- **Tests, labelled run:**
  ```
  DOMAIN_TEST_BUILD_LABEL=t786-domain node scripts/test-domain.mjs node-run/tests/ runtime/target-reacquire/tests node-run/retries/tests runtime/tests/host-runtime
  ```
  Run from `domain/`, final tree: exit 0, `# tests 362`, `# pass 362`, `# fail 0`.
  - An earlier run of only the new and retries directories gave `# tests 97 / # pass 97 / # fail 0`.
  - The new tests are all among the `ok` lines: renumbered control found; redrawn row found and re-scoped; another author `gone`; one word apart `gone`; twins `ambiguous`; too little `unidentifiable`; declared and link keys; volatile values; host wiring, same place, returned and unavailable; gone and unavailable conversion.
- **Typechecks:** `npx tsc -p tsconfig.json --noEmit` and `npx tsc -p tsconfig.test.json --noEmit`, both in `domain/`, final tree: no output (clean).
  - An earlier run caught a `JsonValue[]` vs `JsonObject[]` error in `replay.ts`, which I fixed.
  - I did not use `pnpm --filter ... domain check`, because its `core-build` gate now reports Core's dist as stale (see below).
- **Structure audit:** `node scripts/structure-audit.mjs` from the repo root, final run: `structure-audit: passed (232 warning(s), 616 baselined).`
  - The first run failed on `import-cycles` (through `capture` in `looked-up-reacquire.ts`, which also pushed `replay.ts` past its baseline of 5) and on `failure-as-empty` (two try/catches).
  - The second run failed on `statement-packing` in the test.
  - All of these were fixed.
- **Core build gate:** `node scripts/check/core-build.mjs`.
  - At the start: "current with its source".
  - At the end: "Stale: Core's build cache would rebuild fluxiq:build: inputs changed: packages/fluxiq". The Core worker's source edits had not been rebuilt, and `grep askReacquire dist/.../outside-graph/retries.js` found 0 matches.

## Not verified

- No test ran through Core's real `automationStudioDispatchWithNodeRetries` calling the callbacks; Core's dist predates that code. I did not rebuild Core because Core is read-only for me and another worker is editing it.
  - After the Core rebuild, re-run the same labelled test command and `pnpm --filter @fluxiq-web-extension/domain check`.
  - Also worth adding: an end-to-end exploration or replay test that fails a press three times with `web.target.not_found` and then expects attempt 4 on the fresh target.
- Not checked:
  - **Graph-run playback:** Core calling `reacquireTarget` and `returnToSourcePlace` on the host.
  - **Live pages:** no browser, no Lab run, and whether the real extension's packet fields for re-rendered cards produce agreeing signals.
  - **Full suites:** not run, per the twice-a-day rule.
- `webNodeRetriedAnswer` may prefer an earlier "refused for now" answer over the synthesized gone result. I left that existing behaviour alone and did not test it.

## Open questions or contradictions found

1. **The replay call doesn't name its source read.** It carries only `item`, so the domain guesses the source by remembering replayed reads and matching the exact row. If Core added the source read's call to the pass call, that memory could go.
2. **Gone has no words of its own in node-run.** It shows the model `action_failed`. A dedicated refusal reason would need a change to trial-feedback or refusal words, which was outside this brief.
3. **The domain `check` script is blocked.** Its gate fails until Core's dist is rebuilt; whoever integrates must rebuild Core first.

## Return contract

```text
Outcome: Done
Changed: domain/src/runtime/target-reacquire/{text,volatile-text,row-key-columns,row-match,element-match,reacquire-target,source-places,return-to-source-place,index}.ts + tests/{row-match,element-match}.test.ts; domain/src/runtime/host-runtime.ts; domain/src/runtime/tests/host-runtime-reacquire.test.ts; domain/src/runtime/llm-evidence/node-run/retries/{reacquire,replayed-reads,replay-row-reacquire,looked-up-reacquire}.ts (new), retries/{dispatch,index}.ts, retries/tests/reacquire.test.ts; node-run/replay.ts; node-run/run.ts; docs/architecture/element-identity.md
Validation: `DOMAIN_TEST_BUILD_LABEL=t786-domain node scripts/test-domain.mjs node-run/tests/ runtime/target-reacquire/tests node-run/retries/tests runtime/tests/host-runtime` -> 362 pass, 0 fail; both domain tsc -> clean; `node scripts/structure-audit.mjs` -> passed (232 warnings, 616 baselined)
Not verified: callbacks through Core's real retry loop (Core dist stale vs src, not rebuilt); graph-run host calls; live browser
Report: docs/working/state-aware-recovery-plan/reports/t786/domain.md
Notes: Core dist must be rebuilt before `pnpm --filter domain check` passes its core-build gate. Replay finds the source read through a per-build memory of replayed reads (the pass call carries only `item`). Gone surfaces as `action_failed` in node-run (no new words added).
```
