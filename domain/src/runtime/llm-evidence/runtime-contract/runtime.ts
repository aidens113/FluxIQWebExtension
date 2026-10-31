import type {
  AutomationStudioActionPermissionCheck,
  AutomationStudioExplorationStopReason,
  AutomationStudioHarnessOptionBundle,
  AutomationStudioFlowScriptExamples,
  AutomationStudioLlmDomainSystemInstructions,
  AutomationStudioRuntimeTargetOverrideEvidenceValidation,
  AutomationStudioRuntimeTargetOverrideFailedAction,
  AutomationStudioRuntimeTargetOverrideTarget
} from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import type { WebLlmEvidenceToolExecution, WebLlmEvidenceToolRequest } from "../capture";
import type { WebLlmCallWords } from "../node-run";
import type { WebPlanNodeResolution, WebPlanNodeResolutionInput } from "../plan-resolution";
import type { WebLlmPublishedPage } from "../page-view";
import type { WebLlmClearedControlHandlesInput } from "../way-out-handles";
import type { WebLlmExtractionHandleResolution, WebLlmExtractionHandleScope } from "../structure";
import type { WebLlmFailureEvidenceRequest } from "./failure-evidence-request";
import type { WebLlmStateDigestRequest } from "./state-digest-request";

export type WebAutomationLlmEvidenceRuntime = {
  /** Whose options these are. Core scopes the harness-option registry by it, so the slot cannot be bound anonymously. */
  domainId: string;
  /** Passive result evidence; never adds hidden elements to actionable bindings. */
  observeResult?(input: Pick<WebLlmEvidenceToolRequest, "projectId" | "flowId" | "callId" | "signal"> & {
    permission: AutomationStudioActionPermissionCheck;
  }): Promise<JsonObject | undefined>;
  /** The handle each way out a trial's run pressed is named by in this Flow (t470, `./way-out-handles/`). */
  clearedControlHandles?(input: WebLlmClearedControlHandlesInput): Promise<Record<string, string>>;
  /** Where the page stands against where a build began (t462, `./start-state/`): passive, the same capture as `observeResult`. */
  startState?(input: Pick<WebLlmEvidenceToolRequest, "projectId" | "flowId" | "callId" | "signal"> & {
    start?: JsonObject;
    permission: AutomationStudioActionPermissionCheck;
  }): Promise<{ state: JsonObject; differs: string[]; location?: string; lines?: { gone: string[]; added: string[] }; items?: string[]; subjects?: string[]; scope?: string; resource?: string; collections?: Array<{ scope: string; group: string; subjects: string[]; states: Record<string, string> }>; controls?: Record<string, Record<string, number>>; values?: Record<string, string> } | undefined>;
  /** The keys Core refuses in evidence from this domain. Core carries no browser vocabulary of its own, so the domain that knows what these words mean declares them and Core enforces the declaration. Required here, because the producer always knows: an evidence runtime that declared nothing would silently deny nothing. */
  deniedEvidenceKeys: readonly string[];
  observedStateKeys: readonly string[];
  /**
   * Where a live list read's answer holds its kept rows, as Core's `holder.member`
   * key: one of the read's row keys (`./observed-state/read-rows-keys.ts`). A
   * repair compares a rerun of the read a judged test blamed with the rows Core's
   * check named (R3-3), and only this domain knows which member is the kept rows.
   */
  readRowsKey: string;
  /** The keys under which a step's argument carries the row its control was found in (`./plan-resolution/row-context-keys.ts`). Core leaves them out of what it tells the judge a repeated step acts on, and names none of its own. */
  rowContextKeys: readonly string[];
  /** What Core tells the model on every request for this domain's work: that it operates a website for a person, how the page view reads, and the rules (`./system-instructions/`). Core checks it when the runtime is bound. */
  systemInstructions: AutomationStudioLlmDomainSystemInstructions;
  /** Exact web worked-example tails supplied through Core's optional companion seam. */
  flowScriptExamples: AutomationStudioFlowScriptExamples;
  tools: Array<{ toolId: string; description: string; inputSchema: JsonObject; effect?: "observe" | "mutate"; repeatPolicy?: "after_mutation"; initialObservation?: { input: JsonObject } }>;
  /**
   * That this domain can run a node of the library against its live page, and
   * which node one free first look runs.
   *
   * Core reads it and offers the library as one more option, enumerating the
   * node ids from the registry itself, so a node registered later is runnable
   * with nothing here to edit (`AS/runtime/llm/harness-options/binding.ts`).
   */
  runsNodes?: {
    initial?: JsonObject;
    /**
     * The node that goes to a location, and the parameter that names it. Core
     * writes a build's start location into that parameter and runs the node as
     * the build's opening call, so the step that reaches the page is the
     * Flow's first kept step rather than one the model has to think of.
     */
    arrival?: { node: string; parameter: string };
    /**
     * The nodes this domain will actually run, by id. Core narrows the library
     * it offers the model to these.
     *
     * It is said because the registry's own list is wider than this domain:
     * Core's built-ins are available in every scope, so the enum the model was
     * given held `builtin.control.for-each`, `builtin.data.filter-list` and the
     * rest, and every call naming one arrived here and was refused
     * `node_not_runnable_here`. Nothing the model needs to express is lost --
     * control flow is authored as a routing word on steps that ran, and
     * filtering and record output are parameters of the extraction node.
     */
    runnable?: readonly string[];
  };
  /** Options declared in full rather than as bare tools, so a runtime-only recovery option never reaches Flow authoring. */
  harnessOptions: AutomationStudioHarnessOptionBundle;
  /** How Core reads one of this domain's result codes as a refusal, without learning any of them. */
  classifyRefusal: (resultCode: string) => AutomationStudioExplorationStopReason | undefined;
  executeTool(input: WebLlmEvidenceToolRequest): Promise<WebLlmEvidenceToolExecution>;
  /**
   * What the page was at one moment, as the opaque digest Core compares for
   * equality either side of each exploration action.
   *
   * It is the one thing Core's exploration reducer cannot work out for itself:
   * Core's own digest is of the evidence a step returned, which is what the step
   * said rather than what the page was. This takes a fresh sanitized capture and
   * hashes a projection of it (`state-digest/state-digest.ts`), which is why it widens
   * nothing -- the input is the same packet the model would have been shown, and
   * what leaves is a hash of less of it.
   */
  captureStateDigest(input: WebLlmStateDigestRequest): Promise<string | undefined>;
  /**
   * What a call names, in words a person reads, for the chat alone: the control
   * its handle names on a page this build was shown, and the words it types or
   * looks for, never into a control screened as sensitive (`./node-run/call-words.ts`).
   */
  describeCall(input: { projectId: string; flowId: string; toolId: string; value: JsonObject }): WebLlmCallWords | undefined;
  /**
   * That every result `executeTool` returns carries `stateDigests`, digested
   * from the captures the call already took, so Core never asks
   * `captureStateDigest` around a call (`AS/runtime/llm/harness-options/
   * binding.ts`). Each of those questions was a whole page capture: a look
   * cost three and an action four plus the action. `captureStateDigest` stays
   * for a moment no call brackets.
   */
  stateDigestsOnCalls?: true;
  /** The page at a failure, as the model reads every page (`web-llm-page.v3`); the structured packet is retained for the target check. */
  captureSanitizedFailureEvidence(input: WebLlmFailureEvidenceRequest): Promise<WebLlmPublishedPage>;
  validateTargetOverrideEvidence(evidence: JsonObject, target: AutomationStudioRuntimeTargetOverrideTarget, failedAction: AutomationStudioRuntimeTargetOverrideFailedAction): AutomationStudioRuntimeTargetOverrideEvidenceValidation;
  /**
   * What an extraction handle the detection tool issued stands for: the
   * `web.dom.extract_list` request, the page and the frame. The one way to turn
   * a handle a model put in a plan into real parameters. A handle is resolved
   * only for the project and Flow it was issued to; any other answer is
   * `unknown_handle`, and one the bounded store has let go is `stale_handle`.
   */
  resolveExtractionHandle(input: WebLlmExtractionHandleScope & { handle: string }): WebLlmExtractionHandleResolution;
  /**
   * A plan node's parameters with the handles the model wrote in them made
   * real: a `selector` written `{ handle: "tN" }` becomes the selector
   * behind the handle this project and Flow's exploration was shown, and the
   * extraction node's `extractList` written `{ handle: "extraction.N" }`
   * becomes the request behind it (`plan-resolution/`). A node with no handle
   * is `unchanged`; any handle that cannot be made real refuses the node with
   * named codes. Core calls it before a plan is validated.
   *
   * Awaited, because the step is then put to Core's permission check
   * (`plan-resolution/step-permission.ts`): a step that would lastingly do
   * something the run is not permitted answers `needs_permission`, and a step
   * that presses without saying what pressing would do is refused.
   *
   * A step a repair wrote comes with `handleEvidence`, the one packet its
   * handles were issued in, and resolves from that packet alone
   * (`plan-resolution/packet-targets.ts`, t429); a packet this runtime did not
   * keep resolves nothing.
   */
  resolvePlanNodeParameters(input: WebPlanNodeResolutionInput & { handleEvidence?: JsonObject | undefined }): Promise<WebPlanNodeResolution>;
};
