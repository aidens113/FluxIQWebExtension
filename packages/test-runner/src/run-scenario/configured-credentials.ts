/** The account an isolated Core is bootstrapped with, or nothing when the environment configures none. */
export type ConfiguredCredentials = { username: string; password: string; totp?: string; pin?: string };

/**
 * The test account an isolated Core is started with, read from the environment.
 *
 * Both a username and a password are required for any of it to be used: a
 * half-configured account would have the topology attempt a bootstrap it cannot
 * complete, and the failure would arrive from inside Core's own setup rather
 * than as a missing-environment refusal. Absent both, `undefined` says "start
 * without an identity", which is what a recording-lane run of a scenario that
 * needs no Core account does.
 *
 * TOTP and PIN are spread conditionally rather than passed as `undefined`,
 * because under `exactOptionalPropertyTypes` a present-but-undefined field is a
 * different value from an absent one to every reader downstream.
 */
export function configuredCredentials(environment: NodeJS.ProcessEnv): ConfiguredCredentials | undefined {
  const username = environment.FLUXIQ_TEST_USERNAME;
  const password = environment.FLUXIQ_TEST_PASSWORD;
  return username && password
    ? { username, password, ...(environment.FLUXIQ_TEST_TOTP ? { totp: environment.FLUXIQ_TEST_TOTP } : {}), ...(environment.FLUXIQ_TEST_PIN ? { pin: environment.FLUXIQ_TEST_PIN } : {}) }
    : undefined;
}
