# Agent Instructions

## Agent Roles

**Senior supervisor agent** — the agent the user prompts directly. It owns
coordination, delegation, integration, conflict resolution, verification, and
the final result. It declares the workflow mode, maintains working documents,
and is the only role that commits and pushes.

**Worker** — any agent invoked by another agent rather than by the user. A
worker executes one bounded brief, writes back to its own report file, and
reports honestly on what it did and did not verify. Workers never declare a
mode, never edit a shared document, and never commit or push.

A worker's completion report is a claim, not verification. The senior
supervisor agent confirms the result itself before treating it as done.

## Start Here

What you need to read depends on your role. Context is a budget; do not spend
it on documents your task will not use.

**Senior supervisor agent.** Read this file. Then, when the work warrants it:

- [MVP agent instructions](MVP_AGENT_INSTRUCTIONS.md) and the
  [30-day MVP implementation plan](FluxIQ%20Web%20Extension%20%E2%80%94%2030-Day%20MVP%20Implementation%20Plan.md)
  before planning, scoping, prioritizing, or delegating substantive MVP work.
  Skip them for narrow fixes and operational requests.
- The [working document index](docs/working/README.md), then the
  `Current State` section of the relevant document, before touching work
  already in progress.
- [Repository layout and commands](docs/architecture/repository-layout.md)
  when you need the package structure, tracking policy, or exact commands.

**Worker.** Read your brief, the files it names, and the `Current State` of
the working document it points to. Do not read the MVP planning documents,
the rest of a working document, or the rest of this file unless your brief
says to. If your brief is not enough to do the work correctly, say so instead
of reading broadly — an insufficient brief is the supervisor's defect to fix.

**Both roles.** The boundary, secret-handling, generated-data, and validation
rules in this file are binding whether or not you read the background
documents.

Re-read background documents only when the task changes scope or the user
asks for their current guidance.

## Working Documents Are Agent Memory

Agent context does not survive a session, and workers share no context with
each other or with the supervisor. Documents under `docs/working/` are the
only channel through which one agent's knowledge reaches the next.

- Record findings, decisions, and validation results as the work happens, not
  as an end-of-task summary.
- Brief every worker in writing before dispatch; each writes back to its own
  report file. Partition briefs by file, never by topic.
- Commit working document updates with the work that changed them.

The [agent working document protocol](docs/working/agent-working-doc-protocol.md)
defines layout, status vocabulary, ledger format, compaction, brief format,
and cross-repository pairing. Read it when creating or restructuring a working
document, not for routine updates.

## Workflow Modes

The senior supervisor agent classifies each user prompt into one of the modes
below and states it in the first user-facing response as `Mode: <mode name>`,
listing several in execution order if more than one applies. Do not repeat
the label in later updates for the same prompt, but announce a transition
once when it happens. Workers do not declare modes. Follow the user's intent,
and let the newest instruction take precedence. If the intended mode is
genuinely unclear, ask before beginning substantive work; minimal inspection
to explain the ambiguity is allowed. These are repository workflow modes, not
Codex product or collaboration-mode settings.

### 1. Plan And Write Working Doc

For investigation, audit, design, scoping, or planning before implementation.

Inspect the relevant extension, domain, scripts, and documentation first, then
create or update a document under `docs/working/` recording findings,
decisions, dependencies, risks, validation requirements, and detailed
implementation phases and steps. Make it concrete enough that another agent
can execute it without rediscovering the intended architecture. Do not begin
broad implementation unless the user also asks to execute the plan; small
investigative probes are allowed when needed for accuracy.

### 2. Execute Plan With Workers

For implementing an existing plan, completing its phases, or when the user
asks for subagents.

- Read the current working document before assigning or implementing work.
- Divide independent phases among workers where parallel work is safe,
  partitioning by file. If two briefs need the same file, the work is serial.
- The supervisor owns coordination, integration, conflict resolution, review,
  validation, and the final result.
- Update the working document as each step is assigned, completed, validated,
  blocked, or revised, and record the results of the checks you run.
- Continue through every requested phase unless the user pauses the work or a
  genuine blocker requires user input.

