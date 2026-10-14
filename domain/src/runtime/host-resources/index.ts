// The web domain's host-resource port: one builder drives the browser at a time
// (automation-project-agents plan, `Host Actions`).
export { WEB_AUTOMATION_HOST_RESOURCE_CAPACITY } from "./capacity";
export { webAutomationLeasableSession } from "./leasable-session";
export { createWebAutomationHostResourcePort, type WebAutomationHostResourcePortDeps } from "./port";
export { webAutomationHostResourceKey } from "./resource-key";
