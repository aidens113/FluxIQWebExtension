// Core's recording-capture policy as this browser last heard it.
//
// Core owns what a recording may capture and whether direct requests may be
// turned on (`get-recording-capture-policy`, a paired-client read). This asks
// for it through the same pairing-token call the panel relays use and keeps the
// answer. Until Core has answered -- not paired yet, Core down, or an older Core
// without the endpoint -- the policy is Core's own default, which is what the
// extension did before Core owned it: every capture switch as the person set
// it, direct requests off. A later failed read keeps the last policy Core gave.

import { AUTOMATION_STUDIO_DEFAULT_RECORDING_CAPTURE_POLICY, type AutomationStudioRecordingCapturePolicy } from "fluxiq/automation-studio/nodes";
import type { PanelRelayResponse } from "../../shared/protocol";
import { readCapturePolicy } from "./read-capture-policy";

/** Core's endpoint name (`AUTOMATION_STUDIO_ENDPOINTS.getRecordingCapturePolicy`), written out because that constant's barrel is not browser-safe. */
const GET_RECORDING_CAPTURE_POLICY_ENDPOINT = "get-recording-capture-policy";

export type CapturePolicySourceDeps = {
  /** A Core program call carrying the pairing token (`callCoreProgram`). */
  readonly call: (endpoint: string, payload: Record<string, unknown>) => Promise<PanelRelayResponse>;
  /** The project this browser's session belongs to, when one is known. */
  readonly projectId: () => string | null | undefined;
  /** Told when a read changed the policy, so a recording in progress can pick it up. */
  readonly onChange?: (policy: AutomationStudioRecordingCapturePolicy) => void;
};

export class CapturePolicySource {
  private known: AutomationStudioRecordingCapturePolicy | undefined;
  private reading: Promise<AutomationStudioRecordingCapturePolicy> | undefined;

  constructor(private readonly deps: CapturePolicySourceDeps) {}

  /** The policy Core last gave, or Core's default when it has given none. */
  current(): AutomationStudioRecordingCapturePolicy {
    return this.known ?? AUTOMATION_STUDIO_DEFAULT_RECORDING_CAPTURE_POLICY;
  }

  /** Asks Core again; a read already under way is shared rather than repeated. Never rejects. */
  refresh(): Promise<AutomationStudioRecordingCapturePolicy> {
    this.reading ??= this.read().finally(() => { this.reading = undefined; });
    return this.reading;
  }

  private async read(): Promise<AutomationStudioRecordingCapturePolicy> {
    const projectId = this.deps.projectId();
    let reply: PanelRelayResponse;
    try {
      reply = await this.deps.call(GET_RECORDING_CAPTURE_POLICY_ENDPOINT, typeof projectId === "string" && projectId ? { projectId } : {});
    } catch {
      return this.current();
    }
    const payload = reply.ok && reply.payload && typeof reply.payload === "object" ? reply.payload as Record<string, unknown> : undefined;
    const policy = readCapturePolicy(payload?.policy);
    if (!policy) return this.current();
    const changed = JSON.stringify(policy) !== JSON.stringify(this.current());
    this.known = policy;
    if (changed) this.deps.onChange?.(policy);
    return policy;
  }
}
