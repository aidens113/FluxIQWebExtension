# t496 satisfied-step-effect-flip: worker report

## Outcome

Done, after the continuation granted the four domain files. While a Flow is built, a recorded step effect now leaves
out what the page changes by itself. The check (`route-state/effect/holds.ts`) and Core are unchanged.

## Cause (proved, first pass)

**Short version.** The store step's recorded effect contained the call-to-action of an auto-rotating hero carousel.
The check needs every added name on the page, so it passed only while that slide showed.

**The stored effect.** It is in the Lab's persisted Flow, bootstrap `88ff65442511e352`, node s5,
`routeSignatures.effect`. Its `added` hashes are `87fd865c` and `edc260d3`. Hashed with the host's own
`controlHash`:

- `87fd865c` is "pickup or delivery? millbrook crossing supercenter", the real effect.
- `edc260d3` is "shop rollbacks", slide 0's call-to-action.

**How the carousel got in.** The fixture rotates the hero every 4 s through three slides, and each fresh load starts
on slide 0.

- The fresh capture taken just before the act (`node-run/run.ts`, `current`) caught slide 1.
- "Set as my store" reloads the page, so the after-capture showed slide 0.
- The difference therefore counted "shop rollbacks" as added by the act.

**Reproduction.** I bundled the domain's own signer and check and fed them the run's logged controls. The signer
reproduced the stored effect byte for byte. The check said true on slide 0 only.

**Timing.** The three attempts read slides 2, 1 and 2, and 0071 to 0073 is about 13 s (one 12 s cycle plus 1 s). That
fits observation 3 landing on slide 0.

**Round 12.** It shows the same pattern. Another stored lane-B Flow (`ae5a6e1641ecc875`) carries the identical
effect.

## What changed and why

**Rule.** Names that change between two captures of the same page, with no act between them, are the page changing by
itself. The build collects them per Flow and per page, and leaves them out of a recorded effect.

**When two captures are compared** (`plan-resolution/self-changing/names.ts`). The first must be the newest capture
the build recorded, and all of the following must hold:

- **No act between them.** `acting` clears the newest capture. The node run calls it just before its command goes
  out, and before and after a Core replay (the reset, step and verify calls).
- **One document.** Same location and same `navigation.timeOrigin`, which is the browser's own document identity. A
  reload, a navigation, or a Core trial that starts from the start location produces a new document, so an act
  never sits between two compared captures that way.
- **Both whole.** A capture cut short, or one without a route state (for example the one-element captures of trial
  way-outs), ends the chain instead of being compared.

**Which names count.** Only a pair in which some name *appeared* by itself counts, and then every name gained or lost
in that pair is the page's own (a banner swapping one slide's link for the next). A pair in which names only went
away does not count. A notice an act raised that fades out on its own ("Added to cart") is therefore never marked,
and the next act that raises it still keeps it as its effect.

**The signer** (`route-state/effect/sign.ts`). It takes an optional set of self-changing hashes and filters them out
of `added` and `removed` before the 16-hash sample is taken. If nothing the act added would be left, it returns the
effect exactly as signed before, as the supervisor required. `holds.ts` and `seen.ts` are unchanged, and
`web-effect.v1` stays, because what is hashed and how is unchanged.

**Files.**

- `domain/src/runtime/route-state/effect/self-changes.ts` (new): `webAutomationRouteSelfChanges(earlier, later)`
  returns every appeared and disappeared control hash, never sampled. Exported from `route-state/effect/index.ts`
  (one line), because `page-features.ts` is not exported.
- `domain/src/runtime/route-state/effect/sign.ts`: the optional `selfChanging` set, as above.
- `domain/src/runtime/llm-evidence/plan-resolution/self-changing/names.ts` and `index.ts` (new): the per-Flow memory
  (`captured`, `acting`, `of`), bounded to 64 pages per Flow and 512 names per page.
- `domain/src/runtime/llm-evidence/plan-resolution/target-packets.ts`:
  - each Flow keeps a `selfChanging` memory;
  - `remember` and `rememberLook` feed it;
  - a new `acting(scope)` method;
  - `acted` passes `selfChanging.of(before.evidence.location)` to the effect;
  - a header paragraph.
- `domain/src/runtime/llm-evidence/plan-resolution/act-effect.ts`: passes the set through, and still keeps no effect
  when nothing was added.
