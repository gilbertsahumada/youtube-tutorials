import { planDeliveries } from "../src/delivery.js";
import { webhookEvents } from "../src/events.js";

console.log("Webhook delivery plan");

for (const delivery of planDeliveries(webhookEvents)) {
  console.log(`${delivery.eventId} -> ${delivery.action}`);
}
