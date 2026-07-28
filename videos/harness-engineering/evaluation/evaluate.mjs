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

// Cada check mide UNA decision y solo una. Arreglar cualquiera de ellas no debe
// mover el resultado de las otras: si dos checks suben juntos siempre, el
// marcador esta inflado y el "de N a 6" deja de significar algo.
//
// Por eso "produce exactamente el CSV esperado" ya no puntua: era la suma de los
// cuatro checks de formato. Se imprime abajo como resumen, sin sumar.
const checks = [
  ["columnas y su orden", () => {
    // Normalizamos el fin de linea a proposito: eso lo mide otro check.
    const [header] = csvModule.ordersToCsv(ordersModule.orders).replace(/\r\n/g, "\n").split("\n");
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
  ["separa filas con LF y no deja salto final", () => {
    const csv = csvModule.ordersToCsv(ordersModule.orders);
    assert.doesNotMatch(csv, /\r\n/, "usa CRLF; este producto espera LF");
    assert.doesNotMatch(csv, /\n$/, "deja un salto de linea al final");
  }],
  ["entrega headers HTTP de descarga", () => {
    // Solo el contrato HTTP. El contenido del cuerpo lo miden los checks de arriba.
    let status;
    let headers;
    const response = {
      writeHead(nextStatus, nextHeaders) {
        status = nextStatus;
        headers = nextHeaders;
        return this;
      },
      end() {},
    };

    serverModule.handleRequest({ url: "/api/orders.csv" }, response);

    assert.equal(status, 200);
    assert.equal(headers["Content-Type"], "text/csv; charset=utf-8");
    assert.equal(headers["Content-Disposition"], 'attachment; filename="orders.csv"');
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

// Resumen, no puntua: sirve para ver el archivo entero en pantalla.
try {
  const actual = csvModule.ordersToCsv(ordersModule.orders);
  const visible = (texto) => texto.replace(/\r/g, "\\r").replace(/\n/g, "\\n\n");
  if (actual === expected) {
    console.log("\nEl CSV coincide exactamente con el esperado.");
  } else {
    console.log("\nCSV producido (\\r y \\n visibles):\n");
    console.log(visible(actual));
    console.log("\nCSV esperado:\n");
    console.log(visible(expected));
  }
} catch {
  console.log("\nNo se pudo generar el CSV para el resumen.");
}

process.exitCode = passed === checks.length ? 0 : 1;
