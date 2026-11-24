import path from "node:path";
import type { ScenarioPersonChecks, WebScenario } from "@fluxiq-web-extension/test-contracts";
import { armScenarioVariant } from "../../../lab-control/index.js";
import { expectedPersonHandOff, pendingPersonAsks, scenarioTabs } from "../../../person-simulation/index.js";
import { attemptPersonFor } from "../../live/attempt-person.js";
import { openPreflightScriptedSession } from "../scripted-session.js";
import { judgeSiteChallenge, type SiteChallengeObservation, type SiteChallengeVerdict } from "./judge.js";
import { planSiteChallenge } from "./plan.js";
import { newProbeSink, type SiteChallengeProbeSink } from "./probe-sink.js";
import { siteChallengeProbeScript } from "./probe-script.js";
import { raiseSiteCheck } from "./raise-check.js";

const DOMAIN_ID = "web-automation";
/** How long the check may take to draw once the page is armed: crossborder's covers the page a second and a half after it loads. */
const ARMED_WITHIN_MS = 20_000;
/** The build reaches its first look within seconds; this is the wait for the product to hand the check over. */
const ASK_WITHIN_MS = 120_000;
/** After the person passes, the build looks again and reads. */
const CONTINUES_WITHIN_MS = 120_000;
const POLL_MS = 1_000;

export type SiteChallengeProof = Readonly<{
  proof: "site_challenge";
  verdict: SiteChallengeVerdict;
  observation: SiteChallengeObservation;
  plan: "variant" | "lab_raise" | "none";
  variantId: string | null;
  scenarioId: string;
  model: { decisionRequests: number; firstPageShowedCheck: boolean | null; readResultKeys: readonly string[]; calls: number };
  /** The first line of the error that stopped the stage, bounded: the Lab's own failure, never a page's words. */
  stageNote: string | null;
  externalUsd: 0;
}>;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const stageCode = (error: unknown): string => (error instanceof Error && /^preflight_[a-z_]+$/u.test(error.message) ? error.message : "stage_error");
const firstLine = (error: unknown): string => (error instanceof Error ? error.message : String(error)).split("\n", 1)[0]!.slice(0, 120);

/**
 * The site's own declared check, met through the real product path. The check is brought up the way the site's campaign
 * task brings it up; the paired extension's chat starts the task; the product must hand the check to the person with
 * the ask shown in the chat and the check untouched; the Lab's person then passes it through the module's own steps and
 * presses Continue in the chat; and the run must go on to read the restored site. The product never gets the answer:
 * only the Lab's person reads it, in `playPersonCheck`, and a check already guessed at is declined there.
 */
export async function proveSiteChallenge(input: { repositoryRoot: string; fluxiqRepositoryRoot: string; scenarioLabDist: string; scenario: WebScenario; module: ScenarioPersonChecks; taskId: string; instruction: string; evidenceDirectory: string }): Promise<SiteChallengeProof> {
  const { scenario, module } = input;
  const plan = planSiteChallenge(module, scenario);
  const sink: SiteChallengeProbeSink = newProbeSink();
  const base = { proof: "site_challenge" as const, plan: plan.how, variantId: plan.how === "variant" ? plan.variant.id : null, scenarioId: scenario.id, externalUsd: 0 as const };
  const noObservation = (stageError: string): SiteChallengeObservation => ({ armedCheck: null, personRequired: module.handOffs.some(({ required }) => required), askOnThread: false, askInChat: false, handOff: null, clearedItself: false, after: null, stageError });
  if (plan.how === "none") return finish(base, noObservation("no_way_to_bring_the_check_up"), sink, 0);
  let opened: Awaited<ReturnType<typeof openPreflightScriptedSession>>;
  try {
    opened = await openPreflightScriptedSession({ ...input, runLabel: "site-challenge", seed: scenario.seed, startPath: scenario.startPath, script: siteChallengeProbeScript(input.taskId, module.checks.map(({ shows }) => shows), sink) });
  } catch (error) {
    return finish(base, noObservation(stageCode(error)), sink, 0, firstLine(error));
  }
  const { session, server } = opened;
  let observation: SiteChallengeObservation = noObservation("stage_error");
  let note: string | null = null;
  try {
    observation = await observe({ ...input, plan, session, sink });
  } catch (error) {
    observation = { ...observation, stageError: stageCode(error) };
    note = firstLine(error);
  } finally {
    await opened.close();
  }
  return finish(base, observation, sink, server.calls().length, note);
}

function finish(base: { proof: "site_challenge"; plan: SiteChallengeProof["plan"]; variantId: string | null; scenarioId: string; externalUsd: 0 }, observation: SiteChallengeObservation, sink: SiteChallengeProbeSink, calls: number, stageNote: string | null = null): SiteChallengeProof {
  return { ...base, verdict: judgeSiteChallenge(observation), observation, model: { decisionRequests: sink.decisions, firstPageShowedCheck: sink.firstPageShowedCheck, readResultKeys: sink.readResultKeys, calls }, stageNote };
}

