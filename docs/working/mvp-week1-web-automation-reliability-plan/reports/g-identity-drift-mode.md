# Report: g-identity-drift-mode

## Outcome

**Done, against the amended brief.** The first attempt stopped Blocked: a new
variant broke `apps/scenario-lab/e2e/identity-drift.spec.ts`, which the brief did
not own and no named gate ran. The amended brief owns that spec, and `state.ts`
and `save-action.ts` by name.

The identity-drift fixture now has a seventh mode, `save-and-exit`. It reproduces
row R7 of `reports/i-resolver-safety.md`:
- Save is gone, and Discard with it.
- Save's slot holds a lone `<button>Save changes and exit</button>` with no
  `type`, id, class or test id.
- Pressing it records its own fixture operation, never a save.

Its variant expects `failure.category: "target_not_found"`. The recording stays
on the authored baseline. Every gate passed: scenario-lab `check` and `test`, the
identity-drift Playwright spec, and the structure audit. Both guards are
mutation-proven, and both mutated files were restored byte-identical.

## What changed and why

Every file is under `apps/scenario-lab/src/scenarios/identity-drift/` except the
spec.

| File | Change |
| --- | --- |
| `modes.ts` | `"save-and-exit"` appended to `identityDriftModes`. The header says it is the negative case, not a drift of Save, and cites R7's 0.359 at confidence 0.337 as a single observation. |
| `save-action.ts` | `case "save-and-exit": return "<button>Save changes and exit</button>";`. This is R7's markup exactly. The comment explains why no `type`, class or `data-*` hook may be added: any of them changes the fingerprint that row was measured on. |
| `render.ts` | Discard is now a module constant, left out in `save-and-exit` mode, so the wrong action stands alone, as R7 has it. The submit handler posts `mutate('${submitOperation}', …)`, which is `save-and-exit` in that mode and `save` everywhere else. Routing by mode avoids relying on `event.submitter`. Every other mode renders the same markup and the same `mutate('save', …)` script as before (read from the diff; see Not verified). |
| `state.ts` | Adds `saveAndExitCount` (seeded 0, reset by `set-mode`) and `lastOperation: "saved-and-exited"`. The `save-and-exit` operation validates the name exactly as `save` does. It sets the status `Saved and exited: <name>` and never touches `savedDisplayName`, `saveCount` or `savedInMode`, so Save's oracle cannot pass through it. |
| `manifest.ts` | `driftVariant` now excludes `save-and-exit`. The new `wrongActionVariant` is listed last, following failure-surfaces' `detached`. Its `pageFacts` are: form visible, `save-changes` absent, `discard-changes` absent. Its `actions` are a type that succeeded and a click that failed. Its `finalState` is `nothing-saved`: `save-status` text `""`. Its failure is `{ category: "target_not_found", code: "web.target.not_found" }`. |
| `tests/scenario.test.ts` | The variant-list test now covers every armed mode, while the "Save must succeed" assertions keep to the five drifts. The deep-equal state checks gain `saveAndExitCount`. The one-submit-control check now counts buttons that submit the form, since R7's button has no `type`. Three new tests: (1) the variant's refusal is declared, and a pressed status satisfies neither its fact nor Save's oracle; (2) the state keeps `save-and-exit` apart from Save, including invalid payloads and a save followed by a press; (3) the mode renders R7 alone in the slot, with no button in the footer, no `save-changes` or `discard-changes`, and its own `mutate` operation. |
| `e2e/identity-drift.spec.ts` | `DriftCase` gains an optional `refusal?: ExpectedFailure`. The `Record` at `:19` now requires a `save-and-exit` case: the control is found by its own name, has no attributes, sits in the recorded box's x/y, and is the only button, with none in the footer. The coverage test is unchanged. The loop compares `expected.failure` against the case's `refusal`, which stays undefined for every drift, as before. For the negative case it checks the variant's own `pageFacts` (not the resolved merge, per `scenario-workflow.ts`) and the declared final state on the armed page. It then presses the control and expects `Saved and exited: …`, `saveCount 0`, `savedInMode null` and `saveAndExitCount 1`. Drift cases additionally assert `saveAndExitCount 0`. `expectFacts` learned `exists`. |

**The corpus row, for the supervisor to add after `g-bench-coverage` lands**, in
`packages/test-runner/src/bench/corpus/week1.ts`, appended after W28:

```ts
    variantOnly("W29", "identity-drift", null, ["save-and-exit"]),
```

Companion changes the row needs in the same commit:
- `packages/test-runner/src/bench/tests/week1-corpus.test.ts:43`: 28 rows becomes
  29 (`Array.from({ length: 29 }, …)`), and the test title's "W01 to W28".
- The same file's `PLAN_NEGATIVE_VARIANTS` (`:23-27`) gains
  `"W29 identity-drift/primary/save-and-exit": "target_not_found",`.
- `week1.ts:7` (header) and `:23` (`description`): "W01 to W28" becomes
  "W01 to W29".
- A W29 row in the plan's "FluxBench Week 1 Corpus" table: identity-drift,
  variant `save-and-exit`, negative, `target_not_found`.

`variantOnly` keeps it off the recording lane's unarmed runs, like W19-W23.

## Commands run and observed results

The label was `EXTENSION_TEST_BUILD_LABEL=g-identity-drift-mode`. No domain tests
ran. Heavy gates ran one at a time. Output files are in the scratchpad, prefixed
`gidm-`.

