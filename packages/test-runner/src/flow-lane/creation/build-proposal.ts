// The one paid step of a created-Flow run: give Core the task's instruction,
// ready the Flow's LLM settings, and ask Core to explore the live page and
// propose a Flow -- the calls the web panel's "Explore and create proposal"
// makes (`authoring/BlankFlowAuthoringPanel.tsx`), in its order.
//
// Whatever Core answers becomes a `CreatedFlowBuild`: counts, codes and
// identifiers, never page content, a prompt or a reply. A refused build is a
// record too, not a throw, so the run can publish what the build spent before
// it fails on the refusal.

import type { LlmActionConsequence } from "@fluxiq-web-extension/test-contracts";
import { AUTOMATION_STUDIO_FLOW_BOOTSTRAP_DECISION_STEP_IDS, parseAutomationStudioFlowBootstrapFailureDiagnostic } from "fluxiq/automation-studio";
import type { ExistingAdaptationConsequenceCrossCheck, ExistingAdaptationDeclaredAction, ExistingFlowAdaptation, ExistingFlowAdaptationSummary, FlowBootstrapGenerationEnvelope } from "../../existing-fluxiq-control.js";
import { publishableStepFields, type PublishableStepValue } from "../../existing-fluxiq-control/index.js";
import { RunnerFailure } from "../../failure.js";
import { isBoundedHttpFailure, type FluxIQHttpOptions } from "../../http-control/index.js";
import type { CreatedFlowChatRecord } from "./chat/index.js";

/**
 * How long a build may still be running after it was dispatched: the wait the
 * web panel gives the same request (`WEBSITE_EXPLORATION_OVERALL_TIMEOUT_MS`).
 * The number is what a build was measured to need.
 */
const GENERATION_DEADLINE_MS = 60_000 + 600_000 + 15_000;
/*
 * The build request itself is held open until that deadline, as a long request
 * (`http-control/long-request.ts`). Until 2026-09-29 it was held for the
 * ordinary 300 s cap and then only a *proposal* was polled for, so a build that
 * ran eight minutes and failed with a named diagnostic was recorded as
 * `lab.generation_unfinished` (run-munaiz76-7026748c). Core's answer, success
 * or refusal, is now what the record is read from; the poll is left for a
 * request that still times out.
 */
const PROPOSAL_POLL_MS = 1_000;
/** The shape of a Core or domain identifier, such as `web.recovery.inspect` or `web.action.rejected.no_progress`. */
const VOCABULARY_ID = /^[a-z][a-z0-9_-]*(?:[.:][a-z0-9_-]+)*$/u;
const MAX_VOCABULARY_ID_LENGTH = 96;
/** How Core records a Flow signature on a judged yes: a digest, never the signature, which holds every step's input and target. */
const SIGNATURE_DIGEST = /^sha256:[0-9a-f]{64}$/u;
/** Every `judgedAt` Core writes on `buildJudged` (`AutomationStudioFlowBootstrapFinishingVerdict`). */
const JUDGED_AT: ReadonlySet<string> = new Set(["finished_round", "judging_reserve", "stopped_short"]);
/** An error's class or system code (`TypeError`, `ECONNRESET`, `UND_ERR_CONNECT_TIMEOUT`): no whitespace, so no sentence. */
const THROW_CODE = /^[A-Za-z][A-Za-z0-9_.:-]{0,63}$/u;
/**
 * Core's own names for the decisions that called no tool
 * (`AUTOMATION_STUDIO_FLOW_BOOTSTRAP_DECISION_STEP_IDS`): a refused plan is
 * recorded as `core.decision_unusable`, with the first code that refused it.
 * They are kept as steps and never listed as tools.
 *
 * This was the whole `core.` prefix, and that hid 21 of one build's 22 calls.
 * The tool the model explores a page with is `core.run_node`
 * (`AUTOMATION_STUDIO_LLM_RUN_NODE_TOOL_ID`) -- it runs the library's nodes,
 * so it is almost every call a build makes -- and it shares the namespace with
 * the decision names, so a prefix test deleted it from every tool list the
 * facility published. Core's own closed set is the test instead: a decision
 * name Core adds is excluded here without a change, and a tool it adds is not
 * dropped.
 */
const CORE_DECISION_STEP_IDS: ReadonlySet<string> = new Set<string>(Object.values(AUTOMATION_STUDIO_FLOW_BOOTSTRAP_DECISION_STEP_IDS));

export type CreatedFlowBuildControl = {
  automationStudioCall(endpoint: string, payload: Record<string, unknown>, bounds?: FluxIQHttpOptions, domainId?: string): Promise<unknown>;
  selectExistingContext(projectId: string, clientId?: string, bounds?: FluxIQHttpOptions, flowId?: string): Promise<void>;
  generateFlowBootstrapAdaptation(input: CreatedFlowBuildRequest, bounds?: FluxIQHttpOptions): Promise<FlowBootstrapGenerationEnvelope>;
  listFlowAdaptations(projectId: string, flowId: string, status?: string): Promise<ExistingFlowAdaptationSummary[]>;
  getFlowAdaptation(projectId: string, flowId: string, adaptationId: string): Promise<ExistingFlowAdaptation>;
};

