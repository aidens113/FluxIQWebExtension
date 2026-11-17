import { connectFieldSchemas } from "@fluxiq/contracts/platform";
import { isAuthenticationTabIdentifier } from "../../../authentication-tabs";
import { HOSTED_PKCE_FAILURE_CODES } from "../failure-codes";
import { HostedPkceFailure } from "../failure";
import type { HostedPkceAttemptEnvelope, HostedPkceStoredAttempt } from "../model";

const baseKeys = ["version", "attemptId", "browserSessionId", "selectionId", "binding", "installId", "expectedCredentialRevision", "createdAtMs"];
const audienceKeys = ["origin", "instanceId", "gatewayUrl", "authorizeUrl", "tokenUrl", "revokeUrl"];
const failures: ReadonlySet<string> = new Set(HOSTED_PKCE_FAILURE_CODES);
const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: readonly string[]): boolean => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const tab = (value: unknown): boolean => integer(value);

function attempt(value: unknown): HostedPkceStoredAttempt {
  if (!object(value) || value.version !== 1 || !isAuthenticationTabIdentifier(value.attemptId) || !isAuthenticationTabIdentifier(value.browserSessionId)
    || typeof value.selectionId !== "string" || value.selectionId.length === 0 || !connectFieldSchemas.installId.safeParse(value.installId).success
    || !integer(value.expectedCredentialRevision) || !integer(value.createdAtMs) || !object(value.binding) || !exact(value.binding, audienceKeys)
    || !audienceKeys.every(key => typeof (value.binding as Record<string, unknown>)[key] === "string")) throw new HostedPkceFailure("attempt_invalid");
  let extra: string[];
  if (value.phase === "preparing" || value.phase === "waiting") {
    extra = ["phase", "tabId", "state", "verifier"];
    if (value.phase === "preparing" ? value.tabId !== null : !tab(value.tabId)) throw new HostedPkceFailure("attempt_invalid");
    if (!connectFieldSchemas.state.safeParse(value.state).success || !connectFieldSchemas.codeVerifier.safeParse(value.verifier).success || value.state === value.verifier || value.attemptId === value.state || value.attemptId === value.verifier) throw new HostedPkceFailure("attempt_invalid");
  } else if (value.phase === "exchanging") {
    extra = ["phase", "tabId", "submittedAtMs"];
    if (!tab(value.tabId) || !integer(value.submittedAtMs)) throw new HostedPkceFailure("attempt_invalid");
  } else if (value.phase === "terminal") {
    extra = ["phase", "tabId", "outcome", ...(Object.hasOwn(value, "failureCode") ? ["failureCode"] : [])];
    if (value.tabId !== null && !tab(value.tabId) || !["adopted", "denied", "cancelled", "uncertain", "failed"].includes(String(value.outcome))
      || Object.hasOwn(value, "failureCode") && (typeof value.failureCode !== "string" || !failures.has(value.failureCode))) throw new HostedPkceFailure("attempt_invalid");
  } else throw new HostedPkceFailure("attempt_invalid");
  if (!exact(value, [...baseKeys, ...extra])) throw new HostedPkceFailure("attempt_invalid");
  return Object.freeze({ ...value, binding: Object.freeze({ ...value.binding }) }) as HostedPkceStoredAttempt;
}

export function readPkceAttemptEnvelope(value: unknown): HostedPkceAttemptEnvelope {
  if (!object(value) || !exact(value, ["browserSessionId", "revision", "attempt"]) || !isAuthenticationTabIdentifier(value.browserSessionId) || !integer(value.revision)) throw new HostedPkceFailure("attempt_invalid");
  const record = value.attempt === null ? null : attempt(value.attempt);
  if (record && record.browserSessionId !== value.browserSessionId) throw new HostedPkceFailure("session_changed");
  return Object.freeze({ browserSessionId: value.browserSessionId, revision: value.revision, attempt: record });
}
