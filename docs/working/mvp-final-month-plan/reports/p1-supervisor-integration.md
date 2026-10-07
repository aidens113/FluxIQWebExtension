# Candidate facade integration — supervisor

## Current State

t299 remains isolated. The worker's controller/wrapper and request parser are
verified but must not merge until the facade reads the flag atomically. Supervisor
has added Core-owned unverified draft storage; facade/API wiring waits for the
serial service.ts owner in t298. No candidate promotion or live qualification.

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
