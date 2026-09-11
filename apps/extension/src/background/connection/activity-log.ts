// What the panel shows about a session: a short list of recent activity and a
// longer, paged log kept for the duration of one recording.

import type { ActivityEntry, RecordingLogPage } from "../../shared/protocol";
import { compactObject } from "./value-readers";

const RECENT_ACTIVITY_LIMIT = 20;
const RECORDING_LOG_LIMIT = 500;

export class ActivityLog {
  private readonly recent: ActivityEntry[] = [];
  private readonly log: ActivityEntry[] = [];
  private lastAt: number | undefined;

  lastActivityAt(): number | undefined {
    return this.lastAt;
  }

  recentEntries(): ActivityEntry[] {
    return [...this.recent];
  }

  record(kind: string, label: string, detail?: string, tone: ActivityEntry["tone"] = "neutral"): void {
    const timestamp = Date.now();
    this.lastAt = timestamp;
    const entry = compactObject({
      id: `${kind}.${timestamp}.${Math.random().toString(36).slice(2)}`,
      timestamp,
      kind,
      label,
      detail,
      tone
    });
    this.recent.unshift(entry);
    this.recent.splice(RECENT_ACTIVITY_LIMIT);
    this.log.unshift(entry);
    this.log.splice(RECORDING_LOG_LIMIT);
  }

  clearRecent(): void {
    this.recent.length = 0;
  }

  reset(): void {
    this.recent.length = 0;
    this.log.length = 0;
    this.lastAt = undefined;
  }

  page(page: number, pageSize: number): RecordingLogPage {
    const normalizedPageSize = Math.min(100, Math.max(5, Math.floor(pageSize) || 25));
    const normalizedPage = Math.max(1, Math.floor(page) || 1);
    const start = (normalizedPage - 1) * normalizedPageSize;
    return {
      items: this.log.slice(start, start + normalizedPageSize),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total: this.log.length
    };
  }
}
