# A person-only check on a timer: the `timed-check` variant and script form

Worker report, t885. Scenario: crossborder-marketplace. No Lab attempt and no paid call were run.

## Outcome

Partial. The fixture, its person declaration, the task row and the script form are built and tested. The extension's own check detector reads the new check as person-only. One thing blocks the Lab proof, and it is outside my paths: `lab attempt` never arms a task's variant (details below, with the two-line fix). Without that fix, the run fails loudly at its second decision. It cannot pass falsely.

## What changed and why

### The check (scenario lab)

The check is a "Please confirm you are human" layer. It comes up 1.5 s after any storefront page's script starts, with no action behind it.

- It is a modal dialog (`role="dialog" aria-modal="true"`) with an `h2` question and a "Verify you are human" box.
- It sits at z-index 90, above every other layer, and has no close control.
- It says nothing about clearing by itself.
- It stays up and comes back on every page load until a person presses the box. The box then runs its own 2 s check, posts `timed-check {action:"pass"}`, and the layer leaves in place, with no reload. After the pass it never shows again.
- The question stays on screen through the 2 s check, so an in-place clear is not answered too early.

Files:

- `apps/scenario-lab/src/scenarios/crossborder-marketplace/state/timed-check.ts` (new): the `TimedCheck` type and `readTimedCheck` (delay 1 to 10,000 ms; anything else is refused).
- `state/types.ts`, `state/create.ts` (`timedCheck: null`), `state/index.ts` (type export).
- `state/mutate.ts`: `set-mode` also reads `timedCheck`, and any part it cannot read leaves the state alone. Added the `timed-check` pass operation.
- `markup/overlays.ts`: the template.
- `markup/shell.ts`: `boot.timedCheck`.
- `client/shell-script.ts`: the timer, the box and the in-place leave.

### Variant, person declaration and task (scenario lab)

- `manifest/free-hubs-under-ten.ts`: a workflow variant `timed-check` with `arm: set-mode {mode:"baseline", timedCheck:{delayMs:1500}}` and `expected: { pageFacts: FIRST_VISIT }`. The workflow's `expected` (the ten records, final state, console allowance) is untouched, and the merge inherits it. A test asserts that the resolved expectation equals the unarmed one.
- `person-check.ts`:
  - New check `timed-check`: `shows: "Please confirm you are human"`, step `click "Verify you are human"`, `clears: "in-place"`, `clearsWithinMs: 10000`. Its text never overlaps the traffic screen's, in either direction.
  - New hand-off row `free-hubs-under-ten/timed-check`: completes, `required: true`.
  - New exported sentence `TIMED_CHECK_MET`, shared by that row and the task.
- `live-tasks.ts`: the row `crossborder-marketplace-free-hubs-under-ten-timed-check`. It has `variantId: "timed-check"` and is armed for the build too. It uses the same instruction, `expectedDatasetId` and judge as the base row, with `personCheck: completes, required`.

### Registration (needed by the new row and variant)

- `apps/scenario-lab/src/scenarios/tests/realistic-site-live-tasks.test.ts`: the new id is added to the sorted list. Counts go 108 → 109 and 87 → 88.
- `apps/scenario-lab/src/scenarios/tests/live-instructions.test.ts`: the personCheck table entry (`completes:true`).
- `apps/scenario-lab/src/scenarios/tests/live-repair-tasks.test.ts`: an exclusion for row `crossborder-marketplace/free-hubs-under-ten/timed-check`, with its reason. A required hand-off row counts as "fails deliberately", and the right outcome here is a hand-off, not a repair or a refusal.
- `crossborder-marketplace/tests/scenario.test.ts`: variant inventory and arm shape.
- `crossborder-marketplace/tests/person-check.test.ts`: two checks; the traffic screen never shows the timed check's words.
- `crossborder-marketplace/tests/browser-harness.ts`: `armVariant(variantId, workflowId?)`.
- `packages/test-runner/src/flow-lane/creation/site-change/asked/table.ts`: the new task asks `[]`, the same as its unarmed twin. This is a new row; no existing row changed.

### Script form (test runner)

