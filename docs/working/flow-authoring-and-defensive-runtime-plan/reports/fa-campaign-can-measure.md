# fa-campaign-can-measure — the campaign can produce a product verdict (task t094)

Worktree `F:\fxwork\t094-campaign-can-measure`, branch `task/t094-campaign-can-measure`,
against the shared Core worktree `F:\fxwork\!FluxIQ` at `8b145c77`. No commit was
made. **No Core change was needed**; everything is in this repository.

## Outcome

**Done. The campaign can measure the product now: three live rows, three
product verdicts, none of them about the harness.**

> One campaign, `t094-pilot`, on three of the ten campaign sites, 94 provider
> calls and $0.476. Two builds produced a Flow and each Flow ran and failed on
> the page (`web.target.not_found`); one build produced none and says so in
> Core's own code. Every row carries the calls and the cost it really spent. No
> row reads `environment.missing`, and no row reads `performance.budget`.
>
> **One of those rows exists only because of this task.**
> `run-mudv54bp-e9c9e170` carries `unsettled: "recovery"`: Core never wrote the
> run's recovery record, which under the old rule meant waiting the grant's
> whole ten-minute lease and then failing the run `performance.budget` — the
> exact loss that was `run-mudslg9p-c59266aa` this morning. The row now holds
> the Flow, its nine nodes, its dataset judgement and its spend, and says that
> the record is missing rather than absent.
>
> **And one row says something no campaign row has ever said.**
> `run-mudvjt43-43703e88`: 33 actions were put to Core's permission gate, 28
> declared nothing lasting, five declared `send_or_publish` — including the
> `flow_step` press the saved Flow runs — and the class was **allowed by the
> instruction**, not by any grant. Beside it, Core's cross-check: the
> instruction also asks for `create_new`, and nothing declared it. That is
> A13's contradiction, in a campaign row, for the first time.

## What changed and why

### 1. A build that asks a person is a product result, not an HTTP failure

**What was happening.** Since the permission gate learned to park, a build can
finish, leave a proposal and carry the unanswered question on it. Core then
refuses to approve or apply that proposal
(`assertAutomationStudioBootstrapPermissionAnswered`), so the first anyone heard
of it was an HTTP 400 on `review-flow-adaptation`, which the runner classified
`environment.missing` — a verdict about the installation, for the product doing
exactly what it was built to do. That is `run-mudt5jr5-92321d8c`: 24 provider
calls and $0.12 that measured nothing.

**The proposal says so itself.** `flowAdaptation` in the control client now
reads `metadata.bootstrap.permissionRequest`, and `proposed()` in
`build-proposal.ts` ends such a build as `outcome: "permission_required"` with
`failure.code: "flow_bootstrap.permission_required"` and the request attached —
the same ending a build that died on the request already had, reported as one.
The lane's existing `permissionRequired()` then throws `runtime.behavior` with
`permission.required` and the missing classes, and `adaptationId` is kept, so a
reader can tell "asked before building" from "asked after building, and there is
a Flow waiting on an answer". Nothing is asked of the review surface, so no HTTP
status stands in for the answer.

### 2. Who answers, when nobody is watching

The decision the brief asked for, in order of authority.

**The instruction is the authority, and it already answers.** Core's gate
permits any class it reads the person's own instruction as asking for, whatever
the grant holds (`gate.ts`: `missing` is what is in neither). So the ordinary
consequential task needs no grant at all, and this needed no change.

**A task may declare what its own instruction asks for.** `LiveInstructionTask`
takes an optional `permits` — consequence classes in Core's closed vocabulary,
validated against `llmActionConsequences` at catalog load, so an unrecognised
word refuses the catalog rather than silently permitting nothing. The campaign
passes exactly those as that one task's `--llm-permit`
(`live-campaign/lab-run/command.mjs`). A task that names none permits none.

**Why not a campaign-wide grant.** `--llm-permit` after `--` already applies to
every task in the selection. Using that for a fifty-five-task campaign would
permit `move_money` for an extraction task, and the over-declaration this
measurement exists to find would become invisible. An operator's own
`--llm-permit` still wins for a hand-run task, because the Lab refuses an option
given twice and somebody running one task is the person the question is for.

**Both readings are distinguishable in the summary**, which is the part the
brief made a requirement. The row carries `buildOutcome` and
`consequences.answeredBy`:

| `answeredBy` | What it means |
| --- | --- |
| `instruction` | Every class declared was one the instruction asks for; no grant was involved |
| `campaign` | A class the instruction did not cover was held by the task's own `permits` |
| `nobody` | Neither held it: the build asked, and the campaign had no answer |
| `nothing lasting` | Every action said it would cause nothing that stays |
| `not recorded` | Core published no declarations for this build at all |

