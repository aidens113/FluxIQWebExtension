import assert from "node:assert/strict";
import test from "node:test";
import { parseRecoveryMatrixCommand } from "../command.js";
import { parseLabCommand } from "../../commands.js";

test("cases, rows and --ready are read together, each repeatable", () => {
  assert.deepEqual(parseRecoveryMatrixCommand(["--case", "1", "--case", "13b", "--row", "4", "--ready"]), { command: "recovery-matrix", list: false, caseIds: ["1", "13b"], rows: [4], ready: true });
});

test("--list takes no selection and runs nothing", () => {
  assert.deepEqual(parseRecoveryMatrixCommand(["--list"]), { command: "recovery-matrix", list: true });
  assert.throws(() => parseRecoveryMatrixCommand(["--list", "--case", "1"]), /--list runs nothing/);
});

test("an empty selection, an unknown argument, a bad id and row 12 are refused", () => {
  assert.throws(() => parseRecoveryMatrixCommand([]), /Usage: lab recovery-matrix/);
  assert.throws(() => parseRecoveryMatrixCommand(["--scenario", "bigbox-retail"]), /Unknown recovery-matrix argument/);
  assert.throws(() => parseRecoveryMatrixCommand(["--case", "row-1"]), /--case takes a case id/);
  assert.throws(() => parseRecoveryMatrixCommand(["--row", "14"]), /from 1 to 13/);
  assert.throws(() => parseRecoveryMatrixCommand(["--row", "12"]), /paid proof/);
  assert.throws(() => parseRecoveryMatrixCommand(["--case"]), /needs a value/);
});

test("the Lab's own parser hands recovery-matrix to this one", () => {
  assert.deepEqual(parseLabCommand(["recovery-matrix", "--row", "13"]), { command: "recovery-matrix", list: false, caseIds: [], rows: [13], ready: false });
});
