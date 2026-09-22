# w2x-recording-fidelity (plan step P10, task t063): worker report

Worktree `F:\fxwork\t063-recording-fidelity` (branch `task/t063-recording-fidelity`), downstream `c41f944` on the shared read-only Core `71e2798`. All changes are uncommitted. Every Lab run used `FLUXIQ_TEST_ENV_FILES=none`, `FLUXIQ_LAB_INSTANCE=t063`, `npm_config_workspace_concurrency=1`, `--target persistent-isolated`, a fresh `--workspace` each time, and `--flow`. `FLUXIQ_LAB_ALLOW_BEHIND_CORE` was never set. Runs were sequential. No provider was called: every run reports `llm.calls` = 0.

## Outcome

**Partial.** The code work is complete. The two lane E defects and the supervisor's added lane D defect are fixed at their cause, and each fix is proven live at the node that failed:

- **company-website:** the primary Flow replays 24 of 24 nodes and passes its oracle with 0 provider calls. This held twice: once on the fix and once on the final code.
- **basic-form:** still records and replays, 4 of 4 nodes, oracle passed.
- **local-classifieds and job-board:** node 1, which failed before the fix, now passes on both. Both Flows then stop at node 3 on a **timed overlay** that the scripted recording beat and the slower replay does not:
  - local-classifieds: the "Turn on notifications?" prompt;
  - job-board: the Rolefinch assistant panel.

  In both cases the extension refuses the covered target with a closed code rather than guessing. Timed overlays are outside this brief, which excludes blocked-action classification (P9). Their oracles therefore still fail.
- **Live runs lost to load:** three local-classifieds runs and one company-website run on the final code never built a Flow. Core was still appending the recording when the Lab's 90 s limit expired. The machine was at 99 % CPU. The recordings were the same size as passing ones, so this was not an event flood from the change (details below).

## What changed and why

### Defect 1: a recorded target inside a shadow root named nothing on replay

This covers lane E's company-website chat Close, lane D's job-board "Accept all", and also company-website's consent and local-classifieds' radius picker.

**Cause.** `selectorFor` writes a selector within the tree the element sits in. For an element inside an open shadow root, nothing recorded which root that was, so the replay ran the selector against the light document:

- company-website: `div:nth-of-type(2) > div` matched seven unrelated elements, all scoring -0.28, and the replay stopped on `web.target.ambiguous`;
- job-board: the selector matched nothing, and the point fallback landed on the `rf-consent` host, which the veto refused.

**Recorder.**

- **New `apps/extension/src/content/selector/shadow/host-chain.ts`.** It writes `context.shadowHosts`: every open shadow root between the document and the element, outermost first, each named by its host's selector in the host's own tree.
- **`identity/context.ts`** fills it in.
- **`shared/protocol.ts`** declares it on `DomElementContext`.
- **`selector/index.ts`** re-exports it through the barrel, and **`unique-selector.ts`**'s note on shadow trees now points at it.

**Replay.**

- **New `selector/shadow/scope.ts`.** It walks the chain host by host. A step whose selector reaches no open shadow root widens to every open shadow root at that level, and several roots stay several. An empty scope means not found. A target recorded in a shadow root is never looked up in the light document. An unparsable host selector propagates as an error; it is not turned into an empty scope.
- **New `selector/shadow/element-from-point.ts`.** Point lookups descend through open shadow roots.
- **`action-runtime/resolve-target.ts`** runs every strategy inside that scope, and so does scoring:
  - selector, coordinates and visual target;
  - the fingerprint, where `element-finder.ts` `findClosestFingerprint` gained a `root` and evaluates an xpath only against a document;
  - scoring, where `identity/candidates.ts` `collectTargetCandidates` now takes a list of roots, keeps its caps and truncation semantics, and uses one index across all roots.

  A failure names where it looked. Ambiguity is still refused with `web.target.ambiguous`, never broken by document order.

**Domain.**

- **`domain/src/actions/types.ts`** declares `WebAutomationElementContext.shadowHosts`.
- **`output-nodes/targets/targets.ts`** `elementContext` carries it onto the Flow node and the dispatched command. A chain with a blank or non-string entry is dropped whole, never shortened.
- **`recording/proposals/late-target-wait.ts`** no longer proposes a document-wide wait for a click recorded inside a shadow root. The wait would look for a selector written inside a shadow tree in the light document.

**A third gap in the same family, found live on local-classifieds.** The radius `<select>` inside `<kf-location>`'s shadow root was recorded as a key press aimed at the `kf-location` host, and the selection itself was not recorded at all. There were two causes:

