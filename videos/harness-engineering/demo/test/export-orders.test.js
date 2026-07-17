import assert from "node:assert/strict";
import test from "node:test";
import { ordersToCsv } from "../src/csv.js";
import { orders } from "../src/orders.js";
import { handleRequest } from "../src/server.js";

const expectedCsv = [
  "id,customer,total,status,created_at",
  "ORD-001,Acme Norte,1299.50,paid,2026-07-14",
  'ORD-002,"Cafe ""Central"", SpA",89.00,pending,2026-07-15',
  "ORD-003,Distribuidora Sur,450.75,refunded,2026-07-16",
].join("\n");

test("exports the required columns and values", () => {
  assert.equal(ordersToCsv(orders), expectedCsv);
});

test("keeps only the header when there are no orders", () => {
  assert.equal(ordersToCsv([]), "id,customer,total,status,created_at");
});

test("escapes commas, quotes, carriage returns, and line breaks", () => {
  const csv = ordersToCsv([
    {
      id: "ORD-004",
      customer: "North, \"South\"\r\nWest",
      total: 10,
      status: "paid",
      createdAt: "2026-07-17T01:02:03.000Z",
    },
  ]);

  assert.equal(
    csv,
    'id,customer,total,status,created_at\nORD-004,"North, ""South""\r\nWest",10.00,paid,2026-07-17',
  );
});

test("returns the CSV as a browser download", () => {
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

  handleRequest({ url: "/api/orders.csv" }, response);

  assert.equal(status, 200);
  assert.equal(headers["Content-Type"], "text/csv; charset=utf-8");
  assert.equal(headers["Content-Disposition"], 'attachment; filename="orders.csv"');
  assert.equal(body, expectedCsv);
});
