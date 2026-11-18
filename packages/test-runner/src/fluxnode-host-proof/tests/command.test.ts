import assert from "node:assert/strict";
import test from "node:test";
import { parseFluxNodeHostProofCommand } from "../command.js";

test("the host proof requires scripted-only execution and four or more attempts", () => {
  const command = ["--scenario", "company-website", "--task", "company-website-apprentices"];
  assert.throws(() => parseFluxNodeHostProofCommand(command), /scripted-model/u);
  assert.equal(parseFluxNodeHostProofCommand([...command, "--scripted-model"]).attempts, 4);
  assert.equal(parseFluxNodeHostProofCommand([...command, "--scripted-model", "--lifecycle-only"]).lifecycleOnly, true);
  assert.throws(() => parseFluxNodeHostProofCommand([...command, "--scripted-model", "--attempts", "1"]), /three continuations/u);
  assert.throws(() => parseFluxNodeHostProofCommand([...command, "--scripted-model", "--hosts", "1"]), /two hosts/u);
});
