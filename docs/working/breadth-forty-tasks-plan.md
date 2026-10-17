# Forty-Task Breadth Round And Install Proof

Status: Active
Status detail: The 40 tasks are merged and verified; four live lanes run them; the install-package lead is working.
Created: 2026-10-17
Last updated: 2026-10-17
Owner: Senior supervisor agent
Scope: 40 new live tasks (four per realistic site), each run live, debugged and fixed; plus the install-package proof (MVP item 1). Not the adaptation gate.
Paired document: none
Related: [adaptation-and-breadth-plan.md](./adaptation-and-breadth-plan.md), [automation-project-agents-plan.md](./automation-project-agents-plan.md) (A8 launch shape), [release-packaging.md](../architecture/release-packaging.md)

---

## Current State

**User request (2026-10-17):** "create like 40 more tasks on the complex scenario websites, run them all, debug, the
whole thing. Fix anything that comes up. Do this fast!" and "also start working on the live package stuff too".

**Phase 1 (dispatched 2026-10-17):** ten authoring workers, one per site, each in its own task worktree, each adding
four tasks with oracles and browser-path proofs; one lead on the install-package proof (t706).

| Task | Site | Worktree (`C:/Users/osrs_/FluxStuff/fxwork/...`) |
| --- | --- | --- |
| t696 | everything-store | `t696-breadth-everything-store` |
| t697 | crossborder-marketplace | `t697-breadth-crossborder-marketplace` |
| t698 | bigbox-retail | `t698-breadth-bigbox-retail` |
| t699 | job-board | `t699-breadth-job-board` |
| t700 | local-classifieds | `t700-breadth-local-classifieds` |
| t701 | auction-marketplace | `t701-breadth-auction-marketplace` |
| t702 | photo-social | `t702-breadth-photo-social` |
| t703 | social-network-feed | `t703-breadth-social-network-feed` |
| t704 | company-website | `t704-breadth-company-website` |
| t705 | professional-network | `t705-breadth-professional-network` |
| t706 | install-package proof | `t706-install-package-proof` |

**Phase 2 (supervisor):** verify each site's tasks, finish t696-t705 into `dev`, then update the two shared corpus
tests (`scenarios/tests/realistic-site-live-tasks.test.ts` count and additions list;
`scenarios/tests/live-instructions.test.ts` permission map) from the workers' reports.

**Phase 3:** sync the four lane trees (t563, t565, t566, t567, both repositories) to `dev`, rebuild, and start four
live lane leads, one per `lab-slots/slot-N`, each looping run -> debug -> fix -> rerun on its own branch, with an
integration round every 60-90 minutes. Launch shape: the A8 command in `automation-project-agents-plan.md`
(`--authoring-mode project`, `--llm-max-cost-usd 0.25`, the five environment variables), workspace `bf-<task>`.

**Phases 1-2 done (2026-10-17):** all 40 tasks merged (t696-t705), the shared corpus tests updated, scenario-lab
851 of 851. **Phase 3 running:** four live lane leads. **Install proof (t706):** in progress.

## The Forty Tasks

Merged to `dev` 2026-10-17 (t696-t705); the corpus is 108 tasks. Permission points and hand-offs are declared in
each site's `live-tasks.ts` and pinned in `scenarios/tests/live-instructions.test.ts`; each site's report under
`breadth-forty-tasks-plan/reports/tasks-<site>.md` says what a correct run does.

| Site | Tasks |
| --- | --- |
| everything-store | `coupon-earbuds-rated-four`, `batteries-and-descaler`, `sage-small-kettle-if-in-stock`, `office-checkout-review` |
| bigbox-retail | `rated-delivery-towels`, `napkins-for-delivery`, `checkout-quote-without-ordering`, `new-store-cheapest-towels` |
| local-classifieds | `nearby-furniture`, `test-ride-question` (send), `carbon-price-check`, `bikes-within-alex-price` |
| crossborder-marketplace | `free-hubs-under-ten` (hand-off), `follow-official-store`, `mint-hub-fallback`, `uk-express-quote` |
| auction-marketplace | `cheap-accessory-auctions`, `save-mark-ii-sellers`, `buy-it-now-quote`, `lens-hood-seller-shop` |
| social-network-feed | `recent-group-posts`, `hide-suggested-posts`, `delete-stranger-requests` (delete), `claim-found-key` (send) |
| photo-social | `priya-tags`, `newest-likes`, `august-over-1300`, `kiln-notes` |
| job-board | `remote-easy-apply`, `save-quillmark-remote`, `halvard-labs-office-jobs`, `halvard-careers-roles` |
| company-website | `apprentices`, `newsletter-signup`, `saturday-certificate`, `heat-pump-quote` (send, hand-off) |
| professional-network | `netherlands-data-engineers`, `connect-kade-senior-engineer` (send), `accept-messaged-invitations`, `kade-lead-contact` |

