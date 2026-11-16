// The sentence for a failure the background relay named with a code (`PanelRelayFailureCode`): what
// failed and what to do, never "Something went wrong." The relay's own words are plain but each
// is one machine-sized line, so the code, not the text, picks the sentence here. `undefined` when
// the code names nothing this table knows, and the caller keeps `errorSentence`.

/** Said when FluxIQ answered but the answer was a failure with no plain words of its own. */
export const FLUXIQ_FAILED = "FluxIQ couldn't finish that. Try again in a moment; if it keeps happening, open FluxIQ to see why.";

/** The sentence for relay failure `code`, or undefined. `raw` is the relay's own text (kept for a time-out, which says it may still be working). */
export function relayFailureSentence(code: string | undefined, raw: string | undefined): string | undefined {
  switch (code) {
    case "not_paired": return "This browser isn't connected to FluxIQ yet. Connect it first (Settings has the steps), then try again.";
    case "no_project": return "No project is chosen yet. Pick one from the project switcher at the top, then try again.";
    case "unreachable": return "Can't reach FluxIQ. Make sure it is running on this computer, then try again.";
    case "refused": return "FluxIQ didn't accept this browser. Connect again to re-approve it.";
    case "timed_out": return raw !== undefined && raw.trim() !== "" ? raw.trim() : "FluxIQ is taking a long time to answer. It may still be working; check before trying again.";
    case "failed": return FLUXIQ_FAILED;
    default: return undefined;
  }
}
