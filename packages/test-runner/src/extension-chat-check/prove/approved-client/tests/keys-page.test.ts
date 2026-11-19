import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { KEYS_PAGE_HASH, KEYS_PAGE_PATH, isBareKeysPageAddress } from "../keys-page.js";

const core = "http://127.0.0.1:3000";

test("only the AI keys page, with its own fragment, on the web address passes", () => {
  const page = `${KEYS_PAGE_PATH}${KEYS_PAGE_HASH}`;
  assert.equal(isBareKeysPageAddress(`${core}${page}`, core), true);
  for (const bad of [undefined, "", "not a url", `${core}/programs/secret-keys`, `${core}/security/keys`, `${core}${KEYS_PAGE_PATH}`, `${core}${KEYS_PAGE_PATH}?unlock=1${KEYS_PAGE_HASH}`, `${core}${KEYS_PAGE_PATH}#unlock=abc`, `http://user:pw@127.0.0.1:3000${page}`, `http://evil.example${page}`]) {
    assert.equal(isBareKeysPageAddress(bad, core), false, String(bad));
  }
});

test("the expected path and fragment are the ones the extension's route table gives the keys page", () => {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  let source: string | undefined;
  for (let i = 0; i < 10 && source === undefined; i++, dir = path.dirname(dir)) {
    try {
      source = readFileSync(path.join(dir, "apps/extension/src/shared/fluxiq-web-routes.ts"), "utf8");
    } catch {
      // keep climbing
    }
  }
  assert.ok(source, "the extension route table was not found above this test");
  const match = /case "keys":\s*url\.pathname = "([^"]+)";\s*url\.hash = "([^"]+)"/.exec(source);
  assert.equal(match?.[1], KEYS_PAGE_PATH);
  assert.equal(`#${match?.[2]}`, KEYS_PAGE_HASH);
});
