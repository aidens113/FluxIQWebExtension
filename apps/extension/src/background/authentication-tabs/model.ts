export type AuthenticationTabOwner = Readonly<{ tabId: number; attemptId: string }>;

export type AuthenticationTabOwnership = Readonly<{
  version: 1;
  browserSessionId: string;
  owners: readonly AuthenticationTabOwner[];
}>;

/** The session id comes from privileged browser-session storage, never a permanent tab id. */
export type AuthenticationTabSessionStore = {
  load(): Promise<{ browserSessionId: string; ownership: unknown }>;
  save(ownership: AuthenticationTabOwnership): Promise<void>;
};

export type AuthenticationTabSessionArea = {
  get(keys: string[]): Promise<Record<string, unknown>>;
  set(values: Record<string, unknown>): Promise<void>;
  setAccessLevel?(options: { accessLevel: "TRUSTED_CONTEXTS" }): void | Promise<void>;
};

/** Query and fragment are never route configuration or stored authentication state. */
export type AuthenticationTabRoute = Readonly<{
  origin: string;
  pathname: string;
  includeDescendants?: boolean;
}>;

export type AuthenticationTabSnapshot = Readonly<{ tabId: number; url?: string | undefined }>;

export type AuthenticationTabsOptions = Readonly<{
  store: AuthenticationTabSessionStore;
  routes: readonly AuthenticationTabRoute[];
}>;
