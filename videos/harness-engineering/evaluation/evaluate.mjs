import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const demoRoot = path.resolve(process.argv[2] ?? "demo");
const csvModule = await import(pathToFileURL(path.join(demoRoot, "src/csv.js")));
const serverModule = await import(pathToFileURL(path.join(demoRoot, "src/server.js")));
const ordersModule = await import(pathToFileURL(path.join(demoRoot, "src/orders.js")));

const expected = [
  "id,customer,total,status,created_at",
  "ORD-001,Acme Norte,1299.50,paid,2026-07-14",
  'ORD-002,"Cafe ""Central"", SpA",89.00,pending,2026-07-15',
  "ORD-003,Distribuidora Sur,450.75,refunded,2026-07-16",
].join("\n");

const checks = [
  ["incluye las columnas en el orden acordado", () => {
    const [header] = csvModule.ordersToCsv(ordersModule.orders).split("\n");
    assert.equal(header, "id,customer,total,status,created_at");
  }],
  ["escapa comas y comillas del nombre del cliente", () => {
    assert.match(csvModule.ordersToCsv(ordersModule.orders), /"Cafe ""Central"", SpA"/);
  }],
  ["formatea totales con dos decimales", () => {
    const csv = csvModule.ordersToCsv(ordersModule.orders);
    assert.match(csv, /1299\.50/);
    assert.match(csv, /89\.00/);
  }],
  ["formatea fechas como YYYY-MM-DD", () => {
    const csv = csvModule.ordersToCsv(ordersModule.orders);
    assert.doesNotMatch(csv, /T14:35/);
    assert.match(csv, /2026-07-14/);
  }],
  ["produce exactamente el CSV esperado", () => {
    assert.equal(csvModule.ordersToCsv(ordersModule.orders), expected);
  }],
  ["entrega headers HTTP de descarga", () => {
    let status;
    let headers;
    let body;
    const response = {
      writeHead(nextStatus, nextHeaders) {
        status = nextStatus;
        headers = nextHeaders;
        return this;
      },
      end(nextBody) {
        body = nextBody;
      },
    };

    serverModule.handleRequest({ url: "/api/orders.csv" }, response);

    assert.equal(status, 200);
    assert.equal(headers["Content-Type"], "text/csv; charset=utf-8");
    assert.equal(headers["Content-Disposition"], 'attachment; filename="orders.csv"');
    assert.equal(body, expected);
  }],
];

let passed = 0;

for (const [name, check] of checks) {
  try {
    await check();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.log(`FAIL ${name}`);
    console.log(`     ${error.message.split("\n")[0]}`);
  }
}

console.log(`\nResultado: ${passed}/${checks.length} checks pasan`);
process.exitCode = passed === checks.length ? 0 : 1;
