# Webhook delivery policy

## Goal

Turn webhook responses into a delivery plan that is safe to execute.

## Decisions

- Process each event ID only once. Keep the first occurrence and preserve first-seen order.
- Deliver responses from `200` through `299`.
- Retry status `429` and responses from `500` through `599`.
- Send every other response from `400` through `499` to the dead-letter queue.
- Keep the event ID and endpoint unchanged in the delivery plan.

## Outside the task

- Do not add dependencies.
- Do not modify the sample events.
- Do not modify or remove tests.
- Do not publish or merge changes automatically.

## Verification

Run from this directory:

```bash
npm run verify
```
