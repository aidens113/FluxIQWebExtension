import { AuthenticationTabsError } from "./failure";
import { isAuthenticationTabIdentifier } from "./identifier";
import type { AuthenticationTabOwner, AuthenticationTabOwnership } from "./model";

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Strict private format. Unknown secret-bearing fields must never be copied into a later write. */
export function readAuthenticationTabOwnership(value: unknown): AuthenticationTabOwnership | undefined {
  if (value === undefined) return undefined;
  if (!record(value) || value.version !== 1 || !isAuthenticationTabIdentifier(value.browserSessionId)
    || !Array.isArray(value.owners) || Object.keys(value).some((key) => !["version", "browserSessionId", "owners"].includes(key))) {
    throw new AuthenticationTabsError("invalid_state");
  }
  const ids = new Set<number>();
  const owners: AuthenticationTabOwner[] = [];
  for (const owner of value.owners) {
    if (!record(owner) || typeof owner.tabId !== "number" || !Number.isSafeInteger(owner.tabId) || owner.tabId < 0
      || !isAuthenticationTabIdentifier(owner.attemptId) || ids.has(owner.tabId)
      || Object.keys(owner).some((key) => key !== "tabId" && key !== "attemptId")) {
      throw new AuthenticationTabsError("invalid_state");
    }
    ids.add(owner.tabId);
    owners.push({ tabId: owner.tabId, attemptId: owner.attemptId });
  }
  return { version: 1, browserSessionId: value.browserSessionId, owners };
}
