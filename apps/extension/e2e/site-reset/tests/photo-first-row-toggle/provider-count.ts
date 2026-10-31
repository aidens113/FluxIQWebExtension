import type { AutomationStudioLlmProvider } from "fluxiq/automation-studio";
import type { InstalledBuild } from "../../index";

/** Counts actual provider callbacks while leaving the scripted provider and every answer intact. */
export function countPhotoProviderCallbacks(service: InstalledBuild["service"], beforeVerification: () => Promise<void>) {
  let calls = 0;
  const original = service.bindLlmExecutionProvider;
  const watched = (provider: AutomationStudioLlmProvider): AutomationStudioLlmProvider => ({
    ...provider,
    ...(provider.measureInput ? { measureInput: provider.measureInput.bind(provider) } : {}),
    ...(provider.estimateCostUsd ? { estimateCostUsd: provider.estimateCostUsd.bind(provider) } : {}),
    runTask: async (request, execution) => {
      calls++;
      if (request.taskKind === "loop_verification") await beforeVerification();
      return provider.runTask(request, execution);
    }
  });
  service.bindLlmExecutionProvider = function (resolver) {
    return original.call(this, async (...args) => {
      const binding = await resolver(...args);
      if (!binding) return binding;
      if ("runTask" in binding) return watched(binding);
      return { ...binding, provider: watched(binding.provider) };
    });
  };
  return { calls: () => calls, restore: () => { service.bindLlmExecutionProvider = original; } };
}