### 3. The two reporting gaps the brief named

**The Lab read nothing for a step's declared consequences.** It read
`adaptation.instructedConsequences` at the top level, which
`bootstrapAdaptationAsFlowAdaptation` never populates: all four members —
`instructedConsequences`, `declaredConsequences`, `consequenceCrossCheck`,
`permissionRequest` — are projected under `metadata.bootstrap`. Every build this
facility has ever measured therefore reported an empty declaration while the
stored proposal held a full one. They are now read from there
(`existing-fluxiq-control/adaptation-consequences.ts`), published on the build
record, and summarized onto the campaign row. The redundant
`get-flow-adaptation` round trip the old reader made is gone.

**A build's `providerCalls` was short by one.** It was the evidence loop's
decisions alone; Core makes calls outside the loop — the instruction-authority
derivation — and publishes them as `additionalProviderCallCount` with their sum
as `totalProviderCallCount`. `providerCalls` is now that sum, the loop's own
count stays as `loopProviderCalls`, and the bounded contract an audit record is
held to was extended to check the arithmetic rather than to refuse the new
fields (`existing-fluxiq-control/adaptation-evidence-loop.ts`). Because
`liveLlmBuildUsage` takes the row's spend from `build.providerCalls`, the
campaign row's `Calls` column is corrected by the same change.

### 4. The terminal wait, and which of the two it was

`run-mudslg9p-c59266aa`: a Flow was built, ran, failed, Core's repair made its
two `loop_verification` calls, and **no recovery record ever arrived**. The Lab
waited the grant's whole run lease — 600 s, not the 90 s the brief expected;
`GRANTED_RUN_WAIT_MS`, not `TERMINAL_DETAIL_WAIT_MS` — and then failed the run
`performance.budget`. A complete product result was thrown away over a note
about it.

The rule now lives in `flow-lane/terminal-run-wait.ts`, and it splits the two
things the wait was buying, because they are different in kind.

- **A missing verdict still fails the run**, with `pending: "verdict"`. It
  decides the run's outcome: a `succeeded` run read before Core has judged its
  result reports a pass the verdict may be about to take away, and a
  measurement that can report a false pass is worse than one that reports
  nothing. It keeps the grant's whole lease.
- **A missing recovery record does not.** The run is returned as it stands and
  marked `unsettled: "recovery"`, which the Flow-lane snapshot and the campaign
  row both carry, so a reader can tell "Core recovered nothing" from "Core never
  said". It takes its own bound, `RECOVERY_RECORD_WAIT_MS` — five minutes from
  the first terminal read, half of Core's lease on a claimed grant.

I did **not** change the build's own waits. A build's request bound is 300 s and
its polled deadline 675 s. The three builds measured here took **74 s, 157 s and
166 s**, and the r4 builds 238 s and 254 s: all inside the request bound, with
the poll covering anything that crosses it. Nothing measured shows a build
losing to its wait, so sizing one would have been a guess.

### Files changed

New:

- `packages/test-runner/src/flow-lane/terminal-run-wait.ts`
- `packages/test-runner/src/existing-fluxiq-control/{index,api-readings,adaptation-consequences,adaptation-evidence-loop}.ts`
- `packages/test-runner/src/existing-fluxiq-control/tests/adaptation-evidence-loop.test.ts`
- `packages/test-runner/src/flow-lane/creation/tests/parked-proposal.ts`
- `scripts/lab/live-campaign/row/consequences.mjs` and its test

Changed: `packages/test-runner/src/existing-fluxiq-control.ts`,
`flow-lane/{persisted-flow-run,index}.ts`,
`flow-lane/creation/{build-proposal,lane,snapshot,instruction-task}.ts`,
`scripts/lab/live-campaign/{lab-run/command,row/index,row/summarize-task,summary/markdown,summary/totals}.mjs`,
`docs/architecture/testing-facility.md`, and the tests of each.

**Two files were over the 800-line limit** after the additions and were split by
responsibility rather than trimmed: `existing-fluxiq-control.ts` (927 → **716**)
into the directory beside it, and `persisted-flow-run.ts` (852 → **674**) into
`terminal-run-wait.ts`, which takes the reader as an argument so the run detail
stays where it belongs.

## Commands run and observed results

### The three-task pilot, live against the real DeepSeek in `.env.local`

One campaign, `FLUXIQ_TEST_ENV_FILES=none FLUXIQ_LAB_INSTANCE=t094`, no web
panel started or managed, 94 provider calls and **$0.476** in total. Written to
`test-runs/campaigns/t094-pilot/`.