- `keydown` and `input` read `event.target`, which the browser retargets to the host;
- `change` and `submit` are not composed, so they never reach a document listener.

**Fix, in `content/dom-events.ts`.**

- `keydown` and `input` now read the element off the composed path (`eventTargetElement`), as the pointer paths already did.
- `change` and `submit` are named functions registered on the document. The new `content/shadow-root-events.ts` also registers them on every open shadow root an interaction enters: `pointerdown`, `keydown`, and a new record-nothing `focusin` listener.

### Defect 2: local-classifieds' cookie click claimed a later search's URL

**Cause.** The search box navigates from a `keydown` handler with `location.href`. That navigation is a `link` commit, and it arrived inside the cookie click's 5 s explanation window. Nothing but another click or a submit ever closed that window, so the navigation recorder attributed the search page to "Allow all cookies" 0.7 s earlier.

**Recorder.**

- **`background/connection/navigation-recorder.ts`**:
  - adds an `action` explainer that explains nothing but ends the window of the click before it;
  - keeps a short, time-ordered per-tab history;
  - judges a navigation by the action in force when it committed, not by the latest one noted. That also stops a click made after the commit, but before the 250 ms debounce, from taking another click's landing.
  - A submit keeps a click only if nothing else was recorded in between.
- **`recorded-event.ts`** gains `endsNavigationExplanation`. It is true for every executable action except a click, a submit, and a scroll or wheel event, which is sent after a debounce and navigates nowhere.
- **`recorded-event-intake.ts`** notes the action.

**Domain.** `click-landing.ts` is unchanged, and that is deliberate. A domain-side guard would have to order steps against a landing by time. Core stamps `action` entries when it appends them, not when they happened. In my baseline recording those stamps lagged the real event by 1.6 s up to 48 s. So only the recorder sees true event order, and the fix belongs there.

### Tests added or updated

**Extension unit tests.**

- `background/connection/tests/navigation-recorder.test.ts`, 3 rows:
  - a later action ends a click's window;
  - a navigation is judged by the action in force when it committed;
  - a submit after a later action keeps no click.
- `recorded-event.test.ts`, 1 row: which actions end a window.
- `recorded-event-intake.test.ts`, 1 row: lane E's sequence of click, then Enter, then a `link` commit sends no landing.
- `shared/tests/present.test.ts`: two literals gain `shadowHosts: undefined`. This file is the completeness guard for `DomElementContext`. Without the key the extension type check fails; with it, the guard keeps working.

**Domain unit tests.**

- `output-nodes/targets/tests/targets.test.ts`, 2 rows: the chain survives into the dispatched target, and a chain with a hole is dropped whole.
- `recording/proposals/tests/late-target-wait.test.ts`, 1 row: no wait for a shadow-scoped click, while the same click in the document still waits.

**New real-browser content spec: `apps/extension/e2e/content/tests/shadow-roots/tests/shadow-root-targets.spec.ts`, 6 rows.** Each row records a real press, sends it through the wire projection, the Flow node payload and the command mapping exactly as they ship, and replays it on a fresh fixture:

1. job-board's Accept all resolves, and the fixture then records `consent: "accepted"`.
2. The same command with the chain stripped fails with `TARGET_NOT_FOUND`. This reproduces lane D.
3. Two identical `rf-consent` widgets give `TARGET_AMBIGUOUS`, and neither is pressed.
4. With the widget gone and a light-document "Accept all" decoy added, the result is `TARGET_NOT_FOUND`.
5. company-website's Close gives `greetingDismissed: true` with `opened: 0`, so it did not open the chat.
6. On local-classifieds, the keyboard radius selection records both the key and the `dom.change` on the `select`, with the `kf-location` chain.

The spec sits in its own feature folder because `content/tests/` was at its 25-file limit.

## Commands run and observed results

### Live runs, provider-free recording lane

