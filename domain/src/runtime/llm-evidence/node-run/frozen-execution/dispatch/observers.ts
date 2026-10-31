import type { WebNodeFrozenCommand } from "../types";

/** Command object identity correlates a main attempt with its last gateway lowering. */
export const webNodeDispatchObservers = new WeakMap<object, (sessionId: string, command: WebNodeFrozenCommand) => void>();
