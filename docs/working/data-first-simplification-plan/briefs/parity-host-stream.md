# Parity report: host-stream events are outside the replay (t986 follow-up)

Lead: Claude Code session, 2026-11-23. Tier: worker (Sonnet).
Workspace: `C:/Users/osrs_/FluxStuff/fxwork/t986/!FluxIQ` only (Core).
Read: this brief; `packages/fluxiq/src/client-gateway/trace-replay/session-references/session-bound.ts` (the predicate and why it exists); `trace-replay/comparison/parity-report.ts`; `trace-replay/tests/replay-host-stream.test.ts` (its comment explains which entry it currently excludes); the "Round 4" and "Round 5" sections of `C:/Users/osrs_/FluxStuff/fxwork/t986/!FluxIQWebExtension/docs/working/data-first-simplification-plan/reports/t986-offline-proof.md`.

Goal: a host's event on its own stream belongs to no session and never passes through the gateway, so the parity report must classify it as `outside` and never call it a divergence. Example: Automation Studio's `control` stream, including the artifact a control event carries, such as a capture's start receipt. Today `compare()` marks only `kind === "control"` as outside (line 107).

Steps:
1. In `parity-report.ts`, classify an event as outside when it is `kind === "control"` or it is an `artifact` that `clientGatewayTraceEventSessionBound` says is not session-bound. Import the predicate through the `session-references` barrel. Then check `artifacts()` (line 143): if the manifests' artifact lists include host-stream artifacts, compare only the gateway-tap artifacts, so a recorded host artifact the replay never takes is not a divergence. Base this on the recorded fields, never on one receipt's id.
2. Add tests beside the subject (`comparison/tests/`):
   - A trace with a sessionless control-stream artifact gets an `outside` entry and a `matched` verdict.
   - A client upload on the tap's `artifact` stream that the replay lacks is still a divergence.
   - Then make `replay-host-stream.test.ts` assert the control artifact's entry class (`outside`) instead of excluding it.
3. Run through the gate: the trace-replay and trace-matcher owner files (Vitest, one worker, named files), `pnpm --filter fluxiq check`, and `node scripts/structure-audit.mjs`, all in Core.

Rules:
- Run every heavy command through `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run <label> -- <command>`, with `--maxWorkers=1 --minWorkers=1 --fileParallelism=false`. No full suites.
- Never weaken an existing assertion or refusal. Every existing parity divergence test must still pass.
- No browser, provider or paid runs, no git mutations, no `node -e`.
- Owned: `packages/fluxiq/src/client-gateway/trace-replay/comparison/**` and `trace-replay/tests/replay-host-stream.test.ts`. Must not touch anything else.

Report: `C:/Users/osrs_/FluxStuff/fxwork/t986/!FluxIQWebExtension/docs/working/data-first-simplification-plan/reports/parity-host-stream.md`. End with the return contract.
