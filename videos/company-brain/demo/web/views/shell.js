import { routeFor } from "../router.js";
/** Marco compartido: cabecera, navegación y contexto del proyecto. */
export function createShellViews(context) {
  const { state, escape, t, icon, link, current } = context;
  function sidebar() {
    const available = (id) => (state.config?.projects || []).some((project) => project.id === id);
    const selected = available(state.route.projectId)
      ? state.route.projectId
      : available(state.activeProjectId)
        ? state.activeProjectId
        : null;
    const routes = [
      ["projects", "Proyectos", null],
      ["mail", "Correos", selected],
      ["proposals", "Propuestas", selected],
      ["activity", "Actividad", selected],
    ];
    return /* HTML */ `<aside class="sidebar">
      <label class="project-switch-label" for="project-switch">${t("Proyecto activo")}</label
      ><select id="project-switch">
        <option value="">${t("Selecciona un proyecto")}</option>
        ${(state.config?.projects || [])
          .map(
            (project) =>
              /* HTML */ `<option
                value="${escape(project.id)}"
                ${project.id === selected ? " selected" : ""}
              >
                ${escape(project.name)}
              </option>`,
          )
          .join("")}
      </select>
      <nav aria-label="${t("Navegación principal")}">
        ${routes
          .map(([view, label, id]) => {
            const disabled = view !== "projects" && !id;
            const count =
              view === "proposals"
                ? (state.config?.projects || []).find((project) => project.id === selected)
                    ?.pendingCount || 0
                : 0;
            return /* HTML */ `<a
              class="nav-item${state.route.view === view ? " active" : ""}${disabled ? " disabled" : ""}"
              href="${routeFor(view, id)}"
              ${disabled ? ' aria-disabled="true" tabindex="-1"' : ""}${state.route.view === view ? ' aria-current="page"' : ""}
              >${icon(view)}<span>${t(label)}</span>${count ? /* HTML */ `<span class="nav-count">${count}</span>` : ""}</a
            >`;
          })
          .join("")}
      </nav>
      <div class="sidebar-bottom">
        ${link(
          "connections",
          "Conexiones y datos",
          null,
          "nav-item" + (state.route.view === "connections" ? " active" : ""),
        )}
        <p>${t("Cada cambio en GitHub requiere aprobación.")}</p>
      </div>
    </aside>`;
  }
  function banner() {
    let html = "";
    if (state.config && !state.config.environmentReady)
      html += /* HTML */ `<section class="alert environment-alert" role="alert">
        <strong>${t("Faltan conexiones")}</strong>
        <p>
          ${t(
            state.config.error ||
              "Hay variables de entorno inválidas. Corrige el archivo .env y reinicia el servidor.",
          )}
        </p>
        ${link("connections", "Configurar conexiones")}
      </section>`;
    const message =
      state.error === "Proyecto no encontrado." ? "" : state.error || state.data?.runtime?.error;
    if (message)
      html += /* HTML */ `<section class="alert" role="alert">
        <p>${t(message)}</p>
        ${link("connections", "Ver conexiones")}
      </section>`;
    if (state.config?.busy)
      html += /* HTML */ `<div class="working-strip" role="status">
        <span class="loader"></span>${t("Trabajando…")}
      </div>`;
    return html;
  }
  function projectBar() {
    const project = current();
    if (!project) return "";
    return /* HTML */ `<div class="project-bar">
      <div>
        ${link("projects", "Volver a proyectos")}
        <h2>${escape(project.name)}</h2>
        <p>${escape(project.repository)}</p>
      </div>
      ${link("settings", "Configurar proyecto", project.id, "button secondary")}
    </div>`;
  }
  function renderShell(content) {
    return /* HTML */ `<header class="topbar">
        <a class="brand" href="#/projects"
          ><span class="brand-symbol">${icon("proposals")}</span>Company Brain</a
        ><span class="top-tag">${t("Espacio de coordinación")}</span>
        <div class="top-actions">
          <button
            class="language-button"
            data-action="language"
            aria-label="${state.language === "es" ? "Switch to English" : "Cambiar a español"}"
          >
            ${state.language === "es" ? "EN" : "ES"}</button
          ><span class="connection-dot ${state.config?.environmentReady ? "ready" : ""}"></span>
        </div>
      </header>
      <div class="layout">
        ${sidebar()}
        <main id="main" tabindex="-1">${banner()}${content}</main>
      </div>
      <footer class="app-footer">${t("Tú decides. Company Brain aporta el contexto.")}</footer>`;
  }
  return { sidebar, banner, projectBar, renderShell };
}
