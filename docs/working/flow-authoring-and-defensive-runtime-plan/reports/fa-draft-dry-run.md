# fa-draft-dry-run — the draft must run again before it may be proposed (task t088)

Worktrees `F:\fxwork\t088\!FluxIQ` and `F:\fxwork\t088\!FluxIQWebExtension`, both
on `task/t088-draft-dry-run`. No commit was made.

## Outcome

**Done.** A build can no longer propose a Flow it has not just watched run. When
the model completes, Core puts the page back where the draft's first step found
it, runs every step the draft proposes in order with the parameters the Flow
keeps, and refuses the completion back to the model unless all of them come
back. No provider is called for any of it.

**Proved live**, run **`run-muditxzh-a7ae883d`** (everything-store,
`everything-store-first-page-plus-earbuds`, real DeepSeek from `.env.local`):

- The dry run **ran twice**, at loop iterations 14 and 15, each time resetting
  the page and replaying five proposed steps.
- **Attempt 1 refused the proposal** (`ok: false`). The model was asked again,
  spent one more decision, finished again, and **attempt 2 passed**.
- **Zero provider calls for either replay.** Core's own loop accounting was
  byte-for-byte identical either side of each one
  (`{"iterations":14,"toolCalls":10,"totalTokens":171494,"estimatedCostUsd":0.0766…}`),
  and the Lab's independent count agrees: `build.providerCalls` **16** ==
  `observed.calls` **16** in `snapshots/live-llm.json`.
- **Measured cost: 7,262 ms and 7,108 ms** for one reset plus five steps —
  about **1.2 s per act**, against the plan's estimate of 2.3 s per node plus
  1 s of reset. Two attempts cost 14.4 s of a 105 s build, so **14%**.
- `build.outcome: "proposed"`, `adaptation.bootstrap.142e3612-…`.

**The open question the plan asked me to answer: the reset is the page.** See
*The reset* below for what that costs and what it cannot do.

## What changed and why

### Core (`F:\fxwork\t088\!FluxIQ`)

**New — `runtime/flow-draft/dry-run.ts`.** The rule and the verdict. Which
drafts can be replayed at all, what a replay's answers make of one, the issue
codes a refusal is counted under, and the feedback the model is shown. Four
statuses, because they are four different findings and the model's correction
differs for each: `replayed`, `failed` (it did not run), `changed` (it ran and
produced nothing where it produced something), `unreproducible` (see below).

**New — `runtime/llm/node-tools/replay.ts`.** How one step is asked for:
`{ replay: "reset", from }` and `{ replay: "step", …ranWith }`, and the closed
five-code vocabulary the caller answers in. Core reads the answer and knows no
domain's codes, so the codes are Core's.

**New — `runtime/llm/node-tools/replay-draft.ts`.** One whole replay: the
reset, then every proposed step, each through **`input.executeTool`** — the
loop's own executor.

**New — `runtime/llm/node-tools/dry-run-gate.ts`.** The loop's gate: what has
already replayed clean, what has already been put to the model, and what a
refusal does to the evidence the next decision sees. Extracted from the loop so
`evidence-loop.ts` stays at 741 lines rather than 795.

**`runtime/flow-draft/step.ts`.** A step gains `replay` — what the caller says
running it again would need, carried opaquely — and `replayed`, how it answered
the last replay. `entry.ts` shows the second on each step line, so the verdict
travels with the draft the model always sees rather than only in a refusal the
window may evict.

**`runtime/llm/evidence-loop.ts`.** On a `complete` decision, after
`checkCompletion` has passed, the gate runs; a refusal takes the existing
`unusable` path, so the model is told in the vocabulary it already knows and
asked again. The execution result's `draft` statement gains `replay`, parsed
strictly in `evidence-loop-decision.ts` and carried onto the step.

**`runtime/llm/loop-configuration.ts`.** `dryRun?: false`, documented as being
for a caller whose actions cannot be taken twice and never for finishing sooner.

