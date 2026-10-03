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
import type { CreatedFlowBuild, CreatedFlowBuildLlm, PersistedFlowLlmExecution } from "../flow-lane/index.js";
import { authorizeFlowLiveLlmExecution, installLiveLlmSessionKey, type LiveLlmAuthorizationControl } from "./authorize-flow.js";
import { assertLiveLlmBudgetHeld } from "./budget.js";
import { budgetOverProductFailure } from "./budget-over-product-failure.js";
import { assertProviderCallsAsDeclared, type DeclaredProviderCalls } from "./declared-provider-calls.js";
import { liveLlmBuildUsage } from "./build-usage.js";
import { liveLlmBuildCostCeilingUsd } from "./build-cost-ceiling.js";
import { liveLlmCoreDefaultModel } from "./core-default-model.js";
import { readLiveLlmExploration, type LiveLlmExplorationControl, type LiveLlmExplorationRecord } from "./exploration-record.js";
import { planLiveLlmExecution, type LiveLlmPlan } from "./live-llm-plan.js";
import { liveLlmObservedUsage, type LiveLlmObservedUsage } from "./observed-usage.js";
import { resolveLiveLlmProviderCredential, type LiveLlmProviderCredential } from "./provider-credential.js";
import { readLiveLlmReauthor, type LiveLlmReauthorRecord } from "./reauthor-record.js";
import { liveLlmRunSpend, type LiveLlmRunSpend } from "./run-spend.js";
import { readLiveLlmStepLogSpend, type LiveLlmStepLogSpend } from "./step-log-spend.js";
import type { ProviderFailureRequestBounds } from "../provider-failure/index.js";

/** What the run needs from whichever Core it is driving, kept structural so this module imports no topology. */
export type LiveLlmRunCredentials = { projectId?: string; authorizationPassword?: string; authorizationPin?: string };
/** The bundle, as far as this module needs one. */
export type LiveLlmRunBundle = { writeStructured(bundlePath: string, value: unknown): Promise<unknown> };
/**
 * What a settlement reads the run back through: the parsed detail for the
 * accounting, and the raw call for the exploration record, which lives in
 * `metadata.recoveryTrace` and does not survive the client's parser.
 */
type LiveLlmRunDetailReader = { getRunDetail(projectId: string, runId: string): Promise<ExistingRunDetail> } & LiveLlmExplorationControl;
type LiveLlmPublish = (details: Record<string, unknown>) => Promise<unknown>;

/**
 * Plans and credentials a live run, or refuses. Every refusal fails closed: a
 * profile Core could not execute inside its own stated bounds, a lane the task
 * does not run on, a target this runner does not own, and an absent
 * credential, are refusals before a topology starts -- never a quiet fall back
 * to a deterministic run that would then report a green result no model saw.
 *
 * `create-flow` builds its Flow from an instruction, so it runs without the
 * recorded Flow lane; every other task authorizes the Flow that lane builds
 * from the run's recording, so it needs it.
 */
