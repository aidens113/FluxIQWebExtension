import { webControlSpotToken } from "./token";

/** A trusted gateway source, scoped to its session; page-supplied identifiers never qualify. */
export function webResetResource(sessionId: unknown, sourceId: unknown): string | undefined {
  if (typeof sessionId !== "string" || !sessionId || sessionId.length > 2_000 || typeof sourceId !== "string" || !/^tab:(?:0|[1-9][0-9]{0,15}):frame:(?:0|[1-9][0-9]{0,15})$/u.test(sourceId)) return undefined;
  return webControlSpotToken("scope", `${sessionId}\0${sourceId}`);
}
