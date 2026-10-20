// One live provider run, from the parsed command line to the attested result.
//
// The runner owns a scenario run; it should not also own the Flow's LLM
// settings, the credential's provenance, or the arithmetic of a budget. All of
// that lives here, behind three moments the runner does understand: begin one
// before anything starts, ready the Flow the lane just built (or is about to
// build) for the model, and settle the accounting once the provider work is
// done. A model call needs no grant; the only thing a run carries is its
// intent and the consequences the operator permitted (`--llm-permit`).

import { type LlmActionConsequence, type LlmExecutionProfile, type LlmUsage } from "@fluxiq-web-extension/test-contracts";
import type { ExistingRunDetail } from "../existing-fluxiq-control.js";
import { RunnerFailure } from "../failure.js";
import { withSettledBuild, type CreatedFlowBuild, type CreatedFlowBuildLlm, type CreatedFlowSettledBuild, type PersistedFlowLlmExecution } from "../flow-lane/index.js";
import { authorizeFlowLiveLlmExecution, installLiveLlmSessionKey, type LiveLlmAuthorizationControl } from "./authorize-flow.js";
import { assertLiveLlmBudgetHeld } from "./budget.js";
import { budgetOverProductFailure } from "./budget-over-product-failure.js";
import { assertProviderCallsAsDeclared, type DeclaredProviderCalls } from "./declared-provider-calls.js";
import { liveLlmBuildUsage } from "./build-usage.js";
import { liveLlmBuildCostCeilingUsd } from "./build-cost-ceiling.js";
import { liveLlmCoreDefaultModel } from "./core-default-model.js";
import { labAuthoringModeValue } from "./authoring-mode-env.js";
import { readLiveLlmExploration, type LiveLlmExplorationControl, type LiveLlmExplorationRecord } from "./exploration-record.js";
import { assertLiveLlmLaunchable, planLiveLlmExecution, type LiveLlmPlan } from "./live-llm-plan.js";
import { assertLlmMaxCostWithinCeiling } from "./max-cost-within-ceiling.js";
import { liveLlmObservedUsage, type LiveLlmObservedUsage } from "./observed-usage.js";
import { resolveLiveLlmProviderCredential, type LiveLlmProviderCredential } from "./provider-credential.js";
import { readLiveLlmReauthor, type LiveLlmReauthorRecord } from "./reauthor-record.js";
import { liveLlmRunSpend, type LiveLlmFlowSpendControl, type LiveLlmRunSpend } from "./flow-spend.js";
import { LiveLlmFlowSpendReader } from "./spend-reader.js";
import { stepLogObservedCalls } from "./call-rows.js";
import type { ProviderFailureRequestBounds } from "../provider-failure/index.js";

/** What the run needs from whichever Core it is driving, kept structural so this module imports no topology. */
export type LiveLlmRunCredentials = { projectId?: string; authorizationPassword?: string; authorizationPin?: string };
/** The bundle, as far as this module needs one. */
export type LiveLlmRunBundle = { writeStructured(bundlePath: string, value: unknown): Promise<unknown> };
/**
 * What a settlement reads the run back through: the parsed detail for the
 * accounting, the raw call for the exploration record, which lives in
 * `metadata.recoveryTrace` and does not survive the client's parser, and the
 * Flow's spend as Core's purse recorded it (`./flow-spend.ts`).
 */
type LiveLlmRunDetailReader = { getRunDetail(projectId: string, runId: string): Promise<ExistingRunDetail> } & LiveLlmExplorationControl & LiveLlmFlowSpendControl;
type LiveLlmPublish = (details: Record<string, unknown>) => Promise<unknown>;

/**
 * Plans and credentials a live run, or refuses. Every refusal fails closed: a
 * profile Core could not execute inside its own stated bounds, a task that ran
 * only on a retired lane, a target this runner does not own, and an absent
 * credential, are refusals before a topology starts -- never a quiet fall back
 * to a deterministic run that would then report a green result no model saw.
 *
 * A live run launches `create-flow` only, which builds its Flow from an
 * instruction task; the tasks that ran on the retired recording-built lane are
 * refused with the path that replaced them (`assertLiveLlmLaunchable`).
 */
export async function beginLiveLlmRun(input: {
  profile: LlmExecutionProfile;
  repositoryRoot: string;
  environment: NodeJS.ProcessEnv;
  targetMode: string;
  /**
   * Where the per-build cost ceiling and Core's default model are read: what
   * `buildFluxIQEnvironment` gives Core, by default this process's arguments
   * and environment. The default model is read from `args`' `--llm-model` only.
   */
  costCeilingSources?: { args: readonly string[]; environment: NodeJS.ProcessEnv };
}): Promise<LiveLlmRun> {
  const sources = input.costCeilingSources ?? { args: process.argv, environment: process.env };
  const buildCostCeilingUsd = liveLlmBuildCostCeilingUsd(input.repositoryRoot, sources.args, sources.environment);
  // A typed --llm-max-cost-usd above that ceiling is refused, never clamped in silence.
  assertLlmMaxCostWithinCeiling(sources.args, buildCostCeilingUsd);
  const plan = planLiveLlmExecution(input.profile, buildCostCeilingUsd, liveLlmCoreDefaultModel(sources.args), labAuthoringModeValue(sources.args));
  assertLiveLlmLaunchable(plan);
  if (input.targetMode !== "isolated" && input.targetMode !== "persistent-isolated") {
    throw new RunnerFailure("fixture.invalid", `A live LLM run needs a Core this runner owns, and the ${input.targetMode} target's is not; use --target isolated or persistent-isolated`);
  }
  const credential = await resolveLiveLlmProviderCredential({ repositoryRoot: input.repositoryRoot, environment: input.environment, provider: plan.provider });
  return new LiveLlmRun(plan, credential);
}

