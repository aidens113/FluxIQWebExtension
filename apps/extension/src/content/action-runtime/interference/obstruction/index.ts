// What stands in the way, as a result reports it (CC7, interface I1 and I2 of the
// heavy-lifting plan): a layer's generic kind (`generic-kind.ts`) and stable id
// (`stable-id.ts`), the durable target of a control (`control-ref.ts`), a layer's
// ways out with their intents (`ways-out.ts`), and the whole as an obstruction
// (`layer.ts`). The refusal-side readers that find the layer to report live in
// `../../obstruction/`, which leans on `../covering-layer.ts` and so on the
// evidence barrel; nothing here may, or the press loop that reads this
// directory would join that import cycle.

export { controlRefOf } from "./control-ref";
export { genericLayerKind } from "./generic-kind";
export { layerObstruction } from "./layer";
export { layerId } from "./stable-id";
export { layerWaysOut, type LayerWayOut } from "./ways-out";