- `domain/src/runtime/llm-evidence/node-run/run.ts`: calls `acting` before dispatch and around a replay. To stay under
  800 lines (now 756), `withHandleShape` and its constants moved to `node-run/handle-shape/with-handle-shape.ts` and
  `index.ts` (new) as `webNodeWithHandleShape`. It imports `structure/handles` directly rather than the `../structure`
  barrel, which removes one module cycle run.ts had.
- Tests:
  - `route-state/effect/tests/self-changing.test.ts` (new);
  - `plan-resolution/self-changing/tests/names.test.ts` (new);
  - two end-to-end tests appended to `plan-resolution/tests/act-effect.test.ts`.

  All use a generic recipe site: a banner with three slides that moves one slide per capture and resets on reload,
  and a units switch whose press reloads. This reproduces the slide-reset-on-reload shape from the run.

**Why the files sit in subdirectories.** The first layout broke four audit rules: `node-run/` and
`plan-resolution/tests/` went over 25 files, a fixture used a conditional spread, and `handle-shape.ts` closed a
32-module cycle through the `../structure` barrel. All four were fixed by this layout.

## Questions 3 and 4 (unchanged from the first pass)

**Question 3.** No separate defect. Core emits the red "Recovering from a failed step" row only after state routing
found no way on (`step-loop/failed-attempt.ts:88`). A state-routed skip is settled as done by the extension
(`apps/extension/src/panel/chat/stream/step/messages.ts:173-257`). The red cards were attempts the wrong effect really
judged `no_match`.

**Question 4.** The cause was proved without new logging. The Lab cannot keep `stateRouting.reason`:
`packages/test-runner/src/flow-lane/state-routing-attempt.ts` admits only `outcome` and `code`.

## Commands run and observed results

**Fail-first.** I temporarily replaced the signer's set with an empty one (marked `FAIL-FIRST PROBE`, then restored
from a copy; `grep -c FAIL-FIRST` printed 0 after restore). Command:
`DOMAIN_TEST_BUILD_LABEL=t496-failfirst node scripts/test-domain.mjs route-state/effect/tests/self-changing plan-resolution/tests/act-effect plan-resolution/self-changing`

- With the probe: `# tests 13 # pass 11 # fail 2`.
  - Failing: "an act whose look caught a turning banner keeps only what the act did…" (end-to-end; in the first-layout
    run its assertion read `expected: 1, actual: 2` added names).
  - Failing: "told what the page changes by itself, the effect keeps only what the act did…".
- Restored: `# tests 13 # pass 13 # fail 0`.

**Typecheck** (domain):

- `node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit` -> exit 0.
- `node node_modules/typescript/bin/tsc -p tsconfig.test.json` -> exit 0.

**Directory tests.** `DOMAIN_TEST_BUILD_LABEL=t496-dirs node scripts/test-domain.mjs runtime/llm-evidence runtime/route-state`
-> exit 0, `# tests 1057 # pass 1057 # fail 0 # cancelled 0 # skipped 0`. The earlier layout also printed 1057/1057.

**Structure audit.** `node scripts/structure-audit.mjs` -> exit 0, `structure-audit: passed (188 warning(s), 646
baselined)` and "1 baseline entries can be lowered". The only warnings on touched files are the 400-line advisories
for `run.ts` (756) and `target-packets.ts` (681).

**First pass.** The esbuild repro of the stored effect and the hash identification, as reported before.

## Not verified

- **No live Lab run.** That a lane B playback now passes the store step on its first attempt is not shown live.
- **Acts the domain never hears of.** They could still sit between two compared captures if they change the page
  inside one document:
  - the harness-options tools (`press.ts`, its checkbox put-back, `enter-field.ts`);
  - a Core trial that does not reload or navigate.

  Two things limit the effect: a pair must show something appearing by itself, and an act that would be left with
  nothing keeps its effect.
- **A notice fading in the same pair as a banner turn** would have its names marked too. A later act that raises that
  notice would then keep its other added names, or its whole effect if those were all it added.
- **Coverage depends on the build having seen the page turn.** A banner never seen turning between any look and an
  act, but turning across the act, is still recorded. The slide-reset case is covered whenever the look and the act's
  own pre-act capture differ, as in the run.

## Open questions or contradictions found

- `.structure-baseline.json` can be lowered by one entry (`pnpm structure:baseline`). It is a shared file outside my
  ownership, so I left it.
- The `selfChanging` memory lives inside the targets store because that store already sees every capture of the build
  (`tools.ts` wires `shown` and `looked` into it). A reviewer may prefer it as a separate store.
