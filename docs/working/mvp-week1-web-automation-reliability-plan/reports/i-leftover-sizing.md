# i-leftover-sizing — the known leftovers, confirmed and sized

Brief: "## i-leftover-sizing — confirm and size the known leftovers for the blocker
ranking (read-only)" in `briefs/finish-week1.md`. Read-only: nothing tracked was
edited, and no test, build or Lab command ran. Core was read at its files on disk,
which hold another worker's uncommitted edits. Where the committed state differs,
this report reads Core `HEAD` (`604d0d3`) through read-only git object commands.

## Outcome

**Done.** All eleven items still hold: items 1 to 6, and the five Core items under
item 7. None is a Week 1 exit-criterion blocker on the evidence read here.
- **Item 4** is Week 1 close-out work, already queued as Phase 1.6b's
  "bring the architecture pages to the finished state".
- **Item 7d** is the only one where a Lab report could change the rank.
- **Item 5** differs between Core's files and Core `HEAD`: the refusal exists
  only in the uncommitted `g-core-start-node` work.

| # | Item | Holds at HEAD? | Whom it hits | Smallest fix (repository) | Rank | Lab needed to decide? |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | A node's timeout overrides an output's `parameters.timeoutMs` | Yes, `domain/src/client/gateway-mapping.ts:175` | An author who sets an output's timeout. No criterion; no Lab row, because no proposal writes one | Domain: take the shorter of the two at `:175`, plus rows in `domain/src/client/tests/gateway-mapping.test.ts` | Later | No |
| 2 | The leak check misses a literal split across freed SQLite pages or old WAL frames | Yes: `sqlite-store-reader/read-sqlite-stores.ts:53-58` reads live cells only; Core sets no `secure_delete` | Criterion 2's leak rows: a false "clean", never a false failure | Core: `pragma secure_delete = ON` at `storage/project/database.ts:113-117`, and a truncating checkpoint before the check | Later | No |
| 3 | A stored event's `url` keeps the full URL, query included | Yes, and wider than the report said: runtime confirmations, content-recorded events and unexplained navigations | An extension user and a Core host: a token in a query string is stored at rest. No criterion, unless a scenario's declared secret rides in a URL | Extension: cut a confirmation's `url` to origin and path at `server-command-channel.ts:221`. Wider cuts need a replay decision | Week 2 entry | No, but check first that no week1 scenario puts a declared secret in a URL |
| 4 | Plan history left on architecture pages | Yes, in 6 pages; 26 marker lines on `web-capabilities.md` alone | Readers of the pages; Phase 1.6b's finished-state item | Docs only, this repository | Week 1 close-out, not a criterion blocker | No |
| 5 | Core: a recording appended beside existing nodes gives a second root, so the run refuses | Refusal only in Core's uncommitted files. At `HEAD` the run still starts at the first node by id | A Core API caller passing `flowId` without `writeMode`. Not the Lab, Core's web panel or the extension | Core: link the old chain's end to candidate 1 in `appendRecordingProposalToFlow`, or refuse the append by name | Later | No |
| 6 | Core: among several edges on one route, the smallest edge id wins | Yes, `runtime/executor/graph-navigation.ts:5-11` with `storage/project/graph-store.ts:190` | A Core host with a hand-edited or adapted graph. Not the Lab: a recorded Flow has one success edge per node | Core: refuse an ambiguous route at run time, mirroring the start-node rule | Later | No |
| 7a | Core: a client's `clientType` and `capabilities` come from its `hello` | Yes, `client-gateway/service/lifecycle.ts:83-90`, `:99` | A Core host: a paired client can claim another client's capabilities and be routed its commands | Core: bind the type to the trusted client and check it on resume | Later | No |
| 7b | Core: nothing honours `failureRoute` | Yes: declared `nodes/policy/action.ts:22-32`, carried `:40`, never read; `graph-run.ts:207` routes by `attempt.route` | Authors choosing "Continue as Success". Already ruled out of Week 1 | Core: read it where a failed dispatch sets the attempt's route, or remove the parameter | Later (already ruled out) | No |
| 7c | Core: approving a proposal as a node definition drops `expectedState` | Yes, `runtime/service.ts:5799-5828` | A Core host approving to a reusable node. The Lab approves to a Flow. Already ruled out of Week 1 | Core: carry `expectedState` in `recordingCandidateParameters` | Later | No |
| 7d | Core: a runtime confirmation that reached no open recording is audited as a lost recorded action | Yes, `programs/automation-studio/client-gateway/bridge.ts:506`, `:515`, `:753` | A Core host reading the audit. A Lab run only if a runtime action is confirmed inside a recording window, which the runner fails as `recording.persistence` | Core: pass the confirmation flag into `noteDiscardedClientMessage` and audit it as a non-executable event | Later, unless a bench report shows it | Yes: any `recording.persistence` failure whose discards are runtime confirmations |
| 7e | Core: a service built without `dataDir` writes `recordings/` and `indexes/` into the working directory | Path construction yes (`runtime/service.ts:712-726`, `runtime/service/paths/project.ts:12`); the write site was not traced | A Core host or test constructing the service bare | Core: file writers become no-ops, or refuse, when no root is set | Later | No, but a passive check after a Lab run would confirm it |

