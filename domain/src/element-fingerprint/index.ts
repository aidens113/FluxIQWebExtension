// The saved identity of a web step's control: one builder every save path uses
// (`build.ts`, fed by `source.ts`), its reading of a recorded element
// (`from-descriptor.ts`), and the save-time guard that refuses a control found
// by one attribute alone (`signals.ts`, `shortfall.ts`). A packet element is
// read in `runtime/llm-evidence/packet-fingerprint/`, beside the packet
// it comes from, for a build's step and a runtime repair alike.

export { webElementFingerprint } from "./build";
export { webElementFingerprintFromDescriptor } from "./from-descriptor";
export {
  WEB_ELEMENT_IDENTITY_MINIMUM_SIGNALS,
  WEB_ELEMENT_IDENTITY_SHORTFALL_CODE,
  webElementIdentityShortfall,
  type WebElementIdentityShortfall
} from "./shortfall";
export { webElementIdentitySignals, type WebElementIdentitySignal } from "./signals";
export type { WebElementFingerprintSource } from "./source";
