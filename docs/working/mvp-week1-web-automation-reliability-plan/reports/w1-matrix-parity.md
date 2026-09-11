# Report: w1-matrix-parity

Worker `w1-matrix-parity`, Phase 1.6a step 6. Brief: `briefs/wave-1.md`,
section `### Brief: w1-matrix-parity`.

## Outcome

Done.
- **Catalog.** `packages/test-matrix` no longer keeps a hand-written scenario
  list. At runtime it reads the built Scenario Lab registry, and each entry's
  tags are the manifest's own tags, copied exactly.
- **Parity tests.** They fail if the catalog and the registry disagree, and
  also if a selection rule names a scenario or a tag the registry does not
  have.
- **Tests on the live tree.** `pnpm --filter @fluxiq-web-extension/test-matrix test`
  passed there (17/17) once the parallel workers' files compiled.
- **All 22 scenarios listed.** The derived catalog lists every registered
  scenario and followed the ten fixtures from placeholder tags to their real
  tags with no edit here.
- **Structure audit.** No finding for my files.

## What changed and why

- `packages/test-matrix/src/scenario-catalog.ts` (new).
  `loadScenarioCatalog(repositoryRoot?)` imports
  `apps/scenario-lab/dist/registry.js` the way `packages/test-runner/src/scenarios.ts`
  does. It maps `listScenarioManifests()` to `{ id, tags }` in registry
  order, with tags copied exactly. `scenarioCatalogFromManifests` rejects a
  missing id, a duplicate id, or non-string tags. The default root is taken
  from the module's own location (`dist/` is three levels below the
  repository root), so the CLI works from any cwd. A missing build throws
  `Scenario Lab build is missing: <path>. Run "pnpm --filter
  @fluxiq-web-extension/scenario-lab... build".`
- `packages/test-matrix/src/selection-rules.ts` (new). The rules table moved
  out of `selector.ts` unchanged in order, path tests, and gates, with three
  changes:
  - `scenarios: "all"` replaces the module-level `allScenarioIds`, which came
    from the hand catalog.
  - The rule tags now use the manifests' tag words (see the next section).
  - The dead `fixture` tag is gone from `scenario-fixture`. No scenario ever
    carried it; that rule selects by path.
- `packages/test-matrix/src/selector.ts`. `selectChangedCapabilities(paths,
  catalog)` now takes the catalog as an argument. I deleted the
  `scenarioCatalog` const and the `ScenarioId` literal type; their only user
  was this package's own test. I also added a fail-safe: a scenario whose
  manifest tags match none of the rules' tags ("unclassified") is selected by
  every rule that selects by tags. This follows the module's existing rule
  that an unknown path selects the whole corpus. Without it, a new fixture
  with new tag words would never be picked by content, background, or domain
  changes.
- `packages/test-matrix/src/cli.ts`. It loads the catalog, then selects. The
  output JSON and the `--github-output` keys are unchanged.
- `packages/test-matrix/src/index.ts`. Barrel lines for the two new modules.
- `packages/test-matrix/package.json`. A new `build:registry` script runs
  `pnpm --filter @fluxiq-web-extension/scenario-lab... build`, and `test` now
  runs it before `build`. `build` itself is unchanged, so the root
  `pnpm -r build` does no nested build. The reason: CI's `select` job
  (`.github/workflows/testing-facility.yml`, steps "Build and test selector"
  and "Produce matrix outputs") runs `pnpm --dir packages/test-matrix test` and
  then `node packages/test-matrix/dist/cli.js` straight after
  `pnpm install --frozen-lockfile`, with no Scenario Lab build. The test step
  now produces the registry the CLI needs. This avoids editing the workflow,
  and avoids adding a workspace dependency, which would change
  `pnpm-lock.yaml` (not mine).
