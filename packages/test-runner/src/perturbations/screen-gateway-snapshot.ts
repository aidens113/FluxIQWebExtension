/** The part of Core's gateway snapshot a perturbation record keeps. */
export type ScreenedGatewaySnapshot = {
  /** Null when the response carried no session list, which is not the same as no sessions. */
  sessions: Array<{ sessionId: string | null; status: string | null; connectedAt: number | null; lastSeenAt: number | null; disconnectedAt: number | null }> | null;
  /** Core's audit entries from `since` on, oldest first: when, which session, what kind, and the command an entry names. Null when the response carried no audit log. */
  audit: Array<{ timestamp: number | null; sessionId: string | null; type: string | null; commandId: string | null }> | null;
};

/**
 * Keeps what says how Core saw the client after the fault: each session's
 * status and times, and the audit entries since the fault (their types and
 * command ids, never their messages or other metadata). Trusted clients,
 * pairings and the public URL are left out.
 */
export function screenGatewaySnapshot(response: unknown, since: number): ScreenedGatewaySnapshot {
  const payload = record(record(response).payload);
  const sessions = Array.isArray(payload.sessions) ? payload.sessions.map(record) : null;
  const audit = Array.isArray(payload.auditLog) ? payload.auditLog.map(record) : null;
  return {
    sessions: sessions && sessions.map(session => ({
      sessionId: text(session.sessionId),
      status: text(session.status),
      connectedAt: number(session.connectedAt),
      lastSeenAt: number(session.lastSeenAt),
      disconnectedAt: number(session.disconnectedAt),
    })),
    audit: audit && audit
      .filter(entry => typeof entry.timestamp !== "number" || entry.timestamp >= since)
      .map(entry => ({ timestamp: number(entry.timestamp), sessionId: text(entry.sessionId), type: text(entry.type), commandId: text(record(entry.metadata).commandId) }))
      .sort((left, right) => (left.timestamp ?? 0) - (right.timestamp ?? 0)),
  };
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown): string | null { return typeof value === "string" ? value : null; }

function number(value: unknown): number | null { return typeof value === "number" ? value : null; }
