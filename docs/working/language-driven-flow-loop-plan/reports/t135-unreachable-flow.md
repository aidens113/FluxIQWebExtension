# t135 — A Flow that acts on a page must reach one

## Outcome

Done. Core has a seventh Flow Bootstrap completion check,
`flow_bootstrap.evidence_completion_cannot_reach_start`. A completed plan that
acts on the target its build was told to start at, and holds no step that goes
there, is refused and fed back the way check 6 is — nothing created, the
exploration told what is missing, the same budget and no-progress guards, and no
provider call on any path.

Nothing was committed. All work is in `F:\!FluxIQ` on `dev`, unstaged.

## What changed and why

### New module: `runtime/flow-bootstrap/reachability/`

Modelled on `answerability/`, file for file.

- `contracts.ts` — `AutomationStudioFlowBootstrapReachability` (the verdict) and
  `AutomationStudioFlowBootstrapPlanLocations` (what the plan does about where
  it starts).
- `plan-locations.ts` — walks the plan once and answers two questions per step:
  does it act on the bound domain's own target, and does it carry where the Flow
  starts.
- `library-locations.ts` — the correctability gate, the counterpart of
  `library-record-sets.ts`.
- `check.ts` — `checkAutomationStudioFlowBootstrapReachesStartLocation`.
- `index.ts` — publishes `check.ts` and `contracts.ts` only; the two helpers stay
  private for the same reason answerability keeps its three private.
- `tests/check.test.ts` — 13 tests.

**When it refuses.** All three must hold, as the brief specified:

1. the build was given a start location (absent or blank → `{ ok: true }`);
2. the plan holds at least one step that acts on or reads the bound domain's own
   target;
3. no step of the plan carries that start location.

**"Acts on the target"** is read declaratively, not from a list of action names:
a node whose `availability.kind === "domain"` is one the bound domain registered,
and a Core node counts when it names a non-empty value in the parameter its own
definition marks `ui.control === "reference"`, `referenceType === "action"` —
which is exactly `builtin.policy.action`'s `outputId`, the one way a Core node
dispatches a domain output. This is the same kind of reading `plan-record-sets.ts`
does with `ui.control === "record-output"`. A plan of ordinary Core nodes has no
such step, so it is never asked to reach anything.

**"Carries the start location"** is a text comparison, because
`flow-bootstrap/start-location.ts` says Core never parses the value — the
spelling belongs to the domain. A step counts when any string anywhere in its
parameters (walked to depth 6, at most 64 values, case-insensitive) agrees with
the start location from the first character for twelve characters, or for the
whole start location when it is shorter than twelve. Twelve is longer than any
scheme-and-separator head (`https://` is eight), so agreement that short is
agreement about nothing.

The looseness is deliberate and is what keeps the constraint in the brief — refuse
what provably cannot run, not what you cannot confirm. Given start location
`https://shop.test/collections/audio`, all of `https://shop.test/`,
`https://shop.test/collections/audio?page=2` and
`https://shop.test/collections/lighting` count as going there, so a build that
writes the step that goes there with the site's front page or a neighbouring
page is not refused. What does not count is text sharing only the scheme, or a
plan with no location-shaped text at all — the measured failure.

**Why the refusal is correctable.** Two things keep it off the rewrite-loop
path. The library gate stands down for a domain that registers no node with a
required free-text parameter, i.e. no node that can be told a destination at all
— the exact parallel to a library that returns no rows. And where the check does
fire, the build's own steps acted on the target, which means the domain let them
act, which means the build had already reached the start location: the step it
needs is one it ran.

**Cost.** One plan walk and at most one walk of the node library. No provider
call on any path.

### Wiring

