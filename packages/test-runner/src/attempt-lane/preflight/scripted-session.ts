import { llmProviderForModel } from "@fluxiq-web-extension/test-contracts";
import { ensureLiveLlmSecretKey } from "../../live-llm/index.js";
import { openLiveAttemptSession, type LiveAttemptSession } from "../live/attempt/index.js";
import { scriptedModelChildEnvironment, scriptedModelKey, startScriptedModelServer, type ScriptedModelScript, type ScriptedModelServer } from "../scripted-model/index.js";

const MODEL = "claude-haiku-5-5";

/** A real Core answered by a scripted model, the paired extension and its chat in a visible Chrome: no provider, no spend. */
export type PreflightScriptedSession = Readonly<{ session: LiveAttemptSession; server: ScriptedModelServer; model: string; close(): Promise<void> }>;

/**
 * Starts what a preflight stage that needs the chat to run a task needs: a scripted model server, then a live attempt
 * session whose Core calls it, with the fixture account's key installed the way a person would add one. Everything it
 * started goes on any failure, and with `close`.
 */
export async function openPreflightScriptedSession(input: { repositoryRoot: string; fluxiqRepositoryRoot: string; evidenceDirectory: string; runLabel: string; seed: number; startPath: string; script: ScriptedModelScript }): Promise<PreflightScriptedSession> {
  const key = scriptedModelKey();
  const server = await startScriptedModelServer({ script: input.script, key });
  let session: LiveAttemptSession | undefined;
  try {
    session = await openLiveAttemptSession({
      repositoryRoot: input.repositoryRoot, fluxiqRepositoryRoot: input.fluxiqRepositoryRoot, runsDirectory: input.evidenceDirectory,
      runId: `${input.runLabel}-${Date.now().toString(36)}`, seed: input.seed, startPath: input.startPath,
      environment: scriptedModelChildEnvironment(process.env, server.origin), args: ["--authoring-mode", "answer-first", "--llm-model", MODEL, "--llm-max-cost-usd", "5"],
      authorize: async (topology, control) => {
        if (!topology.authorizationPassword) throw new Error("preflight_fixture_account_missing");
        const installed = await ensureLiveLlmSecretKey(control, { secretValue: key, authorizationPassword: topology.authorizationPassword, ...(topology.authorizationPin ? { authorizationPin: topology.authorizationPin } : {}), model: MODEL, provider: llmProviderForModel(MODEL) });
        if (installed.created) await control.reauthenticate();
      },
    });
  } catch (error) {
    await server.close();
    throw error;
  }
  const opened = session;
  return { session: opened, server, model: MODEL, close: async () => { try { await opened.close(); } finally { await server.close(); } } };
}

