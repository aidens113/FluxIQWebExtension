/** Whether the step reads the target's words (`./index.ts`). Only `true` is a mark. */
export function readsItsWords(target: { readsWords?: boolean | undefined } | undefined): boolean {
  return target?.readsWords === true;
}
