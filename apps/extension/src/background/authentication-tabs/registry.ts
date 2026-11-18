import { AuthenticationTabsError } from "./failure";
import { isAuthenticationTabIdentifier } from "./identifier";
import type { AuthenticationTabOwnership, AuthenticationTabSnapshot, AuthenticationTabsOptions } from "./model";
import { readAuthenticationTabOwnership } from "./read-ownership";
import { AuthenticationTabRoutePolicy } from "./route-policy";

/** One background-owned registry. It never enumerates, closes, navigates or captures tabs. */
export class AuthenticationTabs {
  private readonly routes: AuthenticationTabRoutePolicy;
  private readonly hydration: Promise<void>;
  private pending: Promise<void> = Promise.resolve();
  private readonly reservations = new Map<number, number>();
  private owners = new Map<number, string>();
  private browserSessionId = "";
  private phase: "loading" | "ready" | "failed" = "loading";
  private failure: AuthenticationTabsError | undefined;

  constructor(private readonly options: AuthenticationTabsOptions) {
    this.routes = new AuthenticationTabRoutePolicy(options.routes);
    this.hydration = this.hydrate();
    // Callers observe the original rejection through ready(); startup itself
    // never creates an unhandled rejection while eligibility remains denied.
    void this.hydration.then(() => undefined, () => undefined);
  }

  ready(): Promise<void> {
    return this.failure ? Promise.reject(this.failure) : this.hydration;
  }

  status(): "loading" | "ready" | "failed" {
    return this.phase;
  }

  /** Only an exact, durably committed owner is authority; a reservation is not. */
  owns(tabId: number, attemptId: string): boolean {
    return this.phase === "ready" && Number.isSafeInteger(tabId) && tabId >= 0
      && isAuthenticationTabIdentifier(attemptId) && this.owners.get(tabId) === attemptId;
  }

  sessionIdentity(): string | null {
    return this.phase === "ready" ? this.browserSessionId : null;
  }

  /** Whether the registry holds the tab, by number alone: "unavailable" until the saved ownership is read. */
  ownership(tabId: number): "unowned" | "excluded" | "unavailable" {
    if (this.phase !== "ready" || !Number.isSafeInteger(tabId) || tabId < 0) return "unavailable";
    return this.owners.has(tabId) || this.reservations.has(tabId) ? "excluded" : "unowned";
  }

  /** Whether the screen must not be captured: any owned or reserved tab, or ownership not yet read. */
  captureBlocked(): boolean {
    return this.phase !== "ready" || this.owners.size > 0 || this.reservations.size > 0;
  }

  eligible(tab: AuthenticationTabSnapshot): boolean {
    if (this.phase !== "ready" || !Number.isSafeInteger(tab.tabId) || tab.tabId < 0
      || this.owners.has(tab.tabId) || this.reservations.has(tab.tabId)) return false;
    return this.routes.allows(tab.url) && (tab.pendingUrl === undefined || this.routes.allows(tab.pendingUrl));
  }

  own(tabId: number, attemptId: string): Promise<void> {
    this.validateOwner(tabId, attemptId);
    this.reservations.set(tabId, (this.reservations.get(tabId) ?? 0) + 1);
    const result = this.enqueue(async () => {
      const previous = this.owners.get(tabId);
      if (previous === attemptId) return;
      if (previous !== undefined) throw new AuthenticationTabsError("ownership_conflict");
      const next = new Map(this.owners);
      next.set(tabId, attemptId);
      await this.persist(next);
    });
    return result.then(() => this.unreserve(tabId), (error: unknown) => {
      this.unreserve(tabId);
      throw error;
    });
  }

  release(tabId: number, attemptId: string): Promise<boolean> {
    this.validateOwner(tabId, attemptId);
    return this.enqueue(async () => {
      if (this.owners.get(tabId) !== attemptId) return false;
      const next = new Map(this.owners);
      next.delete(tabId);
      await this.persist(next);
      return true;
    });
  }

  /** A tab opened by an owned tab becomes owned by the same attempt; false when the opener is not owned. */
  inherit(tabId: number, openerTabId: number): Promise<boolean> {
    if (this.phase !== "ready") return Promise.reject(new AuthenticationTabsError("storage_unavailable"));
    if (!Number.isSafeInteger(openerTabId) || openerTabId < 0) return Promise.reject(new AuthenticationTabsError("invalid_owner"));
    const attemptId = this.owners.get(openerTabId);
    return attemptId === undefined ? Promise.resolve(false) : this.own(tabId, attemptId).then(() => true);
  }

  private async hydrate(): Promise<void> {
    let saved;
    try {
      saved = await this.options.store.load();
    } catch {
      this.fail("storage_unavailable");
    }
    let stored: AuthenticationTabOwnership | undefined;
    try {
      if (!isAuthenticationTabIdentifier(saved.browserSessionId)) this.fail("invalid_state");
      this.browserSessionId = saved.browserSessionId;
      stored = readAuthenticationTabOwnership(saved.ownership);
    } catch {
      this.fail("invalid_state");
    }
    if (stored?.browserSessionId === this.browserSessionId) this.owners = new Map(stored.owners.map((owner) => [owner.tabId, owner.attemptId]));
    else if (stored) await this.persist(new Map());
    this.phase = "ready";
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.pending.then(async () => {
      await this.ready();
      if (this.phase !== "ready") throw new AuthenticationTabsError("storage_unavailable");
      return await operation();
    });
    // Return the failure to its caller while keeping later operations ordered.
    this.pending = result.then(() => undefined, () => undefined);
    return result;
  }

  private async persist(next: Map<number, string>): Promise<void> {
    const ownership: AuthenticationTabOwnership = {
      version: 1,
      browserSessionId: this.browserSessionId,
      owners: [...next].map(([tabId, attemptId]) => ({ tabId, attemptId }))
    };
    try {
      await this.options.store.save(ownership);
    } catch {
      this.fail("storage_unavailable");
    }
    this.owners = next;
  }

  private fail(code: "storage_unavailable" | "invalid_state"): never {
    this.phase = "failed";
    this.failure = new AuthenticationTabsError(code);
    throw this.failure;
  }

  private validateOwner(tabId: number, attemptId: string): void {
    if (!Number.isSafeInteger(tabId) || tabId < 0 || !isAuthenticationTabIdentifier(attemptId)) throw new AuthenticationTabsError("invalid_owner");
  }

  private unreserve(tabId: number): void {
    const pending = (this.reservations.get(tabId) ?? 1) - 1;
    if (pending > 0) this.reservations.set(tabId, pending);
    else this.reservations.delete(tabId);
  }
}
