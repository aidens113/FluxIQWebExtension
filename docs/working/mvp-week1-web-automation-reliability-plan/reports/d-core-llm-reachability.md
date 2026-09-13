# d-core-llm-reachability — Core's LLM page says what the shipped app can reach

Worker report, 2026-09-13. Core checkout `F:\!FluxIQ` at `HEAD 3cb8976`. Before the edit, the page had no uncommitted changes. Its last commit was `20bb3b4`.

## Outcome

Done. Core's `docs/architecture/automation-studio.md` now states, in its "LLM-Assisted Deterministic Automation" section:
- which task kinds the production resolver allows for each grant purpose;
- which runtime paths the shipped app gives a provider.

`pnpm docs:check` passed. Nothing was committed.

## What changed and why

Only `F:\!FluxIQ\docs\architecture\automation-studio.md` changed, inside the owned section: 79 lines added and 8 removed.

1. **The build grant paragraph.** Removed: "Production resolution currently permits `build_and_adapt` only for the initial `flow_bootstrap` task/output ... unreachable until the live adaptation phase explicitly enables them". That sentence was wrong about the resolver and was also plan history. It now says:
   - The grant module's own check lets a build grant match six request families (`runtime/llm/execution-grants.ts:504-510`).
   - The resolver bound in `createGlobalProgramRuntime` gives each purpose a task-kind list (`programs/_shared/runtime.ts:73-83`):
     - `build_and_adapt`: `flow_bootstrap`, `evidence_tool_decision`;
     - `diagnose_and_adapt`: `runtime_diagnosis`, `runtime_patch`;
     - `diagnosis_only`: `runtime_diagnosis`.
   - A call whose task kind is outside its list is refused and its grant revoked (`execution-grants.ts:274`, `:380-382`, `:494`).
   - Bootstrap sends `flow_bootstrap` (`service.ts:1975`). It sends `evidence_tool_decision` only when generation is evidence-guided (`service.ts:1910`, `:1933`).
   - A request with no grant resolves no provider (`runtime.ts:74`, `:83`).
   - `runRuntimeSession` accepts only the two diagnosis purposes (`service.ts:3358`, `:3362-3372`).
2. **The routed retry sentence (Router Runtime).** Added: a routed retry reruns the selected Subflow's graph from that graph's start (`service.ts:3273-3287`). It links to the new subsection.
3. **The live patch paragraph.** Added:
   - The clone starts at the failed node, or at the node a reroute or node-targeted patch names (`live-patch.ts:178`, `:351-355`).
   - The shipped app gives live patch testing no provider.
4. **The promotion paragraph.** Added: in the shipped app, automatic promotion never applies an adaptation.
5. **The training modes paragraph.** Added: in the shipped app, no training window reaches a provider.
6. **New subsection, "What the shipped app reaches"**, at the end of the section. For each path it names the grant purpose that gives it a provider:
   - **Flow bootstrap generation:** `build_and_adapt`.
   - **Runtime diagnosis:** `diagnosis_only` or `diagnose_and_adapt`.
     - Without a grant there is no provider. The harness records `llm.provider_missing` and calls no model (`harness/run.ts:96-106`).
   - **Runtime patch requests:** `diagnose_and_adapt` only.
     - That lane saves one high-risk proposal and never executes it (`service.ts:3110-3113`; `live-patch.ts:291-293`).
     - `diagnosis_only` sends no patch request: its override turns adaptation creation off (`service.ts:6625-6631`), and the patch request requires it (`service.ts:3039`).
   - **Live patch testing:** no purpose.
     - It runs only outside the `diagnose_and_adapt` lane (`service.ts:3110-3113`).
     - The two diagnosis purposes cannot reach it, as the two bullets above show. A run without a grant has no provider, and `runRuntimeSession` refuses a build grant.
   - **Automatic promotion:** no purpose.
     - It is attempted for every adaptation a runtime patch saves (`service.ts:3136`). In the shipped app that is only the `diagnose_and_adapt` proposal.
     - That proposal is high-risk, and the gate sends high risk to manual review (`training-modes.ts:310`).
   - **The retry after an applied patch:** no purpose.
     - It needs an attempt that was applied automatically and asked to retry the original action (`service.ts:3270`). The shipped app never produces one.
     - An explicit grant skips it at both call sites (`service.ts:3540`, `:3594`).
   - **Training modes:**
     - Every canonical run computes and records its training behaviour (`service.ts:2838-2863`, `:3441-3447`, `:6686`).
     - Without a grant, its LLM steps have no provider.
     - An explicit grant replaces the window's behaviour with the lane's (`service.ts:6625-6631`, `:6654-6674`).
     - An exhausted training budget does not stop an explicit lane (`service.ts:2878-2879`).
   - **Where the retry starts.** A closing paragraph says the retry reruns in the same run session from the graph's start, not the failed node.
     - It passes the run's graph options, which set no `startNodeId` (`service.ts:3421-3436`, `:3287`; `service.ts` contains no `startNodeId` at all).
     - The executor then chooses the start node (`executor/graph-run.ts:151-152`), and `runCanonicalAutomationStudioFlow` passes options through (`composite-executor.ts:38-40`).

