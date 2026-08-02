import { booleanValue, numberValue } from "../shared/definition";
export function routeFromCondition(context, trueRoute = "true", falseRoute = "false") {
    return booleanValue(context.inputs.condition ?? context.parameters.condition) ? trueRoute : falseRoute;
}
export function maxIterations(context) {
    return Math.max(0, Math.floor(numberValue(context.parameters.maxIterations, 25)));
}