Core paths below are under `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\`
unless they start with `client-gateway/` or `runtime/client-gateway-transport.ts`,
which are under `F:\!FluxIQ\packages\fluxiq\src\`.

## Findings by item

### 1. A node's timeout overrides an output's own timeout

**Still holds.** `gateway-mapping.ts:175` reads
`timeoutMs: numberValue(command.timeoutMs ?? parameters.timeoutMs)`. On the Flow lane
the command's timeout is always present:
- Core's action node defaults `timeoutMs` to 5000 and always sends it
  (`nodes/policy/action.ts:20`, `:40`, `?? 5000`);
- the domain adapter forwards any positive finite value (`domain/src/runtime/adapter.ts:90`);
- the dispatcher sets it on the command (`domain/src/io/gateway-output-dispatcher.ts:22`).

So a Flow run never reads `parameters.timeoutMs`, shorter or longer.

**A related contradiction.** The domain declares a `timeoutMs` parameter with a
10,000 ms default on every selector output and on `wait_for_text`
(`domain/src/output-nodes/definitions.ts:112`, `:135`). That default never takes
effect on a Flow run.

**Whom it hits.** Nobody today:
- no recording proposal writes a parameter timeout. The wait proposal says so
  (`domain/src/recording/proposals/late-target-wait.ts:15-17`), and no other
  non-test file under `domain/src/recording` names one;
- the scenario manifests' `timeoutMs` values are the scenarios' own
  `waitForState` step budgets, not output parameters.

It hits an author who sets an output's timeout by hand, and no exit criterion.

**Smallest fix (domain).**
- **Line 175:** use the smaller of the two positive values. A shorter parameter
  is then honoured. A longer one stays capped at the node's timeout, which Core
  builds its own deadline from (the timeout plus `COMMAND_ANSWER_MARGIN_MS`,
  3,000 ms). Honouring a longer one would let Core give up first, which is the
  W25 `too-slow` failure again.
- **Tests:** `domain/src/client/tests/gateway-mapping.test.ts` has no `timeoutMs`
  row today. Add four: node only, parameter only, a shorter parameter, a longer
  parameter.
- **Optionally:** drop or relabel the 10,000 ms defaults at `definitions.ts:112,135`.

**Rank: later.** Nothing records or authors a parameter timeout today, and the
fix belongs with node-editing work. No Lab observation is needed.

### 2. The leak check misses a literal split across freed pages or old WAL frames

**Still holds.**
- **The cell reader** (`packages/test-runner/src/sqlite-store-reader/read-sqlite-stores.ts:53-58`)
  opens a staged copy, which applies the `-wal`, and runs `SELECT *` on every
  table. It therefore sees only live rows.
- **The byte search** (`packages/test-runner/src/secret-leak-attestation.ts:40-45`)
  is the only thing that reaches freed pages and superseded WAL frames, and it
  finds only a contiguous literal.
- **Core** opens its project database with `journal_mode = WAL` and no
  `secure_delete` (`storage/project/database.ts:113-117`). A grep for
  `secure_delete` across `F:\!FluxIQ\packages` (tests, `node_modules` and `dist`
  excluded) found none. The database manager also uses WAL
  (`F:\!FluxIQ\packages\fluxiq\src\programs\database-manager\storage\sqlite-repository.ts:127`).

**Whom it hits.** Criterion 2's leak rows, as a false "clean", never a false
failure. A miss needs all three of these:
- Core writes the literal at all, which `6621d66`'s withholding at rest now
  prevents (`l-stage2c`: 0 times, SQLite included);
- the row is then deleted or overwritten;
- the value is long enough to spill onto overflow pages, with the literal
  straddling a page boundary.

**Smallest fix (Core).**
- **Zero freed content:** add `pragma secure_delete = ON` beside the other pragmas
  in `storage/project/database.ts:113-117`, and in `sqlite-repository.ts:127`.
- **Clear old log frames:** `secure_delete` alone does not remove older WAL frames
  that still hold the page as it was, so also run a truncating checkpoint before
  the check. `database.ts:166-169` already exposes `checkpoint("truncate")`.
- **Test:** a Core test that writes and deletes a row holding a marker, then
  asserts the database and `-wal` bytes no longer contain it.

A downstream-only alternative, a raw page walker that rebuilds overflow chains
from freelist pages and WAL frames, is larger and still only detects the leak.

**Rank: later.** The path needs a withholding regression plus a particular storage
layout. Record it as a stated limit of criterion 2's leak rows. A Lab run cannot
show it, so none is needed.

### 3. A stored event's `url` keeps the full URL

**Still holds, and wider than `f-capability-confirmations` open question 1 says.**
- **Where the full URL is set:**
  - a runtime confirmation sets `url: result.url ?? this.deps.page.url() ?? ""`
    (`apps/extension/src/background/connection/server-command-channel.ts:221`);
  - so does the `action.result` event beside it (`:199`);
  - every content-recorded event sends `url: location.href`
    (`apps/extension/src/content/recorder.ts:134`);
  - an unexplained navigation is recorded with its full `url`
    (`background/connection/recorded-event-intake.ts:146-149`).
- **Where it is copied as is:** the domain's builder copies `payload.url` onto the
  stored payload unchanged (`domain/src/client/gateway-mapping.ts:84`).
- **Only two paths cut it** to origin and path: an explained landing
  (`recorded-event-intake.ts:131-136`) and a recorded tab switch
  (`docs/architecture/extension-client.md:410`).
- **The pages:** `extension-client.md:574-576` states this for tab events and
  confirmations only. `sensitive-values.md` has no line about URLs; a grep for
  `URL|query` found none.

**Whom it hits.** An extension user and a Core host: a session token, invitation
code or one-time link in a query string or fragment is stored at rest in Core's
recording. It hits no exit criterion unless a week1 scenario's declared secret
rides in a URL. The auth-gate secret is typed into a field. I did not check the
other scenarios.

**Smallest fix (extension).**
- **The fix:** cut a runtime confirmation's `url` to origin and path at
  `server-command-channel.ts:221`, and at `:199` if the action-result event is in
  scope, reusing `background/connection/recordable-page-address.ts:12-20`.
- **Tests:** rows in `background/connection/tests/server-command-channel.test.ts`.
- **Why not cut everywhere:** cutting it for every event in the domain's builder
  (`gateway-mapping.ts:84`) would be one line. It could break replay of a
  navigation whose query picks the page, such as a search, so that is a design
  decision, not the smallest fix.

**Rank: Week 2 entry**, as the URL rule of the sensitive-values policy. No Lab
run is needed, but check first that no week1 scenario carries a declared secret
in a URL.

### 4. Plan history left on architecture pages

**Still holds.** A grep over `docs/architecture` for plan-history markers (`Wave N`,
`Phase 1.N`, `Step N, landed`, `Before Phase`, and the two history phrases) counted
34 lines in six files:
- **`web-capabilities.md`, 26 lines:**
  - the header's history, `:3-13` ("began as the capability matrix…", "after
    Wave 2 of Phase 1.2", "after Wave 3");
  - `:23`;
  - the "Changed by (Phase 1.2)" column: its legend at `:38-45`, its header at
    `:118`, and its "Step N, landed" cells in the rows after it (25 lines match
    `, landed|Step N`);
  - "Before Phase 1.1" at `:173`.
- **`failure-taxonomy.md:105-106`:** the removed `WebAutomationRuntimeError`
  paragraph.
- **`sensitive-values.md:22`, `:30`:** "leaked in Wave 2", "Before Wave 3".
- **`page-evidence.md:24`, `:73`:** "until Wave 3", "before Phase 1.4".
- **`element-identity.md:26`:** "What changed in Week 1 Phase 1.3".
- **`repository-layout.md:95`:** the `.script-build/` "Tracked by mistake until
  2026-09-10" history.

The grep does not search for dated history phrased any other way.

**Whom it hits.** No criterion and no Lab row. Readers of pages that the
repository rules say describe current design only, and Phase 1.6b's "bring the
architecture pages to the finished state".

**Smallest fix (docs, this repository).**
- **The history lines:** rewrite each to present tense.
- **The "Changed by" column:** drop it. Keep what it says is still missing on a
  partial row (`:38-40`), folded into "Why this state".
- **`repository-layout.md:95`:** keep "Never commit it" and its reason, and drop
  the dated narrative.
- **Validation:** the repository's documentation link check. I did not confirm
  its command name.

**Rank: Week 1 close-out** (Phase 1.6b), not a blocker of any exit criterion. No
Lab run is needed.

### 5. Core: a recording appended beside existing nodes gives a second root

**Holds only in Core's uncommitted files.**
- **At `HEAD` `604d0d3`:** `runtime/executor/graph-run.ts:150` starts at
  `findStartNode(flow)`, and `start-node.ts` is not in `HEAD`'s tree (`git ls-tree`).
- **In the files on disk:** `graph-run.ts:151-162` refuses with
  `chooseAutomationStudioStartNode`'s message, and `start-node.ts:53-59` returns
  `several_roots` when more than one non-End node has no edge into it.

**The append path.** With a `flowId` and a `writeMode` other than
`replace_recording_derived`, `runtime/service.ts:2514-2517` calls
`appendRecordingProposalToFlow`. That function
(`runtime/service/recordings/proposal-candidates.ts:90-133`) joins the new
candidates only to each other (`:124-131`), never to the old chain. A non-empty
graph therefore gets a second root. At `HEAD` such a run starts at the first node
by id and fails on unvisited nodes. After the start-node commit, it is refused
before any action. That is a clearer failure, not a new one.

**Whom it hits.** Only a Core API caller of `review-recording-flow-proposal`
(`api/contracts/endpoints.ts:96`) that passes `flowId` without `writeMode`:
- **Not the Lab:** the Flow lane approves with `{ kind: "flow", name }` and no
  `flowId` (`packages/test-runner/src/flow-lane/recording-flow-proposal.ts:116`),
  so Core creates a new Flow (`runtime/service.ts:2484-2487`).
- **Not Core's web panel:** it always sends `writeMode: "replace_recording_derived"`
  (`F:\!FluxIQ\apps\web\src\features\automation-studio\recordings\recording-commands.ts:20`).
- **Not the extension:** no `writeMode` in `{packages,domain,apps}/**/src` here.

**Smallest fix (Core).** A product decision:
- **Either link:** in `appendRecordingProposalToFlow`, add a `success` edge from
  the base graph's single non-End terminal node to candidate 1. With several
  terminals, refuse.
- **Or refuse:** refuse appending to a non-empty graph at approval, with a named
  message.
- **Tests:** rows beside the approval tests in `runtime/tests/service.test.ts`
  (`:271-297`).

**Rank: later.** No host in either repository appends today, and the refusal is
honest. No Lab run is needed.

### 6. Core: among several edges on one route, the smallest edge id wins

**Still holds.** It is the same in `HEAD` and on disk; the start-node report says
it was not changed.
- **The chooser:** `chooseAutomationStudioEdge`
  (`runtime/executor/graph-navigation.ts:5-11`) returns the first matching edge in
  `flow.edges` order.
- **The order:**
  - a Flow's edges come back `order by edge_id` (`storage/project/graph-store.ts:190`),
    which is text order, so `…10` sorts before `…2`;
  - a compiled plan orders them by source, port, target, then id
    (`storage/project/compiled-plan-store.ts:132`).
- **No check refuses it:** the only port rule found in Flow validation is
  `flow.edge_incomplete_port_binding` (`model/validation/flow.ts:115-116`).

**Whom it hits.** A Core host whose graph has two edges on one node's route, from
a hand edit or an adaptation. Not the Lab: a recorded Flow has one `success` edge
per node (`proposal-candidates.ts:124-131`).

**Smallest fix (Core).**
- **The rule:** make `chooseAutomationStudioEdge` report an ambiguous route, and
  have `graph-run.ts:207`, `:233` refuse by name, as the start-node rule does.
- **Tests:** rows in `runtime/tests/executor.test.ts`.
- **Why not validation:** a save-time error would also work, but it would refuse
  saving existing documents.

**Rank: later.** No Lab run is needed.

### 7a. Core: `clientType` and `capabilities` come from the `hello`

**Still holds.**
- **Copied before trust:** `client-gateway/service/lifecycle.ts:83-90` copies both
  onto the session before pairing or token resume.
- **Resume checks only the token and `clientId`** (`:99`).
- **Replaced after pairing:** once `ready`, a `client.capabilities` message replaces
  them (`client-gateway/service/inbound.ts:56-62`).
- **Commands are routed by them:** `runtime/client-gateway-transport.ts:182-183`
  and `runtime/service.ts:328-329`, both under `packages/fluxiq/src`.

**Whom it hits.** A Core host: a client an operator paired can claim another
client type's capabilities and be routed that client's commands. Pairing still
needs operator approval, and the Lab uses one extension client.

**Smallest fix (Core).**
- **Bind the type:** the trusted client already stores `clientType` at pairing
  (`client-gateway/service/trusted-clients.ts:70-79`). Refuse a resume whose
  `hello` names another type, at `lifecycle.ts:99`.
- **Document capabilities** as declarations, not authorization.
- **Tests:** in `client-gateway/tests/service.test.ts`.

**Rank: later**, as hardening before multi-client or remote hosting. No Lab run
is needed.

### 7b. Core: nothing honours `failureRoute`

**Still holds.**
- **Declared and carried:** declared at `nodes/policy/action.ts:22-32`, carried
  into the dispatch effect at `:40`, and set in `runtime/policy-model.ts:154`.
- **Never read:** a grep of `packages/fluxiq/src` outside tests finds no reader.
- **The executor ignores it:** it routes a failed attempt by
  `attempt.route ?? "failed"` (`runtime/executor/graph-run.ts:207`).

**Whom it hits.** An author who picks "Continue as Success", which is silently
ignored. The downstream Current State already rules it out of Week 1.

**Smallest fix (Core).** Read it where a failed dispatch sets the attempt's route
(that site was not located), or remove the parameter. Add executor rows.

**Rank: later** (already ruled out). No Lab run is needed.

### 7c. Core: approving a proposal as a node definition drops `expectedState`

**Still holds.**
- **The node-definition path drops it:** `recordingCandidateDefinition`
  (`runtime/service.ts:5799-5817`) and `recordingCandidateParameters`
  (`:5819-5828`) carry the payload and confirmation fields, but no `expectedState`.
- **The Flow path keeps it:** `proposal-candidates.ts:106`.

**Whom it hits.** A Core host approving a recording into a reusable node. The Lab
approves into a Flow. Already ruled out of Week 1.

**Smallest fix (Core).**
- Add an `expectedState` object parameter, defaulting to a clone, in
  `recordingCandidateParameters`.
- Confirm it reaches `node.parameterValues.expectedState`, which
  `runtime/executor/expected-transition.ts:8` reads. I did not verify that.
- Add a row in `runtime/tests/service.test.ts`.

**Rank: later**, or Week 2 entry if Week 2 approves recordings as reusable nodes.
No Lab run is needed.

### 7d. Core: a confirmation with no open recording is audited as a lost action

**Still holds.**
- **How Core audits it:** `client-gateway/bridge.ts:506` decides "executable" from
  the input id alone. `:515` types the entry `recording.action_discarded`, and
  `:753` adds "The client believes it was recorded; the recording does not
  contain it."
- **What the extension sends:** after every succeeded runtime action,
  `server-command-channel.ts:215-241` sends a confirmation as a
  `client.recording_event`, with `metadata.runtimeConfirmation: true` (`:235`) and
  an executable input id, whether or not a recording is open. The discard call
  sites (`bridge.ts:403`, `:427`) do not pass that metadata on.

**Whom it hits.**
- **A Core host** reading the audit log sees false alarms.
- **A Lab run** only when a runtime action is confirmed inside a run's recording
  window. The runner fails any discarded executable action in the window as
  `recording.persistence` (`packages/test-runner/src/flow-lane/recording-discards.ts:97-101`,
  `:124`). `g-discard-window` excludes a Flow-lane replay after the recording is
  finalized, and publishes the excluded count (`:78-80`).

**Smallest fix (Core).** Thread the confirmation flag from the client message into
`noteDiscardedClientMessage` (`bridge.ts:502`). Audit a runtime confirmation as a
non-executable `recording.event_discarded`. Add bridge test rows; I did not locate
the bridge's test file.

**Rank: later, unless a bench report shows it.** A Lab observation would decide
it: any `recording.persistence` failure in the week1 bench whose
`recordingDiscards` are runtime confirmations makes it a Week 1 blocker.

### 7e. Core: a service without `dataDir` writes into the working directory

**Path construction still holds.**
- **No root without `dataDir`:** `runtime/service.ts:712-724` sets up storage roots
  only when `dataDir` or `storageRootDir` is given. Otherwise
  `AutomationStudioProjectPaths(undefined)` is built (`:725`).
- **Relative paths:** its `projectDirectory` returns `""`
  (`runtime/service/paths/project.ts:12`). `projectFile` then joins relative paths
  such as `indexes/routers.json` (`:37`) and `recordings/<id>`
  (`runtime/service/paths/recording.ts:12`), which resolve against the process's
  working directory.
- **Intent:** the comment at `project.ts:5-7` calls this an "in-memory service".
  I did not trace the write site itself.

**Whom it hits.** A Core host or test that builds the service without a data
directory. Recording data could land in a checkout.

**Smallest fix (Core).** When no root is set, make the recording and index writers
no-ops or in-memory, or refuse file-backed writes. Add a row in
`runtime/tests/service.test.ts`.

**Rank: later.** No Lab run is needed. A passive check would confirm it: after a
Lab run, look for stray `recordings/` or `indexes/` directories in either checkout.

## What changed and why

Only this report file was written, as the brief's Owns allows. Nothing tracked
changed.

## Commands run and observed results

- Read, Grep and Glob over the cited files, in both repositories.
- In `F:\!FluxIQ`, read-only git object commands only (`--no-optional-locks`, no
  index or working-tree writes):
  - `git log -1 --format='%h %s'` printed
    `604d0d3 Record the bridge ordering and withholding commits, and Core's release-tree gates, in the Week 1 plan`;
  - `git ls-tree --name-only HEAD .../runtime/executor/`, filtered to
    `start-node|graph-run|graph-navigation`, listed `graph-navigation.ts` and
    `graph-run.ts` only;
  - `git show HEAD:.../graph-run.ts | grep -n findStartNode` printed line 150:
    `let currentNode = options.startNodeId ? nodesById.get(options.startNodeId) : findStartNode(flow);`;
  - a loop over `HEAD`'s executor files and a `git grep "function findStartNode" HEAD`
    both printed nothing, so where `HEAD` defines `findStartNode` was not found.
