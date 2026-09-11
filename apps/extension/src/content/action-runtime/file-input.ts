// Putting files into a file input.
//
// A file input's `files` cannot be assigned a plain array, and a page reacts to
// the `input` and `change` events rather than to the assignment, so the files
// are built into a `DataTransfer` and the two events follow. The names that
// ended up on the input are returned, so the verb can compare them with what
// was requested.
//
// Owned by `w2-upload-dialog`, which replaces this stub.

import type { WebAutomationUploadFile } from "../types";

export type FileInputOutcome =
  | { ok: true; fileNames: string[] }
  | { ok: false; reason: string };

export function setInputFiles(_element: Element, _files: readonly WebAutomationUploadFile[]): FileInputOutcome {
  throw new Error("The file-input capability is not implemented yet.");
}
