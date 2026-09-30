// The background's answer to the panel's "Report Problem"
// (`PANEL_REPORT_PROBLEM_MESSAGE`): a redacted diagnostic bundle the panel can
// show, copy or save.
//
// Only the side panel and the popup may ask (`control-page.ts`): the bundle
// names the client, session and project, which a web page has no business
// reading. The collaborators arrive as `ReportProblemDeps` so the control is
// tested with no `chrome` at all; `background/index.ts` supplies the real ones.

import { PANEL_REPORT_PROBLEM_MESSAGE, type BrowserDescriptor, type ExtensionStatus, type FluxIQSettings, type ProblemLogEntry, type ProblemReport } from "../../shared/protocol";
import { buildProblemReport, type ProblemLog } from "./problem/index";
import { readRecentRuns, type RecentRunsCall } from "./recent-runs";

export type ReportProblemDeps = {
  readonly isControlPage: (sender: chrome.runtime.MessageSender) => boolean;
  readonly status: () => Promise<ExtensionStatus>;
  readonly settings: () => FluxIQSettings;
  readonly browser: () => BrowserDescriptor;
  readonly problems: Pick<ProblemLog, "recent">;
  /** A Core program call carrying the pairing token (`callCoreProgram`). */
  readonly call: RecentRunsCall;
  readonly projectId: () => string | null | undefined;
  /** The pairing token, read per report so a rotated token is the one withheld. Never put in the report. */
  readonly token: () => string | undefined;
  readonly now: () => number;
};

type ControlResult = { readonly handled: false } | { readonly handled: true; readonly response: unknown };

export async function handleReportProblem(
  message: { type?: unknown },
  sender: chrome.runtime.MessageSender,
  deps: ReportProblemDeps
): Promise<ControlResult> {
  if (message.type !== PANEL_REPORT_PROBLEM_MESSAGE) return { handled: false };
  if (!deps.isControlPage(sender)) return { handled: true, response: { ok: false, code: "forbidden", error: "Only the FluxIQ panel can do that." } };
  return { handled: true, response: { ok: true, report: await assembleProblemReport(deps) } };
}

export async function assembleProblemReport(deps: Omit<ReportProblemDeps, "isControlPage">): Promise<ProblemReport> {
  const [status, problems, recentRuns] = await Promise.all([
    deps.status(),
    // A log that cannot be read is itself a problem worth reporting, and says
    // so in the report rather than reading as "no problems".
    deps.problems.recent().catch((error: unknown): ProblemLogEntry[] => [{
      at: deps.now(),
      source: "message",
      message: `The problem log could not be read: ${error instanceof Error ? error.message : String(error)}`
    }]),
    readRecentRuns(deps.call, deps.projectId())
  ]);
  return buildProblemReport({
    status,
    settings: deps.settings(),
    browser: deps.browser(),
    problems,
    recentRuns,
    literals: [deps.token(), status.pairingReferenceCode],
    now: deps.now()
  });
}
