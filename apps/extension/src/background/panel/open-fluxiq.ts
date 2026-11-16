// "Open FluxIQ": the web panel's address, as a tab. It is the fallback for
// anything the extension's panel cannot do itself. An automation uses Core's
// Flow page (`/flows/<flowId>?project=<projectId>`); a generic button opens the
// address as configured, which is the web panel's home. The page table is
// `shared/fluxiq-web-routes.ts`. Only HTTP(S) is accepted, including for
// automation links.

import { fluxIQWebPageAddress } from "../../shared/fluxiq-web-routes";

/** The panel or automation address, without adding any authentication material. */
export function fluxIQWebAddress(coreApiUrl: string | undefined, automation?: { projectId: string; flowId: string }): string | undefined {
  return fluxIQWebPageAddress(coreApiUrl, automation ? { kind: "flow", projectId: automation.projectId, flowId: automation.flowId } : { kind: "home" });
}

/** The keys page of the web panel, where a model key is added; undefined when the address is not an http(s) address. */
export function fluxIQKeysAddress(coreApiUrl: string | undefined): string | undefined {
  return fluxIQWebPageAddress(coreApiUrl, { kind: "keys" });
}

/** The page a purpose names; undefined when the address is not an http(s) address. */
export function fluxIQPurposeAddress(coreApiUrl: string | undefined, purpose: "model-key" | "projects"): string | undefined {
  return purpose === "projects" ? fluxIQWebPageAddress(coreApiUrl, { kind: "projects" }) : fluxIQKeysAddress(coreApiUrl);
}
