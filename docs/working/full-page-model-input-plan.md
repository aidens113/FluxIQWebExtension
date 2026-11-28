# Full Page Model Input Plan

Status: Active
Status detail: Planned and decided 2026-11-28 (V3 page input, starting node set, model-written messages). Phase 1 measured; phase 0 audit running. Next session: phase 2 (page input) and phase 3 (no look tools) in parallel, then phase 4.
Created: 2026-11-28
Last updated: 2026-11-28
Owner: Senior supervisor agent
Scope: Redo how the model sees and uses pages: the entire page every time with only markup syntax removed, no look tools, extraction of an element's whole hierarchy as data, node-based data processing separate from actions, chat text written for people, and an audit of extension logic in Core.
Paired document: none yet (Core gets one when phase 2 starts)
Related: [page-diff-delivery-plan.md](./page-diff-delivery-plan.md) (superseded in part: its page diffs, page budget, page window parts and full-page tool), [data-first-simplification-plan.md](./data-first-simplification-plan.md) (extraction and data layer rules this plan replaces), [ui-unification-plan.md](./ui-unification-plan.md) (statuses and UI text)

## Current State

- **The user's direction (2026-11-28), recorded in AGENTS.md:**
  1. "we need to feed the entire page to the model, no exceptions ... just remove dead characters ('<','/>',etc)" and "we tried saving tokens by reducing data, but actually just made things 10x more complicated for no reason. That ends today."
  2. "remove the look action entirely."
  3. "just extract the jsonify data straight from elements ... preserve all the element's given data."
  4. "data processing should be node-based just like normal operation, but its separated from the part of the flow that does actions & interacts with the client entirely."
  5. "an immediate audit needs to be done on whether the extension logic is being contaiminated into the core fluxiq repo."
  6. "EVERY SINGLE MESSAGE should be completely tailored towards the human! ... (NO EM DASHES)".
  7. The same day: "you should push back if any specific suggestions seem like they would add too much time or be more complicated in some way, just tell me what they are." Pushback is under Risks And Pushback.
- **Why.** The user's three manual runs on eldorado.gg (logs in `test-runs/manual-panel/`) failed in how the model is fed. A full page of 180,000 characters arrived in 10 parts, with hidden menus first. Handles went stale between views. Repeat calls were refused, and look calls were spent on asking for what was already there.
- **Done:** nothing built. The rules are in AGENTS.md (`0d8911be1`).
- **Running:**
  - t1099 (live statuses) is integrating;
  - t1101 (answer-first endings tests) is working.

  Neither depends on this plan. t1099's status words fall under phase 6's text rule.