```
FLUXIQ_TEST_ENV_FILES=none FLUXIQ_LAB_INSTANCE=t094 \
FLUXIQ_LAB_CAMPAIGN_CATALOG=<the override below> \
node scripts/lab/live-campaign.mjs everything-store-first-page-plus-earbuds \
  company-website-quote-request social-network-feed-group-post \
  --output test-runs/campaigns/t094-pilot
```

The catalog override is four lines that re-export the real corpus with
`permits: ["send_or_publish", "create_new"]` added to
`social-network-feed-group-post` — exactly the line the corpus needs and cannot
carry yet, since `apps/scenario-lab/**` is outside this task's Owns. It proved
the per-task path end to end: the dry run shows `--llm-permit
send_or_publish,create_new` on that one command and on neither of the others.

**The three rows, as the summary prints them.**

| Task | Run | Verdict | Build | Flow created | Created Flow nodes | Declared consequences | Judgement | Calls | Cost USD | Failure |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `everything-store-first-page-plus-earbuds` | `run-mudv54bp-e9c9e170` | failed | **proposed** | yes | 9 nodes: `web.dom.click` ×4, `web.dom.extract_list` ×1, `web.dom.type` ×1 | nothing lasting (32 of 32 actions); allowed by nothing lasting | dataset `extract-first-page`: **no** | 14 | 0.0768 | `runtime.behavior`; `target_not_found/web.target.not_found` |
| `company-website-quote-request` | `run-mudvfi8m-230566df` | failed | **failed** | no | — | not recorded | not measured | 48 | 0.2386 | `runtime.behavior`; `flow_bootstrap.evidence_unusable_decision` / `bootstrap.invalid_subflows` |
| `social-network-feed-group-post` | `run-mudvjt43-43703e88` | failed | **proposed** | yes | 10 nodes: `web.dom.click` ×4, `web.dom.type` ×1 | **`send_or_publish`; allowed by instruction; instruction also asks for `create_new`, declared by nothing** | playback goal: **no** | 32 | 0.1607 | `runtime.behavior`; `target_not_found/web.target.not_found` |

**Every row is a product verdict, and none of the three failed for a reason
about the harness.** Two builds produced a Flow, each Flow ran and each failed
on the page (`web.target.not_found`); one build did not produce a Flow and says
why in Core's own code. Every row carries the calls and the cost it really
spent. No row is `environment.missing`, and no row is `performance.budget`.

**Three of the changes are visible in these rows, and the first one saved a row
outright.**

- **`run-mudv54bp-e9c9e170` carries `unsettled: "recovery"`.** Core never wrote
  the recovery record for that run. Under the old rule the Lab would have waited
  the grant's whole lease and failed the row `performance.budget` — the exact
  loss that was `run-mudslg9p-c59266aa`. Instead it waited five minutes from the
  first terminal read, reported the run as it stands, and said that the record
  is missing rather than absent. The row's Flow, its nine nodes and its dataset
  judgement all exist because of that.
- **`run-mudv54bp-e9c9e170` reports 14 calls where the loop made 13.** The extra
  one is the instruction-authority derivation, which the cross-check forces.
  Every per-build call count this facility has published was short by exactly
  that; the record now carries `loopProviderCalls: 13` beside it.
- **`run-mudvjt43-43703e88` is the first campaign row ever to say what a Flow's
  steps declared.** 33 actions were put to the gate; 28 declared nothing lasting;
  five declared `send_or_publish`, among them the `flow_step` press the saved
  Flow runs. `answeredBy: "instruction"` — the grant held both classes and was
  not needed, because Core read the person's own words as asking for them. And
  the cross-check's finding travelled with it: the instruction also asks for
  `create_new` and **nothing declared it**. That is A13's contradiction, in a
  campaign row, for the first time.

### Deterministic

| Command | Observed |
| --- | --- |
| `node --test "packages/test-runner/dist/**/tests/*.test.js"` | **`# tests 1309 / # pass 1309 / # fail 0`** (1,299 before; 10 new) |
| `node --test "scripts/lab/**/tests/*.test.mjs"` | **`# tests 89 / # pass 88 / # fail 0 / # skipped 1`** (79 before) |
| `pnpm --filter @fluxiq-web-extension/test-contracts test` | `# tests 125 / # pass 125 / # fail 0` |
| `pnpm --filter @fluxiq-web-extension/scenario-lab test` | `# tests 571 / # pass 571 / # fail 0` |
| `npx tsc -p packages/test-runner/tsconfig.json --noEmit` | clean |
| `pnpm check` | **exit 0**; `structure-audit: passed (97 warning(s), 121 baselined)` |
| `pnpm build` | exit 0 |