Each sentence was checked against the lines cited above, read at Core `3cb8976`. The new text describes current design only.

## Commands run and observed results

- `git -C F:\!FluxIQ status --short -- docs/architecture/automation-studio.md` before editing: no output, so the page was clean. HEAD was `3cb8976`.
- `pnpm docs:check` in `F:\!FluxIQ`, after the main edits:
  - exit status 0, captured through a file;
  - output: "Validated local links in 101 authored/reference Markdown files." and "Deterministic framework reference is current."
- `pnpm docs:check` again, after three wording fixes: exit status 0, same two lines.
- `git -C F:\!FluxIQ status --short` at the end: only ` M docs/architecture/automation-studio.md`, 79 insertions and 8 deletions.

No builds and no test suites were run, as the brief directs.

## Not verified

- **No behaviour ran.** Every claim comes from reading code at Core `3cb8976`. A live check would need to show three things:
  - an adaptive run without a grant records `llm.provider_missing`;
  - a `diagnose_and_adapt` run saves a `proposed`, high-risk adaptation and does not retry;
  - no automatically applied adaptation appears.
- **Carried over, not re-read:**
  - "PIN-authorized review endpoint" is repeated from the page's existing text (the explicit lanes paragraph). I did not re-read the endpoint.
  - The existing claim that routed retries "preserve Router decisions and Subflow-entry evidence" was left as it was and not checked.
- **Other hosts.** I checked only the non-test callers of `createGlobalProgramRuntime`: `framework/index.ts:176` is the only one. An importing host that builds `AutomationStudioService` with its own `llmProviderResolver` could reach these paths. The subsection says so in its opening sentence.
- **`docs:check` is a narrow check.** It covers local links and the generated reference's freshness, not prose. The in-page anchor `#what-the-shipped-app-reaches` is skipped by the link validator, so it was not checked mechanically.

## Open questions or contradictions found

1. **Binding rules conflict with this brief.** The "Binding rules for every worker" in `briefs/finish-week1.md` say "Never edit FluxIQ Core (`F:\!FluxIQ`)", but this brief owns a Core page and the dispatch message told me to edit it. I followed the brief as the more specific instruction. The supervisor should note the exception, or add one to the rules.
2. **`i-week2-entry-points` open question 4 is still unanswered.** `execution-grants.ts:504-510` lets a build grant match runtime, instruction and structural proposal tasks that the shipped resolver and `runRuntimeSession` never allow. The page now states both facts. Nothing I read says whether that breadth is intended.
3. **An old line reads as more current than it is.** The page's earlier sentence "Fully adaptive behavior remains an explicit opt-in" (line 202) is literally true as a setting, but in the shipped app the setting reaches no provider. I left it, because the new subsection and the pointers from the live patch, promotion and training paragraphs cover it. The supervisor may want a pointer there too.