**`runtime/llm/node-tools/run-node.ts`** — the coordinator's request, not the
brief's. Both sentences about `consequences` demonstrated the empty answer, and
t081 measured four live builds declaring `[]` for every press including one that
publishes. The nine-verb menu is gone from the empty case; the class list is
interpolated from `AUTOMATION_STUDIO_ACTION_CONSEQUENCES`; the same sentence now
carries the other half ("a node that sends, publishes, orders, deletes or
changes something saved names its class and is put to the person first"); and
the worked example shows both sides in one Flow ("the press that applies a
filter is [] and the press that submits the post is send_or_publish"). The
example's class is a typed constant read off the declared classes, so renaming
one is a compile error here.

**New — `runtime/llm/node-tools/tests/run-node.test.ts`.** Five tests, and the
reason for them is run 4 below: this description has a hard 2,000-character
bound and nothing checked it while the prose was being edited. The test asserts
through `automationStudioLlmEvidenceValidTools`, the validator the loop runs, so
it is the real gate and not a number copied beside it.

### Downstream (`F:\fxwork\t088\!FluxIQWebExtension`)

**New — `domain/src/runtime/llm-evidence/node-run/replay.ts`.** The web's half.
A reset navigates to the location the first proposed step recorded. A step runs
`gateway.executeAction` with the node's own command and the parameters the draft
kept — the command `io/gateway-output-dispatcher.ts` sends, so what is proved is
the Flow and not a rehearsal. `webNodeRecordCount` reads the longest list a
payload carries, which is how 16 rows becoming 0 is caught.

**`node-run/run.ts`.** Routes a replay call before anything else, and writes
`replay: { from: { location }, produced: { records } }` onto every step it runs.

**`llm-evidence/capture.ts`.** One optional field on the draft statement type.

### Three design decisions worth arguing with

**1. The seam is the executor, not a new binding field.** A replay goes through
`input.executeTool`, which on the authoring path is
`flow-bootstrap/action-permissions.ts`'s wrapper. So **the brief's requirement
that the replay be gated by `AutomationStudioActionPermissionGate` is satisfied
by construction**: the same `gate.checkFor` runs for a replayed step as for the
original, with the same grant, and a raised request throws and ends the build
exactly as it does during exploration. A seam of its own would have been a
second place for that gate to be forgotten. It also means **no line in
`service.ts` was needed** — the brief expected one; there is none, and
`service.ts` is byte-for-byte unchanged.

**2. The gate is opt-in by evidence, not by configuration.** It applies only to
a draft whose proposed steps all carry a `replay` statement. A host that cannot
replay is never held to a check it could not pass, and no host had to be edited
for this to switch on. The domain opts in by writing the statement.

**3. `unreproducible` is a question asked once, and it is the one soft edge.**
A page-level reset cannot undo a step the *site* remembers — a consent banner
answered stays answered. Refusing the whole draft for that would push the model
to delete exactly the dismissals round 1 lost. So a step whose failure is
`target_not_found` is reported `unreproducible`; the model is told once, and a
model that finishes again with the step kept has answered. `failed` and
`changed` are hard refusals with no such escape. **This is the weakest part of
the design and it is deliberate**: C1 (a draft step conditional on a state
check) is what turns the question into a Flow that handles the case, and until
C1 exists the alternatives are a soft edge or a build that cannot finish.

### The reset: the page, and what that costs

**It is the page.** A `web.browser.navigate` to the location the draft's first
proposed step recorded, through the same node the Flow uses. **Measured at about
1.2 s**, inside a 7.2 s replay of six acts.

It is not the workspace and not the browser context, and neither was available:
the domain reaches the browser only through `gateway.executeAction`, which runs
page actions. A fresh context would need a new extension capability; a fresh
*site* session is not reachable at all — `everything-store` keeps its state on
the server, per server, so only the Lab's own `/reset` control clears it, and
that control is the fixture's and must not be in the product's path.

**What that means, stated plainly.** The dry run proves *"these steps still work
as a Flow, in order, from where this build started"*. It does **not** prove
*"this Flow works on a cold start"*. The gap is exactly the `unreproducible`
steps: live, both builds' consent-banner and notification dismissals came back
`unreproducible`, because the build had already answered them. A cheaper reset
does not exist here; a more faithful one needs a capability that does not.

## Commands run and observed results

### Live, against the real DeepSeek in `.env.local`

Isolated Lab instance `t088`, `FLUXIQ_TEST_ENV_FILES=none
FLUXIQ_TEST_TARGET=isolated FLUXIQ_LAB_ALLOW_BEHIND_CORE=1`. No web panel was
started or managed. Same scenario and instruction task as t082, so the
comparison is like for like.

| # | run id | observed |
| --- | --- | --- |
| 1 | `run-mudieet7-58b16762` | Built a Flow; the **Lab** then refused to read it — `metadata.phase9 created evidence audit exceeded its bounded contract`. t082's open question 3, not this task's code. |
| 2 | `run-mudinii8-13df465c` | With `--llm-max-calls 16`. **The dry run ran**: reset ok, 6 steps, 3 `unreproducible` dismissals and 3 `replayed` including the extraction. The Lab then failed the run on its own budget (20 actual calls against 16 authorized — t082's open question 4). |
| **3** | **`run-muditxzh-a7ae883d`** | **The proof.** Two replays, the first refusing the proposal and the second passing after the model was asked again. 16 == 16 provider calls, $0.0827, `build.outcome: "proposed"`. Ended on the Lab's wait for Core's post-run recovery, not on the build. |
| 4 | `run-mudkec90-f2489d35` | **A defect this task introduced, found live and fixed.** `flow_bootstrap.provider_request_failed`, HTTP 400, at the first provider request, before a node ran. My rewritten `consequences` guidance took the run-node tool's description to **2,179 characters** against a **2,000-character bound** enforced in three places (`harness-options/option.ts:114`, `deepseek-provider.ts:551`, `evidence-loop-decision.ts:220`). Nothing in the failure said so. Rewritten to **1,981**, and `node-tools/tests/run-node.test.ts` now pins it through the validator the loop itself uses, so the next person editing this prose is stopped by a test rather than by a dead build. |
| **5** | **`run-mudkkdpc-774ee159`** | **The regression check on the prose.** With the description at 1,981 characters the build runs again: 24 decisions, `build.outcome: "proposed"`, `adaptation.bootstrap.6600781d-…`, $0.1019, `toolCallCount` 16. **`build.providerCalls` 24 == `observed.calls` 24** — the dry run cost nothing here either. `instructedConsequences: []` and `permissionRequest: null`, which is correct for this task and is why it cannot answer the consequences question. The Flow then failed its own run `unexpected_state`. |

**The two probe lines from run 3**, which are the measurement (the probe was
temporary instrumentation in `evidence-loop.ts` and has been removed; the file
is clean and `grep t088` finds nothing):

```
[t088-dryrun] attempt 1 starting; accounting {"iterations":14,"toolCalls":10,"totalTokens":171494,"estimatedCostUsd":0.07662951999999999}
[t088-dryrun] attempt 1 finished in 7262ms over 5 step(s); accounting {…identical…}; unchanged=true; verdict {"reset":"ok","ok":false,"outcomes":[
  {"step":2,"actionId":"web.output.dom-click","status":"unreproducible"},
  {"step":3,"actionId":"web.output.dom-type","status":"replayed"},
  {"step":4,"actionId":"web.output.dom-click","status":"replayed"},
  {"step":5,"actionId":"web.output.dom-click","status":"unreproducible"},
  {"step":13,"actionId":"web.output.dom-extract_list","status":"replayed"}]}
[t088-dryrun] attempt 2 starting; accounting {"iterations":15,"toolCalls":10,…}
[t088-dryrun] attempt 2 finished in 7108ms over 5 step(s); …; unchanged=true; verdict {"reset":"ok","ok":true,…}
```

### Checks

| Command | Where | Observed |
| --- | --- | --- |
| `npx tsc -p tsconfig.json --noEmit` | Core `packages/fluxiq` | clean |
| `npx vitest run …/flow-draft …/llm …/flow-bootstrap` | Core | **58 files, 637 tests, 637 passed** |
| `npx vitest run …/automation-studio/runtime` | Core | 2,059 passed, **18 failed**, 1 skipped — see below |
| `pnpm check` | Core | **exit 0**; `structure-audit: passed (176 warning(s), 360 baselined)` |
| `wc -l runtime/service.ts` | Core | **4,637 — unchanged, and not edited** |
| `npx tsc -p domain/tsconfig.json --noEmit`, `-p domain/tsconfig.test.json` | downstream | clean |
| `DOMAIN_TEST_BUILD_LABEL=t088 node domain/scripts/test-domain.mjs` | downstream | **# tests 744 / # pass 744 / # fail 0** (736 before; 8 new) |
| `pnpm check` | downstream | **exit 0**; `structure-audit: passed (92 warning(s), 122 baselined)` |
| `pnpm --filter @fluxiq-web-extension/extension test` | downstream | **# tests 731 / # pass 729 / # fail 2** — pre-existing, see below |

**The 18 Core failures are the environmental family, and I checked rather than
assumed.** 17 are `Test timed out in 15000ms`; the 18th is
`deepseek-bootstrap-exploration.test.ts > asks again after a decision that runs
past its deadline`, failing `flow_bootstrap.provider_transport_unknown` on a
3-second stub timeout. The baseline commit `becdf07` records clean `dev` failing
17 under this machine's load. I re-ran two of them alone:
`deepseek-bootstrap-exploration.test.ts` **8/8 passed**, and
`service-bootstrap/tests/adaptation.test.ts` **9/9 passed**.

**The 2 extension failures are t082's, already on `dev`, not mine.**
`apps/extension/src/content/identity/tests/created-node-identity.test.ts` calls
`WEB_LLM_INSPECT_TOOL_ID`, a tool t082 retired, and gets `web evidence tool is
not registered` from `tools.ts:283`. `apps/extension/**` and `tools.ts` are
untouched in this worktree (`git status` confirms), and my code is not on that
path. **This needs an owner.**

**Two structure-audit violations this task introduced and fixed:**
`failure-as-empty` in `replay-draft.ts` (a caught failure returning `undefined`
— now a named `{ readable: false }`, because "unreadable" and "nothing to check"
are opposite findings) and `contract-spread` twice in the domain's `replay.ts`
(now `present<T>()`).

## Not verified

- **That the gate has ever saved a Flow that would have been broken.** It
  refused a proposal live and the model corrected, but the refusal was two
  `unreproducible` dismissals, which is the soft edge — the model reasserted
  them and they were accepted. **No live run has yet produced a `failed` or
  `changed` step**, because in both builds every step that could be replayed
  did replay. The hard refusals are proved by unit test only.
- **That the t082 defect it was built for would be caught.** `run-mudavyub`'s
  extraction read 0 of 16 on the Lab's replay; the `changed` status exists for
  exactly that and is unit-tested, but I never reproduced that build, so the
  catch is inferred rather than observed.
- **That the Flow a gated build produces replays untouched.** Run 3's Flow still
  made 2 `loop-verification` provider calls during the Lab's replay and the run
  ended on the Lab's wait. The dry run is not the recovery ladder.
- **Whether the `run-node.ts` guidance change makes a model declare a real
  consequence class.** The coordinator asked for that measurement and I cannot
  supply it from these runs: `everything-store-first-page-plus-earbuds` is a
  search-and-extract task where `[]` is the *correct* answer for every press it
  needs, so a build on it cannot show a declared class even if the prose now
  works. **The measurement needs a task whose job is to commit something** — a
  publish, an order, a delete. Run 5 confirms only that a build completes with
  the rewritten prose and that this task's own build correctly declared nothing
  (`instructedConsequences: []`, `permissionRequest: null`).
- **`reset_failed` has no live evidence.** Every live reset succeeded.
- **Run 5's dry-run verdict is not visible.** The probe had been removed by
  then, so what that run's replay found is inferred from the build having been
  proposed at all. Run 3 is the run that shows a verdict; run 5 shows the
  provider-call equality and that the prose fix works.
- **No browser-level validation beyond the Lab's own Chromium runs.**

## Open questions or contradictions found

1. **The Lab's created-adaptation audit caps `toolCallCount` at 16, and it is
   now the thing that fails good builds.** Run 1 built a Flow and the Lab
   refused to read the record. This is t082's open question 3, unmoved, in
   `packages/test-runner/src/existing-fluxiq-control.ts:498`, which t089 owns.
   With the three-strike rule gone, builds run longer than 16 tool calls
   routinely; the cap has to move or become a warning.
2. **The instruction-authority derivation still spends grant calls the loop does
   not know about.** Run 2: 16 authorized, **20 actual**, and the Lab failed the
   run on its own budget. t082's open question 4, unmoved. Anyone measuring a
   build has to over-authorize by about four calls to get a result at all.
3. **`unreproducible` is a hole until C1 exists.** A step the site remembers is
   waved through on reassertion, and nothing downstream knows the Flow contains a
   step that could not be checked. C1 (a draft step conditional on a state check)
   closes it properly; B1a's wait ceiling and the recovery ladder make it
   survivable at run time. Until then, a Flow can ship with an unverified step
   and only this report says so.
4. **The replay's result codes are written twice.** Core owns them
   (`node-tools/replay.ts`) and the domain repeats the five strings
   (`node-run/replay.ts`), because the domain type-checks against Core's built
   `dist` and importing them would put a build-order edge between the two
   repositories for five constants. Each copy names the other. If the domain
   ever imports them, this goes away.
5. **For t081, at merge.** Your `await resolveWebPlanNodeParameters(` +
   `gatedByCaller: true` in `runWebOutputNode` is already anticipated: my
   `node-run/replay.ts` awaits the same resolver (harmless today), and its call
   **should also take `gatedByCaller: true`** once your field exists, because
   `replayStep` asks `webActionPermission` itself before resolving. That is one
   key on one object literal, in a file only this task touches.
6. **A dry run leaves the page where the replay ended, and that is now part of
   the build's contract.** The model is told so in the refusal. Nothing else in
   the loop knew a page could move without a tool call, so the gate bumps the
   mutation and attempt epochs; a future caller that adds another Core-driven
   act on the world has to do the same or the loop will answer a stale look from
   its cache.
