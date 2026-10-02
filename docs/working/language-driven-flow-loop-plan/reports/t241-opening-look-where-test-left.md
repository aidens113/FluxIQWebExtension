# t241: a round whose draft holds the Flow opens with a look where the test left the page (run 38 C3 follow-up, C8 first half)

Worker report, 2026-10-02. Tree `fxwork/t241` (Core `!FluxIQ` and downstream `!FluxIQWebExtension`, both on
`task/t241-opening-look-where-test-left`). `R` = Core `packages/fluxiq/src/programs/automation-studio/runtime/`.
Nothing committed. No Lab run, no provider call, no full suite.

## Outcome

**Done.** A round whose draft already holds a kept step now opens with the look on the page as it stands. It never runs
the arrival navigation. The domain's opening look of such a round:

- does not re-arm arrival;
- does not forget the build's shown addresses;
- counts each held Flow navigation's address as shown;
- counts a held navigation as the build's arrival.

A fresh build, or a round with nothing in the Flow, still opens by arriving, and that navigation is still the Flow's
first step. `address_not_shown` is not widened beyond the Flow's own navigation addresses.

**The two sides must merge together.** The current domain refuses Core's new opening look with `invalid_input`, because
`held` is an unexpected key. The domain tests showed this failing-first (`web.action.rejected.invalid_input`).

## What changed and why

### Core: `R/llm/evidence-loop.ts` (the opening only, +1 line, 797 of 800)

- `held` is set when the draft holds a kept step. It is the `input` (as written, the form the model is shown) of each
  kept step that went through the opening tool (`(step.toolId ?? step.actionId) === initialTool.toolId`).
- With `held`, `arrival` is `undefined`, so the loop takes the existing free-look branch, under the same call id
  `initial.<toolId>`. The look is executed with `value: { ...initialInput, held }`.
- The answered-request signature, the call record and the draft record still use the plain `initialInput`. A later
  look by the model with the same input is therefore still recognised as a repeat.
- The arrival branch now always sends `add: true`, because it runs only when nothing is held. This keeps t195's
  explore-again case: `seed: []` with a `resume` still adds the arrival as the Flow's first step.
- Why `input` and not `ranWith`:
  - a seeded re-author step (`R/llm/node-tools/draft-from-flow.ts:130`) has only `input` (`{node, parameters}`);
  - `ranWith` can hold resolved selectors that a domain may withhold from the model.

### Domain: `domain/src/runtime/llm-evidence/node-run/`

- `arrival.ts` has a new export, `webNodeHeldFlow(request)`. It returns `{ look, addresses }` or `undefined`.
  - It reads `held` only on Core's exact opening id, `initial.<request.toolId>`. Core makes that call at iteration 0 and
    renames a model's later call of the same id (`R/llm/evidence-loop/call-id.ts`), so no call the model writes can
    declare held addresses.
  - On any other call id, including `initial.model.1`, `held` stays an unexpected key and the call is refused
    `invalid_input` (tested).
  - Only the `url` of a held call whose node moves the page (`webMovesThePage`) is read. Nothing else a held step
    carries is read.
  - The header explains the exception to "the opening call re-arms its key".
- `run.ts`: the look runs without `held`.
  - For a continuing round, `arrivals.opening` and `addresses.opening` are skipped.
  - Each held navigation address goes to `addresses.held(...)`.
  - When the build has a start location, a held navigation also calls `arrivals.arrive(...)`, the same rule a replayed
    navigation already follows (`run.ts:168-171`).
  - Every Flow step ran after the Flow arrived. A held Flow with no navigation is not counted as arrival (tested).
  - `run.ts` is 792 lines, under the 800 budget. The reading logic lives in `arrival.ts` to stay under it.
- `shown-addresses.ts` has a new method, `held(build, address, base)`. It remembers the address with its query, parsed
  the same way as every other address. The header lists the new "what counts as shown" source and says a continuing
  round forgets nothing.
- `start-location.ts`: unchanged.

### Tests

Core: `R/llm/evidence-loop/tests/resume.test.ts`, the describe "the opening of a round whose draft already holds the
Flow" (replaces t195's "still goes to the start" expectation):

- "looks at the page where the test left it, and never navigates, on a resumed five-step draft". Exactly one tool
  call is made. It is `initial.core.run_node` with the look and `held` = the five inputs. The draft stays five kept
  steps, and the decision is shown the look's evidence.
- "is a look carrying the Flow's own step addresses when a re-author's draft holds the Flow without resuming it".
- "goes to the start as the Flow's first step on a build's first round, as before" (no `held`).
- "is the Flow's first step on a round that seeds a draft without resuming one".
- "is the Flow's first step when a round resumes with nothing in the Flow" (the value is the arrival).
- "carries nothing held on a look of a build told no start, whose draft holds nothing".

Domain: `node-run/tests/arrival.test.ts`:

- a held round looks at the page as it stands, dispatches no navigation, and is arrived when nothing is remembered (a
  press then succeeds);
- a held round does not re-arm the rule a build arrived under;
- a held Flow with no navigation in it is not an arrival;
- a seam test through Core's registry binding (`bound`): the look carrying `held` reaches the domain unchanged, and
  the round is arrived.

