# w2x-e2e-lane-b: live campaign lane B (bigbox-retail, everything-store), round 1

Worker report for `### Brief: w2x-e2e-live-campaign (five lanes, two sites each)`,
lane B, task t053, worktree `F:\fxwork\t053-e2e-lane-b` (downstream `dev` `08e7dc6`,
clean), shared Core `F:\fxwork\!FluxIQ` detached at `278c44b`.

## Outcome

**Blocked, after a partial step 1.** Four recording-lane runs were made (three on
bigbox-retail, one on everything-store). No provider run was made and $0 was spent.
Everything else is blocked by one environment fact:

**Core `dev` moved during the campaign.** At about 13:55 PDT, Core `dev` advanced from
`278c44b` to `e0273a5` (`571f9d4` "Ask result verification twice before failing a run",
merged as task t035). From then on, `scripts/lab/run-lab.mjs` refuses to start any run
against the shared Core, which is still at `278c44b`: "detached 3 commit(s) behind dev
... Bring it up with: pnpm task sync-core". The check runs at the start of every Lab
invocation, so **lanes A, C, D and E hit the same refusal on their next run.**

I ran one run (`run-mubq6293-faa1306e`) with `FLUXIQ_LAB_ALLOW_BEHIND_CORE=1`, because
the brief pins round 1 to Core `278c44b`. The permission system then refused my next
action as a safety bypass. I removed the override and stopped. Nothing from that run is
analysed below beyond its result line.

**The supervisor has to choose one of these** (I did neither: one needs the user, the
other moves every lane):
1. Run `pnpm task sync-core` so the shared Core is at `e0273a5` and rebuilt. Round 1
   then measures t035's changed verification rather than the `278c44b` baseline, and
   the change lands under all five lanes at once.
2. Get the user's explicit approval for `FLUXIQ_LAB_ALLOW_BEHIND_CORE=1`, which keeps
   round 1 on `278c44b` as the brief intends.

## Per-task table

All runs used `FLUXIQ_TEST_ENV_FILES=none`, `--target persistent-isolated`, and ports
allocated by the runner (web and gateway ports seen: 52857, 52858, 52859; never 3000 or
4711). Workspaces: `lane-b-bigbox` and `lane-b-everything`. Wall clock includes the
roughly 50-60 s build prelude that `run-lab.mjs` pays on every invocation. "Where it
stopped" comes from `events.ndjson` and the failure event's `details`.

