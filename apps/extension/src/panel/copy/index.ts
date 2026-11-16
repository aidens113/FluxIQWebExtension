// Every sentence the panel shows about status, steps and errors, as pure
// functions of the status, so the words are tested without a DOM.
export { connectionCopy, type ConnectionCopy } from "./connection-copy";
export { EXTENSION_RESTARTED, errorSentence } from "./error-copy";
export { FLUXIQ_FAILED, relayFailureSentence } from "./relay-failure-sentence";
export { pageHostname } from "./page-hostname";
export { stepSentence } from "./step-copy";
