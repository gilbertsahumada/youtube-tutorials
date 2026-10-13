import { routeFor } from "../router.js";
import { translate } from "../i18n.js";
/** Construye esta pantalla con datos explícitos; los eventos pertenecen al controlador. */
export function createMailViews(context) {
  const {
    state,
    escape,
    t,
    date,
    button,
    link,
    current,
    globallyBusy,
    scopedFilters,
    heading,
    empty,
  } = context;
  function mailsPage() {
    const project = current(),
      all = state.data.mails,
      filters = scopedFilters(project.id),
      query = state.search.trim().toLowerCase();
    const mails = [...all]
      .reverse()
      .filter((mail) => (mail.subject + " " + mail.from).toLowerCase().includes(query));
    const chosen = all.find((mail) => mail.id === state.route.emailId) || mails[0];
    const actions = /* HTML */ `<div class="heading-actions">
      ${button(
        "sync",
        "Sincronizar correo",
        "secondary",
        globallyBusy() || !filters.length || !state.config.connections.gmail,
      )}${button(
        "analyze",
        "Analizar correos",
        "primary",
        globallyBusy() || !all.length || !state.config.connections.model,
      )}
    </div>`;
    const metadata = /* HTML */ `<div class="mail-summary">
      <span><strong>${all.length}</strong> ${t("Mensajes disponibles")}</span
      ><span
        ><strong>${all.filter((mail) => !mail.analyzed).length}</strong> ${t("Por analizar")}</span
      ><span>${t("Última sincronización")}: ${date(state.data.runtime.lastSync)} UTC</span>
    </div>`;
    if (!all.length)
      return (
        heading(
          "Correos del proyecto",
          "Sincroniza los mensajes y deja que el agente los contraste con GitHub.",
          actions,
        ) +
        metadata +
        empty(
          state.data.runtime.lastSync
            ? "No hay correos que coincidan."
            : "Sin correos sincronizados.",
          !filters.length
            ? "Añade el primero para sincronizar correos."
            : state.data.runtime.lastSync
              ? "Revisa los participantes, la fecha y la etiqueta opcional."
              : "Sincroniza los correos de los participantes de este proyecto.",
          !filters.length
            ? link("settings", "Configurar proyecto", project.id, "button secondary")
            : "",
        )
      );
    return /* HTML */ `${heading(
        "Correos del proyecto",
        "Sincroniza los mensajes y deja que el agente los contraste con GitHub.",
        actions,
      )}${metadata}
      <section class="mail-workspace">
        <div class="mail-index">
          <label class="sr-only" for="mail-search">${t("Buscar por asunto o remitente")}</label
          ><input
            id="mail-search"
            type="search"
            placeholder="${t("Buscar por asunto o remitente")}"
            value="${escape(state.search)}"
          />
          <div class="mail-list">
            ${mails
              .map(
                (mail) =>
                  /* HTML */ `<a
                    class="mail-item${chosen?.id === mail.id ? " selected" : ""}"
                    href="${routeFor("mail", project.id, mail.id)}"
                    ><div class="mail-item-top">
                      <span>${escape(mail.from)}</span
                      >${!mail.analyzed ? /* HTML */ `<span class="new-dot" aria-label="${t("Nuevo")}"></span>` : ""}
                    </div>
                    <h3>${escape(mail.subject || translate("Sin asunto", state.language))}</h3>
                    <time>${date(mail.date)} UTC</time>
                    <p>${escape(mail.text.slice(0, 110))}</p></a
                  >`,
              )
              .join(
                "",
              )}${!mails.length ? /* HTML */ `<p class="no-search">${t("No coincide con tu búsqueda.")}</p>` : ""}
          </div>
        </div>
        <article class="mail-reader">
          ${
            chosen
              ? /* HTML */ `<div class="mail-reader-heading">
                    <span class="pill ${chosen.analyzed ? "neutral" : "new"}"
                      >${t(chosen.analyzed ? "Analizado" : "Nuevo")}</span
                    >
                    <h2>${escape(chosen.subject || translate("Sin asunto", state.language))}</h2>
                    <p>${escape(chosen.from)} · ${date(chosen.date)} UTC</p>
                  </div>
                  <pre class="source-text" data-email-source="${escape(chosen.id)}">
${escape(chosen.text)}</pre>
                  <div class="source-note">${t("Texto original de Gmail")}</div>`
              : empty("Selecciona un correo para leerlo.", "")
          }
        </article>
      </section>`;
  }
  return { mailsPage };
}
