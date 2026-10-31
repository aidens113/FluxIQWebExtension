import type { InstalledBuild } from "../../index";

/** Counts actual provider callbacks while leaving the scripted provider and every answer intact. */
export function countPhotoProviderCallbacks(service: InstalledBuild["service"], beforeVerification: () => Promise<void>) {
  let calls = 0;
  const original = service.bindLlmExecutionProvider;
  service.bindLlmExecutionProvider = function (resolver) {
    return original.call(this, async (...args) => {
      const binding = await resolver(...args);
      if (!binding) return binding;
      const provider = binding.provider;
      return { ...binding, provider: { ...provider, runTask: async request => {
        calls++;
        if (request.taskKind === "loop_verification") await beforeVerification();
        return provider.runTask(request);
      } } };
    });
  };
  return { calls: () => calls, restore: () => { service.bindLlmExecutionProvider = original; } };
}