- `runtime/llm/harness-options/bootstrap-completion.ts` — new optional
  `startLocation` input; the check runs after answerability on the plan that
  would have been built; new failure code in
  `AutomationStudioFlowBootstrapCompletionFailureCode`. The private `refused()`
  helper's last parameter changed from an answerability-specific
  `cannotAnswer` to a general
  `{ key: "cannotAnswer" | "cannotReach"; detail; instruction }`, so both
  capability refusals carry their own account and their own sentence under their
  own key. Header comment rewritten to describe two capability checks rather than
  one.
- `runtime/service.ts` — the one call site passes the build's `startLocation`
  (one line, spread so an absent value stays absent).
- `runtime/flow-bootstrap/generation-failure.ts` — the code added to
  `provider_output_validation`, to `flowBootstrapEvidenceCompletionFailure`'s
  accepted union, and to the non-retryable arm of the retryability switch.
- `runtime/flow-bootstrap/plan/issue-feedback.ts` —
  `bootstrap.cannot_reach_start_location` added to `AUTHORED_CODES`, so its
  sentence reaches the model. The sentence is Core's own and quotes nothing,
  which is what that list requires.
- `runtime/flow-bootstrap/index.ts` — barrel export.

### What the model is told

Issue `bootstrap.cannot_reach_start_location` at `plan.subflows`, message: "This
Flow acts on the target it was told to start at and no step of it goes there, so
no run of it could take its first step." Beside it, `cannotReach`:

```json
{
  "starts": "https://shop.test/collections/audio",
  "lacks": "no step of this Flow goes to where it starts",
  "steps": ["web.output.dom-extract_list"]
}
```

and an instruction to run the node that goes to `cannotReach.starts`, keep it in
the draft as the first step, and finish again — naming it as the same step the
build had to run before anything else would run for it. The start location is the
value whoever asked for the build declared and the model was already shown in its
bootstrap context; it is no more a word of the page than the downstream refusal's
own `startLocation` is.

### Documentation

`F:\!FluxIQ\docs\architecture\automation-studio\llm-flow-bootstrap.md`: check 7
added to the ordered list, a new section describing what it catches, how loose
the comparison is and which three cases it leaves alone, and the refused-feedback
paragraph extended.

## Commands run and observed results

All from `F:\!FluxIQ\packages\fluxiq`.

`npx vitest run src/programs/automation-studio/runtime/flow-bootstrap/reachability`

```
✓ src/programs/automation-studio/runtime/flow-bootstrap/reachability/tests/check.test.ts (13 tests) 6ms
 Test Files  1 passed (1)
      Tests  13 passed (13)
```

The 13 cover, in the brief's order: a one-node extraction with a start location
and no navigation refused; the same plan with a navigation accepted; a build
given no start location (and one given blank text) untouched; a plan of Core
nodes untouched; the feedback naming what is missing. Plus: a Core node
dispatching a domain output counts as acting, and one naming no output does not;
front page, deeper page and neighbouring page all count; a different site and a
bare scheme do not; a start location shorter than twelve characters is held to
the whole of itself; and a non-web domain fixture (`doc.output.*`) for the
library gate — untouched with a read-only library, refused once an "open
document" node with a required text `location` exists, accepted once the Flow
opens the document first in that domain's own spelling.

`npx vitest run src/programs/automation-studio/runtime/flow-bootstrap src/programs/automation-studio/runtime/llm/harness-options`

```
 Test Files  28 passed (28)
      Tests  376 passed (376)
```

`npx tsc --noEmit` — no output, exit 0.

`node scripts/structure-audit.mjs` (from `F:\!FluxIQ`) — 3 violations, all in the
`file-lines` rule and all pre-existing:

```
FAIL [file-lines] .../flow-bootstrap/generation-failure.ts: 817 lines exceeds the 800-line limit.
FAIL [file-lines] .../runtime/llm/evidence-loop.ts: 889 lines exceeds the 800-line limit.
FAIL [file-lines] .../runtime/service.ts: 4585 lines exceeds the 800-line limit. Baseline for this entry is 4584.
```

