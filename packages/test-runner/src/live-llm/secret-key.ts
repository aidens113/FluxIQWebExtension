// The run's provider key, installed into Core the way a person would: as an
// encrypted Secret Key, authorized by the account's password and PIN. The
// credential reaches Core once, over loopback, inside this one call; every
// later step -- the Flow's settings, the execution grant, the run itself --
// carries only the opaque key id Core hands back.

import { RunnerFailure } from "../failure.js";

/** Core's own provider label for DeepSeek keys, as the Secret Keys program stores it. */
const CORE_PROVIDER_LABEL = "DeepSeek";
export const LAB_LIVE_LLM_KEY_NAME = "FluxIQ Testing Lab DeepSeek";

/** `created` is true when this call installed the key, which is what tells a caller its session predates it. */
export type LiveLlmSecretKeyReference = Readonly<{ id: string; name: string; created: boolean }>;

export type LiveLlmSecretKeyControl = {
  secretKeysCall(endpoint: string, payload: Record<string, unknown>): Promise<unknown>;
};

/**
 * Creates or reuses this Core's Testing Lab DeepSeek key and returns its opaque
 * reference. An isolated run's Core is new, so this creates one; a persistent
 * workspace's already holds it, so this reuses it after checking it is still
 * the enabled DeepSeek key it claims to be.
 */
export async function ensureLiveLlmSecretKey(control: LiveLlmSecretKeyControl, input: {
  secretValue: string;
  authorizationPassword: string;
  authorizationPin?: string;
  model: string;
  keyName?: string;
}): Promise<LiveLlmSecretKeyReference> {
  const keyName = input.keyName ?? LAB_LIVE_LLM_KEY_NAME;
  if (!input.secretValue) throw refusal("no provider credential was supplied to the Secret Keys install");
  if (!input.authorizationPassword) throw refusal("installing a Secret Key needs the account password, which this target did not provide");
  const existing = await findKey(control, keyName, input.secretValue);
  if (existing) return existing;
  const created = parseKey(await control.secretKeysCall("create-key", {
    name: keyName,
    value: input.secretValue,
    kind: "llm",
    provider: CORE_PROVIDER_LABEL,
    scope: "global",
    enabled: true,
    description: "FluxIQ Testing Lab live-provider run",
    metadata: { model: input.model },
    authorizationPassword: input.authorizationPassword,
    ...(input.authorizationPin ? { authorizationPin: input.authorizationPin } : {}),
  }), input.secretValue);
  if (created.name !== keyName) throw refusal("Core returned a Secret Key under a different name");
  assertUsable(created);
  return Object.freeze({ id: created.id, name: created.name, created: true });
}

async function findKey(control: LiveLlmSecretKeyControl, keyName: string, secretValue: string): Promise<LiveLlmSecretKeyReference | undefined> {
  const snapshot = await control.secretKeysCall("snapshot", {});
  if (!isRecord(snapshot) || !Array.isArray(snapshot.keys)) throw refusal("Core returned an unreadable Secret Keys snapshot");
  const matches = snapshot.keys.map(value => parseKey(value, secretValue)).filter(key => key.name === keyName);
  if (matches.length > 1) throw refusal("this Core holds more than one Secret Key under the Testing Lab's name");
  const found = matches[0];
  if (!found) return undefined;
  assertUsable(found);
  return Object.freeze({ id: found.id, name: found.name, created: false });
}

type ParsedKey = { id: string; name: string; kind: string; provider?: string; scope: string; enabled: boolean };

function parseKey(value: unknown, secretValue: string): ParsedKey {
  if (!isRecord(value)) throw refusal("Core returned unreadable Secret Key metadata");
  const id = boundedText(value.id, 256, secretValue);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u.test(id)) throw refusal("Core returned an invalid Secret Key id");
  return {
    id,
    name: boundedText(value.name, 128, secretValue),
    kind: boundedText(value.kind, 32, secretValue),
    ...(value.provider === undefined ? {} : { provider: boundedText(value.provider, 128, secretValue) }),
    scope: boundedText(value.scope, 32, secretValue),
    enabled: value.enabled === true,
  };
}

function assertUsable(key: ParsedKey): void {
  if (key.kind !== "llm" || key.provider !== CORE_PROVIDER_LABEL || key.scope !== "global" || !key.enabled) {
    throw refusal("the Secret Key under the Testing Lab's name is not an enabled global DeepSeek key");
  }
}

function boundedText(value: unknown, maximum: number, secretValue: string): string {
  if (typeof value !== "string" || !value || value.length > maximum || /[\u0000-\u001f\u007f]/u.test(value)) throw refusal("Core returned invalid Secret Key metadata");
  // Metadata must never carry the credential back out: a field that does is a
  // leak whatever else it is, and it stops here rather than reaching a bundle.
  if (value.includes(secretValue)) throw refusal("Core returned Secret Key metadata containing the credential");
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function refusal(detail: string): RunnerFailure {
  return new RunnerFailure("environment.missing", `Live LLM key install refused: ${detail}`);
}
