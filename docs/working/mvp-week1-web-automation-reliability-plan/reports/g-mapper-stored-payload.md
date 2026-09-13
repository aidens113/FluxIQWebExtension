# g-mapper-stored-payload: the mapper reads a stored domain event where Core puts it (domain)

Worker report for brief `g-mapper-stored-payload` in
[finish-week1.md](../briefs/finish-week1.md) ("Twentieth dispatch"). Worked in
this repository on `dev` at `32b4324`, against FluxIQ Core at `5845f5d` with its
packages built at `187f40d`. Nothing was committed. There was no `pnpm build`,
no Lab command and no Core edit. Every domain command used
`DOMAIN_TEST_BUILD_LABEL=gmsp`.

## Outcome

**Partial. Task 1 was deliberately not shipped, because its premise is wrong.
Tasks 2 to 4 are done.**

- **The premise is wrong.** w19-d1b's open question 1 said a Core-stored domain
  event is read one level too shallow, so three things fail on a real
  recording: D1's claim for a click sent as a domain event, W25's view of a
  page change, and a navigation proposal. **None of the three fails.**
  - Core stores each domain event **twice**, and hands a recording mapper both
    entries:
    1. the `domain_event` entry, whose payload is `{ target?, payload }`;
    2. an `observation` entry. The web recording domain's own
       `observationExtractor` (`domain/src/recording/observations.ts`) appends
       it for every web event (`domain/src/recording/events.ts:69-70`). It has
       the event's type as its `observationType`, and the event's payload one
       level up.
  - Core's `processRecordingDomainEvent` appends it (`model/recording-domain.ts:228-239`).
    Core's proposal step drops only `state_checkpoint` entries and the two
    client-state observations (`runtime/service/recordings/timeline.ts:7-13`),
    so this copy reaches every mapper.
  - The mapper's current, shallow reader reads that copy. So HEAD already
    proposes each of those actions **once and correctly**: a click with its
    claim, a navigation, and no wait across a page change.
- **The brief's fix doubles proposals.** Reading the `domain_event` entry one
  level deeper makes that entry map as well. Every executable event sent as a
  domain event is then proposed twice: two click nodes, two navigate nodes, and
  so on. I built the fix, observed the doubling through Core, and put
  `domain/src/web-panel-host.ts` back byte-identical to HEAD (`git diff --quiet`
  exit 0). The rows below now fail if anyone reapplies it (mutation M1).
- **The rows are rebuilt through Core (task 2).** Every row that fed the mapper
  a hand-built domain event now records through Core's service, IO recorder and
  domain-event call. It maps what Core hands a mapper, and asserts on Core's own
  proposal, including that each executable event is proposed exactly once.

## What changed and why

### `domain/src/web-panel-host.ts`: no net change

This is byte-identical to HEAD (SHA-256 prefix `A365DD6D34D07509`; git blob
`7b9a5e7b…` equals `HEAD:domain/src/web-panel-host.ts`).

The fix I built was the brief's task 1: `recordedEventPayload` reading
`observation.payload.payload.payload` for a `domain_event`, with `storedStep`
removed and `linkedClickEntry` using `recordedStep`. Its post-edit hash was
`35EBBCF49040F746`. Through Core it proposed every executable domain event
twice, so I reverted it. It survives only as mutation M1.

### `domain/src/tests/web-panel-host.test.ts`: new, 225 lines, 5 tests

The name follows the rule `a/b.ts` → `a/tests/b.test.ts`, since the subject is
`web-panel-host.ts`'s mapper.

**How each recording is made.** One helper, `recordThroughCore`, records a list
of sent items through a real `AutomationStudioService`:
- **Storage.** A temp `dataDir` from `mkdtemp`, removed in `finally`.
- **Service.** An `IoRegistry` with every web manifest input, bound to its output
  as the host binds it, and every output. The web recording domain is registered.
- **Routing.** Each recorded event is routed as Core's gateway routes a
  `client.recording_event` (`client-gateway/bridge.ts:390-419`):
  - metadata naming a registered input goes through `AutomationStudioIoRecorder`
    with `createEnvelope`, with the bridge's metadata (`sourceId`,
    `clientGatewayMessageId`, the event's metadata, `eventId`);
  - anything else goes through `appendRecordingDomainEvent` with the bridge's
    fields. The helper asserts that Core accepts it.
