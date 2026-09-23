import type { ExpectedFact } from "@fluxiq-web-extension/test-contracts";
import { createScenarioManifest } from "../../types.js";
import { authGateDemoCredentials } from "./constants.js";

/**
 * The sign-in page as a run first meets it. Both the unarmed workflow and the
 * `expired` variant declare these, rather than the variant inheriting them: a
 * page fact describes the rendering it is declared on at the moment that
 * rendering is first presented, and page facts are the one expectation a
 * variant does not inherit, so an armed rendering makes no claim unless the
 * variant states one.
 *
 * They are the same three facts because arming changes nothing on this page.
 * `expire-session` sets a server-side session policy, and the expiry notice is
 * revealed only by `?expired=1`, which the account route answers with -- so
 * the notice is hidden here, armed or not, and becomes visible only after the
 * armed sign-in, which the variant's `finalState` asserts. `expiry-notice-hidden`
 * on the armed rendering is therefore also the assertion that the armed run
 * began at `startPath`: a lane that reached it by reloading wherever the
 * recording ended would be sitting on `/account`'s redirect, with the notice up.
 */
const SIGN_IN_PAGE_FACTS: ExpectedFact[] = [
  { id: "sign-in-form-visible", subject: "sign-in-form", predicate: "visible", value: true },
  { id: "demo-username-stated", subject: "demo-username", predicate: "text", value: "demo.user" },
  { id: "expiry-notice-hidden", subject: "session-expired", predicate: "visible", value: false },
];

/**
 * Corpus rows W18 and W19. Primary (W18): sign in with the demo credentials,
 * of which the page states only the username, reach the protected account
 * page, and read it. `expired`
 * (W19): the session expires before the protected page loads, so the
 * account request lands back on the sign-in page and the run must report
 * auth_required instead of reading anything.
 */
export const authGateManifest = createScenarioManifest({
  id: "auth-gate",
  title: "Auth gate",
  tags: ["auth", "forms", "password", "redirect", "session-expiry", "extraction"],
  seed: 120,
  startPath: "/scenarios/auth-gate/",
  capabilities: ["navigation", "forms", "mutation"],
  recordingScript: [
    { id: "enter-username", operation: "type", target: "testid:username", value: authGateDemoCredentials.username },
    { id: "enter-password", operation: "type", target: "testid:password", value: authGateDemoCredentials.password },
    { id: "submit-sign-in", operation: "click", target: "testid:sign-in" },
    { id: "account-loaded", operation: "waitForState", target: "testid:account-heading", timeoutMs: 5000 },
    {
      id: "read-account", operation: "extract", target: "testid:account-summary",
      fields: { holder: "testid:account-holder", plan: "testid:account-plan", balance: "testid:account-balance" },
    },
    { id: "account-read", operation: "checkpoint" },
  ],
  expected: {
    pageFacts: SIGN_IN_PAGE_FACTS,
    recordingEvents: [{ type: "web.element.input_changed", count: 2 }, { type: "web.element.clicked", count: 1 }],
    actions: [{ action: "web.dom.type", outcome: "succeeded" }, { action: "web.dom.click", outcome: "succeeded" }],
    finalState: [
      { id: "on-account-page", subject: "document", predicate: "path", value: "/scenarios/auth-gate/account" },
      { id: "signed-in-user", subject: "signed-in-user", predicate: "text", value: "demo.user" },
      { id: "protected-content-visible", subject: "account-summary", predicate: "visible", value: true },
    ],
    extracted: [{ step: "read-account", count: 1, records: [{ holder: "Demo Customer", plan: "Team (annual)", balance: "$1,284.50" }] }],
    allowedConsoleErrors: [],
  },
  variants: [{
    id: "expired",
    description: "W19: arming expires the session, and a session signed in afterwards expires before the protected page loads. The account request answers 302 to the sign-in page with ?expired=1, which says the session expired.",
    arm: { operation: "expire-session" },
    expected: {
      // The armed rendering, declared rather than inherited: see SIGN_IN_PAGE_FACTS.
      pageFacts: SIGN_IN_PAGE_FACTS,
      // The sign-in click is the attempt that lands on the gate, so it is the one
      // that fails. A variant's `actions` replaces the workflow's, so the typing,
      // which still succeeds, is restated.
      actions: [{ action: "web.dom.type", outcome: "succeeded" }, { action: "web.dom.click", outcome: "failed" }],
      finalState: [
        { id: "back-on-sign-in", subject: "document", predicate: "path", value: "/scenarios/auth-gate/" },
        { id: "expiry-notice-visible", subject: "session-expired", predicate: "visible", value: true },
        { id: "expiry-notice-says-expired", subject: "session-expired", predicate: "contains", value: "session expired" },
        { id: "protected-content-absent", subject: "account-summary", predicate: "exists", value: false },
      ],
      extracted: [],
      failure: { category: "auth_required" },
      /**
       * The adversarial measurement on this row: a session that expires
       * partway through a Flow is absorbed by nothing the runtime has. The
       * domain marks `web.auth.required` non-retryable and gives it the
       * `confirmation` stage, so the ladder's retry rung is never offered the
       * node -- correctly, since signing in again needs a credential the Flow
       * was never given and a branch the recording never took.
       */
      recovery: {
        absorbedBy: "none",
        because: "web.auth.required is non-retryable at the confirmation stage, and no deterministic rung can sign a session back in, so nothing absorbs an expiry mid-Flow.",
      },
    },
  }],
  /**
   * The one value a Flow built from this recording cannot recover. The
   * recorder withholds a sensitive control's value at the source, so the
   * recording of `enter-password` carries no password at all and the Flow
   * generated from it would type an empty string into the password field.
   * Declaring the step here makes the Flow lane supply the value instead,
   * resolved from `FLUXIQ_TEST_SECRET_AUTH_GATE_PASSWORD` (the id upper-cased,
   * hyphens as underscores, in `flow-lane/declared-secrets.ts`) and never from
   * the recording. The resolved value also joins the run's evidence redaction
   * list.
   *
   * The variable must carry the credential this fixture accepts,
   * `authGateDemoCredentials.password`, which the sign-in page never shows
   * (its row reads `authGatePasswordPlaceholder`): it is a loopback fixture
   * constant, not a real credential, and it opens nothing. Unset, a Flow run of this
   * scenario fails closed with `environment.missing` rather than falling back
   * to whatever the recording captured -- the fallback is the whole reason the
   * declaration exists. Only the Flow lane resolves declared secrets, so a
   * recording-lane run needs no configuration.
   */
  secrets: [{ id: "auth-gate-password", step: "enter-password" }],
  evidencePolicy: { screenshots: "events", trace: "failure", video: "failure", sampleFps: 0, reviewRequired: true },
});
