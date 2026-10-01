# t223-W8: one whole decide request, measured before and after

Worker report. Brief: t223-W8. Scratch: `C:/Users/osrs_/AppData/Local/Temp/claude/c--Users-osrs--FluxStuff--FluxIQWebExtension/58ff9269-d8d6-4822-86c8-adf096a6a8a7/scratchpad`, referred to below as `<scratch>`.

## Outcome

Done. `<scratch>/t223-request-measure.mjs` rebuilds the complete request for a recorded evidence-loop decision using Core's own builders, then measures it with `automationStudioDeepSeekMessages` and `measureAutomationStudioDeepSeekInput`. The default target is lane C's everything-store build, decision 9: the results page, with the most history. Its total is **1,413,957 bytes, 471,335 tokens**. The provider recorded 477,506 input tokens for the same decision. The request carries **5 page-bearing entries**:

- 1 newest page: 803,550 B.
- **4 earlier pages: 547,498 B, 38.7 % of the request.** Their v2 packets alone are 433,728 B (30.7 %).

All pages together are 95.6 % of the request, and the constant prefix is 52,179 B (3.7 %). The earlier pages are large but **they do not dominate the request alone**: the newest entry is bigger (56.8 %). **41.0 % of the whole request (580,381 B) is `read.snapshot`.** That is the raw command snapshot that node-run outcomes carry beside the packet, and a packet-only publisher does not touch it (see Open questions).

## What changed and why

Nothing in either repository. New files, all in scratch:

- `<scratch>/t223-request/t194-everything-store-build.jsonl`: a copy of the dump `fxwork/t194/!FluxIQWebExtension/test-runs/instances/t194-slot-3/decision-dumps/build-2026-10-01T05-17-13-582Z-31824.jsonl`. It comes from run `run-mup2u8o3-6697c4be`, task `everything-store-plus-earbuds-under-50`, on Core `e5b8f015` and downstream `58fd0cd3` (dirty). That is the same Core commit the t223 tree is on. t193's only dump (`t193-slot-2`) has 5 decisions and none on the results page.
- `<scratch>/t223-request/build-request.ts`: the measuring module. The runner bundles it with the domain's esbuild 0.24.2, and an alias plugin maps `fluxiq[/sub]` onto Core **source** (`packages/fluxiq/src`), so the web domain and the measurement share one Core. `sqlite3` stays external.
- `<scratch>/t223-request-measure.mjs`: the runner and printer. It accepts `--decision N` (default 9), `--dump <jsonl>`, `--route-start failed|blank` (default `failed`), `--publish <module>#<export>` and `--json`.
- `<scratch>/t223-request/stand-in-publisher.mjs`: a trivial publisher, `standIn`. It keeps schemaVersion, trust, location and title, and replaces `elements` with `elementCount`.
- `<scratch>/t223-request/out-*.txt`: the outputs pasted below.

### What one dump record holds

`decision-dump.ts` writes three kinds of record:

- `entry`: each distinct evidence entry once, keyed by a hash of its content.
- `decision`: the iteration, the keys of the window shown (in order), and the decision with the provider's `usage`.
- `tool` and `check`: every tool request with its full result, and every completion verdict.

**The dump holds the whole evidence window**, including the loop's own entries: decision history (`core.evidence_history`), draft (`core.flow_draft`) and budget (`core.budget.N`). Those are recorded, not synthesized. **The rest of the request is not in the dump.**

### How the rest was rebuilt

Every piece below comes from Core's own builders, called the way `service.ts:1533-1591` calls them:

