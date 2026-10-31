// The web-only evidence this domain binds into Core's domain-neutral LLM
// harness, and the post-failure capture the runtime diagnosis path calls.
//
// **There used to be five tools here, and they were the wrong five.** Inspect,
// navigate, press, enter-field and detect were verbs invented for exploring,
// while the Flow a build wrote was made of the registry's own output nodes. Two
// vocabularies for one job, so what a build proved while exploring was never
// what shipped, and a node could enter a Flow having never once run. The user's
// instruction on 2026-09-22 was to delete the split: the exploratory output is
// to be the same nodes with the same parameters, so a Flow can be assembled
// from steps that provably worked.
//
// So this domain now declares `runsNodes`, and Core offers the library itself
// as one option (`AS/runtime/llm/node-tools/`): the call names a node of the
// registry and carries that node's own parameters, and `./node-run/` resolves
// the handles through the same resolver the finished Flow's parameters go
// through and dispatches the same gateway command the finished Flow dispatches.
// Four of the five verbs are gone -- a press is `web.dom.click`, an entry is
// `web.dom.type` or `web.dom.select`, a move is `web.browser.navigate`, a look
// is `web.dom.capture_snapshot`.
//
// **Detection stays**, and it is the one thing here that is not a node. An
// extraction node cannot be written without the opaque handle it issues, and
// finding a list is an observation about the page rather than a step of any
// Flow (`structure/`).
//
// Everything returned is a sanitized packet; everything refused returns a code
// and one closed reason for it, and nothing of the page beyond what a packet
// already shows (`./tool-rejection.ts`). Nothing is refused on FluxIQ's own
// judgement of what a control looks like: the model declares what its own call
// would lastingly do and Core's gate answers from the person's instruction and
// permission (`./permission.ts`).

import type { FluxIQ } from "fluxiq";
import type { WebAutomationLlmEvidenceRuntime } from "./runtime-contract";
import { AUTOMATION_STUDIO_ACTION_CONSEQUENCES } from "fluxiq/automation-studio";
import type { JsonObject, JsonValue } from "fluxiq/core";
import { WEB_AUTOMATION_DOMAIN_ID } from "../../constants";
import { isEligibleWebSession } from "../web-sessions";
import { WEB_AUTOMATION_STRUCTURE_DETECTION_CAPABILITY_ID } from "../capabilities";
import {
  assertActive,
  captureEvidence,
  pageRefusal,
  selectSession,
  toolExecution,
  toolMetadata,
  type WebLlmEvidenceGateway,
  withCallStates,
  withPersonNeeded,
  type WebLlmEvidenceToolExecution,
  type WebLlmEvidenceToolRequest
} from "./capture";
import {
  webAutomationExplorationRefusalClassifier,
  webAutomationRecoveryHarnessOptionBundle
} from "./harness-options";
import { WEB_LLM_DENIED_EVIDENCE_KEYS } from "./denied-keys";
import { WEB_LLM_VIEW_KEYS } from "./observed-state";
import { WEB_LLM_SYSTEM_INSTRUCTIONS } from "./system-instructions";
import { WEB_FLOW_SCRIPT_EXAMPLES } from "./script-examples";
import { evidenceLocation, safeEvidenceUrl } from "./location";
import { createWebNodeArrivals, createWebNodeHeldLiterals, createWebNodeOwnLayers, createWebNodeShownAddresses, runWebOutputNode, webLlmCallWords, webObservationNodeId, webRunnableNode, webRunnableNodeIds, WEB_NAVIGATION_ACTION } from "./node-run";
import {
  createWebLlmTargetPackets,
  resolveWebPlanNodeParameters,
  webLlmPacketTargets,
  WEB_LLM_ROW_CONTEXT_KEYS
} from "./plan-resolution";
import { runWebDescribeElement, runWebFindOnPage } from "./page-find";
import { publishedWebLlmPage, webLlmPageRetentionKey, webLlmResultRetentionKey } from "./page-view";
import { present } from "./present";
import { observeWebLlmResult } from "./result-observation";
import { observeWebStartState } from "./start-state";
import { webLlmClearedControlHandles } from "./way-out-handles";
import { createWebAutomationClearedWayOuts, webAutomationBuildStateSource, webAutomationClearedWayOutsOf, type WebAutomationClearedWayOuts } from "../../cleared-way-outs";
import { createWebNodeBuildStatePersistence, webNodeBuildOf, webNodeBuildSlot, type WebNodeBuildStateSource } from "./node-run/build-state";
import { webFailureRepairParameters } from "./repairable-parameters";
import { webLlmTargetsUnchanged } from "./target";
import { canonicalWebLlmTargetHandle } from "./handle-spelling";
import { createWebLlmStableTargetHandles, WEB_LLM_TARGET_HANDLE_PATTERN } from "./stable-handles";
import {
  createWebLlmExtractionHandles,
  detectRepeatingStructure
} from "./structure";
import {
  sanitizeWebLlmSnapshotWithBindings,
  WEB_LLM_EVIDENCE_SCHEMA_VERSION,
  type WebLlmPageEvidence,
  type WebLlmSanitizeOptions,
  type WebLlmSnapshotBinding
} from "./sanitize";
import { projectWebRepairCandidates, validateWebRuntimeTargetOverrideEvidence } from "./target";
import { createWebLlmRepeatedRefusals } from "./repeated-refusal";
import { recoverable, RecoverableToolRejection, rejectionDetail, toolRejection } from "./tool-rejection";
import { boundedIdentifier, jsonRecord } from "./untrusted-json";
import { createWebNodeFrozenExecution, webNodeFinalGateway } from "./node-run/frozen-execution";
import {
  webLlmToolRejectionResultCode,
  WEB_LLM_DETECT_STRUCTURE_TOOL_ID,
  WEB_LLM_FIND_ON_PAGE_TOOL_ID,
  WEB_LLM_DESCRIBE_ELEMENT_TOOL_ID,
  WEB_LLM_RUN_NODE_TOOL_ID
} from "./vocabulary";

