// A real Core's model calls, answered by a script in the Lab's process, so a whole
// attempt runs from the real chat through the real service on a real site with no
// provider and no spend. Everything but the model's choices is the product's.
export { anthropicStreamBody, scriptedModelReplyText, scriptedModelUsage, type ScriptedModelUsage } from "./anthropic-stream.js";
export { providerFreeEnvironment, scriptedModelChildEnvironment } from "./child-environment.js";
export { scriptedModelKey } from "./fake-key.js";
export { startScriptedModelServer, type ScriptedModelCall, type ScriptedModelServer } from "./model-server.js";
export { routedFetch, routeModelCall, SCRIPTED_MODEL_ORIGIN_ENV, type ModelCallRoute } from "./route-model-call.js";
export type { ScriptedModelScript, ScriptedReply } from "./script.js";
export * from "./scripts/index.js";
export { readScriptedModelRequest, type ScriptedModelKind, type ScriptedModelRequest } from "./wire-request.js";