/**
 * One `generate-flow-bootstrap-adaptation` request. It carries no grant: a
 * model call needs none. `permittedConsequences` is the operator's
 * `--llm-permit`, sent only when it permits something.
 */
export type CreatedFlowBuildRequest = { projectId: string; flowId: string; evidenceGuided: true; startLocation?: string; permittedConsequences?: LlmActionConsequence[] };

/** What readying a Flow for its build answers with: the consequences the operator permitted it (`--llm-permit`), empty for none. */
export type CreatedFlowBuildLlm = { permittedConsequences: readonly LlmActionConsequence[] };

/** Clock and bounds for the build's wait. Production passes none. */
export type CreatedFlowBuildWait = { now?: () => number; sleep?: (ms: number) => Promise<void>; requestTimeoutMs?: number; deadlineMs?: number; pollMs?: number };

/**
 * What Core says the build spent. `budgetBreaches`: the calls Core says cost
 * more than its purse held them at before sending them -- a breach of the
 * build's ceiling, which the Lab's budget check fails the run on as it does a
 * run's. Absent where Core published none, which a reader takes as none.
 */
export type CreatedFlowBuildAccounting = Readonly<{ provider: string | null; model: string | null; inputTokens: number | null; outputTokens: number | null; totalTokens: number | null; estimatedCostUsd: number | null; budgetBreaches?: number }>;
/**
 * What one member of a decision row may hold: a count, a flag, a closed code
 * or identifier, a bounded list of those, or a bounded record of them (Core's
 * per-call `usage`).
 *
 * The rule that decides it lives in `existing-fluxiq-control`, because the
 * reader of a *proposed* build applies the same one; this name is kept for the
 * readers of a created-Flow build.
 */
export type CreatedFlowBuildStepValue = PublishableStepValue;

/**
 * One decision the build's exploration made, in order: the tool it called, or
 * Core's name for a decision that called none, and the code it came to.
 *
 * **Every member Core publishes on the row is carried through, not a chosen
 * three.** This kept `toolId`, `effectApplied` and `resultCode` and dropped the
 * rest, and a real failed build then read as 32 rows of two fields each, twenty
 * of them the identical `web.action.rejected.target_unobserved` inside one
 * undivided 99-second gap -- so nobody could tell one handle refused twenty
 * times from twenty different handles, and three defects with three different
 * fixes were one word (`run-muf8dstp-0135804a`). Core keeps the iteration, the
 * call id, the bytes the call admitted, what it spent and the refusal's own
 * reason per row; whatever of that reaches here is kept, and the next member
 * Core adds is kept too without a change on this side.
 *
 * What bounds the record is the *shape* of each value, not a list of names:
 * counts, flags and whitespace-free codes and identifiers travel, and anything
 * that could be a sentence, an address, a selector or a value read off the page
 * does not. The fields below are the ones Core writes today, including bounded
 * content-free draft progress, and are named for a reader; they are not the
 * limit of what is carried.
 */
export type CreatedFlowBuildStep = Readonly<{
  toolId: string;
  effectApplied?: boolean;
  resultCode?: string;
  /** The loop iteration this row belongs to, which is what a provider call is counted by; two rows may share one. */
  iteration?: number;
  /** The evidence call the row records, where it made one. */
  callId?: string;
  /** Bytes of evidence this one call admitted. A size, never a value. */
  evidenceBytes?: number;
  /**
   * The refusal's own reason, where the row was one and the domain named it:
   * `node_not_runnable_here`, `handle_not_in_packet`, `unexpected_input_keys`
   * and thirty others, which is what tells four defects apart behind the two
   * codes they shared.
   */
  resultReason?: string;
  /** The node the call ran, where the domain resolved one against its catalog; never a name the model invented. */
  nodeId?: string;
  /** When the row was recorded, in epoch milliseconds, so a stall can be located in time. */
  at?: number;
  /** What this one call spent, as Core reported it. */
  usage?: Readonly<Record<string, string | number | boolean>>;
  /** Content-free state transition measured for this decision. */
  progress?: Readonly<{ draftRevisionBefore: number; draftRevisionAfter: number; pageState: "changed" | "unchanged" | "unobserved"; draftState: "changed" | "unchanged"; answerabilityState: "first_observed" | "changed" | "unchanged" | "unobserved" }>;
  /** Stable build-local step ids and bounded amendment counts. */
  draftChange?: Readonly<{ targetedStepIds: readonly string[]; appliedCount: number; refusedCount: number; keptStepCount: number; rerunStepId?: string }>;
  /** Counts describing the draft entry shown to the provider, never its content. */
  draft?: Readonly<{ bytes: number; budget: number; steps: number; instructionBytes: number; unlisted?: number; withoutInput?: number; inputTooLarge?: number; overBudget?: boolean; budgetBelowFloor?: boolean }>;
  /** Content-free capability facts from the completion check. */
  answerability?: Readonly<{ recordsRequested: boolean; recordProducerPresent: boolean; recordStorePresent: boolean; issueCode?: "bootstrap.cannot_answer_instruction" }>;
  [field: string]: CreatedFlowBuildStepValue | undefined;
}>;
/**
 * `incompleteDraft` is Core's note that a build which ran out kept its draft as
 * an incomplete record the next build continues from: the revision written and
 * how many proposable steps it holds. Two counts; absent when nothing was kept.
 */