export type { WebAutomationLlmEvidenceRuntime, WebLlmFailureEvidenceRequest, WebLlmStateDigestRequest } from "./runtime-contract";

// A handle the authoring tools issue: numbered for the whole Flow, so up to six
// digits (`./stable-handles.ts`), and read in either spelling, `tN` or `target.N`.
const TARGET_HANDLE_PATTERN = WEB_LLM_TARGET_HANDLE_PATTERN;

/**
 * How many shown pages' structured packets are kept so a later repair can check
 * the handle it names against the elements the model was shown, and put the
 * selector hint back. Small on purpose: this is a convenience for the
 * in-flight diagnosis, not a store. Failure pages get a window of their own:
 * the target check always needs the failure page, while an exploration returns
 * any number of pages and Core carries only the newest to the repair, so the
 * oldest explored one is the one to let go.
 *
 * Since t223 the model reads a page as the compact view, which has no element
 * objects to check a handle against, so a page that was let go cannot be
 * checked at all and is refused as unrecognized rather than guessed at. The
 * window was 8 while a let-go packet still resolved on its own fingerprint; it
 * is now Core's default exploration budget of 24 actions
 * (`AS/runtime/recovery/exploration-budget.ts`), so a recovery of default
 * length can name a handle from any page it was shown.
 */
const RETAINED_SHOWN_PACKETS = 24;

