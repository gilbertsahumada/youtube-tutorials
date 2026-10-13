import test from "node:test";
import assert from "node:assert/strict";
import { parseRoute, routeFor } from "../web/router.js";
test("rutas conservan proyecto y correo al navegar, recargar y volver", () => {
  for (const view of ["mail", "proposals", "activity", "settings"])
    assert.deepEqual(parseRoute(routeFor(view, "portal", "abc+1")), {
      view,
      projectId: "portal",
      emailId: "abc+1",
    });
  assert.deepEqual(parseRoute("#/projects/new"), { view: "new" });
  assert.deepEqual(parseRoute("#/connections"), { view: "connections" });
  for (const hash of ["", "#/unknown", "#/projects/../settings", "#/projects/portal/old-route"])
    assert.deepEqual(parseRoute(hash), { view: "projects" });
  assert.equal(routeFor("mail"), "#/projects");
});
