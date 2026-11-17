import type { AuthenticationTabs, AuthenticationTabSessionArea } from "../authentication-tabs";

export type BrowserSessionPkceAttemptOptions = Readonly<{
  authenticationTabs: Pick<AuthenticationTabs, "ready" | "sessionIdentity">;
  area?: AuthenticationTabSessionArea;
}>;
