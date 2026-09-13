# p-declared-secrets — auth-gate declares the replay secret

## Outcome

Done, for the half a worker without the Lab can finish and prove. `auth-gate`
now declares its password step as a replay secret, so the declared-secrets
machinery is exercised by a scenario instead of by its own unit test alone. A
test proves the value the Flow run receives is the declared one and that the
value the recording script holds for that step reaches the run by no path.

What this does **not** establish is that W18 replays. Supplying the value to
the run is the harness's half; the Flow's `web.dom.type` node still takes its
`text` from what the recording captured, and nothing rewrites it to read the
run input. That is a Core/domain question, unowned by this brief, and it is
written up under *Open questions* below. Whether W18 now replays is a Lab
question, and I could not run the Lab.

## What changed and why

### 1. The declaration (`apps/scenario-lab/src/scenarios/auth-gate/manifest.ts`)

```ts
secrets: [{ id: "auth-gate-password", step: "enter-password" }],
```

placed after `variants`, with a comment stating where the value comes from
(`FLUXIQ_TEST_SECRET_AUTH_GATE_PASSWORD`), what the variable must carry (the
credential this loopback fixture accepts, which the sign-in page states in
plain sight), and that an unset variable fails the run closed rather than
falling back to the recording. No credential value appears in the comment.

The secret id is **`auth-gate-password`**, not the `sign-in-password` the old
unit test used as an illustration. The environment namespace
`FLUXIQ_TEST_SECRET_<ID>` is flat across every scenario, so a generic id
invites two fixtures to read one variable silently; a scenario-scoped id
cannot. The unit test was updated to the real declaration rather than kept as
a parallel fiction.

Nothing else about the scenario changed. The recording script keeps its
literal step value, because the recording lane must still sign in to produce a
recording at all; the declaration governs the Flow lane only.

### 2. A fail-closed guard on a declaration that names nothing (`flow-lane/declared-secrets.ts`)

`resolveDeclaredSecrets` now takes the scenario's recording scripts as well as
its declarations (new exported type `SecretDeclaringScenario`, satisfied by any
`WebScenario`), and throws `fixture.invalid` when a declaration's `step` names
no step in the primary script or in any further workflow's.

This is the same defect class the brief names: without it, a renamed or
mistyped step leaves a declaration that resolves an input nobody reads while
the step it was meant to stand in for keeps replaying whatever the recording
holds — inert wiring that passes every check. Contract-level validation
(`packages/test-contracts/src/validation.ts:201`) checks a secret's shape but
cannot see the script, and I do not own that package, so the check lives at the
single point where a declaration is resolved and cannot be bypassed.

A scenario that declares no secret returns `[]` before the guard runs, so its
behaviour is byte-for-byte what it was.

### 3. A stale claim corrected in the same file

The module doc said the recorder "captures a typed password verbatim today
(`describe-element.ts`; Phase 1.4 redacts it at the source)". That is no longer
true: `readElementValue` in `apps/extension/src/content/describe-element.ts`
returns nothing for a sensitive control, by the single rule in
`domain/src/sensitivity`. The doc now says the recording of a typed password
holds no password, which is both the current truth and a stronger argument for
the declaration.

### 4. Tests

- `packages/test-runner/src/flow-lane/tests/run-flow-lane.test.ts` (new). Loads
  the **real** auth-gate manifest from the built Lab registry, resolves its
  declaration from a synthetic environment, and runs `runFlowLane` against a
  fake Core plus a local HTTP server standing in for `/__control/reset`. It
  asserts the inputs Core is handed carry the declared value under the secret's
  id, for **two different supplied values**, so the input is shown to follow the
  declaration rather than any constant; and that no input carries the value the
  manifest's `enter-password` step records. The supplied values are sentinels,
  deliberately not the credential the fixture accepts — which is what makes the
  assertion decisive: a run that quietly used the recorded value could not pass
  it, whereas "the Flow signed in" would pass either way. Two further tests
  cover failing closed with the variable unset (the failure names the variable,
  never a value) and a scenario with no declaration sending exactly the inputs
  it always did.
  (The fake also answers `list-recordings`, because the lane now waits for Core
  to finish writing the recording before reading it — see open question 5.)
- `flow-lane/tests/declared-secrets.test.ts` rewritten around the real
  declaration, plus a case for the new guard, including a step contributed by a
  further workflow rather than the primary script.
- `auth-gate/tests/scenario.test.ts` asserts the manifest declares the secret,
  that the declared step exists exactly once, that it is the step typing into
  the password control, and that its recorded value is the credential the
  fixture accepts.

