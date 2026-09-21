# w2x-e2e-live-campaign — lane A (`social-network-feed`, `photo-social`)

Status: **interim, paused by the supervisor for a shared-Core sync** (2026-09-21 21:05Z).
Worktree `F:\fxwork\t052-e2e-lane-a` (task t052), downstream `08e7dc6`, Lab instance
`t052-lane-a`, persistent-isolated workspace `t052-snf`. Every run below is **round 1 on
Core `278c44b`**.

## Outcome

Partial. Eight of the lane's runs are complete, all on `social-network-feed`; ten tasks
were not started when the pause arrived.

## Per-task table (round 1, Core 278c44b)

| # | Task | Run | Flow? | Calls: build / observed | Oracle / records | Failure (code, stage) | Where it stopped | Cost | Wall clock | Class |
|---|---|---|---|---|---|---|---|---|---|---|
| R1 | recording lane, primary (`group-post` path) | run-mubpro3z-592a7ec1 | yes | 0 / 0 | oracle passed | none | end; 11 actions, all succeeded | $0 | 156.8 s run, 3.5 min with build | pass |
| R2 | recording lane, `feed-digest` workflow | run-mubpx7an-e8ac297c | no | 0 / 0 | not reached | `runtime.behavior`: the extension refused its own extract (`run_failed`, message "List extracted.") | at `extract-feed-digest`, after 14 scrolls and 4 "See more" presses | $0 | 61.8 s | Lab defect (below) |
| R3 | recording lane, `confirm-requests` | run-mubq047k-a64aaf78 | yes | 0 / 0 | passed, 4/4 matched | none | end; 31 actions | $0 | 151.5 s | pass |
| R4 | recording lane, `move-open-day` | run-mubq4ndr-bf969433 | yes | 0 / 0 | passed, 1/1 matched | none | end; 24 actions | $0 | 117.6 s | pass |
| C1 | `social-network-feed-group-post` | run-mubq9zmu-dc57d4bc | no | 3 / 3 | not reached | `flow_bootstrap.evidence_tool_failed`, `provider_output_validation`, HTTP 400 | home feed behind "Turn on notifications?"; trace inspect → press → navigate, all succeeded, then the third decision's tool threw | $0.0136 (30,422 tok) | 48.8 s | product gap, **P2** |
| C2 | `…-group-post-regrouped` | run-mubqc3wb-415b3dd8 | no | 3 / 3 | not reached | same as C1 | same three steps | $0.0136 (30,396 tok) | 44.1 s | product gap, **P2** |
| C3 | `…-group-post-regrouped-after-creation` | run-mubqe8yk-ab2b4089 | no | 3 / 3 | not reached | same as C1 | same three steps | $0.0136 (30,443 tok) | 42.9 s | product gap, **P2** |
| C4 | `…-feed-digest` | run-mubqfy2c-9967f366 | no | null / 1 | not reached | `lab.generation_http_400`; Core's 400 body had no diagnostic its own parser accepts | no evidence-loop record at all | not recorded | 103.7 s (build 86.0 s) | product gap (empty-diagnostic 400), not P2 |

Not started: C5 `feed-digest-quiet-feed`, C6 `feed-digest-app-install`, C7
`confirm-requests`, C8 `move-open-day` (permission case), the feed repair task, the feed
UI creation, and every `photo-social` task (1 recording, 4 creation, 1 repair, 1 UI).

## Findings so far

1. **P2, deterministic, 3 of 3 group-post builds.** Each build did an initial
   `web.inspect_current_page` and two model decisions (`web.press_control`,
   `web.navigate_same_origin`), all of which succeeded. The third decision's tool call
   then threw inside `executeTool`, and Core ended the build with
   `llm_evidence_loop.tool_failed` (`F:\fxwork\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\llm\evidence-loop.ts:447-450`),
   which becomes `flow_bootstrap.evidence_tool_failed`. The failed call is **not in the
   recorded trace**, so neither the tool nor its reason can be read from any file. That
   observability gap sits alongside P2.
2. **Lab defect: every Lab `extract` field is sent as required.**
   `packages/test-runner/src/scenario-steps/extract-intent.ts:88-92,164-173` sends
   structured field specs with no `required`, and says this is "the domain's optional
   reading". The extension reads a structured spec as `required` unless it says `false`
   (`apps/extension/src/content/extraction/field-spec.ts:14,80`). The feed digest's
   `group`, `reactions` and `comments` are legitimately empty on some posts, so the read
   reports them as missing required fields and fails validation
   (`apps/extension/src/content/actions/extract-list.ts:58,87-95`). The recording lane
   therefore cannot record the site's honest extraction path. The site is not at fault:
   its expectation spells those fields `null`.
3. **Core `dev` moved during the lane.** Core `dev` moved 3 commits past `278c44b`
   (t035) before the creation campaign started, and the Lab refused all eight tasks. That
   first campaign made no calls and spent nothing. C1-C4 then ran with
   `FLUXIQ_LAB_ALLOW_BEHIND_CORE=1`, which keeps the worktree's own pairing of
   `08e7dc6` with `278c44b`. The supervisor has since asked that this override not be
   used.

## Spend so far

$0.0408 reported (C1-C3), plus C4, whose spend was not recorded. Zero HTTP 429s.