- **Phase 1 measured (2026-11-28, `reports/phase-1-page-size.md`, real Chromium, 8 real pages, chars/3.5 tokens):**
  - V1 (everything) is 79k-570k tokens per page: eldorado 113k, BBC 110k, Remote OK 261k, discuss.python.org 176k, IKEA 444k, Nike 570k.
  - V2 (no script or style bodies) cuts 15-59%. V3 (also no SVG path data or base64) cuts a further 12% on eldorado and 53% on discourse. V4 (long classes) adds little.
  - Per decision on Sonnet 5.5: eldorado $0.26 at V1 and $0.19 at V3; big shop listings $0.92-1.18 at V1.
  - Haiku 5.5 is $0.065 at V1 on eldorado, but its price rises 5x above 100K prompt tokens (the claude-api skill's table), so V1 costs about 6x V3 on eldorado.
  - Pushback 1 holds. The report recommends V2 or V3 for D1. The user decides.
- **The user's decisions (2026-11-28, end of day):**
  - "your points 1 and 2 i agree with". So D1 is **V3**: every element, attribute and text node, without script and style bodies, SVG path data or base64 payloads. D6 is **the starting node set plus a safe expression node** on Core's existing graph engine.
  - On messages: "we can basically do like a wrapper where every time we call model we tell it to generate short msg for user explaining exactly whats happening. Rather than random core messages that dont make much sense." D7 is updated below; AGENTS.md records it.
- **Running at the end of 2026-11-28** (integrate next session if they finish after /clear):
  - phase 0 audit (report `reports/core-contamination-audit.md`);
  - t1099 integration checks (live statuses: rebuild, extension check, ui:e2e F1-F4 on everything-store, kestrel and bigbox harnesses), in its trees `fxwork/t1099`;
  - t1101 (answer-first endings tests, plus `caller-seams` and `keep`).
- **Phase 0 done (`reports/core-contamination-audit.md`):** 63 clusters in Core, of which 24 are web logic to move downstream, 27 generic mechanisms with web names or wording, and 12 fine.
  - **Worst:**
    - Core parses page addresses (`answer-first/rows/address-split.ts`, `page-word.ts`, `task-key.ts`, `scope-rule.ts`);
    - Core reads the extension's own paging words (`summaries/extraction-summary.ts`, `read-account/stop.ts`);
    - Core's Flow guidance teaches web authoring (`flow-script-format.ts`, `render-act.ts`);
    - the chat hard-codes browser verbs (`ui/activity-status/wording.ts`, ui-components `step/words.ts`);
    - the handle shape `[tde]\d` lives in Core (`reason-text.ts`);
    - public contracts carry web shapes (FluxNode spec `sites`, `task-result` `{site, pages}`, `server.set_active_tab`).
  - **Guards miss it:** `web-vocabulary` reads names, not strings, and skips ui-components; nothing bans `URL` parsing in Core.
  - **Proposed checks:** a ratcheted `web-text` rule, an `address-parsing` ban, a fixture rule, and zero web words in model guidance once it has moved.
  - **Order:** paging words, address parsing and the verb catalogue move first (independent of phase 2); view-channel names fold into phase 2.
  - **Needs the user:**
    - moving fingerprint DOM scoring and the `selector` element kind reverses t842 and Phase T;
    - the contract changes need a compatibility plan and notice before Core is edited.
- **Final plan (lead, 2026-11-28, after the user's decisions and the consultant's review; the user asked to be told the final plan):**
  1. **The page:** V3, the whole page every request (every element, attribute and text node, without script and style code, SVG path data or base64). One page per request. Short handles with a strict lifetime. **Not adopted** from the consultant: task-scoped views, inspection tools, and template-collapsed records, because they conflict with the user's rules and are the parts that failed.
  2. **No look tools.**
  3. **Several actions per call** (D8).
  4. **Extraction** of an element's whole hierarchy into a dataset. The model gets counts, a few samples and the exceptions, not every record (adopted from the consultant).
  5. **Node-based data processing** on Core's graph engine: the starting node set plus a safe expression node.
  6. **Model-written messages** for the person on every model call, with no em dashes.
  7. **The Core contamination audit's moves** (phase 0 is done): the checks first, then the 24 moves in the audit's order. The two items above need the user.
  8. **Real-site Lab tests,** each reviewed, measured by tokens and dollars per correctly completed workflow (the consultant's metric).
  9. **If real-site cost proves too high:** an A/B against a compact semantic projection on recorded workflows, decided on that number.
- **Next session, first:** confirm this final plan with the user, then brief phases 2, 3, 3b and 6.
- **Next session, in order:**
  1. Integrate t1099, t1101 and the phase 0 report: verify, merge, bump.
  2. Phase 2 (page input, V3), phase 3 (remove look tools) and phase 3b (several actions per call) in parallel: different files. Write briefs first.
  3. Phase 6 as the D7 wrapper, beside phase 2 once t1099 has merged.
  4. Phase 4 (element-hierarchy extraction) after phase 2; phase 5 (data graph) after phase 4.
  5. Phase 7: switch the Lab guards to real sites, then real-site runs reviewed by the lead, starting with the user's eldorado OSRS task.

## How It Works Today (the parts this plan changes)

- **Page capture.** The extension captures the tab's DOM. The web domain turns it into a compact text view:
  - one line per element, with a short handle (`t1234`), role, visible text and a few attributes;
  - hidden menus included.
- **Delivery.** Core's view channel (`runtime/llm/view-channel/`) sends:
  - the whole view of an address once per run, then only the changes;
  - within a page budget (about 20,000 characters per request);
  - in one trailing `core.page_window`.

  `core.full_page` returns the page in numbered parts.
- **Look tools offered to the model:** `web_detect_repeating_structure`, `web_describe_element`, `core_full_page`, and snapshot captures through `core.run_node`.
- **Reading data:** `dom-extract_list` needs a detected list, an item selector and named fields per row.
- **Processing:** `core_set_result_processing` holds one declaration over the result dataset (conditions, regex, dedupe, limit, columns). It is applied by the result feed and the data layer.
- **Chat text:** words come from Core's `runtime/automation-activity/wording/`, the conversations commands, and `@fluxiq/ui-components`. Some messages read like a bot, and some use em dashes.

## Decisions (lead's, within the user's direction; reversible)

- **D1. The page format** is the page's own DOM, with only markup syntax removed:
  - every element, its tag, every attribute, and every text node, in document order;
  - nesting shown by indentation;
  - each element carrying one short handle for actions and extraction.
  - It is not the compact view, not a summary, and not split into parts.
  - The model reads it as text, so a line looks like `div class="card" data-id="881" @t412` and then indented children. `<`, `>`, `</...>` and quote noise are dropped where unambiguous.
- **D2. Every decision request carries the current page whole.** Earlier pages are not repeated in later requests: their data lives in the results and datasets the steps produced. This keeps one page per request instead of a growing pile. Prompt caching covers the unchanged instructions and history.
- **D3. Handles stay** as the one way to point at an element: a short, stable attribute on each element line. Saved Flows keep using full fingerprints (the existing multi-signal identity), so replay does not depend on handles.
- **D4. No look tools at all.** Removed:
  - `web_detect_repeating_structure`;
  - `web_describe_element`;
  - `core_full_page`;
  - model-facing snapshot captures.

  Core still captures the page itself after every act. That is delivery, not a tool.
- **D5. One extraction tool.** `extract(element)` returns JSON for the element's whole subtree:
  - for each child, its tag, all attributes, its text, links and image sources, and its nested children;
  - no field picking and no selectors from the model.

  The dataset stores rows as the container's children, untouched. Paging stays an act (Next page, scroll), and the Flow repeats extract after it.
- **D6. Data processing is its own graph.** It is a data subgraph of pure nodes run by Core's existing graph engine, beside the action graph, never touching the client.
  - Starting node set: filter (conditions), extract-by-regex, derive or rename field, dedupe, sort, limit, group and count, join two datasets, branch on a condition, and an expression node in a safe expression language.
  - The model edits the data graph with tools.
  - The judge sees both the raw rows and the processed output.
- **D7. Messages are written by the model for the person** (user, 2026-11-28).
  - Every model call also returns a short message saying exactly what is happening, in plain first-person words for the person. The chat shows that message, in place of Core's canned step texts.
  - Core's own messages remain only where no model call is involved (a page loading, a humanness pause, a site's rate limit). Those are t1099's statuses, and they stay plain.
  - No internal codes. No em dashes: the instruction says so, and Core replaces any em dash the model writes.
  - A check fails the build when an em dash appears in Core's user-facing wording files.

- **D8. Several actions in one call** (user, 2026-11-28: "allow model to do multiple actions in a single call rather than having to always do only 1").
  - A decision may carry an ordered list of actions. Core runs them in order on the live page.
  - It stops at the first action that fails, or whose page no longer matches what the rest assumed (an element they name is gone, or the address changed).
  - It never runs past a lasting act that needs the person's permission; that act ends the batch.
  - The model then gets what ran, what was skipped and why, and the page as it now stands.
  - With the whole page in every request, fewer decisions is the biggest speed and cost win.

## Phases

### Phase 0: Core contamination audit (start now, read only)
- **What to list.** Every place in Core (`!FluxIQ/packages/**`) holding web or extension concepts, which AGENTS.md places downstream:
  - pages, handles, DOM, selectors, URLs and paging;
  - clicks, tabs, the browser, pagers, route reach;
  - page views and the page window;
  - web tool names.
- **For each one:**
  - **classify it:** generic and fine; web-shaped but harmless naming; or web logic that belongs in the domain;
  - **propose the move:** the port Core keeps and what moves downstream.
- Output: `full-page-model-input-plan/reports/core-contamination-audit.md`. One worker-heavy, read only.

### Phase 1: Measure before building (start now, provider-free)
- **On recorded pages,** measure the D1 format's size in characters and tokens: the eldorado runs plus three or four more real sites, and the ten scenario sites.
  - **Variants:** everything; with script and style bodies left out; with SVG path data and data URIs left out (see Risks).
- **Estimate per-decision cost and latency** on Haiku and Sonnet, with and without prompt caching.
- Output: a table in this document. It settles D1's exact rules and whether the pushback items hold.

### Phase 2: The page input
- **Downstream:** a DOM serializer in the domain (D1, D3), replacing the compact view builder.
- **Core:**
  - the view channel sends the current page whole every request (D2);
  - remove diffs, the page budget, page parts and `core.page_window`'s split logic;
  - the step log records the exact page sent.
- Tests on recorded pages; the provider-free harnesses must still pass 4 of 4.

### Phase 3: Remove the look tools
- Remove the D4 tools from the offered set, the guidance, the scripted model and the tests.
- The model text never mentions looking or describing.

### Phase 3b: Several actions per call (D8)
- **Core:** the decision may name a list of actions, run in order with the stop rules above. The step log records each action, and each saved Flow step stays one action.
- **Guidance:** batch actions that are known to follow (type, then press Enter; open a menu, then pick an item); act one at a time when the page must be seen in between.
- **Tests:**
  - a batch that runs fully;
  - one that stops at a failure;
  - one that stops at a page change;
  - one that stops at a permission question.
- Runs beside phase 2; it touches the decision loop, not the page input.

### Phase 4: Extraction of an element's hierarchy
- **Downstream:** `extract(element)` returns the subtree JSON (D5).
- **Core:**
  - datasets keep the raw rows;
  - the result feed reads them;
  - the Flow saves the container by fingerprint for replay.
- Replaces `dom-extract_list`'s fields and selectors. Migrate saved Flows or mark them for rebuild.

### Phase 5: Node-based data processing
- **Core:** the data subgraph (D6) on the existing graph engine; tools for the model to add, edit and run data nodes; dry runs on the stored rows.
- It replaces `core_set_result_processing`; its tests and judge evidence are updated.

### Phase 6: Chat text for people (the D7 wrapper)
- Every decision, judge and repair call gains a short `say` for the person: one field in each tool's input, generic in its instruction.
- The chat shows it as the step's text. Core's canned step and ending words are kept only for moments with no model call.
- Measure the extra output tokens on a recorded run.
- Then rewrite the canned messages left (moments with no model call) in plain words. Cover:
  - step entries, endings, errors and statuses;
  - permission questions;
  - the panel's chat.
- Add the em-dash check to `pnpm check` in both repositories. Review on screenshots.

### Phase 7: Real-site Lab tests with review (AGENTS.md, 2026-11-28)
- Change the Lab's launch guards from the ten scenarios to real sites.
- Define real-site tasks with the answers checked by hand where an oracle cannot be written, starting with the user's eldorado OSRS task.
- **Review every run:** its steps, the exact requests the model was sent, and the UI.

## Order And Parallel Lanes

- **Now:** phase 0 and phase 1 together, each read only or provider-free.
- **Then:** phase 2.
  - Phase 3 can run beside it: different files.
  - Phase 6 can run beside it: wording files only, after t1099 merges.
- **Phase 4 after phase 2:** extraction needs the new page and handles.
- **Phase 5 after phase 4's row shape is fixed,** though the node set can be designed in parallel.
- **Phase 7's guard change can start any time;** its runs come after phases 2 to 4.

## Consultant Input (2026-11-28, for the next session's discussion)

The user shared a consultant's review of the page input. Their thesis: build one deterministic "observation projector" over the full state FluxIQ keeps. It would produce:
- a compact, semantic, task-specific view;
- short references;
- repeated structures as records;
- scoped regions with inspection tools;
- current state plus meaningful changes;
- bulk data moved through FluxIQ instead of the model.

Their key metric is total tokens per correctly completed workflow, including retries and repairs.

**Where it agrees with the user's decisions, and is adopted:**
- **Short references, rich targeting kept inside FluxIQ.** Handles valid only for their lifetime, never recycled, scoped to a frame, and invalidated when the element is replaced. This is D3; it also answers today's stale-handle failures.
- **Bulk data passes through FluxIQ, not the model.** The model picks the extraction; FluxIQ runs it over the whole collection into a dataset and returns counts, a few samples and the exceptions. This fits phases 4 and 5 exactly: element-hierarchy extraction into a dataset, then the data graph. The model reads records only when a decision needs them.
- **Explicit coverage.** Three counts: records captured, records shown to the model, and the total the site reports. Never a silent cut. The user's rule and V3 already send the whole page; the dataset summaries should carry these counts.
- **Bounded history.** Current state, latest meaningful changes and a short action history, not a pile of old pages. This is D2.
- **Prompt caching as a separate optimisation.** Stable instructions and tools first, the page last. It is already the request order, so keep it.
- **Measure with real tokenizers and real models,** by tokens per correct completion, not characters.

**Where it conflicts with the user's decisions (the user decides; nothing is changed tonight):**
- **A compact, task-scoped view with inspection tools** (`find`, `inspect`, `inspectElement`). The user has ruled: "feed the entire page to the model, no exceptions" and "remove the look action entirely". The current system was a home-made version of this approach, and the user's runs failed in its seams: the page in parts with hidden menus first, look calls, stale handles.
- **Repeated structures collapsed into schema plus records.** It is lossless in principle, but it needs template inference, the kind of custom parser the user asked to drop. Under the user's plan, records come from extraction (phase 4), not from the page view.
- **Semantic normalisation** (accessibility names, flattened wrappers) versus V3's raw DOM minus code and blobs. An established format such as Playwright's accessibility snapshot is not a custom parser, but it drops attributes the user wants kept.

**The user's zoom idea (same evening):** "allowing hte model to do like a heriarchy view of things & zoom in and out of whatever elements it wants to, sort of like a human does when looking at elements on the browser inspect element. This might be already what the consultant talked about".
- It is the consultant's "overview plus inspect a region", and it is the alternative to the full page, not an addition to it.
  - If the whole page is in every request, zooming adds nothing: every element is already in front of the model.
  - Zooming only helps when the default view is collapsed. Then each zoom is another round trip to the model, like the look calls today's runs looped on.
- **Lead's view:** pick one.
  - The full page (V3) is simpler, matches the user's earlier ruling, and needs no zoom calls. Its nesting shows the hierarchy by indentation, so the model sees the tree as an inspector does, fully expanded.
  - The zoom design is the natural "compact projection" for item 9's A/B, if full-page cost proves too high on real sites.

**Lead's recommendation for the discussion:**
- Build the user's plan first (V3, no look tools, extraction into datasets, the data graph). It is the simplest design, and today's failures came from the moving parts the compact approach needs.
- Adopt the consultant's points that agree: references, bulk data through FluxIQ with summaries, coverage counts, bounded history, caching, the metric.
- If cost per completed workflow then proves too high on real sites, run the consultant's A/B on recorded workflows: V3 against a compact semantic projection, by tokens per correct completion. Decide on that number, not on opinion.

## Risks And Pushback

- **Pushback 1: "entire page, no exceptions" may be too big for some real sites.**
  - Removing `<`, `/>` and quotes barely shrinks a page. What makes real pages huge is not the markup characters but:
    - script and style bodies;
    - hydration JSON (whole app state embedded in the page);
    - inline SVG path data;
    - base64 images;
    - long utility class lists.
  - A heavy page like eldorado could be several hundred thousand tokens. Each decision could then cost about $0.30 to $1 on Sonnet, wait tens of seconds, and crowd the context.
  - **My suggestion:** keep every element, attribute and text node (the user's intent), but drop the bodies of `script` and `style`, SVG path data and base64 payloads. None of those is page content. Phase 1 measures it so the user can decide on numbers.
  - If the user still wants literally everything, it is built that way. The cost and speed are then known up front.
- **Pushback 2: "any type of logical flow node" for data processing.**
  - A full node language is a large build, and running arbitrary code from a model is a security risk on a hosted product.
  - **My suggestion:** start with the D6 node set plus a safe expression node, built on Core's existing graph engine. That covers filtering, regex, reshaping, joins and branching without a new engine or code execution. Add nodes as tasks need them.
- **Pushback 3: rewriting every message at once.** Settled by the user's wrapper idea (D7).
  - Hundreds of strings live in Core and the extension.
  - **My suggestion:** do the messages a person sees on every run first: steps, statuses, endings and errors. Add the em-dash check so nothing new slips in, then sweep the rest.
- **Not pushback, but cost to know:** whole-page input raises the cost of every run several times. The paid round's remaining $16.80 will go faster, and Haiku versus Sonnet matters more.
- **Replay identity:** handles are per page, so saved Flows must keep using fingerprints (D3), or replays break.
- **Migration:** saved Flows that use `dom-extract_list` fields need a rebuild path (phase 4).
- **Lists not in one container** (virtualized or split tables) are rare. Extraction can take more than one element if needed.

## Validation

- **Every phase:** narrow checks per the repository rules; Core `pnpm check`; both structure audits; provider-free harnesses 4 of 4 where behaviour changes.
- **Phase 2 and on:** the step log shows the exact page sent; review it on a real-site run.
- **Phase 7:** real-site runs reviewed by the lead, with the runs, costs and model inputs recorded here.

## Work Ledger

### 2026-11-28 - Planned on the user's instruction
- Changed:
  - AGENTS.md: six new rules in the user's words (`0d8911be1`);
  - this document.
- Validation: not validated: plan only. Phase 0 dispatched read-only the same day.
- Follow-up: phase 0 and phase 1 reports, then phase 2.