export type CreatedFlowBuildEvidenceLoop = Readonly<{ decisionCount: number | null; toolCallCount: number; evidenceBytes: number; toolIds: readonly string[]; steps: readonly CreatedFlowBuildStep[] | null; incompleteDraft?: Readonly<{ revision: number; steps: number }> }>;

/**
 * - `outcome`: `proposed` when Core left a pending proposal nothing is waiting
 *   on; `permission_required` when the build asked a person for a lasting
 *   consequence nobody allowed -- not a failure of the build, and never an HTTP
 *   failure, but the question FluxIQ puts to the person, carried in
 *   `permissionRequest`; `failed` for every other ending.
 *
 *   A build reaches `permission_required` two ways. It can end on the request,
 *   which arrives as a refusal with a diagnostic. Or -- since the gate learned
 *   to park and wait for an answer -- it can finish, leave a proposal, and
 *   carry the unanswered question on it; Core then refuses to approve or apply
 *   that proposal (`FLOW_BOOTSTRAP_PERMISSION_REQUIRED`). Both are the same
 *   ending and are reported as one. Reading the second off the proposal is what
 *   this record gains: it was arriving here as a `proposed` build whose review
 *   then failed as an HTTP 400, which a campaign recorded as
 *   `environment.missing` -- a harness verdict for the product working exactly
 *   as it was built to.
 * - `providerCalls`: **every** provider call the build made, from the
 *   proposal's audit (`totalProviderCallCount`) or the refusal's diagnostic;
 *   `null` when Core did not say. Core does not itemize a build's calls one by
 *   one, so this count and `accounting`'s totals are all a build's per-call
 *   record can hold.
 *
 *   It used to be the evidence loop's decisions alone, and was short by every
 *   call Core makes outside the loop -- the instruction-authority derivation
 *   asks the model what the person's instruction already asks for
 *   (`runtime/action-permissions/`, `deriveInstructed`). Those calls are spent
 *   against the build's token and cost budget, so a build could die on its
 *   budget for calls no count explained. Core publishes them as
 *   `additionalProviderCallCount` and their sum as `totalProviderCallCount`,
 *   and this is that sum. A Core that publishes neither still reports the loop
 *   count, which is then all there is.
 * - `loopProviderCalls`: the evidence loop's own decisions, beside the total,
 *   so a reader can still see what the build itself decided. The difference
 *   between the two is what Core spent outside the loop.
 * - `providerInvocation`: whether Core says it sent a provider request at all;
 *   `unknown` when the build outlived its request and no proposal appeared.
 * - `failure.code`: Core's own closed code for a refusal, or a `lab.` code
 *   for a refusal this lane made of Core's answer.
 * - `failure.issueCodes`: the codes Core says refused the last plan the model
 *   completed -- validation's or the domain's -- when it names any. Codes
 *   only; the plan paths and page content they refer to are never kept.
 * - `evidenceLoop.steps`: every decision of the build, in order, with every
 *   member Core published on it that a published record may carry
 *   (`CreatedFlowBuildStep`); `toolIds` are the tools among them. A refused
 *   build carries them on its failure diagnostic, and a proposed build carries
 *   them on the created audit event of its proposal, so the successful builds
 *   most worth studying read alike with the refused ones. `null` only for a
 *   build Core published no trace for at all.
 * - `recoveredAfterTimeout`: the request outlived its HTTP bound and the
 *   proposal was found by polling, as the web panel does.
 * - `instructedConsequences`: the lasting consequences Core found the person's
 *   instruction asks for, each with the words it quoted. Read from the
 *   proposal's `metadata.bootstrap` and from nowhere else -- the top-level
 *   field this used to read is never populated for a bootstrap proposal, so
 *   every build measured before 2026-09-23 reported an empty set while the
 *   stored proposal held a full one. `null` on a refused build.
 * - `declaredConsequences` and `consequenceCrossCheck`: what every action put
 *   to Core's gate said about itself, and Core's reading of that against the
 *   instruction. From `metadata.bootstrap` as well.
 * - `permissionRequest`: the request Core raised when the build needed a
 *   lasting consequence nobody allowed (`flow_bootstrap.permission_required`):
 *   what the action was, the control as the model was shown it, and which
 *   classes were missing. Core's own payload for the person, cut to those.
 * - `judged`: the judged `yes` the build finished on, as Core recorded it on
 *   the proposal (`CreatedFlowBuildJudged`); `null` on a build that left a
 *   proposal Core recorded none on -- a build given no judge, or a Core older
 *   than the record -- and on a build that left no proposal. Absent only from a
 *   record made before the field.
 */