export function createWebAutomationLlmEvidenceRuntime(
  sessions: WebLlmEvidenceGateway,
  clearedWayOuts: WebAutomationClearedWayOuts = createWebAutomationClearedWayOuts(),
  // Core's durable build state, where each build's memories are written through
  // (`./node-run/build-state/`, t728). None: they live in this process alone.
  buildState: WebNodeBuildStateSource = () => undefined
): WebAutomationLlmEvidenceRuntime {
  // Every command a build sends goes out through this gateway, so a click or a
  // navigation the model runs carries the same room to wait out a robot check
  // that clears by itself as the Flow's own (`actions/check-wait.ts`).
  const gateway = webNodeFinalGateway(sessions);
  const frozenExecution = createWebNodeFrozenExecution();
  // Which node one free look runs, read from this domain's own definitions
  // rather than named here (`./node-run/catalog.ts`).
  const observationNode = webObservationNodeId();
  const arrivalNode = webRunnableNodeIds().find((id) => webRunnableNode(id)?.actionType === WEB_NAVIGATION_ACTION);
  const returnedEvidence = new Map<string, WebLlmSnapshotBinding>();
  const extractionHandles = createWebLlmExtractionHandles();
  const targetPackets = createWebLlmTargetPackets();
  // A handle keeps naming the control it named across recaptures of one page
  // (see ./stable-handles.ts). Every authoring capture goes through it, including
  // the ones the model is not shown, so a press's before-and-after comparison
  // and its target binding read the same numbering as the packet.
  const stableHandles = createWebLlmStableTargetHandles();
  // What this runtime last refused each (build, tool) with, so an answer that
  // repeats says so instead of arriving as a new one (`./repeated-refusal.ts`).
  const repeatedRefusals = createWebLlmRepeatedRefusals();
  // Each build is the one Core frames the call with (`./node-run/build-state/`),
  // and every memory below is written through to Core's store as it changes.
  const persistence = createWebNodeBuildStatePersistence(buildState);
  // Whether each build told a start location has navigated there yet, so a tab
  // that was already open does not count as arrival (`./node-run/arrival.ts`).
  const arrivals = createWebNodeArrivals(persistence);
  // Where each build has been shown it can go, which is where it may navigate
  // (`./node-run/shown-addresses.ts`). Fed from every packet shown, below.
  const addresses = createWebNodeShownAddresses(persistence);
  // Which layers a press of each build opened, so closing one is a step of the
  // Flow and not an interruption (`./node-run/own-layers/memory.ts`).
  const layers = createWebNodeOwnLayers(persistence);
  // What the Flow each continuing round holds, which a rerun keeps without the model writing it (`./node-run/held-literals/`).
  const held = createWebNodeHeldLiterals(persistence);
  const stable = (request: WebLlmEvidenceToolRequest, binding: WebLlmSnapshotBinding): WebLlmSnapshotBinding =>
    stableHandles.restamp({ projectId: request.projectId, flowId: request.flowId }, binding);
  // Every packet an authoring tool shows the model: kept for the next repair
  // (`retain`), for the next press or detection, and for resolving the plan.
  const shown = (input: WebLlmEvidenceToolRequest, sessionId: string, snapshot: WebLlmSnapshotBinding): void => {
    returnedEvidence.set(evidenceScope(input, sessionId), snapshot);
    targetPackets.remember({ projectId: input.projectId, flowId: input.flowId }, snapshot);
    addresses.saw(webNodeBuildOf(input).build, snapshot);
  };
  // The look a node run takes before it acts, which the model is not shown. Cut
  // short, its controls join the page's handles without forgetting any the
  // model was shown; it is never the packet a detection binds its handles through.
  const looked = (input: WebLlmEvidenceToolRequest, snapshot: WebLlmSnapshotBinding): void => {
    targetPackets.rememberLook({ projectId: input.projectId, flowId: input.flowId }, snapshot);
    addresses.saw(webNodeBuildOf(input).build, snapshot);
  };
  // Keyed by the page as the model read it (`./page-view/retention-key.ts`),
  // because Core hands that page back to `validateTargetOverrideEvidence`
  // without the project or flow it came from, and the page has no elements of
  // its own to check a handle against.
  const failurePackets = new Map<string, WebLlmSnapshotBinding>();
  const toolPackets = new Map<string, WebLlmSnapshotBinding>();
  // `shownAs` is the result the model read the packet through when it was not
  // the page itself -- a search's matches or one element's description -- so
  // a repair naming a handle from it finds the packet behind it.
  const retainIn = (window: Map<string, WebLlmSnapshotBinding>) => (binding: WebLlmSnapshotBinding, shownAs?: JsonObject): WebLlmSnapshotBinding => {
    keepNewest(window, webLlmResultRetentionKey(shownAs) ?? webLlmPageRetentionKey(publishedWebLlmPage(binding.evidence)), binding);
    return binding;
  };
  const retain = retainIn(toolPackets);
  const retainFailure = retainIn(failurePackets);
  // The structured packet behind a page, search or description as the model read it. Equal keys describe equal pages, so a packet from either window fits.
  const retainedFor = (evidence: JsonObject): WebLlmSnapshotBinding | undefined => {
    const key = webLlmResultRetentionKey(evidence);
    return key === undefined ? undefined : failurePackets.get(key) ?? toolPackets.get(key);
  };
  return {
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    observeResult: (input) => observeWebLlmResult(
      (request) => captureEvidence(gateway, selectSession(gateway.eligibleSessionIds()),
        { ...request, toolId: "web.result_observation", value: {} }, request.signal, undefined, { includeHidden: true }), input),
    clearedControlHandles: webLlmClearedControlHandles({ wayOuts: clearedWayOuts, stable: (scope, binding) => stableHandles.restamp(scope, binding), remember: (scope, binding) => targetPackets.rememberLook(scope, binding) }),
    // The page a build began on and what differs from it now (t462): the same
    // passive capture, so nothing is restamped, retained or shown.
    startState: (input) => observeWebStartState(
      (request) => captureEvidence(gateway, selectSession(gateway.eligibleSessionIds()),
        { ...request, toolId: "web.start_state", value: {} }, request.signal, undefined, { includeHidden: true }), input),
    // Declared once, in `./denied-keys.ts`, because what a reading node read
    // is held to the same list before it is ever returned.
    deniedEvidenceKeys: WEB_LLM_DENIED_EVIDENCE_KEYS,
    // The page and a read's rows, each replaced only by a newer one of its kind (`./observed-state/`).
    observedStateKeys: WEB_LLM_VIEW_KEYS,
    // A live read's kept rows, so a repair's rerun of a blamed read is compared
    // with the rows Core's check named, not only a replay's (R3-3, live run `run-mux6naez-6c20f26e`).
    readRowsKey: "read.extracted",
    // The card a press was built on, which a repeat replaces with each kept row (`./plan-resolution/row-context-keys.ts`).
    rowContextKeys: WEB_LLM_ROW_CONTEXT_KEYS,
    // Placed by Core in the system message of every model request (t237).
    systemInstructions: WEB_LLM_SYSTEM_INSTRUCTIONS,
    flowScriptExamples: WEB_FLOW_SCRIPT_EXAMPLES,
    // The options a runtime recovery may explore with, declared in full so
    // they carry their own availability, safety and stages and never reach
    // Flow authoring. `same_scope` is the safe default and matches what the
    // authoring `navigate` tool below already enforces; a per-run allowlist
    // is per-exploration, so threading one needs the coordinator, not this
    // line.
    harnessOptions: webAutomationRecoveryHarnessOptionBundle({ gateway, scopePolicy: { kind: "same_scope" }, retainSelectors: retain, extractionHandles }),
    // How Core reads a refusal without learning any of this domain's result
    // codes.
    classifyRefusal: webAutomationExplorationRefusalClassifier,
    // The chat's words for each call: the control a handle names, and what is typed or looked for.
    describeCall: (input) => webLlmCallWords(input, (scope, handle) => targetPackets.resolve(scope, handle, undefined)),
    // Detection alone. Everything else a build does is a node of the library,
    // which Core offers because Core is what enumerates the registry; this
    // domain says it can run one (`runsNodes`) and runs whichever the call
    // names (`./node-run/`).
    //
    // **The description below is held to 2,000 characters by Core**, and a
    // longer one is refused outright rather than cut
    // (`harness_option.description_invalid`, `harness-options/option.ts`). The
    // read-list redesign (S4) took the `paginate` sentences out: a read reads one
    // page and a `paginate` is refused `paginate_retired`, so `pagination` only
    // says how the list continues, and every page is Next page on the same
    // handle with a repeat. The paired bound is Core's 700 characters for a node
    // parameter description, which `extract-list/catalog-text.ts` sits at.
    //
    // **A condition may name a column the plan does not keep, and the text says
    // so** (t194 w36). Live run `run-muq4oaof-464f5bce` kept `plus` and `ad` in
    // `fields` only to write `plus present` and `ad absent`; the stored answer
    // had six columns where four were asked, and the judge paired no row though
    // every asked value was right. The resolver had always taken a detected key
    // the plan does not keep (`plan-resolution/extraction/conditions.ts`); the
    // model was never told.
    //
    // **Rows a repeat presses are narrowed by the read's where (t378).** Lane
    // D's build (`run-mv0fuual-f9e6f089`) took "narrow excess later" as leave
    // to filter at the end of the run, which never changes the rows a repeat
    // visits, and confirmed all eight requests where four were asked. The
    // clause fitted inside the 2,000 the paging sentences returned.
    //
    // **What a condition may say is Core's one text (t478).** Lane D round 11
    // (`run-mv5yaapw-6d20d23d`) wrote a listing's `where` while its looks were
    // withdrawn, and wrote a digit pattern for "five or more". The rules now ride
    // on the submission's flow format (`core.submit_candidate`, `core.submit_subflow`),
    // which no withdrawal touches.
    //
    // **This points at those rules and never repeats them (R791).** It said them
    // whole until t790 gave them the date bound: at 1,334 characters they took
    // this description to 2,641, Core refused it as the registry was built, and
    // every build ended `pre_provider_validation_failed` before its first turn.
    // The detection is offered only where a submission is (a recovery explores
    // with its own options, `recovery/annotation/exploration.ts`), so the rules
    // are always beside it; the keys named here are what makes the model look,
    // and the date bound is named because a read runs before any submission.
    tools: [
      {
        toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID,
        description: "Detect a repeating list or table around target handle, else the page's largest list. Returns extraction handle, field keys/labels/kinds/coverage, item count, pagination and paginationBound. Observes only, never a step of the Flow. Run the extraction node with extractList: {handle, fields?: {yourKey: \"fieldKey\" | \"fieldKey@attr\"}, where?: [{field: \"fieldKey\", is: \"absent\"}], minItems?: 0}. The read reads the page shown. pagination says how the list continues: every page is Next page on the same handle (nextPage: {list: handle}) after the read, with repeat on the read through it. Narrow the page first for a partial list; minItems: 0 allows no rows. where is optional: leave it out and every item is a row, the right first attempt when unsure; narrow excess later. But rows a later step acts on, a press repeated over the read, are narrowed here by where: a condition saved with the answer never changes which rows a repeat visits. Every condition must hold and names a detected column, never guessed item text. It may name a column fields does not keep: keep only the columns asked for, never a mark used only to filter. What a condition may say is the where rules in the submission's flow format: is present or absent, a bound on a number (atLeast, atMost, lessThan, greaterThan, equals) or on a date written as text with \"as\": \"date\" (or relative: \"7 days ago\", today), within: \"<n> days\" (or minutes, hours, weeks) up to now, or a text test. A quantity or a date is always compared with a bound, never a pattern. If conditions reject every item, the node returns what it read and says so in its report. Lists mix ads with results: coverage below 1 often marks ads, excluded with is: \"absent\".",
        inputSchema: { type: "object", properties: { target: { type: "string", pattern: TARGET_HANDLE_PATTERN } }, additionalProperties: false },
        effect: "observe",
      },
      // The page view's other half (t223): the page is shown as one line per
      // element with visible words or a control, and this finds the rest.
      // Held to Core's 2,000 characters like the description above.
      {
        toolId: WEB_LLM_FIND_ON_PAGE_TOOL_ID,
        description: "Reads only the page you are on, and is not the site's search (the site's own search is a field[search] line). Search this page for any words or attribute, and get every element that matches. The page you are shown is one line per element that has visible words or is a control, in page order: its handle (tN, copied exactly to act on it), its kind (link, button, field, select, checkbox, img, h2, ...), its words in quotes, and its state (=\"value\", checked, open, disabled, covered-by). A link's address follows it, ~ standing for the base the URL line names, and lines such as [main], - 3/16 (an item of a list) and --- below the fold --- say where things are. Everything else -- a closed menu's items, a collapsed panel, an icon with no words, text off screen, an id, class, name, test id, placeholder or any other attribute -- is found here: query is matched, ignoring case, against every element's words, label, value, options and address and every attribute's name and value, hidden elements included. Each match is one line: handle, kind, words, the attribute that matched when the words did not, and where it is (on screen, above, below, off-page, not rendered). Fifty matches to a page, in page order; the last line says how to ask for the next fifty with after. After the exact matches come up to ten close ones, marked near: elements holding most or part of the query's words but not as written, each saying which words it lacks (a shorter name lacking a size is often the item, with the size as an option control). Observes only, and is never a step of the Flow.",
        inputSchema: {
          type: "object",
          properties: { query: { type: "string", minLength: 1, maxLength: 200 }, after: { type: "integer", minimum: 0 } },
          required: ["query"],
          additionalProperties: false
        },
        effect: "observe",
      },
      {
        toolId: WEB_LLM_DESCRIBE_ELEMENT_TOOL_ID,
        description: "Everything the page holds about one element, named by the handle a page line or a find_on_page match printed (tN, copied exactly): its line, every attribute whole (id, class, name, test id, aria-*, ...), its box and where that is, and every other field the capture keeps (role, label, value, options, the list item or table cell it sits in, what covers it, ...). Use it when a line is not enough to tell two alike elements apart or to see why a control behaves as it does. Hidden elements a search found can be described too. Observes only, and is never a step of the Flow.",
        inputSchema: { type: "object", properties: { target: { type: "string", pattern: TARGET_HANDLE_PATTERN } }, required: ["target"], additionalProperties: false },
        effect: "observe",
      },
    ],
    // One free look before the first paid decision, so the model's first
    // question is asked with the page already in front of it. The argument is
    // this domain's, not the model's, which is what makes it safe to take.
    // The library this domain answers for, and one free look before the first
    // paid decision so the model's first question is asked with the page
    // already in front of it. The look's argument is this domain's, not the
    // model's, which is what makes it safe to take. `runnable` is said on both
    // paths: a domain that offered no observation node still runs only these.
    // `arrival` is the node that moves the page, found by what it runs rather
    // than by name, and its `url` parameter: Core writes a build's start
    // location into it for the build's opening call.
    runsNodes: present<NonNullable<WebAutomationLlmEvidenceRuntime["runsNodes"]>>({
      initial: observationNode ? { node: observationNode, parameters: {}, consequences: [] } : undefined,
      arrival: arrivalNode ? { node: arrivalNode, parameter: "url" } : undefined,
      runnable: webRunnableNodeIds()
    }),
    // Every call below reports the states it saw from its own captures
    // (`./capture.ts`, `withCallStates`), which is what makes this true.
    stateDigestsOnCalls: true,
    async executeTool(input) {
      assertActive(input.signal);
      boundedIdentifier(input.projectId, "projectId");
      boundedIdentifier(input.flowId, "flowId");
      boundedIdentifier(input.callId, "callId");
      const sessionId = selectSession(gateway.eligibleSessionIds());
      // The build Core frames this call with, and whether the call opens a round of it (`./node-run/build-state/`, t728).
      const { build, opening } = webNodeBuildOf(input);
      // A new exploration's model has been told nothing yet, so no answer it
      // gets repeats one an earlier exploration's model got (`./repeated-refusal.ts`).
      // Every round opens with Core's opening call, fresh or continuing, scoped or not.
      if (opening !== undefined) repeatedRefusals.startedOver(webNodeBuildSlot(build));
      // A host restarted mid-build reads the build's memories back before any of them is consulted.
      await Promise.all([arrivals.restore(build), addresses.restore(build), layers.restore(build), held.restore(build)]);
      // Every way out of this call goes through here, because a refusal is
      // returned on one path and thrown on another: `node-run/run.ts` catches
      // its own and answers with it, while a detection and the resolver throw
      // past to the block below. A repeat that was only noticed on one of the
      // two would miss whichever half the next build spent itself on.
      //
      // It is also where the model reads every answer, so what the answer
      // printed -- a search's matches, a description, a node run's answer, a
      // detection's column `at` -- is what a candidate may name from it
      // (`./plan-resolution/target-packets.ts` `printed`, t378 W13). A refusal
      // hands back the handle the call named, which that does not print.
      const answered = (answer: WebLlmEvidenceToolExecution): WebLlmEvidenceToolExecution => {
        targetPackets.printed({ projectId: input.projectId, flowId: input.flowId }, answer.evidence, answer.resultReason === undefined ? undefined : input.value);
        return repeatedRefusals.answered(webNodeBuildSlot(build), input.toolId, answer);
      };
      // The page a detection read the state in, kept here because a detection
      // refuses by throwing, past the result it would have carried it on. A
      // node run reports its own states (`./node-run/run.ts`).
      let observed: WebLlmSnapshotBinding | undefined;
      try {
        if (input.toolId === WEB_LLM_RUN_NODE_TOOL_ID) {
          return answered(await runWebOutputNode({
            gateway,
            sessionId,
            request: input,
            stores: { targets: targetPackets, extractions: extractionHandles },
            restamp: (binding) => retain(stable(input, binding)),
            shown: (binding) => shown(input, sessionId, binding),
            looked: (binding) => looked(input, binding),
            arrivals,
            addresses,
            layers,
            held,
            frozenExecution
          }));
        }
        if (input.toolId === WEB_LLM_DETECT_STRUCTURE_TOOL_ID) {
          const detected = await detectRepeatingStructure({
            gateway,
            sessionId,
            request: input,
            returned: returnedEvidence.get(evidenceScope(input, sessionId)),
            handles: extractionHandles,
            restamp: (page) => stable(input, page), // A stale handle's refusal names the element's current handle as shown (`./structure/detect.ts`, t477).
            observed: (page) => { observed = page; },
          });
          // It only observes, so the state it found is the state it left.
          return answered(withCallStates(detected, observed, observed));
        }
        if (input.toolId === WEB_LLM_FIND_ON_PAGE_TOOL_ID) {
          // A search's capture is restamped and kept as a look, so a handle it
          // prints is one a press binds (`./page-find/`).
          return answered(await runWebFindOnPage({
            gateway,
            sessionId,
            request: input,
            restamp: (binding) => retain(stable(input, binding)),
            looked: (binding) => looked(input, binding)
          }));
        }
        if (input.toolId === WEB_LLM_DESCRIBE_ELEMENT_TOOL_ID) {
          return answered(await runWebDescribeElement({
            gateway,
            sessionId,
            request: input,
            restamp: (binding) => retain(stable(input, binding)),
            looked: (binding) => looked(input, binding)
          }));
        }
        throw new Error("web evidence tool is not registered");
      } catch (error) {
        if (error instanceof RecoverableToolRejection) {
          // A refusal the page caused carries the page: it is shown like any
          // other packet, so the handles on it -- the dialog's close button --
          // can be pressed next.
          const page = error.page === undefined ? undefined : retain(stable(input, error.page));
          if (page !== undefined) shown(input, sessionId, page);
          const refused = withCallStates(
            toolExecution(toolRejection(error.code, page?.evidence, error.detail), false, webLlmToolRejectionResultCode(error.code), undefined, undefined, undefined, error.failure, error.actionability),
            observed ?? page,
            page ?? observed
          );
          // A detection that met a robot check only looked, so it proposes
          // nothing: Core asks the person, and the model then looks afresh.
          return answered(error.personNeeded ? withPersonNeeded(refused, undefined) : refused);
        }
        throw error;
      } finally {
        // What this call changed in the build's memories is in Core's store before its answer is (never rejects).
        await persistence.settled();
      }
    },
    async captureStateDigest(input) {
      assertActive(input.signal);
      boundedIdentifier(input.projectId, "projectId");
      boundedIdentifier(input.flowId, "flowId");
      boundedIdentifier(input.callId, "callId");
      const sessionId = selectSession(gateway.eligibleSessionIds());
      // A fresh capture, sanitized by the one path every packet goes through,
      // and then thrown away. It is deliberately not `retain`ed and not `shown`:
      // no model is ever given it, no handle it issues is ever resolvable, and
      // letting it into the packet windows would age out a packet the model
      // does read. No expected origin either -- an exploration action may
      // legitimately move the page, and this has to describe wherever it landed.
      const request = present<WebLlmEvidenceToolRequest>({
        referenceNow: undefined,
        projectId: input.projectId,
        flowId: input.flowId,
        callId: input.callId,
        toolId: input.toolId,
        value: {},
        permission: undefined,
        startLocation: input.startLocation,
        signal: input.signal,
      });
      // A build that was told where its Flow starts has had nothing opened for
      // it, so the state before its first step is no state at all. Answering
      // "nothing" leaves that step undigested, which the reduction reports;
      // throwing would make the step that goes there a recorded failure of
      // every such build, before the Flow had done anything wrong
      // (`AS/runtime/llm/evidence-loop.ts`: a hook that throws fails the step).
      //
      // The digest is the one every capture carries (`./state-digest/snapshot-states.ts`),
      // so what this answers and what a call reports on `stateDigests` for the
      // same page are one value by construction.
      //
      // A page behind a robot check is not a state anyone can read either, and
      // it is the person's to clear (`./capture.ts`), so it answers "nothing"
      // rather than failing the step it was asked about.
      try {
        return (await captureEvidence(gateway, sessionId, request, input.signal)).stateDigest;
      } catch (error) {
        if (error instanceof RecoverableToolRejection && error.personNeeded) return undefined;
        if (input.startLocation !== undefined && error instanceof RecoverableToolRejection && error.code === "page_unreadable") return undefined;
        throw error;
      }
    },
    async captureSanitizedFailureEvidence(input) {
      assertActive(input.signal);
      boundedIdentifier(input.projectId, "projectId");
      boundedIdentifier(input.flowId, "flowId");
      boundedIdentifier(input.runId, "runId");
      boundedIdentifier(input.failedAction.attemptId, "failedAction.attemptId");
      boundedIdentifier(input.failedAction.nodeId, "failedAction.nodeId");
      boundedIdentifier(input.failedAction.definitionId, "failedAction.definitionId");
      const sessionId = selectSession(gateway.eligibleSessionIds());
      const result = await gateway.executeAction(sessionId, {
        actionType: "web.dom.capture_snapshot",
        parameters: {},
        metadata: {
          source: "llm-runtime-failure-evidence",
          domainId: WEB_AUTOMATION_DOMAIN_ID,
          projectId: input.projectId,
          flowId: input.flowId,
          runId: input.runId,
          attemptId: input.failedAction.attemptId,
          nodeId: input.failedAction.nodeId,
          definitionId: input.failedAction.definitionId,
        },
      });
      assertActive(input.signal);
      if (result.status !== "succeeded") throw new Error("web failure evidence snapshot capture failed");
      const payload = jsonRecord(result.payload, "web failure evidence action payload");
      // The whole page, as every packet is: a failure packet is no longer held
      // to a byte gate of its own (t200). It leaves as the compact view every
      // page leaves as (t223); the structured packet is retained under that
      // view's key, so the repair's target check reads the elements behind it.
      const binding = sanitizeWebLlmSnapshotWithBindings(payload.snapshot, present<WebLlmSanitizeOptions>({
        expectedOrigin: undefined,
        // Core's failed-action identity is an attempt, a node and a definition
        // id, and carries nothing about the control -- so this recapture marks
        // no target and says `failedTargetUnknown` rather than leaving the
        // model to read the silence as "the target is still there". What it
        // does carry is enough to name the parameters a repair fills, which
        // Core tells the model to fill from this packet; without them a correct
        // live repair was refused for guessing the key.
        failedAction: { repairParameters: webFailureRepairParameters({ definitionId: input.failedAction.definitionId }) },
      }));
      binding.evidence.repairCandidates = projectWebRepairCandidates(binding.evidence.elements, { definitionId: input.failedAction.definitionId });
      return publishedWebLlmPage(retainFailure(binding).evidence);
    },
    validateTargetOverrideEvidence(evidence, target, failedAction) {
      // A structured packet, as this domain handed them out before t223: its
      // own elements are what the handle is checked against, with no selector
      // hint, since no packet of that shape is retained any more.
      if (evidence.schemaVersion === WEB_LLM_EVIDENCE_SCHEMA_VERSION && Array.isArray(evidence.elements)) {
        return validateWebRuntimeTargetOverrideEvidence(evidence as WebLlmPageEvidence, target, failedAction, undefined);
      }
      // A page, search or description as the model read it. Judged before the
      // target: one this runtime did not retain is not one it can check,
      // whatever handles its text prints.
      const retained = retainedFor(evidence);
      if (retained === undefined) return { status: "absent", reason: "evidence_unrecognized" };
      return validateWebRuntimeTargetOverrideEvidence(retained.evidence, target, failedAction, retained.selectors, retained.drawings);
    },
    resolveExtractionHandle(input) {
      return extractionHandles.resolve({ projectId: input.projectId, flowId: input.flowId }, input.handle);
    },
    resolvePlanNodeParameters(input) {
      if (input.handleEvidence === undefined) return resolveWebPlanNodeParameters(input, { targets: targetPackets, extractions: extractionHandles });
      // A repair's step, from the one packet its model was shown (t429). A
      // packet this runtime did not keep -- let go, edited, or never issued --
      // gives its handles no meaning, and the step is refused, never saved raw.
      const retained = retainedFor(input.handleEvidence);
      if (retained === undefined) return Promise.resolve({ status: "refused", issueCodes: ["web.handle.unknown"] });
      return resolveWebPlanNodeParameters(input, { targets: webLlmPacketTargets({ projectId: input.projectId, flowId: input.flowId }, retained), extractions: extractionHandles });
    },
  };
}

