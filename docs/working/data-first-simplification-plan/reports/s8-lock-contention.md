# S8 follow-up: Windows admission-lock retirement

Outcome: Done for the observed lock-error correction; product acceptance remains separate.

The first installed gate passed its prior suites, but t986's queued Core refresh later exited with EPERM opening `v2/admission.lock` before obtaining a slot. No build ran. The original helper deleted the shared lock filename directly and even nonowners read that filename again during cleanup. Windows documents that a pending deletion can deny new opens while earlier readers still hold the file. The exact failing read was not instrumented; this explains the race being addressed without claiming an unseen stack trace.

The correction atomically renames the owned shared lock to a nonce-specific retired name before deleting it. Dead-owner reclamation uses the same retirement and retains its exclusive reaper claim. Only an acquired owner releases the lock; a contender no longer reads it during cleanup. There is no catch-and-ignore permission workaround, workload cap, memory-threshold change or FIFO bypass.

Workers cancelled only their five owned pre-admission jobs for quiet diagnosis. Every cancelled session exited before validator output; no running test/build/provider was interrupted and no lock/ticket was manually deleted. The gate then reported no holders or queued jobs. The fix was developed separately in MeritPrompts `fix/heavy-lock-contention`, checkpoint `dc731ce`, version0.3.1; the active source stayed unchanged during investigation.

Observed validation through the unchanged machine gate:

- `node --test --test-name-pattern 'lock|ownership|concurrent admissions' tests/heavy-slot.test.mjs` ->8/8 passed,8,458.7401ms. Includes a prior open reader across ownership transfer and400 exact increments across four independent processes.
- `npm test` on the isolated fix ->96/96 passed,45,995.5224ms.
- `node tools/branch.mjs finish fix/heavy-lock-contention --check "npm test"` ->96/96 on branch,47,268.7899ms;96/96 after merge,45,157.9486ms. Merged/pushed Merit dev`3008788`, removed merged worktree/branch. No npm publication or main promotion.
- `node install.mjs --apply` from main Merit checkout ->nothing to change.
- Unchanged compatibility launcher `status` ->holders[]/queue[] with fresh physical/commit counters. `run heavy-lock-fixed-smoke -- git --version` ->exit0,git2.54.0.windows.1, normal release.

The compatibility launcher already imports the shared Merit source, so the quiet merge activated this correction. Workers received the hold-lift notice; P1's four checks were resubmitted first, followed by the t986 library refresh. Memory recovered enough for normal admission; no OS service was stopped by this agent and no admission override was used. The earlier administrator-service-stop question no longer blocks resumed validation.

Source: [Microsoft DeleteFile semantics](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-deletefile).

Not verified: every possible external filesystem/ACL failure. Real access failures still fail; this correction addresses retirement of the gate's own contested filename.