export type CreatedFlowBuild = Readonly<{
  outcome: "proposed" | "permission_required" | "failed";
  adaptationId: string | null;
  providerCalls: number | null;
  providerInvocation: "attempted" | "not_attempted" | "unknown";
  accounting: CreatedFlowBuildAccounting | null;
  evidenceLoop: CreatedFlowBuildEvidenceLoop | null;
  /**
   * `providerThrow` is what an unnamed provider throw was, beside
   * `flow_bootstrap.provider_transport_unknown`: the error's and its cause's
   * class and code, never its message, which stays in the local
   * `provider-failures.local.json`.
   */
  failure: Readonly<{ code: string; stage: string | null; httpStatus: number | null; issueCodes?: readonly string[]; providerThrow?: Readonly<{ errorClass?: string; errorCode?: string; causeClass?: string; causeCode?: string }> }> | null;
  recoveredAfterTimeout: boolean;
  durationMs: number;
  instructedConsequences: ReadonlyArray<Readonly<{ consequence: string; quote: string }>> | null;
  /**
   * What every action the build put to Core's permission gate declared about
   * itself, in the order it was asked, with Core's own answer beside it. A
   * permitted declaration used to leave no trace at all, so what a Flow's
   * steps said they would do could only be deduced from what was not refused.
   * `null` on a build Core published none for.
   */
  declaredConsequences: readonly CreatedFlowDeclaredAction[] | null;
  /** Core's reading of those declarations against the person's own instruction. `null` when Core made none. */
  consequenceCrossCheck: CreatedFlowConsequenceCrossCheck | null;
  permissionRequest: CreatedFlowPermissionRequest | null;
  /** The evidence loop's own decisions, where `providerCalls` is every call the build made. */
  loopProviderCalls: number | null;
  judged?: CreatedFlowBuildJudged | null;
  /**
   * Present when the build was started the way a person starts one: the task's
   * instruction typed into the extension's chat window (`chat/`). Absent for a
   * build the Lab asked Core's build endpoint for itself, which is test-only
   * and never counted as a pass (`--direct-api-build`).
   */
  chat?: CreatedFlowChatRecord;
}>;

/**
 * The judged `yes` a build finished on, as Core records it on the proposal's
 * `created` audit event (`buildJudged`, Core's
 * `flow-bootstrap/unfinished-build/finishing-verdict.ts`). Live run
 * `run-musp8nz1-dbd3905a` (cause R2) could prove that its build finished on a
 * judged yes about the standing Flow only from the order of `core.log` lines.
 *
 * - `round`: the round whose Flow was judged, 0 for the exploration.
 * - `judgedAt`: `finished_round` when the model said the Flow was ready and its
 *   test was judged; `judging_reserve` when a round the judging reserve stopped
 *   was tested and judged with that reserve; `stopped_short` when a round that
 *   stopped short of a completion had its changed Flow tested and judged.
 * - `flowSignature` and `standingFlowSignature`: digests (`sha256:` and hex) of
 *   the Flow signature of the test the judge read, `null` when it named none,
 *   and of the Flow the build finished with. `matchesStandingFlow` says whether
 *   they are the same Flow.
 * - `confidence`: the judge's, `null` where Core recorded none.
 * - `unconfirmed`: whether the judge gave advice beside its yes, and the
 *   `patchNeeded` it gave, where it gave either; `null` where it gave neither.
 *   **Unconfirmed, never a repair directive**: the build did not act on it, and
 *   in live run `run-murwd8le-79e735a8` (cause 10) such advice was wrong. The
 *   advice itself is the model's free text, so the record keeps only that it
 *   was given; its words stay in Core's audit event.
 */
export type CreatedFlowBuildJudged = Readonly<{
  verdict: "yes";
  round: number;
  judgedAt: "finished_round" | "judging_reserve" | "stopped_short";
  flowSignature: string | null;
  standingFlowSignature: string;
  matchesStandingFlow: boolean;
  confidence: number | null;
  unconfirmed: Readonly<{ adviceGiven: boolean; patchNeeded: boolean | null }> | null;
}>;

/** One action the build declared to the gate, as the build record keeps it: codes, a verb, and the control as Core allowed it to be named. */
export type CreatedFlowDeclaredAction = Readonly<{
  actionKind: string;
  actionId: string;
  ref: string;
  verb: string;
  /** `observe` for an action that only reads, `mutate` for one that acts; `null` from a Core older than the field. */
  effect: string | null;
  controlName: string | null;
  controlKind: string | null;
  consequences: readonly string[];
  permitted: boolean;
  missing?: readonly string[];
  /** Classes an observing action named that Core did not treat as lasting, so an over-declared read stays countable. */
  disregarded?: readonly string[];
}>;

/** Core's verdict on the two self-reports held against each other, cut to what a measurement reads. */
export type CreatedFlowConsequenceCrossCheck = Readonly<{
  verdict: string;
  declared: readonly string[];
  instructed: readonly string[];
  undeclared: readonly string[];
  beyondInstruction: readonly string[];
  actions: number;
  declaredNothing: number;
}>;

export type CreatedFlowPermissionRequest = Readonly<{
  actionKind: string;
  verb: string;
  controlName: string | null;
  controlKind: string | null;
  consequences: readonly string[];
  missing: readonly string[];
  /** What Core read the person's instruction as asking for, each with the words it quoted. */
  instructed: ReadonlyArray<Readonly<{ consequence: string; quote: string }>>;
}>;

/**
 * Saves the instruction, readies the Flow's LLM settings, and builds.
 * `authorize` installs the key and saves the settings once the instruction is
 * saved; a refusal there throws before anything is spent.
 */
