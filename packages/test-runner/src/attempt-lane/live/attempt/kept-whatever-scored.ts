/**
 * Scores an ended attempt and keeps its ending's evidence whatever the scoring throws.
 *
 * The attempt has ended and been paid for before it is scored, so what a person saw and what it
 * spent must not depend on every later read working: run-mw43h5ew-a04a583d's dataset read threw,
 * and the run kept no attempt record, no answer picture and no spend. On a throw `keep` runs, its
 * own failure is logged and never replaces the scoring's, and the scoring's error is thrown on, so
 * the run still fails, and says why.
 */
export async function keptWhateverScored<T>(score: () => Promise<T>, keep: () => Promise<void>, log: (line: string) => void): Promise<T> {
  try {
    return await score();
  } catch (error) {
    try {
      await keep();
    } catch (failed) {
      log(`[attempt] the attempt's ending could not be kept: ${failed instanceof Error ? failed.message : String(failed)}`);
    }
    throw error;
  }
}
