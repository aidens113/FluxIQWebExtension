// Telling Core this browser forgot its pairing, when there was no socket to say it on.
export { deliverPendingForget, forgetWithoutSocket, type ForgetDeliveryDeps, type PendingForget } from "./forget-delivery";
