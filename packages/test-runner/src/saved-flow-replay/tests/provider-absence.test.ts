import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../failure.js";
import { removeCoreProviderKeys } from "../core-provider-keys.js";
import { providerCredentialVariables } from "../provider-credential-variables.js";

test("names every provider credential set in any environment, case-insensitively, and never a value", () => {
  const found = providerCredentialVariables({ deepseek_api_key: "secret-one", PATH: "x" }, { OPENAI_API_KEY: "secret-two", FLUXIQ_TEST_PIN: "123456" });
  assert.deepEqual(found, ["DEEPSEEK_API_KEY", "OPENAI_API_KEY"]);
  assert.equal(JSON.stringify(found).includes("secret"), false);
});

test("a blank or absent credential variable is not a credential", () => {
  assert.deepEqual(providerCredentialVariables({ DEEPSEEK_API_KEY: "", ANTHROPIC_API_KEY: "   ", OPENAI_API_KEY: undefined }), []);
});

/** A Secret Keys store holding `keys`, answering the two calls the replay makes. */
function fakeSecretKeys(keys: Array<{ id: string; kind: string }>, options: { refuseDelete?: boolean } = {}) {
  const deletes: Array<Record<string, unknown>> = [];
  return {
    deletes,
    control: {
      async secretKeysCall(endpoint: string, payload: Record<string, unknown>): Promise<unknown> {
        if (endpoint === "snapshot") return { keys: keys.map(key => ({ ...key, name: key.id, scope: "global", enabled: true })) };
        if (endpoint === "delete-key") {
          deletes.push(payload);
          if (options.refuseDelete) return { deleted: false };
          const index = keys.findIndex(key => key.id === payload.id);
          if (index !== -1) keys.splice(index, 1);
          return { deleted: index !== -1 };
        }
        throw new Error(`unexpected Secret Keys endpoint ${endpoint}`);
      },
    },
  };
}

test("removes every model provider key Core holds, authorized by password and PIN, and leaves other kinds", async () => {
  const store = fakeSecretKeys([{ id: "key.llm.1", kind: "llm" }, { id: "key.api.1", kind: "api" }, { id: "key.llm.2", kind: "llm" }]);
  const removal = await removeCoreProviderKeys(store.control, { password: "account-password", pin: "123456" });
  assert.deepEqual(removal, { before: 2, removed: 2, after: 0 });
  assert.deepEqual(store.deletes, [
    { id: "key.llm.1", authorizationPassword: "account-password", authorizationPin: "123456" },
    { id: "key.llm.2", authorizationPassword: "account-password", authorizationPin: "123456" },
  ]);
});

test("a Core that holds no provider key needs nothing removed", async () => {
  const store = fakeSecretKeys([{ id: "key.api.1", kind: "api" }]);
  assert.deepEqual(await removeCoreProviderKeys(store.control, { password: "account-password" }), { before: 0, removed: 0, after: 0 });
  assert.deepEqual(store.deletes, []);
});

test("a provider key that survives removal fails the replay rather than being trusted unused", async () => {
  const store = fakeSecretKeys([{ id: "key.llm.1", kind: "llm" }], { refuseDelete: true });
  await assert.rejects(removeCoreProviderKeys(store.control, { password: "account-password" }), (error: unknown) => error instanceof RunnerFailure && /still holds 1 model provider key/u.test(error.message));
});

test("an unreadable Secret Keys snapshot fails closed", async () => {
  await assert.rejects(removeCoreProviderKeys({ secretKeysCall: async () => ({ items: [] }) }, { password: "account-password" }), /unreadable Secret Keys snapshot/u);
});
