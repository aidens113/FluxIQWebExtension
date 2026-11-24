# t1023 report: an option the site already has chosen counts as done

Worker: worker-heavy (Opus 5.5). Trees: Core `fxwork/t1023/!FluxIQ`, downstream `fxwork/t1023/!FluxIQWebExtension`. No git, Lab, browser or paid run.

## Outcome

Done. A variant the person asked for ("for pickup", a size, a colour) now counts as done when the act's own step ran on a page where that option stood chosen, by the page's own typed state. The host states that fact on the step (`chosen`, a new draft-statement field). It also states options it saw chosen on an earlier look at the same page and has not seen un-chosen since, which is the recorded shape: the chooser closed before the add. So `actsMissing`, and every refusal and stall note built from it, no longer steers toward an option the site already has. The replay gap is stated rather than closed (see Open questions).

## Cause

Two gaps, one on each side.

1. **Core only counted a choice as done when a step said it made it.** `instructed-acts/standing.ts` settles each choice (`a1.fulfilment`) only against the steps named for it (`acts` on a step, or a result claim). The act's own press counts only when its input carries the value (`choice-evidence.ts`). No path read the page's state. In run `run-mwuxd2v9-33928ea3` no step was ever named for `a1.fulfilment`, so the checklist kept it `todo: no_step_added`. `automationStudioInstructedActsNotDone` then put it in `actsMissing`. Every consumer reads that one list: the stall redirect (`evidence-progress/stall-redirect.ts:287`, "Your next step is the one that does a1.fulfilment"), the amendment feedback (`draft-amendment-feedback/notes.ts`, "Still not done on the checklist"), and authored progress. None of them has its own rule, so the fix belongs in the checklist and not in them.
2. **The host never told Core which option stood chosen when an act ran.** The domain printed `t332 clickable "Pickup" marked` on step 10's page (the store chooser, opened by the press of t7). Then the chooser closed (step 12, "Set as my store"), and the add at step 30 ran on the same page with Pickup no longer in view. The draft statement had no field for options standing chosen. The only per-control state field was `toggle`, and that one covers only the control the press itself flipped.

