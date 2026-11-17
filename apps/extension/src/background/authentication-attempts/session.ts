import { isAuthenticationTabIdentifier } from "../authentication-tabs";
import { HostedPkceFailure } from "../connect/pkce";
import type { BrowserSessionPkceAttemptOptions } from "./options";

/** The registry is the authority; persisted attempt data never creates a browser session. */
export class PkceAttemptSession {
  constructor(private readonly tabs: BrowserSessionPkceAttemptOptions["authenticationTabs"]) {}

  async ready(): Promise<string> {
    try { await this.tabs.ready(); }
    catch { throw new HostedPkceFailure("ownership_unavailable"); }
    const session = this.identity();
    if (!isAuthenticationTabIdentifier(session)) throw new HostedPkceFailure("ownership_unavailable");
    return session;
  }

  assert(expected: string): void {
    if (this.identity() !== expected) throw new HostedPkceFailure("session_changed");
  }

  private identity(): string | null {
    try { return this.tabs.sessionIdentity(); }
    catch { throw new HostedPkceFailure("ownership_unavailable"); }
  }
}