- No tests, builds or Lab commands, as the brief directs.

## Not verified

- **Nothing was executed.** Every finding rests on reading code, not running it.
- **Core findings are read from files that hold another worker's uncommitted
  edits,** except where `HEAD` is quoted. Of the items above, only item 5 differs.
- **Item 1:** whether Core fills an output definition's declared defaults into a
  dispatched `parameters` object.
- **Item 2:** whether Core's UI cache store is SQLite, and its pragmas. How
  `secure_delete` interacts with WAL frames comes from SQLite's documented
  behaviour, not an observation.
- **Item 3:**
  - whether the recording mapper reads a confirmation's or a navigation's `url`
    query for replay;
  - whether any week1 scenario puts a declared secret in a URL.
- **Item 5:** where `HEAD` defines `findStartNode`.
- **Item 6:** whether an adaptation reroute can leave two edges on one route.
- **Item 7b:** where a failed dispatch sets the attempt's route.
- **Item 7c:** whether a definition's default reaches `parameterValues`.
- **Item 7d:** whether any Lab path confirms a runtime action inside a recording
  window.
- **Item 7e:** the actual write site.

## Open questions or contradictions found

1. **Item 3 is wider than its source report.** Content-recorded events
   (`recorder.ts:134`) and unexplained navigations (`recorded-event-intake.ts:149`)
   store the full URL too, and `sensitive-values.md` says nothing about URLs.
   Cutting every stored `url` may break replay of a navigation whose query picks
   the page, so the rule needs a decision before a broad fix.
2. **Item 1 has a contradiction beside it.** The domain declares a 10,000 ms
   `timeoutMs` default on selector outputs and `wait_for_text`
   (`definitions.ts:112`, `:135`) that a Flow run never applies, because the
   node's 5,000 ms always wins.
3. **Item 5's wording, "so the run refuses", is true only once
   `g-core-start-node` is committed.** At Core `HEAD` `604d0d3` the run still
   starts at the first node by id.