Each id is `<site>-<task>`. Risks the authors named: a guard that asks at Like, Accept or Buy it now (no permission
point is declared there, so asking fails the run and is a product defect); an empty right answer
(`august-over-1300`, `halvard-labs-office-jobs`, `saturday-certificate`) if Core stores no zero-row dataset.

## Worker Briefs

### Brief: tasks-<site> (ten copies, one per row of the table above, t696-t705)
- Repository: this repository, in the site's worktree only (the table above); never the main checkout.
- Task: add four new live instruction tasks for `<site>` to `apps/scenario-lab/src/scenarios/<site>/live-tasks.ts`,
  each with an exact oracle and a qualification workflow the Lab can judge a live run by:
  1. Real requests a person would make of this site, using what the site already offers (read its manifest,
     routes, catalog and state first), and different from the site's existing tasks. Cover, one each: (a) a
     filtered extraction across pages, judged record by record; (b) a lasting act (add, save, follow, message,
     edit) judged by final state; (c) a conditional or stop case (the right answer is empty, act only on rows that
     match, or stop before a money or send step); (d) a longer journey mixing navigation, a form and a read.
  2. No drift variants (`variantId`); those belong to the adaptation gate.
  3. Every dataset column is named in the instruction; a dataset oracle lists its records, never a count alone;
     a delete, send or money act declares `permissionPoint` (the type is `scenarios/live-instructions.ts` 26-60).
  4. Oracles follow the site's existing pattern (e.g. `job-board/qualification/{workflow,expected}.ts`): a
     workflow whose `recordingScript` completes the task and an `expected` with pageFacts, finalState and
     extracted. Derive expected records from the fixture data by reading it; never guess.
  5. Browser-path tests in `<site>/tests/` prove the recording reaches each oracle and a plausible wrong path
     (unfiltered list, wrong row, an extra act) fails it; update the site's `tests/scenario.test.ts` lists.
  6. Small fixture additions inside `<site>/` are allowed when a task needs data the site lacks; keep every
     existing test passing.
- Required reads: this brief; the site's `live-tasks.ts`, `manifest.ts`, `expectations.ts`, `qualification/`,
  `tests/`; `scenarios/live-instructions.ts` lines 26-60; `scenarios/tests/realistic-site-live-tasks.test.ts`;
  `scenarios/tests/live-instructions.test.ts` lines 150-200.
- Owns (may edit): `apps/scenario-lab/src/scenarios/<site>/**` in its worktree, and its report.
- Must not touch: anything else, including `scenarios/tests/*` (shared; the supervisor updates them), Core, and
  any model guidance (tasks are scenario data; never write instructions or examples for the model).
- Definition of done: in the worktree, `pnpm.cmd --filter @fluxiq-web-extension/scenario-lab test` passes except
  the shared-list assertions in the two `scenarios/tests/` files (quote each failing line); then a provider-free
  dry run of each new task is accepted:
  `pnpm.cmd lab run <site> --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-flash --authoring-mode project --llm-task create-flow --instruction-task <id> --target persistent-isolated --workspace bf-dry-<id> --dry-run`
  with `FLUXIQ_TEST_TARGET=persistent-isolated`; quote its result line.
- Report to: `docs/working/breadth-forty-tasks-plan/reports/tasks-<site>.md`, in the worktree: per task its id,
  kind, judgeBy, permissionPoint and what a correct run does in one line; the exact entries to add to both shared
  tests; files changed; test and dry-run output.

