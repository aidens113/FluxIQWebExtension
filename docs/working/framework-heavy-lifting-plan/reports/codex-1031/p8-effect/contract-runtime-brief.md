Role: heavy worker; gpt-6.1-sol, max. Task t824.
Root C:/Users/osrs_/FluxStuff/fxwork/t824/!FluxIQ. Setup complete; workspaceBuild skipped.
Read Core/web discovery reports in MAIN downstream codex-1031/p8-effect/ and Core FHL Current State/CC12/P8 only.
PHASE1 ONLY: implement/freeze the minimal trusted action-effect contract, resolver helper and strict action-declaration parsing; report interface before runtime edits.
Owned phase1: nodes/action-effect/** (focused new module/barrel), nodes/definitions.ts and nodes/index.ts; shared closed consequence type location if needed; runtime/action-permissions/{declaration,consequences}.ts and owning tests. Not model/actions.ts legacy unused API. No runtime/executor/native/service edits yet.
Proposed active SDK seam: NodeDefinition.actionEffect?: {effectClass:observe|state|commit; commitWhen?:string; permissionConsequences?:readonly known ActionConsequence[]}. commitWhen names a boolean parameter and raises base class to commit when true; unresolved binding cannot be treated as proven false. Default absent false only where native schema defaults make that honest.
Resolved form has effectClass and permissionConsequences, no predicate. Prefer one pure shared resolver. No inferred browser words or model-authored actionEffect fields.
Permission declaration gains optional resolved client actionEffect. Legacy effect:observe|mutate remains; existing declarations unchanged. Strict known consequence parsing; unknown values must not erase a known floor.
Avoid nodes->heavy runtime value imports/cycles. If closed consequence type/value needs a model-owned module, reexport existing runtime names without changing strings/order/parser behavior. Each source exports one thing and every new directory has a barrel.
Only trusted canonical definitions/callbacks establish floors. Later runtime will resolve before acting/throws and thread floor through attempt+retry/native/output paths; model observe/idempotent claims cannot lower commit. No new trusted idempotency exception in this slice.
Preserve truthful read exemption and no new per-playback permission prompts. Commit alone does not imply money/delete/etc; client permission classes union with model classes only when known.
Named pure/parse contract tests only, max2workers; no builds/types/full suites/API/browser/panel/git. Keep source/test directory and800line limits; use typed stubs, no new as-never/deep imports/statement packing.
Report MAIN downstream codex-1031/p8-effect/contract-runtime.md. Stop after Phase1 interface freeze; root dispatches permission and web lanes before your runtime follow-up.
Return Outcome/Changed/Validation/Not verified/Report/Notes(max3lines).