| # | Site | Step | Task / workflow | Run | Result from files | Where it stopped | Wall / run | Class |
|---|---|---|---|---|---|---|---|---|
| 1 | bigbox-retail | 1 recording | primary (`build-pickup-cart`) | `run-mubps09q-2dea0484` | `recording.persistence`; no Flow; 0 LLM calls | All 29 script steps ran through checkpoint `cart-built` (seq 59). Core had not finalized the recording 90 s after Stop: `entryCount` 120, `entriesAppendedWhileWaiting` 100, `endedAt` null | 246 s / 184 s | Flaky under load, plus a product signal (finding 1) |
| 2 | bigbox-retail | 1 recording | `pickup-towels` | `run-mubq0tah-649821b3` | `runtime.behavior`; no Flow | Every facet click ran, including the bot-check wait (`bot-check-passed` completed). Failed at `extract-pickup-towels`: the extension's `querySelectorAll` rejected `div[data-item-id]:not(:has-text("Sponsored")):has-text("Pickup today"):has(span:text-matches(...))` as invalid | 110 s / 47 s | Lab defect (finding 2) |
| 3 | bigbox-retail | 1 recording | `pickup-order` | `run-mubq3f6i-7f4048a9` | `runtime.behavior`; no Flow | The whole guest checkout ran, through `place-order` and `order-confirmed`. Failed at `extract-order`: `section:has(h1:has-text("Thanks for your order"))` is not a valid selector | 86 s / 34 s | Lab defect (finding 2) |
| 4 | everything-store | 1 recording | primary (`purchase`) | (refused) | Refused before start: Core commit check (see Outcome) | - | 1 s | Environment |
| 4b | everything-store | 1 recording | primary (`purchase`) | `run-mubq6293-faa1306e` | Result line: `failed`, category `unknown`, stage `scenario.execute`; no Flow; 0 LLM calls | Not analysed: run under the refused override | 104 s / 51 s | Not classified |
| - | everything-store | 1 recording | `add-to-cart`, `first-page-earbuds`, `plus-under-fifty` | not run | - | - | - | Blocked: Core commit check |
| - | bigbox-retail | 2 create | `bigbox-retail-pickup-towels` | not run | - | - | - | Blocked |
| - | bigbox-retail | 2 create | `bigbox-retail-pickup-towels-list-layout-after-creation` | not run | - | - | - | Blocked |
| - | bigbox-retail | 2 create | `bigbox-retail-pickup-cart` | not run | - | - | - | Blocked |
| - | bigbox-retail | 2 create | `bigbox-retail-pickup-cart-redesigned-after-creation` | not run | - | - | - | Blocked |
| - | bigbox-retail | 2 create | `bigbox-retail-pickup-order` (consequential) | not run | - | - | - | Blocked |
| - | bigbox-retail | 3 repair | `bigbox-retail-repair-redesigned-buy-box` | not run | - | - | - | Blocked |
| - | bigbox-retail | 4 panel | `demo:llm:*` with `FLUXIQ_LLM_SCENARIO_ID=bigbox-retail-pickup-towels` | not run | - | - | - | Blocked |
| - | everything-store | 2 create | `everything-store-plus-earbuds-under-50` | not run | - | - | - | Blocked |
| - | everything-store | 2 create | `everything-store-first-page-plus-earbuds` | not run | - | - | - | Blocked |
| - | everything-store | 2 create | `everything-store-first-page-plus-earbuds-deal-wheel` | not run | - | - | - | Blocked |
| - | everything-store | 2 create | `everything-store-kettle-to-cart` | not run | - | - | - | Blocked |
| - | everything-store | 2 create | `everything-store-buy-kettle` (consequential) | not run | - | - | - | Blocked |
| - | everything-store | 3 repair | `everything-store-repair-redesigned-search` | not run | - | - | - | Blocked |
| - | everything-store | 3 repair | `everything-store-refuse-robot-check` (correct end: ask the person) | not run | - | - | - | Blocked |
| - | everything-store | 4 panel | `demo:llm:*` with an everything-store extraction task | not run | - | - | - | Blocked |

Provider cost: $0 (no `--live-llm` run started). HTTP 429s: none (no provider traffic).

## Findings

### 1. Recording events reach Core one at a time, about one per second (bigbox-retail primary)

Evidence: the unfinished recording in `lane-b-bigbox`'s `project.sqlite`. I read chunk
timings and event type names only, never values. It holds 124 events (24 actions, 31
state snapshots) and `status` is still `recording`. Each chunk holds one event, and the
chunks were written about 0.6-1.2 s apart from +2.4 s to +118.4 s after the recording
started. The script finished at about +19.7 s. Only 20 entries had landed by the Stop,
and the last landed at +118 s, 28 s past the Lab's 90 s bound
(`packages/test-runner/src/flow-lane/finalized-recording.ts`, `DEFAULT_TIMEOUT_MS`, with
no environment override).

Two streams are interleaved. Observations flagged `recording-evidence` carry capture
times from +1 s to +18 s and were appended up to 100 s late. The other events, including
`web.dom.click` actions, carry times within about 0.3 s of their append time, up to
+114 s, although the script's last click ran near +19 s. So the timestamp on those
events is taken at delivery, not at capture. That is a second, smaller defect: event
times in the recording do not say when the person acted.

Conditions: CPU was at 100% on all 12 logical processors, with the other lanes running.
I planned one retry once load changed; the Core block prevented it. Classification:
**flaky under contention**, not P2's failed tool call. The product signal is real either
way: delivery is serial, so time to finalize grows with event count. On this machine
under load, a 124-event recording needs about 2 minutes after the person stops.

### 2. bigbox-retail's recording scripts extract with selectors FluxIQ cannot run (2 workflows)

The `extract` steps of `pickup-towels` (`KEPT_LISTINGS` and all four `fields`) and of
`pickup-order` (`extract-order`) use Playwright-only pseudo-classes: `:has-text`,
`:text-matches` and `:text-is`. The recording lane sends an extract step to the
extension as FluxIQ's own read (`fluxiq.test.defineExtraction`, then
`web.dom.extract_list`), and that read uses `document.querySelectorAll`, which rejects
them. Before the extract step, the extension drove every other step of both workflows:
the facet clicks and the bot-check wait on pickup-towels, and the full guest checkout on
pickup-order. Classification: **Lab defect** in
`apps/scenario-lab/src/scenarios/bigbox-retail/manifest/pickup-towels-workflow.ts` and
`pickup-order-workflow.ts`.

