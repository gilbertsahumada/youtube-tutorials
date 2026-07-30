export function planDeliveries(events) {
  return events.map((event) => ({
    eventId: event.id,
    endpoint: event.endpoint,
    action: event.status >= 500 ? "drop" : "deliver",
  }));
}
