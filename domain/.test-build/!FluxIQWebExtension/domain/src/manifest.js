import { WEB_AUTOMATION_DOMAIN_ID } from "./constants";
import { webAutomationActionDefinitions } from "./actions/schemas";
export const webAutomationDomain = {
    manifest: {
        id: WEB_AUTOMATION_DOMAIN_ID,
        title: "Web Automation",
        category: "automation",
        description: "Record, inspect, and replay browser-based web workflows through generic FluxIQ clients.",
        icon: "mouse-pointer-click",
        status: "preview",
        capabilities: ["recording", "state", "snapshot", "action-execution"],
        inputs: [
            {
                id: "web-client",
                title: "Connected web client",
                description: "A paired extension, recorder, worker, or other client capable of web automation."
            }
        ],
        outputs: [
            {
                id: "recording",
                title: "Web automation recording",
                description: "A canonical FluxIQ recording containing validated web automation events.",
                effects: ["recording.created", "state.updated", "policy.seeded"]
            }
        ],
        metadata: {
            actionDefinitions: webAutomationActionDefinitions
        }
    }
};
