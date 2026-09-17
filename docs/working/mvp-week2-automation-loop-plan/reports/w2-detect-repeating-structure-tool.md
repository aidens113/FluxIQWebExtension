# w2-detect-repeating-structure-tool: find a list to scrape, and resolve plan handles

Worker report, 2026-09-16. This repository only; FluxIQ Core was read, never
edited. No live provider call was made and the demo workspace was not started.

## Outcome

Done, including the scope addition the coordinator sent mid-task
(`resolvePlanNodeParameters`).

What exists now, in plain terms:

- A model authoring a Flow can call a new tool, `web.detect_repeating_structure`.
  Given nothing, it finds the page's largest readable list. Given a `target.N`
  it was shown, it finds the list around that element. It gets back an opaque
  handle (`extraction.N`), plus each column's key, label, kind and coverage,
  the item count, and how the list continues. It never sees a selector or a
  page value.
- The domain keeps what each handle stands for (the real `web.dom.extract_list`
  request) behind `resolveExtractionHandle`.
- `resolvePlanNodeParameters` turns a plan node's `{ "handle": "target.N" }`
  selector into the real selector the exploration saw, and
  `{ "handle": "extraction.N" }` into the real `extractList`. Anything it cannot
  resolve with certainty is refused with a named code.

On the real Scenario Lab pages, through the real content-script bundle:

| Page | No target given | How the list continues |
| --- | --- | --- |
| product-catalog | the 8 product cards, 7 fields (image src/alt, name, link, price, rating, stock) | Next link |
| data-table | the 12 rows, 4 columns read by header | none |
| member-directory | all 240 rows, 6 columns by header (menus and filter options skipped) | none |
| infinite-feed | the 10 visible posts, 4 fields | infinite scroll (page declares `role="feed"`) |
| infinite-feed, load-more variant | same posts | Load more button |
| basic-form | refused: a form's labels are not a list | n/a |

Each detected request, sent back as `web.dom.extract_list`, reads the records.
For the feed, the kept scroll request reads all 60 posts.

## What changed and why

### The wire: a flag on the existing snapshot action, not a new action

- `domain/src/extraction/structure-detection.ts` (new) declares:
  - the request `{ selector? }`;
  - the answer `{ ok: true, proposal, infiniteScroll? }` or
    `{ ok: false, refused }`, where `refused` is one of `target_not_found`,
    `ambiguous_target`, `no_repeating_run` or `sensitive_region`;
  - `webAutomationStructureDetectionValue`, which copies an answer field by
    field. It checks item, fields and pagination with the same request reader
    a dispatch is refused by, so a handle can never stand for a request the
    page would not run.
- Why a flag rather than an action: every action type automatically becomes an
  executable Flow node (`output-nodes/definitions.ts`, which was off limits).
  Detection must not be executable, and a Flow's snapshot node sends no
  parameters (`output-nodes/payloads.ts`), so a Flow cannot reach the flag.
  `web.dom.capture_snapshot`'s parameter schema is deliberately left
  unchanged.
- `domain/src/actions/types.ts`: added `detectStructure` to the command and
  `structure` to the result.
- `domain/src/client/gateway-action-parameters.ts` lifts `detectStructure`.
  `gateway-mapping.ts` copies `structure` into the gateway payload through the
  validator.
- `domain/src/runtime/capabilities.ts`: new gateway capability
  `web.structure.detection` (kind `snapshot`, no action types, so nothing new
  becomes executable). The runtime reads it: the tool refuses to run for a
  client that does not declare it.
- Extension plumbing (`apps/extension/src/`):
  - `content/actions/capture-snapshot.ts` runs detection when the flag is
    present.
  - `content/actions/types.ts` and `content/action-runtime/execute-action.ts`
    grant `detectStructure` to the verb.
  - `content/action-runtime/results.ts` carries `structure` onto the result.
  - `shared/protocol.ts` and `content/types.ts` re-export the types.
  - Background routing needed no change: the command travels intact, which a
    new row in `runtime/tests/action-runner.test.ts` proves, including
    delivery to a named child frame.

### The page side (`apps/extension/src/content/extraction/`)

