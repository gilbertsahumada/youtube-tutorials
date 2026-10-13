import { createServer } from "node:http";
import { randomBytes, createHash } from "node:crypto";
import { saveJson } from "../common.mjs";

/**
 * Autoriza Gmail con PKCE y un callback local. Los eventos describen el estado, nunca el token.
 * @returns {Promise<{url:string, done:Promise<void>, cancel:Function}>}
 */
export async function createGmailAuthorization({
  env,
  tokenPath,
  onEvent,
  request = fetch,
  timeoutMs = 300000,
}) {
  for (const key of ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"])
    if (!env[key]) throw Error(`Falta ${key}`);
  const state = randomBytes(24).toString("hex");
  const verifier = randomBytes(48).toString("base64url");
  const server = createServer();
  const controller = new AbortController();
  let settled = false,
    authorizing = false,
    timer,
    resolveDone,
    rejectDone;
  const done = new Promise((resolve, reject) => {
    resolveDone = resolve;
    rejectDone = reject;
  });
  // El consumidor puede suscribirse después del primer evento sin provocar un rechazo huérfano.
  done.catch(() => {});
  const finish = (problem, force = false) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    controller.abort();
    onEvent(problem ? { type: "error", message: problem.message } : { type: "connected" });
    server.close(() => (problem ? rejectDone(problem) : resolveDone()));
    if (force) server.closeAllConnections();
  };
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const redirect = `http://127.0.0.1:${server.address().port}/callback`;
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirect,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/gmail.readonly",
    access_type: "offline",
    prompt: "consent",
    state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
  }).toString();
  server.on("request", async (req, res) => {
    const callback = new URL(req.url, redirect);
    if (callback.pathname !== "/callback") {
      res.writeHead(404).end();
      return;
    }
    if (callback.searchParams.get("state") !== state) {
      res.writeHead(400).end("Estado OAuth incorrecto");
      return;
    }
    // Una recarga no debe canjear el mismo código ni cancelar el primer callback válido.
    if (authorizing || settled) {
      res.writeHead(409).end("La autorización ya está en curso o se completó.");
      return;
    }
    authorizing = true;
    try {
      const code = callback.searchParams.get("code");
      if (!code) throw Error("Autorización cancelada o sin código");
      let response;
      try {
        response = await request("https://oauth2.googleapis.com/token", {
          method: "POST",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]),
          body: new URLSearchParams({
            client_id: env.GOOGLE_CLIENT_ID,
            client_secret: env.GOOGLE_CLIENT_SECRET,
            code,
            code_verifier: verifier,
            redirect_uri: redirect,
            grant_type: "authorization_code",
          }),
        });
      } catch (problem) {
        // El error de transporte puede incluir detalles de la petición; el evento solo informa estado.
        throw Error("No se pudo consultar el servidor de autorización.", { cause: problem });
      }
      if (!response.ok) throw Error(`OAuth respondió HTTP ${response.status}`);
      let token;
      try {
        token = await response.json();
      } catch (problem) {
        throw Error("El servidor de autorización devolvió una respuesta inválida.", {
          cause: problem,
        });
      }
      if (!token.refresh_token)
        throw Error("No se recibió refresh_token; revoca el permiso y autoriza nuevamente");
      if (settled) return;
      await saveJson(tokenPath, { refresh_token: token.refresh_token });
      res.end("Gmail conectado. Puedes cerrar esta ventana.");
      finish();
    } catch (problem) {
      if (!res.destroyed && !res.writableEnded)
        res.writeHead(400).end("No se pudo completar OAuth. Revisa la terminal.");
      finish(problem);
    }
  });
  timer = setTimeout(
    () => finish(Error("OAuth expiró. Reintenta npm run gmail:login."), true),
    timeoutMs,
  );
  onEvent({ type: "authorization_url", url: url.href });
  return {
    url: url.href,
    done,
    cancel: () => finish(Error("Autorización cancelada o sin código"), true),
  };
}
