// The three steps between a generated Flow and a live provider call, in the
// one order that works: install the key, pin the Flow's settings to it, then
// take out a grant against those saved settings. The grant binds to the Flow's
// settings revision, so it must be issued after the settings save and shortly
// before the run -- Core expires it within the minute.

import { issueLiveLlmExecutionGrant, type LiveLlmExecutionGrant, type LiveLlmGrantControl } from "./execution-grant.js";
import { configureFlowLiveLlmExecution, type LiveLlmFlowSettingsControl } from "./flow-settings.js";
import type { LiveLlmPlan } from "./live-llm-plan.js";
import { ensureLiveLlmSecretKey, type LiveLlmSecretKeyControl } from "./secret-key.js";

export type LiveLlmAuthorizationControl = LiveLlmSecretKeyControl & LiveLlmFlowSettingsControl & LiveLlmGrantControl & {
  /** Replaces this client's session, so a key installed a moment ago is inside its Secret Keys unlock. */
  reauthenticate(): Promise<void>;
};

/** The grant a run carries, with the opaque key reference it was issued against. */
export type LiveLlmAuthorization = Readonly<{ grant: LiveLlmExecutionGrant; secretKeyId: string; secretKeyName: string }>;

/**
 * Authorizes one live provider run against one Flow. The credential is passed
 * in and used exactly once, by the Secret Keys install; nothing this returns
 * carries it, so the value a caller holds never has to travel further.
 */
export async function authorizeFlowLiveLlmExecution(control: LiveLlmAuthorizationControl, input: {
  projectId: string;
  flowId: string;
  plan: LiveLlmPlan;
  credentialValue: string;
  authorizationPassword: string;
  authorizationPin?: string;
}): Promise<LiveLlmAuthorization> {
  const key = await ensureLiveLlmSecretKey(control, {
    secretValue: input.credentialValue,
    authorizationPassword: input.authorizationPassword,
    ...(input.authorizationPin ? { authorizationPin: input.authorizationPin } : {}),
    model: input.plan.model,
  });
  // A FluxIQ session's Secret Keys unlock is computed at login, over the keys
  // that existed then, and Core refuses an execution grant on a key the session
  // cannot decrypt. A key this call just installed is exactly that key, so the
  // session is replaced before the grant is asked for. Without this the grant
  // is refused with a 400 on a Flow that is configured perfectly.
  if (key.created) await control.reauthenticate();
  await configureFlowLiveLlmExecution(control, { projectId: input.projectId, flowId: input.flowId, plan: input.plan, secretKeyId: key.id });
  const grant = await issueLiveLlmExecutionGrant(control, { projectId: input.projectId, flowId: input.flowId, secretKeyId: key.id, plan: input.plan });
  return Object.freeze({ grant, secretKeyId: key.id, secretKeyName: key.name });
}