Offline proof against the recording (a scratch script, uncommitted; it prints only ids, a handle and the option's word). It replays the recorded page views of steps 2-30 in order through the domain's standing rule, then runs Core's real checklist on the recorded instruction:

```
add step found standing: [{"key":"t332","words":"Pickup"}]
without chosen: actsMissing = ["a1.fulfilment"]
with the add's chosen: actsMissing = []
a1 choices: [{"id":"a1.fulfilment","done":13,"stoodChosen":"Pickup"}]
```

The script re-implements the domain's memory rule over the `page.txt` view lines, because the recording holds views and not raw snapshots. The Core checklist it runs is the real one, bundled from the t1023 source with esbuild.

## What changed and why

**Downstream (domain), the typed fact.**
- New `domain/src/runtime/llm-evidence/node-run/standing-choices/`:
  - `page-choices.ts`: each line of the view, with whether it shows chosen. A line counts as chosen only by its typed tokens (`checked`, `selected`, `pressed`, `current`, `marked`), never by its words.
  - `memory.ts`: a per-build, per-page-location memory.
    - A line shown chosen stands chosen.
    - A remembered control shown again without its chosen token no longer stands.
    - A control out of view keeps what it last showed.
    - It is written through to Core's build state like the other build memories, forgotten on a fresh opening, and bounded (16 builds, 24 pages, 48 controls per page, at most 16 said).
  - `unshown.ts`: names the standing options that the page the call left does not show chosen.
- `tools.ts`: creates the memory, feeds it from every look (`looked` and `shown`), restores it per call, and hands it to the node run.
- `node-run/run.ts`: a changing node's draft statement now carries `chosen: [{ key: <handle>, words }]`, the options standing as it found the page. Its result carries `stoodChosen: ["t332 \"Pickup\""]` for those out of view, so the words are in the call's own evidence (Core's words screen needs that) and the model reads them too.
- `capture.ts` (the statement type) gets `chosen`, `context.ts` gets an optional `choices`, and `outcome.ts` gets the `stoodChosen` field. `written-step.ts` and the other statements say `chosen: undefined`.
- Test: `node-run/standing-choices/tests/standing-choices.test.ts`, through the real runtime with a stub gateway on a synthetic garden shop page:
  - the add pressed with the chooser closed states the option;
  - an option un-chosen since stops standing, and the newly chosen one stands;
  - nothing is said on another page, or from a text line that only mentions the option;
  - a look states nothing.

**Core, the credit.**
- `flow-authoring/draft/step.ts`: the new step field `chosen?: { key, words }[]`.
- `runtime/llm/evidence-loop/tool-execution.ts`, `evidence-loop-decision.ts` and `evidence-loop/call-record.ts`: the statement learns the key `chosen`, read strictly. It is carried only on a mutating statement, holds at most 16 entries, needs code keys, and keeps words only when the call's own evidence shows them. Bad entries are withheld, never refused. The value is carried onto the appended step.
- New `runtime/llm/draft-statement/` (`chosen.ts`, and `changed.ts` moved out of `evidence-loop-decision.ts`). That file had grown past the 800-line limit (825) with the new reader; the word-screened statement readers now live together, and the file is 780 lines. Test: `draft-statement/tests/chosen.test.ts` (parse, withholding, bounds, carried onto the appended step).
- New `flow-authoring/bootstrap/instructed-acts/standing-option.ts`, wired into `standing.ts`: a **variant** choice that no named step makes is done by its act's own done step when that step's `chosen` holds a control whose words carry the choice's value, folded as `choice-evidence.ts` folds. It is never read from the step's words, from page text, or from the model's reply, and never for a quantity. A step named for the choice still wins.
- Test: `instructed-acts/tests/standing-option.test.ts` (8 cases, synthetic).
- `checklist.ts`: such a choice shows `done: <act step>`, `stoodChosen` (the words), and `stoodChosenSaid`, which is information and never a todo. The completion check (`check.ts`) shares `standing.ts`, so it agrees.

**What the saved Flow does on a page where the option is not the default.** No step of such a Flow chooses the option. A run whose page arrives with another option chosen does the act without it, and nothing refuses. That is stated:
- in `standing-option.ts`'s header,
- in the docs,
- to the model and the judge, beside the choice: `stoodChosenSaid` ends with "To make the Flow choose it however the page arrives, add a step that sets "<words>" chosen, which changes nothing where it already is, and name <id> on it."

The domain's `web.dom.check` already presses only when the state differs. A model that adds that step gets the option's own step, and the named step then wins over the standing credit. I did not build a refusing check (see Open questions).

**Docs.**
- Core `docs/architecture/automation-studio/llm-flow-bootstrap.md`: a paragraph in the acts checklist section.
- Downstream `docs/architecture/build-loop.md`: a new section, "What Stood Chosen".

## Commands run and observed results

All Core commands ran in `fxwork/t1023/!FluxIQ/packages/fluxiq` and all downstream ones in `fxwork/t1023/!FluxIQWebExtension`, unless the command names a root script.

**The failing test before the fix.** `FLUXIQ_TEST_GROUP=parallel node node_modules/vitest/vitest.mjs run src/runtime/flow-authoring/bootstrap/instructed-acts/tests/standing-option.test.ts`, run before any source change:

```
× ... is done by the act's own step when that step ran with the option standing chosen
× ... answers the choice claimed on the act's own press, which ran with it standing
× ... never answers a quantity: how many is set, not chosen beforehand
AssertionError: expected [ 'a1.quantity', 'a1.fulfilment' ] to deeply equal [ 'a1.quantity' ]
Tests  3 failed | 5 passed (8)
```

The 5 cases that passed are the negative ones, which held before the fix as well. The same file after the fix: `Tests  8 passed (8)`.

**Core checks, all run after every Core edit.**

| Command | Observed result |
| --- | --- |
| `node ../../scripts/vitest-groups.mjs --groups=parallel,real-sql src/runtime/llm/tests/ src/runtime/llm/evidence-loop/ src/runtime/llm/draft-statement/ src/runtime/flow-authoring/draft/ src/runtime/flow-authoring/bootstrap/instructed-acts/` | parallel: `Test Files 106 passed (106)`, `Tests 1633 passed (1633)`. real-sql: `Test Files 1 passed (1)`, `Tests 2 passed (2)`. `[vitest-groups] all groups passed: parallel, real-sql`, exit 0. |
| `pnpm --filter fluxiq check` | exit 0 (`fluxiq:check` ran: "inputs changed: packages/fluxiq"). |
| `node scripts/structure-audit.mjs` (Core root) | `structure-audit: passed (571 warning(s), 903 baselined)`, exit 0. |

The Core structure audit got there in three runs:
1. It first failed on my own two violations: `evidence-loop/tests` held 26 files, and `evidence-loop-decision.ts` was 825 lines. I fixed both by moving the reader and its test into `draft-statement/`.
2. It then failed on a barrel import in the moved test, which I removed.
3. One run crashed with ENOENT on vitest's temporary config file, because I had run it at the same time as vitest. The final run was made alone.

**Core libraries rebuilt for the domain.** `node scripts/build-cache/cli.mjs contracts:build sdk:build fluxiq:build client-gateway-websocket:build ui-components:build` (Core root): exit 0. fluxiq and ui-components rebuilt; the others matched their stamp.

**Downstream checks.**

| Command | Observed result |
| --- | --- |
| `pnpm --filter @fluxiq-web-extension/domain check` | exit 0. `core-build: FluxIQ Core's build ... is current with its source`. |
| `DOMAIN_TEST_BUILD_LABEL=t1023 node scripts/test-domain.mjs standing-choices` (in `domain`) | `# tests 4`, `# pass 4`, `# fail 0`. |
| `DOMAIN_TEST_BUILD_LABEL=t1023 node scripts/test-domain.mjs runtime/llm-evidence` (in `domain`) | `# tests 1762`, `# pass 1762`, `# fail 0`. |
| `node scripts/structure-audit.mjs` | `structure-audit: passed (259 warning(s), 551 baselined)`, exit 0. |

The domain check got there in three runs:
1. The first attempt was refused because Core's ui-components build was stale; I rebuilt it.
2. The next failed with TS2353, because `chosen` was missing from the domain's own statement type in `capture.ts`; I added it.
3. It then passed. A comment-only trim of `capture.ts` followed, made for the structure audit, and the check was rerun after it: exit 0.

The structure audit first flagged `run.ts` at 803 lines and `capture.ts` at 812. I trimmed my own comments to 799 lines each.

**Offline proof on the recording.** The scratch script is uncommitted, at `C:/Users/osrs_/AppData/Local/Temp/claude/bc302d3e1bd85154/b9e846ce-920f-4917-ba85-cff713b3e423/scratchpad/t1023-proof/proof.mts`, bundled with Core's esbuild. Its output is quoted under Cause.

## Not verified

- No live, browser or Lab run (the brief forbids them). The domain memory is covered by runtime tests with a stub gateway. The extension's own `marked` computation for a control inside a closed shadow-root flyout was not involved: the memory relies on the earlier look that showed it.
- The recording proof re-implements the domain rule over the recorded view text rather than running the domain code. The domain code itself is tested on synthetic pages.
- Whether a stale handle could alias two controls across a page re-render: the memory relies on `stable-handles.ts` keeping one handle per control.
- Answer-first's later attempts that run a saved Flow: the credit applies wherever the checklist reads draft steps that carry `chosen`. A step carried from a saved Flow carries none until it runs again in the build.

## Open questions or contradictions found

- **Replay honesty.** The brief allows "the option's own step, or a check that refuses honestly". I delivered the information path (the checklist says the Flow has no step for the option and what step would fix that) and did not make either mandatory.
  - A refusing check needs the saved Flow's playback to check, before the act, that the option still stands chosen. That means a precondition on the written node, honoured by the domain's playback, and a hidden control's state read at playback: content-script work plus answer-first Flow-run work, which are outside my owned paths.
  - Recommendation: a follow-up task that writes, onto the act step's Flow node, the standing option's identity as a precondition the domain checks at playback, refusing with "the page has <words> not chosen".
- **Scope note.** The cause lay in `flow-authoring/bootstrap/instructed-acts/` and `flow-authoring/draft/step.ts`, not only in `runtime/llm/**`. I read the brief's "the act record" and "what the cause needs" as covering them. No must-not-touch path was edited.
- The memory persists short control words (already shown to the model) in Core's build-state store, as `shown-addresses` persists addresses. If that store must hold no page words, the memory can hold the words in-process only.