/**
 * The intent a created Flow's playback runs with: `explore_and_adapt`, which
 * explores the page and tries its repair live.
 *
 * It was `diagnose_and_adapt` -- which only ever proposes a target override and
 * never executes one. The narrow intent had become the thing blocking every
 * repair: the route that takes a wrong answer back into exploration accepts
 * `explore_and_adapt` only, so under `diagnose_and_adapt` a run that answered
 * wrongly was diagnosed and then refused -- three times in
 * run-mug2h8ur-8aa317b6, with 15 of its 26 calls and $1.99 of its $2 unspent.
 */
const CREATED_FLOW_REPAIR_PURPOSE = "explore_and_adapt" satisfies PersistedFlowLlmExecution["intent"];

/**
 * What Core's result verification did on one run, as `snapshots/live-llm.json`
 * states it: the status and verdict words Core recorded, and every
 * verification call the run detail itemizes.
 *
 * Core asks whether a finished run's result answers the request, and asks a
 * `does not answer` once more with the same evidence. Those calls are paid
 * for, but they are made after the run and outside its run budget, so the
 * per-call lines and Core's accounting do not list them; until this record, a
 * bundle never said they happened (`w2-save-and-replay.md`). They are read
 * from the run's interventions, which Core marks
 * `metadata.source: "verifyAutomationStudioRunResult"`.
 *
 * Counts, closed-vocabulary words and token figures only. Core's `reason` is
 * a sentence and is left behind, as the exploration record leaves its own.
 */
type LiveLlmVerificationRecord = {
  /** `run-detail` when Core recorded a verification, `absent` when it recorded none, `unreadable` when the detail could not be read. */
  source: "run-detail" | "absent" | "unreadable";
  /** Core's `resultVerification.status`: `confirmed`, `refuted`, `unverified` or `no_result`. */
  status: string | null;
  basis: string | null;
  code: string | null;
  /** The verdict each call reached, in order, as Core recorded them. */
  verdicts: string[];
  /** Core's own count of the calls, where it recorded one. */
  recordedCalls: number | null;
  /** Verification calls the run detail itemizes. */
  calls: number;
  interventions: LiveLlmVerificationCall[];
  totalEstimatedCostUsd: number;
};

type LiveLlmVerificationCall = {
  /** 1 for the first call, 2 for the repeat of a `does not answer`. */
  check: number | null;
  requestId: string | null;
  validationOk: boolean | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  estimatedCostUsd: number | null;
};

const VERIFICATION_SOURCE = "verifyAutomationStudioRunResult";
const VERIFICATION_WORD = /^[a-z][a-z0-9_.:-]{1,127}$/u;
const NO_VERIFICATION: LiveLlmVerificationRecord = { source: "absent", status: null, basis: null, code: null, verdicts: [], recordedCalls: null, calls: 0, interventions: [], totalEstimatedCostUsd: 0 };

export class LiveLlmRun {
  private observed: LiveLlmObservedUsage | undefined;
  /** What the bounded exploration did, read at settlement; `undefined` before that. */
  private exploration: LiveLlmExplorationRecord | undefined;
  /** What Core's result verification did on the settled run; `undefined` before that. */
  private verification: LiveLlmVerificationRecord | undefined;
  /** What the settled run's re-author spent, from Core's record of it; `undefined` before that. */
  private reauthor: LiveLlmReauthorRecord | undefined;
  /** A created Flow's build record, kept so the repair's settlement rewrites the snapshot with it. */
  private buildRecord: CreatedFlowBuild | undefined;
  /**
   * Where the build record's `instructedConsequences` came from: Core's build
   * record -- its proposal or, for a build that left none, its failure
   * diagnostic (t728) -- or neither. The Lab no longer reads it from the step
   * log: Core publishes it on both records.
   */
  private instructedFrom: "proposal" | "failure_diagnostic" | null = null;
  /** Whether a created Flow's playback was readied for the model, and what that run spent; `undefined` before it settled. */
  private repairPrepared = false;
  private repairObserved: LiveLlmObservedUsage | undefined;
  /** The run's step log (`steps/`), where Core writes every provider call; `undefined` for a run that keeps none. */
  private stepLogDirectory: string | undefined;
  /** The run's Flow, and its spend as Core's purse records it (`./spend-reader.ts`). */
  private readonly flowSpend = new LiveLlmFlowSpendReader();
  /** What that purse held when it was last read; unknown (`not_settled`) before then. */
  private runSpend: LiveLlmRunSpend;
  /** What the run's scenario declares about provider calls; `null` until the runner reads the resolved workflow, and for a scenario that declares nothing. */
  private declaredCalls: DeclaredProviderCalls | null = null;