- **Evidence.** Goes through the IO recorder on the evidence input, as a
  `client.state_update` does (`bridge.ts:602-615`).
- **Proposals.** The helper then runs `createRecordingFlowProposals` with two
  mappers:
  - `web`, which is `mapWebRecordingObservation`;
  - `none`, which records every call and returns `null`, so its candidates are
    Core's fallback alone.
- **What it returns.** The calls, and both mappers' candidates without their
  generated ids.

**The tests:**
1. **"Core shows a mapper a domain event twice, and the mapper reads it from the
   observation alone."** For a click and its landing:
   - the entry's payload is `{ target, payload }` and `{ payload }`;
   - the extracted observation's payload is the event's own payload;
   - neither entry shows the mapper `sourceId`;
   - the click's own entry maps to `null`, and its observation maps to the click.
2. **"D1: a click sent as a domain event is proposed once, claiming the path it
   landed on."**
   - Core's `web` proposal is exactly
     `[["web.dom.click", <claim on /scenarios/auth-gate/account>], ["web.dom.type", undefined]]`,
     and `none` is `[]`, so Core has no fallback for a domain event.
   - The click's parameters equal the output payload of its own event.
   - A click mapped with no following entries claims nothing.
   - A landing naming the click only by sequence (no event id) gives
     `[["web.dom.click", undefined]]`.
3. **"a typed navigation sent as a domain event is proposed once, and the
   recording's start not at all."** The `web` proposal is exactly
   `[["web.browser.navigate", "https://example.test/next", ["web.user.navigation_requested"]]]`.
4. **"every recorded row sent as a domain event maps to what the live input path
   resolves, and is proposed once."**
   - It covers the 19 recorded rows that used to be a loop in `domain.test.ts`.
     For each, the extracted observation maps to the live input's output, input
     and parameters.
   - Core's `web` proposal lists each executable row's output exactly once, in
     recorded order.
   - A scroll's parameters are `{ x: 0, y: 640 }`, and the wheel maps to `null`.
     These were the `domain.test.ts` scroll pair.
5. **"W25: a page change recorded as a domain event between a DOM addition and
   the click after it stops the wait."** Two recordings, each an opener click
   (an action entry), a mutation (evidence), a landing, and the late click (an
   action entry):
   - with the landing on another document, the mutation maps to `null` and the
     proposal holds no wait;
   - with a fragment-only landing, the mutation maps to the wait, and the
     proposal holds it once.

### `domain/src/tests/domain.test.ts`: 400 to 286 lines

Removed, since each is now recorded through Core in the new file:
- the hand-built `domain_event` navigation pair (recording start → `null`,
  typed → navigate);
- the 19-row recorded loop;
- the four D1 asserts built on `recordedObservation`;
- the scroll and wheel pair.

Every one of them built `payload: { eventType, payload: <event payload> }`. Core
never produces that shape: its `domain_event` entry nests one level deeper, and
its extracted observation carries `observationType`, not `eventType`.

Kept:
- `signInClick` and `signInLanding`, which the D1b rows use;
- the Finding 7 row (an `observation` shaped like the extracted one);
- the W25 rows (Core-shaped already);
- the D1b rows.

The import from `../io/input-model` lost `webAutomationInputIdForRecordedEvent`
and `actionInputDefinitions`. Two comments point to the new file.

### Not edited, although the brief listed them

- **`runtime/expectation/tests/click-landing.test.ts`** and
  **`recording/proposals/tests/late-target-wait.test.ts`**. They contain no row
  that builds a domain event. They feed the two builders an already-unwrapped
  step `{ eventType, timestamp, payload, metadata }`, and that is exactly the
  step the mapper makes from Core's extracted observation. One caveat is under
  open question 3.

## Task 3: what changes, for each behaviour

Under **HEAD** means today's mapper, which this report leaves in place. Under
**the fix** means the brief's task 1 (mutation M1). Each is observed through
Core, by the probe and by the rows.