async function observe(input: { evidenceDirectory: string; scenarioLabDist: string; scenario: WebScenario; module: ScenarioPersonChecks; instruction: string; plan: Exclude<ReturnType<typeof planSiteChallenge>, { how: "none" }>; session: Awaited<ReturnType<typeof openPreflightScriptedSession>>["session"]; sink: SiteChallengeProbeSink }): Promise<SiteChallengeObservation> {
  const { session, scenario, module, sink, plan } = input;
  const origin = session.topology.scenarioOrigin;
  const token = session.topology.allocation.controllerToken;
  const page = session.browser.scenario;
  const scope = { projectId: session.projectId, domainId: DOMAIN_ID };
  let state: SiteChallengeObservation = { armedCheck: null, personRequired: module.handOffs.some(({ required }) => required), askOnThread: false, askInChat: false, handOff: null, clearedItself: false, after: null, stageError: null };
  if (plan.how === "variant") {
    await armScenarioVariant(origin, token, scenario.id, plan.variant);
    await page.reload({ waitUntil: "domcontentloaded" });
  } else {
    await raiseSiteCheck(plan.scenarioId, page, origin, scenario.startPath);
  }
  const armedCheck = await shownCheck(session.browser.context, origin, module, ARMED_WITHIN_MS);
  if (armedCheck === null) return { ...state, stageError: "declared_check_not_shown" };
  state = { ...state, armedCheck };

  const originalFlows = new Set((await session.control.listFlowSummaries(session.projectId)).map((flow) => flow.flowId));
  await session.send(input.instruction);
  const askDeadline = Date.now() + ASK_WITHIN_MS;
  while (Date.now() < askDeadline && !state.askOnThread) {
    if (sink.checkGoneAfterRead !== null) return { ...state, clearedItself: true, after: { readSucceeded: sink.readSucceeded, checkGone: sink.checkGoneAfterRead }, stageError: "check_cleared_without_a_person" };
    state = { ...state, askOnThread: (await pendingPersonAsks(session.control, scope)).some((ask) => ask.kind === "person_check") };
    if (!state.askOnThread) await sleep(POLL_MS);
  }
  if (!state.askOnThread) return { ...state, stageError: "no_person_ask_on_thread" };
  state = { ...state, askInChat: await session.browser.panel!.shows("FluxIQ needs you", 20_000) };

  const taskPerson = expectedPersonHandOff({ module, workflowId: plan.how === "variant" ? plan.workflowId : undefined, variantId: plan.how === "variant" ? plan.variant.id : undefined });
  const person = await attemptPersonFor({
    control: session.control, projectId: session.projectId, context: session.browser.context, scenarioOrigin: origin, runToken: token,
    scenarioId: scenario.id, scenarioLabDist: input.scenarioLabDist, workflowId: plan.how === "variant" ? plan.workflowId : undefined, variantId: plan.how === "variant" ? plan.variant.id : undefined,
    task: taskPerson ?? undefined, permissionPoint: undefined, panel: session.browser.panel,
  });
  const run = await person.start(0);
  const afterDeadline = Date.now() + CONTINUES_WITHIN_MS;
  while (Date.now() < afterDeadline && sink.checkGoneAfterRead === null && !person.answerFailure) await sleep(POLL_MS);
  await run.finish();
  const record = person.snapshotOf(0)?.handOffs[0];
  // A person who could not pass the check leaves a picture of the fixture page: synthetic content, and the only way to see why.
  if (record && !record.cleared) await page.screenshot({ path: path.join(input.evidenceDirectory, "site-challenge-person-failed.png") }).catch(/* best-effort: the verdict already names the failure */ () => undefined);
  state = { ...state, handOff: record ? { did: record.did, cleared: record.cleared, answer: record.answer, via: record.via ?? null, check: record.check, note: record.note } : null, stageError: person.answerFailure ? "person_answer_failed" : null };
  if (sink.checkGoneAfterRead !== null) state = { ...state, after: { readSucceeded: sink.readSucceeded, checkGone: sink.checkGoneAfterRead } };

  const flows = (await session.control.listFlowSummaries(session.projectId)).filter((flow) => !originalFlows.has(flow.flowId));
  for (const flow of flows) {
    await session.control.automationStudioCall("cancel-flow-bootstrap", { projectId: session.projectId, flowId: flow.flowId }, {}, DOMAIN_ID).catch(/* best-effort: the session closes next and takes the build with it */ () => undefined);
  }
  return state;
}

/** The id of the first declared check the scenario's newest tab shows within `withinMs`, or `null`. */
async function shownCheck(context: Parameters<typeof scenarioTabs>[0], origin: string, module: ScenarioPersonChecks, withinMs: number): Promise<string | null> {
  const deadline = Date.now() + withinMs;
  for (;;) {
    for (const tab of scenarioTabs(context, origin)) {
      for (const check of module.checks) if (await tab.shows(check.shows).catch(() => false)) return check.id;
    }
    if (Date.now() >= deadline) return null;
    await sleep(250);
  }
}
