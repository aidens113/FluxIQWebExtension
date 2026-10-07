# Actual fixture reset provenance (t336)

## Current state

SOURCE AND REPORT FROZEN after approved implementation in fxwork/t336-fixture-reset-provenance (unpaired). Provision34159 exit0/READY was setup only; stable shared Core5eac215b stayed read-only. Actual owning owner/HTTP/child-process30/30 and reset-helper18/18 pass, scenario source/e2e nonincremental checks0, runner nonincremental type/owning emit0, downstream audit0/no baseline growth. Exact final commands/evidence/failures/owner list below. No source outside reviewed owners, corpus/oracle/Core/shared docs/git/browser/panel/provider/userdata or full suite changes. Producer packets remain data and do not establish browser/start/private oracle/causal authority.

## Actual owner findings

- apps/scenario-lab/src/state-store.ts is the sole actual in-process Map/seed owner. Constructor invokes reset. reset clears live map BEFORE creating every scenario state; initializer failure can leave partial state. reseed changes live seed BEFORE reset finishes. Both need prepare-all/commit-once publication to provide truthful successful-generation data.
- ScenarioDefinition.mutate returns state only, with no accepted/rejected operation tag. Many unsupported/invalid operations return same/equal state; returning a snapshot or HTTP200 is not proof that a mutation occurred. Some reducers could mutate their supplied object before throwing; pass a clone and publish only a validated/cloned completed result. No reducer callback can modify owner Map/seed directly.
- server.ts authenticated control GET health/final-state and POST reset/seed call that owner. Existing reset response is status+seed only. API mutation POST validates auth/method but currently returns any scenario snapshot as HTTP200 even for no-op. Route GET may apply reducer mutations through routeScenarioSubpath; HEAD does not. Both must use the same sequencing owner.
- Existing variants use set-mode, set-variant, expire-session and nested workflow variants. Inferring all variants from state.mode or a caller label would be false. Existing manifests/definitions remain the operation source; no scenario corpus/oracle edits.
- reset-scenario-lab.ts checks response.ok/status only and returns void. HTTP200 alone remains unsuitable as a private candidate start proof. Existing recording/Flow callers can continue ignoring an additive validated producer return; no candidate/browser admission activation here.

## Closed producer contract proposal

Keep constructor `new ScenarioStateStore(seed: number)` unchanged. NO epoch/sequence/clock/proof constructor option, setter, importer, restore operation or external marker module. Owner generates one private random UUID at construction; same seed/new instance has different epoch. Epoch is per owner instance; server builds exactly one owner shared by primary/frame listeners. Process restart necessarily allocates a new owner/epoch. UUID does not authenticate caller or browser.

Add closed provenance shape through EXISTING ScenarioSnapshot/type owner, not a second storage library:

```typescript
type Provenance = {
  schemaVersion: "fixture.state.v1";
  ownerEpoch: string;          // generated UUID, never supplied
  resetGeneration: number;    // positive safe integer, constructor=1
  mutationSequence: number;   // nonnegative safe integer, constructor=0
};
type Variant =
  | { status: "baseline" }
  | { status: "armed"; variantId: string; workflowId: string | null; armSequence: number }
  | { status: "unknown" };
// existing snapshot retained, additive fields:
// {scenarioId, seed, state, provenance: Provenance, variant: Variant}
```

Provenance reads return fresh copied/frozen primitive packets; snapshots clone state. All/scenario snapshots from one synchronous read have exact same global provenance. No caller object, accessor, symbol or mutation of returned packets can set owner fields. Identifiers come from actual registered scenario/workflow/variant definitions, never arbitrary input text.