| Behaviour | Under HEAD (kept) | Under the fix (not shipped) | Row |
| --- | --- | --- | --- |
| A click sent as a domain event (D1) | Proposed once, with the landing claim, read from the extracted observation | Proposed **twice**; the `domain_event` entry also maps to a click with the claim | tests 1 and 2 |
| W25, a landing on another document between an addition and its click | No wait: `namesAnotherDocument` reads the landing's URL from its extracted observation | No wait; unchanged (test 5 passed under M1) | test 5 |
| A typed navigation sent as a domain event | One `web.browser.navigate` | **Two** | tests 3 and 4 |
| A live click, which is Core's `action` entry, with its landing (D1b) | One click with the claim. `storedStep` reads the `domain_event`, and the extracted observation later in `following` carries the same URL. | One click with the claim | the existing D1b rows, and the probe |

## Task 4: which week1 rows record events that reach the mapper as domain events

**How a live event is recorded.** This comes from reading the code, not from a
Lab run.
- **An executable event** carries its input id
  (`apps/extension/src/background/connection/gateway-payloads.ts:59,75-77`).
  Core's gateway sends it through the IO recorder (`bridge.ts:390-402`,
  `bridge.ts:642`), which stores it as an `action` entry
  (`runtime/io-bridge.ts:32-51`). That covers every click, text entry, clear,
  select, check, key press, scroll, and typed navigation.
- **A click's landing** (an explained navigation) is the only
  non-executable event sent as a `client.recording_event`
  (`recorded-event-intake.ts:188-193`). It has no input id, so Core stores it
  as a `domain_event` plus the extracted observation.
- **Everything else** goes only as evidence (`recorded-event-intake.ts:194`,
  `recording-evidence.ts:136-169`). With a DOM snapshot it becomes a
  `client.state_snapshot` observation, which Core's proposal step drops.
  Otherwise it becomes an `input.event` observation.

**Which rows record a landing.** A landing needs a click or submit that commits
a navigation. The manifests show that for:
- **W18 and W19, auth-gate:** `submit-sign-in` lands on `/account`; under
  `expired`, it lands back on the sign-in page.
- **W10, navigation:** the click lands on `/history`; under `broken-link`, on
  the retired path. Its `navigate` step is a typed navigation, so it is an
  action entry.
- **W27, failure-surfaces `blocked-url`:** it ends on the blocked path.
- **W15, multi-tab:** a click opens a tab and the run returns to the list.
  Whether the new tab's load is recorded as explained was not checked.

No other week1 row declares a final path, so whether their clicks record a
landing was not established.

**What each gains or loses from the brief's fix: nothing.**
- A landing is not executable, so its entry and its copy both map to `null`.
- In `following`, the fix would expose the same URL twice. The claim takes the
  last landing that names the click, and W25 stops on any other-document URL,
  so both decide the same way.
- The doubling needs an executable event sent without an input id. The web
  panel host never produces one, because Core falls back to a domain event only
  when the IO registry lacks the input (`bridge.ts:642`).
- So on a live week1 run the fix would change no proposal. It would double
  proposals for any other caller that stores executable events as domain events.

## Commands run and observed results

Every `pnpm` command ran from `domain`. Exit codes were captured with
`$LASTEXITCODE` after redirecting output to scratch files.

1. **Baseline, before any edit.** `pnpm check` gave `check-exit=0`. `pnpm test`
   gave `# tests 375`, `# pass 375`, `# fail 0`, `test-exit=0`, and
   `Web automation domain smoke test passed.`
2. **With the brief's fix and my first version of the new file.** `pnpm check`
   gave `check-exit=0`. `pnpm test` gave `test-exit=1`, `# tests 380`,
   `# pass 378`, `# fail 2`:
   - `not ok 377 - D1: …` failed at "Core keeps the claim on the proposal's
     click". The actual list held `web.dom.click` with the claim twice.
   - `not ok 378 - a typed navigation …` failed at "Core accepts it as the
     proposal's one candidate". The actual list held
     `['web.browser.navigate', 'https://example.test/next']` twice.
