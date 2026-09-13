# Report: p-openq-triage

Worker: `p-openq-triage`. Analysis only. No source file was changed, no
`pnpm lab` command was run, nothing was committed.

## Outcome

**Done.** All 24 unsettled entries re-verified against the tree by reading the
named file, not the reports. **Three are now settled** and must not be briefed;
**one is materially narrowed** and its current description would send a worker
at the wrong fix; the rest hold. Two new items folded in as the brief asked, and
one of them turned up a live contradiction between the plan and the code.

### The snapshot, and why it matters more than usual

Read at **2026-09-12 17:43 PDT**, `HEAD = 1b6f5df`, with **75 files dirty in the
working tree** — up from 36 when I began reading forty minutes earlier. Other
workers are editing `veto.ts`, `resolve-target.ts`, every `content/actions/*.ts`,
`gateway-mapping.ts`, the plan itself, and `scripts/lab/`, right now. Every line
number below is from that snapshot and several will move.

This is not a caveat to skim. **Three of the four "already settled" findings
below were settled in uncommitted working-tree edits**, not in a commit. Anything
briefed from this report before those edits are committed will collide.

I made and caught one confident wrong claim while writing this: a `grep` for
`resolution` in `gateway-mapping.ts` returned empty output through a compound
shell command, and I nearly reported that the field was dropped. Re-run alone it
returns two hits, including `gateway-mapping.ts:246 resolution: result.resolution`.
The lesson is the one the file already keeps learning — verify, then verify the
verification — and the practical one is that batched greps in a compound command
can lose output here. Every finding below was re-checked with a single command.

---

## Part 1 — Entries that are settled and must not be briefed

Each costs a whole worker if left marked open. This has already happened twice
today, which is why the brief exists.

### 1. "The runtime error type has no producer, and its code is not a closed type" — **SETTLED**

Also settles **item 2 of the Wave 3 integration checklist**, which the audit
correctly flagged as the same entry twice. Both should be marked in one edit.

`domain/src/runtime/errors.ts` **no longer exists**. `WebAutomationRuntimeError`
was deleted rather than given a producer, and the reasoning is written down at
`domain/src/runtime/failure/carrier.ts:1-27`:

> in the whole of Phase 1.5 not one producer used it … The class was removed on
> 2026-09-12 rather than given a producer, because the record is strictly the
> better carrier

The replacement is `WebAutomationFailureCarrier` (`carrier.ts:46`), whose
`failure: WebAutomationFailureRecord` carries the closed code set
(`domain/src/runtime/failure/codes.ts:75`). Both halves of the entry are gone:
there is no producerless type, and the code is closed at the throw.

**Two production classes now declare it**, which is the part worth recording
because a fresh report says otherwise:

- `apps/extension/src/content/actions/execute.ts:80` —
  `class UnsupportedActionTypeError extends Error implements WebAutomationFailureCarrier`
- `apps/extension/src/content/action-runtime/resolve-target.ts:157` —
  `class TargetResolutionError extends Error implements WebAutomationFailureCarrier`,
  with `readonly failure: WebAutomationFailureRecord` at `:158`