`reset(): Provenance` builds every new state into a PRIVATE temporary Map with existing seed, clones each returned state, validates safe next counters BEFORE publication, then swaps map once, clears every tracked variant to baseline, increments resetGeneration and mutationSequence exactly once. Constructor initializes full map atomically at resetGeneration1/mutationSequence0; it does not expose an earlier empty baseline. `reseed(seed:number): Provenance` validates Number.isSafeInteger (existing signed seed range preserved), stages every scenario under requested seed, then atomically swaps seed/map/counters/variant records. Even reseeding same seed or resetting unchanged baseline increments generation: these are owner reset transitions, not semantic changed-effects. Initializer/copy/counter failure leaves old seed/whole Map/epoch/generation/sequence/variant unchanged; exception emits no success response. No finally counter update. No automatic wrap/expiry/reset of mutationSequence within an epoch. Max-safe overflow refuses BEFORE callback/publication; tests may use deliberate test-only private counter fault instrumentation, not a production setter.

`mutate(id,operation,payload)` keeps current snapshot-or-undefined compatibility. It resolves actual scenario/current state, clones state and payload before reducer call, clones/validates returned state, then deep-compares old/new. Missing scenario => undefined. Throw/invalid returned state/clone failure => throw and unchanged owner. Equal/no-op => unchanged counters/state/variant; no semantic performed/committed claim. Changed state => single Map publication and mutationSequence+1; resetGeneration/seed/epoch unchanged. Existing API may still HTTP200 for no_change for browser compatibility; return an additive producer disposition only on API response: `mutation: {status:"changed"|"no_change"}`. No commandId/createdByFlow/causal field accepted or produced. Sequencing includes actual GET route mutations; HEAD/no mutation route leaves sequence unchanged. Reads/navigation without state effect leave counters unchanged. State changed by one reducer is not a database transaction, lasting user effect or authentic command completion proof.

Variant handling proposal: track baseline after successful owner reset. Changed legacy mutate not known to be an exact registered arm makes current variant unknown (conservative; do not falsely retain armed status after arbitrary state changes). Recognize exact registered manifest/workflow arm operation+payload only after actual reducer changed state; duplicate/ambiguous matching arms => unknown. Named variant arming via new owner `arm({scenarioId,variantId,workflowId?:string})` resolves unique actual registered variant before invoking its existing reducer; it never accepts operation/payload/provenance/proof from caller. Successful changed publication atomically records armed variant and armSequence. Unchanged reducer => no_change/unconfirmed, no successful armed receipt and no invented render state. Invalid/missing workflow/variant/ambiguous definition refuses without mutation. `armed` means the registered arm reducer was actually applied in that owner, not independently verified page rendering or proof it survived subsequent unknown mutation. Future observer must read actual page/state for that latter fact.

Manifest variants can be nested in workflows. Resolve scope explicitly: absent workflowId selects scenario-level variants only; supplied workflowId selects exactly that workflow's variants, never guesses between equal IDs. Follow actual validated manifest owner. Payload undefined is omitted only when registered arm omits it; never invent an empty object or alter corpus semantics. A caller can request an actual supported variant operation, but cannot set producer epoch/generation/armed status directly.

## Authenticated HTTP response/API proposal

Preserve existing health/status/seed/scenarios/final-state/state fields and add producer provenance. Scenario snapshots add provenance+variant. GET final-state all: existing `{seed,scenarios}` plus provenance; each snapshot same exact provenance. GET health: existing ready/seed/scenarios plus provenance. POST reset `{status:"reset",seed,provenance}`; POST seed `{status:"seeded",seed,provenance}`. reset body absent only; refuse nonempty body attempting epoch/generation/seed/extra fields instead of silently ignoring it. seed request EXACT plain JSON `{seed:number}` with safe integer; reject unknown keys/malformed JSON/oversize body. Existing maximum body16KiB retained; epoch UUID, counters safe integers; no arbitrary new seed cap/model/catalog limit.

New authenticated control POST `/__control/arm`: exact `{scenarioId,variantId,workflowId?:string}` (omitted optional only, no null/undefined JSON variants), owner resolver uses definitions. On actual changed arm return `{status:"armed",snapshot}` with snapshot provenance+variant; on no_change return explicit unconfirmed conflict (409, `arm_unconfirmed`), NEVER armed success. Unknown/missing IDs400/404; owner throw500 generic fixture_error. Existing `/api/:scenario/:operation` and route mutation paths preserve response/state semantics while sharing owner sequence. No replacement of existing variant callers yet; existing generic registered arm matching gives informational producer tracking when uniquely recognized.