- `detect-structure.ts` (new) runs the picker's own `inferListFromElement`.
  - **With a selector:** a snapshot's selectors are not unique (every product
    link on the catalog is `[data-testid="product-link"]`). Detection only
    reads, so several matches are accepted when they all sit in the one run.
    Matches spread over runs are `ambiguous_target`.
  - **Without a selector:** runs are tried largest first, and the proposal
    with the most items wins; ties go to more fields, then higher confidence.
    A run whose only readable fields are live input values is a form and is
    skipped (this is what basic-form showed).
  - **Sensitive controls** use the shared rule (`isWithinSensitiveControl`).
    A target inside one is refused, and so is a run whose items sit inside one
    or whose every field is excluded. Partly sensitive runs keep the picker's
    `handling: "exclude"`.
- `largest-runs.ts` (new) scans every container, bounded to 10,000 elements
  and 12 candidates. It skips runs inside nav, footer, menus, listboxes, tab
  lists, trees, `select` and `svg`, and runs that are not rendered.
- `feed-signal.ts` (new) reports infinite scroll only when the page declares
  the ARIA feed pattern (`role="feed"` within six levels, or
  `aria-setsize="-1"`) and no pagination control was found. The picker's rule
  that `scroll` is never guessed still holds.
- `infer-list.ts`: its signature function is now exported as
  `itemTemplateSignature`, so the scan groups siblings exactly as inference
  does.
- The optional bounded scroll/wait probe was **not** built. Scrolling a feed
  loads more items, which is a page change and could not honestly be declared
  observe-only. The static ARIA signal covers the Lab's feed; see Not verified.

### The domain tool (`domain/src/runtime/llm-evidence/structure/`, new)

- `detect.ts`: input `{}` or `{ target }`, declared `effect: "observe"`, no
  repeat policy (Core already refuses an identical repeat).
  - A target is bound through the selector recorded for it, which must still
    be on the same page and in the same frame. This is looser than reveal's
    "exactly one element" rule, for the uniqueness reason above.
  - Page refusals map to bare codes: `target_unobserved`, the new
    `no_repeating_structure`, and `sensitive_value`.
  - A client that does not declare the capability, or answers without a
    detection, is a fault (an error), not a refusal.
- `packet.ts`: splits a detection into the model's packet
  (`web-llm-structure.v1`) and the handle's binding, from the same field list.
  - The packet holds `location`, `extraction`, `target?`, `itemCount`, `fields`
    (`key`, `label`, `kind`, `coverage`), `pagination` (one of `none`,
    `next_link`, `load_more_button`, `infinite_scroll`, `numbered_pages`),
    `confidence` and `fieldsTruncated?`.
  - Excluded (sensitive) fields are dropped from both halves.
  - Labels are cut to 80 characters.
  - Over the byte budget, fields are cut from both halves together.
  - A declared feed is kept as `{ mode: "scroll", maxScrolls: 50 }`, the
    domain's page bound, which the page-side reader stops short of when the
    feed ends.
- `handles.ts`: a bounded store (16 handles), scoped by project and Flow.
  - `resolve` answers `unknown_handle` for a handle that is malformed, was
    never issued, or belongs to another Flow or project.
  - It answers `stale_handle` for this Flow's handles that were let go.
  - Every binding is copied on the way in and on the way out.
- `tools.ts`:
  - The fourth tool is declared and dispatched.
  - `resolveExtractionHandle({ projectId, flowId, handle })` is on the runtime
    as the named accessor.
  - The production binding supplies `structureDetectionSessionIds` from the
    new capability.
- Vocabulary:
  - The tool id `web.detect_repeating_structure` was added to
    `WEB_LLM_EVIDENCE_TOOL_IDS`.
  - The success code `web.structure.detected` and the rejection
    `no_repeating_structure` were added to the published sets, so the Lab's
    sanitizer admits them with no edit.
  - The refusal classifier comment in `harness-options/vocabulary.ts` now
    names both new codes as deliberately unclassified.
- `capture.ts`: the gateway type gained the optional
  `structureDetectionSessionIds()`. If it is absent, detection refuses to run.

### Scope addition: `resolvePlanNodeParameters` (`llm-evidence/plan-resolution/`, new)

- The signature is exactly the coordinator's:
  `resolvePlanNodeParameters({ projectId, flowId, nodeDefinitionId, parameters })`.
  It returns `unchanged`, `resolved` with the parameters, or `refused` with
  `issueCodes`. It is declared structurally on `WebAutomationLlmEvidenceRuntime`,
  because Core's `AutomationStudioLlmEvidenceRuntimeBinding` does not have the
  method yet.