### 3. Editing, Iteration, And Bug Fixes

For focused implementation, extension UI refinements, runtime changes,
regressions, debugging, test failures, and incremental work that does not
require executing a full plan.

Reproduce or inspect current behavior before changing code whenever feasible,
and trace bugs to their underlying cause instead of patching symptoms. Keep
edits scoped, preserve established architecture, and add or update tests in
proportion to risk. Validate the affected extension and domain behavior
directly, including live browser testing when requested and available. Update
existing authored documentation when the change is substantial; a new working
document is not required for every focused edit.

### 4. Testing And Live Validation

For testing existing behavior, verifying completed work, reproducing a problem
live, operating a browser testing session, or making the FluxIQ panel and
extension available for interactive testing.

- Establish the expected behavior, then choose the narrowest useful
  combination of type checks, unit tests, smoke tests, extension builds, and
  manual browser tests.
- Inspect actual results. Do not report success from compilation alone or
  from a worker's completion report.
- For browser behavior, test the appropriate Chrome/Edge or Firefox build when
  the environment can load an unpacked extension. Record the browser, build
  target, page, and relevant extension state.
- Start, stop, or restart the FluxIQ web panel only when the user explicitly
  authorizes panel management for the current session. Keep a server needed
  for the user's live test running and provide its local URL and relevant
  state without exposing secrets.
- Preserve browser profiles, recordings, projects, and user data. Avoid
  destructive resets unless requested or approved; prefer isolated test data.
- Record exact failures, reproduction steps, environment details, and measured
  results. Distinguish verified behavior from remaining assumptions.
- This mode does not authorize broad product changes. If testing exposes a
  defect the user asked to fix, move to mode 3, then return here to verify.

If a prompt spans multiple modes, begin with the earliest necessary mode and
transition explicitly as work advances. Infer the practical mode when
confidence is high; otherwise ask.

### Delegation

Delegate to a worker when the task needs more than about five files read
whose content the supervisor will not need afterwards, when a run-fix-rerun
loop is expected, when edits are bulk and partitionable by file, or when
independent pieces touch no common file. Keep with the supervisor one- or
two-file edits it already understands, verification of worker claims,
integration, conflict resolution, and anything that needs the user's
conversation context. Dispatch has fixed overhead and a worker's claim still
needs verifying, so reads are the cost: route discovery through a worker or
`Explore` and read the conclusion. Briefs follow the protocol format, at most
40 lines; the worker's final message follows the protocol's return contract.

## Repository Boundaries

This repository is the downstream FluxIQ web-automation implementation. It is
not FluxIQ Core. `apps/extension` owns browser APIs, DOM access, recorder UI,
and browser-side execution; `domain` owns web-automation FluxIQ contracts,
state reducers, input/output mappings, and runtime adapters; generic gateway
and framework behavior belongs in Core. Durable project, policy, and recording
ownership belongs in Core, not extension-local storage. The extension may
import domain contracts; domain code must not depend on extension UI or
browser modules. Full structure is in
[repository layout and commands](docs/architecture/repository-layout.md).

Workspace packages link to FluxIQ Core in the sibling `F:\!FluxIQ` checkout.
Changes there are allowed when needed to complete work here. Before the first
Core edit, alert the user that the task crosses the repository boundary,
identify the Core area and reason, and mention any expected compatibility
impact. Follow Core's own agent instructions while working there. Use workers
for clearly bounded Core investigation, implementation, or validation; the
supervisor remains responsible for cross-repository coordination, integration,
and final verification. Keep generic framework behavior in Core instead of
copying it here, and document any cross-repository contract dependency.

Never expose pairing tokens, bearer tokens, recorded page data, local browser
state, or secrets from `.fluxiq` or extension storage in logs or responses.

## Engineering Structure And Modularity

- Organize code by narrow, cohesive responsibility. Extend the module that
  owns a capability or introduce a focused one rather than placing behavior in
  a convenient catch-all file. Split modules that mix unrelated
  responsibilities or become hard to test, replace, or debug independently.
- Keep public boundaries and dependency direction explicit. Prefer small,
  composable modules over shared mutable state or oversized coordinators.
