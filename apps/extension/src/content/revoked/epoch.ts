// How many times this document's content script has been revoked. Work in
// flight captures the number when it starts and is interrupted when it has
// moved; a revocation is never undone, so the number only grows.

let epoch = 0;

export const revokedEpoch = {
  /** The number now. */
  current: (): number => epoch,
  /** Records a revocation. */
  advance: (): void => {
    epoch += 1;
  }
};
