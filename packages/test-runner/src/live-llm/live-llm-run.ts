// One live provider run, from the parsed command line to the attested result.
//
// The runner owns a scenario run; it should not also own Core's grant
// vocabulary, the credential's provenance, or the arithmetic of a budget. All
// of that lives here, behind three moments the runner does understand: begin
// one before anything starts, authorize the Flow the lane just built (or is
// about to build), and settle the accounting once the provider work is done.

import type { LlmExecutionProfile, LlmUsage } from "@fluxiq-web-extension/test-contracts";
import type { ExistingRunDetail } from "../existing-fluxiq-control.js";
import { RunnerFailure } from "../failure.js";
import type { CreatedFlowBuild, PersistedFlowLlmExecution } from "../flow-lane/index.js";
import { authorizeFlowLiveLlmExecution, type LiveLlmAuthorization, type LiveLlmAuthorizationControl } from "./authorize-flow.js";
import { assertLiveLlmBudgetHeld, assertLiveLlmProviderWasReached } from "./budget.js";
import { liveLlmBuildUsage } from "./build-usage.js";
import type { LiveLlmExecutionGrant } from "./execution-grant.js";
import { readLiveLlmExploration, type LiveLlmExplorationControl, type LiveLlmExplorationRecord } from "./exploration-record.js";
import { planLiveLlmExecution, type LiveLlmPlan } from "./live-llm-plan.js";
import { liveLlmObservedUsage, type LiveLlmObservedUsage } from "./observed-usage.js";
import { resolveLiveLlmProviderCredential, type LiveLlmProviderCredential } from "./provider-credential.js";

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
}): Promise<LiveLlmRun> {
  const plan = planLiveLlmExecution(input.profile);
  assertLaneFlag(plan, input.flowLane);
  if (input.targetMode !== "isolated" && input.targetMode !== "persistent-isolated") {
    throw new RunnerFailure("fixture.invalid", `A live LLM run needs a Core this runner owns, and the ${input.targetMode} target's is not; use --target isolated or persistent-isolated`);
  }
  const credential = await resolveLiveLlmProviderCredential({ repositoryRoot: input.repositoryRoot, environment: input.environment, provider: plan.provider });
  return new LiveLlmRun(plan, credential);
}

/**
 * The purpose a created Flow's repair grant carries: `diagnose_and_adapt`,
 * which iterates, may gather evidence, and holds its target override to a
 * proposal it never executes (`patches.ts`). `explore_and_adapt` was tried
 * first and cannot serve: it tries its repair live, a granted run may never
 * authorize an external side effect, so an override on a Save button is
 * refused at preflight (`runtime_patch.side_effect_not_authorized`,
 * run-mu7gfuph-a57c6b18) and nothing is proposed at all.
 */
