# t186-E — Core authored docs: remove LLM call grants

## Outcome

Partial. The four authored architecture docs now describe the current design:
model calls run on the caller's own unlocked key with no grant, and spend is
bounded by the loop budget. Both `framework-reference.md` copies were left
alone on purpose: they are generated output (see Open questions).

## What changed and why

Core tree `C:\Users\osrs_\FluxStuff\fxwork\t186\!FluxIQ`:

- `docs/architecture/automation-studio.md`
  - LLM section: the grant passages are replaced by current-state text, which covers:
    - no grant exists, and nothing is issued, leased, preflighted, digest-checked, size-confirmed or revoked;
    - `AutomationStudioLlmModelCaller`;
    - `createAutomationStudioSessionKeyProviderResolver`: no caller means no provider. With a caller, the newest enabled DeepSeek key is released per call by a one-use session reveal, following the same rule as `panel-command-key.ts`;
    - defaults are defaults, not checks;
    - spend is bounded by the loop budget and `adaptationPolicySettings.maxEstimatedCostUsdPerRun`;
    - optional `permittedConsequences`, and the gate still asks (`permission_required`);
    - `run-runtime-session` turns `runIntent` from an actor into `llmExecution` (`AutomationStudioRuntimeSessionLlm`, `AUTOMATION_STUDIO_RUNTIME_SESSION_LLM_INTENTS`);
    - `generate-flow-bootstrap-adaptation`'s caller is `request.actor`, it takes optional `permittedConsequences`, and the base digest is read as the Flow stands.
  - Result-verification deadline paragraph: dropped the grant-service `resolve` explanation and the 2026-09-20 history.
  - Standing authorization section: kept, with a note that this change leaves it alone. Only "grant" wording that meant the interactive grant was changed. The grant-call paragraph was replaced by a neutral paragraph on per-call key release and bounds.
  - "What the shipped app reaches": rewritten around caller and intent. Added a result-verification bullet.
  - "Iterating adaptations and their bounds":
    - the guards are rewritten without grants, and cost uses the Flow setting or the resolution default;
    - the call backstop is 250, or the resolution's `maxCallsPerRun`;
    - the grant-based worst-case table and its price arithmetic are removed;
    - Bootstrap now has at most 64 decisions, or the resolution's call count.
  - "What a recovery may do that outlasts it": the gate's authority is now the run input's `permittedConsequences` plus the instructed set. Narrowing history and the 2026-09-22 narration are removed.
  - Deleted the sections "LLM execution grant lifetime" and "What a failed call does to its grant". Nothing else in the tree linked their anchors except `persistence.md`, whose link is also removed.
- `docs/architecture/automation-studio/persistence.md`
  - Rewrote the process-local capabilities paragraph around the per-call reveal, with no grant.
  - "64-call execution-grant backstop" is now "64-call backstop".
- `docs/architecture/automation-studio/llm-flow-bootstrap.md`
  - Permission section: the gate answers from `permittedConsequences`. The 2026-09-24 history is removed.
  - "Grant-bound generation command" is now "Generation command", with its intra-doc link fixed:
    - input is project, Flow, `caller` and optional `permittedConsequences`;
    - no digest or revision is compared against a grant, and the base binding is read as the Flow stands;
    - key release is described per call.
  - Removed grant wording from these places: the stale-grants reason code, "under the current grant", "execution grant ID", the pricing and reservation paragraphs, readiness (no grant service, no preflight or issue endpoint identities, no `build_and_adapt` purpose), the evidence-loop bounds, the token-exposure and high-token paragraph, and the Runtime Debug and website-task UI paragraphs (no preflight, no confirmation, no claim window or lease).
- `docs/architecture/package-boundaries.md`
  - Added a new top migration note, "Next minor (unreleased): model calls need no execution grant". It lists removed endpoints, contracts, modules, readiness and options; the changed resolver, service and API signatures; and the spend limit.
  - Left the released 0.6.0 and 0.7.0 notes intact, because they are versioned history. The new note says their grant passages describe what was removed.

