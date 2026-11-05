// The tasks seam answers nothing today, so the Automations tab looks as it always did and no
// dead control shows. What fills it is named in `tasks-port.ts`.

import assert from "node:assert/strict";
import test from "node:test";
import type { PanelResult } from "../../state";
import { extensionTasksPort } from "../tasks-port";

test("no tasks port exists yet, so there is nothing to show", () => {
  const request = async <T>(): Promise<PanelResult<T>> => ({ ok: false, sentence: "not asked" });
  assert.equal(extensionTasksPort(request), undefined);
});
