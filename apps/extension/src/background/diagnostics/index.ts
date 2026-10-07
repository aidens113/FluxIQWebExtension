export { DIAGNOSTIC_WITHHELD, diagnosticOrigin, MAXIMUM_DIAGNOSTIC_TEXT_LENGTH, redactDiagnosticText } from "./diagnostic-redaction";
export {
  browserIdentity,
  buildProblemReport,
  localProblemLogStore,
  MAXIMUM_PROBLEM_LOG_ENTRIES,
  PROBLEM_LOG_STORAGE_KEY,
  PROBLEM_REPORT_ACTIVITY_LIMIT,
  PROBLEM_REPORT_WITHHELD,
  ProblemLog,
  ProblemNoticer,
  type ProblemLogInput,
  type ProblemLogStore,
  type ProblemNoticerStatus,
  type ProblemReportInput
} from "./problem/index";
export { PROBLEM_REPORT_RUN_LIMIT, readRecentRuns, type RecentRunsCall } from "./recent-runs";
export { assembleProblemReport, handleReportProblem, type ReportProblemDeps } from "./report-problem-control";

export { readBuildIdentity } from "./build-identity";