export async function buildCreatedFlowProposal(
  control: CreatedFlowBuildControl,
  input: { projectId: string; flowId: string; instruction: string; startLocation?: string; authorize: (flowId: string) => Promise<CreatedFlowBuildLlm> },
  bounds: FluxIQHttpOptions = {},
  wait: CreatedFlowBuildWait = {},
): Promise<CreatedFlowBuild> {
  const now = wait.now ?? Date.now;
  const saved = record(await control.automationStudioCall("save-flow-generation-instruction", { projectId: input.projectId, flowId: input.flowId, instruction: input.instruction }, bounds));
  if (record(saved.instruction).status !== "active") throw new RunnerFailure("runtime.behavior", "Core did not make the task's instruction the Flow's active instruction");
  const { permittedConsequences } = await input.authorize(input.flowId);
  // Core's evidence tools act on the one connected client, in this project's context.
  await control.selectExistingContext(input.projectId, undefined, bounds, input.flowId);
  const startedAt = now();
  let envelope: FlowBootstrapGenerationEnvelope;
  try {
    envelope = await control.generateFlowBootstrapAdaptation(
      // Where the Flow starts. No instruction in the catalog names it -- they
      // are written as a shopper would type them, and the fixture's origin is a
      // port drawn per run -- so the run tells Core directly, and the build has
      // to reach the page itself before it may explore it
      // (`AS/runtime/flow-bootstrap/start-location.ts`).
      {
        projectId: input.projectId,
        flowId: input.flowId,
        evidenceGuided: true,
        ...(input.startLocation === undefined ? {} : { startLocation: input.startLocation }),
        ...(permittedConsequences.length ? { permittedConsequences: [...permittedConsequences] } : {}),
      },
      { timeoutMs: wait.requestTimeoutMs ?? wait.deadlineMs ?? GENERATION_DEADLINE_MS, longRequest: true, ...(bounds.signal ? { signal: bounds.signal } : {}) },
    );
  } catch (error) {
    // Core keeps building after the client has stopped waiting, and persists
    // the proposal when it is done, so a bounded request is not a failed build.
    if (!isBoundedHttpFailure(error)) throw error;
    const adaptationId = await awaitProposal(control, input, startedAt, wait);
    if (adaptationId === undefined) return failed({ code: "lab.generation_unfinished", stage: null, httpStatus: null }, "unknown", now() - startedAt);
    return proposed(control, input, adaptationId, true, now() - startedAt);
  }
  if (!envelope.ok) return refused(envelope, now() - startedAt);
  const adaptation = isRecord(envelope.payload) && isRecord(envelope.payload.adaptation) ? envelope.payload.adaptation : undefined;
  if (adaptation?.projectId !== input.projectId || adaptation.flowId !== input.flowId || adaptation.status !== "proposed" || typeof adaptation.adaptationId !== "string") {
    return failed({ code: "lab.generation_answer_invalid", stage: null, httpStatus: envelope.status }, "unknown", now() - startedAt);
  }
  return proposed(control, input, adaptation.adaptationId, false, now() - startedAt);
}

async function awaitProposal(control: CreatedFlowBuildControl, input: { projectId: string; flowId: string }, startedAt: number, wait: CreatedFlowBuildWait): Promise<string | undefined> {
  const now = wait.now ?? Date.now;
  const sleep = wait.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const deadline = startedAt + (wait.deadlineMs ?? GENERATION_DEADLINE_MS);
  // At least one look: the request is held to the deadline itself, so it can
  // time out with no time left, just as Core saves a proposal.
  do {
    const pending = await control.listFlowAdaptations(input.projectId, input.flowId, "proposed");
    if (pending.length > 1) throw new RunnerFailure("runtime.behavior", "Core left more than one pending proposal on the Flow a single build was asked for", { details: { pending: pending.length } });
    if (pending[0]) return pending[0].adaptationId;
    if (now() >= deadline) break;
    await sleep(Math.min(wait.pollMs ?? PROPOSAL_POLL_MS, Math.max(0, deadline - now())));
  } while (now() < deadline);
  return undefined;
}

/**
 * A proposal, as Core's review surface describes it. It must be the pending
 * Flow bootstrap the build was asked for, and its audit must show that the
 * build explored the page and counted its provider calls: a proposal without
 * either cannot be shown to be what was paid for.
 */
async function proposed(control: CreatedFlowBuildControl, input: { projectId: string; flowId: string }, adaptationId: string, recoveredAfterTimeout: boolean, durationMs: number): Promise<CreatedFlowBuild> {
  return (await readCreatedFlowBuild(control, input, adaptationId, { recoveredAfterTimeout, durationMs, statuses: ["proposed"] })).build;
}

/** A build read off the proposal it left: the record, and the status and applied change count Core reports for the proposal now. */
export type CreatedFlowBuildRead = Readonly<{ build: CreatedFlowBuild; status: string; appliedMutationCount: number | null }>;

/**
 * Reads a build from the proposal it left, by the same rules whoever started
 * it. `statuses` are the states the proposal may be in: `proposed` for a build
 * the Lab asked for and has yet to review; `applied` as well for one the
 * extension's chat started, which approves and applies its own proposal on a
 * new Flow (`create-here.ts` in Core). Any other state is a refusal.
 */