Run ids are under `F:\fxwork\t063-recording-fidelity\test-runs\instances\t063\`.

| Run | Code | Scenario | Result |
| --- | --- | --- | --- |
| `run-mubsswiz-154c9e22` | baseline | company-website primary | node 1 `web.target.ambiguous`, oracle failed. **Reproduced lane E.** |
| `run-mubt0n9l-b96a4913` | baseline | local-classifieds primary | node 1 `web.validation.state_mismatch`, expected `/search/`. **Reproduced lane E.** |
| `run-mubt9fys-776a8b63` | fixes 1+2 | company-website primary | **24/24 nodes, oracle passed, 0 calls.** Stored nodes carry `shadowHosts`: Close has `["body > div:nth-of-type(3)"]`, and the consent Accept all has `["[data-testid=\"cookie-consent\"]"]`. |
| `run-mubteg5b-94bc47a7` | fixes 1+2 | local-classifieds primary | node 1 (cookie click) **ok**, node 2 type **ok**, then node 3 Enter fails with `web.intervention.required`: "Turn on notifications?" covers the search box. Pacing and store details follow the table. |
| `run-mubtmgdl-ee4bc112` | final | job-board primary | node 1 Accept all inside `rf-consent` **ok**, where lane D saw `web.target.not_found`. Node 2 **ok**. Node 3 Find jobs fails with `web.action.rejected`: "covered by div.fa-head", the assistant panel, which opens itself 6 s after the page loads. |
| `run-mubtrt75-89be696d` | final | basic-form primary | **4/4, oracle passed, 0 calls.** |
| `run-mubtw6ep-db20bf65` | final | company-website | `recording.persistence`: Core was still appending after 90 s, 63 entries seen and 56 of them arriving during the wait. No Flow was built. |
| `run-mubu3iu2-14e776ed` | final | company-website primary | **24/24, oracle passed, 0 calls.** The recording has 76 entries, the same as before. |
| `run-mubuatos-053e8336`, `run-mubuz9uq-1fad0a43`, `run-mubv4c10-6351255d` | final | local-classifieds | `recording.persistence` in all three: 11, 99 and 40 entries seen, with 8, 86 and 22 arriving during the 90 s wait. No Flow was built. |

**Detail for `run-mubteg5b-94bc47a7` (local-classifieds on fixes 1+2).**

- **Replay pacing.** The nodes start at +0 s, +2.6 s and +3.8 s. The fixture opens the prompt 1.6 to 3.0 s after consent is answered. The script left the page 0.7 s after the cookie click.
- **The stored Flow:**
  - "Allow all cookies" carries **no claim**; before the fix it claimed `/search/`.
  - The only landing claim left is the listing click's own `/item/1063693215348259/`.
  - The `kf-location` Kelford chip and both Apply presses carry the host chain.

**How the oracle was read.** "Oracle" is the Flow lane's own observation: whether the workflow's expected final state held after the Flow ran. For company-website that state is the page on `/quote/received`.

**The persistence failures are load, not the change.**

- `wmic` reported 99 % CPU, and later `wmic` and `tasklist` could not finish within 120 s.
- local-classifieds recordings are 109 to 112 entries with 23 actions. The failed ones were the same recordings, still arriving; 99 of about 110 had been seen when one run gave up.
- Before my listener change, recordings of both sites finished in under 300 ms (`secondWait.entriesAppendedAfterFirstPoll: 0`).

### Focused tests

A scratch runner (`scratchpad\t063\focused-tests.mjs`) bundled only the named files, exactly as each package's own runner does, into `.test-build-scratch/t063-focused`.

- **Extension, 5 files** (`navigation-recorder`, `recorded-event`, `recorded-event-intake`, `element-finder`, `resolve-target`): `# tests 65 # pass 65 # fail 0`.
- **Extension, `shared/tests/present.test.ts`**: `# tests 8 # pass 8 # fail 0`.
- **Domain, 4 files** (`targets`, `late-target-wait`, `click-landing`, `gateway-mapping`): `# tests 61 # pass 61 # fail 0`.
- **`pnpm test:content -- shadow-root-targets`**, in Chromium: the first run had 4 passed and 2 failed. Both failures were my spec expecting the fixture's initial `consent` to be `null`; it is `"pending"`. The refusal assertions before them held. After the fix: **6 passed (15.6s)**.
- **`pnpm test:content -- resolve-target identity-resolution identity-wire-chain identity-ambiguity recorder-trust keyboard select.spec unique-selectors frames`**: **87 passed (1.1m)**.

### Checks

- **`node scripts/structure-audit.mjs`** first reported 2 violations: my spec made the folder 26 files, and `scope.ts` turned a caught selector error into an empty result. Both were fixed; the audit then reported `passed (85 warning(s), 122 baselined)`.
- **`pnpm check`, first run**: exit 1. `apps/extension check` failed on the `present.test.ts` literals (TS2345), and the other packages printed `Done`. After the fix, `node scripts/check-extension.mjs` exited 0.
- **`pnpm check`, second run**: **exit 0**. `structure-audit: passed`, and every package reported `check: Done`: real-site-policy, boundary-audit, test-contracts, test-matrix, domain, test-evidence, agent-orchestrator, scenario-lab, extension and test-runner.

### Lane E's 13 against 12 on bike-search

**This is the site, read faithfully; it is not the recorder, and not an extractor bug.**

