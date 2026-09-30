// Activity events and relay states for the chat's tests, shaped as the
// background relay hands them over (`background/activity/activity-relay.ts`).

import type { ClientGatewayActivity, ExtensionActivityState } from "../../../shared/activity/index";

/** An event of unit of work `activityId`; `at` defaults to one second per sequence. */
export function activityEvent(sequence: number, fields: Partial<ClientGatewayActivity> = {}): ClientGatewayActivity {
  return {
    activityId: "build-1",
    sequence,
    subject: { kind: "build", id: "build-1", projectId: "project-1" },
    phase: "building",
    label: `Event ${sequence}`,
    at: new Date(Date.UTC(2026, 8, 29, 12, 0, sequence)).toISOString(),
    ...fields
  };
}

/** A relay state holding `recent`, the last as `current`. */
export function relayState(recent: ClientGatewayActivity[], fields: Partial<ExtensionActivityState> = {}): ExtensionActivityState {
  return { current: recent[recent.length - 1] ?? null, recent, overlay: "expanded", live: true, ...fields };
}

/** The time `activityEvent(sequence)` carries, in ms. */
export function eventTime(sequence: number): number {
  return Date.UTC(2026, 8, 29, 12, 0, sequence);
}