export async function readCreatedFlowBuild(
  control: Pick<CreatedFlowBuildControl, "getFlowAdaptation" | "automationStudioCall">,
  input: { projectId: string; flowId: string },
  adaptationId: string,
  read: { recoveredAfterTimeout: boolean; durationMs: number; statuses: readonly string[] },
): Promise<CreatedFlowBuildRead> {
  const detail = await control.getFlowAdaptation(input.projectId, input.flowId, adaptationId);
  const { recoveredAfterTimeout, durationMs } = read;
  const loop = detail.evidenceLoop;
  const consequences = detail.consequences;
  const request = consequences?.permissionRequest;
  const base = {
    adaptationId: detail.adaptationId,
    providerCalls: loop?.totalProviderCallCount ?? loop?.providerCallCount ?? null,
    loopProviderCalls: loop?.providerCallCount ?? null,
    // A proposal cannot exist without a provider's answer.
    providerInvocation: "attempted" as const,
    accounting: detail.accounting ? accountingOf(detail.accounting) : null,
    evidenceLoop: loop ? { decisionCount: loop.decisionCount ?? loop.providerCallCount ?? null, toolCallCount: loop.toolCallCount, evidenceBytes: loop.evidenceBytes, toolIds: vocabulary(loop.toolIds), steps: buildSteps(loop.steps) } : null,
    recoveredAfterTimeout,
    durationMs,
    instructedConsequences: Object.freeze((consequences?.instructed ?? []).map((entry) => Object.freeze({ consequence: entry.consequence, quote: entry.quote }))),
    declaredConsequences: consequences ? Object.freeze(consequences.declared.map(declaredActionOf)) : null,
    consequenceCrossCheck: consequences?.crossCheck ? crossCheckOf(consequences.crossCheck) : null,
    permissionRequest: request ? permissionRequestOf(request) : null,
    judged: await createdFlowBuildJudged(control, input, adaptationId),
  };
  const problem = !read.statuses.includes(detail.status) || detail.adaptationKind !== "flow_bootstrap" ? "lab.proposal_not_pending_bootstrap"
    : !loop ? "lab.proposal_without_evidence_audit"
      : loop.providerCallCount === undefined ? "lab.proposal_without_call_count"
        : loop.toolCallCount < 1 || loop.evidenceBytes < 1 ? "lab.proposal_without_page_evidence"
          : undefined;
  const found = { status: detail.status, appliedMutationCount: detail.appliedMutationCount ?? null };
  if (problem) return Object.freeze({ ...found, build: Object.freeze({ ...base, outcome: "failed" as const, failure: { code: problem, stage: null, httpStatus: null } }) });
  // The proposal exists and is well formed, and a person still has to answer
  // before anything may be done with it. Read here rather than discovered when
  // the review call is refused, so the ending is the product's own answer and
  // not an HTTP status.
  if (request) return Object.freeze({ ...found, build: Object.freeze({ ...base, outcome: "permission_required" as const, failure: { code: "flow_bootstrap.permission_required", stage: "review", httpStatus: null } }) });
  return Object.freeze({ ...found, build: Object.freeze({ ...base, outcome: "proposed" as const, failure: null }) });
}

/**
 * The judged yes Core recorded on the proposal's `created` audit event, read
 * from the adaptation as Core answers it: `metadata.phase9.auditEvents`, the
 * same event the evidence loop's counts are read from, by the endpoint that
 * proposal was just read through. `null` when Core recorded none or answered
 * no record in its shape; a read that fails fails like the read before it.
 */
async function createdFlowBuildJudged(control: Pick<CreatedFlowBuildControl, "automationStudioCall">, input: { projectId: string; flowId: string }, adaptationId: string): Promise<CreatedFlowBuildJudged | null> {
  const answer = await control.automationStudioCall("get-flow-adaptation", { projectId: input.projectId, flowId: input.flowId, adaptationId });
  const adaptation = isRecord(answer) && isRecord(answer.adaptation) ? answer.adaptation : undefined;
  const phase9 = isRecord(adaptation?.metadata) && isRecord(adaptation.metadata.phase9) ? adaptation.metadata.phase9 : undefined;
  const created = Array.isArray(phase9?.auditEvents) ? phase9.auditEvents.find((event): event is Record<string, unknown> => isRecord(event) && event.eventType === "created") : undefined;
  return createdFlowBuildJudgedOf(isRecord(created?.detail) ? created.detail.buildJudged : undefined);
}

/** Core's `buildJudged`, held to its shape: a value that is not one is no record. */
export function createdFlowBuildJudgedOf(value: unknown): CreatedFlowBuildJudged | null {
  if (!isRecord(value) || value.verdict !== "yes") return null;
  const { round, judgedAt, flowSignature, standingFlowSignature, matchesStandingFlow, confidence, unconfirmed } = value;
  if (!Number.isSafeInteger(round) || (round as number) < 0) return null;
  if (!JUDGED_AT.has(judgedAt as string)) return null;
  if (!(flowSignature === null || isSignatureDigest(flowSignature)) || !isSignatureDigest(standingFlowSignature) || typeof matchesStandingFlow !== "boolean") return null;
  // That advice was given, never its words: they are the judge's free text.
  const adviceGiven = isRecord(unconfirmed) && typeof unconfirmed.advice === "string" && unconfirmed.advice.trim() !== "";
  const patchNeeded = isRecord(unconfirmed) && typeof unconfirmed.patchNeeded === "boolean" ? unconfirmed.patchNeeded : null;
  return Object.freeze({
    verdict: "yes",
    round: round as number,
    judgedAt: judgedAt as CreatedFlowBuildJudged["judgedAt"],
    flowSignature,
    standingFlowSignature,
    matchesStandingFlow,
    confidence: typeof confidence === "number" && Number.isFinite(confidence) && confidence >= 0 && confidence <= 1 ? confidence : null,
    unconfirmed: !adviceGiven && patchNeeded === null ? null : Object.freeze({ adviceGiven, patchNeeded }),
  });
}