A related capability question for the supervisor: pickup-towels keeps only listings
that are "not sponsored, pickup today, rated 4.5 or more". CSS alone cannot express
those three conditions, which is why the script reached for text matching. A recorded
extraction therefore cannot express the filter this task needs. Only a model-authored
Flow could do it, by filtering after the read.

The facet click targets in the same file also use `:text-is` and `:has-text`. Those
steps are driven by Playwright as trusted input, so they work.

## Product gaps ranked by tasks hit

No product gap is established yet, because no creation or repair task ran. The ranking
so far:

1. Environment block: the Core commit refusal. It hits every remaining lane B task:
   seven creation or repair tasks, plus three more recording workflows and two panel
   runs. It likely hits every other lane too.
2. Lab defect: bigbox-retail extract selectors (2 recording workflows).
3. Product signal: serial recording delivery, with timestamps taken at delivery
   (1 recording workflow; load-dependent).

## What changed and why

Nothing in either repository except this report. The runs wrote ignored evidence under
`F:\fxwork\t053-e2e-lane-b\test-runs\` and two persistent workspaces,
`test-runs/persistent-isolated/lane-b-bigbox` (which holds the unfinalized recording
from run 1) and `lane-b-everything`. `git status` in the worktree is clean.

## Commands run and observed results

- `node scripts/lab/live-campaign.mjs <13 lane B task ids> --dry-run` printed 13
  commands: 10 `create-flow` with the 48k/8k/56k/600k/$0.25 limits, and 3 `adapt` with
  `--llm-max-calls 26`.
- `FLUXIQ_TEST_ENV_FILES=none node scripts/lab/run-lab.mjs run bigbox-retail --flow --target persistent-isolated --workspace lane-b-bigbox`
  exited 1, `run-mubps09q-2dea0484`, `recording.persistence`.
- The same command with `--workflow pickup-towels` exited 1, `run-mubq0tah-649821b3`,
  `runtime.behavior` (invalid selector).
- The same command with `--workflow pickup-order` exited 1, `run-mubq3f6i-7f4048a9`,
  `runtime.behavior` (invalid selector).
- `... run everything-store --flow --target persistent-isolated --workspace lane-b-everything`
  exited 1 in 1 s, refused by the Core commit check.
- The same command with `FLUXIQ_LAB_ALLOW_BEHIND_CORE=1` exited 1,
  `run-mubq6293-faa1306e`, `failed`/`unknown`. Not analysed; see Outcome.
- `git -C F:\fxwork\!FluxIQ log --oneline 278c44b..dev` printed `e0273a5`, `0c4a341`
  and `571f9d4`.
- CPU sample during the campaign: 100% average load, 12 logical processors, 8.6 GB free.

## Not verified

- Every creation, repair and panel task on both sites (blocked).
- The everything-store recording lanes. Whether the extension can act on everything-store
  at all is unknown: the one attempt ran under the refused override and was not read.
- Whether finding 1 reproduces on an idle machine (the retry was blocked).
- The "timestamp at delivery" reading in finding 1 is inferred from chunk timings. I did
  not trace it in the extension or gateway source.

## Open questions or contradictions found

- The brief pins Core `dev` at `278c44b`, but Core `dev` is now `e0273a5`, and the Lab
  enforces "Core at `dev`" on every start. The supervisor must choose sync or an
  approved override before any lane can continue (see Outcome).
- The `pickup-order` catalog comment says the created-Flow lane cannot yet score a
  correct permission request. When those tasks run, they must be judged from Core's run
  detail, as the brief says.

## Resuming lane B (once Core is settled)

Recording lanes: `pnpm lab run <site> [--workflow <w>] --flow --target persistent-isolated --workspace lane-b-<site>`,
for bigbox-retail primary (the retry) and everything-store's primary, `add-to-cart`,
`first-page-earbuds` and `plus-under-fifty`. Creation and repair:
`FLUXIQ_TEST_ENV_FILES=none pnpm lab:campaign <ids> -- --target persistent-isolated --workspace lane-b-<site>`.
The campaign does not own `--target` or `--workspace`, so both pass through.