- `target-packets.ts` remembers, per project and Flow, the newest packet the
  model was shown for each page. Inspect, navigate and reveal all feed it.
  Handles are positional, so resolution works per page:
  - with `{ "handle": "target.N", "location": "<the packet's location>" }`,
    against that page only;
  - bare, only when every remembered page agrees on the handle, otherwise
    `ambiguous`;
  - a selector the page gave to several described elements is `not_unique`.
    This matches reveal's refusal: resolving it would click the first product
    link whatever the model meant.
  - The store is bounded to 8 pages per Flow and 32 Flows. A let-go page makes
    its handles `stale`.
- `resolve-plan-node.ts`:
  - `selector` is a handle slot only on web nodes whose action schema declares
    `selector`, derived from `webAutomationActionDefinitions`.
  - `extractList` is a handle slot only on `web.output.dom-extract_list`, and
    accepts optional `minItems` and `maxItems`. These are checked with the
    request reader, so a bound the page would refuse or clamp is refused as
    `malformed`.
  - A handle element in a child frame writes `browserFrameId`. A node already
    naming a different frame is refused.
  - A literal selector is `unchanged`, never reported as resolved.
  - A recognisable handle anywhere else, including nested or on non-web nodes,
    is `misplaced`.
  - The issue codes are `web.handle.malformed`, `misplaced`, `unknown`,
    `stale`, `ambiguous`, `not_unique` and `frame_mismatch`, all exported as
    `WEB_PLAN_HANDLE_ISSUE_CODES`.

### Tests

- New domain tests:
  - `llm-evidence/structure/tests/detect.test.ts`: 8 rows, driven by
    `captured-detections.ts`. These are the five real detections the content
    bundle produced, pasted verbatim with the Lab port rewritten to 4173, as
    `page-evidence/capture.ts` does.
  - `plan-resolution/tests/resolve-plan-node.test.ts`: 9 rows.
  - `extraction/tests/structure-detection.test.ts`: 4 rows.
  - `client/tests/structure-detection-wire.test.ts`: 3 rows.
- Updated domain tests: `llm-evidence/tests/tools.test.ts` and
  `vocabulary.test.ts` now expect the fourth tool and the new codes.
- The payload assertions follow the packet tests' pattern: a recursive key
  allowlist, no string containing selector characters, and no selector from
  the capture anywhere in the serialized packet.
- New extension tests:
  - Content harness: `e2e/content/tests/extraction/tests/structure-detection.spec.ts`,
    8 rows on real pages, including a secret-only injected list and a D3 check
    for product names, cells and member emails.
  - Unit: `content/extraction/tests/feed-signal.test.ts`, 3 rows.
  - Routing: one new row each in `runtime/tests/action-runner.test.ts` and
    `result-mapping.test.ts`.
- `domain/src/runtime/llm-evidence/elements.ts` was not touched.

## Commands run and observed results

- Domain tests, `node scripts/test-domain.mjs` in `domain/`:
  - Labelled iterations, then the final unlabelled run that rewrote the
    tracked `.test-build`: `# tests 576`, `# pass 576`, `# fail 0`, exit 0.
  - This includes `domain.test.ts`'s DeepSeek input-token budget check with
    the fourth tool declared.
- Extension tests, `pnpm test` in `apps/extension`: `Extension smoke test passed.`,
  `# tests 643`, `# pass 643`, `# fail 0`, exit 0.
- Full content harness, `pnpm test:content -- --workers=2 --reporter=line`:
  `279 passed (1.2m)`, exit 0.
- Negative probes, via a scratch runner that bundles the two new domain test
  files. Each probe applies one defect and restores the file (confirmed
  `restored byte-identical: true` each time). Baseline was `# pass 17, # fail 0`.

  | Defect applied | Result |
  | --- | --- |
  | A selector leaks into a field label | exit 1, 2 failures |
  | A literal selector is reported as resolved | exit 1, 2 failures |
  | A bare handle takes the newest page instead of refusing an ambiguous one | exit 1, 1 failure |
  | A shared selector resolves anyway | exit 1, 1 failure |
- `node scripts/structure-audit.mjs`: `structure-audit: passed (59 warning(s), 17 baselined)`.
  My changes add no warnings; `results.ts` and `action-runner.test.ts` were
  already over the advisory 400 lines.
