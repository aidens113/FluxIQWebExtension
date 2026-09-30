// Robot checks a press puts up on the page: watched after the press, waited
// out when they clear by themselves, and reported when a person must answer.
// What a robot check is, and who clears it, is read by `../challenge-evidence.ts`.

export { watchRobotCheck } from "./robot-check-watch";

export type { RobotCheckProbe, RobotCheckSighting, RobotCheckWatch } from "./robot-check-watch";
