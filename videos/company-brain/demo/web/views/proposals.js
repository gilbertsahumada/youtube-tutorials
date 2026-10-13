/** Construye esta pantalla con datos explícitos; los eventos pertenecen al controlador. */
export function createProposalsViews(context) {
  const { state, escape, t, date, icon, link, current, pending, heading, empty } = context;
  function proposalsPage() {
    const all = state.data.proposals,
      items = all.filter((item) =>
        state.proposalFilter === "pending" ? item.status === "pending" : item.status !== "pending",
      );
    const labels = {
      pending: "Pendiente",
      approved: "Aprobada",
      rejected: "Rechazada",
      stale: "Desactualizada",
    };
    return /* HTML */ `${heading("Propuestas", "Revisa lo que el agente propone hacer.")}
      <div class="view-tabs" role="group" aria-label="${t("Propuestas")}">
        <button
          data-action="proposal-tab"
          data-tab="pending"
          aria-pressed="${state.proposalFilter === "pending"}"
        >
          ${t("Pendientes")} <span>${pending().length}</span></button
        ><button
          data-action="proposal-tab"
          data-tab="history"
          aria-pressed="${state.proposalFilter === "history"}"
        >
          ${t("Historial")}
        </button>
      </div>
      ${
        items.length
          ? /* HTML */ `<section class="proposals-list">
              ${items
                .map(
                  (item) =>
                    /* HTML */ `<article class="proposal-card">
                      <div class="proposal-kind">
                        <span class="proposal-symbol">${icon("proposals")}</span
                        ><span
                          >${t(item.action === "create_issue" ? "Crear issue" : "Actualizar issue")}${item.issueNumber ? " #" + item.issueNumber : ""}</span
                        ><span class="pill status-${item.status}">${t(labels[item.status])}</span>
                      </div>
                      <h2>${escape(item.title)}</h2>
                      <p>${escape(item.reason)}</p>
                      <div class="proposal-sources">
                        ${item.sources.length} ${t("Correos")} · ${date(item.createdAt)} UTC
                      </div>
                      ${item.error ? /* HTML */ `<p class="error-text">${t(item.error)}</p>` : ""}
                      <div class="row-actions">
                        <button
                          class="button ${item.status === "pending" ? "primary" : "secondary"}"
                          data-action="review"
                          data-proposal="${escape(item.id)}"
                        >
                          ${t("Revisar propuesta")}</button
                        >${
                          item.result
                            ? /* HTML */ `<a
                                class="text-link"
                                target="_blank"
                                rel="noopener noreferrer"
                                href="https://github.com/${escape(item.repository)}/issues/${item.result.number}"
                                >${t("Abrir en GitHub")}${icon("external")}</a
                              >`
                            : ""
                        }
                      </div>
                    </article>`,
                )
                .join("")}
            </section>`
          : empty(
              state.proposalFilter === "pending"
                ? "No hay propuestas pendientes."
                : "Todavía no hay decisiones.",
              state.proposalFilter === "pending"
                ? "Analiza los correos para identificar nuevas tareas o cambios."
                : "Las propuestas aprobadas, rechazadas y desactualizadas aparecerán aquí.",
              state.proposalFilter === "pending"
                ? link("mail", "Correos", current().id, "button secondary")
                : "",
            )
      }${
        state.data.runtime.summary
          ? /* HTML */ `<section class="analysis-summary">
              <h2>${t("Último análisis")}</h2>
              <p>${escape(state.data.runtime.summary)}</p>
            </section>`
          : ""
      }`;
  }
  return { proposalsPage };
}