export async function beginLiveLlmRun(input: {
  profile: LlmExecutionProfile;
  repositoryRoot: string;
  environment: NodeJS.ProcessEnv;
  flowLane: boolean;
  targetMode: string;
  /**
   * Where the per-build cost ceiling and Core's default model are read: what
   * `buildFluxIQEnvironment` gives Core, by default this process's arguments
   * and environment. The default model is read from `args`' `--llm-model` only.
   */
  costCeilingSources?: { args: readonly string[]; environment: NodeJS.ProcessEnv };
}): Promise<LiveLlmRun> {
  const sources = input.costCeilingSources ?? { args: process.argv, environment: process.env };
  const plan = planLiveLlmExecution(input.profile, liveLlmBuildCostCeilingUsd(input.repositoryRoot, sources.args, sources.environment), liveLlmCoreDefaultModel(sources.args));
  assertLaneFlag(plan, input.flowLane);
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
  /** Whether the plan's own Flow (or build) was readied for the model; a run never readied spent nothing to settle. */
  private prepared = false;
  /** What the bounded exploration did, read at settlement; `undefined` before that. */
  private exploration: LiveLlmExplorationRecord | undefined;
  /** What Core's result verification did on the settled run; `undefined` before that. */
  private verification: LiveLlmVerificationRecord | undefined;
  /** What the settled run's re-author spent, from Core's record of it; `undefined` before that. */
  private reauthor: LiveLlmReauthorRecord | undefined;
  /** A created Flow's build record, kept so the repair's settlement rewrites the snapshot with it. */
  private buildRecord: CreatedFlowBuild | undefined;
  /** Whether a created Flow's playback was readied for the model, and what that run spent; `undefined` before it settled. */
  private repairPrepared = false;
  private repairObserved: LiveLlmObservedUsage | undefined;
  /** The run's step log (`steps/`), where Core writes every provider call; `undefined` for a run that keeps none. */
  private stepLogDirectory: string | undefined;
  /** What that log held when the snapshot was last written; `null` before then, or when there was none. */
  private stepLog: LiveLlmStepLogSpend | null = null;
  /** What the run's scenario declares about provider calls; `null` until the runner reads the resolved workflow, and for a scenario that declares nothing. */
  private declaredCalls: DeclaredProviderCalls | null = null;

  constructor(private readonly plan: LiveLlmPlan, private readonly credential: LiveLlmProviderCredential) {}

  /**
   * Where Core logs this run's model and tool steps (`FLUXIQ_LLM_STEP_LOG_DIR`).
   * Every settlement reads it again, so the run's totals count the calls only
   * the log records: the chat's own, and a re-author's Core did not count
   * (`run-spend.ts`).
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
   * person's own unlocked session -- can reach the provider. Nothing is pinned
   * to a Flow: the chat creates and builds its Flow inside one Core command, on
   * Core's own limits for a new Flow, and the build is held to this run's caps
   * when it is settled.
   */
  chatBuildAuthorizer(control: LiveLlmAuthorizationControl, core: LiveLlmRunCredentials): () => Promise<void> {
    return async () => {
      if (this.plan.purpose !== "build_and_adapt") throw new RunnerFailure("fixture.invalid", `A ${this.plan.purpose} run cannot build a Flow`);
      this.assertChatBuildable();
      if (!core.authorizationPassword) throw new RunnerFailure("environment.missing", "A live LLM run needs the account password its Core was bootstrapped with, and this topology published none");
      await installLiveLlmSessionKey(control, { plan: this.plan, credentialValue: this.credential.value, authorizationPassword: core.authorizationPassword, ...(core.authorizationPin ? { authorizationPin: core.authorizationPin } : {}) });
      this.prepared = true;
    };
  }

  /**
   * Whether the intent this run's Flow runs with lets Core propose a repair
   * and never apply it: `diagnose_and_adapt`, whose target override is a
   * proposal and whose failed action is not retried. Such a run cannot end the
   * way a repaired one would, so a scenario may hold it to what it declares
   * instead.
   */
  get proposesRepairOnly(): boolean {
    return this.repairPurpose === "diagnose_and_adapt";
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
   * build's, the Flow run's own, Core's result check, any re-author and the chat's own
   * (`run-spend.ts`). `calls` stays 0 until the run has settled.
   */
  get usage(): LlmUsage {
    return { mode: "live", profileId: this.plan.profileId, calls: this.spend().calls };
  }

  /**
   * Every call the run made, by phase. A created Flow's `observed` is its
   * build, and its playback is the run phase; any other run's `observed` is
   * the run itself. The phases are each budgeted where they settle; this only
   * adds them up.
   */
  private spend(repairObserved: LiveLlmObservedUsage | undefined = this.repairObserved): LiveLlmRunSpend {
    const created = this.buildRecord !== undefined;
    return liveLlmRunSpend({ build: created ? this.observed : undefined, runtime: created ? repairObserved : this.observed, judge: this.verification, reauthor: this.reauthor, stepLog: this.stepLog, ceilingUsd: this.plan.maxTotalEstimatedCostUsd });
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
   * Refuses a scenario run whose lanes do not fit this task: a `create-flow`
   * run needs an instruction task and no recorded Flow lane, and every other
   * task needs the recorded Flow lane and no instruction task.
   */
  assertLane(lane: { flowLane: boolean; creation: boolean }): void {
    assertLaneFlag(this.plan, lane.flowLane);
    if (this.createsFlow && !lane.creation) throw new RunnerFailure("fixture.invalid", "--llm-task create-flow needs an instruction task to build from, and this run carries none");
    if (!this.createsFlow && lane.creation) throw new RunnerFailure("fixture.invalid", `An instruction task is built only by --llm-task create-flow, not ${this.plan.task}`);
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
   * The Flow lane's hook: installs the key and saves the Flow's LLM settings
   * and spend ceiling, after the Flow exists and before it runs, and answers
   * with the run's intent and the consequences the operator permitted.
   */
  authorizer(control: LiveLlmAuthorizationControl, core: LiveLlmRunCredentials): (flowId: string) => Promise<PersistedFlowLlmExecution> {
    return async (flowId: string) => {
      const { purpose } = this.plan;
      if (purpose === "build_and_adapt") throw new RunnerFailure("fixture.invalid", "A build_and_adapt run builds a Flow; it never runs one");
      await this.authorize(control, core, flowId, this.plan);
      this.prepared = true;
      return { intent: purpose, permittedConsequences: this.plan.permittedConsequences };
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
      this.prepared = true;
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
      if (!this.createsFlow) throw new RunnerFailure("fixture.invalid", `Only a create-flow run repairs the Flow it built; a ${this.plan.task} run readies its Flow through the Flow lane`);
      await this.authorize(control, core, flowId, this.repairPlan);
      this.repairPrepared = true;
      return { intent: CREATED_FLOW_REPAIR_PURPOSE, permittedConsequences: this.plan.permittedConsequences };
    };
  }

  /**
   * Reads what the run spent, publishes it, and holds it to its caps.
   *
   * The accounting is written before either check, so a run that overspent or
   * reached no provider still leaves the evidence that says so. Both checks run
   * before the lane's own expectations are judged: a live run that failed at
   * being a live run must not be masked by whatever the automation then did.
   */
  async settle(control: LiveLlmRunDetailReader, input: { projectId: string; runId: string }, bundle: LiveLlmRunBundle, publish: LiveLlmPublish): Promise<void> {
    const detail = await control.getRunDetail(input.projectId, input.runId);
    // Read before the snapshot is written, and never allowed to fail the
    // settlement: it says what exploring did, not whether the run was legal.
    await this.readRunRecords(control, input);
    await this.settleObserved(liveLlmObservedUsage(detail), bundle, publish, {}, this.declaredCalls, true);
  }

  /**
   * The same settlement for a Flow build, from the build's own record. The
   * snapshot carries that record as `build`: the proposal's outcome, Core's
   * call count and totals, the evidence loop's counts, and any refusal code.
   * A build Core says ran on another provider or model fails here too.
   */
  async settleBuild(build: CreatedFlowBuild, bundle: LiveLlmRunBundle, publish: LiveLlmPublish): Promise<void> {
    this.buildRecord = build;
    // Deliberately no declaration: a build that reached no provider proposed
    // no Flow, so "the runtime absorbed it" can never be what happened here.
    try {
      await this.settleObserved(liveLlmBuildUsage(build), bundle, publish, { build }, null, false);
    } catch (error) {
      // The breach is thrown before the lane sees the build, so a build that
      // ended without a Flow is carried on it, or the run reads as the facility's.
      throw budgetOverProductFailure(error, buildWithoutFlowFailure(build));
    }
    const { provider, model } = build.accounting ?? {};
    if ((provider != null && provider !== this.plan.provider) || (model != null && model !== this.plan.model)) {
      throw new RunnerFailure("runtime.behavior", `Core's Flow build ran on ${provider ?? "an unreported provider"}/${model ?? "an unreported model"}, not the authorized ${this.plan.provider}/${this.plan.model}`);
    }
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
   */
  async settleRepair(control: LiveLlmRunDetailReader, input: { projectId: string; runId: string | undefined }, bundle: LiveLlmRunBundle, publish: LiveLlmPublish): Promise<void> {
    if (!this.repairPrepared || this.repairObserved) return;
    const plan = this.repairPlan;
    let observed: LiveLlmObservedUsage | undefined;
    try {
      if (input.runId) observed = liveLlmObservedUsage(await control.getRunDetail(input.projectId, input.runId));
    } catch {
      observed = undefined;
    }
    if (input.runId) await this.readRunRecords(control, { projectId: input.projectId, runId: input.runId });
    const repair = {
      purpose: plan.purpose,
      runId: input.runId ?? null,
      authorized: { maxCalls: plan.maxCalls, maxTotalTokensPerRun: plan.maxTotalTokensPerRun, maxEstimatedCostUsd: plan.maxEstimatedCostUsd, maxTotalEstimatedCostUsd: plan.maxTotalEstimatedCostUsd, timeoutMs: plan.timeoutMs },
      observed: observed ?? null,
      ...(observed ? {} : { settlement: input.runId ? "run_detail_unreadable" : "run_not_identified" }),
    };
    await this.writeSnapshot(bundle, this.observed ?? null, { ...(this.buildRecord ? { build: this.buildRecord } : {}), repair }, observed);
    if (!observed) return;
    this.repairObserved = observed;
    await publish({ repair: usageSummary(observed), runTotal: spendSummary(this.spend()) });
    assertLiveLlmBudgetHeld(plan, observed);
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
   * The settlement for a run whose lane failed before `settle` was reached.
   *
   * A lane that throws after Core ran the Flow -- an unexpected failure, a
   * failed expectation, a read that broke -- used to leave no
   * `snapshots/live-llm.json` at all, so the calls a provider was paid for
   * were never itemized (`run-mu4rpka7-845d919a`). This writes the same
   * snapshot from the same run detail, whenever the Flow was readied, and
   * publishes the same summary.
   *
   * It raises nothing itself. A budget breach is returned for the caller to
   * raise in place of the lane's failure, because a run that overspent failed
   * at being a live run whatever else went wrong; a run that reached no
   * provider is not, because the lane's own failure is the better
   * explanation. A run with no run id, or whose detail cannot be read, still
   * gets a snapshot, which says so and carries no usage. A run already
   * settled, or never readied, is left alone.
   */
  async settleUnfinished(control: LiveLlmRunDetailReader, input: { projectId: string; runId: string | undefined }, bundle: LiveLlmRunBundle, publish: LiveLlmPublish): Promise<RunnerFailure | undefined> {
    if (this.observed || !this.prepared) return undefined;
    let observed: LiveLlmObservedUsage | undefined;
    try {
      if (input.runId) observed = liveLlmObservedUsage(await control.getRunDetail(input.projectId, input.runId));
    } catch {
      observed = undefined;
    }
    // A lane that failed after exploring is exactly the run whose exploration
    // record is worth having, so it is read here too, on the same run id.
    if (input.runId) await this.readRunRecords(control, { projectId: input.projectId, runId: input.runId });
    if (!observed) {
      await this.writeSnapshot(bundle, null, { settlement: input.runId ? "run_detail_unreadable" : "run_not_identified" });
      return undefined;
    }
    this.observed = observed;
    await this.writeSnapshot(bundle, observed, { settlement: "lane_failed" });
    await publish({ ...usageSummary(observed), runTotal: spendSummary(this.spend()), settledAfterLaneFailure: true });
    try {
      assertLiveLlmBudgetHeld(this.plan, observed);
    } catch (breach) {
      if (breach instanceof RunnerFailure) return breach;
      throw breach;
    }
    return undefined;
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

  private async settleObserved(observed: LiveLlmObservedUsage, bundle: LiveLlmRunBundle, publish: LiveLlmPublish, extra: Record<string, unknown>, declared: DeclaredProviderCalls | null, withRunTotal: boolean): Promise<void> {
    this.observed = observed;
    await this.writeSnapshot(bundle, observed, extra);
    await publish({ ...usageSummary(observed), ...(withRunTotal ? { runTotal: spendSummary(this.spend()) } : {}), ...(declared ? { declaredProviderCalls: declared.count } : {}) });
    assertLiveLlmBudgetHeld(this.plan, observed);
    assertProviderCallsAsDeclared(this.plan, observed, declared);
  }

  /**
   * `snapshots/live-llm.json`: what was authorized, what the run permitted, and
   * what it spent, or `null` where that could not be read.
   *
   * `observed.calls` and `observed.totalEstimatedCostUsd` are the whole run's
   * (`run-spend.ts`), because they are the figures every reader of this file
   * takes as what the run cost -- the machine's spend ledger among them. The
   * rest of `observed` is still the phase it was settled from, `observed.phases`
   * and `runSpend` break the total down, and `build`, `repair` and
   * `verification` keep each phase's own record as before.
   */
  private async writeSnapshot(bundle: LiveLlmRunBundle, observed: LiveLlmObservedUsage | null, extra: Record<string, unknown>, repairObserved?: LiveLlmObservedUsage): Promise<void> {
    if (this.stepLogDirectory) this.stepLog = await readLiveLlmStepLogSpend(this.stepLogDirectory);
    const spend = this.spend(repairObserved ?? this.repairObserved);
    await bundle.writeStructured("snapshots/live-llm.json", {
      schemaVersion: "0.1",
      profileId: this.plan.profileId,
      provider: this.plan.provider,
      model: this.plan.model,
      task: this.plan.task,
      purpose: this.plan.purpose,
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
      observed: observed ? { ...observed, calls: spend.calls, totalEstimatedCostUsd: spend.totalEstimatedCostUsd, phases: spend.phases, perBuild: spend.perBuild } : null,
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

/** The whole run's calls and cost, for the settle event, and any build that spent past the per-build ceiling. */
function spendSummary(spend: LiveLlmRunSpend): Record<string, unknown> {
  return { calls: spend.calls, totalEstimatedCostUsd: spend.totalEstimatedCostUsd, ...(spend.perBuild.overCeiling > 0 ? { buildsOverCeiling: spend.perBuild.overCeiling, perBuildCeilingUsd: spend.perBuild.ceilingUsd } : {}), ...(spend.uncountedPhases.length > 0 ? { uncountedPhases: spend.uncountedPhases } : {}) };
}

/** What a settlement publishes on the run's event stream: counts and a total, never a call. */
function usageSummary(observed: LiveLlmObservedUsage): Record<string, unknown> {
  return { calls: observed.calls, interventions: observed.interventions, totalEstimatedCostUsd: observed.totalEstimatedCostUsd, ...(observed.gate ? { llmGate: observed.gate } : {}) };
}

function assertLaneFlag(plan: LiveLlmPlan, flowLane: boolean): void {
  if (plan.task === "create-flow") {
    if (flowLane) throw new RunnerFailure("fixture.invalid", "--llm-task create-flow builds its Flow from an instruction task, not from the run's recording: drop --flow");
    return;
  }
  if (!flowLane) throw new RunnerFailure("fixture.invalid", "A live LLM run needs the Flow lane: pass --flow, which is what builds the Flow the provider is authorized against");
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
