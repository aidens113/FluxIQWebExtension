import {
  defineDomainIo,
  defineInput,
  defineOutput,
  type DomainIoRegistration,
  type FluxIQ
} from "fluxiq";
import { WEB_AUTOMATION_DOMAIN_ID } from "../constants";
import { WEB_AUTOMATION_ACTION_TYPES, type WebAutomationActionType } from "../actions/types";
import {
  actionInputDefinitions,
  stateInputDefinitions,
  type WebAutomationRecordedInputPayload
} from "./input-model";
import { webAutomationManifestInputs, webAutomationManifestOutputs } from "./manifest-definitions";
import { webAutomationOutputPayload } from "../output-nodes";
import { GatewayInputHub } from "./gateway-input-hub";
import { dispatchWebAutomationOutput } from "./gateway-output-dispatcher";

export * from "./input-model";

export { webAutomationManifestInputs, webAutomationManifestOutputs } from "./manifest-definitions";

export function createWebAutomationDomainIo(fluxiq: FluxIQ): DomainIoRegistration {
  const liveInputs = new GatewayInputHub(fluxiq);
  return defineDomainIo({
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    inputs: [
      ...stateInputDefinitions.map((definition) => defineInput({
        definition,
        mode: "stream" as const,
        subscribe: (handler) => liveInputs.subscribe(definition.id, handler)
      })),
      ...actionInputDefinitions.map(([id, title, outputId]) => defineInput<WebAutomationRecordedInputPayload>({
        definition: { id, title, role: "action", outputId },
        mode: "stream",
        subscribe: (handler) => liveInputs.subscribe(id, handler),
        outputBinding: { outputId, toPayload: (event) => webAutomationOutputPayload(outputId, event.payload) }
      }))
    ],
    outputs: WEB_AUTOMATION_ACTION_TYPES.map((outputId) => defineOutput({
      definition: webAutomationManifestOutputs.find((output) => output.id === outputId)!,
      mode: "request",
      dispatch: (request) => dispatchWebAutomationOutput(fluxiq, request)
    }))
  });
}
