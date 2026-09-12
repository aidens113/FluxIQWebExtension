import assert from "node:assert/strict";
import test from "node:test";
import { assertWebScenario, resolveScenarioWorkflow, scenarioPageFactSchedule } from "@fluxiq-web-extension/test-contracts";
import { startScenarioLab } from "../../../server.js";
import { authGateDemoCredentials } from "../constants.js";
import { authGateScenario } from "../scenario.js";
import type { AuthGateState } from "../state.js";

const context = { runToken: "auth-gate-unit-test-token", seed: 42 };
const credentials = { ...authGateDemoCredentials };
const expiredRedirect = { status: 302, headers: { location: "/scenarios/auth-gate/?expired=1" }, mutation: { operation: "deny-account" } };

const seeded = (): AuthGateState => authGateScenario.createState(42);
const signedIn = (state: AuthGateState = seeded()): AuthGateState => authGateScenario.mutate(state, "sign-in", credentials);
const armed = (state: AuthGateState): AuthGateState => authGateScenario.mutate(state, "expire-session", {});

function route(state: AuthGateState, subpath: string, method: "GET" | "HEAD" = "GET") {
  assert.ok(authGateScenario.route, "auth-gate serves its account page through route");
  return authGateScenario.route(state, { subpath, query: new URLSearchParams(), method }, context);
}

test("manifest is valid and resolves W18 (primary) and W19 (expired)", () => {
  const manifest = authGateScenario.manifest;
  assert.doesNotThrow(() => assertWebScenario(manifest));
  assert.deepEqual(
    { id: manifest.id, seed: manifest.seed, startPath: manifest.startPath, networkPolicy: manifest.networkPolicy },
    { id: "auth-gate", seed: 120, startPath: "/scenarios/auth-gate/", networkPolicy: "loopback-only" },
  );
  assert.equal(manifest.evidencePolicy?.reviewRequired, true);
  assert.equal(manifest.workflows, undefined);

  const primary = resolveScenarioWorkflow(manifest);
  assert.deepEqual(primary.recordingScript.map(step => `${step.operation}:${step.target ?? ""}`), [
    "type:testid:username", "type:testid:password", "click:testid:sign-in",
    "waitForState:testid:account-heading", "extract:testid:account-summary", "checkpoint:",
  ]);
  assert.equal(primary.expected.failure, undefined);
  assert.deepEqual(primary.expected.extracted, [{ step: "read-account", count: 1, records: [{ holder: "Demo Customer", plan: "Team (annual)", balance: "$1,284.50" }] }]);

  const expired = resolveScenarioWorkflow(manifest, { variantId: "expired" });
  assert.deepEqual(expired.variant?.arm, { operation: "expire-session" });
  assert.deepEqual(expired.expected.failure, { category: "auth_required" });
  assert.deepEqual(expired.expected.extracted, []);
  assert.deepEqual(expired.expected.finalState?.map(fact => fact.id), ["back-on-sign-in", "expiry-notice-visible", "expiry-notice-says-expired", "protected-content-absent"]);
  for (const inherited of ["recordingEvents", "actions", "allowedConsoleErrors"] as const) {
    assert.deepEqual(expired.expected[inherited], primary.expected[inherited], inherited);
  }
});

/**
 * Page facts are the one expectation a variant does not inherit, because they
 * describe a rendering rather than the run, and an armed run has two. W19 says
 * the same three things about its armed rendering as W18 does about its
 * unarmed one, and must say them itself.
 *
 * `expiry-notice-hidden` is the load-bearing one. It is true of the armed
 * sign-in page reached at `startPath` and false of the `?expired=1` page the
 * account route answers with -- and the account page is where W18's recording
 * ends, so this fact is what fails if the Flow lane ever again presents the
 * armed rendering by reloading the recording's last page instead of loading
 * `startPath`.
 */
test("W19 declares its own armed page facts, and the Flow lane checks them after arming", () => {
  const manifest = authGateScenario.manifest;
  const signInPage = resolveScenarioWorkflow(manifest).expected.pageFacts;
  const variant = manifest.variants?.find(candidate => candidate.id === "expired");
  assert.deepEqual(variant?.expected.pageFacts, signInPage, "the variant states the armed rendering rather than borrowing the workflow's");
  assert.deepEqual(
    variant?.expected.pageFacts?.find(fact => fact.id === "expiry-notice-hidden"),
    { id: "expiry-notice-hidden", subject: "session-expired", predicate: "visible", value: false },
  );

  // The Flow lane records unarmed, then arms and loads the fixture again.
  assert.deepEqual(scenarioPageFactSchedule(manifest, { variantId: "expired" }, "arms-after-loading"), { atLoad: signInPage, afterArm: signInPage });
  // The existing and clone lanes never present the unarmed rendering.
  assert.deepEqual(scenarioPageFactSchedule(manifest, { variantId: "expired" }, "arms-before-loading"), { atLoad: signInPage, afterArm: [] });
  // W18 arms nothing, so there is no second rendering to make a claim about.
  assert.deepEqual(scenarioPageFactSchedule(manifest, {}, "arms-after-loading"), { atLoad: signInPage, afterArm: [] });
});