- **Core and domain**: `FluxIQ.create({rootDir: <scratch>/t223-request/.fluxiq-root})` plus the domain's `registerFluxIQHost` (`domain/src/web-panel-host.ts`), the same registration the Lab's web process uses. The registry and resolution come from `svc.nativeNodeRuntime`, with scope `{kind:"domain", domainId:"web-automation"}`. The binding is `svc.llmEvidenceRuntime`.
- **Tools**: `automationStudioHarnessOptionRegistry({binding, nodeIds, startLocation}).evidenceLoopBinding(...)` returns 2 tools.
- **Offers** (the iteration's rules from `evidence-loop.ts`):
  - At decision 9 the recorded budget shows `decisionsLeft 3`, which is the wrap-up, so 0 tools are offered.
  - `canComplete` is true.
  - `canAmend` is true when the draft has steps and this is not the final decision.
  - `authoring` is true.
- **Schemas**: `automationStudioEvidenceFlowBootstrapDraftCompletionSchema(sizeLimitsOf({metadata:{}}))` for completion, then `buildAutomationStudioLlmEvidenceLoopDecisionSchema(offered, completion, canComplete, canAmend, true)`.
- **Routing**: `startAutomationStudioBuildRouting({start:"first_look"})`. Every recorded `tool` result is replayed through `routing.recording`, and every decision up to the target through `routing.observing`. The recorded results carry their own `routeState`.
- **Request**: `automationStudioHarnessInputWithDeniedEvidenceKeys(...)` feeds `runAutomationStudioLlmHarness({... dryRun: true})`. Its `result.request` goes through `automationStudioDeepSeekMessages` and `measureAutomationStudioDeepSeekInput`. The token limits are the run's: 992,000 / 8,000 / 1,000,000.

**Synthesized, exactly:**

1. **The instruction record.** I built it the way `saveFlowGenerationInstruction` does: title "Evidence-guided generation goal", the body is the task text from `apps/scenario-lab/.../everything-store/live-tasks.ts` (identical in the t194 and t223 trees), and the ids are placeholders.
2. **projectId and flowId.** Both are placeholders (`project.lab-everything-store`, `flow.00000000-...`). They are under 100 B together.
3. **Flow size limits**: the default, `metadata: {}`.
4. **flowInputs**: `[]`, for a new blank Flow.
5. **The start-route observation.** The free first look carried no `routeState`, so the real run asked the host to capture the page right after the look. The screenshot just before the build shows `about:blank`. The default `--route-start failed` assumes that capture failed. Then no situations are ever recorded, and routing is 1,434 B. `--route-start blank` assumes it succeeded. Then the 7 recorded route states become situations, and routing is 16,123 B (+14.7 KB, +1.0 %).
6. **Offered tools at a non-wrap-up decision.** All eligible tools are offered. Withdrawn looks are not reconstructed.
7. **No `reusableContext` and no `policyGates`.** `service.ts` passes neither for this build unless `useReusableContext` is set.
8. **The wall-clock-dependent budget values** are the recorded ones, so nothing is synthesized there.

### `--publish`

The publisher is applied to the dump entries before the harness packs them, so Core packs the published value the way it would at run time. A recursive walk finds every object with `schemaVersion: "web-llm-evidence.v2"`: a bare packet, a refusal's `page`, or a node-run result. It splits off the node-run outcome keys, which are exactly the keys of `WebNodeOutcome` in `domain/src/runtime/llm-evidence/node-run/run.ts`: `ok, node, status, pageChanged, unchangedPress, pageUnreadable, control, read, inFlow`. It passes the remaining page to `publish`, then returns `{...published, ...outcome}`, which is the domain's own spread order.

## Commands run and observed results

All runs were from `<scratch>` and all exited 0.

`node t223-request-measure.mjs` (today's request, decision 9):

```text
Decision 9 (2026-10-01T05:18:29.399Z), answered complete; publish: none (today's request); route start: failed
Offers: tools 0/2 (wrap-up: tools withdrawn), complete true, amend true
Harness dry run: ok=true diagnostics=[llm.dry_run] estimatedInputTokens=472,098

TOTAL request: 1,413,957 bytes, 471,335 tokens (measureAutomationStudioDeepSeekInput)
  system message 3,125 B, user message 1,410,832 B
  recorded provider usage for this decision: inputTokens 477,506 (cache hit 1,792)

CONSTANT PREFIX
  (routing: decides 315 B; current 56 B; paths 6 items, 943 B; situations 0 items, 2 B; stateUnavailable 46 B)
  system message                                             3,125 B     1,042 tok
  taskKind+promptVersion+expectedOutput                        141 B        47 tok
  outputSchema (decision grammar)                            5,191 B     1,731 tok
  context ids (schemaVersion, stage, projectId, flowId)          94 B        32 tok
  instructions                                                 788 B       263 tok
  policyGates                                                    0 B         0 tok
  flowBootstrap.startLocation+note                             353 B       118 tok
  flowBootstrap.nodeCatalog                                 40,952 B    13,651 tok
  flowBootstrap.catalogTruncated+catalogSelection               99 B        33 tok
  flowBootstrap.routing                                      1,434 B       478 tok
  reusableContext                                                0 B         0 tok
  evidenceLoop.tools (0 offered)                                 2 B         1 tok
  subtotal                                                  52,179 B    17,393 tok

EVIDENCE WINDOW (in order sent)
  callId                   toolId                                 bytes    tokens  page? (path) / packet bytes / read bytes (of which read.snapshot) / bytes as recorded
  initial.core.run_node    core.run_node                            270        90  web-llm-tool-result.v1 / rec 270
  nav1                     core.run_node                         32,890    10,964  yes /scenarios/everything-store/ / page 32,219 / read 511 / rec 32,890
  consent1                 core.run_node                         83,620    27,874  yes /scenarios/everything-store/ / page 29,860 / read 53,584 (snapshot 52,076) / rec 83,620
  search1                  core.run_node                         90,392    30,131  yes /scenarios/everything-store/ / page 31,621 / read 58,585 (snapshot 56,777) / rec 90,392
  search2                  core.run_node                            509       170  no / rec 509
  search3                  core.run_node                        340,596   113,532  yes /scenarios/everything-store/s?i=all&field-keywords=&k=wireless+earbuds / page 340,028 / read 397 / rec 340,596
  detect1                  web.detect_repeating_structure         4,077     1,359  web-llm-structure.v1 / rec 4,077
  extract1                 core.run_node                        803,550   267,850  yes /scenarios/everything-store/s?k=wireless+earbuds&page=5 / page 287,193 / read 516,193 (snapshot 471,528) / rec 803,550
  core.evidence_history    core.evidence_history                  1,339       447  no / rec 1,339
  core.flow_draft          core.flow_draft                        3,950     1,317  no / rec 3,950
  core.budget.9            core.budget                              353       118  no / rec 353
  subtotal                                                    1,361,546   453,849
  decision history: 1,339 B; draft: 3,950 B; budget: 353 B; iteration: 1 B

PAGES
  entries carrying a page: 5, 1,351,048 B entry bytes (95.6% of request), packet bytes 720,921, read bytes 629,270 (read.snapshot 580,381, 41.0% of request)
  newest page: extract1 803,550 B (packet 287,193, read 516,193)
  earlier pages: 4 [nav1, consent1, search1, search3], 547,498 B (38.7% of request), packet bytes 433,728 (30.7%), read.snapshot 108,853
  JSON framing not attributed above: 232 B
```

`node t223-request-measure.mjs --publish t223-request/stand-in-publisher.mjs#standIn` (same request, stand-in publisher):

```text
Decision 9 (2026-10-01T05:18:29.399Z), answered complete; publish: t223-request/stand-in-publisher.mjs#standIn; route start: failed
Published packets: 5
Offers: tools 0/2 (wrap-up: tools withdrawn), complete true, amend true
Harness dry run: ok=true diagnostics=[llm.dry_run] estimatedInputTokens=232,155

TOTAL request: 694,128 bytes, 231,392 tokens (measureAutomationStudioDeepSeekInput)
  system message 3,125 B, user message 691,003 B
  recorded provider usage for this decision: inputTokens 477,506 (cache hit 1,792)

CONSTANT PREFIX
  (identical to the run above: subtotal 52,179 B 17,393 tok)

EVIDENCE WINDOW (in order sent)
  initial.core.run_node    core.run_node                            270        90  web-llm-tool-result.v1 / rec 270
  nav1                     core.run_node                            878       293  yes /scenarios/everything-store/ / page 207 / read 511 / rec 32,890
  consent1                 core.run_node                         53,967    17,989  yes /scenarios/everything-store/ / page 207 / read 53,584 (snapshot 52,076) / rec 83,620
  search1                  core.run_node                         58,978    19,660  yes /scenarios/everything-store/ / page 207 / read 58,585 (snapshot 56,777) / rec 90,392
  search2                  core.run_node                            509       170  no / rec 509
  search3                  core.run_node                            811       271  yes /scenarios/everything-store/s?i=all&field-keywords=&k=wireless+earbuds / page 243 / read 397 / rec 340,596
  detect1                  web.detect_repeating_structure         4,077     1,359  web-llm-structure.v1 / rec 4,077
  extract1                 core.run_node                        516,585   172,195  yes /scenarios/everything-store/s?k=wireless+earbuds&page=5 / page 228 / read 516,193 (snapshot 471,528) / rec 803,550
  core.evidence_history    core.evidence_history                  1,339       447  no / rec 1,339
  core.flow_draft          core.flow_draft                        3,950     1,317  no / rec 3,950
  core.budget.9            core.budget                              353       118  no / rec 353
  subtotal                                                      641,717   213,906

PAGES
  entries carrying a page: 5, 631,219 B entry bytes (90.9% of request), packet bytes 1,092, read bytes 629,270 (read.snapshot 580,381, 83.6% of request)
  newest page: extract1 516,585 B (packet 228, read 516,193)
  earlier pages: 4 [nav1, consent1, search1, search3], 114,634 B (16.5% of request), packet bytes 864 (0.1%), read.snapshot 108,853
  JSON framing not attributed above: 232 B
```

The full text of both runs is in `<scratch>/t223-request/out-d9-today.txt` and `out-d9-standin.txt`.

### Cross-checks against the provider's recorded usage

Each row is a separate run, `--decision N`:

| Decision | Rebuilt bytes | Rebuilt tokens | Provider inputTokens | Bytes per provider token |
| --- | --- | --- | --- | --- |
| 1 (270 B evidence, tools offered) | 56,640 | 18,896 | 14,826 | 3.82 |
| 2 | 94,967 | 31,672 | 26,891 | 3.53 |
| 5 | 270,517 | 90,189 | 86,194 | 3.14 |
| 8 (results page, tools offered) | 1,420,713 | 473,587 | 479,196 | 2.96 |
| 9 (target) | 1,413,957 | 471,335 | 477,506 | 2.96 |

The run used the same Core commit as this tree (`e5b8f015`), so the drift is the tokenizer, not a different prefix. Schema and catalog text runs at about 3.8 B per provider token, and page JSON at about 3.0. So Core's 3 B/token estimator over-counts the prefix and slightly under-counts pages. The `--route-start blank` variant of decision 9 measures 1,428,646 B and 476,232 tokens, with routing at 16,123 B.

## Not verified

- **Working trees, not commits.** The bundle reads the t223 trees as they stand. Core has uncommitted edits in `system-prompt.ts`, `task-request.ts`, `explored-evidence-label.ts` and `flow-script-format.ts`. Downstream has 81 modified files, including the other worker's in-flight `domain/src/runtime/llm-evidence/` edits. The system message (3,125 B) and the tool descriptions (4,133 B when offered) reflect those edits at that moment. Rerun the script after they land.
- **Whether the start-route capture on `about:blank` failed.** I assumed it did (the default); it is a ±1.0 % effect.
- **Which tools a non-wrap-up decision really offered.** Looks withdrawn after an ignored redirect are not reconstructed. This does not affect decision 9, which offers none.
- I did not build or test the domain and did not run the Lab, per the brief. I wrote no domain build output; the bundle and `.fluxiq-root` are in scratch.
- The stand-in publisher is not t223's publisher. It only proves that the flag reaches every v2 packet (5 of 5) and keeps the outcome keys.

## Open questions or contradictions found

1. **`read.snapshot` sends the raw command snapshot to the model, and it is 41 % of this request.** A node-run outcome's `read` is the whole command payload, screened only for denied keys (`node-run/read-result.ts`, `webNodeReadResult`). On a click, a type and an extract, that payload includes `snapshot.interactiveElements`, whose items have `xpath`, `classNames`, `id`, `bounds` and `documentBounds`. That is 52,076 B, 56,777 B and 471,528 B respectively.
   - It is a second copy of the page beside the v2 packet.
   - It carries locators. `xpath` is not in `WEB_LLM_DENIED_EVIDENCE_KEYS`, which denies only `selector`, and `host-runtime.ts` says the packet stopped carrying selectors because they are not something a model may read.
   - After any packet-only t223 publisher it is **83.6 %** of the request.
   - t223 has to decide whether `read` (or `read.snapshot`) is in its scope. The supervisor may want the security owner to look at the `xpath` exposure.
2. **The decision-9 cache miss.** Decision 9 hit the provider cache for only 1,792 of 477,506 tokens, against 199,040 at decision 8, and cost $0.143. At wrap-up the decision grammar (`outputSchema`, the 3rd key of the user message) and the tool list change, so everything after about 200 bytes misses the cache. This is the cache-prefix design in `request-body.ts`; it is outside t223 but worth noting.
3. **Earlier pages.** The 4 earlier pages are the home page three times (nav1, consent1, search1, about 30 KB of packet each) and results page 1 (search3, a 340 KB packet). Their packets are 30.7 % of the request; with their `read.snapshot` they are 38.7 %.
