# run-mv35459z-b5aa50cc: paid proof R4a (third attempt), stopped by the supervisor mid-build

Not a product failure. The user approved R4a attempt 3 then R4b (2026-10-10) and launched it from `fxwork/t418`
(instance `t418-proofs`, workspace `t418-r4a-3`; trees at downstream `527aae6b` and Core `9aeba98c`, which carry
t419-t435). Minutes in, mid-build (eight UI-review snapshots taken), the user asked to wrap up for the session. A paid
run never runs without a live supervisor, so the supervisor stopped the launcher and ended the orphaned Lab, Core web
server, scenario server and browser. The user then said to wait for the run, after it had already been stopped, and
then "nevermind".

- No verdict, no judge, no Flow saved. The run was stopped before its cost summary was written; it spent a few cents,
  under the $0.10 ceiling.
- Kept: `test-runs/instances/t418-proofs/.staging-run-mv35459z-b5aa50cc/` (events, snapshots) and the UI-review
  screenshots `run-mv35459z-b5aa50cc.ui-review.local/01..08`; session logs under
  `persistent-isolated/t418-r4a-3/.sessions/run-mv35459z-b5aa50cc/logs/`.
- Nothing in the source changed between this run and the next launch, so if the unchanged-source guard refuses the
  relaunch, that refusal is about this deliberate stop, not a failure.

## Next

Relaunch R4a attempt 3 with the same command and a fresh workspace (`t418-r4a-4`), supervised to its end; then R4b.
