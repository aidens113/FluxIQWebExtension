// Assembling the "Report Problem" bundle from what the background worker knows.
//
// Built by allowlist: every field below is named, and nothing from the status is
// copied by spreading it, so a field added to `ExtensionStatus` later -- a page
// address, a recorded value -- does not reach a report by accident. What is left
// out on purpose is listed in `withheld`, so a reader can tell "absent by
// design" from "lost".

import type { BrowserDescriptor, ExtensionStatus, FluxIQSettings, ProblemLogEntry, ProblemReport } from "../../../shared/protocol";
import { diagnosticOrigin, redactDiagnosticText } from "../diagnostic-redaction";

export const PROBLEM_REPORT_ACTIVITY_LIMIT = 20;

export const PROBLEM_REPORT_WITHHELD = [
  "pairing token and pairing code",
  "cookies and authorization headers",
  "page addresses beyond their origin, page titles and page text",
  "recorded events, snapshots and screenshots",
  "values typed into fields and extracted data",
  "activity labels and details",
  "run inputs, outputs and traces"
] as const;

export type ProblemReportInput = {
  readonly status: ExtensionStatus;
  readonly settings: FluxIQSettings;
  readonly browser: BrowserDescriptor;
  readonly problems: readonly ProblemLogEntry[];
  readonly recentRuns: ProblemReport["recentRuns"];
  /** Literals withheld from every text in the report wherever they appear: the pairing token and code. */
  readonly literals: readonly (string | undefined)[];
  readonly now: number;
};

export function buildProblemReport(input: ProblemReportInput): ProblemReport {
  const { status, settings, browser } = input;
  const redact = (text: string | undefined) => (text ? redactDiagnosticText(text, input.literals) : undefined);
  const identified = browserIdentity(browser.userAgent);
  const runtime = status.runtime;
  return {
    schema: "fluxiq.problem-report/1",
    createdAt: new Date(input.now).toISOString(),
    extension: {
      version: browser.extensionVersion,
      browser: identified.name,
      ...(identified.version ? { browserVersion: identified.version } : {}),
      platform: browser.platform,
      language: browser.language
    },
    connection: {
      state: status.connectionState,
      paired: status.paired,
      autoReconnect: settings.autoReconnect,
      gatewayOrigin: diagnosticOrigin(settings.gatewayUrl),
      coreOrigin: diagnosticOrigin(settings.coreApiUrl),
      queueSize: status.queueSize,
      ...(status.lastMessageAt !== undefined ? { lastMessageAt: status.lastMessageAt } : {}),
      ...(status.lastError ? { lastError: redact(status.lastError) } : {})
    },
    session: {
      clientId: status.clientId,
      ...(status.sessionId ? { sessionId: status.sessionId } : {}),
      ...(status.projectId !== undefined ? { projectId: status.projectId } : {})
    },
    recording: {
      state: status.recordingState,
      eventCount: status.eventCount,
      ...(status.recordingStartedAt !== undefined ? { startedAt: status.recordingStartedAt } : {})
    },
    runtime: {
      state: runtime?.state ?? "idle",
      ...(runtime?.commandId ? { commandId: runtime.commandId } : {}),
      ...(runtime?.actionType ? { actionType: runtime.actionType } : {}),
      ...(runtime?.startedAt !== undefined ? { startedAt: runtime.startedAt } : {}),
      ...(runtime?.finishedAt !== undefined ? { finishedAt: runtime.finishedAt } : {}),
      ...(runtime?.error ? { error: redact(runtime.error) } : {})
    },
    recentActivity: status.recentActivities
      .slice(-PROBLEM_REPORT_ACTIVITY_LIMIT)
      .map((entry) => ({ at: entry.timestamp, kind: entry.kind, tone: entry.tone ?? "neutral" })),
    // Already redacted when noted; redacted again here so an entry written
    // before the pairing token it quotes was known is still covered.
    recentProblems: input.problems.map((entry) => ({ ...entry, message: redactDiagnosticText(entry.message, input.literals) })),
    recentRuns: input.recentRuns,
    withheld: [...PROBLEM_REPORT_WITHHELD]
  };
}

/** The browser's name and major version from its user agent, without the rest of the string. */
export function browserIdentity(userAgent: string): { name: string; version?: string } {
  const patterns: Array<[string, RegExp]> = [
    ["Edge", /\bEdg\/(\d+)/],
    ["Opera", /\bOPR\/(\d+)/],
    ["Firefox", /\bFirefox\/(\d+)/],
    ["Chrome", /\bChrome\/(\d+)/],
    ["Safari", /\bVersion\/(\d+).*\bSafari\//]
  ];
  for (const [name, pattern] of patterns) {
    const match = pattern.exec(userAgent);
    if (match?.[1]) return { name, version: match[1] };
  }
  return { name: "Unknown" };
}