Domain: `node-run/tests/shown-addresses.test.ts`:

- run 38 C8, with nothing remembered: the held Flow's own step address (`FLOW_ITEM`, shown by no page) is allowed. An
  address neither the page nor the Flow holds is still refused `address_not_shown`.
- a continuing round forgets nothing its build was shown or searched (the contrast to the existing "a new build of the
  flow forgets" test, which still passes);
- `held` on `call.held` or `initial.model.1` is refused `invalid_input`, and the address stays refused.

## Commands run and observed results

| What | Command | Observed |
| --- | --- | --- |
| Core failing-first | `npx vitest run .../evidence-loop/tests/resume.test.ts` (packages/fluxiq), before the fix | `Tests 2 failed \| 14 passed (16)`; the two held-look cases |
| Core after fix | same | `Tests 16 passed (16)` |
| Core directories touched | `heavy.sh "t241 core llm tests" npx vitest run R/llm R/tests/service-bootstrap R/flow-bootstrap/reachability R/flow-bootstrap/instructed-acts --testTimeout=60000` | `Test Files 155 passed (155)`, `Tests 1488 passed (1488)` |
| Core rounds that use the opening | `heavy.sh ... npx vitest run R/flow-bootstrap R/recovery R/tests/refuted-result --testTimeout=60000` | `Test Files 106 passed (106)`, `Tests 1536 passed (1536)` |
| Core typecheck | `heavy.sh "t241 core check" pnpm --filter fluxiq check` | exit 0 |
| Core libraries | `heavy.sh "t241 core libs" pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build` | exit 0; `fluxiq:build` rebuilt, the other two reused |
| Domain failing-first | scratch runner (esbuild bundle as `scripts/test-domain.mjs` does, into `domain/.test-build-scratch/t241-worker`, since removed) over `arrival.test.ts` and `shown-addresses.test.ts`, before the fix | 5 new tests `not ok`, each `actual: 'web.action.rejected.invalid_input'`; the model-named guard test passed |
| Domain after fix | same | `# tests 26 # pass 26 # fail 0`, then 27/27 with the seam test added |
| Domain revert check | `run.ts` set to HEAD, same two files | `# pass 21 # fail 6` (all six held tests); restored, `# pass 27 # fail 0` |
| Domain directory touched | scratch runner over every `node-run/tests/*.test.ts` and `node-run/*/tests/*.test.ts` (28 files), plus `llm-evidence/tests/reauthor-reruns-own-extraction.test.ts` and `repeat-across-explorations.test.ts` (they use the opening id) | `# tests 166 # pass 166 # fail 0` (before the seam test was added) |
| Domain typecheck | `heavy.sh "t241 domain check" pnpm --filter @fluxiq-web-extension/domain check` | exit 0 (after the Core rebuild) |
| Downstream audit | `node scripts/structure-audit.mjs` | `structure-audit: passed (157 warning(s), 118 baselined).` The only warning on a touched file is the existing 400-line advisory on `run.ts` (792 lines) |
| Core audit | `node scripts/structure-audit.mjs` | `structure-audit: passed (218 warning(s), 349 baselined).` The only warning on a touched file is the existing 400-line advisory on `evidence-loop.ts` (797 lines) |
| Core framework reference | not run | No Core export changed |

## Not verified

- No live run, no browser, no provider call. The effect on a real repair or re-author round is inferred from run 38's
  records:
  - the round starts on the requests page;
  - `~/friends/requests/` is no longer refused.
- Core's loop and the domain runtime were never run together end to end. Core's loop is not a public export, so the
  domain cannot drive it. The seam is covered from both sides:
  - Core's test asserts the exact value it sends;
  - the domain's seam test sends that value through Core's registry binding.
- No full suites. The domain test runner bundled only the files listed above; the unlabelled `pnpm --filter
  @fluxiq-web-extension/domain test` was not run.
- Not exercised: the round in a new process with the tab blank. The held navigation marks arrival, the look is refused
  `not_at_start_location`, and the model navigates. This follows from the code and was not tested.

## Open questions or contradictions found

1. **Cross-repository contract.** Core now sends a `held` key on the opening look of a held round. Any other domain
   binding that declares `runsNodes.initial` and validates its look strictly would refuse that look, as this domain did
   before this change. This domain is the only binding I know of. The contract is named in comments on both sides
   (`evidence-loop.ts` and `arrival.ts`). No contract type was changed, because `R/llm/harness-options/binding.ts` is
   outside this brief. Its `runsNodes.arrival` doc comment ("A build told where its Flow starts then opens by going
   there") is now true only of a build whose draft holds nothing, and should get one sentence.
2. **Pre-existing, not changed.** A model may write a call id that starts with `initial.` (for example
   `initial.model.1`). `webNodeOpensBuild` then treats it as an opening and forgets the build's arrival and addresses.
   This makes the rules stricter, not looser, and I did not touch it.
3. Authored docs: none were edited, because the brief owns none. If `docs/architecture/` describes the
   arrival/opening rule or `address_not_shown`, it needs the held-round exception.
