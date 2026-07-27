import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const demoRoot = path.resolve(process.argv[2] ?? "demo");

// Un agente puede renombrar o mover estos archivos. Si eso ocurre, el evaluador debe
// explicar por que no pudo evaluar y aun asi imprimir un resultado, en vez de morir
// con un error de import y dejar la comparacion sin numero.
async function cargar(relativePath, exportEsperado) {
  try {
    const modulo = await import(pathToFileURL(path.join(demoRoot, relativePath)));
    if (modulo[exportEsperado] === undefined) {
      return { modulo, problema: `${relativePath} no exporta "${exportEsperado}"` };
    }
    return { modulo };
  } catch (error) {
    const detalle = error.message.split("\n")[0];
    return { modulo: {}, problema: `no se pudo cargar ${relativePath}: ${detalle}` };
  }
}

const [csv, server, orders] = await Promise.all([
  cargar("src/csv.js", "ordersToCsv"),
  cargar("src/server.js", "handleRequest"),
  cargar("src/orders.js", "orders"),
]);

const problemas = [csv, server, orders].map((r) => r.problema).filter(Boolean);

if (problemas.length > 0) {
  console.log("AVISO: la implementacion no expone lo que este evaluador necesita.\n");
  for (const problema of problemas) {
    console.log(`  - ${problema}`);
  }
  console.log("\nPuntos de entrada esperados:");
  console.log("  src/csv.js     -> ordersToCsv");
  console.log("  src/server.js  -> handleRequest");
  console.log("  src/orders.js  -> orders");
  console.log("\nLos checks de abajo fallaran por eso, no necesariamente por el formato del CSV.\n");
}

const csvModule = csv.modulo;
const serverModule = server.modulo;
const ordersModule = orders.modulo;

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
