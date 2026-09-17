// The failure detail a demo launcher adds to its one-line JSON refusal. The
// describer lives in the built test runner; if that is what failed to load,
// the launcher still prints its own fixed line, with no detail.

/** The credential literals a demo environment carries, for redaction. */
export function demoCredentialLiterals(environment) {
  if (!environment || typeof environment !== "object") return [];
  return ["FLUXIQ_TEST_PASSWORD", "FLUXIQ_TEST_PIN", "FLUXIQ_TEST_TOTP"]
    .map(name => environment[name])
    .filter(value => typeof value === "string" && value.length > 0);
}

/** `{ detail }` describing `error` safely, or `{}` when the describer cannot load. */
export async function demoLauncherFailureDetail(error, secretLiterals) {
  try {
    const { describeDemoLauncherFailure } = await import("../../packages/test-runner/dist/demo-workspace/launcher/index.js");
    return { detail: describeDemoLauncherFailure(error, secretLiterals) };
  } catch {
    return {};
  }
}
