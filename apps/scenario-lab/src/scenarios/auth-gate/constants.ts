/** Paths the auth-gate fixture serves and redirects between. */
export const authGatePaths = {
  start: "/scenarios/auth-gate/",
  account: "/scenarios/auth-gate/account",
  expiredSignIn: "/scenarios/auth-gate/?expired=1",
} as const;

/**
 * Fixture-only demo credentials, stated on the sign-in page. They open
 * nothing outside this loopback fixture, and the password never enters the
 * fixture state.
 */
export const authGateDemoCredentials = { username: "demo.user", password: "fixture-demo-password" } as const;

/** The protected account summary, rendered only while the session is valid. */
export const authGateProtectedAccount = { holder: "Demo Customer", plan: "Team (annual)", balance: "$1,284.50" } as const;
