# Export orders as CSV

## Goal

The **Exportar CSV** button must download all orders in a spreadsheet-compatible CSV file.

## Expected file

- Filename: `orders.csv`.
- Content type: `text/csv; charset=utf-8`.
- Columns, in this order: `id`, `customer`, `total`, `status`, `created_at`.
- Preserve the order in which orders are received.
- Format `total` with exactly two decimal places.
- Format `created_at` as `YYYY-MM-DD` in UTC.
- Escape values containing commas, double quotes, carriage returns, or line breaks by wrapping the value in double quotes and doubling each internal double quote.
- Do not add a blank line at the end of the file.

## Example

The customer name:

```text
Cafe "Central", SpA
```

must appear as:

```csv
"Cafe ""Central"", SpA"
```

## Outside the task

- Do not add dependencies.
- Do not redesign the orders page.
- Do not change the sample order data.
- Do not modify or remove the tests.

## Verification

Run from this directory:

```bash
npm run verify
```