`L-review` finding 4 ("The compiler guard `carrier.ts` documents exists only in
its own test", written 17:14) was true when written and is **false now** —
`TargetResolutionError` was narrowed from Core's record to the domain's in the
working tree, and `resolve-target.ts:146-155` records the change. Do not brief
L-review 4.

### 2. "The fingerprint's declared field is write-only" — **SETTLED**

`apps/extension/src/content/action-runtime/resolve-target.ts:479-481`:

```ts
function recordedTarget(action: BrowserActionCommand): RecordedTarget | undefined {
  return describedElement(action.element) ?? describedElement(action.options?.element);
}
```

The typed path is preferred and the untyped blob is the fallback, which is
exactly the one-line fix the corrected entry named. Uncommitted.

### 3. `L-review` finding 3, "`resolution` is produced, declared, and dropped" — **SETTLED, and it is not in this file yet**

Recorded here so nobody adds it. `domain/src/client/gateway-mapping.ts:246`
carries `resolution: result.resolution` on the payload, and the test that used
to pin the drop now pins the carry:
`domain/src/client/tests/gateway-mapping.test.ts:418`
`assert.deepEqual(carried.resolution, measured, "the result mapping carries the
resolution measurement")`, with a second row at `:420-424` asserting the shape
stays free of page text. The comments in `resolve-target.ts:49-51` and
`results.ts:82-84` are accurate. Landed in the working tree after L-review read.

---

## Part 2 — The entry whose description is now wrong

### "A routine command deletes tracked build artifacts" — **NARROWED, still open, and the current text sends a worker at the wrong file**

The entry (and its 2026-09-12 correction) describes a chain that no longer
exists. `package.json:49` is now `"lab": "node scripts/lab/run-lab.mjs"`, and a
per-instance Lab landed today (uncommitted: `scripts/lab/*`,
`packages/test-runner/src/lab-instance/*`).

What actually holds:

- `scripts/lab/run-lab.mjs:25-28` exports `FLUXIQ_LAB_EXTENSION_BUILD_ROOT` into
  the build phase.
- `apps/extension/scripts/build-extension.mjs:18-20` honours it —
  `const buildRoot = resolveBuildRoot(process.env.FLUXIQ_LAB_EXTENSION_BUILD_ROOT)`.
- **But** `scripts/lab/lab-instance.mjs:41`:
  `const extensionBuildRoot = instance === null ? path.join(root, "apps", "extension") : owned(["apps", "extension"]);`

So with `FLUXIQ_LAB_INSTANCE` unset — which is what `pnpm lab` means to anyone
who has not read the new document — the build root is the repository's own, and
`build-extension.mjs:76 await rm(buildDir, { recursive: true, force: true })`
still deletes and rewrites the ten tracked files under `apps/extension/build/`.
`docs/architecture/repository-layout.md:91` now documents this as intended:
default runs write to `apps/extension/build/`, instanced runs to
`apps/extension/.lab-instances/<id>/build/`.

Proof it is live, not theoretical: `apps/extension/build/content/index.js` and
its `.map` are dirty in the tree at this moment.

**Rewrite the entry to:** the concurrency hazard is closed; the tracked-artifact
side effect survives on the default path only. The original choice stands —
untrack the artifacts, or give the default instance its own build root too.

---

## Part 3 — What genuinely remains, ranked by consequence

Twenty items. The middle band is the one this plan keeps failing at, so it is
the longest and it is ordered within itself.

### Band A — visibly broken immediately

**A1. `connection.ts` is at the hard limit, not near it.** 745 lines against
`fileLines: 800`, and **40 class-indent method declarations against
`classMethods: 40`** (`scripts/structure-audit/context.mjs:44`). The next method
added to `FluxIQConnection` fails `pnpm check` outright. Counted with a regex
over class-indent declarations, which returns 40; read it as 39 or 40, and
either way the next one trips it. **This blocks A2** — that fix needs to add
behaviour to that file.

**A2 (blocked by A1). The extension latches idle when Core refuses a recording
start.** `connection.ts:589` still calls `clearPendingRecordingStart()`, killing
the 750 ms fallback (`:83`); no retry; the block is a bespoke UI state
(`:597-601`) rather than a classified failure. The surfacing half is genuinely
done. What is left is one retry and one classification — and both are methods on
a class that cannot take another.

**A3. The domain test runner aborts the whole suite on the first throw.**
`domain/scripts/test-domain.mjs:54-57` is still a bare
`for (const entry of entryPoints) { … await import(…) }` with no `try`/`catch`
and no per-entry reporting. During a parallel wave this reports `# tests 10` and
an abort where 234 tests exist. Unchanged.

**A4. Two test-command traps, which are one task.**
`apps/extension/e2e/playwright.content.config.ts` sets `fullyParallel: true` and
**no `workers`**, so the default concurrency is the one that fails 66 of 66 with
uniform 30-second timeouts and no assertion diff. Separately,
`pnpm … test:content -- --workers=4` forwards the `--` to Playwright as a
filename filter and runs zero tests. Both are the same product defect seen
twice: *the content harness cannot be invoked correctly by default*. Pinning
`workers: 4` in the config makes the correct invocation the only one and retires
both entries and the `[SUPERSEDED]` duplicate.

**A5. `domain/.test-build/` is tracked and stale.** 259 tracked files;
`domain/.test-build/domain.test.mjs` is dated 2026-09-11 00:05, before every
Wave 3 domain change. One unlabelled domain test run on a still tree.

### Band B — silently wrong in production

**B1. A recorded action can be silently dropped from the proposed Flow.**
Unchanged since Wave 2, still undiagnosed, still the only known defect where the
product loses a user's action and reports success.
`packages/test-runner/src/flow-lane/recording-flow-proposal.ts:33-35` throws only
when candidates is *empty*; `candidateCount` is carried
(`recording-flow-proposal.ts:41`) and written into the manifest
(`run-scenario.ts:311`) but **compared to nothing**. A 4-of-5 loss passes.

*Inference, not measurement:* `run-flow-lane.ts:84
assertFlowActions(expected.actions, run.actions)` would now fail the lane for a
manifest that declares the missing verb, and `basic-form` declares all three
(`apps/scenario-lab/src/scenarios/basic-form/scenario.ts:28`). So the *lane*
would probably catch a recurrence today. That is not the same as the product
catching it, and it is not a reproduction. I did not run anything.

**B2. The Level 1 veto's two uncovered limits — and the plan describes them
wrongly.** (New; the brief asked for this.) Both limits are documented well in
`apps/extension/src/content/identity/veto.ts:78-88`, under "## What the veto
still cannot do":

> **A recording that names nothing is not protected and cannot be.** … Measured,
> an impostor reaches **+0.563** there, and Level 2 would resolve it too.
>
> **An impostor that carries the recorded label passes.** Inherent … Nothing in
> a fingerprint can distinguish two controls a page has made identical.

**Plan D14 says something different, and D14 is the one a reader reaches first**
(`docs/working/mvp-week1-web-automation-reliability-plan.md`, D14's closing
paragraph):

> a recording that captured **no visible text** is barely protected (0.641 and
> 0.145, both still acted on)

These are not the same population and not the same numbers. `recordedDistinguisher`
(`veto.ts:196-201`) returns true for **any** of `visibleText`, `accessibleName`,
`label`, `id`, `testId`, `data-testid` — so a recording with no visible text but
an accessible name **is** protected, and D14's sentence overstates the exposure
while misnaming which recordings it covers. D14 reads as written before rule 2
(corroboration, `veto.ts:154-181`) landed. **The code's account is the correct
one; the plan's is stale.** The brief's own phrasing ("a recording that captured
no visible text") inherits D14's error — the real limit is "a recording that
named nothing distinguishing".

**And four source files cite a report that does not exist.**
`reports/L-veto-recordings.md` is referenced by `veto.ts:24`,
`identity/tests/veto.test.ts:28` and `:201`,
`e2e/content/tests/identity-resolution.spec.ts:81`, and the plan at `:252`. The
file is absent from `reports/`. Either a worker is still running, or its report
was never written; either way five citations point a reader at nothing, and the
enumeration that justifies the veto's threshold is currently unverifiable by
anyone but its author.

**B3. An unusable parameter has no rejection channel.** Unchanged and now stated
outright in the code: `domain/src/client/gateway-action-parameters.ts:12-17` —
"Nothing here coerces. A value of the wrong shape is refused, which leaves the
command field absent and the raw parameter still visible in `options`." A refused
`upload` reaches the page as a command with no files and the operator sees the
symptom. The shape to copy is still the single case at `gateway-mapping.ts:123`
(`WebAutomationActionRejection`, `web.action.unsupported_type`).

**B4. `capture_snapshot` cannot match the state pipeline's frame coverage.**
`apps/extension/src/runtime/action-runner.ts:218` sends
`topFrameOnly: frameId === undefined`, and `content/message-handler.ts:43` makes
that mean top frame only, while the state pipeline merges every frame.
**Narrowed since the audit:** `action-runner.ts:171-195` now *documents* why
`topFrameOnly` stays (`packages/test-runner` broadcasts to a whole tab, where the
send option does not exist) and states "An action that names no frame runs in the
top frame, which is the frame a Flow means when it says nothing." So this is no
longer an oversight; it is a deliberate contract with an unreconciled consequence
for `web.dom.capture_snapshot` specifically. Re-scope the entry to that verb.

**B5. The recorder captures neither a checkbox's checked state nor a landmark's
name.** Two entries, one task — see Part 4.
`apps/extension/src/content/describe-element.ts` contains no `checked` at all and
`DomElementDescriptor` declares no such field; `shared/protocol.ts:232-233`
declares `landmark?: string` as "The nearest landmark role" and
`content/identity/context.ts:40` fills it from `nearestLandmark(element)`, a role.
The first makes a recorded toggle unreplayable; the second makes the two named
regions of `ambiguous-targets` indistinguishable and blocks corpus workflow W26.

**B6. The expired auth-gate workflow still cannot report `auth_required`.**
`domain/src/io/input-model.ts:109-113` still gates `navigationRequested` on
`metadata.transition === "typed"` (it gained a `RECORDING_START_REASON` exclusion
but not a client-side-navigation case), so a `location.assign` yields no Flow
step; `apps/scenario-lab/src/scenarios/auth-gate/manifest.ts:79` still expects
`failure: { category: "auth_required" }`. The audit is right that the stated
blocker is gone. One thing changed underneath it today: `v-flow-reload` replaced
the Flow lane's post-arm `page.reload()` with `openScenarioStart(…startPath)`, so
the armed run now begins on the sign-in page rather than wherever the recording
ended — brief this against the *new* lane sequencing, not the old one.

**B7. A client's declared type and capabilities are self-asserted.** Core
`packages/fluxiq/src/client-gateway/service/lifecycle.ts:84-91` `applyHello`
still assigns `session.clientType` and `session.capabilities` straight from the
hello frame. The downstream half is now honest rather than fixed:
`domain/src/runtime/adapter.ts` gained 22 lines today saying so in as many words
— "this is defence in depth against *our own* producers … and not a boundary
against a client that lies. Nothing reachable here would make it one". Nothing
left to do in this repository. Week 2 Core decision.

**B8. The declared-secret mechanism is adopted by no scenario.** A grep for
`secrets:` across `apps/scenario-lab/src/scenarios/` returns **zero** hits — the
only match repository-wide is the schema at
`packages/test-contracts/src/scenario.ts:223`. `auth-gate/manifest.ts:43` still
carries `authGateDemoCredentials.password` as a literal recording-script value.
Ranked here rather than in hygiene because the whole redaction line of work is
untested end to end while no scenario declares a secret.

### Band C — hygiene

**C1. Three false or stale sentences on load-bearing code.** All verified false
against the tree today:

- `apps/extension/src/content/action-runtime/validation-outcome.ts:23-30` says
  the record type reached through `BrowserActionResult["failure"]` is "Core's
  `AutomationStudioFailureRecord`" and "types `code` as a bare `string`". It is
  not: `apps/extension/src/shared/protocol.ts:346` makes `BrowserActionResult`
  the domain's `WebAutomationActionResult`, `domain/src/actions/types.ts:302`
  declares `failure?: WebAutomationFailureRecord`, and
  `domain/src/runtime/failure/codes.ts:75` closes its `code`. The comment argues
  for deletion-over-types on a premise that is no longer true. This is the exact
  residue the settled protocol entry predicted and nobody cleared.
- `apps/extension/src/content/action-runtime/results.ts:73` — "the domain's
  classifier honours a `WebAutomationRuntimeError`", a class deleted today.
  Replacement text is written verbatim in `v-error-seam.md`.
- `domain/src/runtime/tests/adapter.test.ts:143` — same, attributes the
  behaviour to `classifyWebAutomationFailure` and "a runtime error". Replacement
  also written in `v-error-seam.md`. *(Both files are working-tree-modified right
  now; check before briefing.)*

**C2. The plan conflates two failure vocabularies, in two places.**
`mvp-week1-web-automation-reliability-plan.md:553-554` — "Codes are a closed set
in `codes.ts`; the test-runner's allowlist derives from it" — and `:562-563`,
"allowlist generated from domain codes". The code is right and the plan is wrong;
the allowlist derives from `WEB_LLM_EVIDENCE_RESULT_CODES`. Two sentences. *(The
plan is modified in the tree; these lines will move.)*

**C3. `ExpectedAction.outcome: "rejected"` — nothing references it, and the
authored docs never mentioned it.** (New; the brief asked for this.)

*Nothing still references it.* `packages/test-contracts/src/scenario.ts:82` is
`export const expectedActionOutcomes = ["succeeded", "failed"] as const;`. A
repository-wide search for `outcome: "rejected"` outside `docs/working/` returns
exactly two hits, both unrelated:
`apps/scenario-lab/src/scenarios/keyboard-forms/state.ts:60` and its test, where
`outcome` is a fixture's own form-submission profile field. No manifest, no lane,
no schema carries the removed value.

*The replacement is documented well in two places and absent from a third.*
`scenario.ts:72-81` gives the reasoning — "There is deliberately no `rejected`:
no lane can report it, so an expectation spelled that way fails on itself
whatever the page does. A client refusal is `failed` here, with the refusal
carried by `expected.failure`" — and `validation.ts:143` puts the replacement
into the error message an author actually hits. **The gap:**
`docs/architecture/testing-facility.md` never mentions `expected.actions` at all
(grep returns nothing), and there is no scenario-authoring document anywhere in
`docs/architecture/`. An author who reads documents before types finds nothing.
That is a small, real hole, and it is the only part of this item that needs work.

**C4. `actions.spec.ts` is still shared and owned by nobody.** 211 lines, 18 spec
files in `e2e/content/tests/`. Two of the three original asks are done. Give it
an owner or declare it supervisor-only; do not brief it as a task on its own.

**C5. The shared action-type reader's cost is unmeasured.**
`packages/test-runner/src/flow-lane/flow-action-types.ts:30` still throws
`RunnerFailure("recording.contract", …)`, and `existing-flow-run.ts:105` still
reaches it on any existing or clone run that asserts actions. Needs a real Core
server; not exercisable here.

**C6. Nothing populates `candidates` on the wire.** `gateway-mapping.ts:181`
still says so. Now a design question, not blocked work: Level 2 scores in the
browser with Core's own matcher, so decide whether the wire ever needs them.

**C7. Selector-keyed patch lane vs fingerprint-first.**
`domain/src/runtime/llm-evidence/tools.ts:89` unchanged. Week 2 contract decision.

**C8. The Firefox floor.** `apps/extension/manifest.firefox.json:43` still
`"strict_min_version": "109.0"`. The user's call, unchanged.

**C9. Three standing environmental entries.** `tsc` access violations under
parallel load; the content harness under default Playwright concurrency (also
A4); Core's native SQLite. Keep as operational guidance; nothing to fix here.

**C10. Two process lessons with no code state.** Three Wave 3 briefs shared
`action-runner.ts`; briefs partitioned by file rather than by change. This is now
the **fifth** instance (`actions.spec.ts`, the run-manifest join, runner
alignment, `action-runner.ts`, and — see Part 4 — the veto's five-file surface).
Promote it to the plan's wave-dispatch rules and delete both entries.

---

## Part 4 — What each needs, and what must be one task

Ownership drawn around a *file* rather than a *change* is this plan's recurring
defect. Where I name files below, they are the files one change touches — not the
files one topic mentions.

### Group 1 — "the veto's account of itself" (B2). **Supervisor, on a still tree.**

Not a worker. Every file it touches is being edited right now, and the change is
mostly judgement about what is true.

Owns: `docs/working/…/mvp-week1-web-automation-reliability-plan.md` (D14's
closing paragraph only), plus whichever of these the decision picks — write
`reports/L-veto-recordings.md`, or remove its five citations from `veto.ts:24`,
`identity/tests/veto.test.ts:28,201`,
`e2e/content/tests/identity-resolution.spec.ts:81` and the plan `:252`.

Do **not** brief this alongside anything else touching `veto.ts`. Find out first
whether an `L-veto-recordings` worker is still running.

### Group 2 — "the recorder's missing identity signals" (B5). **One worker.**

Checkbox state and landmark name are two entries and one change: a signal the
recorder does not capture, added to the descriptor, the protocol type, and the
domain reader. Briefing them separately guarantees a collision on
`shared/protocol.ts` — which is precisely the defect this plan has now hit five
times.

Owns: `apps/extension/src/content/describe-element.ts`,
`apps/extension/src/content/identity/context.ts`,
`apps/extension/src/shared/protocol.ts`, `domain/src/output-nodes/targets.ts`,
`domain/src/io/input-model.ts`, and the `tests/` folders of each.
Must not touch: `content/identity/veto.ts`, `score.ts`, `candidates.ts`.

### Group 3 — "the content harness cannot be invoked correctly" (A4). **One worker.**

Owns: `apps/extension/e2e/playwright.content.config.ts`,
`apps/extension/package.json`, `docs/architecture/repository-layout.md`.
Serialize against whoever is adding `e2e/playwright.content.firefox.config.ts`
(untracked, in flight). Retires three open-questions entries including the
`[SUPERSEDED]` one.

### Group 4 — "the default Lab still rewrites tracked artifacts" (Part 2). **One worker, after the Lab work is committed.**

Owns: `scripts/lab/lab-instance.mjs`, `scripts/lab/tests/lab-instance.test.mjs`,
`docs/architecture/repository-layout.md`. One decision to state in the brief:
give the default instance its own build root, or untrack
`apps/extension/build/`. **Blocked** until `scripts/lab/*` is committed — it is
all uncommitted right now.

### Group 5 — "three false sentences" (C1) + "two plan sentences" (C2). **One worker.**

They are one change — documentation that outran the code — and the replacement
text for two of the five is already written verbatim in `v-error-seam.md`.

Owns: `apps/extension/src/content/action-runtime/validation-outcome.ts`,
`apps/extension/src/content/action-runtime/results.ts`,
`domain/src/runtime/tests/adapter.test.ts`,
`docs/working/…/mvp-week1-web-automation-reliability-plan.md`.
Conflicts with Group 1 on the plan file — **serialize, do not parallelize**.

### Group 6 — the singletons

| Item | Needs |
| --- | --- |
| A1 `connection.ts` split | One worker, whole file, nothing else concurrent. Blocks A2. |
| A2 recording refusal | One worker, **after A1**. |
| A3 domain test runner | One worker: `domain/scripts/test-domain.mjs` alone. |
| A5 `.test-build` refresh | Supervisor: one unlabelled domain test run on a still tree. |
| B1 silent Flow drop | **A Lab run**, deliberately reproducing it — not a code brief. Nothing to edit until it is reproduced. |
| B3 parameter rejection channel | One worker: `domain/src/client/gateway-action-parameters.ts`, `gateway-mapping.ts`, `domain/src/actions/types.ts` + tests. |
| B4 `capture_snapshot` frames | One worker: `apps/extension/src/runtime/action-runner.ts` + its tests. Overlaps A2's file set — serialize. |
| B6 auth-gate `auth_required` | One worker: `domain/src/io/input-model.ts` + `apps/scenario-lab/src/scenarios/auth-gate/manifest.ts`. Brief against the *new* `openScenarioStart` lane. |
| B7 self-asserted client | **The user / Core, Week 2.** Nothing to do here. |
| B8 declared secrets | Same file and same scenario as B6 — **fold it into B6**, do not brief separately. |
| C3 authoring docs | One worker, small: `docs/architecture/testing-facility.md`. |
| C5, C6, C7, C8 | **Week 2 / the user.** C8 is the user's decision, unchanged. |
| C4, C9, C10 | Supervisor practice; delete the entries, do not brief them. |

---

## The five things I would do next, in order

**1. Commit the working tree, then re-read it.** Not a task — a precondition.
Seventy-five files are dirty and three of the four settled findings in this
report exist only there. Every brief below collides with an uncommitted edit
until this happens, and the audit's own founding lesson is that an unmarked
change costs a worker. First because nothing else is safe.

**2. Split `connection.ts` (A1).** Second because it is the only item that
*fails the build on the next edit* — 40 methods against a hard limit of 40 — and
because A2 needs to add methods to it. Every hour it stays unsplit, the next
unrelated brief that touches recording fails a gate for a reason that has nothing
to do with its work. It also cannot be parallelized with anything, so it wants
the quiet tree step 1 creates.

**3. Reproduce the silent Flow drop (B1) in a Lab run.** Third, not first, only
because it needs the Lab and the Lab needs step 1's commit. It is the
highest-consequence open item in the file and the only one where the product
loses a user's action and reports success — the exact failure the week's
reliability claim rests on not having. Wave 5 cannot measure reliability while a
one-in-four silent loss is undiagnosed. My reading suggests the *lane* would now
catch a recurrence via `assertFlowActions`; that is an inference and it is not
the same as the product catching it.

**4. Reconcile D14 with `veto.ts`, and resolve `L-veto-recordings.md` (B2 /
Group 1).** Fourth because it is cheap and because it is actively misleading
right now: the plan's decision record overstates one limit and misnames its
scope, and five places in the source cite a report that does not exist. A reader
deciding whether the resolver is safe enough for live validation reads D14, not
the module header. Ahead of the remaining Band-B work because it changes what
someone believes before they act on it.

**5. Dispatch Groups 2, 3 and 5 in parallel.** Fifth because they are genuinely
independent — the recorder's identity signals, the harness invocation, and the
false sentences share no file — and because each retires two or three
open-questions entries at once, which is what shrinks this document. Group 5
must be serialized against step 4 on the plan file; Groups 2 and 3 touch nothing
either of the others does. This is the point where wider parallelism is safe,
and not before.

---

## Not verified

- **I ran nothing.** No `pnpm check`, no test suite, no build, no Lab command.
  Every claim is from reading the tree at 17:43 PDT. Where I say a test pins
  something, I read the assertion; I did not watch it pass.
- **The tree moved throughout.** 36 → 53 → 75 dirty files during the read. Any
  file I quote may have changed since. `veto.ts`, `resolve-target.ts`,
  `results.ts`, every `content/actions/*.ts`, `gateway-mapping.ts`, the plan and
  `scripts/lab/*` were all being edited.
- **B1's lane-level catch is an inference.** I read
  `run-flow-lane.ts:84 assertFlowActions(…)` and `basic-form/scenario.ts:28`; I
  did not trace `assertFlowActions`' implementation and did not run the lane.
- **A1's method count is a regex** over class-indent declarations, not a parse.
  It returns exactly 40; a parser could return 39. Either way it is at or on the
  boundary.
- **I did not re-verify the ~26 already-settled entries.** The brief scoped me to
  the open set. Several of them cite line numbers that will have moved.
- **Core was read at `a575df2`.** I read only
  `client-gateway/service/lifecycle.ts` there and made no change.
- **I did not check whether an `L-veto-recordings` worker is currently running.**
  I only established that its report file is absent.

## Open questions or contradictions found

1. **Plan D14 contradicts `veto.ts` on the veto's uncovered limit** — different
   population, different numbers (0.641/0.145 vs +0.563). The code is newer and,
   on my reading of `recordedDistinguisher`, correct. Recorded as B2.
2. **Five citations to a report that does not exist**
   (`reports/L-veto-recordings.md`). Either a worker is mid-flight or a report
   was skipped; the enumeration justifying the veto threshold is currently
   unverifiable.
3. **`validation-outcome.ts:23-30` argues from a premise the tree contradicts.**
   It says `BrowserActionResult["failure"]` types `code` as a bare `string`;
   `protocol.ts:346` → `actions/types.ts:302` → `failure/codes.ts:75` says
   otherwise. The conclusion (deletion, not types, keeps the builders gone) may
   still be the right call, but the reason given is false.
4. **`L-review` findings 3 and 4 were both overtaken within three hours of being
   written.** Not a criticism of that worker — it read a tree that then moved. It
   is the fifth instance of the pattern the file already names: a worker report
   about a file it does not own is a snapshot, not a fact. Worth applying to
   *this* report too.
5. **The brief's own phrasing of the veto limit** ("a recording that captured no
   visible text") inherits D14's error rather than the code's. Flagging it
   because the brief is where the next worker's premise comes from.