  constructor(private readonly plan: LiveLlmPlan, private readonly credential: LiveLlmProviderCredential) {
    this.runSpend = liveLlmRunSpend(null, plan.maxTotalEstimatedCostUsd, "not_settled");
  }
  get authorizedBuildCallLimit(): number { return this.plan.maxCalls; }
  /** The authoring mode the run's Core was started in (`./authoring-mode-env.ts`). */
  get coreAuthoringMode(): LiveLlmPlan["coreAuthoringMode"] { return this.plan.coreAuthoringMode; }

  /**
   * Where Core logs this run's model and tool steps (`FLUXIQ_LLM_STEP_LOG_DIR`).
   * Every settlement lists the calls it holds, one row each (`call-rows.ts`);
   * the run's totals are Core's purse's, never the log's (`flow-spend.ts`).
   */
  readStepLogFrom(stepsDirectory: string): void {
    this.stepLogDirectory = stepsDirectory;
  }

  /** Whether this run builds its Flow from an instruction task rather than from a recording. */
  get createsFlow(): boolean {
    return this.plan.task === "create-flow";
  }

  /**
   * Refuses, before anything starts, what a build typed into the extension's
   * chat cannot honor. The chat sends no operator permit with the build -- a
   * lasting act is asked about in the thread and answered there, by the Lab's
   * person at the task's point -- and Core's chat builds a new Flow on its own
   * default model. A run that permitted a consequence or chose another model
   * would be measuring something it never asked for.
   *
   * **The model.** That default is what the Lab gave the run's Core
   * (`plan.coreDefaultModel`, `FLUXIQ_LLM_DEFAULT_MODEL` from `--llm-model`,
   * `./default-model-env.ts`), so a chat build runs on the run's model exactly
   * when the two are equal; `--llm-model deepseek-v4-pro` gives Core that
   * default, and the build runs on it.
   *
   * **The per-build ceiling.** Every build is held to one ceiling however it is
   * started: Core's run cost ceiling as the Lab passed it to the run's Core
   * (`plan.buildCostCeilingUsd`, `FLUXIQ_LLM_RUN_COST_CEILING_USD`), lowered by the
   * Flow's own `maxEstimatedCostUsdPerRun` (`loop-limits/flow-bootstrap-
   * evidence-loop.ts`, computed in `service.ts` for every
   * `generate-flow-bootstrap-adaptation`, which is the call the chat's
   * `flow.createHere` makes too). This run's ceiling is the same function of
   * `--llm-max-cost-usd` (`live-llm-plan.ts`), and the direct build writes it
   * onto the Flow. A chat build's Flow is made inside Core's command, so a
   * ceiling the operator lowered has no Flow to be written onto and would not
   * hold: the build would run to Core's own. Refused here, so the number a run
   * reports as its ceiling is always the one the build was held to.
   */
  assertChatBuildable(): void {
    if (!this.createsFlow) return;
    const direct = "or pass --direct-api-build for a test-only run that is never counted as a pass";
    if (this.plan.permittedConsequences.length > 0) {
      throw new RunnerFailure("fixture.invalid", `--llm-permit ${this.plan.permittedConsequences.join(",")} cannot reach a build started from the extension's chat: the chat sends no permit, and the Lab's person answers FluxIQ's question at the task's permission point instead. Leave it out, ${direct}`);
    }
    if (this.plan.model !== this.plan.coreDefaultModel) {
      throw new RunnerFailure("fixture.invalid", `A build started from the extension's chat runs on the default model the run's Core was started with (${this.plan.coreDefaultModel}), not ${this.plan.model}. Pass --llm-model ${this.plan.model} so the Lab starts Core on it, ${direct}`);
    }
    const ceiling = this.plan.buildCostCeilingUsd;
    if (this.plan.maxTotalEstimatedCostUsd !== ceiling) {
      throw new RunnerFailure("fixture.invalid", `A build started from the extension's chat is held to FluxIQ's per-build ceiling of $${ceiling}, and --llm-max-cost-usd ${this.plan.maxTotalEstimatedCostUsd} cannot reach the Flow the chat makes. Leave --llm-max-cost-usd out, ${direct}`);
    }
  }