/** Bind web-only evidence tools into Core's domain-neutral global LLM harness. */
export function bindWebAutomationLlmEvidenceRuntime(fluxiq: FluxIQ): void {
  fluxiq.programs.automationStudio.bindLlmEvidenceRuntime(createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => eligibleWebSessionIds(fluxiq),
    structureDetectionSessionIds: () => eligibleWebSessionIds(fluxiq, WEB_AUTOMATION_STRUCTURE_DETECTION_CAPABILITY_ID),
    executeAction: (sessionId, command) => fluxiq.programs.automationStudioClientGateway.executeAction(sessionId, command),
  }, webAutomationClearedWayOutsOf(fluxiq), webAutomationBuildStateSource(fluxiq)));
}


/** The sessions every evidence tool may use, narrowed to those that also declare `alsoDeclaring` when it is named. */
function eligibleWebSessionIds(fluxiq: FluxIQ, alsoDeclaring?: string): string[] {
  return fluxiq.programs.clientGateway.snapshot().sessions
    .filter((session) => isEligibleWebSession(session, alsoDeclaring))
    .map((session) => session.sessionId);
}

/**
 * Keep `binding` as the newest entry, re-inserted when shown again, and let the
 * oldest go past the bound. The key is the page as the model read it, so two
 * captures that read the same are one entry, the newer one; a page that was
 * recaptured differently is another key.
 */
