# Report: w2i-run-manifest-join

Worker: `w2i-run-manifest-join`. Wave 2 follow-up: the `nodeId` join in the run
manifest's action timings, the defect `w2i-unowned-defects` found and could not
fix inside its own ownership.

## Outcome

**Partial.** The owned half is done and verified: `flowActionTimings` now joins
through `nodeId` and the new test is proven to fail against the old comparison.
But the join cannot take effect in a real run until `run-scenario.ts` passes the
map, and that file is outside my owns. `run.json` therefore still records
`builtin.policy.action` today. The two-line wiring is written out verbatim in
[What the supervisor must still wire](#what-the-supervisor-must-still-wire).

## What changed and why

`flowActionTimings` set `actionType: action.definitionId`. Core records every
recorded action as one `builtin.policy.action` node and the stored attempt drops
the node's inputs, so that field reads the same for every recorded action alike
and the evidence bundle cannot say what ran.

It now takes the `nodeId -> outputId` map and resolves

```ts
actionType: actionTypes.get(action.nodeId) ?? action.definitionId,
```

which is the same expression, in the same order, with the same definition-id
fallback as `existing-flow-run.ts:130` and `flow-lane/persisted-flow-run.ts:114`.
The fallback is what a node the Flow does not declare reports — a native node
whose definition id *is* its action.

### Why the map is a parameter and not read inside the file

The brief asked me to reuse `readFlowActionTypes` rather than copy it, "if the
call site allows". It does not, and the Flow lane's own structure says the same
thing, so I followed the existing split rather than inventing a second one:

- **The lane orchestrator reads; the timing builder receives.**
  `run-flow-lane.ts:73` calls `readFlowActionTypes`, and
  `persisted-flow-run.ts:47` takes `actionTypes?: ReadonlyMap<string, string>`
  as an input field, defaulting to `new Map()` at the boundary (line 67). My
  signature is deliberately identical in shape. For the run manifest the
  orchestrator is `run-scenario.ts`, which I do not own.
- **Importing the reader here would close a module cycle.**
  `flow-lane/persisted-flow-run.ts:5` already imports `../run-manifest/index.js`
  for `runActionStatus`. An import the other way makes
  `run-manifest → flow-lane → run-manifest`. The audit has no cycle rule (I
  checked: no `cycle` anywhere under `scripts/`), so it would have passed
  silently, but the `imports` rule forbids a deep import that bypasses a
  directory's barrel, so the *only* legal specifier is the barrel — precisely
  the one that closes the cycle. Parameter-passing avoids the choice.
- **The caveat the earlier fix surfaced is honoured by keeping policy out of
  here.** `readFlowActionTypes` throws `recording.contract` when a Flow declares
  no output-dispatching node. Deciding whether that should fail a run belongs to
  the lane that owns the run, not to the function that formats timings. Omit the
  map and the behaviour is exactly what it was before this change.

## What the supervisor must still wire

Two call sites, both in `packages/test-runner/src/run-scenario.ts` (outside my
owns, untouched):

- line 194 `actions.push(...flowActionTimings(existingExecution.actions));`
- line 220 `actions.push(...flowActionTimings(cloneState.execution.actions));`

Two ways to supply the map, in my order of preference:

1. **Reuse the read `executeExistingPersistedFlow` already does** (needs
   `existing-flow-run.ts`, which my brief also barred). It calls
   `readFlowActionTypes` whenever `expectedActions.length`; returning that map on
   `ExistingFlowExecution` costs **zero** extra Automation Studio calls and adds
   no new failure mode. A run with no action expectations reads nothing and keeps
   definition ids.
2. **Read it in `run-scenario.ts`, tolerantly.** `run-scenario.ts:27` already
   imports from `./flow-lane/index.js`, so `readFlowActionTypes` is in reach:

   ```ts
   // Labelling `run.json` must never fail a run that otherwise passed: a Flow
   // with no output-dispatching node simply reports definition ids.
   async function runManifestActionTypes(control: RecordingProposalControl, target: { projectId: string; flowId: string }): Promise<ReadonlyMap<string, string>> {
     try { return await readFlowActionTypes(control, target); }
     catch { return new Map(); }
   }
   ```

   Costs two extra calls (`get-flow`, `list-flow-subflows`) per run, and on the
   existing lane duplicates the read `executeExistingPersistedFlow` may just have
   done. **Do not** call `readFlowActionTypes` bare at these sites: it would turn
   a passing run into a `recording.contract` failure purely for nicer labels.

## Commands run and observed results

No `pnpm build` and no `pnpm lab` command was run. Exit status was captured by
redirecting to a file and echoing `$?`, never through a pipe. The package `test`
script runs the package's own `tsc` build before `node --test`; that is the
script the definition of done names, and it emits only to the ignored
`packages/test-runner/dist/`.

| Command | Observed |
| --- | --- |
| `pnpm --filter @fluxiq-web-extension/test-runner check` | `check_exit=0`, no diagnostics |
| `pnpm --filter @fluxiq-web-extension/test-runner test` | `final_test_exit=0` — `# tests 391 # pass 391 # fail 0` (389 before; the two new tests are the difference) |
| `node scripts/structure-audit.mjs` (scratch `GIT_INDEX_FILE`) | `audit_exit=0` — `structure-audit: passed (31 warning(s), 19 baselined)`, no `FAIL` line |

`pnpm structure:baseline` was **not** run. The audit was run through a scratch
index (`cp .git/index <scratch>; GIT_INDEX_FILE=<scratch> git add -A`) because it
reads only tracked files, and it was run twice: once on the code change, and
again after this report was written, since the working-docs rule reads
`docs/working/`. Both passed.

The real index was empty after the first run. After the second it held four
`docs/working/` files — `README.md`, the plan, the Wave 1 ledger archive, and the
new `briefs/wave-3.md` — which are the supervisor's own concurrent staging, not a
leak from my scratch index: `git add -A` stages everything, so a leak would have
staged my two modified `run-manifest` files and this report as well, and
`git diff --cached --name-only -- packages/ .../reports/` lists none of them. I
staged nothing and committed nothing.

### The test discriminates, proven by reverting the line

A test that passes before and after proves nothing, so I replaced the join with
the old `actionType: action.definitionId` in place, ran the suite, and restored
the file from a scratch copy:

```text
old_behaviour_exit=1
not ok 73 - an attempt reports the output its Flow node dispatches, not the
            policy-action definition every recorded action shares
    +     actionType: 'builtin.policy.action'
    -     actionType: 'web.dom.type'
    +     actionType: 'builtin.policy.action'
    -     actionType: 'web.dom.click'
# pass 390 # fail 1
```

The fake carries Core's real attempt shape — `definitionId:
"builtin.policy.action"` on **both** attempts, distinct `nodeId`s, and a map
resolving them to `web.dom.type` and `web.dom.click` — so the assertion can only
be met through the node join. The second new test covers the definition-id
fallback for a node absent from the map, and the pre-existing test, which passes
no map, still passes unchanged: omitting the map preserves the old behaviour.

## Not verified

- **Nothing ran against a live target.** No existing or clone target was
  exercised, so the join has never produced a real `run.json`. Its correctness
  rests on Core's attempt shape as `flow-action-types.ts` documents it and as
  `existing-flow-run.ts` already relies on.
- **The defect is still live in a real run.** Until a call site passes the map,
  `run.json` records `builtin.policy.action` exactly as before. I verified the
  new code path only through unit tests.
- **Root `pnpm check`, `pnpm test`, and `pnpm build` were not run** — the brief
  reserves the build for the supervisor. Only the `test-runner` package was
  checked and tested.
- The audit reflects the tree at the moment it ran; `docs/working/` was being
  edited concurrently by the supervisor. This report file was added afterwards
  and was not part of that audited set.

## Open questions or contradictions found

### 1. The brief's ownership made its own definition of done unreachable

"Owns: `action-timings.ts` and its tests" plus "Must not touch: anything outside
`packages/test-runner/src/run-manifest/`" cannot fix a defect whose fix is a
parameter the caller must pass. `w2i-unowned-defects` predicted this exactly
("Fixing it needs the `nodeId → outputId` map threaded to the caller") and it
recurred anyway. I did not deviate: I left `run-scenario.ts` untouched and wrote
the wiring out above instead. A brief that says "fix what X records" needs to
grant X's caller.

### 2. The existing lane may now read the same map twice

If the supervisor takes wiring option 2, an existing-lane run with action
expectations will call `get-flow` and `list-flow-subflows` twice — once inside
`executeExistingPersistedFlow`, once for the manifest. Option 1 removes that, but
needs `existing-flow-run.ts`, barred by my brief. Worth one small brief that owns
both files together.
