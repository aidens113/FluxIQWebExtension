// What the panel knows about the person's model key: its safe availability, the reply it is read
// from, and the reader that keeps it fresh while the browser is connected (`key/`).
export { createModelKeyReader, KEY_BEAT_MS, modelKeyFromReply, modelKeyUnavailableLine, type KeyReaderHost, type ModelKeyReader, type ModelKeyReading } from "./key";
