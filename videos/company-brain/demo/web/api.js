import { readResponse } from "./http.js";
/** El token local se obtiene del estado actual para no conservar una sesión antigua. */
export function createApiClient(getToken, fetchResponse = fetch) {
  return async function request(path, body) {
    try {
      return await readResponse(
        await fetchResponse(
          path,
          body === undefined
            ? { headers: { "X-Company-Brain-Token": getToken() } }
            : {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "X-Company-Brain-Token": getToken(),
                },
                body: JSON.stringify(body),
              },
        ),
      );
    } catch (problem) {
      if (problem instanceof TypeError)
        throw Error(
          "No se pudo conectar con la demo. Revisa que el servidor esté encendido y recarga la página.",
          { cause: problem },
        );
      throw problem;
    }
  };
}
