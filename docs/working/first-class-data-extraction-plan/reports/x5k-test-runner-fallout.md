# x5k-test-runner-fallout

## Outcome

**Done.** All three items are fixed and the acceptance command is green:
`test-runner` is **860 tests, 860 pass, 0 fail, exit 0** (was 859/857/2).

One number differs from the brief, deliberately: the brief predicted 859
passing, and the suite is **860** because I added one test — a recording-lane
control beside the refusal case (item 1). Nothing was skipped or deleted to
reach green.

**The headline finding, which the supervisor should read before anything else:**
the situation `runner-wiring.test.ts:245` tested **can still occur**, but **no
Lab fixture is an example of it any more**. `flowLaneExclusion` still refuses a
script of only `waitForState`, `checkpoint` and `waitForDownload`, and
`run-scenario.ts:738` still calls it — the rule is live contract. What
disappeared is the *fixture*: measured against the built registry, **0 of 46
workflows** across 25 scenarios is a no-action workflow. So I preserved the
coverage by **constructing** the case rather than borrowing one, and the
assertion is stronger than before, not weaker.

## What changed and why

### 1. `run-evaluation/tests/runner-wiring.test.ts` — the refusal case

I first established, rather than assumed, that no fixture could carry this
test. I walked every manifest in the built registry (`apps/scenario-lab/dist/
registry.js` — the same registry the runner loads and `week1-corpus.test.ts`
resolves against) and ran the real `flowLaneExclusion` over every
`recordingScript` found:

```
scenarios: 25
workflows with a recordingScript: 46
no-action, non-empty: 0
empty scripts (playback goals): instruction-only-form
operation frequency: type=27, select=5, click=50, checkpoint=41, waitForState=35,
  navigate=1, scroll=5, extract=19, press=6, check=6, switchTab=1, closeTab=1,
  waitForDownload=1, upload=1
```

The one empty script is a playback goal, which `flowLaneExclusion` deliberately
does **not** exclude (`script.length === 0` returns `undefined`). So there is no
fixture to move the test onto, and W04 is no longer one because X5.1 made its
extract step record a `web.dom.extract_list`.

The test now builds its own scenario registry in a temp directory — a manifest
whose one workflow is a `waitForState` and a `checkpoint` — and loads it through
`FLUXIQ_LAB_SCENARIO_ENTRYPOINT`, the same variable an instanced Lab is built
with (`resolve-lab-paths.ts:47,52`). The run is still a real `runScenario`
through `loadScenarioManifest` → `resolveWorkflow` → `flowLaneExclusion`.
Every original assertion survives unchanged: `ProjectedFacilityError`,
`fixture.invalid`, the message, the exact `facilityFailure`, and an empty runs
directory. The manifest is typed `WebScenario`, so a contract change breaks
compilation rather than silently producing an invalid fixture.

**Two things were added, because the constructed fixture opens a hole the real
one did not have.** A refusal for some *other* fixture defect — an unknown
scenario id, or a manifest I built wrong — would also be `fixture.invalid` and
would have passed the old assertions. So the test now also asserts the
**cause's message**, which must name the Flow-lane exclusion and the operations
it read. And a second test runs the same fixture **without** `--flow`, pinning
the other half of the rule live (the recording lane records it, so it is not
refused) where only the runner's source shape pinned it before.

