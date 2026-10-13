import { StringDecoder } from "node:string_decoder";

/** Valida el protocolo del proceso OAuth sin interpretar mensajes destinados a personas. */
export function parseOAuthEvent(line) {
  const event = JSON.parse(line);
  if (event?.type === "connected") return { type: "connected" };
  if (event?.type === "authorization_url" && typeof event.url === "string") {
    const url = new URL(event.url);
    if (
      url.protocol === "https:" &&
      url.hostname === "accounts.google.com" &&
      !url.username &&
      !url.password
    )
      return { type: event.type, url: event.url };
  }
  if (event?.type === "error" && typeof event.message === "string")
    return { type: event.type, message: event.message.slice(0, 1500) };
  throw Error("Evento de autorización inválido.");
}

/** Un evento puede llegar en varios bloques; también conservamos caracteres UTF-8 fragmentados. */
export function createOAuthDecoder(onEvent) {
  const decoder = new StringDecoder("utf8");
  let buffer = "";
  const consume = () => {
    let end;
    while ((end = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, end).trim();
      buffer = buffer.slice(end + 1);
      if (line.length > 16384) throw Error("Respuesta de autorización demasiado grande.");
      if (line) onEvent(parseOAuthEvent(line));
    }
    if (buffer.length > 16384) throw Error("Respuesta de autorización demasiado grande.");
  };
  return {
    write(chunk) {
      buffer += decoder.write(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      consume();
    },
    end() {
      buffer += decoder.end();
      consume();
      if (buffer.trim()) onEvent(parseOAuthEvent(buffer.trim()));
      buffer = "";
    },
  };
}