  /**
   * The created-Flow lane's chat build hook: puts the run's key in the
   * person's Secret Keys, so the build the extension's chat starts -- on the
   * person's own unlocked session -- can reach the provider. The owning topology
   * has already supplied its resolved Lab allowance to Core before startup;
   * settlement independently checks the build against the same authorization.
   */
  chatBuildAuthorizer(control: LiveLlmAuthorizationControl, core: LiveLlmRunCredentials): () => Promise<void> {
    return async () => {
      if (this.plan.purpose !== "build_and_adapt") throw new RunnerFailure("fixture.invalid", `A ${this.plan.purpose} run cannot build a Flow`);
      this.assertChatBuildable();
      if (!core.authorizationPassword) throw new RunnerFailure("environment.missing", "A live LLM run needs the account password its Core was bootstrapped with, and this topology published none");
      // The chat makes its Flow inside Core's command; the project's Flows now are what tells settlement which one it made.
      if (core.projectId) await this.flowSpend.beforeChatBuild(control, core.projectId);
      await installLiveLlmSessionKey(control, { plan: this.plan, credentialValue: this.credential.value, authorizationPassword: core.authorizationPassword, ...(core.authorizationPin ? { authorizationPin: core.authorizationPin } : {}) });
    };
  }

  /**
   * Whether this run repairs a Flow that failed, and so whether the repair it
   * produced can be approved, applied and replayed: `adapt`, which proposes one
   * target override, `repair`, which explores first and whose patch Core may
   * execute, and `create-flow`, whose built Flow's playback runs with
   * `explore_and_adapt`. A diagnosis changes nothing, so it does not qualify.
   */
  get repairsFlow(): boolean {
    return this.repairPurpose === "diagnose_and_adapt" || this.repairPurpose === "explore_and_adapt";
  }

  /**
   * The task that produced a repair, and the intent it was produced under, for
   * the repair lane's record. A `create-flow` run's repair comes from its
   * playback, not its build, so `describe()`'s `build_and_adapt` would name the
   * wrong one.
   */
  describeRepair(): { task: string; purpose: string } {
    return { task: this.plan.task, purpose: this.repairPurpose };
  }

  /** The intent this run's Flow runs with: the plan's own, or a created Flow's playback intent. */
  private get repairPurpose(): LiveLlmPlan["purpose"] {
    return this.createsFlow ? CREATED_FLOW_REPAIR_PURPOSE : this.plan.purpose;
  }

  /**
   * The credential, for the run's redaction attestation to scan for. It is
   * deliberately not added to the bundle's redactor: a redactor would scrub it
   * on write and hide the very leak the scan exists to find.
   */
  get redactionLiterals(): readonly string[] {
    return [this.credential.value];
  }

  /**
   * The bounds the run authorized a single provider call to have, for the
   * local provider-failure diagnostic to record beside a failure. A request
   * refused for its size means nothing without the limit it was refused
   * against, and the published bundle's `live-llm.json` is a different file
   * that a reader of the diagnostic may not have.
   */
  get providerRequestBounds(): ProviderFailureRequestBounds {
    return {
      provider: this.plan.provider,
      model: this.plan.model,
      maxInputTokens: this.plan.tokenLimits.maxInputTokens,
      maxOutputTokens: this.plan.tokenLimits.maxOutputTokens,
      maxTotalTokensPerRequest: this.plan.tokenLimits.maxTotalTokens,
      maxCallsPerRun: this.plan.maxCalls,
      maxTotalTokensPerRun: this.plan.maxTotalTokensPerRun,
      timeoutMs: this.plan.timeoutMs,
    };
  }

  /**
   * What the evaluation records: every provider call this run paid for -- the
   * build's, the Flow run's own, every judge, any re-author and the chat's own
   * -- as Core's purse counted them (`flow-spend.ts`). `calls` stays 0 until
   * the run has settled. Where Core kept no itemised record the evaluation,
   * which needs a number, gets the calls Core's settled phase records reported
   * (the build's and the playback's): a floor, not a total.
   */
  get usage(): LlmUsage {
    return { mode: "live", profileId: this.plan.profileId, calls: this.runSpend.calls ?? (this.observed?.calls ?? 0) + (this.repairObserved?.calls ?? 0) };
  }

  /** Reads the Flow's spend from Core again, so what is written and published next is what its purse holds now. */
  private async refreshSpend(): Promise<void> {
    this.runSpend = await this.flowSpend.read(this.plan.maxTotalEstimatedCostUsd);
  }

  /**
   * The plan a created Flow's playback runs under: this run's own bounds, with
   * the playback's intent in place of the build's. The operator's caps bind it
   * exactly as they bind the build, so asking for the repair widens no limit.
   */
  private get repairPlan(): LiveLlmPlan {
    return { ...this.plan, task: "repair", purpose: CREATED_FLOW_REPAIR_PURPOSE };
  }

  /**
   * Refuses a scenario run that does not fit this task: a live run is a
   * `create-flow` run (`assertLiveLlmLaunchable`), which needs an instruction
   * task to build from.
   */
  assertLane(lane: { creation: boolean }): void {
    assertLiveLlmLaunchable(this.plan);
    if (!lane.creation) throw new RunnerFailure("fixture.invalid", "--llm-task create-flow needs an instruction task to build from, and this run carries none");
  }