| Command | Exit | Observed |
| --- | --- | --- |
| `pnpm --filter @fluxiq-web-extension/scenario-lab check` | 0 | `tsc -p tsconfig.json --noEmit`, no diagnostics |
| `pnpm --filter @fluxiq-web-extension/scenario-lab test` | 0 | `# tests 202 / # pass 202 / # fail 0`, including `ok 78` (declared a refusal), `ok 81` (recorded apart from Save) and `ok 85` (renders row R7) |
| `pnpm exec playwright test -c e2e/playwright.config.ts identity-drift.spec.ts` (from `apps/scenario-lab`) | 0 | `9 passed (4.7s)`, including `ok 4 … every manifest variant has a drift case in this spec` and `ok 9 … save-and-exit variant: a different action stands in Save's slot, and pressing it saves nothing (697ms)` |
| `node scripts/structure-audit.mjs` | 0 | `structure-audit: passed (34 warning(s), 17 baselined).` File limits are 800 lines (fail) and 400 (warn), and every touched file is far below them. No new files, so no scratch `GIT_INDEX_FILE` was needed. |
| `git diff --check` over the owned paths | 0 | No whitespace errors. Git printed its usual `LF will be replaced by CRLF` notices. `--stat` showed 7 files, +185 / −40, so the diff is content only. |
| **Mutation A.** The `save-and-exit` entry was removed from `driftCases`, and the spec rerun | 1 | `2 failed / 7 passed`. `x 6 … every manifest variant has a drift case in this spec`, failing at `> 138 | expect(Object.keys(driftCases).sort()).toEqual(…)` with `- Expected - 1 / + Received + 0` and the diff line `-   "save-and-exit",`. Also `x 8 … Error: no drift case for variant save-and-exit`. |
| Restore A, then `sha256sum -c` | 0 | `apps/scenario-lab/e2e/identity-drift.spec.ts: OK` (`0815e2ce…b62e`) |
| **Mutation B.** The `if (operation === "save-and-exit") return …` line was removed from `state.ts`, so a press records a save; scenario-lab `test` rerun | 1 | `# tests 202 / # pass 200 / # fail 2`. `not ok 78 - save-and-exit is declared a refusal…`: `expected: 'Saved: Aurora Field Team' / actual: 'Saved: Aurora Field Team'` from the `notEqual`. `not ok 81 - save-and-exit is recorded apart from Save…`: `+ lastOperation: 'saved'`, `+ saveCount: 1`, `+ savedDisplayName: 'Aurora Field Team'`, `+ savedInMode: 'save-and-exit'`, `+ status: 'Saved: Aurora Field Team'`, `+ saveAndExitCount: 0` against `- saveAndExitCount: 1`, `- saveCount: 0`, `- status: 'Saved and exited: Aurora Field Team'`. |
| Restore B, then `sha256sum -c` | 0 | `…/identity-drift/state.ts: OK` (`0ac8e6a9…1e`), and the spec still OK |
| scenario-lab `test` again, on the final bytes (also rebuilds `dist/` without the mutation) | 0 | `# tests 202 / # pass 202 / # fail 0` |
| The Playwright spec again, on the final bytes | 0 | `9 passed (3.7s)`, `ok 9 … save-and-exit variant …` |
| `git status --short apps/scenario-lab packages/test-runner/src/bench` | 0 | Exactly the 7 owned files, nothing else |

Every gate passed on its first run and again on the final bytes, so no result
here needed a RAM rerun.

## Not verified

- **The resolver's refusal.** Design A (`g-resolver-corroboration`) has not
  landed, so today the resolver would press this variant's control. Measured on
  R7 once: 0.359 at confidence 0.337, then clicked. The Scenario Lab spec checks
  the fixture and the mode, not a refusal:
  - the page renders R7;
  - pressing the control records `save-and-exit` and never a save;
  - the declared final state fails once it is pressed.

  Nothing here shows `target_not_found` being reported.
- **Lab, after design A lands.** week1 W29 must report
  `failure.category: "target_not_found"` (code `web.target.not_found`) in at least
  90% of runs, 3 of 3, with a final state of `saveCount 0`,
  `saveAndExitCount 0` and an empty status. **Before design A lands**, the same
  row should press the wrong action: final state `saveAndExitCount 1`, status
  `Saved and exited: Aurora Field Team`, click `succeeded`. That fails
  `nothing-saved` and the `failed` click expectation, which is the measurement
  that proves the row discriminates.
- **The Flow lane with this variant's `pageFacts`**, including the `exists`
  predicate. failure-surfaces already uses `exists` in variant `pageFacts`, but I
  did not run the runner or `scenarioPageFactSchedule` here.
- **Byte-identity of the other six modes' HTML against HEAD.** It is read from the
  diff (the Discard markup and `mutate('save', …)` are unchanged), not measured.
  It matters because the extension harness pins 0.389 / 0.366 on
  `reworded-aria`. The content harness and the extension specs that arm this
  fixture (`identity-resolution.spec.ts`, `large-page-resolution.spec.ts`) were
  not run.
- The corpus row and its companion changes are not applied (the supervisor's,
  per the amended brief). `week1-corpus.test.ts` was not run.

## Open questions or contradictions found

1. **The status wording.** The wrong action writes
   `Saved and exited: <name>` while recording no save, which reads oddly in run
   evidence. Change it if the Lab review prefers wording that does not start
   with "Saved". Test 81 and the spec's negative branch pin the string.
2. **The plan's corpus table ends at W28.** `W29` is my proposed id, and the
   supervisor settles it together with the companion edits above.
3. **Ordering with `g-resolver-corroboration`.** If its
   `identity-near-miss.spec.ts` arms this fixture for R7 instead of injecting
   markup, it can now use `set-mode {"mode":"save-and-exit"}`. The expected
   state after a refusal is `saveCount 0, saveAndExitCount 0`.