const CREATED_FLOW_REPAIR_PURPOSE = "diagnose_and_adapt" satisfies PersistedFlowLlmExecution["purpose"];

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
  /** The grant Core issued for this run, and what its request sent; `undefined` before that. */
  private grant: LiveLlmExecutionGrant | undefined;
  /** What the bounded exploration did, read at settlement; `undefined` before that. */
  private exploration: LiveLlmExplorationRecord | undefined;
  /** What Core's result verification did on the settled run; `undefined` before that. */
  private verification: LiveLlmVerificationRecord | undefined;
  /** A created Flow's build record, kept so the repair's settlement rewrites the snapshot with it. */
  private buildRecord: CreatedFlowBuild | undefined;
  /** The repair grant a created Flow's playback ran under, and what that run spent; `undefined` before each. */
  private repairGrant: LiveLlmExecutionGrant | undefined;
  private repairObserved: LiveLlmObservedUsage | undefined;

  constructor(private readonly plan: LiveLlmPlan, private readonly credential: LiveLlmProviderCredential) {}

  /** Whether this run builds its Flow from an instruction task rather than from a recording. */
  get createsFlow(): boolean {
    return this.plan.task === "create-flow";
  }

  /**
   * Whether the grant this run's Flow runs under lets Core propose a repair
   * and never apply it: `diagnose_and_adapt`, whose target override is a
   * proposal and whose failed action is not retried. Such a run cannot end the
   * way a repaired one would, so a scenario may hold it to what it declares
   * instead. A `create-flow` run qualifies: its build grant only builds, and
   * the Flow it built runs under `repairPlan`, which has this purpose.
   */
  get proposesRepairOnly(): boolean {
    return this.repairPurpose === "diagnose_and_adapt";
  }

  /**
   * Whether this run's grant repairs a Flow that failed, and so whether the
   * repair it produced can be approved, applied and replayed: `adapt`, which
   * proposes one target override, `repair`, which explores first and whose
   * patch Core may execute, and `create-flow`, whose built Flow runs under the
   * proposal-only grant `repairAuthorizer` issues. A diagnosis changes
   * nothing, so it does not qualify.
   */
  get repairsFlow(): boolean {
    return this.repairPurpose === "diagnose_and_adapt" || this.repairPurpose === "explore_and_adapt";
  }

  /**
   * The task that produced a repair, and the purpose of the grant it was
   * produced under, for the repair lane's record. A `create-flow` run's repair
   * comes from its playback's grant, not its build's, so `describe()`'s
   * `build_and_adapt` would name the wrong grant.
   */
  describeRepair(): { task: string; purpose: string } {
    return { task: this.plan.task, purpose: this.repairPurpose };
  }

  /** The purpose of the grant this run's Flow runs under: the plan's own, or a created Flow's playback grant. */
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
   * What the evaluation records: every provider call this run paid for, the
   * build's and a created Flow's repair alike. `calls` stays 0 until the run
   * has settled.
   */
  get usage(): LlmUsage {
    return { mode: "live", profileId: this.plan.profileId, calls: (this.observed?.calls ?? 0) + (this.repairObserved?.calls ?? 0) };
  }

  /**
   * The grant a created Flow's playback runs under: this run's own bounds,
   * with `diagnose_and_adapt` in place of the build's purpose. That purpose
   * may gather evidence from the live page and propose one target override,
   * which Core holds as a proposal awaiting approval and never executes (its
   * policy's `proposalMode` is `manual` under this grant, and a granted run is
   * never retried on an applied patch). The operator's caps bind it exactly as
   * they bind the build, so asking for the repair widens no limit.
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
   * What this run is authorized to do, for a dry run to print: the plan's
   * bounds and where the credential was found, never the credential.
   */
  describe() {
    const plan = this.plan;
    return {
      profileId: plan.profileId,
      provider: plan.provider,
      model: plan.model,
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
      highTokenConfirmation: plan.highTokenConfirmation,
      credentialSource: { name: this.credential.name, from: this.credential.source },
    };
  }

  /**
   * The Flow lane's authorization hook. Called after the Flow exists and just
   * before it runs, because Core issues the grant against that Flow's saved
   * settings and expires it within the minute.
   */
  authorizer(control: LiveLlmAuthorizationControl, core: LiveLlmRunCredentials): (flowId: string) => Promise<PersistedFlowLlmExecution> {
    return async (flowId: string) => {
      const { purpose } = this.plan;
      if (purpose === "build_and_adapt") throw new RunnerFailure("fixture.invalid", "A build_and_adapt grant authorizes a Flow build, never a Flow run");
      const authorization = await this.authorize(control, core, flowId, this.plan);
      this.grant = authorization.grant;
      return { grantId: authorization.grant.grantId, purpose };
    };
  }

  /**
   * The created-Flow lane's authorization hook. Called once the blank Flow
   * exists and its instruction is saved, just before the build, because Core
   * binds the grant to the Flow as it then stands.
   */
  buildAuthorizer(control: LiveLlmAuthorizationControl, core: LiveLlmRunCredentials): (flowId: string) => Promise<{ grantId: string }> {
    return async (flowId: string) => {
      if (this.plan.purpose !== "build_and_adapt") throw new RunnerFailure("fixture.invalid", `A ${this.plan.purpose} grant cannot authorize a Flow build`);
      const authorization = await this.authorize(control, core, flowId, this.plan);
      this.grant = authorization.grant;
      return { grantId: authorization.grant.grantId };
    };
  }

  /**
   * The created-Flow lane's repair hook: the grant its playback runs under, so
   * a created Flow that fails is diagnosed and repaired like any other rather
   * than refused for want of a model. Called once the review has applied the
   * build and just before the run, because Core binds a grant to the Flow as
   * it then stands and expires it within the minute.
   *
   * The same grant is what lets the run's result be judged: `diagnose_and_adapt`
   * covers Core's `loop_verification`, so a created Flow's playback needs no
   * separate `verify_result` grant. Only a `create-flow` run has one. A replay
   * issues no grant, so it stays exactly as deterministic as before.
   */
  repairAuthorizer(control: LiveLlmAuthorizationControl, core: LiveLlmRunCredentials): (flowId: string) => Promise<PersistedFlowLlmExecution> {
    return async (flowId: string) => {
      if (!this.createsFlow) throw new RunnerFailure("fixture.invalid", `Only a create-flow run repairs the Flow it built; a ${this.plan.task} run authorizes its Flow through the Flow lane`);
      const plan = this.repairPlan;
      const authorization = await this.authorize(control, core, flowId, plan);
      this.repairGrant = authorization.grant;
      return { grantId: authorization.grant.grantId, purpose: CREATED_FLOW_REPAIR_PURPOSE };
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
    await this.settleObserved(liveLlmObservedUsage(detail), bundle, publish, {});
  }

  /**
   * The same settlement for a Flow build, from the build's own record. The
   * snapshot carries that record as `build`: the proposal's outcome, Core's
   * call count and totals, the evidence loop's counts, and any refusal code.
   * A build Core says ran on another provider or model fails here too.
   */
  async settleBuild(build: CreatedFlowBuild, bundle: LiveLlmRunBundle, publish: LiveLlmPublish): Promise<void> {
    this.buildRecord = build;
    await this.settleObserved(liveLlmBuildUsage(build), bundle, publish, { build });
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
   * holds the purpose, what Core granted and the run's own per-call record,
   * and the campaign sums the two only where it reports a row's spend. A run
   * detail that cannot be read is recorded as such and raises nothing; an
   * overspend is raised, as it is for every live run. Reaching no provider is
   * not a failure here: a repair Core refused before diagnosis calls nothing,
   * and says why in the run's recovery record.
   */
  async settleRepair(control: LiveLlmRunDetailReader, input: { projectId: string; runId: string | undefined }, bundle: LiveLlmRunBundle, publish: LiveLlmPublish): Promise<void> {
    if (!this.repairGrant || this.repairObserved) return;
    const plan = this.repairPlan;
    const grant = this.repairGrant;
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
      granted: { maxCalls: grant.maxCalls, maxTotalTokensPerRun: grant.maxTotalTokensPerRun, maxEstimatedCostUsd: grant.maxEstimatedCostUsd, maxTotalEstimatedCostUsd: grant.maxTotalEstimatedCostUsd, timeoutMs: grant.timeoutMs },
      observed: observed ?? null,
      ...(observed ? {} : { settlement: input.runId ? "run_detail_unreadable" : "run_not_identified" }),
    };
    await this.writeSnapshot(bundle, this.observed ?? null, { ...(this.buildRecord ? { build: this.buildRecord } : {}), repair });
    if (!observed) return;
    this.repairObserved = observed;
    await publish({ repair: usageSummary(observed) });
    assertLiveLlmBudgetHeld(plan, observed);
  }

  private async authorize(control: LiveLlmAuthorizationControl, core: LiveLlmRunCredentials, flowId: string, plan: LiveLlmPlan): Promise<LiveLlmAuthorization> {
    if (!core.projectId) throw new RunnerFailure("environment.missing", "A live LLM run needs the project its Core created, and this topology published none");
    if (!core.authorizationPassword) throw new RunnerFailure("environment.missing", "A live LLM run needs the account password its Core was bootstrapped with, and this topology published none");
    const authorization = await authorizeFlowLiveLlmExecution(control, {
      projectId: core.projectId,
      flowId,
      plan,
      credentialValue: this.credential.value,
      authorizationPassword: core.authorizationPassword,
      ...(core.authorizationPin ? { authorizationPin: core.authorizationPin } : {}),
    });
    // Never sets `this.grant`: the build's grant is recorded by the authorizer
    // that issued it, and a created Flow's repair grant goes to `repairGrant`,
    // so the grant the snapshot reports is never replaced by a later one.
    return authorization;
  }

  /**
   * The settlement for a run whose lane failed before `settle` was reached.
   *
   * A lane that throws after Core ran the Flow -- an unexpected failure, a
   * failed expectation, a read that broke -- used to leave no
   * `snapshots/live-llm.json` at all, so the calls a provider was paid for
   * were never itemized (`run-mu4rpka7-845d919a`). This writes the same
   * snapshot from the same run detail, whenever a grant was issued, and
   * publishes the same summary.
   *
   * It raises nothing itself. A budget breach is returned for the caller to
   * raise in place of the lane's failure, because a run that overspent failed
   * at being a live run whatever else went wrong; a run that reached no
   * provider is not, because the lane's own failure is the better
   * explanation. A run with no run id, or whose detail cannot be read, still
   * gets a snapshot, which says so and carries no usage. A run already
   * settled, or never granted, is left alone.
   */
  async settleUnfinished(control: LiveLlmRunDetailReader, input: { projectId: string; runId: string | undefined }, bundle: LiveLlmRunBundle, publish: LiveLlmPublish): Promise<RunnerFailure | undefined> {
    if (this.observed || !this.grant) return undefined;
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
    await publish({ ...usageSummary(observed), settledAfterLaneFailure: true });
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
  }

  private async settleObserved(observed: LiveLlmObservedUsage, bundle: LiveLlmRunBundle, publish: LiveLlmPublish, extra: Record<string, unknown>): Promise<void> {
    this.observed = observed;
    await this.writeSnapshot(bundle, observed, extra);
    await publish(usageSummary(observed));
    assertLiveLlmBudgetHeld(this.plan, observed);
    assertLiveLlmProviderWasReached(this.plan, observed);
  }

  /** `snapshots/live-llm.json`: what was authorized, what Core granted, and what the run spent, or `null` where that could not be read. */
  private async writeSnapshot(bundle: LiveLlmRunBundle, observed: LiveLlmObservedUsage | null, extra: Record<string, unknown>): Promise<void> {
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
      // What Core actually issued, where it said. `null` for a run token budget
      // Core did not report.
      granted: this.grant
        ? { maxCalls: this.grant.maxCalls, maxTotalTokensPerRun: this.grant.maxTotalTokensPerRun, maxEstimatedCostUsd: this.grant.maxEstimatedCostUsd, maxTotalEstimatedCostUsd: this.grant.maxTotalEstimatedCostUsd, timeoutMs: this.grant.timeoutMs, permittedConsequences: [...this.grant.permittedConsequences] }
        : null,
      // Whether this run confirmed Core's high-token exposure on its own
      // behalf, and why: a confirmation nobody can see afterwards is consent
      // nobody can check.
      highTokenConfirmation: {
        sent: this.grant?.highTokenConfirmationSent === true,
        authorizedTokens: this.plan.highTokenConfirmation.authorizedTokens,
        threshold: this.plan.highTokenConfirmation.threshold,
        reason: this.plan.highTokenConfirmation.reason,
      },
      declared: this.plan.declared,
      observed,
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
