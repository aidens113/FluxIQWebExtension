import { connectFieldSchemas } from "@fluxiq/contracts/platform";
import { HostedPkceFailure } from "./failure";
import type { HostedPkceFailureCode } from "./failure-codes";
import type { HostedPkceOptions, HostedPkceStoredAttempt } from "./model";

/** One selected server generation. Once retired it cannot become current again. */
export class HostedPkceContext {
  readonly selection: HostedPkceOptions["selection"];
  readonly aborts = new Set<AbortController>();
  private retired: "selection_changed" | "cancelled" | undefined;

  constructor(readonly options: HostedPkceOptions) {
    const selected = options.selection;
    let origin: URL;
    try { origin = new URL(selected.origin); }
    catch { throw new HostedPkceFailure("configuration_invalid"); }
    if (origin.protocol !== "https:" || origin.origin !== selected.origin || origin.username || origin.password
      || origin.search || origin.hash || origin.pathname !== "/" || !selected.id
      || !/^\d+\.\d+\.\d+$/u.test(selected.extensionVersion) || !connectFieldSchemas.label.safeParse(selected.clientLabel).success) throw new HostedPkceFailure("configuration_invalid");
    this.selection = Object.freeze({ id: selected.id, origin: selected.origin, clientLabel: selected.clientLabel, extensionVersion: selected.extensionVersion });
  }

  current(): boolean {
    if (this.retired) return false;
    try { if (this.options.isCurrent() === true) return true; }
    catch { this.retired = "selection_changed"; }
    this.retired = "selection_changed";
    return false;
  }

  guard(): void {
    if (!this.current()) throw new HostedPkceFailure(this.retired ?? "selection_changed");
  }

  retire(): void { this.retired = "cancelled"; }

  clock(): number {
    const time = this.options.now();
    if (!Number.isSafeInteger(time) || time < 0) throw new HostedPkceFailure("clock_invalid");
    return time;
  }

  session(): string {
    const session = this.options.authenticationTabs.sessionIdentity();
    if (!session) throw new HostedPkceFailure("ownership_unavailable");
    return session;
  }

  owner(record: HostedPkceStoredAttempt): void {
    this.guard();
    if (record.selectionId !== this.selection.id || record.binding.origin !== this.selection.origin) throw new HostedPkceFailure("selection_changed");
    if (this.session() !== record.browserSessionId) throw new HostedPkceFailure("session_changed");
    if (record.tabId === null || !this.options.authenticationTabs.owns(record.tabId, record.attemptId)) throw new HostedPkceFailure("ownership_lost");
  }
}

export function pkceFailureCode(error: unknown, fallback: HostedPkceFailureCode = "operation_failed"): HostedPkceFailureCode {
  return error instanceof HostedPkceFailure ? error.code : fallback;
}