- Tests:
  - `src/tests/scenario-catalog.test.ts` (new), the catalog/registry parity
    test. It checks four things against the registry:
    - Catalog ids equal `registry.listScenarios()` ids, in order.
    - As a set, they equal the `scenarioIds` list the Scenario Lab declares
      (`apps/scenario-lab/dist/types.js`).
    - Each entry's tags equal its manifest's tags exactly.
    - Every registered id has `apps/scenario-lab/src/scenarios/<id>/scenario.ts`,
      and a change there selects exactly that id.

    It also covers the missing-build error and malformed registry output.
  - `src/tests/selection-rules.test.ts` (new), the rules/registry parity test.
    Every scenario id a rule names must be registered, and every tag a rule
    selects by must appear on at least one registered manifest.
  - `src/tests/selector.test.ts`. The five original tests now run on the
    derived catalog. The two whole-corpus tests now require the exact
    registry id list instead of a matching length. Four tests on a made-up
    catalog pin the selection rules independently of today's fixtures:
    - A tag rule selects matching and unclassified scenarios.
    - Rules that do not select by tags leave unclassified scenarios out.
    - An unregistered fixture directory selects the whole catalog.
    - Whole-corpus rules select exactly the catalog they are given.

### Why the rule tags changed

The manifests' tags differ from the hand catalog's. For example,
`iframe-checkout`'s manifest has `["iframe","coordinates"]` where the hand
catalog had `["iframe","targeting","visual"]`. No manifest carries
`recording`, `playback`, `worker`, `visual`, `policy`, `timing`, or
`accessibility`.

With manifest tags and the old rules, `content-targeting` would drop from 6
scenarios to 1, `gateway-worker` from 5 to 1, and `recording-domain` from 4
to 1. The existing test that expects `iframe-checkout` for a content change
would also fail. So I rewrote the rule tags in the manifests' words, keeping
every earlier selection. The recording rules use tags that stand in for
"records": `identity`, `navigation`/`history`, and `redaction`/`security`.
`smoke` means `basic-form`. A comment in `selection-rules.ts` says so.

Before and after, per rule. "Old" is the HEAD compiled selector with its
10-entry hand catalog. "New" is this change with the derived catalog, measured
mid-wave when eight fixtures were still placeholders. Both used the same
representative path for each rule.

| Rule | Old | New | Removed | Gates |
| --- | --- | --- | --- | --- |
| scenario-fixture | 1 | 1 | none | same |
| content-targeting | 6 | 17 | none | same |
| gateway-worker | 5 | 14 | none | same |
| extension-ui | 1 | 1 | none | same |
| extension-build | 10 | 22 | none | same |
| recording-domain | 4 | 13 | none | same |
| action-domain | 6 | 18 | none | same |
| facility | 10 | 22 | none | same |
| dependency-topology | 10 | 22 | none | same |
| docs-only | 0 | 0 | none | same |
| extension-fallback | 10 | 22 | none | same |
| safe-unknown | 10 | 22 | none | same |

Where the additions come from:
- The 12 scenarios the hand catalog lacked are now in every whole-corpus
  rule.
- `llm-target-drift` joins `content-targeting` and `action-domain` through
  its `failure` and `target-drift` tags.
- `instruction-only-form` joins `action-domain` through `llm`;
  `domain/src/runtime/` holds `llm-evidence.ts`.
- The unclassified scenarios join every tag rule through the fail-safe.

No rule lost a scenario and no gate changed. New fixtures can only add to
these counts.

### Derived catalog (all 22 registered scenarios)

Printed from `loadScenarioCatalog()` against the live registry, rebuilt at
12:58 after every fixture worker had set real tags. A mid-wave print from the
same code, taken while eight fixtures were still `["placeholder"]`, also
listed all 22. The derivation followed the retagging with no edit to this
package.