- `catalog/feed.ts` deliberately sends one listing twice: the first card of a later batch repeats the last listing of the batch before.
- The scenario's own test pins it on every seed: `listed.length === answer.length + 1`, "one listing is sent twice".
- I evaluated the built fixture at seed 44: 13 listing cards, 12 unique, 2 adverts. The repeat is **"Folding bike, 16in wheels, 6-speed, barely used"** at feed entry 6, which opens the second batch.
- The recording script's `extract-bike-results` reads every card, and `web.dom.extract_list` returns what the page shows. The manifest nevertheless expects `bikeRecords().length`, which is 12 deduplicated. Its own comment admits that "the grammar has no way to leave out a card the feed sent twice, and neither has FluxIQ's list extraction."
- So in the recording lane it is a **manifest defect**. For a created Flow to give the right answer, it is a **capability gap**: the list extraction cannot de-duplicate.

## Not verified

- **A full local-classifieds replay on the final code.** All three attempts were lost to Core's recording append lag under load. What stands in for it:
  - the key and selection fix inside `kf-location` is proven in Chromium by content spec row 6, on the real fixture;
  - the landing fix is proven live by `run-mubteg5b`.

  Recording and replaying the radius selection through Core end to end was not observed live.
- **The later nodes of local-classifieds and job-board**, beyond node 3: the radius select and Apply inside `kf-location`, the listing claim, and job-board's saves. The timed overlays stopped both Flows first.
- **Firefox.** No Firefox build or content config was run. `ShadowRoot.elementFromPoint` and `composedPath` exist there but were not exercised.
- **Full suites.** No full `pnpm test`, full `test:content` or Lab corpus was run, as the brief said. `pnpm build` was not run separately; the Lab built the extension, domain and host bundles on every run.
- **Closed shadow roots and iframes.** A closed root is out of reach by design. An iframe inside a shadow root, and a `dom.submit` from a form inside a shadow root, were not exercised.
- **Widening a positional host selector live.** This covers a host that moved among its siblings. It was exercised only through spec row 4, where the widget is gone.
- **LLM evidence.** Snapshots still exclude shadow content, so a model cannot target these controls. That was not in scope.

## Open questions or contradictions found

1. **Timed overlays at replay (for the supervisor or the dismissible-dialogs and P9 owners).**
   - **What happens.** Replay runs about 1.2 s per node, against the scripted recording's 0.1 to 0.5 s, so a timer-driven overlay that the person beat appears mid-Flow:
     - local-classifieds: the notifications prompt, `notifyDelay` 1.6 to 3.0 s after consent;
     - job-board: the assistant panel, 6 s after load.
   - **What the replay does.** It refuses correctly. The two refusals carry different codes: a modal dialog gives `web.intervention.required`, category `user_intervention_required`, while a covering non-modal panel gives `web.action.rejected`, category `blocked_by_capability_or_policy`.
   - **What is needed.** A Flow cannot pass either site until replay can dismiss an overlay the recording never met. The recorded Flows already contain the dismissal step ("Not now", "No thanks"), but it comes later in the sequence.
2. **The Lab's 90 s recording finalization limit fails healthy runs under load.** 4 of 11 runs here were lost to it. Lane E's baseline recording already showed Core appending entries 48 s after the event.
3. **Documentation, outside my owned paths.** `docs/architecture/extension-client.md` lines 385 to 395 still say a landing is any page navigation "within 5 s after that click". Suggested wording: "…recorded only as the landing of the executable click that caused it, in the same tab, within 5 s after that click, and before any later recorded action other than a scroll: a key press, typed text or a change ends the click's window. A navigation is judged by the action in force when it committed." The shadow host chain (`context.shadowHosts`, and the resolver's scope and refusal rules) is not described in any architecture document. It belongs beside the element-context description.
4. **Brief boundary.** `resolve-target.ts`, `element-finder.ts` and `identity/candidates.ts` are replay resolution rather than recording code. I changed them because a recorded host chain that the resolver ignores fixes nothing, and the brief requires "replay must refuse an ambiguous match with a closed code". I did not touch action-runner classification of blocked actions: `actionability.ts`, `results.ts` and the intervention codes. I also edited `shared/tests/present.test.ts`, which is outside the listed areas; it is the compile-time completeness guard for the context type I changed.
5. **Host selectors are positional when a host has no id or test id.** Examples are `body > div:nth-of-type(3)`, and for `kf-location` a long `body > … > kf-location` path. The scope widens when such a selector misses, and the element's own selector, the veto and the ambiguity rule then decide. A shorter selector for a uniquely named custom element (`kf-location`) would be sturdier. That would be a change to `unique-selector.ts`, which I left for a separate decision.
