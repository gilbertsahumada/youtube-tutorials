export function planDeliveries(events) {
  const seen = new Set();
  const plan = [];

  for (const event of events) {
    if (seen.has(event.id)) {
      continue;
    }
    seen.add(event.id);

    plan.push({
      eventId: event.id,
      endpoint: event.endpoint,
      action: actionFor(event.status),
    });
  }

  return plan;
}

function actionFor(status) {
  if (status >= 200 && status <= 299) {
    return "deliver";
  }
  if (status === 429 || (status >= 500 && status <= 599)) {
    return "retry";
  }
  if (status >= 400 && status <= 499) {
    return "dead-letter";
  }
  return "dead-letter";
}