- `packages/test-runner/src/attempt-lane/scripted-model/scripts/crossborder-marketplace-free-hubs-under-ten.ts`: the const became `crossborderMarketplaceFreeHubsUnderTenScript(taskId, form = "plain")`, with forms `plain` (unchanged behaviour) and `timed-check`.
- `timed-check` (`lookAtTheCheckFirst`) behaves as follows until a look has handed the check over:
  - **The evidence carries Core's `personCompletedCheck` note** on the round's opening call (`initial.core.run_node`) or on the form's own look (`look-at-the-page`): it goes on as `plain`. A note on any other call is refused as "not a look".
  - **There is no note yet**: it makes one look, `core.run_node {node:"web.output.dom-capture_snapshot", parameters:{}, consequences:[]}`, never added to the Flow, and presses nothing.
  - **A look came back with no hand-off**: it throws, saying either that the check stood and the look handed nothing over, or that no check stood (the variant was not armed, or its timer had not run).
  - **The check still shows after the note**: it throws.
  - **Later attempts**: the hand-off is remembered per run, so attempts 2 to 4 go on as plain. It answers 4 chat turns and 8 judge requests, the `lab attempt` default.
- `scripts/index.ts`: both task ids are registered with the factory.
- `scripts/tests/crossborder-marketplace-free-hubs-under-ten.test.ts`: 6 new tests.

### Why 1.5 s

The t885-proof attempts (for example `run-mwaergal-9493d57a`, step 0002 spans) show the timing:

- The opening call is a navigate. Its `page.navigate` takes about 1.0 s, so the landing read comes about 0.5 to 0.8 s after the page's script starts (estimated).
- Its `look.after` page capture is about 1.3 s after the navigate returns.
- In all 5 sampled runs the first decision saw the welcome modal, which appears at 2.0 s.

At 1.5 s, the landing read comes before the check. So the first thing to meet it is a capture: the navigate's after-look, or, if that look's check reading ran too early, the form's own look, since the first decision then sees the check on the page. At 1.0 s, the margin over the landing read was thin.

## Commands run and observed results

- `node ../../scripts/build-cache/cli.mjs scenario-lab:build` (in `apps/scenario-lab`) → `"build-cache":"build"`, exit 0.
- `node --test <every crossborder test but browser-paths/breadth-paths> dist/scenarios/tests/*.test.js` → `# tests 77 # pass 77 # fail 0`, exit 0. This includes the new `timed-check.test.js` (6 tests) and `timed-check-browser.test.js` (2 tests). The browser tests prove:
  - the check is absent at DOMContentLoaded and comes up at least 1,400 ms after the page's script starts, with zero pointer or key input;
  - it is still up and topmost 3 s later, a reload brings it back, and the state is `waiting`;
  - the person's declared click leaves the question up for at least 1.5 s and then clears it in the same document (no reload), and the state becomes `passed`;
  - after a reload it no longer shows;
  - with the person passing first, the workflow's own recording script reads exactly the ten expected records, and the final-state facts hold.
- Before the delay change: `node --test browser-paths, breadth-paths, cart-add-ons, demonstrations` → `# tests 33 # pass 33 # fail 0`. The unarmed site is unaffected by the shell changes. Not rerun after the 1000 → 1500 change, which touches only the armed variant.
- `pnpm --filter @fluxiq-web-extension/scenario-lab check` → exit 0.
- Scratch probe. It bundles the extension's own `content/action-runtime/challenge-evidence.ts` (`robotCheckIn` / `challengeIn` on `document.body`, page scope), arms the variant through `/__control/arm`, and reads a real page. Observed:
  - at load: `{"robot":null,"challenge":null}`
  - check up: `{"robot":"person_only","challenge":"captcha"}`
  - with the welcome modal under it: same
  - while verifying: same
  - after the pass: `{"robot":null,"challenge":null}`

  Files: `C:\Users\osrs_\AppData\Local\Temp\claude\bc302d3e1bd85154\1d7e40a9-22b4-41e1-ad74-ba7e457da62b\scratchpad\timed-check-detector-probe.mjs` and `timed-check-detector-entry.ts`.
- The Lab's own loader (`loadPersonChecks`) on the built module accepts both checks and the four rows (`free-hubs-under-ten/timed-check:true`).
- `pnpm --dir packages/test-runner check` → exit 1, before any of my code is compiled: "FluxIQ Core's build at …\t885\!FluxIQ is not current with its source. Stale: … fluxiq:build: inputs changed: packages/fluxiq." Core is being edited by others (answer-first/rows, person.test.ts). I did not rebuild Core. In its place:
  - `npx tsc -p tsconfig.json --noEmit` (in `packages/test-runner`) → exit 0.
  - `node scripts/clean-dist.mjs && npx tsc -p tsconfig.json` → exit 0. These compile against the existing Core and domain dists.
