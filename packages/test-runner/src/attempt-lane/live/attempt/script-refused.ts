/** A request the script did not expect: a defect in the script or in the road, and the run fails on it. */
export class AttemptScriptRefused extends Error {
  readonly name = "AttemptScriptRefused";
}