## Commands run and observed results

- `node scripts/structure-audit.mjs --rule docs-links` printed `structure-audit: passed (0 warning(s), 0 baselined).`
- `node scripts/docs-reference.mjs --check` fails at `docs-reference.mjs:75`, "framework-reference.md is stale". This is expected: the parallel code deletions already changed the exports, and the reference has not been regenerated.
- I checked the new anchors by hand against the headings: `#the-standing-authorization-for-runs-nobody-is-watching`, `#what-a-recovery-may-do-that-outlasts-it`, `#iterating-adaptations-and-their-bounds` and `#generation-command` all exist.
- Final grep for "grant" in the owned files, and why each remaining hit stays:
  - `automation-studio.md`:
    - line 262 says no execution grant exists;
    - line 329 is "cross-domain grants", which are Flow domain grants;
    - line 421 is the standing-authorization note ("removal of interactive execution grants");
    - lines 1083, 1084 and 1133 name `granted`, a code field in `llmGate.permissions` / `actionPermissions` for the consequence permission;
    - line 1212 is "checks grants", the native node capability grants;
    - line 1479 is the per-run domain grant.
  - `persistence.md`:
    - line 541 covers `domain grants` and `execution grants are retained`, which are Flow execution-default domain grants, not LLM grants;
    - line 569 is the `program-gated` "time-boxed grant" (Database Manager and Secret Keys);
    - line 665 is client-gateway pairing.
  - `llm-flow-bootstrap.md`:
    - lines 27, 96 and 145 use "granted" in the sense of consequence or node permission;
    - lines 92 and 112 are the ask answer value `grant`;
    - line 342 says no grant is supplied.
  - `package-boundaries.md`: the new note, plus the historical 0.6.0 and 0.7.0 entries, lines 111 to 358 before the insert.
  - Not owned, and not LLM grants: `automation-studio-flow-dsl.md`, `automation-studio-flow-regions.md` and `automation-studio-native-nodes.md`.

## Not verified

- The docs follow the spec's target contract. Code was still in progress, and only the deletions were visible at the time, so the new names below are taken from the spec, not from code:
  - `model-caller.ts`
  - `runtime-session-llm.ts`
  - `session-key-provider.ts`
  - `llmExecution`
  - `permittedConsequences` on the input
- I did not state token-budget figures. The spec's "48k in / 8k out / 56k total" are ambiguous, and they conflict with the 50,000-per-request ceiling if read as per-call.
- I stated cost defaults of USD 0.25 per call and USD 2 total from the spec.
- Unverified against final code:
  - the failure-code classification in guard 5;
  - the bootstrap readiness document fields;
  - whether the flow_bootstrap reason-code taxonomy still has a stale-grant code;
  - whether `getLlmExecutionBinding` survives.
- The UI paragraphs describe the target web behavior, not observed UI.

## Open questions or contradictions found

1. `docs/reference/framework-reference.md` and `packages/fluxiq/docs/reference/framework-reference.md` are generated by `pnpm docs:reference`, and their text comes from source exports and JSDoc. Hand edits would be overwritten, and `docs:check` compares them against the generator's output. Once the code workers finish, the supervisor must run `pnpm docs:reference` in the Core tree. The JSDoc in files I do not own also needs updating first, for example `failure-disposition.ts` ("what it means for the grant").
2. `package-boundaries.md`: removing exports is a minor bump under the release policy, but `packages/fluxiq/package.json` is still 0.7.0 and the policy line still says `fluxiq` at `0.7.0`. The version number is the supervisor's call. The note is titled "Next minor (unreleased)".
3. `automation-studio.md` about line 797, outside grep scope, says "The shipped app gives live patch testing no provider". That was already inconsistent with the `explore_and_adapt` lane, and I left it untouched.
4. The old worst-case recovery table was removed rather than recomputed. Recompute it once the session-key resolver's real defaults exist.