No credential value is written into any test, test name, comment, or this
report: the tests read the recorded value out of the manifest and assert only
booleans about it. The literal still occurs in exactly one place in the
repository, `auth-gate/constants.ts`, as before.

### 5. Mutation checks — the tests have teeth

A passing test proves nothing until it is shown to fail. Two mutations, each
reverted immediately:

- Removed `...declaredSecretFlowInputs(input.secrets)` from `run-flow-lane.ts:79`,
  rebuilt, ran the new test file: `test exit=1`,
  `not ok 1 - auth-gate's Flow run is given the declared secret…` failing on
  "the Flow run carries the declared value under the secret's id".
- Removed the `secrets` line from the manifest, rebuilt the Lab, ran the same
  file: `test exit=1`, tests 1 and 2 both fail; the no-declaration test still
  passes, as it must.

Both files were restored from copies taken before the edit and re-verified
(`git diff` shows `run-flow-lane.ts` unchanged; the manifest carries only the
declaration).

## Commands run and observed results

Exit statuses captured by redirect (`cmd > file 2>&1; echo $?`), never a pipe.
`EXTENSION_TEST_BUILD_LABEL=p-declared-secrets` was set for every run.

| Command | Exit | Observed |
| --- | --- | --- |
| `pnpm --filter @fluxiq-web-extension/scenario-lab check` | 0 | tsc clean |
| `pnpm --filter @fluxiq-web-extension/scenario-lab test` | 0 | `# tests 147`, `# pass 147`, `# fail 0`; includes `ok 8 - the manifest declares the password step as a replay secret rather than relying on the recording` |
| `pnpm --filter @fluxiq-web-extension/test-runner check` | 0 | tsc clean |
| `pnpm --filter @fluxiq-web-extension/test-runner test` | 0 | `# tests 431`, `# pass 431`, `# fail 0` (before the concurrent change described below) |
| `pnpm --filter @fluxiq-web-extension/test-runner test` (final, twice) | 1 | `# tests 435`, `# pass 434`, `# fail 1` — the single failure is `not ok 44 - the count must repeat before the recording is accepted…` in `dist/flow-lane/tests/finalized-recording.test.js`, another worker's in-flight test, not mine. My four tests pass in both runs; the corpus quote below is from the same run |
| `node scripts/structure-audit.mjs` | 0 | `structure-audit: passed (31 warning(s), 19 baselined)` — no new violation; the audit also reports `1 baseline entries can be lowered`, which is another worker's improvement and not mine to record |

Corpus, quoted from the test-runner run:

```
# unresolved results: none
# runnable: 43 (23 recording, 20 flow); skipped: 0
```

The new tests in that run:

```
ok 37 - a declaration that names no recorded step fails the run instead of resolving to nothing
ok 68 - auth-gate's Flow run is given the declared secret, never the value its recording script holds
ok 69 - with the variable unset, auth-gate's Flow run fails closed and no recorded value is substituted
ok 70 - a scenario that declares no secret sends the inputs it always did
```

Two failures during the work were **not mine**, and both are worth recording
because either could have been misattributed:

- `test-runner check` began failing mid-session with
  `src/run-evaluation/tests/single-run-evaluation.test.ts(88,63): error TS2379`.
  That directory is untracked and was created by a concurrent worker three
  minutes after my last edit; it was clean again by the final run. I reran
  rather than assumed (the machine's RAM is known faulty) and the second run
  reproduced it identically, so it was a real error in someone else's in-flight
  file rather than a memory fault.
- The final suite is red on `flow-lane/tests/finalized-recording.test.js`
  (`3 !== 5`), which arrived with the concurrent `awaitFinalizedRecording`
  change described in the open questions. Reproduced identically on a second
  run, and the suite's own test count changed between my two runs (436 then
  435), so that worker is still editing. Nothing of mine touches it.

## Not verified

- **The Lab.** No `pnpm lab` command was run, per the brief. Nothing here has
  been exercised against a browser, a real recording, or a real Core.
- **Whether W18 replays.** Unanswered, and not answerable from this seat. The
  declaration makes the value available to the run; see the first open question
  for why that is probably not sufficient on its own.
- **The scenario-lab e2e suite** (`pnpm --filter …/scenario-lab test:e2e`) was
  not run. The change adds a manifest field and touches no page, state, or
  route code, so the fixture's rendered behaviour is unchanged; I judged the
  Playwright run's contention with concurrent workers not worth the near-zero
  information. Someone should say that out loud rather than assume it.
