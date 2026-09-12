// Putting files into a file input.
//
// A file input's `files` cannot be assigned a plain array, and a page reacts to
// the `input` and `change` events rather than to the assignment, so the files
// are built into a `DataTransfer` and the two events follow. The names that
// ended up on the input are read back off the element rather than echoed from
// the request, so the verb's validation compares what the page holds with what
// was asked for instead of comparing the request with itself.
//
// File contents arrive as base64 in the command and are never logged, never put
// on the result, and never read back: only names and sizes leave this module.

import type { WebAutomationUploadFile } from "../types";

/**
 * Bounds on one upload, mirroring the domain's
 * `WEB_AUTOMATION_UPLOAD_MAX_FILE_BYTES` and `..._MAX_TOTAL_BYTES`. They are
 * restated rather than imported because a value import from the domain would
 * pull its barrel into the content bundle; the domain schema enforces the same
 * bounds on the way in, and this is the page-side backstop.
 */
const UPLOAD_MAX_FILE_BYTES = 1_048_576;
const UPLOAD_MAX_TOTAL_BYTES = 4_194_304;

export type FileInputOutcome =
  | { ok: true; fileNames: string[] }
  | { ok: false; reason: string };

export function setInputFiles(element: Element, files: readonly WebAutomationUploadFile[]): FileInputOutcome {
  if (!(element instanceof HTMLInputElement) || element.type !== "file") {
    return { ok: false, reason: `the target is a ${element.tagName.toLowerCase()}, not a file input` };
  }
  if (files.length === 0) return { ok: false, reason: "the command carried no files" };
  if (files.length > 1 && !element.multiple) {
    return { ok: false, reason: `the file input accepts one file, but ${files.length} were supplied` };
  }

  const transfer = new DataTransfer();
  let totalBytes = 0;
  for (const file of files) {
    const content = decodeBase64(file.contentBase64);
    if (!content) return { ok: false, reason: `the content of ${file.name} is not valid base64` };
    if (content.byteLength > UPLOAD_MAX_FILE_BYTES) {
      return { ok: false, reason: `${file.name} is ${content.byteLength} bytes, over the ${UPLOAD_MAX_FILE_BYTES}-byte file limit` };
    }
    totalBytes += content.byteLength;
    if (totalBytes > UPLOAD_MAX_TOTAL_BYTES) {
      return { ok: false, reason: `the upload is over the ${UPLOAD_MAX_TOTAL_BYTES}-byte total limit` };
    }
    transfer.items.add(new File([content], file.name, { type: file.mimeType }));
  }

  try {
    element.files = transfer.files;
  } catch {
    return { ok: false, reason: "the file input rejected the files" };
  }
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));

  const assigned = element.files;
  return { ok: true, fileNames: assigned ? [...assigned].map((file) => file.name) : [] };
}

/**
 * Base64 to bytes, or undefined when the command's content is malformed. The
 * buffer itself is returned rather than the view over it: `BlobPart` requires
 * an `ArrayBuffer`, and a `Uint8Array` is typed over the wider
 * `ArrayBufferLike`, which includes `SharedArrayBuffer`.
 */
function decodeBase64(contentBase64: string): ArrayBuffer | undefined {
  let binary: string;
  try {
    binary = atob(contentBase64);
  } catch {
    return undefined;
  }
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return buffer;
}
