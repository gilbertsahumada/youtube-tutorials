import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { ordersToCsv } from "./csv.js";
import { orders } from "./orders.js";

function page() {
  const rows = orders
    .map(
      (order) => `
        <tr>
          <td>${order.id}</td>
          <td>${order.customer}</td>
          <td>$${order.total.toFixed(2)}</td>
          <td><span class="status status-${order.status}">${order.status}</span></td>
          <td>${order.createdAt.slice(0, 10)}</td>
        </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Pedidos</title>
    <style>
      :root { font-family: Inter, ui-sans-serif, system-ui, sans-serif; color: #171717; background: #f5f5f4; }
      * { box-sizing: border-box; }
      body { margin: 0; }
      main { width: min(1100px, calc(100% - 40px)); margin: 56px auto; }
      header { display: flex; align-items: end; justify-content: space-between; gap: 24px; margin-bottom: 24px; }
      h1 { margin: 0 0 6px; font-size: 30px; letter-spacing: 0; }
      p { margin: 0; color: #666; }
      .button { display: inline-block; padding: 10px 14px; color: white; background: #18181b; border-radius: 6px; text-decoration: none; font-weight: 650; }
      .table-wrap { overflow-x: auto; border: 1px solid #dededb; border-radius: 8px; background: white; }
      table { width: 100%; border-collapse: collapse; min-width: 760px; }
      th, td { padding: 15px 18px; border-bottom: 1px solid #ececea; text-align: left; }
      th { color: #686864; background: #fafaf9; font-size: 12px; text-transform: uppercase; }
      tr:last-child td { border-bottom: 0; }
      .status { display: inline-block; padding: 4px 8px; border-radius: 999px; font-size: 12px; font-weight: 700; }
      .status-paid { color: #166534; background: #dcfce7; }
      .status-pending { color: #854d0e; background: #fef9c3; }
      .status-refunded { color: #991b1b; background: #fee2e2; }
    </style>
  </head>
  <body>
    <main>
      <header>
        <div><h1>Pedidos</h1><p>${orders.length} pedidos registrados</p></div>
        <a class="button" href="/api/orders.csv">Exportar CSV</a>
      </header>
      <div class="table-wrap">
        <table>
          <thead><tr><th>ID</th><th>Cliente</th><th>Total</th><th>Estado</th><th>Fecha</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </main>
  </body>
</html>`;
}

export function handleRequest(request, response) {
  if (request.url === "/api/orders.csv") {
    response.writeHead(200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="orders.csv"',
    });
    response.end(ordersToCsv(orders));
    return;
  }

  if (request.url === "/") {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(page());
    return;
  }

  response.writeHead(404).end("Not found");
}

export function createApp() {
  return createServer(handleRequest);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 3000);
  createApp().listen(port, () => {
    console.log(`Pedidos disponible en http://localhost:${port}`);
  });
}
