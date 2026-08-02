import { WEB_AUTOMATION_ACTION_TYPES } from "./types";
export const webAutomationClientCapabilities = [
    { id: "web.context.state", label: "Web context state", kind: "state" },
    { id: "web.structured.snapshot", label: "Structured web snapshots", kind: "snapshot" },
    { id: "web.recording.events", label: "Web recording events", kind: "recording" },
    {
        id: "web.actions",
        label: "Web actions",
        kind: "action",
        actionTypes: WEB_AUTOMATION_ACTION_TYPES
    }
];
