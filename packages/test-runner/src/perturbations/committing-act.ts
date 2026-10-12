import { webLastingActStatement } from "@fluxiq-web-extension/domain/node";

/**
 * Whether an action Core sends the extension is a committing act: a press, a
 * key press, a dialog answer, or typing that submits its form.
 *
 * The domain owns that definition, once (`domain/src/runtime/
 * lasting-act-statement.ts`). Its statement marks a committing act's failure
 * `ambiguous` when nothing shows it was unacted, and leaves every other
 * action's record as it was, so asking it about an empty failure answers the
 * question without a second list here that could drift from the domain's.
 */
export function isCommittingAct(actionType: string, parameters: unknown): boolean {
  const unstated: Parameters<typeof webLastingActStatement>[3] = { retryable: true };
  const stated = webLastingActStatement(
    actionType as Parameters<typeof webLastingActStatement>[0],
    (parameters !== null && typeof parameters === "object" && !Array.isArray(parameters) ? parameters : {}) as Parameters<typeof webLastingActStatement>[1],
    undefined,
    unstated
  );
  return stated.effect === "ambiguous";
}