- Keep wire-protocol changes synchronized across shared protocol types,
  background routing, domain gateway mappings, capabilities, tests, and
  architecture documentation.
- Preserve the distinction between state/passive evidence inputs and
  executable action inputs. An action input must map deterministically to a
  registered output; an unmapped input must not become executable.
- Keep Chrome/Edge side-panel and Firefox popup behavior aligned where the
  product contract is shared, respecting manifest and browser API differences.
- Tests live in a `tests/` subfolder of the directory that owns their
  subject: `a/b.ts` is covered by `a/tests/b.test.ts`. Never loose beside
  source; never in a separate mirrored tree. A test with several subjects
  goes in the `tests/` folder of the nearest directory containing all of
  them. Test support that ships stays in source.
- Placement follows FluxIQ Core's
  [code structure](../!FluxIQ/docs/architecture/code-structure.md):
  ownership / layer / feature / kind, a shared filename prefix becomes a
  directory, one exported thing per file, a barrel in every directory, and
  never extract-and-drop. The same budgets and checks apply here:
  `scripts/structure-audit.mjs` — mirrored from Core, change it there first —
  runs first in `pnpm check` with this repository's own
  `.structure-baseline.json` and `scripts/structure-audit/config.mjs`, which
  additionally enforces that `domain/src` never imports `apps/extension/src`.
  Run `pnpm structure:baseline` after removing a violation.

## Generated Data

Do not hand-edit generated or runtime state; regenerate it through the owning
script. No build output is tracked. Never commit `.fluxiq/`,
`apps/extension/dist/`, `apps/extension/build/`, `domain/.test-build/`, or
`domain/.script-build/`. Regenerate the extension bundles with
`pnpm --filter @fluxiq-web-extension/extension build` and the domain test build
with an unlabelled `pnpm --filter @fluxiq-web-extension/domain test`. The
per-path detail is in
[repository layout and commands](docs/architecture/repository-layout.md).

`apps/extension/build/` and `domain/.test-build/` were tracked until 2026-09-17.
Nothing read the committed copies, and their sourcemaps are single lines of
several hundred kilobytes that no merge tool can resolve, so parallel branches
could not have worked while they stayed in the index.

## Documentation Maintenance

After substantial changes, update authored documentation in the same work
unless the user says not to. Substantial changes include recording, snapshot,
state, or action behavior; gateway message or domain input/output contracts;
browser permissions, manifests, supported browsers, or build layout; pairing,
authentication, authorization, token storage, or privileged actions; extension
UI flows or browser-runtime architecture; FluxIQ setup, hosting, runtime
adapters, or folder layout; and persistence ownership or generated artifact
behavior.

When the user asks for documentation updates, treat them as required work.
Keep current-state design in `docs/architecture/` and task-specific plans in
`docs/working/`. Generated material under `.fluxiq/cache/docs/` is reference
output, not a substitute for authored documentation.

## Validation

Run the narrowest relevant checks while iterating, then `pnpm check`,
`pnpm test`, and `pnpm build` when the scope warrants them. Package-level
commands are listed in
[repository layout and commands](docs/architecture/repository-layout.md).

Compilation and smoke tests do not prove live browser behavior. For changes to
content scripts, background/service-worker lifecycle, WebSocket reconnection,
pairing, permissions, cross-frame behavior, storage, popup/side-panel
behavior, or action execution, perform manual browser validation when feasible
and state what was and was not exercised.

Do not start the FluxIQ web panel by default. When the user explicitly asks
you to manage it, use `pnpm dev`; otherwise tell the user which command to run.

## Branches And Worktrees

Isolation is per unit of work, never per agent. A branch bounds a change, not a
worker: workers are ephemeral, several may serve one brief, and a re-dispatched
worker is still the same unit of work. Agent identity travels in commit
trailers instead. Full design and the measurements behind it are in
[the agent git workflow plan](docs/working/agent-git-workflow-plan.md).

The senior supervisor agent picks the tier when it writes the brief:

