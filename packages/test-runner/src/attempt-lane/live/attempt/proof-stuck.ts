/** A proof stopped waiting: not a judgement of the attempt, which is not over. `stood` says where it was, in words. */
export class AttemptProofStuck extends Error {
  readonly name = "AttemptProofStuck";

  constructor(readonly stood: string) {
    super(`The proof stopped waiting: ${stood}`);
  }
}
