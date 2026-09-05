# Agent Instructions

## Workflow Modes

For every user prompt, classify the requested work into one of the workflow
modes below. Follow the user's intent, and let the newest instruction take
precedence when the requested mode changes. These are repository workflow
modes, not Codex product or collaboration-mode settings.

In the first user-facing response after each new user prompt, state the active
workflow mode using `Mode: <mode name>`. If more than one mode is active, list
them in execution order. Do not repeat the mode label in every update for the
same prompt. When transitioning modes during a task, announce the new mode once
in the next progress update.

If the intended mode is genuinely unclear, ask the user to clarify before
beginning substantive work. Minimal inspection needed to explain the ambiguity
is allowed.

### 1. Plan And Write Working Doc

Use this mode when the user asks to investigate, audit, design, scope, or plan
work before implementation.

- Inspect the relevant extension, domain, scripts, and documentation before
  proposing work.
- Create or update an authored working document under `docs/working/`.
- Record findings, decisions, dependencies, risks, validation requirements,
  and detailed implementation phases and steps.
- Make the document concrete enough that another agent can execute it without
  rediscovering the intended architecture.
- Do not begin broad implementation unless the user also asks to execute the
  plan. Small investigative probes are allowed when needed for accuracy.

### 2. Execute Plan With Subagents

Use this mode when the user asks to implement an existing plan, complete its
phases, or explicitly requests subagents.

- Read the current working document before assigning or implementing work.
- Divide independent phases or steps among subagents when subagents are
  available and parallel work is safe.
- The primary agent owns coordination, integration, conflict resolution,
  review, validation, and the final result. Subagent completion reports are not
  sufficient verification by themselves.
- Update the working document as each step or phase is assigned, completed,
  validated, blocked, or revised.
- Continue through every requested phase unless the user pauses the work or a
  genuine blocker requires user input.
- Run the relevant checks and record their results in the working document.

### 3. Editing, Iteration, And Bug Fixes

Use this mode for focused implementation requests, extension UI refinements,
runtime changes, regressions, debugging, test failures, and incremental changes
that do not require execution of a full working plan.

- Reproduce or inspect the current behavior before changing code whenever
  feasible.
- Trace bugs to their underlying cause instead of applying symptom-specific
  workarounds.
- Keep edits scoped, preserve established architecture, and add or update tests
  proportional to risk.
- Validate the affected extension and domain behavior directly, including live
  browser testing when requested and when the required browser tooling is
  available.
- Update existing authored documentation when the change is substantial under
  the documentation rules below. A new working document is not required for
  every focused edit.

### 4. Testing And Live Validation

Use this mode when the user asks to test existing behavior, verify completed
work, reproduce a problem live, operate a browser testing session, or make the
FluxIQ panel and extension available for interactive testing.

- Establish the expected behavior and select the narrowest useful combination
  of type checks, unit tests, smoke tests, extension builds, and manual browser
  tests.
- Run relevant checks and inspect their actual results. Do not report success
  based only on compilation or another agent's completion report.
- For browser behavior, test the appropriate Chrome/Edge or Firefox build when
  the environment supports loading an unpacked extension. Record the browser,
  build target, page, and relevant extension state.
- Start, stop, or restart the FluxIQ web panel only when the user explicitly
  authorizes panel management for the current session. Keep a server needed for
  the user's live test running and provide its local URL and relevant state
  without exposing secrets.
- Preserve browser profiles, recordings, projects, and user data. Avoid
  destructive resets unless requested or approved; prefer isolated test data.
- Record exact failures, reproduction steps, environment details, and measured
  results. Clearly distinguish verified behavior from remaining assumptions.
- Testing mode does not authorize broad product changes by itself. If testing
  exposes a defect and the user requested a fix, transition to Editing,
  Iteration, And Bug Fixes, then return to Testing And Live Validation.

If a prompt spans multiple modes, begin with the earliest necessary mode and
transition explicitly as work advances. Infer the practical mode when
confidence is high; otherwise ask.

## Repository Architecture

This repository is the downstream FluxIQ web-automation implementation. It is
not FluxIQ Core.

```text
apps/extension/
  src/background/   WebSocket session, tab routing, recording state, storage
  src/content/      DOM evidence, snapshots, target lookup, action execution
  src/popup/        Firefox popup fallback
  src/sidepanel/    Chrome/Edge recorder console
  src/runtime/      Browser-side runtime command and action handling
  src/shared/       Browser helpers, constants, and wire protocol types
  scripts/          Extension build and smoke-test scripts
domain/
  src/actions/      Web action contracts and capabilities
  src/client/       Gateway mappings and client capability declarations
  src/io/           Registered FluxIQ inputs, outputs, and gateway bridges
  src/output-nodes/ Web output node definitions and dispatch adapters
  src/recording/    Events, reducers, observations, and web state conversion
  src/runtime/      Domain runtime service, commands, traces, and flow runner
  src/web-panel/    Web-panel host output-node integration
docs/architecture/  Authored current-state architecture
docs/working/       Investigation and implementation working documents
scripts/            Repository-level FluxIQ panel launcher
```

The extension is a browser-side client. It captures browser presence and
recording evidence, sends state and domain events through FluxIQ's generic
WebSocket gateway, executes authorized browser actions, and retains only
lightweight local settings/session state. FluxIQ Core owns pairing,
authorization, durable projects and recordings, policy generation, Automation
Studio, and long-running orchestration.

Keep responsibilities on the correct side of these boundaries:

- `apps/extension` owns browser APIs, DOM access, recorder UI, transient queues,
  and browser-side action execution.
- `domain` owns web-automation-specific FluxIQ contracts, manifests, state
  reducers, input/output mappings, action interfaces, and runtime adapters.
