// The page-level evidence a browser snapshot carries, projected into web state.
//
// The extension's `content/evidence/` gathers what the page *is* rather than
// what its elements are -- the dialogs standing in front of it, what is painted
// over its controls, whether it is still working, how it is laid out, what
// repeats on it, its forms, and how it was navigated to -- and the background
// worker folds those items across every frame. Until this directory existed the
// projection read a fixed list of six snapshot fields and dropped the rest, so
// none of it reached state and nothing downstream of the projection could see
// it.
//
// `input.ts` is what the browser offers and how it is got at, `read.ts` turns
// an untrusted wire value into something or into nothing, and `project.ts`
// decides the paths, the shapes and the bounds. Only the three names below are
// public: `snapshot.ts` is the projection's one entry point and the readers are
// internal, because a second caller reading the evidence its own way is how the
// paths would start to disagree.

export { pageEvidenceOfSnapshot, pageEvidenceTruncatedElements, type WebAutomationPageEvidenceInput } from "./input";
export { addPageEvidenceStateValues } from "./project";
