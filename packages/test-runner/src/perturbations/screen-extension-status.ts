/** The part of the extension's `fluxiq.getStatus` a perturbation record keeps. */
export type ScreenedExtensionStatus = {
  connectionState: string | null;
  paired: boolean | null;
  sessionPresent: boolean;
  queueSize: number | null;
  /** The gateway it is pointed at, as an origin only. */
  gatewayOrigin: string | null;
  lastError: string | null;
  runtime: { state: string | null; commandId: string | null; actionType: string | null; startedAt: number | null; finishedAt: number | null; error: string | null } | null;
};

/**
 * Keeps only what says how the extension stood after the fault: its
 * connection, whether a session is held (not which), and its runtime status
 * for the command in flight. Settings, the client id, tab URLs, activities and
 * any target name are left out; they are page or machine data the record does
 * not need.
 */
export function screenExtensionStatus(status: unknown): ScreenedExtensionStatus {
  const value = record(status);
  const runtime = record(value.runtime);
  return {
    connectionState: text(value.connectionState),
    paired: typeof value.paired === "boolean" ? value.paired : null,
    sessionPresent: typeof value.sessionId === "string" && value.sessionId.length > 0,
    queueSize: typeof value.queueSize === "number" ? value.queueSize : null,
    gatewayOrigin: originOf(value.gatewayUrl),
    lastError: bounded(value.lastError),
    runtime: value.runtime === undefined ? null : {
      state: text(runtime.state),
      commandId: text(runtime.commandId),
      actionType: text(runtime.actionType),
      startedAt: typeof runtime.startedAt === "number" ? runtime.startedAt : null,
      finishedAt: typeof runtime.finishedAt === "number" ? runtime.finishedAt : null,
      error: bounded(runtime.error),
    },
  };
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown): string | null { return typeof value === "string" ? value : null; }

function bounded(value: unknown): string | null { return typeof value === "string" ? value.slice(0, 300) : null; }

function originOf(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    return new URL(value).origin;
  } catch (error) {
    if (error instanceof TypeError) return null;
    throw error;
  }
}
