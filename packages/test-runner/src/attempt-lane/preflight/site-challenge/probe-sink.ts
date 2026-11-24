/** What the scripted model saw, as yes or no only: never a page's words. */
export type SiteChallengeProbeSink = {
  /** Model decisions asked for, and the words of none of them. */
  decisions: number;
  /** The page the model first looked at still showed a check. */
  firstPageShowedCheck: boolean | null;
  /** The read the script made after the hand-off came back without an error. */
  readSucceeded: boolean;
  /** The page the read answered no longer showed a check. */
  checkGoneAfterRead: boolean | null;
  /** The names, never the values, of the fields the read answered with. */
  readResultKeys: readonly string[];
};

export const newProbeSink = (): SiteChallengeProbeSink => ({ decisions: 0, firstPageShowedCheck: null, readSucceeded: false, checkGoneAfterRead: null, readResultKeys: [] });