Auth checked BEFORE all control/API body parsing/owner calls: missing/wrong token401 and zero state/sequence changes. Wrong method405 or existing404 compatibility as selected, NEVER successful reset response. Failed initializer/reducer/invalid request is no new success generation. Lost response after owner publication may leave a newer state; client must observe again, never assume rollback or mint start. Credentials/control details stay private; packets carry no bearer/session/browser data.

Reset runner helper uses actual response JSON and validates exact known status/seed/provenance UUID/safe counters; return a COPIED producer packet instead of void (existing ignored-result calls compatible). Prefer cross-check fresh authenticated health/final-state same ownerEpoch/resetGeneration and actual seed with bounded timeout before returning. A mismatch/lost response/auth failure/counter packet malformed => fixture.invalid; no start proof. Synthetic 200 packet tests demonstrate only parser refusal/compatibility, not authentic endpoint authority. No capability registration/public proof mint in this helper. Browser session/document generation, permissions and private baseline/oracle requirements remain future joins.

## Exact proposed owners before source release

1. apps/scenario-lab/src/{state-store,types,server}.ts and existing src/tests/{state-store,server}.test.ts. These own actual publication/counters/variant resolution/authenticated packet response. Add one focused private helper only if measured state-store/server budget requires it, with exact additional owner request BEFORE edits; no baseline growth/marker-only library.
2. packages/test-runner/src/flow-lane/reset-scenario-lab.ts + NEW nearest owning flow-lane/tests/reset-scenario-lab.test.ts. Existing flow-lane/index.ts reexport/type adjustment only if actual API requires it. No whole runner wiring/refactor.
3. Existing scenario definitions/registry/manifests/instructions/oracles/readiness/Core/domain/extension stay unchanged. The new arm method must use existing manifest structure and test-contract types, not modify the corpus.

Exact narrow checks AFTER READY/SOURCE RELEASE and frozen code: touched scenario-lab nonincremental source/e2e types, narrow built owner+HTTP test files, runner nonincremental types and new helper test, downstream structure audit; owning package builds only as needed to execute these paths, never whole pnpm test/check/build. Literal independently runnable commands depend on existing built test output after allowed provisioning; no commands executed during this proposal. Actual isolated Scenario Lab HTTP process allowed by brief; no Next/panel/browser server/profile management.

## Meaningful actual owner + HTTP counterfactual matrix

| Boundary | Required observed cases (not yet run) |
| --- | --- |
| Actual owner epoch/baseline | Two actual stores same seed => state bytes equal, epochs different; immutable copied packet; constructor full baseline gen1/seq0; real mutation changes exact fixture data+seq; equal/unsupported reducer leaves seq and no changed disposition. |
| Atomic reset/reseed failure | Existing registered createState temporarily throws in isolated test only; actual owner reset/reseed fails after some initializers executed, old seed/map/all snapshots/variants/counters identical. Restore exact original function in finally; tests serialized. No production injection option. Actual reducer mutates clone then throws => no published partial state. |
| Successful reset/reseed | Actual control HTTP before/after reads: changed state reset to original exact seed bytes with greater resetGeneration/sequence; same-seed reseed invalidates earlier generation; new seed deterministically changes dynamic-list identity. Shared primary/frame server reads same epoch/counters. Fresh server restart/new owner epoch invalidates old packet. |
| Actual arm/variants | Registered scenario and workflow arms execute exact actual reducer; applied changed variant updates armSequence without pretending reset; missing/unknown/ambiguous/no_change arm never reports armed. Generic unmatched/ordinary changed mutation reports variant unknown; subsequent reset restores baseline. No mode-string inference. |
| Real transport/auth/method | Missing/wrong bearer, wrong control method, malformed/extra/reset epoch setter/unsafe seed/oversize body/unknown variant: actual HTTP fails; fresh actual health/final-state prove zero published changes. Force actual initializer failure after successful HTTP server construction -> reset500 with unchanged owner observed via authenticated route; no false new success packet. |
| Route/read sequencing | Actual GET route that records visit changes sequence; HEAD on same route/ordinary page render/health/final-state doesn't. No fallback sequencing outside owner. Unsupported API/no-op does not report changed; mutation throw no state/counter commit. |
| Helper false packets/outcomes | ok200 wrong status/schema/UUID/negative or unsafe counters/unknown field/mismatched second observation reject; reset500/401/network/lost response reject. Real authenticated reset-helper positive against actual server observes exact owner packet; static/mock response tests never count as process/start authority. |
| Compatibility/security | Existing deterministic-state tests compare `.state`/seed while explicitly checking new epoch differences; existing packet exact tests adapt additive provenance. Corpus/oracle bytes unchanged. No secret/recorded page/log disclosures; no command causal/start/acceptance fields. |

