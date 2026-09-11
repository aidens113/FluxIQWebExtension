import { defineScenario } from "../../types.js";
import { authGatePaths } from "./constants.js";
import { authGateManifest } from "./manifest.js";
import { renderAccountPage, renderSignInPage } from "./pages.js";
import { createAuthGateState, isAuthGateSessionValid, mutateAuthGateState, type AuthGateState } from "./state.js";

/**
 * A sign-in gate in front of a protected account page (corpus rows W18 and
 * W19). The start page is the sign-in form; `account` renders the protected
 * content while the session is valid and otherwise answers 302 to the
 * sign-in page with `?expired=1`. Every account GET is recorded in the state.
 */
export const authGateScenario = defineScenario<AuthGateState>({
  id: "auth-gate",
  title: "Auth gate",
  startPath: authGatePaths.start,
  seed: 120,
  manifest: authGateManifest,
  createState: createAuthGateState,
  mutate: mutateAuthGateState,
  render: renderSignInPage,
  route(state, request, context) {
    if (request.subpath !== "account") return undefined;
    if (!isAuthGateSessionValid(state)) return { status: 302, headers: { location: authGatePaths.expiredSignIn }, mutation: { operation: "deny-account" } };
    return { status: 200, body: renderAccountPage(state, context), mutation: { operation: "view-account" } };
  },
});