test("state is deterministic from the seed", () => {
  assert.deepEqual(seeded(), {
    seedMarker: "auth-gate-seed-42", sessionPolicy: "standard", session: null, signInCount: 0, rejectedSignInCount: 0,
    accountViewCount: 0, deniedAccountCount: 0, lastDenial: null, lastOperation: "seeded",
  });
  assert.deepEqual(seeded(), seeded());
  assert.equal(authGateScenario.createState(7).seedMarker, "auth-gate-seed-7");
  assert.equal(authGateScenario.render(seeded(), context), authGateScenario.render(seeded(), context));
  assert.deepEqual(route(signedIn(), "account"), route(signedIn(), "account"));
});

test("sign-in accepts only the demo credentials and never stores the password", () => {
  const before = seeded();
  const after = signedIn(before);
  assert.deepEqual(after.session, { id: "auth-gate-seed-42-session-1", username: "demo.user", status: "active" });
  assert.equal(after.signInCount, 1);
  assert.equal(after.lastOperation, "signed-in");
  assert.equal(JSON.stringify(after).includes(credentials.password), false);
  assert.deepEqual(before, seeded(), "mutate leaves its input untouched");
  assert.equal(signedIn(after).session?.id, "auth-gate-seed-42-session-2");
  const rejectedPayloads = [{ ...credentials, password: "wrong-password" }, { ...credentials, username: "someone.else" }, { username: credentials.username }, null, "demo.user"];
  for (const payload of rejectedPayloads) {
    const rejected = authGateScenario.mutate(before, "sign-in", payload);
    assert.deepEqual(
      { session: rejected.session, signInCount: rejected.signInCount, rejectedSignInCount: rejected.rejectedSignInCount, lastOperation: rejected.lastOperation },
      { session: null, signInCount: 0, rejectedSignInCount: 1, lastOperation: "sign-in-rejected" },
      JSON.stringify(payload),
    );
  }
});

test("sign-out ends the session", () => {
  const out = authGateScenario.mutate(signedIn(), "sign-out", {});
  assert.equal(out.session, null);
  assert.equal(out.lastOperation, "signed-out");
  assert.deepEqual(route(out, "account"), expiredRedirect);
});

test("view-account and deny-account record only what the account route answered", () => {
  const valid = signedIn();
  const viewed = authGateScenario.mutate(valid, "view-account", {});
  assert.deepEqual({ accountViewCount: viewed.accountViewCount, lastOperation: viewed.lastOperation }, { accountViewCount: 1, lastOperation: "viewed-account" });
  const anonymous = seeded();
  assert.equal(authGateScenario.mutate(anonymous, "view-account", {}), anonymous);
  assert.equal(authGateScenario.mutate(valid, "deny-account", {}), valid);

  const noSession = authGateScenario.mutate(anonymous, "deny-account", {});
  assert.deepEqual(
    { session: noSession.session, deniedAccountCount: noSession.deniedAccountCount, lastDenial: noSession.lastDenial, lastOperation: noSession.lastOperation },
    { session: null, deniedAccountCount: 1, lastDenial: "no-session", lastOperation: "denied-account" },
  );
  const lapsed = authGateScenario.mutate(signedIn(armed(seeded())), "deny-account", {});
  assert.deepEqual(
    { session: lapsed.session?.status, deniedAccountCount: lapsed.deniedAccountCount, lastDenial: lapsed.lastDenial },
    { session: "expired", deniedAccountCount: 1, lastDenial: "expired" },
  );
});

test("expire-session, the expired variant's arm, expires the current session and every later one before the account page", () => {
  const live = armed(signedIn());
  assert.deepEqual(
    { sessionPolicy: live.sessionPolicy, session: live.session, lastOperation: live.lastOperation },
    { sessionPolicy: "expire-before-account", session: { id: "auth-gate-seed-42-session-1", username: "demo.user", status: "expired" }, lastOperation: "session-expired" },
  );
  assert.deepEqual(route(live, "account"), expiredRedirect);

  const fresh = armed(seeded());
  assert.deepEqual({ sessionPolicy: fresh.sessionPolicy, session: fresh.session }, { sessionPolicy: "expire-before-account", session: null });
  const signedInWhileArmed = signedIn(fresh);
  assert.deepEqual(
    { session: signedInWhileArmed.session?.status, lastOperation: signedInWhileArmed.lastOperation },
    { session: "active", lastOperation: "signed-in" },
    "sign-in still succeeds while armed",
  );
  assert.deepEqual(route(signedInWhileArmed, "account"), expiredRedirect);
  assert.equal(authGateScenario.mutate(signedInWhileArmed, "view-account", {}), signedInWhileArmed);
});

