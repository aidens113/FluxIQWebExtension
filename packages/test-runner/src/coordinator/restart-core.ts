/** One owned child restart. Stop failure never starts a replacement, and teardown always wins. */
export async function restartCoreAtStoppedBoundary(input: { stop(): Promise<void>; start(): void; ready(): Promise<void>; cancelled(): boolean; whileStopped?: () => Promise<void> }) {
  await input.stop();
  let preparationError: unknown;
  let preparationFailed = false;
  try { await input.whileStopped?.(); } catch (error) {
    preparationFailed = true;
    preparationError = error;
  }
  let restartError: unknown;
  let restartFailed = false;
  try {
    if (input.cancelled()) throw new DOMException("The isolated host owner stopped", "AbortError");
    input.start();
    await input.ready();
  } catch (error) {
    restartFailed = true;
    restartError = error;
  }
  if (preparationFailed && restartFailed) throw new AggregateError([preparationError, restartError], "The isolated host preparation and restart failed");
  if (preparationFailed) throw preparationError;
  if (restartFailed) throw restartError;
}
