import { authGateDemoCredentials } from "./constants.js";

export type AuthGateSession = { id: string; username: string; status: "active" | "expired" };

/**
 * Server-side session state; `/__control/final-state` is the oracle.
 * `sessionPolicy` is what the `expired` variant arms: under
 * `expire-before-account` sign-in still succeeds, but the session expires
 * when the protected account page is requested.
 */
export type AuthGateState = {
  seedMarker: string;
  sessionPolicy: "standard" | "expire-before-account";
  session: AuthGateSession | null;
  signInCount: number;
  rejectedSignInCount: number;
  accountViewCount: number;
  deniedAccountCount: number;
  lastDenial: "no-session" | "expired" | null;
  lastOperation: "seeded" | "signed-in" | "sign-in-rejected" | "signed-out" | "viewed-account" | "denied-account" | "session-expired";
};

export function createAuthGateState(seed: number): AuthGateState {
  return {
    seedMarker: `auth-gate-seed-${seed}`,
    sessionPolicy: "standard",
    session: null,
    signInCount: 0,
    rejectedSignInCount: 0,
    accountViewCount: 0,
    deniedAccountCount: 0,
    lastDenial: null,
    lastOperation: "seeded",
  };
}

/** True while the account route may serve the protected page. */
export function isAuthGateSessionValid(state: AuthGateState): boolean {
  return state.session?.status === "active" && state.sessionPolicy === "standard";
}

/**
 * `sign-in` comes from the sign-in page, `sign-out` from the account page,
 * `view-account` and `deny-account` from the account route, and
 * `expire-session` is the `expired` variant's arm. `view-account` and
 * `deny-account` apply only when the session is respectively valid and not,
 * so the counters agree with what the route answered. Anything else leaves
 * the state unchanged.
 */
export function mutateAuthGateState(state: AuthGateState, operation: string, payload: unknown): AuthGateState {
  switch (operation) {
    case "sign-in":
      return signIn(state, payload);
    case "sign-out":
      return { ...state, session: null, lastOperation: "signed-out" };
    case "view-account":
      return isAuthGateSessionValid(state) ? { ...state, accountViewCount: state.accountViewCount + 1, lastOperation: "viewed-account" } : state;
    case "deny-account":
      if (isAuthGateSessionValid(state)) return state;
      return {
        ...state,
        session: expire(state.session),
        deniedAccountCount: state.deniedAccountCount + 1,
        lastDenial: state.session ? "expired" : "no-session",
        lastOperation: "denied-account",
      };
    case "expire-session":
      return { ...state, sessionPolicy: "expire-before-account", session: expire(state.session), lastOperation: "session-expired" };
    default:
      return state;
  }
}

/** Compares the submitted password with the demo credential and discards it. */
function signIn(state: AuthGateState, payload: unknown): AuthGateState {
  const { username, password } = authGateDemoCredentials;
  if (!isRecord(payload) || payload.username !== username || payload.password !== password) {
    return { ...state, rejectedSignInCount: state.rejectedSignInCount + 1, lastOperation: "sign-in-rejected" };
  }
  const signInCount = state.signInCount + 1;
  return { ...state, session: { id: `${state.seedMarker}-session-${signInCount}`, username, status: "active" }, signInCount, lastOperation: "signed-in" };
}

function expire(session: AuthGateSession | null): AuthGateSession | null {
  return session && { ...session, status: "expired" };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
