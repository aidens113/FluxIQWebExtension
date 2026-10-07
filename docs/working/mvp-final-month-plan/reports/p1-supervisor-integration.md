# Candidate facade integration — supervisor

## Current State

t299 remains isolated. The worker's controller/wrapper and request parser are
verified but must not merge until the facade reads the flag atomically. Supervisor
added Core-owned unverified draft storage and the command orchestration; worker
then wired service/API atomically after t298 integration. Current-dev merged and
independent actual facade/API/conversation/reauthor53/53 pass, Core typecheck0.
No candidate promotion or live qualification; final integration audits pending.

## Work ledger

- Reviewed submission digest/revision invalidation, discovery loop and worker
  invocation template. Independently reran generation-request 6/6 and candidate
  authoring-loop 7/7. The first invocation named a nonexistent candidate.test.ts;
  Vitest ran only the request file, so the actual authoring-loop file was run next.
- Added runtime/service/candidate-drafts/{record,store,index}.ts and service barrel
  export. The Core store writes candidate-draft.json through ProgramJsonStore,
  separate from approved/applied adaptations. Stores immutable original instruction
  text/IDs, base/settings, canonical submitted plan and accounting. It does not
  record raw discovery/page evidence or grant execution by reading a draft.
- Persistence regressions 3/3: fresh store reads the draft over plain JSON and
  SQLite; adaptation list remains empty; caller mutation cannot change stored
  snapshot; cancelled save writes nothing. Supervisor fluxiq check exit 0 and
  Core structure audit exit 0 after additions.
- Draft persistence is not acceptance receipt recovery or atomic promotion.
  Before runtime use the plan must pass canonical validation again and its
  original instruction/base/identity must still match. Process crash promotion
  recovery and durable idempotency remain P2 dependencies.
- Authored Core bootstrap architecture notes distinguish available modules from
  unintegrated facade behavior. No provider/full suites/commits for this slice yet.

## Next serial work

Integrate t298 service cancellation first; merge both dev branches into t299;
extract candidate generation orchestration into its owning command module and
wire the request flag/draft response/persistence atomically. Add service-level
scripted proof, then exact detached runtime execution and t300 requirement receipts.
Do not merge the flag parser by itself or treat static submission as product success.

## Current integration receipts

Worker source87c4c9f9 froze the atomic flag/draft/service/API slice. Supervisor
reviewed extraction/permissions/purse/accounting and merge246a503f preserves both
candidate and verification exports after the only merge conflict (barrel). Actual
service4cases, API19, conversation4 and reauthor26 passed independently after dev
merge:53/53 (26.58s). fluxiq check executed/stamped0 (45.29s). Public result
consumers still need the built declaration/web check; narrow build is running.
Draft cancellation during underlying OS write and base CAS remain explicitly
unverified; stored draft cannot execute or promote solely because it is readable.