```text
basic-form             ["forms","smoke"]
dynamic-list           ["mutation","identity"]
navigation             ["navigation","history"]
long-document          ["scroll","coordinates"]
iframe-checkout        ["iframe","coordinates"]
ambiguous-targets      ["targeting","ambiguity"]
delayed-ui             ["wait","retry"]
failure-surfaces       ["failure","safety"]
reconnect              ["gateway","resilience"]
sensitive-input        ["redaction","security"]
llm-target-drift       ["llm","diagnosis","target-drift","failure"]
instruction-only-form  ["llm","instruction-only","forms"]
product-catalog        ["catalog","extraction","pagination","search","filter"]  (unclassified)
data-table             ["extraction","table","sorting","column-drift"]  (unclassified)
infinite-feed          ["scroll","infinite-scroll","lazy-load","extraction"]
modal-flows            ["modal","focus-trap","consent-banner","interstitial","native-confirm"]  (unclassified)
multi-tab              ["multi-tab","popup","window-open","extract"]  (unclassified)
file-transfer          ["file-transfer","download","upload","forms"]  (unclassified)
auth-gate              ["auth","forms","password","redirect","session-expiry","extraction"]  (unclassified)
identity-drift         ["forms","target-drift","element-identity","recovery"]
intermediate-state     ["forms","wait","intermediate-state"]
keyboard-forms         ["forms","keyboard","combobox","trusted-input"]  (unclassified)
```

To reprint it:
`node --input-type=module -e "const m = await import('file:///F:/!FluxIQWebExtension/packages/test-matrix/dist/index.js'); for (const s of await m.loadScenarioCatalog()) console.log(s.id, JSON.stringify(s.tags));"`

## Commands run and observed results

1. `node scripts/structure-audit.mjs` before any change: exit 1. The only
   FAIL was `[working-docs] docs/working/README.md is out of date with the
   documents' header blocks` (not mine). It also reported 27 warnings,
   `structure-audit: 1 baseline entries can be lowered`, and no test-matrix
   line.
2. `pnpm --filter @fluxiq-web-extension/test-matrix check`: exit 0.
3. `pnpm --filter @fluxiq-web-extension/test-matrix test`, runs 1 to 3: each
   failed in the nested scenario-lab build on another worker's in-progress
   file.
   - Run 1: `infinite-feed/scenario.ts(80,69)` TS18046 and
     `intermediate-state/tests/scenario.test.ts` TS2305/TS2339.
   - Run 2: intermediate-state only.
   - Run 3: `data-table/table-page.ts(15,49)` and `(16,50)`, TS1487 (octal
     escapes). The emitted registry then threw a SyntaxError on import, and
     the CLI failed closed with `test-matrix: Octal escape sequences are not
     allowed in template strings.`

   A later check found `packages/test-contracts/src/index.ts` exporting a
   not-yet-created `./bench-report-validation.js` (`w1-eval-contracts`
   mid-edit). None of these files is mine.
4. `pnpm build && node --test "dist/**/*.test.js"` in `packages/test-matrix`,
   against the 22-scenario registry `tsc` had emitted: `# tests 17`,
   `# pass 16`, `# fail 1`. The failure, "selects a single known fixture
   scenario", was my defect. The test source held single backslashes, which
   TypeScript reads as escape sequences, so the path became garbage and fell
   to `safe-unknown`. I fixed it with `path.win32.join("apps",
   "scenario-lab", "src", "scenarios", "basic-form", "scenario.ts")`, and a
   check on a made-up catalog then gave `scenarioIds ["basic-form"]` with
   gates `["changed-scenarios","static"]`. A byte-level check confirmed that
   `normalizePath`'s two-backslash string and both regexes I wrote are intact.
5. Validation against a consistent snapshot (HEAD holds 12 scenarios; the
   22-scenario pre-step is uncommitted). I exported HEAD's `apps/scenario-lab`,
   `packages/test-contracts`, and `tsconfig.base.json` into a scratch tree with
   `git archive HEAD ... | tar -x`, added my current `packages/test-matrix`,
   and compiled all three with the repository's `tsc`. Results:
   - Compilation: all three exit 0.
   - `node --test "dist/**/*.test.js"`: `# tests 17`, `# pass 17`, `# fail 0`.
   - `node dist/cli.js apps/extension/src/content/targeting.ts --github-output <file>`:
     exit 0. It selected `ambiguous-targets, basic-form, delayed-ui,
     failure-surfaces, iframe-checkout, llm-target-drift, long-document`. The
     output file held `required_gates=["browser-smoke","changed-scenarios","static"]`,
     `run_browser_smoke=true`, `run_changed_scenarios=true`, and
     `run_full_matrix=false`.
   - The CLI on a docs-only path: `scenarioIds: []`, `requiredGates: ["static"]`.
