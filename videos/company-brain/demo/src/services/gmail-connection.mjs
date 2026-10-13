import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { createOAuthDecoder } from "../oauth/events.mjs";

/** Gestiona el proceso y su estado; el token solo lo guarda el script de autorización. */
export function createGmailConnection({ root, env, formatError, spawnProcess = spawn }) {
  let child,
    closed = false,
    state = { status: "idle" };
  const fail = (message) => {
    state = { status: "error", message: formatError(Error(message)) };
  };
  return {
    snapshot: () => ({ ...state }),
    start(busy = false) {
      if (child || busy)
        throw Object.assign(Error("Hay una operación en curso. Espera a que termine."), {
          status: 423,
        });
      if (closed) throw Object.assign(Error("El servidor se está deteniendo."), { status: 503 });
      state = { status: "starting" };
      const connectionProcess = spawnProcess(
        process.execPath,
        [resolve(root, "src/gmail-login.mjs"), "--json"],
        {
          env: { ...process.env, ...env },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      child = connectionProcess;
      let errors = "";
      const decoder = createOAuthDecoder((event) => {
        if (closed || child !== connectionProcess || state.status === "error") return;
        if (event.type === "authorization_url") state = { status: "waiting", url: event.url };
        else if (event.type === "connected") state = { status: "connected" };
        else fail(event.message);
      });
      connectionProcess.stdout.on("data", (data) => {
        if (closed || child !== connectionProcess) return;
        try {
          decoder.write(data);
        } catch {
          fail("La conexión devolvió una respuesta inválida.");
          connectionProcess.kill();
        }
      });
      connectionProcess.stderr.on("data", (data) => {
        errors = (errors + data.toString()).slice(0, 1500);
      });
      connectionProcess.on("error", () => {
        if (child !== connectionProcess) return;
        if (!closed) fail("No se pudo iniciar la conexión. Revisa las credenciales de Google.");
        if (child === connectionProcess) child = undefined;
      });
      // close espera el vaciado de stdout; exit puede preceder al último evento conectado.
      connectionProcess.on("close", () => {
        // Un proceso anterior no debe reemplazar el estado de un nuevo intento.
        if (child !== connectionProcess) return;
        if (!closed) {
          try {
            decoder.end();
          } catch {
            fail("La conexión devolvió una respuesta inválida.");
          }
          if (!["connected", "error"].includes(state.status))
            fail(errors.trim().slice(0, 1000) || "La conexión no se completó. Inténtalo de nuevo.");
        }
        if (child === connectionProcess) child = undefined;
      });
      return { ...state };
    },
    close() {
      closed = true;
      child?.kill();
      child = undefined;
    },
  };
}