## Scope limits

This producer can establish that an actual isolated fixture owner published a reset/reseed/arm/change and identify its observed epoch/generations. It cannot authenticate a browser session/document, prove reset of browser storage or third-party accounts, prove full requirement interpretation, private oracle origin or native consumed-command causal attribution, or promote an original project. JSON copied from producer remains data; prior t333 interpretation/private observer/execution/promoter dependencies remain. No current tests/builds/runs or success claims. Source remains HOLD until supervisor reviews these exact shapes/owners and confirms provisioning READY.

## Implementation checkpoint

MAIN reviewed closed contracts read after READY; root approved actual owner/type/server/helper/tests. Requested focused control.ts extraction before exceeding server budget, no extra source edited pending review. Existing owner reset/reseed failures and in-place reducer throw will be measured against actual registry scenarios before fix.

Observed fail-first: actual owner reset/reseed/in-place-throw regressions all failed3/3 (1.393s) after owning compile0; reset leaves partial Map, reseed changes seed, reducer mutates live state. Counterfactual tests will use boolean deep equality to keep synthetic fixture diagnostics bounded. Root approved focused control.ts actual handler extraction; recorded before edit.

Current implementation owner/HTTP check20/22 passed (1.547s); two preserved reset tests compared whole old packets and correctly differed by new generations. Adapted these to assert identical fixture state/seed/variant while generations are separately tested; no corpus changes. Initial compile found optional manifest fixture typing only, corrected. New real helper and literal fresh-child epoch probes added; final checks pending. control.ts extraction approved and implemented.

Root approved exact additional internal state-counter.ts + owning tests/state-counter.test.ts (safe numeric advance, no caller setters/options). Recorded before edits. Actual owner23/23 and runner nonincremental types0/audit0 observed before this final focused extraction; final checks will follow final source freeze.

## Final measured owning validation

SOURCE FROZEN during final checks (report still updating observations). Actual built fixture counter/state-owner/HTTP files30/30 passed, zero skips, 8.950s; actual built reset-helper file18/18 passed, zero skips, 1.786s. Includes literal sequential fresh owned child processes (no epoch reuse), real authenticated reset/seed/arm/no-op/auth/failed-owner/GET-versus-HEAD paths and real helper-to-built-server cross-check. No browser runtime behavior claimed.

Fresh owning scenario compiler observed0 via scripts/build-scenario-lab.mjs. Runner direct owning compiler emit observed0 via `pnpm.cmd --filter @fluxiq-web-extension/test-runner exec tsc -p tsconfig.json`; prior final helper source nonincremental runner types0, followed by final emit covering approved test/counter correction. Source/e2e scenario nonincremental checks subsequently observed exit0. Downstream audit observed0 (174 warnings, 117 existing baselined entries); no baseline edits/increase.

Exact independently runnable commands from t336 worktree:

