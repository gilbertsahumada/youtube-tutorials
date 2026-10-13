import { loadEnv, privatePath } from "./common.mjs";
import { createGmailAuthorization } from "./oauth/authorization.mjs";

const structured = process.argv.includes("--json");
let reportedError = false;
function emit(event) {
  if (event.type === "error") reportedError = true;
  // La UI recibe un protocolo; la terminal conserva instrucciones para la persona.
  if (structured) console.log(JSON.stringify(event));
  else if (event.type === "authorization_url")
    console.log(
      "Abre esta URL en tu navegador y autoriza SOLO la cuenta de prueba:\n\n" + event.url,
    );
  else if (event.type === "connected")
    console.log(
      "Refresh token guardado localmente en .private/gmail-token.json (no se imprime ni se sube a Git).",
    );
  else console.error(event.message);
}
try {
  loadEnv();
  const session = await createGmailAuthorization({
    env: process.env,
    tokenPath: privatePath("gmail-token.json"),
    onEvent: emit,
  });
  const cancel = () => session.cancel();
  process.once("SIGINT", cancel);
  process.once("SIGTERM", cancel);
  try {
    await session.done;
  } finally {
    process.off("SIGINT", cancel);
    process.off("SIGTERM", cancel);
  }
} catch (problem) {
  if (!reportedError) emit({ type: "error", message: problem.message });
  process.exitCode = 1;
}