- `node --test dist/attempt-lane/scripted-model/scripts/tests/*.test.js dist/attempt-lane/scripted-model/tests/*.test.js dist/flow-lane/creation/site-change/asked/tests/*.test.js dist/person-simulation/tests/*.test.js` → `# tests 96 # pass 96 # fail 0`. Earlier, the site-change, judgement/request, person-simulation and attempt-lane tests gave 102/102.
- `node scripts/structure-audit.mjs` → `structure-audit: passed (244 warning(s), 552 baselined).` The only warnings on files I touched are the pre-existing line-count advisories.

## The command to run after integration

It needs the fix below, the parallel look fix, and fresh builds. From PowerShell, with the default 4 attempts:

```powershell
$env:FLUXIQ_ATTEMPT_SCRIPT_FORM = "timed-check"; pnpm lab attempt crossborder-marketplace --task crossborder-marketplace-free-hubs-under-ten-timed-check --authoring-mode answer-first --scripted-model; Remove-Item Env:FLUXIQ_ATTEMPT_SCRIPT_FORM
```

What a pass should show:

- `attempt-1/person-hand-offs.json` holds two hand-offs, both `cleared` / `person_done`:
  - `timed-check`, from a look;
  - `traffic-screen`, from the ceiling press, which is the action path as today.
- The script raises no refusal.
- Attempts 2 to 4 hand off nothing.

## Not verified

- No Lab attempt was run, as the brief required. So the end-to-end hand-off from a look, and Core resuming in place, are unexecuted.
- **`lab attempt` does not arm a task's variant.** `packages/test-runner/src/attempt-lane/live/run-attempt-command.ts:194-197` `resetSite` only resets the lab and loads the start page. No attempt-lane code calls `armScenarioVariant`. That folder is on my must-not-touch list. Fix: after `resetScenarioLab(...)` add
  ```ts
  if (workflow.variant) await armScenarioVariant(opened.topology.scenarioOrigin, opened.topology.allocation.controllerToken, scenario.id, workflow.variant);
  ```
  and import `armScenarioVariant` from `"../../lab-control/index.js"`. It runs once, before attempt 1, since `seedSite` runs once. Rows with `variantArmedAfterBuild` would need their own timing; this row has none. Without the fix, the form's second decision throws "no check stood over it: the variant was not armed, or its timer had not run".
- **Which capture first meets the check.** The navigate's after-look or the form's look both count. A landing read that ran later than 1.5 s on a slow machine would be the action path, and the form cannot tell it apart: both carry `initial.core.run_node`. The step log can tell: step 0002 `meta.json` spans and `result.json` show whether `send.navigate` or the `look.after` capture failed.
- The proof depends on the parallel worker's client look fix. Without it, the form throws "looked at the page while the check stood, and the look handed nothing to the person".
- I did not confirm that Core's request evidence keeps `personCompletedCheck` on the standing entry. It is read from Core's `person-needed-tool-calls.ts` `standing()`, not from a run.
- I did not confirm what Core's fresh look after Continue runs in answer-first. It reruns the loop's `initialObservation` input, and the opening call there is a navigate. If so, "resume in place" is the start page again; the check, being passed, does not return.
- The browser-paths and breadth-paths suites were not rerun after the delay changed from 1000 to 1500 ms. The unarmed site does not read the delay.

## Open questions or contradictions found

1. The brief assumed the round opens with a look. In answer-first, the opening call (`initial.core.run_node`) is a `web.output.browser-navigate` (seen in every sampled run). So "the round looks while the check stands" is met by the navigate's after-look or by the form's explicit look, not by an opening look.
2. The existing free-hubs `plain` script answers only 2 chat turns, the same as the other scripts, while `lab attempt` defaults to 4 attempts. `plain` was left as it was. The new form answers 4.
3. `docs/architecture/testing-facility.md` is not on my paths. Its tables "Check the Lab recognises" and "Declared on" need rows for the timed check (crossborder "Please confirm you are human": press Verify you are human, clears in place; `free-hubs-under-ten/timed-check`: completes, required). They also need a note that `lab attempt` arms the task's variant once the fix lands.
