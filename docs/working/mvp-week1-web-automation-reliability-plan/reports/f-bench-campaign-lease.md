# Worker Report — Benchmark Campaign Lease

Status: Implemented; supervisor verification required

## Scope

- Added a cross-process, per-campaign lease primitive only.
- Did not edit the bench orchestrator, CLI, barrel, or shared working document.

## Implementation

- `campaign/lease.ts` prepares a durable owner record in a private candidate
  directory and atomically renames that directory into the fixed `lease` path.
- A live owner on the same boot and with the same OS process-start identity is
  refused. Dead processes, prior boots, and reused PIDs are recovered.
- Recovered owner directories move to `lease-history/<leaseId>`. The deterministic
  destination is also the reclamation fence: racing stale observers cannot rename
  a newly acquired lease over the already populated archive directory.
- Owner records contain only a PID, timestamps, a random lease ID, and SHA-256
  hashes of boot/process identities. No command lines, environment, credentials,
  campaign data, or other secret-bearing material is recorded.
- Process and filesystem seams are injectable. Defaults use Windows CIM process
  creation/boot times, Linux procfs boot/start identities, and `sysctl`/`ps` on
  other Unix systems.

## Public API

- `acquireCampaignLease(campaignDirectory, options?)`
- `CampaignLease`: `owner`, `assertOwned()`, and idempotent `release()`
- `CampaignLeaseHeldError`
- Injectable `CampaignLeaseProcessProbe` and `CampaignLeaseFileSystem`

## Validation

- `pnpm --filter @fluxiq-web-extension/test-runner build`: passed.
- `node --test packages/test-runner/dist/bench/tests/campaign-lease.test.js`:
  6/6 passed. The tests pin live refusal, dead recovery with preserved record,
  changed boot, PID reuse, release/reacquisition, and an eight-contender race.
- Default Windows boot/process probe acquisition, ownership check, and release:
  passed in a disposable campaign directory.
- Mutation: ignoring the recorded process-start identity made the PID-reuse test
  fail 5/6 exactly as intended; the guard was restored before the final run.
- `pnpm structure:check`: the lease introduced no reported violation; the gate
  remains red only because the concurrently edited `docs/working/README.md` is
  stale and requires the supervisor's eventual baseline regeneration.