- **Direct on `dev`** for supervisor edits of at most two files it already
  understands — documentation, a ledger entry, config, a one-line fix. No
  ceremony, and this stays the common case.
- **A task branch** for any unit of work that has a brief. `pnpm task start
  <slug>` branches `task/t<NNN>-<slug>` off `dev`; `pnpm task finish <id>`
  integrates `dev`, merges back `--no-ff`, and deletes the branch.
- **A task branch plus its own worktree** — `pnpm task start <slug> --worktree`
  — when another agent is running repository-wide validation concurrently, when
  the work is experimental and may be thrown away, or for a long Lab or build
  run. The trigger is validation, not editing: concurrent workers editing
  disjoint files in one checkout are safe, but a validation run that reads a
  tree someone else is editing reports false failures and invites a worker to
  "fix" a file another worker is still writing.

Authoring worktrees live under `F:/fxwork/`, never `F:/fxlab/`, which holds the
Lab's pinned test worktrees. `domain/package.json` links Core by a relative path
out of the repository, so Core must be the worktree's sibling; sibling worktrees
therefore share one Core, which is what makes a second worktree cost about four
seconds instead of fifty. A task that edits Core takes a nested layout with its
own Core worktree, because the shared one is detached and read-only. Remove a
worktree with `pnpm task abandon` or `pnpm task finish`, never with
`git worktree remove --force`, which fails on `node_modules` and partly deletes
the tree before aborting.

Neither lifecycle can reclaim everything. A per-label test build directory is
cleared only when its own label runs again, and the shared Core is used by every
task beside it at once, so no task knows it was the last. `pnpm task prune`
removes both once nothing has touched them for three days and no process is
working inside them; `--dry-run` decides every refusal and changes nothing. It
never touches `test-runs/`, which holds evidence rather than build output.

Commits on a task branch carry `Task: t<NNN>`, and `Worker: <agent-label>` where
a worker produced the change. A task merges with `--no-ff` and the subject
`Merge task t<NNN>: <title>`, so first-parent history reads as a list of tasks
and `git revert -m 1 <merge>` undoes one cleanly. Commits are never squashed:
they are the step-by-step record, and the merge commit is the boundary.

Merge `dev` into the task branch and re-run the narrowest relevant checks before
merging back. That is what catches two tasks that changed different files and
still produced an incompatible system, which git cannot detect.

## Committing And Pushing

Only the senior supervisor agent commits or pushes. Workers never do.

Push `dev` without being asked once all of the following hold:

1. The work is a complete, coherent unit — not a partial refactor or an
   experiment left mid-flight.
2. The relevant checks were actually run and observed to pass. Compilation
   alone, or a worker reporting success, does not qualify.
3. Nothing known to be broken is included.

When a change spans this repository and FluxIQ Core, push both `dev` branches
in the same work unit so the two sides do not drift, and say so.

Otherwise: commit locally and explain what is holding the push. Always state
what was pushed and what was not.

These actions still require explicit user approval every time:

- pushing to `main`, or opening a pull request into it;
- force-pushing anything;
- rewriting history, including `filter-repo`, `rebase -i`, and amends to
  already-pushed commits;
- deleting branches or tags on the remote.

Never commit secrets, `.fluxiq` contents, recorded page data, browser
profiles, or run artifacts. Never use `--no-verify`.

## Automated Testing Facility Boundary

The browser testing facility is downstream web-automation infrastructure. Keep
scenario manifests, fixture websites, Playwright/browser drivers, extension
loading and control, DOM assertions, screenshot policy, and real-site controls
here. `packages/test-contracts` is private and repository-local; its contracts
are not FluxIQ Core public API.

Move a testing capability to Core only when it remains coherent after removing
all browser, DOM, URL, selector, tab, extension, and web-automation concepts,
and at least two real domain consumers require it. Any promotion must add a
public Core export, independent Core tests and documentation, a compatibility
assessment, and migration of this repository to the public seam. Core must
never import this repository or depend on its scenarios.

Run artifacts and browser profiles are disposable. Keep them in ignored
run-scoped directories; never commit captures or expose credentials, cookies,
authorization headers, pairing tokens, or recorded page data.