  /**
   * What the run's scenario or variant declares about provider calls, read
   * once the workflow is resolved and before anything starts. A declaration
   * holds the Flow run to spending nothing in place of the default check that
   * it spent something (`declared-provider-calls.ts`); it never reaches the
   * build, whose own settlement keeps that check whatever was declared.
   */
  expectProviderCalls(declared: DeclaredProviderCalls | null): void {
    this.declaredCalls = declared;
  }

  /**
   * What this run is authorized to do, for a dry run to print: the plan's
   * bounds and where the credential was found, never the credential.
   */
  describe() {
    const plan = this.plan;
    return {
      profileId: plan.profileId,
      provider: plan.provider,
      model: plan.model,
      coreDefaultModel: plan.coreDefaultModel,
      coreAuthoringMode: plan.coreAuthoringMode,
      task: plan.task,
      purpose: plan.purpose,
      authorized: {
        maxCalls: plan.maxCalls,
        tokenLimits: plan.tokenLimits,
        maxTotalTokensPerRun: plan.maxTotalTokensPerRun,
        timeoutMs: plan.timeoutMs,
        maxEstimatedCostUsd: plan.maxEstimatedCostUsd,
        maxTotalEstimatedCostUsd: plan.maxTotalEstimatedCostUsd,
      },
      permittedConsequences: [...plan.permittedConsequences],
      credentialSource: { name: this.credential.name, from: this.credential.source },
    };
  }

  /**
   * The created-Flow lane's build hook. Called once the blank Flow exists and
   * its instruction is saved, just before the build, and answers with the
   * consequences the operator permitted the build.
   */
  buildAuthorizer(control: LiveLlmAuthorizationControl, core: LiveLlmRunCredentials): (flowId: string) => Promise<CreatedFlowBuildLlm> {
    return async (flowId: string) => {
      if (this.plan.purpose !== "build_and_adapt") throw new RunnerFailure("fixture.invalid", `A ${this.plan.purpose} run cannot build a Flow`);
      await this.authorize(control, core, flowId, this.plan);
      this.flowSpend.name(control, core.projectId!, flowId);
      return { permittedConsequences: this.plan.permittedConsequences };
    };
  }

  /**
   * The created-Flow lane's repair hook: readies its playback for the model,
   * so a created Flow that fails is diagnosed and repaired like any other
   * rather than refused for want of a model, and its result is judged. Called
   * once the review has applied the build and just before the run. A replay
   * carries no model, so it stays exactly as deterministic as before.
   */
  repairAuthorizer(control: LiveLlmAuthorizationControl, core: LiveLlmRunCredentials): (flowId: string) => Promise<PersistedFlowLlmExecution> {
    return async (flowId: string) => {
      await this.authorize(control, core, flowId, this.repairPlan);
      this.flowSpend.name(control, core.projectId!, flowId);
      this.repairPrepared = true;
      return { intent: CREATED_FLOW_REPAIR_PURPOSE, permittedConsequences: this.plan.permittedConsequences };
    };
  }

  /**
   * Reads what the build spent, publishes it, and holds it to its caps, from
   * the build's own record. The accounting is written before either check, so
   * a build that overspent or reached no provider still leaves the evidence
   * that says so. The snapshot carries that record as `build`: the proposal's outcome, Core's
   * call count and totals, the evidence loop's counts, and any refusal code.
   * A build Core says ran on another provider or model fails here too.
   *
   * Answers with that record and where its instructed consequences came from,
   * so the lane keeps the same build in `flow-lane.json` as this snapshot keeps
   * in `live-llm.json`. Both come from Core's build record: its proposal, or a
   * failed build's diagnostic (`flow-lane/creation/build-proposal.ts`).
   */
  async settleBuild(build: CreatedFlowBuild, bundle: LiveLlmRunBundle, publish: LiveLlmPublish): Promise<CreatedFlowSettledBuild> {
    // Set before anything below can throw, and carried on whatever is thrown
    // (`withSettledBuild`): a breach or a build that reached no provider is the
    // run that most needs its record, and flow-lane.json must hold this one too.
    this.instructedFrom = build.instructedConsequences === null ? null : build.outcome === "failed" ? "failure_diagnostic" : "proposal";
    this.buildRecord = build;
    const answer: CreatedFlowSettledBuild = Object.freeze({ build, instructedConsequencesFrom: this.instructedFrom });
    // Deliberately no declaration: a build that reached no provider proposed
    // no Flow, so "the runtime absorbed it" can never be what happened here.
    try {
      // The Flow's purse counts a build its record gave no call count for (a candidate-mode build, t466).
      await this.refreshSpend();
      await this.settleObserved(liveLlmBuildUsage(build, this.runSpend), bundle, publish, { build });
    } catch (error) {
      // The breach is thrown before the lane sees the build, so a build that
      // ended without a Flow is carried on it, or the run reads as the facility's.
      throw withSettledBuild(budgetOverProductFailure(error, buildWithoutFlowFailure(build)), answer);
    }
    const { provider, model } = build.accounting ?? {};
    if ((provider != null && provider !== this.plan.provider) || (model != null && model !== this.plan.model)) {
      throw withSettledBuild(new RunnerFailure("runtime.behavior", `Core's Flow build ran on ${provider ?? "an unreported provider"}/${model ?? "an unreported model"}, not the authorized ${this.plan.provider}/${this.plan.model}`), answer);
    }
    return answer;
  }

