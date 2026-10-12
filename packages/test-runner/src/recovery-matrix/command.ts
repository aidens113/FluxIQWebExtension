// `lab recovery-matrix`'s arguments.
//
//   recovery-matrix --list                 every row, its cases and what it still waits for; runs nothing
//   recovery-matrix --case <id> ...        the named cases (`1`, `4a`, `13b`), repeatable
//   recovery-matrix --row <n> ...          every case of the named rows, repeatable
//   recovery-matrix --ready                every case a current Core can prove: no missing capability, no authoring gap
//
// The scenarios are the matrix's own, all among the ten realistic ones; no
// argument names a scenario, a target or a model. Every case runs
// provider-free on its own persistent workspace.

export type RecoveryMatrixCommand =
  | Readonly<{ command: "recovery-matrix"; list: true }>
  | Readonly<{ command: "recovery-matrix"; list: false; caseIds: readonly string[]; rows: readonly number[]; ready: boolean }>;

const CASE_ID = /^[0-9]{1,2}[a-z]?$/u;
export const RECOVERY_MATRIX_USAGE = "Usage: lab recovery-matrix --list | --case <id> [--case <id> ...] | --row <n> [--row <n> ...] | --ready";

/** Reads the arguments after `recovery-matrix`. */
export function parseRecoveryMatrixCommand(args: readonly string[]): RecoveryMatrixCommand {
  const caseIds: string[] = [];
  const rows: number[] = [];
  let ready = false;
  let list = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--list") list = true;
    else if (argument === "--ready") ready = true;
    else if (argument === "--case" || argument === "--row") {
      const value = args[index + 1];
      if (value === undefined || value.startsWith("--")) throw new Error(`${argument} needs a value. ${RECOVERY_MATRIX_USAGE}`);
      index += 1;
      if (argument === "--case") {
        if (!CASE_ID.test(value)) throw new Error(`--case takes a case id such as 1, 4a or 13b, not ${JSON.stringify(value)}`);
        caseIds.push(value);
      } else {
        const row = Number(value);
        if (!Number.isInteger(row) || row < 1 || row > 13) throw new Error(`--row takes a matrix row from 1 to 13, not ${JSON.stringify(value)}`);
        if (row === 12) throw new Error("Row 12 is the paid proof; the recovery matrix runs provider-free and never runs it");
        rows.push(row);
      }
    } else throw new Error(`Unknown recovery-matrix argument ${JSON.stringify(argument)}. ${RECOVERY_MATRIX_USAGE}`);
  }
  if (list) {
    if (caseIds.length || rows.length || ready) throw new Error(`--list runs nothing and takes no selection. ${RECOVERY_MATRIX_USAGE}`);
    return { command: "recovery-matrix", list: true };
  }
  if (!caseIds.length && !rows.length && !ready) throw new Error(RECOVERY_MATRIX_USAGE);
  return { command: "recovery-matrix", list: false, caseIds, rows, ready };
}
