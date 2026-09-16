// The content-script half of the extraction picker (X4.2): the overlay, the
// pick, the confirmation preview, and the recorded `data.extract`.
//
// `message-handler.ts` is the only consumer. It reads a message with
// `extractionContentMessage`, applies its own top-frame rule, and hands the
// message to `handleExtractionMessage`; starting and stopping a pick belong to
// the picker and are not part of its surface.

export { extractionContentMessage, handleExtractionMessage } from "./messages";
export type { ExtractionHandling } from "./messages";
