import assert from "node:assert/strict";
import test from "node:test";
import { planDeliveries } from "../src/delivery.js";

test("delivers successful webhooks", () => {
  assert.deepEqual(planDeliveries([event("evt_1", 200)]), [
    delivery("evt_1", "deliver"),
  ]);
});

test("retries rate limits and temporary server failures", () => {
  assert.deepEqual(
    planDeliveries([event("evt_1", 429), event("evt_2", 503)]),
    [delivery("evt_1", "retry"), delivery("evt_2", "retry")],
  );
});

test("sends permanent client failures to the dead-letter queue", () => {
  assert.deepEqual(planDeliveries([event("evt_1", 400)]), [
    delivery("evt_1", "dead-letter"),
  ]);
});

test("processes each event id only once and preserves first-seen order", () => {
  assert.deepEqual(
    planDeliveries([
      event("evt_1", 200),
      event("evt_2", 503),
      event("evt_1", 200),
    ]),
    [delivery("evt_1", "deliver"), delivery("evt_2", "retry")],
  );
});

function event(id, status) {
  return {
    id,
    endpoint: `${id}@example.com`,
    status,
  };
}

function delivery(eventId, action) {
  return {
    eventId,
    endpoint: `${eventId}@example.com`,
    action,
  };
}
