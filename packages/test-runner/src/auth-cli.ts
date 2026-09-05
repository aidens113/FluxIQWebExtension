import { WebPanelAuthSessionCache, type AuthSessionScope, type AuthSessionStatus } from "./auth-session.js";

export type PublicAuthCommandResult = {
  command: "auth.status" | "auth.clear";
  state: AuthSessionStatus["state"];
  origin: string;
  username: string;
  createdAt?: string;
  expiresAt?: string;
};

export async function executeAuthCommand(cache: WebPanelAuthSessionCache, operation: "status" | "clear", scope: AuthSessionScope): Promise<PublicAuthCommandResult> {
  const status = operation === "status" ? await cache.status(scope) : await cache.clear(scope);
  return {
    command: `auth.${operation}`,
    state: status.state,
    origin: status.origin,
    username: status.username,
    ...(status.createdAt ? { createdAt: status.createdAt } : {}),
    ...(status.expiresAt ? { expiresAt: status.expiresAt } : {}),
  };
}