function keepNewest(window: Map<string, WebLlmSnapshotBinding>, key: string, binding: WebLlmSnapshotBinding): void {
  window.delete(key);
  window.set(key, binding);
  for (const oldest of window.keys()) {
    if (window.size <= RETAINED_SHOWN_PACKETS) break;
    window.delete(oldest);
  }
}

function evidenceScope(input: WebLlmEvidenceToolRequest, sessionId: string): string {
  return `${sessionId}\0${input.projectId}\0${input.flowId}`;
}

function requestedUrl(input: unknown): URL {
  try {
    return safeEvidenceUrl(input);
  } catch {
    return recoverable("invalid_input", why("not_a_url"));
  }
}

/** A target handle the model wrote, in the packets' spelling: `target.N` is read as `tN`. */
function boundedTargetHandle(input: unknown): string {
  const handle = canonicalWebLlmTargetHandle(input);
  if (handle === undefined) {
    return recoverable("invalid_input", rejectionDetail({ reason: "malformed_handle", target: typeof input === "string" ? input : undefined, instead: undefined, missing: undefined, requestId: undefined }));
  }
  return handle;
}

function exactToolKeys(input: JsonObject, allowed: string[]): void {
  const keys = new Set(allowed);
  const unexpected = Object.keys(input).some((key) => !keys.has(key));
  const missing = allowed.some((key) => !Object.prototype.hasOwnProperty.call(input, key));
  if (!unexpected && !missing) return;
  // The tool's own declared keys: what it takes, and all it takes.
  recoverable("invalid_input", rejectionDetail({
    reason: unexpected ? "unexpected_input_keys" : "missing_input_keys",
    target: undefined,
    instead: allowed,
    missing: undefined,
    requestId: undefined
  }));
}

/** A refusal whose reason is the whole of what the model needs. */
function why(reason: "another_origin" | "already_at_destination" | "not_a_url") {
  return rejectionDetail({ reason, target: undefined, instead: undefined, missing: undefined, requestId: undefined });
}
