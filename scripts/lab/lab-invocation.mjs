// What the Lab hands the runner about how it was started, so the run's
// manifest can say which command produced it (`packages/test-runner/src/
// run-manifest/run-invocation.ts` reads and screens it). The runner's own
// argv is the same list, but only this says the Lab was the entry, and only
// this lists the FLUXIQ_ variables the person set rather than the ones the
// Lab adds for the child. Names only: a variable's value never leaves here.

/** The variable the runner reads the record from. */
export const LAB_INVOCATION_VARIABLE = "FLUXIQ_LAB_INVOCATION";

/**
 * @param {readonly string[]} args the Lab's argv after the script
 * @param {NodeJS.ProcessEnv} env the Lab's own environment, before it adds anything
 * @returns {{ [LAB_INVOCATION_VARIABLE]: string }}
 */
export function labInvocationEnvironment(args, env) {
  const environment = Object.keys(env).filter((name) => /^FLUXIQ_[A-Z0-9_]+$/u.test(name) && name !== LAB_INVOCATION_VARIABLE).sort();
  return { [LAB_INVOCATION_VARIABLE]: JSON.stringify({ script: "scripts/lab/run-lab.mjs", args: [...args], environment }) };
}
