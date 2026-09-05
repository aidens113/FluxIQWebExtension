import type { CaptureCorrelation, CapturedEvidenceEvent, EvidenceSummary } from "./types.js";

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export type TimelineEntry = {
  sequence: number;
  timestamp: string;
  trigger: CapturedEvidenceEvent["trigger"];
  summary: string;
  stepId?: string;
  correlationId: string;
  correlation: CaptureCorrelation;
  screenshot?: CapturedEvidenceEvent["screenshot"];
};

export function createTimeline(events: readonly CapturedEvidenceEvent[]): TimelineEntry[] {
  return events.map((event) => {
    const entry: TimelineEntry = {
      sequence: event.sequence,
      timestamp: event.timestamp,
      trigger: event.trigger,
      summary: event.summary,
      correlationId: event.correlation.correlationId,
      correlation: event.correlation,
    };
    if (event.correlation.stepId !== undefined) entry.stepId = event.correlation.stepId;
    if (event.screenshot !== undefined) entry.screenshot = event.screenshot;
    return entry;
  });
}

export function renderReport(summary: EvidenceSummary, events: readonly CapturedEvidenceEvent[]): string {
  const rows = events.map((event) => {
    const screenshot = event.screenshot?.path
      ? `<a href="${escapeHtml(event.screenshot.path)}"><img loading="lazy" src="${escapeHtml(event.screenshot.path)}" alt="frame ${event.sequence}"></a>`
      : event.screenshot?.duplicateOfSha256
        ? "duplicate"
        : escapeHtml(event.screenshot?.suppressed ?? "—");
    return `<tr${event.trigger === "error" ? ' class="failure"' : ""}><td>${event.sequence}</td><td>${escapeHtml(event.timestamp)}</td><td>${escapeHtml(event.trigger)}</td><td>${escapeHtml(event.correlation.stepId ?? "—")}</td><td>${escapeHtml(event.summary)}</td><td>${screenshot}</td></tr>`;
  }).join("\n");
  const failure = summary.firstFailure
    ? `<p id="first-failure"><strong>First failure:</strong> step ${escapeHtml(summary.firstFailure.stepId ?? "unknown")} — ${escapeHtml(summary.firstFailure.summary)}</p>`
    : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Evidence ${escapeHtml(summary.runId)}</title><style>body{font:14px system-ui;margin:2rem;color:#202124}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:.45rem;text-align:left;vertical-align:top}.failure{background:#ffe8e8}img{width:180px;height:auto}code{word-break:break-all}</style></head><body><h1>${escapeHtml(summary.scenarioId)}</h1><p>Run <code>${escapeHtml(summary.runId)}</code> · Verdict: <strong>${escapeHtml(summary.verdict)}</strong></p>${failure}<table><thead><tr><th>#</th><th>Time</th><th>Trigger</th><th>Step</th><th>Summary</th><th>Frame</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
}

export function renderContactSheet(events: readonly CapturedEvidenceEvent[]): string {
  const frames = events.filter((event) => event.screenshot?.path).map((event) => `<figure><img loading="lazy" src="../${escapeHtml(event.screenshot!.path!)}" alt="frame ${event.sequence}"><figcaption>#${event.sequence} ${escapeHtml(event.summary)}</figcaption></figure>`).join("\n");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Contact sheet</title><style>body{font:13px system-ui;display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:1rem;margin:1rem}figure{margin:0}img{width:100%;height:auto}figcaption{padding:.4rem}</style></head><body>${frames}</body></html>`;
}
