// The replay secrets a scenario declares, valued from the scenario itself.
//
// A Flow-lane run of a scenario that declares `secrets` refuses to start
// unless each one's `FLUXIQ_TEST_SECRET_<ID>` is set
// (`packages/test-runner/src/flow-lane/declared-secrets.ts`), and a created
// Flow needs the ones its workflow types. The values are loopback fixture
// literals, written on the very step each declaration names, so the campaign
// takes them from there and never from the machine's environment.

/** The variable the Lab reads a declared secret from: `declaredSecretEnvironmentName`, restated. */
const secretVariable = (id) => `FLUXIQ_TEST_SECRET_${id.replaceAll("-", "_").toUpperCase()}`;

/**
 * `{ FLUXIQ_TEST_SECRET_<ID>: value }` for each secret `manifest` declares,
 * valued from the step it names in the primary recording script or a
 * workflow's. A declaration whose step carries no single non-empty value is
 * left out, so the Lab refuses the run and names the variable.
 */
export function fixtureSecretEnvironment(manifest) {
  const steps = [manifest?.recordingScript ?? [], ...(manifest?.workflows ?? []).map((workflow) => workflow.recordingScript ?? [])].flat();
  const environment = {};
  for (const secret of manifest?.secrets ?? []) {
    const values = new Set(steps.filter((step) => step.id === secret.step && typeof step.value === "string" && step.value !== "").map((step) => step.value));
    if (values.size === 1) environment[secretVariable(secret.id)] = [...values][0];
  }
  return environment;
}