New tests: 6 in `existing-fluxiq-control/tests/adaptation-evidence-loop.test.ts`
(the call-count arithmetic, including the two ways a record can fail to add up),
3 in `flow-lane/creation/tests/build-proposal.test.ts` (a proposal carrying an
unanswered question; the declarations and cross-check read from
`metadata.bootstrap`; the total call count), 8 in
`scripts/lab/live-campaign/row/tests/consequences.test.mjs`, 1 in
`scripts/lab/live-campaign/tests/lab-run-command.test.mjs`.

**Three existing tests asserted behaviour this task deliberately changed**, and
each was rewritten rather than removed: `granted-run-settlement.test.ts`'s
recovery-deadline test now asserts that the run is returned and marked, with a
new sibling asserting that a missing *verdict* still fails; `build-proposal.test.ts`
and `lane.test.ts` dropped the extra `get-flow-adaptation` call from their
expected call order, because the reader that made it could never find anything.

## Not verified

- **No row ended `permission_required` live.** The path is unit-tested through
  Core's own gate and cross-check (`parked-proposal.ts` builds the proposal with
  the real gate and reads it with the real reader), and the r4 row it was built
  for is reproducible in principle — but on this pilot the extraction build
  declared nothing lasting, and the consequential build's classes were covered
  by the instruction. **So `answeredBy: "nobody"` has never been observed live**,
  and neither has `answeredBy: "campaign"`: the one task granted permits did not
  need them.
- **`permits` reached a run only through a catalog override.** No fixture in the
  corpus declares it, because `apps/scenario-lab/**` is outside this task's
  Owns. What the corpus needs is one field per consequential task, and the
  override in the scratchpad shows the exact shape.
- **The recovery record's five-minute bound is reasoned, not measured.** No
  recovery has been observed to complete in this facility at all, so "longer
  than any observed" is a weak claim; what is measured is that ten minutes was
  not enough on two runs and that the record never arrived on either.
- **The verdict half of the terminal wait is unit-tested only.** No live run has
  expired waiting for a verdict.
- **`unsettled` is only ever `"recovery"` by construction**; nothing proves Core
  cannot leave something else unwritten.
- **Row 2's build spent its whole 48-call ceiling.** Whether
  `flow_bootstrap.evidence_unusable_decision` there is the model looping or the
  ceiling cutting a build short is not answered by this row.
- **No browser-level validation of my own changes.** The pilot drove a real
  Chromium extension; nothing I changed is extension or domain code.
- **`pnpm test` was not run**; `pnpm check`, `pnpm build` and the four suites
  above were.

## Open questions or contradictions found

1. **The corpus needs `permits`, and it is one line per task.** Until a
   consequential task declares what its instruction asks for, a campaign's only
   second opinion is an operator's blanket `--llm-permit`, which would hide the
   over-declaration the measurement exists to find. The tasks that plainly ask
   for an act are `everything-store-buy-kettle` (`move_money`, `create_new`),
   `crossborder-marketplace-buy-hub`, `auction-marketplace-place-bid`,
   `local-classifieds-make-offer`, `social-network-feed-group-post`,
   `professional-network-withdraw-stale-requests`, `bigbox-retail-pickup-cart`,
   `company-website-quote-request`, `job-board-save-halvard-week` and
   `photo-social-glaze-collection` — but **each of those is a judgement about
   the instruction's words and belongs to whoever owns the fixture**, so I have
   listed them rather than decided them.
2. **A13's contradiction is now visible and still does nothing.**
   `run-mudvjt43-43703e88` says the instruction asks for `create_new` and that
   nothing declared it, on a Flow that was proposed, applied and run. The row
   carries it; no gate reads it. Whoever decides whether that should block an
   apply now has a campaign-scale way to see how often it happens.
3. **Core's recovery wrote no record on either run that waited for one.** Two
   runs, two different tasks, both `diagnose_and_adapt`, and
   `metadata.llmGate`/`metadata.recoveryTrace` never appeared. Either Core's
   post-run recovery is not running for a created Flow's playback, or it ends
   without writing. That is a Core question and it is not mine; what is mine is
   that it no longer costs a row.
4. **A build's own waits were not changed, and one is closer than it looks.**
   The generation request is bounded at 300 s and the r4 builds took 238 s and
   254 s. The poll behind it covers a build that crosses the bound, up to 675 s,
   so nothing is lost today — but a build that grows another minute will start
   taking the recovered-after-timeout path routinely, and nothing measures how
   often that happens.
5. **`runnerMessage: "unclassified (finalized-bundle, scenario.execute)"` on
   row 2 says nothing.** It is the facility's own diagnostic for a run that
   finished its bundle with no classified facility failure, and it reads like a
   defect beside a perfectly good product verdict. It predates this task.
