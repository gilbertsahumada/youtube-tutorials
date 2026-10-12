import { createServer } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT, loadEnv } from "./common.mjs";
import { createStudio } from "./studio.mjs";

const assets = { "/": ["index.html", "text/html"], "/app.js": ["app.js", "text/javascript"], "/i18n.js": ["i18n.js", "text/javascript"], "/style.css": ["style.css", "text/css"], "/favicon.svg": ["favicon.svg", "image/svg+xml"] };

export function createDemoServer({ studio = createStudio(), publicRoot = resolve(ROOT, "web") } = {}) {
  const token = randomBytes(32).toString("hex");
  const server = createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    const send = (status, value) => { res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" }); res.end(JSON.stringify(value)); };
    try {
      const host = req.headers.host;
      const port = server.address().port;
      if (![ `127.0.0.1:${port}`, `localhost:${port}` ].includes(host)) return send(403, { error: "Acceso local únicamente." });
      const origin = `http://${host}`;
      if ((req.headers.origin && req.headers.origin !== origin) || req.headers["sec-fetch-site"] === "cross-site") return send(403, { error: "Origen no permitido." });
      const url = new URL(req.url, origin);
      if (!url.pathname.startsWith("/api/")) {
        const asset = assets[url.pathname];
        if (!asset || req.method !== "GET") return send(404, { error: "Página no encontrada." });
        const content = await readFile(resolve(publicRoot, asset[0]));
        res.writeHead(200, { "Content-Type": asset[1] + "; charset=utf-8" }); res.end(content); return;
      }
      if (req.method === "GET" && url.pathname === "/api/bootstrap") {
        const projectId = url.searchParams.get("projectId");
        const config = await studio.config(projectId);
        if (!config.ready) return send(503, { token, workspace: null, config, error: config.error });
        try { return send(200, { token, ...await studio.snapshot(projectId), config }); }
        catch (error) { return send(400, { token, workspace: null, config, error: studio.errorMessage(error) }); }
      }
      const supplied = Buffer.from(String(req.headers["x-company-brain-token"] || ""));
      const expected = Buffer.from(token);
      if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return send(403, { error: "Recarga la página para recuperar la sesión local." });
      if (req.method === "GET" && url.pathname === "/api/config") return send(200, await studio.config(url.searchParams.get("projectId")));
      if (url.pathname === "/api/config") return send(405, { error: "La configuración se carga desde el entorno. Edita .env y reinicia el servidor." });
      if (req.method !== "POST" || req.headers["content-type"]?.split(";")[0] !== "application/json") return send(405, { error: "Solicitud no admitida." });
      let raw = "";
      req.setEncoding("utf8");
      for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 20000) return send(413, { error: "Solicitud demasiado grande." }); }
      let body;
      try { body = JSON.parse(raw || "{}"); } catch { return send(400, { error: "Solicitud inválida." }); }
      if (!body || typeof body !== "object" || Array.isArray(body)) return send(400, { error: "Solicitud inválida." });
      const routes = {
        "/api/inbox": () => studio.inbox(body.projectId),
        "/api/baseline": () => studio.capture(body.id, body.projectId),
        "/api/run": () => studio.run(body.mode, body.projectId),
        "/api/publish": () => studio.publish(body.key, body.projectId),
        "/api/projects": () => studio.saveProject(body),
        "/api/projects/select": () => studio.selectProject(body.projectId),
        "/api/filters": () => studio.saveFilter(body),
        "/api/filters/remove": () => studio.removeFilter(body.id, body.projectId),
        "/api/inbox/assign": () => studio.assign(body.id, body.projectId),
        "/api/gmail/login": () => studio.login(),
        "/api/github/check": () => studio.github(),
      };
      if (!routes[url.pathname]) return send(404, { error: "Acción no encontrada." });
      send(200, await routes[url.pathname]());
    } catch (error) {
      // Integration errors name the failing operation; credentials never enter responses.
      send(error.status || 400, { error: studio.errorMessage(error) });
    }
  });
  server.on("close", () => studio.close());
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  loadEnv();
  const server = createDemoServer();
  const port = Number(process.env.PORT || 4173);
  server.on("error", error => {
    console.error(error.code === "EADDRINUSE" ? `El puerto ${port} está ocupado. Usa PORT=4174 npm start.` : error.message);
    process.exitCode = 1;
  });
  server.listen(port, "127.0.0.1", () => console.log(`Company Brain · http://127.0.0.1:${server.address().port}\nConfiguración desde el entorno. Solo datos reales.`));
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => { server.closeAllConnections(); server.close(); });
}
