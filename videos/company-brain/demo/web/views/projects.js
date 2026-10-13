import { routeFor } from "../router.js";
/** Construye esta pantalla con datos explícitos; los eventos pertenecen al controlador. */
export function createProjectsViews(context) {
  const {
    state,
    escape,
    t,
    icon,
    button,
    link,
    current,
    globallyBusy,
    scopedFilters,
    heading,
    empty,
  } = context;
  function projectsPage() {
    const projects = state.config?.projects || [];
    return (
      heading(
        "Tus proyectos",
        "Un espacio para coordinar conversaciones y trabajo.",
        link("new", "Nuevo proyecto", null, "button primary"),
      ) +
      (projects.length
        ? /* HTML */ `<section class="project-list">
            ${projects
              .map(
                (project) =>
                  /* HTML */ `<article class="project-row">
                    <div class="project-row-name">
                      <span class="project-symbol">${icon("projects")}</span>
                      <div>
                        <h2>
                          <a href="${routeFor("mail", project.id)}">${escape(project.name)}</a>
                        </h2>
                        <p>${escape(project.repository)}</p>
                      </div>
                    </div>
                    <div class="project-row-details">
                      <span>${project.mailCount} ${t("Mensajes disponibles")}</span
                      ><span>${project.pendingCount} ${t("Pendientes de aprobación")}</span
                      ><span class="pill ${project.autoEnabled ? "success" : "neutral"}"
                        >${t(project.autoEnabled ? "Activo" : "Pausado")}</span
                      >
                    </div>
                    <div class="row-actions">
                      ${link("mail", "Abrir proyecto", project.id, "button secondary")}${link("settings", "Configurar proyecto", project.id)}
                    </div>
                  </article>`,
              )
              .join("")}
          </section>`
        : empty(
            "Todavía no hay proyectos.",
            "Crea un proyecto, elige su repositorio y añade sus participantes.",
            link("new", "Crear proyecto", null, "button primary"),
          ))
    );
  }
  function projectForm(edit = false) {
    const value = (name) => escape(state.projectDraft[name]);
    return /* HTML */ `<form id="project-form" class="form-grid">
      <label
        >${t("Nombre del proyecto")}<input
          id="project-name"
          name="name"
          maxlength="120"
          required
          placeholder="${t("Nombre para identificar este trabajo")}"
          value="${value("name")}" /></label
      ><label
        >${t("Repositorio de GitHub")}
        <div class="repository-field">
          <input
            id="project-repository"
            name="repository"
            maxlength="200"
            required
            list="repository-options"
            placeholder="${t("Selecciona o escribe owner/repo")}"
            value="${value("repository")}"
          /><button
            type="button"
            class="icon-button"
            data-action="repositories"
            aria-label="${t("Cargar repositorios")}"
            title="${t("Cargar repositorios")}"
          >
            ${icon("sync")}
          </button>
        </div>
        <datalist id="repository-options">
          ${state.repositories
            .map((repo) => /* HTML */ `<option value="${escape(repo.name)}"></option>`)
            .join("")}</datalist
        ><span class="hint"
          >${t("El repositorio puede contener varias tareas. El agente buscará los issues existentes.")}</span
        ></label
      ><label
        >${t("Leer correos desde (UTC)")}<input
          id="project-date"
          name="gmailAfter"
          type="datetime-local"
          step="1"
          required
          value="${value("gmailAfter")}"
        /><span class="hint"
          >${t("Fecha y hora en UTC. Incluye los mensajes desde ese momento.")}</span
        ></label
      ><label
        >${t("Etiqueta de Gmail (opcional)")}<input
          id="project-label"
          name="gmailLabel"
          maxlength="200"
          placeholder="${t("Sin etiqueta")}"
          value="${value("gmailLabel")}"
        /><span class="hint">${t("Déjala vacía para buscar por participantes.")}</span></label
      >
      <div class="form-actions full">
        <button class="button primary" type="submit" ${globallyBusy() ? " disabled" : ""}>
          ${t(edit ? "Guardar cambios" : "Crear proyecto")}</button
        >${link("projects", "Cancelar")}
      </div>
    </form>`;
  }
  function settingsPage() {
    const project = current(),
      filters = scopedFilters(project.id);
    return /* HTML */ `${heading(
        "Configuración del proyecto",
        "Organiza tus proyectos y elige qué correos forman parte de cada uno.",
      )}
      <div class="settings-grid">
        <section class="panel">
          <h2>${t("Datos del proyecto")}</h2>
          ${projectForm(true)}
        </section>
        <section class="panel participants-panel">
          <h2>${t("Participantes")}</h2>
          <p>${t("Añade los correos y dominios que forman parte de este proyecto.")}</p>
          <form id="participant-form" class="participant-form">
            <label
              >${t("Tipo de filtro")}<select name="kind" id="participant-kind">
                <option value="domain" ${state.participant.kind === "domain" ? " selected" : ""}>
                  ${t("Dominio")}
                </option>
                <option value="email" ${state.participant.kind === "email" ? " selected" : ""}>
                  ${t("Correo exacto")}
                </option>
              </select></label
            ><label
              >${t("Correo o dominio")}<input
                id="participant-value"
                name="value"
                required
                maxlength="254"
                placeholder="${state.participant.kind === "domain" ? "empresa.com" : "persona@empresa.com"}"
                value="${escape(state.participant.value)}" /></label
            ><button class="button secondary" type="submit" ${globallyBusy() ? " disabled" : ""}>
              ${icon("plus")}${t("Añadir participante")}
            </button>
          </form>
          <ul class="participants">
            ${filters
              .map(
                (rule) =>
                  /* HTML */ `<li>
                    <div>
                      <span class="pill neutral"
                        >${t(rule.kind === "domain" ? "Dominio" : "Correo exacto")}</span
                      ><strong>${escape(rule.value)}</strong>
                    </div>
                    <button
                      class="icon-button danger-text"
                      data-action="remove-filter"
                      data-filter="${rule.id}"
                      aria-label="${t("Eliminar participante")}"
                      ${globallyBusy() ? " disabled" : ""}
                    >
                      ${icon("trash")}
                    </button>
                  </li>`,
              )
              .join("")}
          </ul>
          ${
            !filters.length
              ? /* HTML */ `<p class="hint">${t("Añade el primero para sincronizar correos.")}</p>`
              : ""
          }
          <p class="hint">
            ${t("Cambiar participantes, fecha o etiqueta requiere volver a sincronizar.")}
          </p>
        </section>
        <section class="panel automation-panel">
          <div class="section-heading">
            <h2>${t("Seguimiento automático")}</h2>
            <span class="pill ${project.autoEnabled ? "success" : "neutral"}"
              >${t(project.autoEnabled ? "Activo" : "Pausado")}</span
            >
          </div>
          <p>
            ${t("Preparará propuestas mientras el servidor esté encendido, aunque cierres la página.")}
          </p>
          <p>${t("Cada cambio en GitHub requiere aprobación.")}</p>
          <label for="poll-seconds">${t("Intervalo")}</label
          ><select id="poll-seconds">
            ${[
              [60, "Cada minuto"],
              [120, "Cada 2 minutos"],
              [300, "Cada 5 minutos"],
            ]
              .map(
                ([seconds, label]) =>
                  /* HTML */ `<option
                    value="${seconds}"
                    ${seconds === project.pollSeconds ? " selected" : ""}
                  >
                    ${t(label)}
                  </option>`,
              )
              .join("")}</select
          >${button(
            "automation",
            project.autoEnabled ? "Pausar seguimiento" : "Activar seguimiento",
            "secondary",
            state.busy ||
              (!project.autoEnabled &&
                (globallyBusy() || !filters.length || !state.config?.environmentReady)),
          )}
        </section>
        <section class="panel danger-panel">
          <h2>${t("Eliminar proyecto")}</h2>
          <p>${t("Elimina el estado local de este proyecto.")}</p>
          ${button("delete-project", "Eliminar proyecto", "danger", globallyBusy())}
        </section>
      </div>`;
  }
  return { projectsPage, projectForm, settingsPage };
}