- **`pnpm check` / `pnpm test` at the root** were not run: they include other
  workers' in-flight packages and `pnpm lab:test`. I ran the two packages the
  brief names plus the structure audit.
- **The fake Core in the new test is a fake.** It answers the five endpoints
  the lane calls with the minimum each reads. It proves what the lane *sends*;
  it cannot prove what Core does with it.

## Open questions or contradictions found

1. **Supplying the input does not bind it to the node that needs it — this is
   the remaining half of W18, and it is not in this repository's harness.**
   A recorded text entry becomes a node whose `text` parameter is filled from
   the recorded value: `domain/src/output-nodes/payloads.ts:45`,
   `text: stringValue(payload.inputValue) ?? ""`. For a password the recorder
   captures no value at all, so `text` is `""`. `web.dom.type`'s schema requires
   only `selector` (`domain/src/actions/schemas.ts:239`), so
   `hasExecutableParameters` (`domain/src/io/input-model.ts:168`) still accepts
   it — the node exists and will type an empty string. The declared secret
   arrives as a **run input keyed by the secret id**, and nothing rewrites that
   node's `text` to reference it. Closing this needs the recording→Flow mapping
   to emit an input reference wherever a sensitive value was withheld, which is
   a domain/Core change; the Flow lane must not patch an approved Flow, which
   `recording-flow-proposal.ts` is explicit about. I did not attempt it: it is
   outside the brief's ownership and would have been a second path.
2. **A Flow-lane run of auth-gate now requires an environment variable that no
   document mentions.** `FLUXIQ_TEST_SECRET_AUTH_GATE_PASSWORD` is absent from
   `.env.example` and from `docs/architecture/testing-facility.md`'s environment
   table. Unset, the run fails closed with `environment.missing` naming the
   variable — correct behaviour, and the message is actionable, but the operator
   has nowhere to look it up. In the week1 corpus the affected result is **W19**
   (`auth-gate/primary/expired`, the only auth-gate result on the Flow lane);
   W18 runs unarmed on the recording lane, which resolves no secrets. Both
   files are outside my owned paths, so I changed neither. This is a one-line
   addition to each and should not wait.
3. **A related risk for W19's verdict.** If the Flow's password node types an
   empty string (open question 1), sign-in is rejected and the run may end in a
   state that is *not* the armed session-expiry the variant asserts. W19 would
   then fail rather than pass for the wrong reason — the fixture's final-state
   oracle distinguishes "back on the sign-in page with the expiry notice" from
   "back on the sign-in page having been rejected". Worth confirming in the Lab
   rather than reasoning about; I could not.
4. **The contract cannot see what it validates.** `validateSecret`
   (`packages/test-contracts/src/validation.ts:201`) checks a secret's id and
   step shape but never that the step exists, even though the whole record is in
   hand at `validateWebScenario`. I enforced it at resolve time because I do not
   own that package, which means a bad manifest is caught at run time rather
   than at construction. A cross-check in `validateWebScenario` would catch it
   in `pnpm check` for every scenario at once, and would make my guard the
   redundant second line it should be.
5. **Another worker is editing `packages/test-runner/src/flow-lane/**`, which
   this brief gave me exclusive ownership of.** While I worked, `run-flow-lane.ts`,
   `index.ts` and `recording-flow-proposal.ts` were modified and
   `finalized-recording.ts` was added by someone else (a wait for Core to finish
   writing the recording, citing `L-dropped-action`). Their change is good and I
   did not touch it, but it broke my new test — `runFlowLane` now polls
   `list-recordings` first, which my fake Core did not answer — and I had to
   teach the fake that endpoint. Two briefs partitioned onto one directory is
   the partitioning rule being violated; had we both been editing the same file
   rather than neighbouring ones, one of us would have silently lost work. I did
   in fact restore `run-flow-lane.ts` from a copy during a mutation check; I
   verified against `git diff` that their edits landed after that restore, so
   nothing of theirs was lost — but only by luck of timing.
6. **The plan entry's own text is now settled and should be marked.** The
   `[OPEN — description corrected 2026-09-12]` entry "Credentials at replay"
   says "what is left is one manifest edit plus the environment variable, not a
   design decision". The manifest edit is done; the environment variable is
   documented nowhere (open question 2); and the entry is silent on the node
   binding (open question 1), which is neither a manifest edit nor a variable.
   Whoever closes the entry should split it rather than tick it.
