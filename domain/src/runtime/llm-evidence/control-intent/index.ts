// What pressing a control would do -- reveal or commit -- decided from what the
// control is and what it says to a person, never from its selector. The reveal
// tools ask `webControlIntent`; the recovery ladder asks `webControlWording`
// for its committing rung, so both refuse the same words the same way.

export { webControlIntent, type WebCommitBasis, type WebControlIntent, type WebRevealBasis } from "./intent";
export { webControlWording, type WebControlReading, type WebControlWording } from "./wording";
