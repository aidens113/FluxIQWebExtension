/** Paths the auth-gate fixture serves and redirects between. */
export const authGatePaths = {
  start: "/scenarios/auth-gate/",
  account: "/scenarios/auth-gate/account",
  expiredSignIn: "/scenarios/auth-gate/?expired=1",
} as const;

/**
 * Fixture-only demo credentials. The sign-in page states the username but
 * never the password, which a run supplies as the declared secret
 * `auth-gate-password`. They open nothing outside this loopback fixture, and
 * the password never enters the fixture state.
 */
export const authGateDemoCredentials = { username: "demo.user", password: "fixture-demo-password" } as const;

/**
 * What the sign-in page's password row shows in place of the password. Every
 * state snapshot captures visible text, so the row keeps this fixed text, and a
 * test names what the page shows rather than reading it off the page.
 */
export const authGatePasswordPlaceholder = "Withheld: a run supplies it as the declared secret auth-gate-password.";

/** The protected account summary, rendered only while the session is valid. */
export const authGateProtectedAccount = { holder: "Demo Customer", plan: "Team (annual)", balance: "$1,284.50" } as const;
