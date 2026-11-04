// The getting-started screen: numbered steps that replace the chat until the
// browser is connected and approved, and the setup card that carries the model key
// above a chat that stays usable. `start/` decides and draws the steps, `model/`
// reads the key, `setup-port.ts` is the one seam the key is read through.
export { createStartView, startGuide, type StartConnect, type StartGuide, type StartStep, type StartStepKey, type StartStepState, type StartView } from "./start";
export { createModelKeyReader, KEY_BEAT_MS, modelKeyFromReply, type KeyReaderHost, type ModelKeyReader, type ModelKeyReading } from "./model";
export type { SetupPort } from "./setup-port";
export { extensionSetupPort } from "./extension-setup-port";
export { createSetupCard, type SetupCard } from "./setup-card";