```powershell
node apps/scenario-lab/scripts/build-scenario-lab.mjs
node --test apps/scenario-lab/dist/tests/state-counter.test.js apps/scenario-lab/dist/tests/state-store.test.js apps/scenario-lab/dist/tests/server.test.js
pnpm.cmd --filter @fluxiq-web-extension/scenario-lab exec tsc -p tsconfig.json --noEmit --incremental false
pnpm.cmd --filter @fluxiq-web-extension/scenario-lab exec tsc -p tsconfig.e2e.json --incremental false
pnpm.cmd --filter @fluxiq-web-extension/test-runner exec tsc -p tsconfig.json --noEmit --incremental false
pnpm.cmd --filter @fluxiq-web-extension/test-runner exec tsc -p tsconfig.json
node --test packages/test-runner/dist/flow-lane/tests/reset-scenario-lab.test.js
node scripts/structure-audit.mjs
```

Direct owning compiler regeneration avoids rebuilding/mutating the stable read-only Core buddy and does not run package/full test suites. Generated outputs remained ignored; no generated/manual edits. Literal child proof is inside existing server.test owning bundle and needs no user panel/provider/browser. It uses owned temporary loopback servers, minimal child environment, bounded runtime/output and hidden Windows process, observes only epoch/generation then closes. Existing owner callback faults restore original registry functions/Number.isSafeInteger in finally, serialized synchronous tests. Pure internal numeric MAX_SAFE_INTEGER test establishes arithmetic bounds; actual owner unsafe-counter fault separately proves zero callback entry/no state publication. Neither is semantic effect authority.

Exact final changed owners: apps/scenario-lab/src/{state-store,types,server,control,state-counter}.ts; src/tests/{state-store,server,state-counter}.test.ts. packages/test-runner/src/flow-lane/reset-scenario-lab.ts and tests/reset-scenario-lab.test.ts. Existing barrels needed no edits. This own report only documentation owner. Corpus/manifests/scenario reducers/oracles/instructions and Core untouched.

## Final implementation details and limits

Owner constructor initializes actual complete baseline with generated UUID/gen1/seq0; reset/reseed clone all states before atomic Map+seed+counter+variant publication. Reducers run against cloned state/payload; clone/failure/reentrant/counter refusal cannot mutate live state. Changed/no_change reflects deep observed state difference. Matched registered manifest/workflow arm records applied variant identity/sequence; ambiguous matched legacy arm becomes unknown, explicitly ambiguous named arm refuses; no-op named arm409, ordinary unmatched changed state unknown. Reset baseline restores tracked variants and invalidates previous reset generation.

Authentic control routes preserve existing fields with producer provenance. HTTP control parses max16KiB, closed reset/seed/arm input, auth before parse/effect; helper streams max16KiB before parsing, requires HTTP200 and closed packets, cross-checks actual fresh authenticated health same UUID/generation/seed plus nondecreasing sequence and returns copied frozen reset event packet. Intervening changed state within same reset generation may make returned event historical: this is not a baseline/current browser/start proof. No public owner epoch/sequence setters, optional proof constructor, marker authority, commandId/createdByFlow receipt or promotion API.

Compatibility failures retained: initial owner behavioral3/3 failed; subsequent owner/HTTP20/22 passed and two prior whole-packet reset equality tests differed only by intentional generations, adapted to still compare unchanged fixture state/seed/variant. Initial optional manifest test typing correction made no product fixture change. Current measured owning48/48 pass; no qualification, private oracle attribution, original requirements interpretation or accepted project activation. Supervisor independent verification still required.

Final freeze confirmed after all observations; no further source/report writes during supervisor independent verification. No commits/git operations by worker.

## Supervisor independent verification
Root reviewed actual private state owner, authenticated control extraction and bounded streaming helper. Independently regenerated actual scenario compiler output then ran30/30 zero skips5.163s owner/counter/real HTTP/literal fresh-process cases; independently regenerated runner owning compiler and ran18/18 zero skips1.295s helper including real authenticated server. Scenario source/e2e nonincremental types0. Merged current downstream dev2affcc28 (documentation/candidate-source receipts only); final task audit pending. No source/corpus/Core changes from integration; producer data remains historical event observation, not current browser baseline/oracle/causal proof.
