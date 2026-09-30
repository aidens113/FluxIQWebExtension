// Removes the previous emit before `tsc` writes the next one. `tsc` overwrites
// but never deletes, so a renamed or deleted source would otherwise leave a
// compiled module -- and a compiled test `node --test` still runs -- behind.

import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

rmSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "dist"), { recursive: true, force: true });