3. **Probe**, scratch `gmsp-probe.ts`, bundled by `gmsp-bundle.mjs` into
   `domain/.test-build-scratch/gmsp-probe/` (removed afterwards). Synthetic
   values, temp data directories. Run with the fix, exit 0:
   - A click and its landing, both sent as domain events. The timeline Core
     showed the mapper was:
     - `domain_event:web.element.clicked:payload.payload keys=[target,payload]`
     - `state_delta`
     - `observation:web.element.clicked:payload.payload keys=[url,title,sequence,browserFrameId,element,visualTarget]`
     - `domain_event:web.page.navigated:payload.payload keys=[payload]`
     - `state_delta`
     - `observation:web.page.navigated:payload.payload keys=[url,title,sequence]`

     The `web` candidates were `web.dom.click+claim` twice, and `none` was
     `[]`. Core's issue text: "It saw 6 proposal entries from 8 raw entries
     (domain_event: 2, observation: 2, state_checkpoint: 2, state_delta: 2)".
   - A typed navigation: `web` held `web.browser.navigate` twice.
   - W25 across another document: `web` held `web.dom.click+claim` and
     `web.dom.click`, with no wait. `none` held two clicks.
   - D1b, a live click with its landing: `web` held one `web.dom.click+claim`.
4. **The same probe with HEAD's host swapped in** (`A365DD6D34D07509`), exit 0,
   restored to `35EBBCF49040F746` afterwards:
   - D1: `web` held one `web.dom.click+claim`;
   - the typed navigation: one `web.browser.navigate`;
   - W25: `web.dom.click+claim` and `web.dom.click`, with no wait;
   - D1b: one `web.dom.click+claim`.
5. **Revert.** HEAD's bytes were saved with `git show HEAD:… >` in Bash.
   `git hash-object` gave `7b9a5e7baf605847d39b377d1bbf0e79a1201f96`, equal to
   `git rev-parse HEAD:domain/src/web-panel-host.ts`. The copy went back over
   the host: hash `A365DD6D34D07509`, and `git diff --quiet` exited 0.
6. **Final gates, run one at a time.**
   - `pnpm check` gave `check-exit=0`.
   - `pnpm test` gave `test-exit=0`, `# tests 380`, `# pass 380`, `# fail 0`,
     and the smoke line. The new tests are `ok 376` to `ok 380`.
   - Line counts: `web-panel-host.ts` 204 (HEAD), `domain.test.ts` 286,
     `web-panel-host.test.ts` 225.
   - Hashes: `domain.test.ts` `87BA9E2AB17CCE6D`, `web-panel-host.test.ts`
     `D689C8A0603C1670`.
7. **Mutation proofs.** Only the host was mutated. Each was restored by copying
   HEAD's bytes back, checked by hash, and finally by `git diff --quiet` exit 0.

   | # | Mutation | Result | Failing rows, with the first message |
   | --- | --- | --- | --- |
   | M1 | The brief's fix: deep `domain_event` read, `storedStep` folded (`35EBBCF49040F746`) | exit 1, `# fail 4`, `# pass 376` | `not ok 376`, "the click's own entry proposes nothing" (actual: a click candidate with the claim); `not ok 377`, "one candidate for each executable event" (an extra `web.dom.click`); `not ok 378` (an extra `web.browser.navigate`); `not ok 379`, "Core's proposal holds each executable row once, in recorded order" (`web.browser.navigate`, `web.dom.click`, `web.dom.type`, `web.dom.clear`, `web.dom.select` … each twice). Test 5 passed. |
   | M2 | Observations no longer read one level deep: `observation.type === "domain_event" \|\| observation.type === "observation"` became `observation.type === "domain_event"` (`7BE67ACD2C41CBAF`) | exit 1, `# fail 5`, and `Domain test entry failed to load: src/tests/domain.test.ts` (`AssertionError [ERR_ASSERTION]: Expected values to be strictly equal`) | `not ok 376`, "its observation proposes the click"; `not ok 377`, "one candidate for each executable event…"; `not ok 378`; `not ok 379`, "browser.navigation (row 3): proposal and live output agree"; `not ok 380`, "a landing on the same document, a fragment apart, keeps the wait" |