- `pnpm check`, three runs:
  1. Before the final `not_unique` change: exit 0. `# pass 96`, `# pass 24`,
     the audit passed, and every package check was `Done`.
  2. After it: exit 2. The only failure was
     `packages/test-runner ... demo-llm-exploration-adaptation.test.ts(264,55): error TS1005`,
     another worker's file caught mid-edit. `domain check: Done` and
     `apps/extension check: Done`; the audit passed. A re-run of
     `tsc -p tsconfig.json --noEmit` in test-runner exited 0 moments later.
  3. Last run: exit 1. The single failure was
     `FAIL [imports] packages/test-runner/src/demo-llm-exploration-adaptation.ts ... "./demo-workspace/proposal-structure.js"`,
     again another worker's in-progress file.
- `pnpm --filter @fluxiq-web-extension/extension build`: exit 0, and it rewrote
  the tracked `apps/extension/build/`. A second build after my last domain
  change produced identical bundle hashes.

## Not verified

- **No loaded extension, gateway or Core was exercised.** The content path ran
  in the Playwright content harness (the real bundle on real pages, with no
  extension, background worker or gateway). The domain tool ran against fake
  gateways fed real captures. Nothing was tested in a browser with the
  unpacked extension, and no live DeepSeek run was made.
- **Nothing calls `resolvePlanNodeParameters` or `resolveExtractionHandle` yet.**
  Core has neither method on its binding type, so they are declared only on
  this repository's runtime type. Flow Bootstrap will not use them until Core
  wires them in.
- **The packaged domain `dist` was not rebuilt.**
  `@fluxiq-web-extension/domain/node`, which `packages/test-runner` imports,
  still has the old tool and code lists until someone runs a domain build. I
  skipped it because the build deletes `dist` under concurrently running
  workers.
- **Infinite scroll is detected only when the page declares a feed.** A real
  site without `role="feed"` or `aria-setsize="-1"` reports `none`. There is
  no scroll or wait probe.
- **Frames:** the child-frame path (`browserFrameId`) is proven by unit tests
  only, not on a real iframe page.
- **Architecture docs were not updated.** The brief barred `docs/**` apart
  from this report. `docs/architecture/` should gain the new tool, flag,
  capability, packet and resolver.
- **Mid-session bundle break (resolved by its owner):** for part of the
  session the real content bundle would not build. The other worker's
  `domain/src/output-nodes/extract-list/dispatch.ts` value-imported
  `fluxiq/automation-studio`, which the `domain/client` barrel pulls into the
  browser bundle. Meanwhile I validated with a temporary stubbed harness
  config (since deleted). The import was later changed to
  `fluxiq/automation-studio/nodes`, after which the real harness and build
  passed.

## Open questions or contradictions found

1. **Core prompt and wiring (for the Core worker):**
   - The prompt should tell the model to write
     `{ "handle": "target.N", "location": "<packet location>" }` when it
     explored more than one page. Bare handles that differ between pages are
     refused as `web.handle.ambiguous` by design.
   - `{ "handle": "extraction.N" }` accepts optional `minItems` and
     `maxItems`.
   - The tool description currently says only that the handle "names" the
     structure; it should be updated once Core's prompt says where to put it.
2. **Targets on repeated cards cannot be addressed yet.** Snapshot selectors
   are not unique for repeated elements, so a plan cannot click "the third
   product link" through a handle: it is refused as `web.handle.not_unique`.
   Fixing that belongs in the extension's selector generation
   (`describe-element.ts` `selectorFor`), or needs a fingerprint carried with
   the resolved selector. Extraction is unaffected.
3. **Paginated extraction timeout.** The resolver does not set `timeoutMs` for
   a resolved paginated `extractList`. The node default would cut a
   multi-page read short unless the output-nodes worker's timeout scaling
   (gap report item 3) lands.
4. **Nothing mechanical stops Node-only code reaching the browser bundle.** A
   value import reachable from `domain/src/client` breaks the content bundle,
   and no check catches it before a build or harness run does. This is worth
   a structure-audit rule.
5. **Resolver coverage is authoring packets only.** It remembers inspect,
   navigate and reveal packets. Runtime-recovery packets (harness options) and
   failure-evidence packets are not included, which suits Flow Bootstrap. A
   repair-time plan would need them too.