  /**
   * What a created Flow's repair spent, settled however its run ended. The
   * lane calls this before it judges anything, and on a throw, so a repair
   * whose Flow still failed -- the ordinary case -- is accounted all the same.
   *
   * The snapshot keeps it beside the build, never folded into it: `repair`
   * holds the intent, the bounds it ran under and the run's own per-call record,
   * and the campaign sums the two only where it reports a row's spend. A run
   * detail that cannot be read is recorded as such and raises nothing; an
   * overspend is raised, as it is for every live run. Reaching no provider is
   * not a failure here: a repair Core refused before diagnosis calls nothing,
   * and says why in the run's recovery record.
   *
   * Core's post-run result checks are filed among the run's interventions, but
   * they are not a repair: `repair.observed` lists recovery only, the checks
   * are `verification`'s, and they settle with an event of their own
   * (`resultChecks`). The run's whole spend is Core's purse's, read once the
   * run detail has named the Flow.
   */
  async settleRepair(control: LiveLlmRunDetailReader, input: { projectId: string; runId: string | undefined }, bundle: LiveLlmRunBundle, publish: LiveLlmPublish): Promise<void> {
    if (!this.repairPrepared || this.repairObserved) return;
    const plan = this.repairPlan;
    let observed: LiveLlmObservedUsage | undefined;
    try {
      if (input.runId) {
        const detail = await control.getRunDetail(input.projectId, input.runId);
        observed = liveLlmObservedUsage(detail);
        this.flowSpend.name(control, input.projectId, detail.summary.flowId);
      }
    } catch {
      observed = undefined;
    }
    if (input.runId) await this.readRunRecords(control, { projectId: input.projectId, runId: input.runId });
    await this.refreshSpend();
    const checks = this.verification?.interventions ?? [];
    const checksCost = checks.reduce((sum, call) => sum + (call.estimatedCostUsd ?? 0), 0);
    const recovery = observed ? this.withoutResultChecks(observed, checks) : undefined;
    const repair = {
      purpose: plan.purpose,
      runId: input.runId ?? null,
      authorized: { maxCalls: plan.maxCalls, maxTotalTokensPerRun: plan.maxTotalTokensPerRun, maxEstimatedCostUsd: plan.maxEstimatedCostUsd, maxTotalEstimatedCostUsd: plan.maxTotalEstimatedCostUsd, timeoutMs: plan.timeoutMs },
      observed: recovery ?? null,
      ...(observed ? {} : { settlement: input.runId ? "run_detail_unreadable" : "run_not_identified" }),
      ...(checks.length > 0 ? { resultChecks: { calls: checks.length, totalEstimatedCostUsd: Number(checksCost.toFixed(9)), record: "verification" } } : {}),
    };
    await this.writeSnapshot(bundle, this.observed ?? null, { ...(this.buildRecord ? { build: this.buildRecord } : {}), repair });
    if (!observed || !recovery) return;
    this.repairObserved = observed;
    const runTotal = spendSummary(this.runSpend);
    // A playback that only had its result checked made no repair, so it publishes none; one that called nothing at all still settles as before.
    if (recovery.calls > 0 || recovery.interventions > 0 || checks.length === 0) await publish({ repair: usageSummary(recovery), runTotal });
    if (checks.length > 0) await publish({ resultChecks: { calls: checks.length, totalEstimatedCostUsd: Number(checksCost.toFixed(9)), status: this.verification?.status ?? null }, runTotal });
    assertLiveLlmBudgetHeld(plan, observed);
  }

  /**
   * The playback's own usage without Core's result checks: where Core itemised
   * the Flow's spend, the calls and cost are its purse's `runtime` phase, which
   * Core keeps apart from its judges (no runtime phase is none spent), and the
   * run detail's own figures where it did not; the itemized calls and the
   * intervention count leave the checks out, matched by request id.
   */
  private withoutResultChecks(observed: LiveLlmObservedUsage, checks: LiveLlmVerificationRecord["interventions"]): LiveLlmObservedUsage {
    const runtime = this.runSpend.source === "flow_purse" ? this.runSpend.phases.runtime ?? { calls: 0, estimatedCostUsd: 0 } : null;
    const checkIds = new Set(checks.flatMap((call) => call.requestId ?? []));
    return {
      ...observed,
      calls: runtime?.calls ?? observed.calls,
      interventions: Math.max(0, observed.interventions - checks.length),
      observedCalls: observed.observedCalls.filter((call) => call.requestId === null || !checkIds.has(call.requestId)),
      totalEstimatedCostUsd: runtime?.estimatedCostUsd ?? observed.totalEstimatedCostUsd,
    };
  }

