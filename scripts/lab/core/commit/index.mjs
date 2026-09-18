// Which COMMIT the Core a run loads is sitting on, as opposed to `../build/`,
// which asks whether that commit's source has been compiled and whether it is
// being recompiled underneath the run.
//
// The two are independent, and only this one catches a Core that is perfectly
// built and simply old. `read-core-commit.mjs` reads the position;
// `behind-target.mjs` turns it into the verdict and the message.

export { coreCommitStaleness } from "./behind-target.mjs";
export { readCoreCommit } from "./read-core-commit.mjs";