function isSignatureDigest(value: unknown): value is string {
  return typeof value === "string" && SIGNATURE_DIGEST.test(value);
}

/** One gate record as the build keeps it: Core's own strings, nothing interpreted. */
function declaredActionOf(entry: ExistingAdaptationDeclaredAction): CreatedFlowDeclaredAction {
  return Object.freeze({
    actionKind: entry.actionKind,
    actionId: entry.actionId,
    ref: entry.ref,
    verb: entry.verb,
    effect: entry.effect,
    controlName: entry.controlName,
    controlKind: entry.controlKind,
    consequences: Object.freeze([...entry.consequences]),
    permitted: entry.permitted,
    ...(entry.missing === undefined ? {} : { missing: Object.freeze([...entry.missing]) }),
    ...(entry.disregarded === undefined ? {} : { disregarded: Object.freeze([...entry.disregarded]) }),
  });
}

function crossCheckOf(crossCheck: ExistingAdaptationConsequenceCrossCheck): CreatedFlowConsequenceCrossCheck {
  return Object.freeze({
    verdict: crossCheck.verdict,
    declared: Object.freeze([...crossCheck.declared]),
    instructed: Object.freeze([...crossCheck.instructed]),
    undeclared: Object.freeze([...crossCheck.undeclared]),
    beyondInstruction: Object.freeze([...crossCheck.beyondInstruction]),
    actions: crossCheck.actions,
    declaredNothing: crossCheck.declaredNothing,
  });
}

/**
 * The build's decisions as the record keeps them, and `null` where Core
 * published none. The one filter both paths use -- a proposed build's trail and
 * a refused build's are built here, so they are the same shape and a reader can
 * compare them. It was written twice, and the two copies were the same
 * three-field whitelist, so widening the record meant widening it in two
 * places and forgetting one.
 *
 * A row is kept when it names a tool in the vocabulary, and everything else
 * Core wrote on it is carried through as far as its value's shape allows
 * (`publishableStepFields`, which the reader of a proposed build applies too,
 * so the two records are built by one rule). Nothing is dropped for not being
 * recognized.
 */
function buildSteps(steps: readonly unknown[] | undefined): readonly CreatedFlowBuildStep[] | null {
  if (steps === undefined) return null;
  return Object.freeze(steps.flatMap((entry): CreatedFlowBuildStep[] => {
    if (!isRecord(entry) || typeof entry.toolId !== "string" || !isVocabulary(entry.toolId)) return [];
    // Validated member by member on the way in, so the assertion states the
    // shape rather than assuming it.
    const row: Record<string, CreatedFlowBuildStepValue> = { toolId: entry.toolId, ...publishableStepFields(entry) };
    return [Object.freeze(row) as CreatedFlowBuildStep];
  }));
}

/** A refusal, read through Core's own diagnostic parser; a body that parser rejects keeps only its HTTP status. */
function refused(envelope: FlowBootstrapGenerationEnvelope, durationMs: number): CreatedFlowBuild {
  const payload = isRecord(envelope.payload) ? envelope.payload : {};
  return createdFlowBuildFromDiagnostic(payload.diagnostic, durationMs, envelope.status)
    ?? failed({ code: `lab.generation_http_${envelope.status}`, stage: null, httpStatus: envelope.status }, "unknown", durationMs);
}

/**
 * A failed build from Core's diagnostic of it, read through Core's own parser:
 * what it spent, how far its loop got and why it failed. Undefined for a value
 * that parser rejects. `httpStatus` is the refusal's, or null for a build whose
 * diagnostic was read afterwards (`get-flow-bootstrap-failure`, the chat's).
 */
