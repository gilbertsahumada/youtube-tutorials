/** Construye esta pantalla con datos explícitos; los eventos pertenecen al controlador. */
export function createConnectionsViews(context) {
  const { state, escape, t, gmailLogo, githubLogo, button, globallyBusy, heading } = context;
  function connectionsPage() {
    const config = state.config || {},
      oauth = config.oauth || {},
      connection = config.connections || {};
    const pill = (ready, yes, no) =>
      /* HTML */ `<span class="pill ${ready ? "success" : "neutral"}"
        >${t(ready ? yes : no)}</span
      >`;
    return /* HTML */ `${heading("Conexiones y datos", "Conecta las fuentes y controla los datos locales.")}
      <section class="credentials-note">
        <h2>${t("Credenciales desde .env")}</h2>
        <p>
          ${t("Las credenciales se configuran en el servidor. Reinicia la demo después de cambiarlas.")}
        </p>
        <div class="env-names">
          <code>GOOGLE_CLIENT_ID</code><code>GOOGLE_CLIENT_SECRET</code><code>MODEL_BASE_URL</code
          ><code>MODEL_ID</code><code>MODEL_API_KEY</code>
        </div>
      </section>
      <div class="connection-grid">
        <section class="panel">
          <div class="section-heading">
            <h2 class="connection-title">${gmailLogo}Gmail</h2>
            ${pill(config.gmailConnected, "Autorización guardada", "Sin autorización")}
          </div>
          <p>
            ${t("Gmail aporta los mensajes; cada proyecto decide qué participantes y fechas incluir.")}
          </p>
          ${button(
            "gmail-login",
            config.gmailConnected ? "Volver a autorizar Gmail" : "Conectar Gmail",
            "secondary",
            globallyBusy() || !connection.gmail || oauth.status === "starting",
          )}${
            oauth.url
              ? /* HTML */ `<a
                  class="button primary"
                  href="${escape(oauth.url)}"
                  target="_blank"
                  rel="noopener noreferrer"
                  >${t("Abrir autorización de Google")}</a
                >`
              : ""
          }${oauth.message ? /* HTML */ `<p class="error-text">${t(oauth.message)}</p>` : ""}
        </section>
        <section class="panel">
          <div class="section-heading">
            <h2 class="connection-title">${githubLogo}GitHub</h2>
            ${pill(Boolean(state.account), "Conectado", "Sin comprobar")}
          </div>
          <p>${t("GitHub utiliza tu sesión de gh. El repositorio se elige en cada proyecto.")}</p>
          ${state.account ? /* HTML */ `<p class="account-name">${escape(state.account.login)}</p>` : ""}${button("github-check", "Comprobar GitHub", "secondary", globallyBusy())}
        </section>
        <section class="panel">
          <div class="section-heading">
            <h2>${t("Modelo de IA")}</h2>
            ${pill(connection.model, "Configurado", "Pendiente de configurar")}
          </div>
          <p>
            ${t("El modelo recibe los correos sincronizados y los issues para preparar propuestas.")}
          </p>
        </section>
      </div>
      <section class="panel reset-panel">
        <div>
          <h2>${t("Datos locales")}</h2>
          <p>
            ${t(
              "Borra proyectos, participantes, correos sincronizados, propuestas y actividad de esta demo.",
            )}
          </p>
          <p class="hint">
            ${t(
              "Tu autorización de Gmail y las credenciales se conservan. Los correos e issues originales no se eliminan.",
            )}
          </p>
        </div>
        ${button("reset", "Reiniciar datos locales", "danger", globallyBusy())}
      </section>`;
  }
  return { connectionsPage };
}