8. **Structure audit.** `node scripts/structure-audit.mjs`, run from the
   repository root with `GIT_INDEX_FILE` set to a scratch copy of the index in
   which only the new test file was added.
   `git ls-files` there listed `domain/src/tests/web-panel-host.test.ts`. The
   audit printed `structure-audit: passed (39 warning(s), 17 baselined).`, and
   `audit-exit=0`. No line names any of my files.
9. **Hygiene.** No `recordings/` or `indexes/` exist at the repository root or
   in `domain/`. `git status --short` lists `M domain/src/tests/domain.test.ts`
   and `?? domain/src/tests/web-panel-host.test.ts`, and nothing else of mine.

No failure looked like the RAM fault. Every red run carried real assertion diffs
that matched the probe. The probe's figures are single runs, but the M1
doubling reproduced in steps 2 and 7.

## Not verified

- **No Lab run, `pnpm build`, root gates, content harness or live browser.**
  With the host unchanged, nothing new reaches a live proposal. The only
  statement a Lab run can check: in any week1 recording proposal, each recorded
  action appears once, and W19 auth-gate's sign-in click keeps the claim
  w19-d1b described.
- **The Core rows mirror the gateway rather than run it.** Routing is copied
  from `bridge.ts:390-419` and `602-615`, and the IO setup from the host. The
  rows do not use `ClientGatewayBridge` or `registerFluxIQHost`.
- **The week1 landing list** rests on the manifests' final-path facts. W15's
  explained transition, and whether any other row's click records a landing,
  were not checked.
- **Timing.** The five new tests took about 230 to 800 ms each under M2 (from
  the test output). A Core storage fault on this machine would show up there as
  an ordinary failure; rerun once, alone.

## Open questions or contradictions found

1. **The brief's decision 1 rests on a wrong premise. A supervisor decision is
   needed.** w19-d1b's open question 1, and the "Current limit" sentence in its
   paragraph for the recording architecture page, say D1, W25 and navigation
   proposals fail on a real recording. They do not; they read the extracted
   observation. Pass this to `g-w19-docs` if that paragraph is being written.
   There are two ways forward:
   - **(a) Keep today's reader.** This is what this report leaves in place, and
     the new rows now guard it.
   - **(b) Read the `domain_event` entry deliberately.** The mapper would then
     have to ignore the extracted copy, or the web recording domain would have
     to stop extracting it. Either changes what other timeline readers see; for
     example, Core's evidence facts read observation payloads
     (`runtime/service/evidence/facts.ts:40`). So it is not a mapper-only
     change.
2. **`storedStep` is redundant through Core, but still needed by the hand-built
   D1b rows.**
   - Through Core, the landing's extracted observation sits in `following` with
     its URL at the level `recordedStep` reads, so `linkedClickEntry` would
     claim without `storedStep`.
   - The direct D1b rows in `domain.test.ts` (`coreLanding`) build the
     `domain_event` without that copy. Removing `storedStep` would fail them
     unless they add it.
   - Its doc comment in `web-panel-host.ts` and the D1b comment in
     `domain.test.ts` both describe only the deeper copy.
   - Left as is; not in this brief after the revert.
3. **The tab fallback in `runtime/expectation/click-landing.ts:77-81` cannot
   fire through Core.**
   - It needs `metadata.sourceId` on a landing, and on a domain-event click.
   - Core keeps a domain event's source only as the entry's own `sourceId`,
     which `recordingEntryPayload` strips. Neither the entry nor its extracted
     observation shows it (test 1). A sequence-only landing claims nothing
     (test 2).
   - The `click-landing.test.ts` rows at lines 105-123 put `sourceId` into
     metadata, which Core never supplies.
   - Restoring the fallback would need Core to show the source, or the extension
     to put the tab in the event's metadata. Both are outside this brief.
4. **Brief ownership.** `click-landing.test.ts` and `late-target-wait.test.ts`
   hold no row that builds a domain event one level shallow, so I did not edit
   them.
5. **Structure baseline.** No entry needs to change.
   - `domain.test.ts` is now 286 lines, well under the 400-line advisory limit.
   - The new file has 225 lines and adds no warning.
