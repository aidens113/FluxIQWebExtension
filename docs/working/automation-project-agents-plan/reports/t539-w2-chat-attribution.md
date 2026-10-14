# t539 W2: chat attribution (downstream half), worker report

## Outcome

Done. Nothing committed. Live browser behaviour was not exercised.

## What changed and why

All paths are under `fxwork/t539/!FluxIQWebExtension`.

1. **Readers** (`apps/extension/src/shared/activity/project/`, a new subfolder with a barrel, because `shared/activity/` was already at its file-count warning). `agent.ts` has `activityAgent(event)`: it reads only the closed role set, keeps `briefId` only when it has Core's `TARGET_ID` shape (`^\S{1,200}$`), and keeps `subflowName` only when it is non-blank (trimmed). `project-card.ts` has `projectCard(event)`, which reads a card only from a `note` row and only in the shape of one of the four contract variants. It drops list entries in the wrong shape, keeps at most 20 entries per list, and accepts amounts only when they are finite and at least 0. A plan with no subflows is rejected. Both readers are re-exported from `shared/activity/index.ts`. Their types come from `ClientGatewayActivity`, so they do not wait on Core re-exporting the new type names.
2. **History** (`background/activity/unit-history.ts`, `shared/activity/history-limits.ts`):
   - New limit `buildEventsCeiling: 5_000`.
   - The *current build* is the in-progress build that was heard from most recently, keyed by subject id. A build is in progress while any of its units has not sent `final`.
   - The current build's units are held up to the ceiling, and eviction never removes them. I protect only the current build, not every unfinished one, so a build Core never ended (for example after a restart) becomes an ordinary unit once another build starts. This also keeps the existing eviction test valid.
   - When a build stops being current, all of its units are trimmed back to 500.
   - Trims remove the oldest unpinned events first, then pinned rows, and the plan card last. Pinned rows are every project-card note and the `request` event.
   - The flattened list is now rebuilt only when it is read, not on every accept.
3. **Messages** (`panel/chat/stream/step/`):
   - `messages.ts` gained one branch (a project card becomes a `project` message), the per-brief key `activityId#briefId`, and three optional `StepMessage` fields: `agent`, `lane` and `project`. The final return goes through `withAgents`.
   - The new logic lives in `project-message.ts` and `project-words.ts`. `projectMessages()` builds each card message and remembers names, so later cards show a subflow's name rather than its key or id. When a return arrives, it marks the card of its brief in place. `withAgents` attaches the author and sets `lane` ("Builder · Search", "Validator · Search", "Supervisor") on a message whose lane differs from the previous message in its unit. A brief counts as its builder's lane, so the first step after a brief has no label.
   - Project messages carry `actions: []`, so the repeat, retry and done-again folds never merge two receipts.
   - Card icons come from kinds Core already pins: plan `branch`, build `draft`, survey `look`, repair `repair`, reset `repeat`, return `join`, receipt `test`. `lucide-nodes.ts` needed no change, and the existing parity test still holds.
4. **View** (`view/step-message-view.ts`, `chat.css`):
   - Each step message now has a `data-role` attribute and, under a brief, `data-brief` (indented with a left rule). It also has a lane label line.
   - The project card is created only for project messages. It is drawn with the action-card classes plus plan rows. A brief card that is still "working" shows as `settled` once its unit is no longer current.
   - `thread-view.ts` needed no change. The Chrome side panel and the Firefox popup share this view.
5. **W3 Lab index** (`packages/test-runner/src/lab-runs/rewrite-steps-index.ts`): this mirrors the header in Core's *uncommitted, in-progress* `listing.ts`. The preamble is unchanged. When any step has a string `role`, the header is `| Step | Kind | Role | Brief | Tool | Summary | Cost |`, with `-` where a step has no value; otherwise it keeps the five columns.
6. **Docs**: `docs/architecture/extension-client.md` (history paragraph in Live Activity; new "A build with several agents" item) and `docs/architecture/testing-facility.md` (a step-log paragraph on `role`, `briefId` and the two columns).

## Commands run and observed results

- `node scripts/test-extension.mjs panel/chat background/activity shared/activity panel/icons` (label `t539-w2`) printed `# tests 521 # pass 521 # fail 0`. This includes the new `unit-history` (3 tests), `agent`/`project-card` (5), `project-message` (4), `project-words` (5, with the icon parity check) and `step-message-view` (2) tests.
- To prove the keying matters, I temporarily removed it from `messages.ts`. The multi-agent test then printed `not ok 1`. I restored the keying and it printed `ok`.
- `node scripts/check-extension.mjs` exited 0 with no output. It runs both the src and the test tsconfig.
- `npx tsc -p tsconfig.json --noEmit` and `-p tsconfig.test.json --noEmit` in `domain/` both exited 0 with no output.
- `npx tsc -p tsconfig.json --noEmit` in `packages/test-runner` exited 0.
- `node ../../scripts/build-cache/cli.mjs test-runner:build`, then `node --test` on `dist/lab-runs/tests/{rewrite-steps-index,lab-run-record,write-playback-steps}.test.js`, printed `# pass 20 # fail 0`.
- `pnpm structure:check` printed `structure-audit: passed (193 warning(s), 644 baselined)`, the same 193 as before my changes. `messages.ts` is at 436 lines; it was already past the warning.
- `pnpm --filter @fluxiq-web-extension/test-runner check` was refused by the core-build gate: "Core's build ... is 4 minute(s) behind its source" (`runtime/llm/step-log/index.ts`), because Core's A6 worker is mid-edit. That is why the typechecks above were run directly.

## Not verified

- No live browser test: I did not check the side panel or popup rendering, the CSS indentation or lane label at 360 px, or icon drawing in a real browser. The view was checked only through the fake DOM.
- The typechecks ran against Core's built `dist`, which already contains the committed `agent`/`project` contract types. I did not run them against Core A6's later source.
- I did not run the full suites, per the twice-a-day rule.

## Open questions or contradictions found

- **W3 header is provisional.** It copies Core A6's uncommitted `listing.ts`. If Core's worker changes the column order, the wording, or the rule that the columns appear only when an agent wrote a step, `rewrite-steps-index.ts` and its test must follow.
- Core's `client-gateway.ts` commit put the two new type docs between the `ClientGatewayActivity` doc comment and its type. That doc block now sits above `ClientGatewayActivityAgent` (Core file; not touched).
- The folds (`card-repeats.ts`, `retried.ts`, `done-again.ts`, not owned) still key their stretches by `activityId`, not by brief. If lanes interleave, a builder's failed card followed by another lane's identical done card could still be folded together. This cannot happen at web capacity 1; it would need a follow-up if capacity is raised.
- Several assumptions about Core's emitters, which are not yet visible:
  - every agent of one build shares one `activityId` (the history protects by build subject id either way);
  - a brief's builder events carry `briefId`;
  - a validator receipt may lack `briefId`, in which case it reads "Tested a subflow" unless the event's `agent.subflowName` names it.
