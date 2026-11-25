# Brief t1042: W1's leftovers (no look anywhere, a handle still on the page binds everywhere)

**Goal.** Finish the user's rules that W1 (t1036) left incomplete outside its scope. The rules: "no more look
command, its ridiculous", and the model gets the page as run-scoped changes plus `core.full_page`. Each item
is fixed at its cause. Reports: `docs/working/page-diff-delivery-plan/reports/t1036-page-diff-delivery.md`
("Decisions for you") and `reports/t1036/g-combined.md` ("Open questions").

1. **Recovery still has a look.** `web.recovery.inspect` is a model-requested capture on the runtime-recovery
   path (Core `runtime/adaptation/recovery/runtime-exploration.ts`, domain `harness-options/options.ts:71`),
   kept only because recovery has no page channel. Give the recovery path the same page delivery W1 built for
   the evidence loop: Core's `runtime/llm/view-channel/` and the domain's `pageChannel`. Then withdraw
   `web.recovery.inspect`. If the recovery loop truly cannot carry the channel, report precisely why before
   changing anything.
2. **Core model text that says to look.** `runtime/llm/tool-failure.ts:63` ("look again before relying on
   earlier evidence"). Grep the Core and domain model-facing text you own (below) for any other look
   instruction and reword it to the page changes that come with every result and `core.full_page`. Keep the
   words generic: the model-text check, and AGENTS.md "Model guidance never teaches to the test".
3. **Reads and presses refuse a handle that is still on the page.** t1036 fixed detection
   (`structure/detect.ts`, `heldNow`): under stable handles, a handle that the page as it is now gives to an
   element binds directly, and only a handle gone from the page is refused. Reads and presses still go through
   their own stale refusal in `node-run/press*.ts` and the read path. Apply the same rule there, reusing the
   check (never a copy). Add a bind-case and a gone-case test for each path.

**Owned paths.** Core: `runtime/adaptation/recovery/**`, `runtime/llm/tool-failure.ts`,
`runtime/llm/view-channel/**` (additions only, if recovery needs them). Domain:
`domain/src/runtime/llm-evidence/{harness-options/**, node-run/press*, node-run/list-read/** (the stale check
only), structure/held-now or wherever detect's check lives if it must be shared}`, plus their tests and the
docs that describe them (`docs/architecture/page-evidence.md`).
**Must not touch.** W3's files (Core `runtime/flow-authoring/**`, `runtime/llm/evidence-loop.ts`,
`runtime/llm/loop-configuration.ts`, `runtime/llm/evidence-loop-decision.ts`, `decision-handlers/amendment.ts`,
`draft-amendment-feedback/**`, `evidence-loop/held-amendments.ts`,
`answer-first/completion/result-columns.ts`); t1041's files (`plan-resolution/extraction/retained-*.ts`,
`output-nodes/extract-list/stored-columns.ts`, `structure/stored-label.ts`); the scripted model. No git, no
paid runs, no `node -e`.

**Checks.** Core (heavy gate, `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t1042 -- <cmd>`):
`pnpm --filter fluxiq check`; in `packages/fluxiq`, `NODE_OPTIONS=--max-old-space-size=3072 node
../../scripts/vitest-groups.mjs --groups=parallel,real-sql src/runtime/adaptation src/runtime/llm`; then
`node scripts/structure-audit.mjs` and the Core libraries build. Domain: `DOMAIN_TEST_BUILD_LABEL=t1042 node
scripts/test-domain.mjs llm-evidence runtime/tests`, the domain check, the downstream structure audit and
`node scripts/check/model-text.mjs`. Then one provider-free scripted bigbox run (lab slot 3, headed, with the
watcher, `--attempts 4`) that must still pass all four attempts as t1036's did.

**Report.** `docs/working/page-diff-delivery-plan/reports/t1042.md`, ending with the return contract.