The stale doc comment ("W04, `product-catalog`'s primary workflow, only reads
the page") is replaced with what is now true, including the fact that no Lab
fixture is an example any more, so the next reader does not go looking for one.

### 2. `run-expectations/recording-event-types.ts` — the mirror row

Added `"data.extract": "web.data.extraction_defined"`, positioned as the domain
orders it (`input-model.ts:70`, between `dom.snapshot` and `action.result`).
Confirmed against both domain sources: `constants.ts:18` declares
`dataExtractionDefined: "web.data.extraction_defined"`.

I also corrected that file's doc comment, which is in my owned path and was
**false in a way that caused this failure**. It claimed "the runner does not
depend on the domain package". See the next section.

### 3. `bench/corpus/week1.ts` — the stale count

The comment said W04's and W08's four Flow-lane entries are planned as skipped,
leaving "63 runnable results per repeat, 23 on the recording lane and 40 on the
Flow lane (21 unarmed, 19 variants)". It now states the measured truth — 67
runnable, 23 recording, 44 flow (23 unarmed, 21 variants), 0 skipped — and says
why it changed. The numbers are not mine: they are the corpus test's own
diagnostic line, quoted under "Commands run" below.

## Does the mirror have to be hand-copied? No.

The brief asked. The answer is that **it could be derived today**, and the
comment claiming otherwise was stale:

- `packages/test-runner/package.json:16` declares
  `"@fluxiq-web-extension/domain": "workspace:*"`, and the `build` script builds
  `domain/dist` on purpose so the runner can resolve it.
- Eight modules already import `@fluxiq-web-extension/domain/node`, including
  `run-evaluation/evidence-budget-invariant.ts` and
  `demo-llm-create-ui/generation-failure.ts`.
- `failure.ts:13-16` states the precedent outright: "The runner can now import
  the domain, through its `./node` export... The evidence allowlist in
  `demo-llm-create-ui/` derives from the domain because of it."
- `webAutomationEventTypeForClientKind` is exported from the domain barrel
  (`index.ts` → `io/web-automation-io.ts:20` → `./input-model`).

The only real obstacle is shape, not access: the domain exposes a **function**,
not a table, so a derived `recordingEventTypesByKind` would still need a list of
kinds from somewhere. That obstacle is smaller than it looks, because **nothing
needs the table**. `recorded-events.ts:45` uses only `recordingEventTypeForKind`,
and the table's only other consumer is the mirror test that compares it to the
domain. So `recordingEventTypeForKind` could simply delegate to
`webAutomationEventTypeForClientKind`, and both the hand-copied table and the
regex-parsing mirror test could be deleted — drift becomes impossible rather
than detected one test run later.

I did **not** make that change: it deletes a barrel export
(`run-expectations/index.ts:8`) and is beyond the brief's three items. It is a
recommendation for the supervisor.

## Commands run and observed results

Run one at a time, never concurrently (the brief says run alone, and this
machine's RAM fault makes parallel heavy gates unreliable).

1. **`pnpm --filter @fluxiq-web-extension/test-runner test`, before any edit** —
   `# tests 859`, `# pass 857`, `# fail 2`, exit 1. Exactly the two the brief
   names, and nothing else:
   `not ok 386 - a Flow-lane run of a workflow whose script records no action is
   refused as fixture.invalid...` and
   `not ok 427 - mirrors the domain's client-kind to recording-event-type
   mapping exactly`.
2. **Registry survey** (scratch script, read-only) — the 25/46/0 result quoted
   above. This is what established that no fixture could host the test.
3. **Live probe of the constructed registry, before editing the test** — I ran
   the real `runScenario` against a temp registry to confirm the approach works
   rather than discovering it inside a test run:
   ```
   --- flow: true ---
   category: fixture.invalid
   message: Scenario attempt failed outside a finalized bundle
   cause.message: A Flow run was refused: the Flow lane builds its Flow from the
     workflow's own recording, and no step of the workflow's recordingScript
     records an action (operations: waitForState, checkpoint), so no recording
     of it can yield a Flow
   facilityFailure: {"boundary":"no-final-bundle","stage":"scenario.load","reason":"unclassified"}
   runsDirectory entries: []
   ```
   The `flow: false` control returned `environment.missing` — which is precisely
   the symptom `x5i` observed on the old W04 run.
4. **`pnpm --filter @fluxiq-web-extension/test-runner build`** — exit 0, no
   diagnostics (run twice: after the first edits, and again after the final
   comment change).
5. **`pnpm --filter @fluxiq-web-extension/test-runner test`, after** —
   `# tests 860`, `# pass 860`, `# fail 0`, **exit 0**. Zero `not ok` lines.
   The three rows that matter:
   `ok 386 - a Flow-lane run of a workflow whose script records no action is
   refused as fixture.invalid...`, `ok 387 - the same workflow is not refused on
   the recording lane, which records it`, and
   `ok 428 - mirrors the domain's client-kind to recording-event-type mapping
   exactly`. The corpus row `ok 136` reports
   `# runnable: 67 (23 recording; 44 flow, 23 unarmed and 21 variants); skipped: 0`,
   which is the source of item 3's numbers.
6. **Sensitivity check — the new test is not green by construction.** The brief
   did not require a mutation, but a constructed fixture is worth distrusting,
   so I re-ran the same manifest with **one `click` step added**:
   ```
   flowLaneExclusion(no-action): "the Flow lane builds its Flow from ..."
   flowLaneExclusion(acting)   : undefined

   flow run, waits and a checkpoint only -> fixture.invalid, bundle created: []
   flow run, the same plus one click     -> environment.missing, bundle created: [".staging-run-..."]
   ```
   One acting step flips the outcome and the bundle. The test is asserting the
   rule, not the fixture I wrote. This touched no repository file.
7. **`pnpm structure:check`** — `1 violation(s) across 1 rule(s)`, exit 1:
   `FAIL [working-docs] docs/working/README.md is out of date`. **Not mine** —
   it is the supervisor's own document, and `x5i` reported the same one. No
   `[file-lines]`, `[exported-values]`, `[class-methods]` or `[directory-files]`
   warning names any file I touched. Final sizes: `runner-wiring.test.ts` 338
   lines, `recording-event-types.ts` 39, `week1.ts` 65 — all under the 400-line
   advisory, so I added no finding.

## Not verified

- **No browser, no Lab server, no Playwright, no bench.** Both new live runs
  stop before any browser, Core or bundle exists. Nothing here is evidence that
  the extension really records an extract node as `web.dom.extract_list`.
- **The 67-result corpus is still a *plan*, not a measured bench.** W04's and
  W08's four restored Flow-lane results have never been executed. Item 3
  corrected a comment to match the planner; it did not measure a run.
- **The mirror test reads the domain's source text with a regex**, not a running
  domain import, so it proves the two files agree today and would not notice a
  domain refactor that moved the mapping out of that function shape.
- **The registry survey used the built `dist`.** If a fixture worker's
  uncommitted manifest edit is not yet compiled, a newly no-action workflow
  would not have appeared. The same dist is what the runner and the corpus test
  read, so the test suite and the survey agree with each other.
- **I ran no other package's suite** — not scenario-lab, extension, domain, nor
  the root `pnpm check` / `test` / `build`. Other workers hold uncommitted work
  in this tree (`git status` shows eleven other modified files under
  `packages/test-runner` alone, from `x5f`/`x5i`), so my runs were against the
  combined tree, not against my changes in isolation.

## Open questions or contradictions found

1. **The mirror should probably be derived, not copied** — the concrete
   recommendation is in its own section above. It is a small change
   (`recordingEventTypeForKind` delegates to the domain; the table and the
   mirror test go away) that removes this class of failure permanently, but it
   deletes a barrel export, so it is the supervisor's call.
2. **The no-action rule now has no fixture exercising it end to end.** The unit
   coverage is restored, but nothing in the corpus or the Lab is a workflow the
   Flow lane refuses, so the bench will never exercise `flowLaneExclusion`'s
   non-`undefined` branch again. That is a deliberate consequence of X5.1, not a
   defect — but if the supervisor wants a fixture-level example back, it needs a
   Lab workflow of only waits and checkpoints, which is a `scenario-lab` change
   I do not own.
3. **`recording-event-types.ts`'s doc comment was false, and that is how the row
   drifted.** It asserted the runner has no domain dependency while the package
   has declared one for some time. I corrected it within my owned file. Worth
   checking whether the same claim survives elsewhere in the runner's comments.
4. **The brief's expected total was 859 passing; the suite is 860.** The extra
   row is the recording-lane control I added. If the supervisor would rather the
   suite match the predicted count, deleting that one test restores 859 without
   touching the refusal case — but it would give back the only live proof that
   the recording lane is *not* refused.
