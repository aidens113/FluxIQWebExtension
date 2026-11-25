# Page diff delivery: rules every workstream follows

Lead: Claude Code. Read this with your own brief (`t1036`, `t1037` or `t1038`). Mode for workers: implementation from a decided plan.

**Read:** the plan `docs/working/page-diff-delivery-plan.md` (Current State, Decisions, Phases: it is short); the audit `docs/working/data-first-simplification-plan/reports/t1035-agent-structure-audit.md` sections 1-5 and "Ranked structural changes"; Core's `docs/architecture/code-structure.md` and Core's `AGENTS.md` before editing Core. The AGENTS.md rules in this repository bind you whether or not you read them; the ones that bite here:
- Fix the root cause; never cap a symptom. The page budget (D6) bounds payload size only: no count of calls, steps or rounds may end or reset a run.
- Model guidance never teaches to the test: every word the model reads is generic (no realistic scenario's site, product, task or answer). `node scripts/check/model-text.mjs` must stay ok.
- Structure: one exported thing per file, a barrel in every directory, tests in the `tests/` folder of the directory owning their subject, no extract-and-drop. `domain/src` never imports `apps/extension/src`; no model provider host, SDK or key outside Core.
- Wire changes stay synchronized across shared protocol types, background routing, domain mappings, capabilities, tests and `docs/architecture/`. Update the authored architecture docs your change makes wrong.

**Ownership.** Edit only your brief's owned paths. A file in another workstream's list: never edit it; report what you need from it. A file in no list: you may edit it, and name it in your report.

**No git, no paid or live runs.** Sub-supervisors and workers never commit, stash, reset or switch branches; leave everything in the working tree for the lead. No Lab live run and no provider call. No `node -e`; write small scripts under your tree's `test-runs/<task>/` (ignored; never commit them).

**Heavy steps** (builds, test suites, Lab runs) go through the machine gate: `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run <label> -- <command>`. Never run full suites (`pnpm check`, `pnpm test`, `pnpm build`, Core's whole vitest run).

**Narrow checks** (run them; quote the summary line in your report):
- Core, in `packages/fluxiq`: `node ../../scripts/vitest-groups.mjs --groups=parallel,real-sql <folders>` with `NODE_OPTIONS=--max-old-space-size=3072`, over the folders you changed plus the folders that import what you changed (find them with a grep for the module path; never `vitest related` in `packages/fluxiq`, it runs out of heap). Then `pnpm --filter fluxiq check` and `node scripts/structure-audit.mjs` at Core's root.
- Domain: `DOMAIN_TEST_BUILD_LABEL=<task> node scripts/test-domain.mjs <filters>` and `pnpm --filter @fluxiq-web-extension/domain check` (if it says Core's build is not current, rebuild Core's libraries as it instructs, then rerun).
- Extension, if `apps/extension` changed: `pnpm --filter @fluxiq-web-extension/extension check` and `EXTENSION_TEST_BUILD_LABEL=<task> pnpm --filter @fluxiq-web-extension/extension test`.
- Downstream `node scripts/structure-audit.mjs`; `node scripts/check/model-text.mjs`.
- A failure that also fails on `dev` is recorded by exact test title, never fixed by weakening the test.

**Offline proof (P4).** Replay the five recordings `C:/Users/osrs_/FluxStuff/fxwork/recorded-evidence/t1015-bigbox/run-*` (each `steps/NNNN-*/` holds request, response, decision, call, result and page view) through the new code where your change applies. Report tokens per request (page tokens and new, uncached tokens) and decisions, old against new, as a table. A provider-free Lab run, where your brief asks for one, runs `bigbox-retail` only, through the Lab's own launch with its run watcher (`docs/architecture/testing-facility.md`, "The run watcher"), headed, under the heavy gate.

**Reports.** Each worker writes `docs/working/page-diff-delivery-plan/reports/<task>/<worker-label>.md` in your tree; the sub-supervisor writes `docs/working/page-diff-delivery-plan/reports/<task>.md` and returns the return contract (Outcome, Changed, Validation with the command and observed result, Not verified, Report, Notes). Never edit the plan document, `AGENTS.md` or the working-document index: the lead does.

**Budget.** Workers default to `worker` (Sonnet); `worker-heavy` (Opus) for design, unknown causes, cross-cutting changes and a retry after a Sonnet failure; `worker-light` (Haiku) for running named commands. Dispatch in the foreground when your next step depends on the result. Verify every worker claim yourself before integrating it.