  private async authorize(control: LiveLlmAuthorizationControl, core: LiveLlmRunCredentials, flowId: string, plan: LiveLlmPlan): Promise<void> {
    if (!core.projectId) throw new RunnerFailure("environment.missing", "A live LLM run needs the project its Core created, and this topology published none");
    if (!core.authorizationPassword) throw new RunnerFailure("environment.missing", "A live LLM run needs the account password its Core was bootstrapped with, and this topology published none");
    await authorizeFlowLiveLlmExecution(control, {
      projectId: core.projectId,
      flowId,
      plan,
      credentialValue: this.credential.value,
      authorizationPassword: core.authorizationPassword,
      ...(core.authorizationPin ? { authorizationPin: core.authorizationPin } : {}),
    });
  }

  /**
   * The exploration and verification records, from one read of the raw run
   * detail: both live in it, and a settlement reads it once.
   */
  private async readRunRecords(control: LiveLlmExplorationControl, scope: { projectId: string; runId: string }): Promise<void> {
    let pending: Promise<unknown> | undefined;
    const once: LiveLlmExplorationControl = {
      automationStudioCall: (endpoint, payload, bounds) => endpoint === "get-flow-run-detail"
        ? (pending ??= control.automationStudioCall(endpoint, payload, bounds))
        : control.automationStudioCall(endpoint, payload, bounds),
    };
    this.exploration = await readLiveLlmExploration(once, scope);
    this.verification = await readLiveLlmVerification(once, scope);
    this.reauthor = await readLiveLlmReauthor(once, scope);
  }

  /**
   * The build's settlement, held to the plan's caps and to having reached a
   * provider. The scenario's declaration is deliberately not applied: it holds
   * a Flow run to spending nothing, and never reaches the build.
   */
  private async settleObserved(observed: LiveLlmObservedUsage, bundle: LiveLlmRunBundle, publish: LiveLlmPublish, extra: Record<string, unknown>): Promise<void> {
    this.observed = observed;
    await this.writeSnapshot(bundle, observed, extra);
    await publish(usageSummary(observed));
    assertLiveLlmBudgetHeld(this.plan, observed);
    assertProviderCallsAsDeclared(this.plan, observed, null);
  }

  /**
   * `snapshots/live-llm.json`: what was authorized, what the run permitted, and
   * what it spent, or `null` where that could not be read.
   *
   * `observed.calls` and `observed.totalEstimatedCostUsd` are the whole run's,
   * as Core's purse recorded the Flow's spend (`flow-spend.ts`), because they
   * are the figures every reader of this file takes as what the run cost -- the
   * machine's spend ledger among them -- and `null` where Core holds no figure
   * (`runSpend.source` says why). The rest of `observed` is the settled
   * phase's, but its rows are the step log's, one per call (`call-rows.ts`);
   * `observed.phases` and `runSpend` break the total down, and `build`,
   * `repair` and `verification` keep each phase's own. Callers read the spend
   * first (`refreshSpend`).
   */
  private async writeSnapshot(bundle: LiveLlmRunBundle, observed: LiveLlmObservedUsage | null, extra: Record<string, unknown>): Promise<void> {
    const spend = this.runSpend;
    const stepCalls = observed ? await stepLogObservedCalls(this.stepLogDirectory, observed, spend.calls ?? observed.calls) : undefined;
    await bundle.writeStructured("snapshots/live-llm.json", {
      schemaVersion: "0.1",
      profileId: this.plan.profileId,
      provider: this.plan.provider,
      model: this.plan.model,
      task: this.plan.task,
      purpose: this.plan.purpose,
      // The mode the run's Core authored in: a created Flow is built only in `legacy`.
      coreAuthoringMode: this.plan.coreAuthoringMode,
      credentialSource: { name: this.credential.name, from: this.credential.source },
      authorized: {
        maxCalls: this.plan.maxCalls,
        tokenLimits: this.plan.tokenLimits,
        maxTotalTokensPerRun: this.plan.maxTotalTokensPerRun,
        timeoutMs: this.plan.timeoutMs,
        maxEstimatedCostUsd: this.plan.maxEstimatedCostUsd,
        maxTotalEstimatedCostUsd: this.plan.maxTotalEstimatedCostUsd,
      },
      // The consequences the operator permitted (`--llm-permit`), exactly as
      // sent with the build or the run; empty permits none.
      permittedConsequences: [...this.plan.permittedConsequences] as LlmActionConsequence[],
      declared: this.plan.declared,
      // What the scenario or variant declared this run may spend, when it
      // declared anything: written on every snapshot, spent or not, so that a
      // run finishing with no provider call is readable as intended rather
      // than inferred from the zero beside it. `null` for the ordinary run,
      // which is held to reaching a provider (`declared-provider-calls.ts`).
      expectedProviderCalls: this.declaredCalls,
      observed: observed ? { ...observed, ...stepCalls, calls: spend.calls, totalEstimatedCostUsd: spend.totalEstimatedCostUsd, phases: spend.phases, perBuild: spend.perBuild } : null,
      // Every call the run made, by phase, written even when the phase this
      // snapshot settled from could not be read.
      runSpend: spend,
      // What the run's re-author spent, from Core's record of the run. `null`
      // before a settlement read one.
      reauthor: this.reauthor ?? null,
      // What the bounded exploration did on this run, from Core's own recovery
      // trace: counts, its outcome and the code that ended it. `null` before a
      // settlement read one; `source` says whether Core published one at all,
      // so an empty record is never read as "it explored nothing".
      exploration: this.exploration ?? null,
      // What Core's result verification did and every call it made, which the
      // accounting above does not include. `null` before a settlement read one.
      verification: this.verification ?? null,
      // Where `build.instructedConsequences` was read from, on a run that
      // settled a build: Core's build record (its proposal or its failure
      // diagnostic), or nowhere.
      ...(this.buildRecord ? { instructedConsequencesFrom: this.instructedFrom } : {}),
      ...extra,
    });
  }
}

