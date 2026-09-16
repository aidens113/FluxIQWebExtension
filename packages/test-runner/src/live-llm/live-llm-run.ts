// One live provider run, from the parsed command line to the attested result.
//
// The runner owns a scenario run; it should not also own Core's grant
// vocabulary, the credential's provenance, or the arithmetic of a budget. All
// of that lives here, behind three moments the runner does understand: begin
// one before anything starts, authorize the Flow the lane just built, and
// settle the accounting once the Flow has run.

import type { LlmExecutionProfile, LlmUsage } from "@fluxiq-web-extension/test-contracts";
import type { ExistingRunDetail } from "../existing-fluxiq-control.js";
import { RunnerFailure } from "../failure.js";
import type { PersistedFlowLlmExecution } from "../flow-lane/index.js";
import { authorizeFlowLiveLlmExecution, type LiveLlmAuthorizationControl } from "./authorize-flow.js";
import { assertLiveLlmBudgetHeld, assertLiveLlmProviderWasReached } from "./budget.js";
import { planLiveLlmExecution, type LiveLlmPlan } from "./live-llm-plan.js";
import { liveLlmObservedUsage, type LiveLlmObservedUsage } from "./observed-usage.js";
import { resolveLiveLlmProviderCredential, type LiveLlmProviderCredential } from "./provider-credential.js";

/** What the run needs from whichever Core it is driving, kept structural so this module imports no topology. */
export type LiveLlmRunCredentials = { projectId?: string; authorizationPassword?: string; authorizationPin?: string };
/** The bundle, as far as this module needs one. */
export type LiveLlmRunBundle = { writeStructured(bundlePath: string, value: unknown): Promise<unknown> };
type LiveLlmRunDetailReader = { getRunDetail(projectId: string, runId: string): Promise<ExistingRunDetail> };

/**
 * Plans and credentials a live run, or refuses. Both halves fail closed: a
 * profile Core could not execute inside its own stated bounds, and an absent
 * credential, are refusals before a topology starts -- never a quiet fall back
 * to a deterministic run that would then report a green result no model saw.
 */
export async function beginLiveLlmRun(input: {
  profile: LlmExecutionProfile;
  repositoryRoot: string;
  environment: NodeJS.ProcessEnv;
  flowLane: boolean;
  targetMode: string;
}): Promise<LiveLlmRun> {
  const plan = planLiveLlmExecution(input.profile);
  if (!input.flowLane) throw new RunnerFailure("fixture.invalid", "A live LLM run needs the Flow lane: pass --flow, which is what builds the Flow the provider is authorized against");
  if (input.targetMode !== "isolated" && input.targetMode !== "persistent-isolated") {
    throw new RunnerFailure("fixture.invalid", `A live LLM run needs a Core this runner owns, and the ${input.targetMode} target's is not; use --target isolated or persistent-isolated`);
  }
  const credential = await resolveLiveLlmProviderCredential({ repositoryRoot: input.repositoryRoot, environment: input.environment, provider: plan.provider });
  return new LiveLlmRun(plan, credential);
}

export class LiveLlmRun {
  private observed: LiveLlmObservedUsage | undefined;

  constructor(private readonly plan: LiveLlmPlan, private readonly credential: LiveLlmProviderCredential) {}

  /**
   * The credential, for the run's redaction attestation to scan for. It is
   * deliberately not added to the bundle's redactor: a redactor would scrub it
   * on write and hide the very leak the scan exists to find.
   */
  get redactionLiterals(): readonly string[] {
    return [this.credential.value];
  }

  /** What the evaluation records. `calls` stays 0 until the run has settled. */
  get usage(): LlmUsage {
    return { mode: "live", profileId: this.plan.profileId, calls: this.observed?.calls ?? 0 };
  }

  /**
   * The Flow lane's authorization hook. Called after the Flow exists and just
   * before it runs, because Core issues the grant against that Flow's saved
   * settings and expires it within the minute.
   */
  authorizer(control: LiveLlmAuthorizationControl, core: LiveLlmRunCredentials): (flowId: string) => Promise<PersistedFlowLlmExecution> {
    return async (flowId: string) => {
      if (!core.projectId) throw new RunnerFailure("environment.missing", "A live LLM run needs the project its Core created, and this topology published none");
      if (!core.authorizationPassword) throw new RunnerFailure("environment.missing", "A live LLM run needs the account password its Core was bootstrapped with, and this topology published none");
      const authorization = await authorizeFlowLiveLlmExecution(control, {
        projectId: core.projectId,
        flowId,
        plan: this.plan,
        credentialValue: this.credential.value,
        authorizationPassword: core.authorizationPassword,
        ...(core.authorizationPin ? { authorizationPin: core.authorizationPin } : {}),
      });
      return { grantId: authorization.grant.grantId, purpose: authorization.grant.purpose };
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
  async settle(
    control: LiveLlmRunDetailReader,
    input: { projectId: string; runId: string },
    bundle: LiveLlmRunBundle,
    publish: (details: Record<string, unknown>) => Promise<unknown>,
  ): Promise<void> {
    const observed = liveLlmObservedUsage(await control.getRunDetail(input.projectId, input.runId));
    this.observed = observed;
    await bundle.writeStructured("snapshots/live-llm.json", {
      schemaVersion: "0.1",
      profileId: this.plan.profileId,
      provider: this.plan.provider,
      model: this.plan.model,
      task: this.plan.task,
      purpose: this.plan.purpose,
      credentialSource: { name: this.credential.name, from: this.credential.source },
      authorized: { maxCalls: this.plan.maxCalls, tokenLimits: this.plan.tokenLimits, timeoutMs: this.plan.timeoutMs, maxEstimatedCostUsd: this.plan.maxEstimatedCostUsd },
      declared: this.plan.declared,
      observed,
    });
    await publish({ calls: observed.calls, interventions: observed.interventions, totalEstimatedCostUsd: observed.totalEstimatedCostUsd, ...(observed.gate ? { llmGate: observed.gate } : {}) });
    assertLiveLlmBudgetHeld(this.plan, observed);
    assertLiveLlmProviderWasReached(this.plan, observed);
  }
}
