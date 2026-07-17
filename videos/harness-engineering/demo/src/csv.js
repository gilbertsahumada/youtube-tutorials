const columns = ["id", "customer", "total", "status", "created_at"];

function escapeCsvValue(value) {
  const text = String(value);

  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function ordersToCsv(orders) {
  const rows = orders.map((order) =>
    [
      order.id,
      order.customer,
      Number(order.total).toFixed(2),
      order.status,
      new Date(order.createdAt).toISOString().slice(0, 10),
    ]
      .map(escapeCsvValue)
      .join(","),
  );

  return [columns.join(","), ...rows].join("\n");
}