6. **DoD on the live tree.** A background loop polled
   `tsc --noEmit -p apps/scenario-lab/tsconfig.json` every 45 s. It compiled
   clean at attempt 10 (12:53:16), and the loop then ran
   `pnpm --filter @fluxiq-web-extension/test-matrix test`:
   - Exit 0, `DoD test script: PASS`.
   - The nested build printed `../test-contracts build: Done` and
     `../../apps/scenario-lab build: Done`.
   - All 17 tests passed (`# tests 17`, `# pass 17`, `# fail 0`,
     `# duration_ms 197.8111`), including the catalog/registry and
     rules/registry parity tests.
7. The structure audit, with my four new files visible to `git ls-files`
   through a scratch copy of the index (`GIT_INDEX_FILE=<scratch>
   git add -N <files>`; the real index is untouched and they still show as
   `??`): exit 0,
   `structure-audit: passed (27 warning(s), 19 baselined)`, no line naming
   test-matrix, warn lines identical to the pre-change run. I ran it before
   and after the test fix with the same result. It still says
   `structure-audit: 1 baseline entries can be lowered`; that line was there
   before my change, and the audit does not name the entry.

## Not verified

- GitHub Actions itself. I did not run it; the `select` job analysis is from
  reading the workflow. I ran the DoD as `pnpm --filter ... test`, not as the
  CI form `pnpm --dir packages/test-matrix test`.
- The root `pnpm check`, `pnpm test`, and `pnpm build`. Not run.
- The CLI `--github-output` path against the live 22-scenario registry. I
  exercised it only on the HEAD snapshot (step 5); the live attempts hit the
  parallel breakages.
- The before/after table was measured mid-wave. The current catalog has 7
  unclassified scenarios rather than 9, which only lowers the tag-rule counts
  relative to that table.

## Open questions or contradictions found

1. **No "recording" or "playback" tags.** No manifest carries a recording or
   playback capability tag, so the recording rules use stand-in tags. Two
   options:
   - Fixtures carry `recording`/`playback` tags (a Scenario Lab change).
   - The selector derives them from `expected.recordingEvents`,
     `expected.actions`, or `playbackGoal`. That would make tags differ from
     the manifest's own, which this brief ruled out.
2. **Seven new fixtures are unclassified.** `product-catalog`, `data-table`,
   `modal-flows`, `multi-tab`, `file-transfer`, `auth-gate`, and
   `keyboard-forms` carry no tag that any rule selects by, so every tag rule
   selects them. That is conservative and correct. To narrow them, add their
   words to the rules, for example:
   - `extraction`/`extract` to `content-targeting` and `action-domain`;
   - `forms`, `keyboard`, and `trusted-input` to `content-targeting`;
   - `download`/`upload` and `popup`/`window-open` to `gateway-worker`.

   I left the rules alone because fixture tags may still change this wave,
   and `selection-rules.test.ts` fails on a rule tag no manifest carries.
3. **CI now selects scenarios it never ran.** Whole-corpus CI selections now
   include `llm-target-drift`, `instruction-only-form`, and all ten new
   fixtures. The hand catalog left them out, so CI never selected them. Please
   confirm the CI browser lanes can run them, for example the LLM scenarios
   without a provider.
4. **The nested build can race.** `test` rebuilds test-contracts and
   scenario-lab. Under the root `pnpm -r test`, or alongside fixture workers,
   that rewrites `apps/scenario-lab/dist` while other processes may be reading
   it. Declaring `@fluxiq-web-extension/scenario-lab` as a workspace
   devDependency of test-matrix would let pnpm order the builds and drop the
   nested step, but it changes `pnpm-lock.yaml`, which is not mine.
5. **Documentation.** `docs/architecture/testing-facility.md` describes this
   package (the grep hits at lines 197, 789, and 970). I did not read or edit
   it. It may want a sentence saying the catalog comes from the registry, and
   one describing the unclassified fail-safe.