export function createdFlowBuildFromDiagnostic(value: unknown, durationMs: number, httpStatus: number | null): CreatedFlowBuild | undefined {
  const diagnostic = parseAutomationStudioFlowBootstrapFailureDiagnostic(value);
  if (!diagnostic) return undefined;
  const loop = diagnostic.evidenceLoop;
  const issueCodes = [...new Set((diagnostic.issueCodes ?? []).filter(isVocabulary))];
  const steps = buildSteps(loop?.steps) ?? undefined;
  return Object.freeze({
    // Core's parser admits a request only on its own ending, and that ending only with one.
    outcome: diagnostic.permissionRequest ? "permission_required" : "failed",
    adaptationId: null,
    // A current unsent request does not erase earlier calls; legacy loop counts cannot establish the build aggregate.
    providerCalls: diagnostic.totalProviderCallCount ?? (diagnostic.providerInvocation === "not_attempted" && !loop?.decisionCount ? 0 : null),
    loopProviderCalls: loop?.decisionCount ?? (diagnostic.providerInvocation === "not_attempted" ? 0 : null),
    providerInvocation: diagnostic.providerInvocation,
    accounting: diagnostic.accounting ? accountingOf(diagnostic.accounting) : null,
    evidenceLoop: loop ? { decisionCount: loop.decisionCount, toolCallCount: loop.toolCallCount, evidenceBytes: loop.evidenceBytes, toolIds: vocabulary((steps ?? []).map((step) => step.toolId)), steps: steps ?? null, ...(loop.incompleteDraft ? { incompleteDraft: Object.freeze({ revision: loop.incompleteDraft.revision, steps: loop.incompleteDraft.steps }) } : {}) } : null,
    failure: { code: diagnostic.code, stage: diagnostic.stage, httpStatus, ...(issueCodes.length ? { issueCodes } : {}), ...providerThrowCodes(diagnostic.providerThrow) },
    recoveredAfterTimeout: false,
    durationMs,
    instructedConsequences: null,
    // A refusal's diagnostic carries the request and nothing else about the
    // gate: the declarations and the cross-check live on a proposal, and a
    // refused build left none.
    declaredConsequences: null,
    consequenceCrossCheck: null,
    permissionRequest: diagnostic.permissionRequest ? permissionRequestOf(diagnostic.permissionRequest) : null,
    // A refused build left no proposal, so no finishing verdict.
    judged: null,
  });
}

/** The codes of Core's account of an unnamed throw, each held to a code's shape; its message is not published. */
function providerThrowCodes(thrown: { errorClass?: string; errorCode?: string; causeClass?: string; causeCode?: string } | undefined): { providerThrow?: NonNullable<NonNullable<CreatedFlowBuild["failure"]>["providerThrow"]> } {
  if (!thrown) return {};
  const codes = Object.fromEntries((["errorClass", "errorCode", "causeClass", "causeCode"] as const).flatMap((field) => {
    const value = thrown[field];
    return typeof value === "string" && THROW_CODE.test(value) ? [[field, value]] : [];
  }));
  return Object.keys(codes).length === 0 ? {} : { providerThrow: Object.freeze(codes) };
}

/** A build that left no proposal to read: its refusal code, whether Core reached a provider, and how long it took. Nothing is known of what it spent. */
export function failedCreatedFlowBuild(failure: NonNullable<CreatedFlowBuild["failure"]>, providerInvocation: CreatedFlowBuild["providerInvocation"], durationMs: number): CreatedFlowBuild {
  return failed(failure, providerInvocation, durationMs);
}

function failed(failure: NonNullable<CreatedFlowBuild["failure"]>, providerInvocation: CreatedFlowBuild["providerInvocation"], durationMs: number): CreatedFlowBuild {
  return Object.freeze({ outcome: "failed", adaptationId: null, providerCalls: null, loopProviderCalls: null, providerInvocation, accounting: null, evidenceLoop: null, failure, recoveredAfterTimeout: false, durationMs, instructedConsequences: null, declaredConsequences: null, consequenceCrossCheck: null, permissionRequest: null, judged: null });
}

function accountingOf(value: { provider?: string; model?: string; inputTokens?: number; outputTokens?: number; totalTokens?: number; estimatedCostUsd?: number; budgetBreaches?: number }): CreatedFlowBuildAccounting {
  return {
    provider: value.provider !== undefined && isVocabulary(value.provider) ? value.provider : null,
    model: value.model !== undefined && isVocabulary(value.model) ? value.model : null,
    inputTokens: value.inputTokens ?? null,
    outputTokens: value.outputTokens ?? null,
    totalTokens: value.totalTokens ?? null,
    estimatedCostUsd: value.estimatedCostUsd ?? null,
    ...(Number.isSafeInteger(value.budgetBreaches) && (value.budgetBreaches as number) >= 0 ? { budgetBreaches: value.budgetBreaches as number } : {}),
  };
}

/** The distinct tool ids among `values`, sorted: identifiers only, and none of Core's own decision steps. */
function vocabulary(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => isVocabulary(value) && !CORE_DECISION_STEP_IDS.has(value)))].sort();
}

function isVocabulary(value: string): boolean {
  return value.length <= MAX_VOCABULARY_ID_LENGTH && VOCABULARY_ID.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new RunnerFailure("runtime.behavior", "Core answered the Flow build with a malformed payload");
  return value;
}

/** Core's request for the person, cut to what the build record needs to show it. */
function permissionRequestOf(request: { action: { kind: string; verb: string }; control: { name: string | null; kind: string | null }; consequences: readonly string[]; missing: readonly string[]; authority?: { instructed?: ReadonlyArray<{ consequence: string; quote: string }> } }): CreatedFlowPermissionRequest {
  return Object.freeze({
    actionKind: request.action.kind,
    verb: request.action.verb,
    controlName: request.control.name,
    controlKind: request.control.kind,
    consequences: Object.freeze([...request.consequences]),
    missing: Object.freeze([...request.missing]),
    instructed: Object.freeze((request.authority?.instructed ?? []).map((entry) => Object.freeze({ consequence: entry.consequence, quote: entry.quote.slice(0, 200) }))),
  });
}
