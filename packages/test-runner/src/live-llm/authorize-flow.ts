// The two steps between a generated Flow and a live provider call, in the one
// order that works: install the key, then pin the Flow's settings to it.
//
// Nothing here authorizes a model call. A model call needs no grant: Core
// resolves the provider from the caller's own unlocked Secret Keys session and
// holds the run to the spend limit saved in the Flow's settings. What remains
// the operator's to allow is a consequence -- moving money, deleting, sending
// -- and that travels with the build or the run as `permittedConsequences`,
// not through anything this module takes out.

import { configureFlowLiveLlmExecution, type LiveLlmFlowSettingsControl } from "./flow-settings.js";
import type { LiveLlmPlan } from "./live-llm-plan.js";
import { ensureLiveLlmSecretKey, type LiveLlmSecretKeyControl } from "./secret-key.js";

export type LiveLlmAuthorizationControl = LiveLlmSecretKeyControl & LiveLlmFlowSettingsControl & {
  /** Replaces this client's session, so a key installed a moment ago is inside its Secret Keys unlock. */
  reauthenticate(): Promise<void>;
};

/** The opaque key reference a Flow was pinned to. Never the key. */
export type LiveLlmAuthorization = Readonly<{ secretKeyId: string; secretKeyName: string }>;

/**
 * Readies one Flow for a live provider run. The credential is passed in and
 * used exactly once, by the Secret Keys install; nothing this returns carries
 * it, so the value a caller holds never has to travel further.
 */
export async function authorizeFlowLiveLlmExecution(control: LiveLlmAuthorizationControl, input: {
  projectId: string;
  flowId: string;
  plan: LiveLlmPlan;
  credentialValue: string;
  authorizationPassword: string;
  authorizationPin?: string;
}): Promise<LiveLlmAuthorization> {
  const key = await installLiveLlmSessionKey(control, input);
  await configureFlowLiveLlmExecution(control, { projectId: input.projectId, flowId: input.flowId, plan: input.plan, secretKeyId: key.secretKeyId });
  return key;
}

/**
 * Puts the run's key in the person's Secret Keys and makes sure their session
 * can release it, and nothing else. This is all a build started from the
 * extension's chat can be given beforehand: the paired extension's chat runs
 * on the person's own unlocked session (`conversations/commands/caller.ts` in
 * Core), and its Flow is created and built inside one Core command, so there is
 * no Flow to pin settings to before it.
 */
export async function installLiveLlmSessionKey(control: Pick<LiveLlmAuthorizationControl, "secretKeysCall" | "reauthenticate">, input: {
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
  // that existed then, and Core releases a key to a model call only from the
  // caller's own unlocked session. A key this call just installed is exactly
  // one that session cannot decrypt, so the session is replaced before the
  // first model call could need it.
  if (key.created) await control.reauthenticate();
  return Object.freeze({ secretKeyId: key.id, secretKeyName: key.name });
}
