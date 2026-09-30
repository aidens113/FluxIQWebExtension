// Rule `balance`: after a live run ends on an empty provider balance or an
// exhausted quota, every live run is refused until a person clears the stop.
//
// There is no override file: deleting `STOP-balance` is the override, and only
// a person, after topping the account up, does it.

/** @param {import("./guard-state.mjs").GuardState} state */
export function checkBalanceStop(state) {
  if (state.stopBalance === null) return null;
  return {
    rule: "balance", overridable: false,
    why: `live runs are stopped because the provider reported an empty balance or exhausted quota: ${state.stopBalance.trim().split(/\r?\n/u)[0]}`,
    remedy: `The user tops up the provider account and then deletes ${state.files.stopBalance} by hand. An agent must not delete it.`,
  };
}