### Brief: package-lead (t706, dispatched as `lead`)
- Repository: this repository, in `C:/Users/osrs_/FluxStuff/fxwork/t706-install-package-proof` only.
- Task: prove MVP acceptance item 1, "Install FluxIQ", for a person who has never seen it. Build the release
  packages (`docs/architecture/release-packaging.md`), then follow `docs/user/install.md` and `quickstart.md`
  literally on a clean, visible browser profile: install the Chrome/Edge package in Chrome (and Edge if present),
  the Firefox package in Firefox if installed, set up and start FluxIQ Core as the docs say, pair, open the side
  panel or popup, and reach the quickstart's first automation on a realistic scenario site. Record for each step
  whether a person's path was exercised or a test shortcut (a launch flag, a script) stood in for it. Fix every
  gap found in packaging, manifests, the docs and first-run pairing; report what only the user can do (store
  submission, signing keys) instead of doing it.
- Rules: isolated data and ports, never the user's panel, profiles or `.fluxiq`; no Lab slot; never show pairing
  tokens; at most one paid build, through the installed package, under the $0.25 ceiling and a live supervisor.
  No Core edits: report any Core install gap to the supervisor, who alerts the user before a Core change.
- Owns (may edit): `apps/extension/scripts/release/**`, `apps/extension/manifest*.json`, `docs/user/**`,
  `docs/architecture/release-packaging.md`, first-run and pairing files under `apps/extension/src/**` when a gap
  needs them (list each one), tests beside changed files, its report.
- Must not touch: `apps/scenario-lab/src/scenarios/**`, `lab-slots/`, the lane trees, the main checkout, shared
  working documents.
- Definition of done: per browser, the package built (file, version), how it was installed, paired yes or no, the
  first automation's result, every defect with its fix and the tests beside it,
  `pnpm.cmd --filter @fluxiq-web-extension/extension build` and `node scripts/structure-audit.mjs` output, and what
  was not exercised.
- Report to: `docs/working/breadth-forty-tasks-plan/reports/package-lead.md` in the worktree.

### Brief: install-core-lead (t707, dispatched as `lead`)
- Repository: FluxIQ Core and this repository, in `C:/Users/osrs_/FluxStuff/fxwork/t707/` only (`!FluxIQ` on
  branch `task/t707-install-core-fixes`, `!FluxIQWebExtension` beside it). Follow Core's AGENTS.md there.
- Task: fix the five first-run defects the install proof found (`reports/package-lead.md`, "Core bugs"), each at
  its cause, with a fail-first test beside it:
  C1 `/get-started` always says "runtime did not answer" (`fluxiq.ts:58` returns null, which
  `useOnboardingReadings.ts:85` rejects); C2 approving a pairing whose socket has closed still creates trust,
  loses the token and marks the dead session ready (`pairing-flow.ts` `complete()`): it must fail honestly so
  the browser pairs again; C3 `client-gateway-transport.ts` `selectSession` sends commands to that dead session;
  C4 the Get started buttons create projects with no domain, which the extension refuses; C5 a provider key added
  during a sign-in stays locked until the next sign-in. Confirm each from the code before fixing it; if one is
  not real, say why.
- Then repeat the install proof's first automation once (Chrome, the clean profile and isolated ports in
  `reports/package-lead.md`, the release package built from this tree): one paid build under the $0.25 ceiling, on
  a realistic scenario, supervised, run to a result and then rerun with no model calls.
- Rules: isolated data and ports, never the user's panel, profiles or `.fluxiq`; never show tokens or keys; no Lab
  slot; headed browsers; no model guidance that mirrors a scenario.
- Owns (may edit): the t707 tree, both repositories; its report. Must not touch: the lane trees, main checkouts,
  shared working documents.
- Definition of done: per defect, the cause, the fix, the tests beside it and their observed output; Core
  typecheck of each touched package and Core's structure audit; the extension tests beside any downstream change;
  the first automation's result and its zero-call rerun, or exactly where it stopped and why.
- Report to: `docs/working/breadth-forty-tasks-plan/reports/install-core-lead.md` in `fxwork/t707/!FluxIQWebExtension`.

### Brief: live-lane-<N> (four copies, dispatched as `lead-xhigh`, Phase 3)
- Repository: this repository and Core, in the lane's tree only: lane 1 `fxwork/t563` (slot-1), lane 2
  `fxwork/t565` (slot-2), lane 3 `fxwork/t566` (slot-3), lane 4 `fxwork/t567` (slot-4); each holds both checkouts.
- Queue: lane 1 everything-store, bigbox-retail and local-classifieds (12); lane 2 crossborder-marketplace and
  auction-marketplace (8); lane 3 social-network-feed and photo-social (8); lane 4 job-board, company-website and
  professional-network (12): the sites' new tasks, listed in "## The Forty Tasks". A lane that empties its queue
  takes the next untouched task from the longest queue after an integration round.