/**
 * Reads the run's result verification from Core, or says why it could not.
 * It raises nothing, for the reason `readLiveLlmExploration` gives.
 */
async function readLiveLlmVerification(control: LiveLlmExplorationControl, scope: { projectId: string; runId: string }): Promise<LiveLlmVerificationRecord> {
  let payload: unknown;
  try {
    payload = await control.automationStudioCall("get-flow-run-detail", { projectId: scope.projectId, runId: scope.runId });
  } catch {
    return { ...NO_VERIFICATION, source: "unreadable" };
  }
  const detail = asRecord(asRecord(payload)?.runDetail);
  const recorded = asRecord(asRecord(detail?.metadata)?.resultVerification);
  const interventions = (Array.isArray(detail?.interventions) ? detail.interventions : [])
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => asRecord(item?.metadata)?.source === VERIFICATION_SOURCE)
    .map(verificationCall);
  if (!recorded && interventions.length === 0) return NO_VERIFICATION;
  return {
    source: "run-detail",
    status: word(recorded?.status),
    basis: word(recorded?.basis),
    code: word(recorded?.code),
    verdicts: Array.isArray(recorded?.verdicts) ? recorded.verdicts.flatMap((value) => word(value) ?? []) : [],
    recordedCalls: amount(recorded?.calls),
    calls: interventions.length,
    interventions,
    totalEstimatedCostUsd: interventions.reduce((sum, call) => sum + (call.estimatedCostUsd ?? 0), 0),
  };
}

function verificationCall(item: Record<string, unknown>): LiveLlmVerificationCall {
  const metadata = asRecord(item.metadata);
  const usage = asRecord(item.tokenUsage);
  const validation = asRecord(item.validation);
  const cost = usage?.estimatedCostUsd;
  return {
    check: amount(metadata?.verificationCheck),
    requestId: word(metadata?.requestId),
    validationOk: typeof validation?.ok === "boolean" ? validation.ok : null,
    inputTokens: amount(usage?.inputTokens),
    outputTokens: amount(usage?.outputTokens),
    totalTokens: amount(usage?.totalTokens),
    estimatedCostUsd: typeof cost === "number" && Number.isFinite(cost) && cost >= 0 ? cost : null,
  };
}

/** A closed-vocabulary word, or `null` for anything that is not one. Never a sentence. */
function word(value: unknown): string | null {
  return typeof value === "string" && VERIFICATION_WORD.test(value) ? value : null;
}

function amount(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

/**
 * The whole run's calls and cost, for the settle event, and a Flow that spent
 * past the ceiling; `spendSource` says why the figures are `null` or partial
 * when Core's purse held no itemised record of the Flow.
 */
function spendSummary(spend: LiveLlmRunSpend): Record<string, unknown> {
  return { calls: spend.calls, totalEstimatedCostUsd: spend.totalEstimatedCostUsd, ...(spend.perBuild.overCeiling > 0 ? { buildsOverCeiling: spend.perBuild.overCeiling, perBuildCeilingUsd: spend.perBuild.ceilingUsd } : {}), ...(spend.source === "flow_purse" ? {} : { spendSource: spend.source }) };
}

/** What a settlement publishes on the run's event stream: counts and a total, never a call. */
function usageSummary(observed: LiveLlmObservedUsage): Record<string, unknown> {
  return { calls: observed.calls, interventions: observed.interventions, totalEstimatedCostUsd: observed.totalEstimatedCostUsd, ...(observed.gate ? { llmGate: observed.gate } : {}) };
}

/**
 * The failure the created-Flow lane raises for a build that ended without a
 * Flow (`flow-lane/creation/lane.ts`), or `undefined` for a build that
 * proposed one or stopped to ask a person, which the lane judges itself.
 */
function buildWithoutFlowFailure(build: CreatedFlowBuild): RunnerFailure | undefined {
  if (build.outcome === "proposed" && build.adaptationId !== null) return undefined;
  if (build.outcome === "permission_required" && build.permissionRequest) return undefined;
  return new RunnerFailure("runtime.behavior", `FluxIQ did not build a Flow from the task's instruction (${build.failure?.code ?? "no proposal"})`, {
    details: { failure: build.failure, providerCalls: build.providerCalls, providerInvocation: build.providerInvocation },
  });
}