- Generic gateway and framework behavior belongs in FluxIQ Core, not here.
- Durable project, policy, and recording ownership belongs in FluxIQ Core, not
  extension-local storage.
- The extension may import domain contracts. Domain code must not depend on
  extension UI or browser implementation modules.

Workspace packages link to FluxIQ Core packages in the sibling `F:\!FluxIQ`
checkout. Changes to that Core framework repository are allowed when they are
needed to complete work in this repository. Before making the first Core edit,
alert the user that the task crosses the repository boundary, identify the Core
area and reason for the change, and mention any expected compatibility impact.
Follow the Core repository's own agent instructions while working there. Use
subagents where appropriate for clearly bounded Core investigation,
implementation, or validation work; the primary agent remains responsible for
cross-repository coordination, integration, and final verification. Keep
generic framework behavior in Core instead of copying it into this repository,
and document any cross-repository contract or rollout dependency.

## Engineering Structure And Modularity

- Organize code by narrow, cohesive responsibility. Extend the module that owns
  a capability or introduce a focused module rather than placing behavior in a
  convenient catch-all file.
- Split modules when they mix unrelated responsibilities or become difficult
  to understand, test, replace, or debug independently.
- Keep public boundaries and dependency direction explicit. Prefer small,
  composable modules with clear inputs and outputs over shared mutable state or
  oversized coordinators.
- Keep wire-protocol changes synchronized across shared protocol types,
  background routing, domain gateway mappings, capabilities, tests, and
  architecture documentation as applicable.
- Preserve the distinction between state/passive evidence inputs and executable
  action inputs. An action input must map deterministically to a registered
  output; an unmapped input must not become executable.
- Keep Chrome/Edge side-panel behavior and Firefox popup behavior aligned where
  the product contract is shared, while respecting their manifest and browser
  API differences.
- Keep tests near or clearly associated with the module whose contract they
  protect. Use integration tests for explicit cross-package boundaries.

## Repository And Generated-Data Boundaries

Web-automation-specific code and assets belong in this repository. Generic,
domain-neutral FluxIQ framework behavior belongs in FluxIQ Core.

Do not hand-edit generated/runtime state. Regenerate outputs through their
owning scripts, and preserve the repository's existing tracking policy:

- `.fluxiq/` contains local FluxIQ configuration, caches, databases, recordings,
  project artifacts, and other ignored runtime state; do not commit it.
- `apps/extension/build/` contains tracked intermediate bundles. Update them by
  running the extension build when their sources change; do not edit them by
  hand.
- `apps/extension/dist/` contains ignored loadable Chrome and Firefox builds.
- `domain/.test-build/` contains tracked generated domain-test artifacts. Let
  the domain test/build workflow update them; do not edit them by hand.

Never expose pairing tokens, bearer tokens, recorded page data, local browser
state, or secrets from `.fluxiq` or extension storage in logs or responses.

## Documentation Maintenance

After substantial changes, update authored documentation in the same work
unless the user explicitly says not to. Substantial changes include:

- recording, snapshot, state, or action behavior;
- gateway message or domain input/output contracts;
- browser permissions, manifests, supported browsers, or build layout;
- pairing, authentication, authorization, token storage, or privileged actions;
- extension UI flows or browser-runtime architecture;
- FluxIQ setup, hosting, runtime adapters, or repository folder layout;
- persistence ownership or generated artifact behavior.

When the user directly asks for documentation updates, treat them as required
work. Keep current-state design in `docs/architecture/` and task-specific plans
in `docs/working/`. Generated material under `.fluxiq/cache/docs/` is reference
output, not a substitute for authored documentation.

## Validation

Run the narrowest relevant checks while iterating, then run workspace-level
checks when the scope warrants them:

```bash
pnpm check
pnpm test
pnpm build
```

Package-specific commands are available for focused work:

```bash
pnpm --filter @fluxiq-web-extension/domain check
pnpm --filter @fluxiq-web-extension/domain test
pnpm --filter @fluxiq-web-extension/domain host:build
pnpm --filter @fluxiq-web-extension/extension check
pnpm --filter @fluxiq-web-extension/extension test
pnpm --filter @fluxiq-web-extension/extension build
```

The extension build writes unpacked targets to:

```text
apps/extension/dist/chrome
apps/extension/dist/firefox
```

Compilation and smoke tests do not prove live browser behavior. For changes to
content scripts, background/service-worker lifecycle, WebSocket reconnection,
pairing, permissions, cross-frame behavior, storage, popup/side-panel behavior,
or action execution, perform manual browser validation when feasible and state
what was and was not exercised.

Do not start the FluxIQ web panel by default. When the user explicitly asks the
agent to manage it, use:

```bash
pnpm dev
```

That command runs repository-local FluxIQ setup and starts the panel with this
repository as `FLUXIQ_ROOT`. To prepare local FluxIQ state without starting the
panel, use `pnpm fluxiq:setup`. Otherwise, tell the user which command to run
manually.

## Automated Testing Facility Boundary

The browser testing facility is downstream web-automation infrastructure. Keep
scenario manifests, fixture websites, Playwright/browser drivers, extension
loading and control, DOM assertions, screenshot policy, and real-site controls
in this repository. `packages/test-contracts` is private and repository-local;
its contracts must not be treated as FluxIQ Core public API.

Move a testing capability to FluxIQ Core only when it remains coherent after
removing all browser, DOM, URL, selector, tab, extension, and web-automation
concepts, and at least two real domain consumers require it. Any promotion must
add a public Core export, independent Core tests and documentation, a
compatibility assessment, and migration of this repository to the public seam.
Core must never import this repository or depend on its scenarios.

Run artifacts and browser profiles are disposable generated data. Keep them in
ignored run-scoped directories; never commit captures or expose credentials,
cookies, authorization headers, pairing tokens, or recorded page data.