- Task: run every task in the queue live and leave each passing. Loop without stopping: launch one run with the
  A8 shape (`automation-project-agents-plan.md`, "A8 Run Plan"; `--authoring-mode project`, workspace
  `bf-<task>`, `FLUXIQ_LAB_INSTANCE=bf-slot-<N>`, the lane's Core branch); debug it fully from `steps/` into
  `docs/working/language-driven-flow-loop-plan/debugs/<runId>.md` (why it failed, how far it got, billed cost, a
  UI review of the chat cards); fix the cause structurally in the lane tree with tests beside each change (an
  oracle that is itself wrong is fixed in the site's files); rerun on the changed source; on a pass, move on. A
  task that fails three times on three different causes is recorded as open and the lane moves on.
- Rules: only the ten realistic scenarios; headed; one attempt per launch; never rerun unchanged source after a
  failure; every node retries; no model guidance that mirrors a scenario's task, site or answer; stop all paid
  work at the first balance error and report it. Never commit; never touch another lane's tree.
- Coordination: keep a fix log at the top of the report (files, the run that exposed it, validation, status);
  read the other three lanes' fix logs before fixing so one cause is fixed once. When the supervisor calls an
  integration round, finish the run in flight and reply ready with the fix log, then wait for the resume message.
- Owns (may edit): its lane tree, both repositories; its report. Must not touch: other lane trees, the main
  checkouts, shared working documents.
- Definition of done: every queued task has a passing run id (oracle result, billed cost, calls) or is recorded
  open with its three causes; each fix lists its tests and their observed output plus the structure audit.
- Report to: `docs/working/breadth-forty-tasks-plan/reports/live-lane-<N>.md` in the lane tree.

## Work Ledger

### 2026-10-17 — Plan written; Phase 1 dispatched
- Agent: supervisor
- Changed: this document; task worktrees t696-t706 created by `pnpm task start <slug> --worktree`
- Why: the user's request above
- Validation: `pnpm.cmd task start ... --worktree` x11 -> each printed `"applied":true`, ids t696-t706
- Outcome: Accepted
- Follow-up: verify the worker reports, then Phase 2

### 2026-10-17 — Forty tasks merged; shared corpus tests updated
- Agent: supervisor (tasks by workers tasks-<site>, t696-t705)
- Changed: `apps/scenario-lab/src/scenarios/<site>/**` on all ten sites; `scenarios/tests/live-instructions.test.ts`
  (5 permission points, 35 asks-nothing, 2 hand-offs); `scenarios/tests/realistic-site-live-tasks.test.ts` (40
  additions, 108 tasks); `src/tests/recording-descriptions.test.ts` (82 workflows)
- Why: the user's request; each site worker proved its oracles with browser-path tests and provider-free dry runs
- Validation: `pnpm.cmd --filter @fluxiq-web-extension/scenario-lab check` -> clean;
  `pnpm.cmd --filter @fluxiq-web-extension/scenario-lab test` -> "# tests 851 # pass 851 # fail 0 # cancelled 0";
  `pnpm task finish` x10 -> structure audit passed each
- Outcome: Accepted
- Follow-up: Phase 3 live lanes

### 2026-10-17 — Install proof: Chrome and Edge install and pair; first automation stalled on Core (t706)
- Agent: package-lead (verified by the supervisor)
- Changed: `apps/extension/src/background/connection.ts`, `connection/gateway-session.ts` (+5 tests): a cheap
  extension API call each heartbeat while pairing or connecting keeps the MV3 worker alive past 30 s; `docs/user/
  install.md`, `quickstart.md`; `docs/architecture/extension-client.md` (supervisor)
- Why: approval after about 30 s never paired (reproduced twice at about 108 s; after the fix Chrome paired at 80 s,
  Edge at about 55 s, both through the real Load-unpacked steps)
- Validation: `EXTENSION_TEST_BUILD_LABEL=t706-verify node scripts/test-extension.mjs background/connection/tests`
  -> "# tests 254 # pass 254 # fail 0" (supervisor rerun); `pnpm task finish t706` -> structure audit passed, merged
- Outcome: Partial. Firefox not installed here; the first automation stalled (likely Core C2/C3), about $0.01 spent
- Follow-up: t707 fixes Core C1-C5 and reruns the first automation once

## Open Questions

None yet.
