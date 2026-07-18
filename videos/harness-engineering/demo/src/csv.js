const columns = ["id", "customer", "total", "status", "created_at"];

export function ordersToCsv(orders) {
  const rows = orders.map((order) =>
    [order.id, order.customer, order.total, order.status, order.createdAt].join(","),
  );

  return [columns.join(","), ...rows].join("\n");
}