test("unknown operations leave the state unchanged", () => {
  const state = signedIn();
  assert.equal(authGateScenario.mutate(state, "reset-password", { password: "anything" }), state);
});

test("the account route serves protected content only to a valid session and nothing else", () => {
  const valid = signedIn();
  const served = route(valid, "account");
  assert.equal(served?.status, 200);
  assert.equal(served?.headers, undefined);
  assert.deepEqual(served?.mutation, { operation: "view-account" });
  const body = served?.body ?? "";
  for (const text of ['data-testid="account-heading"', 'data-testid="account-summary"', 'data-testid="signed-in-user">demo.user<', "auth-gate-seed-42"]) {
    assert.ok(body.includes(text), text);
  }
  const [expectedRecord] = authGateScenario.manifest.expected.extracted?.[0]?.records ?? [];
  assert.ok(expectedRecord, "the manifest expects one account record");
  for (const value of Object.values(expectedRecord)) assert.ok(body.includes(value), value);
  assert.deepEqual(route(valid, "account", "HEAD"), served);

  assert.deepEqual(route(seeded(), "account"), expiredRedirect);
  assert.deepEqual(route(seeded(), "account", "HEAD"), expiredRedirect);
  for (const subpath of ["account/", "account/settings", "admin", "sign-in"]) assert.equal(route(valid, subpath), undefined, subpath);
});

test("the sign-in page states the demo credentials, marks the password field, and reveals the expiry notice only on ?expired=1", () => {
  const html = authGateScenario.render(seeded(), context);
  for (const text of [
    'type="password" autocomplete="current-password"',
    'autocomplete="username"',
    'data-testid="demo-username">demo.user<',
    `data-testid="demo-password">${credentials.password}<`,
    '<p role="alert" data-testid="session-expired" hidden>Your session expired. Sign in again to continue.</p>',
    "get('expired') === '1'",
    'location.assign("/scenarios/auth-gate/account")',
  ]) assert.ok(html.includes(text), text);
});

test("through the lab server the account route redirects, records each GET, and serves protected content", async () => {
  const lab = await startScenarioLab({ runToken: "auth-gate-server-test-token", seed: 42 });
  const auth = { authorization: `Bearer ${lab.runToken}` };
  const get = async (path: string, method = "GET") => {
    const response = await fetch(`${lab.origin}${path}`, { method, redirect: "manual" });
    return { status: response.status, location: response.headers.get("location"), body: await response.text() };
  };
  const post = async (operation: string, payload: unknown) => {
    const response = await fetch(`${lab.origin}/api/auth-gate/${operation}`, { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify(payload) });
    assert.equal(response.status, 200, operation);
    await response.text();
  };
  const counters = async () => {
    const response = await fetch(`${lab.origin}/__control/final-state?scenario=auth-gate`, { headers: auth });
    const { state } = await response.json() as { state: AuthGateState };
    return { accountViewCount: state.accountViewCount, deniedAccountCount: state.deniedAccountCount, lastDenial: state.lastDenial, session: state.session?.status ?? null, raw: JSON.stringify(state) };
  };
  try {
    const redirect = { status: 302, location: "/scenarios/auth-gate/?expired=1", body: "" };
    assert.deepEqual(await get("/scenarios/auth-gate/account"), redirect);
    assert.deepEqual(await get("/scenarios/auth-gate/account", "HEAD"), redirect);
    assert.deepEqual({ ...await counters(), raw: undefined }, { accountViewCount: 0, deniedAccountCount: 1, lastDenial: "no-session", session: null, raw: undefined }, "HEAD records nothing");

    const signInPage = await get("/scenarios/auth-gate/?expired=1");
    assert.equal(signInPage.status, 200);
    assert.ok(signInPage.body.includes('data-testid="sign-in-form"'));

    await post("sign-in", credentials);
    const served = await get("/scenarios/auth-gate/account");
    assert.equal(served.status, 200);
    assert.ok(served.body.includes('data-testid="account-summary"'));
    assert.deepEqual({ ...await counters(), raw: undefined }, { accountViewCount: 1, deniedAccountCount: 1, lastDenial: "no-session", session: "active", raw: undefined });

    await post("expire-session", {});
    assert.deepEqual(await get("/scenarios/auth-gate/account"), redirect);
    const final = await counters();
    assert.deepEqual({ ...final, raw: undefined }, { accountViewCount: 1, deniedAccountCount: 2, lastDenial: "expired", session: "expired", raw: undefined });
    assert.equal(final.raw.includes(credentials.password), false);
    assert.equal((await get("/scenarios/auth-gate/admin")).status, 404);
  } finally {
    await lab.close();
  }
});
