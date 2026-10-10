// The node library a matrix Flow is assembled and validated against: the web
// domain's output nodes beside Core's built-ins, with the domain's permissions
// and runtime capabilities. It is the library the web panel host binds
// (`domain/src/web-panel-host.ts`) and the one the domain's own service tests
// bind, so a script that assembles here assembles in the Core that runs it.

import { AutomationStudioNativeNodeRuntime } from "fluxiq/automation-studio";
import {
  createWebAutomationOutputNodeImplementationBundle,
  createWebAutomationOutputNodeManifest,
  WEB_AUTOMATION_RUNTIME_CAPABILITIES,
  WEB_AUTOMATION_RUNTIME_PERMISSIONS,
} from "@fluxiq-web-extension/domain/node";

/** A fresh web node runtime; each compile binds its own, so no two share registration state. */
export function webNodeRuntime(): AutomationStudioNativeNodeRuntime {
  return new AutomationStudioNativeNodeRuntime({ permissions: WEB_AUTOMATION_RUNTIME_PERMISSIONS, runtimeCapabilities: WEB_AUTOMATION_RUNTIME_CAPABILITIES })
    .register(createWebAutomationOutputNodeManifest(), createWebAutomationOutputNodeImplementationBundle());
}