`evidence-loop.ts` is untouched by this task. `service.ts` is +1/−1 by
`git diff --numstat`, so its line count is unchanged from `HEAD` and its
violation is not from this task. `generation-failure.ts` was 812 lines at `HEAD`
— already over the 800 limit and not in `.structure-baseline.json` — and this
task took it to 817. The five lines are the new code in three required places
plus a two-line comment; I shortened the comment from five lines to two to keep
the growth to the minimum the change needs. It cannot be brought under the limit
without splitting the file, which is outside this brief.

`npx vitest run src/programs/automation-studio/runtime/tests` — 490 passed, 1
failed:

```
FAIL .../runtime/tests/service-bootstrap/tests/accounting.test.ts >
  AutomationStudioService generateFlowBootstrapAdaptation >
  attributes an unexpected harness throw conservatively without fabricated accounting
AssertionError: expected null not to be null
```

**This failure is pre-existing.** I verified it rather than assuming: I copied
the five changed source files aside, restored the `HEAD` version of each one,
re-ran that single test file and got the identical failure, then restored my
versions and re-ran `tsc --noEmit` (clean) and the 376-test suite (all pass) to
confirm the tree was back. The test exercises the non-evidence-guided single-call
path, which none of this task's changes touch.

`npx biome check` on the new and changed files reported "No files were processed
… these paths were provided but ignored", so Biome does not lint this directory.

## Not verified

- **No live run.** The fix is proven by unit and integration tests, not by
  rebuilding Core and re-running `run-muht9lpw-a39aa056`'s scenario. The brief
  forbade `pnpm --filter fluxiq build` because live runs are using Core's `dist`,
  so the check is not in any `dist` a live run would load until someone rebuilds.
- **The loose comparison against real sites.** It is tested against
  `https://shop.test/...` shapes, not against the ten measured sites' actual
  start locations. A start location and a navigation that agree on fewer than
  twelve leading characters would be refused; I believe that cannot arise from a
  draft-built Flow, because the downstream domain anchors the first move to the
  start location's own origin (`webScopeAnchor`), but I did not exercise that
  end to end.
- **`pnpm check`, `pnpm test`, `pnpm build`** were not run in full; the brief
  named vitest paths and `tsc --noEmit`, and the build is forbidden.
- Whether the non-evidence-guided one-call bootstrap path should get the same
  check. It does not have it: only the evidence-loop completion check calls it.

## Open questions or contradictions found

1. **The brief's phrase "no step of the plan reaches that start location" needed
   an operational reading, and Core cannot have the obvious one.** Core is
   domain-neutral: it has no notion of navigation, and `start-location.ts` states
   plainly that Core never parses the value. So "reaches" cannot mean "contains
   `web.browser.navigate`". The two candidate readings were a new metadata flag
   the domain would declare on its navigating node, and a text comparison against
   the value itself. I took the text comparison, because the metadata flag would
   require a downstream change the brief put out of scope and the check would
   therefore never fire on the very run that motivated it. If a declared flag is
   wanted later, `plan-locations.ts` is the one place that decides this and the
   swap is local.

2. **A plan whose only location text points at a different site is refused.**
   That is a deliberate consequence, not an oversight: such a Flow does not start
   where it was told to. It is also the one case where the check refuses
   something it has not strictly proved cannot run — a Flow that goes elsewhere
   would take its first step, just not at the declared start. Say so if you want
   that case accepted; making it pass means asking only whether any step carries
   *any* location, which weakens the check considerably.

3. **`docs/working/README.md` in `F:\!FluxIQ` shows as modified (+2/−1) and is
   not mine.** It appeared in `git status` partway through this task. Another
   agent is presumably working in Core concurrently. I left it alone.

4. **Two Core files are over the `file-lines` limit before this task starts:**
   `generation-failure.ts` (812 at `HEAD`) and `evidence-loop.ts` (889).
   `generation-failure.ts` is where every new bootstrap failure code has to go,
   so every task that adds one makes a red rule redder. Worth a task of its own.
