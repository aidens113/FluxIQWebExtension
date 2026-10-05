type Scope = { projectId: string; scopeState: "ready"; composerAvailable: boolean; composerEnabled: boolean };

/** Navigate once through the mounted view, then await its actual authorized scoped read. */
export async function navigateChatProject(projectId: string, navigate: () => Promise<unknown>, read: () => Promise<unknown>, timeoutMs = 30_000): Promise<Scope> {
  if (!projectId || projectId.length > 256 || /[\s\u0000-\u001f\u007f]/u.test(projectId)) throw new Error("Chat project must be a bounded opaque identifier");
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000) throw new Error("Chat project timeout must be bounded");
  const deadline = Date.now() + timeoutMs;
  await within(navigate(), deadline);
  for (;;) {
    const value = await within(read(), deadline);
    if (!value || typeof value !== "object") throw new Error("The mounted chat project receiver is unavailable");
    const scope = value as Record<string, unknown>;
    if (scope.projectId !== projectId) throw new Error("The mounted chat project does not match the selected project");
    if (scope.scopeState === "error") throw new Error("The mounted chat project read returned an error");
    if (scope.scopeState !== "loading" && scope.scopeState !== "ready") throw new Error("The mounted chat project read is not ready");
    if (scope.scopeState === "ready" && scope.composerAvailable === true && scope.composerEnabled === true) {
      return { projectId, scopeState: "ready", composerAvailable: true, composerEnabled: true };
    }
    const left = deadline - Date.now();
    if (left <= 0) throw new Error("Timed out waiting for the mounted chat project to be ready");
    await new Promise(resolve => setTimeout(resolve, Math.min(300, left)));
  }
}

async function within<T>(operation: Promise<T>, deadline: number): Promise<T> {
  const left = deadline - Date.now();
  if (left <= 0) throw new Error("Timed out waiting for the mounted chat project to be ready");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error("Timed out waiting for the mounted chat project to be ready")), left); })]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
