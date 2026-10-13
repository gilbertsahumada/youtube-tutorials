import { translate } from "./i18n.js";
import { createViewContext } from "./components/ui.js";
import { createDialogView } from "./components/dialog.js";
import { captureFocus, restoreFocus } from "./components/focus.js";
import { createShellViews } from "./views/shell.js";
import { createProjectsViews } from "./views/projects.js";
import { createMailViews } from "./views/mail.js";
import { createProposalsViews } from "./views/proposals.js";
import { createActivityViews } from "./views/activity.js";
import { createConnectionsViews } from "./views/connections.js";

/** El parser HTML normaliza CRLF y el primer salto de un pre; textContent conserva la fuente literal. */
function restoreLiteralText(parent, selector, sourceText) {
  for (const node of parent.querySelectorAll(selector)) {
    const text = sourceText(node.dataset);
    if (typeof text === "string") node.textContent = text;
  }
}
/** Solo este módulo escribe las pantallas en el DOM y restaura su foco. */
export function createRenderer({ app, dialog, state }) {
  function renderDialog() {
    if (!state.modal) {
      if (dialog.open) dialog.close();
      return;
    }
    const focus = captureFocus();
    const content = createDialogView(createViewContext(state))();
    dialog.className = content.className;
    dialog.innerHTML = content.html;
    restoreLiteralText(
      dialog,
      "[data-evidence-index]",
      (data) => state.modal.proposal?.evidence[Number(data.evidenceIndex)]?.quote,
    );
    if (!dialog.open) dialog.showModal();
    restoreFocus(focus, { allowNumber: true });
  }
  function render() {
    const context = createViewContext(state);
    const views = Object.assign(
      {},
      createShellViews(context),
      createProjectsViews(context),
      createMailViews(context),
      createProposalsViews(context),
      createActivityViews(context),
      createConnectionsViews(context),
    );
    const {
      projectsPage,
      projectForm,
      settingsPage,
      mailsPage,
      proposalsPage,
      activityPage,
      connectionsPage,
      projectBar,
      renderShell,
    } = views;
    const { t, current, empty, link, heading } = context;
    const focus = captureFocus();
    let content;
    if (state.loading && !state.config)
      content = /* HTML */ `<div class="boot">
        <span class="loader"></span>
        <p>${t("Cargando…")}</p>
      </div>`;
    else if (!state.config)
      content = empty(
        "No se pudo conectar con la demo. Revisa que el servidor esté encendido y recarga la página.",
        "",
      );
    else if (state.route.projectId && (state.loading || current()?.id !== state.route.projectId))
      content = state.loading
        ? /* HTML */ `<div class="boot">
            <span class="loader"></span>
            <p>${t("Cargando…")}</p>
          </div>`
        : empty(
            "Proyecto no encontrado.",
            "Vuelve a proyectos para seleccionar uno disponible.",
            link("projects", "Volver a proyectos", null, "button secondary"),
          );
    else if (state.route.view === "projects") content = projectsPage();
    else if (state.route.view === "new")
      content = /* HTML */ `${heading(
          "Nuevo proyecto",
          "Crea un proyecto, elige su repositorio y añade sus participantes.",
        )}
        <section class="panel new-project-panel">${projectForm()}</section>`;
    else if (state.route.view === "connections") content = connectionsPage();
    else
      content =
        projectBar() +
        (
          {
            mail: mailsPage,
            settings: settingsPage,
            proposals: proposalsPage,
            activity: activityPage,
          }[state.route.view] || projectsPage
        )();
    document.documentElement.lang = state.language;
    document.querySelector(".skip-link").textContent = translate("Ir al contenido", state.language);
    document.title =
      "Company Brain · " +
      (current() && state.route.projectId
        ? current().name
        : translate("Proyectos", state.language));
    app.innerHTML = renderShell(content);
    restoreLiteralText(
      app,
      "[data-email-source]",
      (data) => state.data?.mails.find((mail) => mail.id === data.emailSource)?.text,
    );
    if (!dialog.open) restoreFocus(focus);
    renderDialog();
  }
  return { render, renderDialog };
}
