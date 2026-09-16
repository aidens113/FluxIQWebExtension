# W2 — The Flow lane is green, and the two neighbours now agree on purpose

## Outcome

Done. `product-catalog --flow` passes end to end on the isolated target, with
its extraction judged 8 records of 8 and 32 fields of 32. The 400 was confirmed
by observing Core's actual response before anything was changed, the cause was
the one predicted, and the inconsistency behind it is settled with a decision, a
reason, and a test that makes the rule fail the build rather than sit in a
comment.

| Run | Verdict | First failure |
| --- | --- | --- |
| `run-mu3rur5g-7421a05b` (previous worker's last) | failed | `environment.missing` — `get-run-dataset-page` (400) |
| `run-mu3subhg-853abc64` (after the fix) | **passed** | none |
| `run-mu3t33sg-86963706` (confirmation, final tree) | **passed** | none |

## Part 1 — the 400, observed and then fixed

### Observed first, not inferred

The previous report's cause was read off the code and never seen; the Lab keeps
only the status (`http-control/index.ts:135`). I started an isolated Core
through the runner's own `startTopology`, logged in as it does, and issued the
same POST three ways against the same `web-automation` project it creates
(probe script in the session scratchpad, not committed):

```
NO-DOMAIN-SCOPE    -> 400 {"ok":false,"error":"Automation Studio project is unavailable in this domain scope."}
WITH-DOMAIN-SCOPE  -> 200 {"ok":true,"payload":{"dataset":null}}   (?domainId=web-automation)
WRONG-DOMAIN       -> 400 {"ok":false,"error":"Automation Studio project is unavailable in this domain scope."}
DETAIL NO-SCOPE    -> 200 {"ok":true,"payload":{"runDetail":null}} (get-flow-run-detail)
DETAIL WITH-SCOPE  -> 200 {"ok":true,"payload":{"runDetail":null}}
```

So the diagnosis was right in every part: `assertProjectDomainAccess` throws
(`AS/runtime/service.ts:1691-1693`), and any handler throw becomes a 400
(`apps/web/src/lib/program-route.ts:3-9`). The run detail beside it answers
under any scope at all, including a domain the project does not belong to.

### The fix: one domain, threaded, named once

No literal was added to the reader. The domain travels as a parameter, and the
two places that already named it now take the same value:

- `flow-lane/run-datasets.ts` — `readRunDatasets` takes `domainId` as a
  **required** member of its input and passes it to `automationStudioCall` as
  the scope. Required rather than optional on purpose: an optional scope is the
  bug, because a caller that omits it only finds out against a run that actually
  stored rows, which is why this survived until one did.
- `flow-lane/persisted-flow-run.ts` — `executeRecordedFlowRun` takes an optional
  `domainId` and uses one value for both `authorizedDomainIds` (two hardcoded
  `["web-automation"]` literals, now gone) and the dataset read. The two must
  agree, so they are now the same variable.
- `flow-lane/run-flow-lane.ts` — `FlowLaneInput.projectDomainId`, documented, so
  a caller that read the project passes that project's own `domainId`.
- `flow-lane/lab-project-domain.ts` (new) — `LAB_PROJECT_DOMAIN_ID`, the single
  place the lane names the Lab's domain, used only as the default for a caller
  that did not read the project. `run-scenario.ts` is the caller and is outside
  the files I own, so it passes nothing and takes that default; when it is next
  touched it should pass the project's real `domainId` and the default becomes
  dead weight.

`WEB_AUTOMATION_DOMAIN_ID` in `domain/src/constants.ts` is deliberately **not**
imported: it is not exported from `@fluxiq-web-extension/domain`, and reaching
past the package barrel for it would trade a five-word literal for a boundary
breach. The file says so, and says where to start if the domain is ever renamed.

### Proven by a real run

`FLUXIQ_TEST_ENV_FILES=none FLUXIQ_TEST_TARGET=isolated pnpm lab run product-catalog --flow`
→ `run-mu3subhg-853abc64`, **verdict `passed`**, `failureCategory: null`,
`oracleVerdict: passed`, `summary.json` `firstFailure: null`. Invariants:
`runner-verdict` passed, `evidence-packet-budget` passed.

`evaluation.json` `extraction`:

```json
[
  {
    "stepIndex": 0,
    "status": "judged",
    "expectedRecords": 8,
    "observedRecords": 8,
    "recordsListed": true,
    "countStated": true,
    "comparedRecords": 8,
    "matchedRecords": 8,
    "expectedFields": 32,
    "presentFields": 32,
    "unexpectedFields": 0,
    "expectedPages": null,
    "pagesFollowed": null,
    "truncated": null,
    "durationMs": 2097,
    "nonStringValues": 0
  }
]
```

Every record Core stored was read back and matched: the rows now make the whole
round trip, from the extension's extraction through Core's dataset store and out
through `get-run-dataset-page` into the lane's judgement. `expectedPages`,
`pagesFollowed` and `truncated` are `null` because this lane cannot observe them
(D16), not because they failed.

## Part 2 — the decision, and why

**`get-run-dataset-page` is right to assert. `get-flow-run-detail` should not
start.** The caller supplies the id, which is what Part 1 did.

What the scope protects decides it. A request's domain is whatever `?domainId=`
says on the URL (`program-route.ts`, `programDomainScope`), and any
authenticated actor with `programs.read` can name any domain. So
`assertProjectDomainAccess` is not, and cannot be, an authorization gate against
a hostile caller. What it is is a containment boundary: it binds a request to
the domain surface it claims to be working in, so a domain-scoped client — the
Studio opened at `?domainId=web-automation`, or a domain's own runtime adapter —
cannot be pointed at another domain's project and pull that project's **stored
content** out of it.

That is exactly where Core already draws the line, and the line is coherent:

- **Asserts (13 endpoints):** the six run-dataset endpoints and the seven
  reusable LLM context endpoints. Dataset rows are stored raw and never stripped
  (CD16) — whatever the page held is in there. Reusable context records are
  sanitized evidence pooled across runs.
- **Does not assert:** runs, flows, recordings, projects, and the project UI
  cache. These hold no captured content to leak, and not by luck: an attempt's
  captured rows become a `$dataset` marker
  (`runtime/service/summaries/conversions.ts`, `datasetMarkerRecordCount`), a
  run's input values become the withheld marker when the session starts
  (`runtime/service.ts:2835`) and again in the stored envelope
  (`storage/project/runtime-stream-store.ts`, `withheldRunInputs`), and a
  capture's `outputs.result` and `records` are withheld before the trace is
  stored (`runtime/executor/record-capture.ts:181,225-227`).

I checked the strongest argument for the other side before rejecting it: the run
detail carries `inputs`, and on this very lane a run's inputs are resolved
secret values. Core already withholds every one of those values in both places
it stores them, keeping only the keys. So adding the assertion to
`get-flow-run-detail` would protect nothing that is not already withheld, while
breaking every structural caller that reads a run without naming a domain — the
Lab's own detail read included.

Weakening `get-run-dataset-page` was never on the table: it is the only thing
standing between a mis-scoped client and another domain's raw page rows.

### Made mechanical, not written down

The brief's worry is right — a comment does not stop the next author copying
whichever neighbour they read first. Core already has the pattern for this:
`classification` is a required registration field precisely so "a new endpoint
cannot reach the wire unclassified", pinned in
`programs/tests/endpoint-classification.test.ts`. I added the same kind of guard
for the scope, inside the handlers I own:

`api/handlers/tests/domain-scope.test.ts`

1. Calls **every** registered Automation Studio endpoint under a scope the
   project does not belong to, with a service that answers anything, and
   collects which ones asserted. The observed set must equal the pinned list of
   13. A new endpoint that returns stored content without the check, or one that
   adds the check where it does not belong, fails this test, and the rule it has
   to be read against is at the top of the file. The set is **observed, not read
   off the source**, so an endpoint that asserts on only some paths cannot pass
   as one that asserts.
2. Pins the pair that disagreed as behaviour: `get-run-dataset-page` refuses a
   mismatch and never reaches the store; `get-flow-run-detail` answers under any
   scope.

I checked the guard actually bites: removing `getRunDatasetPage` from the pinned
list fails with `expected [ …(13) ] to deeply equal [ …(12) ] + "get-run-dataset-page"`.
The list was then restored and re-run green.

The two file headers now state the rule on both sides of it, so whichever
neighbour the next author reads, they meet it: `datasets.ts` says why every
handler there asserts and points at the test; `runs.ts` says its omission is
deliberate, why a run record has nothing to leak, and where to read the rule
before adding an endpoint that would.

## Commands run and observed results

| Command | Result |
| --- | --- |
| Isolated-Core probe of `get-run-dataset-page` / `get-flow-run-detail`, three scopes | statuses and bodies quoted above |
| `FLUXIQ_TEST_ENV_FILES=none FLUXIQ_TEST_TARGET=isolated pnpm lab run product-catalog --flow` | `run-mu3subhg-853abc64` **passed**; extraction 8/8 records, 32/32 fields |
| The same command again, on the final tree | `run-mu3t33sg-86963706` **passed**; same extraction block, `durationMs` 2096 against 2097 |
| `packages/test-runner: tsc -p tsconfig.json` | exit 0 |
| `packages/test-runner: node --test "dist/flow-lane/tests/*.test.js"` | `# tests 120 / # pass 120 / # fail 0` |
| `packages/test-runner: node --test "dist/**/*.test.js"` | `# tests 921 / # pass 921 / # fail 0` |
| `F:\!FluxIQWebExtension: node scripts/structure-audit.mjs` | `passed (57 warning(s), 17 baselined)` |
| `packages/fluxiq: npx tsc --noEmit` | exit 0 |
| `packages/fluxiq: npx vitest run src/programs/automation-studio/api src/programs/tests` | `26 files passed / 95 tests passed` |
| `F:\!FluxIQ: node scripts/structure-audit.mjs` | `passed (139 warning(s), 254 baselined)` |

One note on that vitest line: run from the repository root instead of the
package directory, `programs/tests/global-docs.test.ts` fails with an ENOENT on
a TypeDoc artifact, because the test resolves its `rootDir` as
`process.cwd()/../..`. It is a cwd artifact of how it was invoked, not a
regression — from `packages/fluxiq` the same test passes in 6.2 s.

## Files changed

`F:\!FluxIQWebExtension`

- `packages/test-runner/src/flow-lane/run-datasets.ts`
- `packages/test-runner/src/flow-lane/persisted-flow-run.ts`
- `packages/test-runner/src/flow-lane/run-flow-lane.ts`
- `packages/test-runner/src/flow-lane/index.ts`
- `packages/test-runner/src/flow-lane/lab-project-domain.ts` (new)
- `packages/test-runner/src/flow-lane/tests/run-datasets.test.ts` (new)
- `packages/test-runner/src/flow-lane/tests/persisted-flow-run.test.ts`

`F:\!FluxIQ`

- `packages/fluxiq/src/programs/automation-studio/api/handlers/datasets.ts` (header only)
- `packages/fluxiq/src/programs/automation-studio/api/handlers/runs.ts` (header only)
- `packages/fluxiq/src/programs/automation-studio/api/handlers/tests/domain-scope.test.ts` (new)

No behaviour changed in Core: the two edits there are comments, and the third
file is a test. Nothing under `AS/runtime/**`, `domain/src/**` or
`apps/extension/**` was touched. `apps/extension/build/**` is modified in the
working tree because the Lab rebuilds it on every run; that is its own build
writing it, not a hand edit, and it was already modified before I started.

## Not verified

- No `pnpm check`, `pnpm test` or `pnpm build` at either repository root. I ran
  the test-runner package's own typecheck and whole suite, Core's package
  typecheck, Core's `automation-studio/api` and `programs` suites, and both
  structure audits.
- The probe and the Lab runs were the only live exercise. No browser validation
  beyond what the lane itself does, and no other scenario was run — in
  particular nothing that reads datasets outside the Flow lane, because nothing
  else does.
- `readRunDatasets` is called from exactly one place, and the required
  `domainId` is therefore proven only through that path.
- The 13-endpoint pinned set is what Core registers today. Each of the seven
  reusable-context endpoints was classified by observing it assert, not by
  reasoning about what it returns; I read the rule off the dataset and cache
  headers and the withholding code, and the reusable-context endpoints fit it,
  but I did not audit each one's payload.
- Each Lab verdict is one observation on a machine with known-faulty RAM. There
  are two green runs here rather than one, from different points in the day's
  tree, which is why I am treating green as real rather than as noise.

## Open questions or contradictions found

1. **`run-scenario.ts` should pass the project's domain.** The lane accepts
   `projectDomainId` and nothing supplies it, so the Lab's default stands.
   `RunningTopology` does not carry the project's `domainId` today even though
   the coordinator chose it; adding it there and threading it through
   `runFlowLane` would make the default unreachable. Outside the files I own.
2. **`get-flow-run-detail` answers under a domain the project does not belong
   to, and that is by design** — but it is design nobody had written down until
   now, and the containment story only holds while run records stay withheld of
   content. If a future field puts captured content back on a run record, that
   endpoint moves to the other side of the line. The new test is where that
   decision would have to be made explicitly, which is the point of it.
3. `packages/test-runner/src/flow-lane/tests/persisted-flow-run.test.ts` crossed
   the 400-line advisory threshold (438 lines) with the scope cases I added, so
   the web-extension audit reports 57 advisory warnings where it reported 56.
   The audit passes. Moving those cases into `run-datasets.test.ts` to dodge it
   would have filed a test of `executeRecordedFlowRun` under the wrong subject
   and duplicated three fixtures, which is the worse trade.
4. The previous report's open question 1 is still open and untouched by this
   work: whether the domain's extraction binding should also set
   `confirmation: false`, so Core stops stamping `confirmationInputId` on the
   stored action entry. It does not affect the lane, which is green either way.
