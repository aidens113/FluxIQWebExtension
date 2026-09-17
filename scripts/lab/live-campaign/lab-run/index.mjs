// One Lab run as a child process: the command a task becomes, the profile and
// environment it runs with, spawning it, reading what it printed, and whether
// it died of this machine's RAM fault.

export { displayCommand, labRunArguments } from "./command.mjs";
export { labEnvironment } from "./environment.mjs";
export { parseLabResult, parseRunnerRefusal } from "./output.mjs";
export { DEFAULT_PROFILES } from "./profiles.mjs";
export { ramFaultSignature } from "./ram-fault.mjs";
export { runNode, spawnLab } from "./spawn.mjs";
