import { routeFor } from "../router.js";
/** El contenido del diálogo es puro; abrirlo y restaurar foco corresponde al renderer. */
export function createDialogView(context) {
  const { state, escape, issueText, t, date, icon, button, globallyBusy } = context;
  function renderDialogContent() {
    const modal = state.modal;
    let content;
    if (modal.kind === "review") {
      const item = modal.proposal;
      const writable = item.status === "pending" && !globallyBusy();
      content = /* HTML */ `<div class="dialog-heading">
          <div>
            <span class="proposal-label"
              >${t(item.action === "create_issue" ? "Crear issue" : "Actualizar issue")}${item.issueNumber ? " #" + item.issueNumber : ""}</span
            >
            <h2 id="dialog-title">${escape(item.title)}</h2>
            <p>${escape(item.repository)}</p>
          </div>
          <button class="icon-button" data-action="close-dialog" aria-label="${t("Cerrar")}">
            ${icon("close")}
          </button>
        </div>
        <div class="dialog-content">
          <section>
            <h3>${t("Por qué se propone")}</h3>
            <p>${escape(item.reason)}</p>
          </section>
          <section>
            <h3>${t("Evidencia de los correos")}</h3>
            <div class="evidence-list">
              ${item.evidence
                .map((entry, index) => {
                  const source = item.sources.find((source) => source.id === entry.emailId);
                  return /* HTML */ `<blockquote>
                    <p data-evidence-index="${index}">${escape(entry.quote)}</p>
                    <footer>
                      <a href="${routeFor("mail", item.projectId, source.id)}"
                        >${escape(source.subject || source.from)}</a
                      >
                      · ${date(source.date)} UTC
                    </footer>
                  </blockquote>`;
                })
                .join("")}
            </div>
          </section>
          <div class="issue-comparison">
            ${
              item.issueSnapshot
                ? /* HTML */ `<section>
                    <h3>${t("Descripción actual")}</h3>
                    <pre>${issueText(item.issueSnapshot.body)}</pre>
                  </section>`
                : ""
            }
            <section>
              <h3>${t("Descripción que se publicará")}</h3>
              <pre>${issueText(item.previewBody)}</pre>
            </section>
          </div>
          ${item.error ? /* HTML */ `<div class="alert"><p>${t(item.error)}</p></div>` : ""}
        </div>
        <div class="dialog-footer">
          <p>${t("El proyecto decide el repositorio; la propuesta solo puede actuar allí.")}</p>
          ${
            item.status === "pending"
              ? button("reject", "Rechazar", "secondary", !writable) +
                button(
                  "approve",
                  item.action === "create_issue"
                    ? "Aprobar y crear issue"
                    : "Aprobar y actualizar issue",
                  "primary",
                  !writable,
                )
              : button("close-dialog", "Cerrar")
          }
        </div>`;
    } else {
      const resetting = modal.kind === "reset";
      const word =
        state.language === "en"
          ? resetting
            ? "RESET"
            : "DELETE"
          : resetting
            ? "REINICIAR"
            : "ELIMINAR";
      content = /* HTML */ `<div class="dialog-heading">
          <h2 id="dialog-title">${t(resetting ? "Reiniciar la demo" : "Eliminar proyecto")}</h2>
          <button class="icon-button" data-action="close-dialog" aria-label="${t("Cerrar")}">
            ${icon("close")}
          </button>
        </div>
        <form id="confirmation-form">
          <div class="dialog-content">
            <p>
              ${t(
                resetting
                  ? "Borra proyectos, participantes, correos sincronizados, propuestas y actividad de esta demo."
                  : "Se eliminará el proyecto y sus datos locales. Gmail y GitHub conservarán sus datos.",
              )}
            </p>
            ${
              resetting
                ? /* HTML */ `<p>
                    ${t(
                      "Tu autorización de Gmail y las credenciales se conservan. Los correos e issues originales no se eliminan.",
                    )}
                  </p>`
                : /* HTML */ `<p><strong>${escape(modal.project.name)}</strong></p>`
            }<label for="confirmation"
              >${t(resetting ? "Escribe REINICIAR para confirmar" : "Escribe ELIMINAR para confirmar")}<input
                id="confirmation"
                autocomplete="off"
                value="${escape(state.confirmation)}"
            /></label>
          </div>
          <div class="dialog-footer">
            ${button("close-dialog", "Cancelar")}<button
              type="submit"
              class="button danger"
              id="confirm-action"
              ${state.confirmation !== word || globallyBusy() ? " disabled" : ""}
            >
              ${t(resetting ? "Reiniciar datos locales" : "Eliminar proyecto")}
            </button>
          </div>
        </form>`;
    }

    return {
      html: content,
      className: "workflow-dialog" + (modal.kind === "review" ? " review-dialog" : ""),
    };
  }
  return renderDialogContent;
}
