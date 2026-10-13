import { readResponse } from "./http.js";
import { english, translate, readLanguage, saveLanguage } from "./i18n.js";
import { workflowEnglish } from "./workflow-i18n.js";
import { parseRoute, routeFor } from "./router.js";
Object.assign(english, workflowEnglish);

const app = document.querySelector("#app"),
  dialog = document.querySelector("#dialog"),
  notice = document.querySelector("#notice");
const state = {
  language: readLanguage(localStorage),
  route: parseRoute(location.hash),
  data: null,
  config: null,
  token: "",
  busy: false,
  loading: true,
  loadId: 0,
  error: "",
  repositories: [],
  projectDraft: null,
  participant: { kind: "domain", value: "" },
  search: "",
  proposalFilter: "pending",
  modal: null,
  confirmation: "",
  account: null,
  activeProjectId: null,
};
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
  );
const issueText = (value) =>
  escape(
    String(value)
      .replace(/<!-- company-brain-proposal:[a-f0-9-]+ -->/g, "")
      .trim()
      .replace(/&#64;/g, "@")
      .replace(/&#58;/g, ":")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&"),
  );
const t = (value) => escape(translate(value, state.language));
const date = (value) =>
  value
    ? escape(
        new Intl.DateTimeFormat(state.language === "en" ? "en-US" : "es-CO", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "UTC",
        }).format(new Date(value)),
      )
    : t("Sin sincronizar");
const icons = {
  projects:
    '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
  proposals: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>',
  activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  settings:
    '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="16" cy="17" r="3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  sync: '<path d="M20 7a8 8 0 0 0-14-1L3 9m0-6v6h6M4 17a8 8 0 0 0 14 1l3-3m0 6v-6h-6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  external:
    '<path d="M14 3h7v7m0-7L10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
};
const icon = (name) =>
  '<svg class="icon" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  (icons[name] || icons.projects) +
  "</svg>";
const gmailLogo =
  '<span class="source-icon"><svg viewBox="0 0 24 20" aria-hidden="true" focusable="false"><path d="M2 18V3l10 7L22 3v15" fill="none" stroke="#4285f4" stroke-width="3.5"/><path d="m2 3 10 7L22 3" fill="none" stroke="#ea4335" stroke-width="3.5"/><path d="M22 6v12" stroke="#34a853" stroke-width="3.5"/><path d="M2 6v12" stroke="#c5221f" stroke-width="3.5"/></svg></span>';
const githubLogo =
  '<span class="source-icon"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.87c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.03a9.58 9.58 0 0 1 5 0c1.9-1.3 2.74-1.03 2.74-1.03.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85V21c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"/></svg></span>';
const button = (action, label, style = "secondary", disabled = false, extra = "") =>
  '<button class="button ' +
  style +
  '" data-action="' +
  action +
  '" ' +
  extra +
  (disabled ? " disabled" : "") +
  ">" +
  t(label) +
  "</button>";
const link = (view, label, id, style = "text-link") =>
  '<a class="' + style + '" href="' + routeFor(view, id) + '">' + t(label) + "</a>";
const current = () => state.data?.project;
const globallyBusy = () => state.busy || Boolean(state.config?.busy);
const scopedFilters = (id) => (state.config?.filters || []).filter((rule) => rule.projectId === id);
const pending = () => (state.data?.proposals || []).filter((item) => item.status === "pending");
function showNotice(message, failed = false) {
  notice.textContent = translate(message, state.language);
  notice.className = "notice" + (failed ? " error" : "");
  notice.hidden = false;
  clearTimeout(showNotice.timer);
  showNotice.timer = setTimeout(() => {
    notice.hidden = true;
  }, 6000);
}
async function request(path, body) {
  try {
    return await readResponse(
      await fetch(
        path,
        body === undefined
          ? { headers: { "X-Company-Brain-Token": state.token } }
          : {
              method: "POST",
              headers: { "Content-Type": "application/json", "X-Company-Brain-Token": state.token },
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
}
async function load({ quiet = false } = {}) {
  const id = ++state.loadId,
    route = { ...state.route };
  if (!quiet) {
    state.loading = true;
    render();
  }
  try {
    let result;
    try {
      result = await request(
        "/api/bootstrap" +
          (route.projectId ? "?projectId=" + encodeURIComponent(route.projectId) : ""),
      );
    } catch (problem) {
      if (problem.payload?.config) result = problem.payload;
      else throw problem;
    }
    if (id !== state.loadId) return;
    state.token = result.token || state.token;
    state.config = result.config;
    state.data = {
      project: result.project || null,
      mails: result.mails || [],
      proposals: result.proposals || [],
      events: result.events || [],
      runtime: result.runtime || {},
      links: result.links || [],
    };
    state.error = result.config?.error ? "" : result.error || "";
    if (route.projectId && result.project) state.activeProjectId = route.projectId;
    else if (
      !state.activeProjectId ||
      !state.config.projects.some((project) => project.id === state.activeProjectId)
    )
      state.activeProjectId = state.config.selectedProjectId;
    if (state.modal?.kind === "review") {
      const updated = state.data.proposals.find((item) => item.id === state.modal.proposal.id);
      if (updated) state.modal.proposal = { ...state.modal.proposal, ...updated };
    }
  } catch (problem) {
    if (id === state.loadId) state.error = problem.message;
  } finally {
    if (id === state.loadId) {
      state.loading = false;
      render();
    }
  }
}
async function mutate(path, body, success, next) {
  if (state.busy) return;
  const routeHash = location.hash;
  state.busy = true;
  render();
  try {
    const result = await request(path, body);
    if (next && location.hash === routeHash) await next(result);
    await load({ quiet: true });
    if (success) showNotice(success);
    return result;
  } catch (problem) {
    await load({ quiet: true });
    showNotice(problem.message, true);
  } finally {
    state.busy = false;
    render();
  }
}
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
  return (
    '<aside class="sidebar"><label class="project-switch-label" for="project-switch">' +
    t("Proyecto activo") +
    '</label><select id="project-switch"><option value="">' +
    t("Selecciona un proyecto") +
    "</option>" +
    (state.config?.projects || [])
      .map(
        (project) =>
          '<option value="' +
          escape(project.id) +
          '"' +
          (project.id === selected ? " selected" : "") +
          ">" +
          escape(project.name) +
          "</option>",
      )
      .join("") +
    '</select><nav aria-label="' +
    t("Navegación principal") +
    '">' +
    routes
      .map(([view, label, id]) => {
        const disabled = view !== "projects" && !id;
        const count =
          view === "proposals"
            ? (state.config?.projects || []).find((project) => project.id === selected)
                ?.pendingCount || 0
            : 0;
        return (
          '<a class="nav-item' +
          (state.route.view === view ? " active" : "") +
          (disabled ? " disabled" : "") +
          '" href="' +
          routeFor(view, id) +
          '"' +
          (disabled ? ' aria-disabled="true" tabindex="-1"' : "") +
          (state.route.view === view ? ' aria-current="page"' : "") +
          ">" +
          icon(view) +
          "<span>" +
          t(label) +
          "</span>" +
          (count ? '<span class="nav-count">' + count + "</span>" : "") +
          "</a>"
        );
      })
      .join("") +
    '</nav><div class="sidebar-bottom">' +
    link(
      "connections",
      "Conexiones y datos",
      null,
      "nav-item" + (state.route.view === "connections" ? " active" : ""),
    ) +
    "<p>" +
    t("Cada cambio en GitHub requiere aprobación.") +
    "</p></div></aside>"
  );
}
function banner() {
  let html = "";
  if (state.config && !state.config.environmentReady)
    html +=
      '<section class="alert environment-alert" role="alert"><strong>' +
      t("Faltan conexiones") +
      "</strong><p>" +
      t(
        state.config.error ||
          "Hay variables de entorno inválidas. Corrige el archivo .env y reinicia el servidor.",
      ) +
      "</p>" +
      link("connections", "Configurar conexiones") +
      "</section>";
  const message =
    state.error === "Proyecto no encontrado." ? "" : state.error || state.data?.runtime?.error;
  if (message)
    html +=
      '<section class="alert" role="alert"><p>' +
      t(message) +
      "</p>" +
      link("connections", "Ver conexiones") +
      "</section>";
  if (state.config?.busy)
    html +=
      '<div class="working-strip" role="status"><span class="loader"></span>' +
      t("Trabajando…") +
      "</div>";
  return html;
}
function heading(title, description, action = "") {
  return (
    '<div class="page-heading"><div><h1>' +
    t(title) +
    "</h1><p>" +
    t(description) +
    "</p></div>" +
    action +
    "</div>"
  );
}
function empty(title, description, action = "") {
  return (
    '<div class="empty-state">' +
    icon("projects") +
    "<h2>" +
    t(title) +
    "</h2><p>" +
    t(description) +
    "</p>" +
    action +
    "</div>"
  );
}
function projectsPage() {
  const projects = state.config?.projects || [];
  return (
    heading(
      "Tus proyectos",
      "Un espacio para coordinar conversaciones y trabajo.",
      link("new", "Nuevo proyecto", null, "button primary"),
    ) +
    (projects.length
      ? '<section class="project-list">' +
        projects
          .map(
            (project) =>
              '<article class="project-row"><div class="project-row-name"><span class="project-symbol">' +
              icon("projects") +
              '</span><div><h2><a href="' +
              routeFor("mail", project.id) +
              '">' +
              escape(project.name) +
              "</a></h2><p>" +
              escape(project.repository) +
              '</p></div></div><div class="project-row-details"><span>' +
              project.mailCount +
              " " +
              t("Mensajes disponibles") +
              "</span><span>" +
              project.pendingCount +
              " " +
              t("Pendientes de aprobación") +
              '</span><span class="pill ' +
              (project.autoEnabled ? "success" : "neutral") +
              '">' +
              t(project.autoEnabled ? "Activo" : "Pausado") +
              '</span></div><div class="row-actions">' +
              link("mail", "Abrir proyecto", project.id, "button secondary") +
              link("settings", "Configurar proyecto", project.id) +
              "</div></article>",
          )
          .join("") +
        "</section>"
      : empty(
          "Todavía no hay proyectos.",
          "Crea un proyecto, elige su repositorio y añade sus participantes.",
          link("new", "Crear proyecto", null, "button primary"),
        ))
  );
}
function projectBar() {
  const project = current();
  if (!project) return "";
  return (
    '<div class="project-bar"><div>' +
    link("projects", "Volver a proyectos") +
    "<h2>" +
    escape(project.name) +
    "</h2><p>" +
    escape(project.repository) +
    "</p></div>" +
    link("settings", "Configurar proyecto", project.id, "button secondary") +
    "</div>"
  );
}
function projectForm(edit = false) {
  const project = edit ? current() : null;
  if (!state.projectDraft)
    state.projectDraft = project
      ? {
          name: project.name,
          repository: project.repository,
          gmailAfter: project.gmailAfter.slice(0, 19),
          gmailLabel: project.gmailLabel,
        }
      : {
          name: "",
          repository: state.config?.defaultRepository || "",
          gmailAfter: new Date().toISOString().slice(0, 19),
          gmailLabel: "",
        };
  const value = (name) => escape(state.projectDraft[name]);
  return (
    '<form id="project-form" class="form-grid"><label>' +
    t("Nombre del proyecto") +
    '<input id="project-name" name="name" maxlength="120" required placeholder="' +
    t("Nombre para identificar este trabajo") +
    '" value="' +
    value("name") +
    '"></label><label>' +
    t("Repositorio de GitHub") +
    '<div class="repository-field"><input id="project-repository" name="repository" maxlength="200" required list="repository-options" placeholder="' +
    t("Selecciona o escribe owner/repo") +
    '" value="' +
    value("repository") +
    '"><button type="button" class="icon-button" data-action="repositories" aria-label="' +
    t("Cargar repositorios") +
    '" title="' +
    t("Cargar repositorios") +
    '">' +
    icon("sync") +
    '</button></div><datalist id="repository-options">' +
    state.repositories
      .map((repo) => '<option value="' + escape(repo.name) + '"></option>')
      .join("") +
    '</datalist><span class="hint">' +
    t("El repositorio puede contener varias tareas. El agente buscará los issues existentes.") +
    "</span></label><label>" +
    t("Leer correos desde (UTC)") +
    '<input id="project-date" name="gmailAfter" type="datetime-local" step="1" required value="' +
    value("gmailAfter") +
    '"><span class="hint">' +
    t("Fecha y hora en UTC. Incluye los mensajes desde ese momento.") +
    "</span></label><label>" +
    t("Etiqueta de Gmail (opcional)") +
    '<input id="project-label" name="gmailLabel" maxlength="200" placeholder="' +
    t("Sin etiqueta") +
    '" value="' +
    value("gmailLabel") +
    '"><span class="hint">' +
    t("Déjala vacía para buscar por participantes.") +
    '</span></label><div class="form-actions full"><button class="button primary" type="submit"' +
    (globallyBusy() ? " disabled" : "") +
    ">" +
    t(edit ? "Guardar cambios" : "Crear proyecto") +
    "</button>" +
    link("projects", "Cancelar") +
    "</div></form>"
  );
}
function settingsPage() {
  const project = current(),
    filters = scopedFilters(project.id);
  return (
    heading(
      "Configuración del proyecto",
      "Organiza tus proyectos y elige qué correos forman parte de cada uno.",
    ) +
    '<div class="settings-grid"><section class="panel"><h2>' +
    t("Datos del proyecto") +
    "</h2>" +
    projectForm(true) +
    '</section><section class="panel participants-panel"><h2>' +
    t("Participantes") +
    "</h2><p>" +
    t("Añade los correos y dominios que forman parte de este proyecto.") +
    '</p><form id="participant-form" class="participant-form"><label>' +
    t("Tipo de filtro") +
    '<select name="kind" id="participant-kind"><option value="domain"' +
    (state.participant.kind === "domain" ? " selected" : "") +
    ">" +
    t("Dominio") +
    '</option><option value="email"' +
    (state.participant.kind === "email" ? " selected" : "") +
    ">" +
    t("Correo exacto") +
    "</option></select></label><label>" +
    t("Correo o dominio") +
    '<input id="participant-value" name="value" required maxlength="254" placeholder="' +
    (state.participant.kind === "domain" ? "empresa.com" : "persona@empresa.com") +
    '" value="' +
    escape(state.participant.value) +
    '"></label><button class="button secondary" type="submit"' +
    (globallyBusy() ? " disabled" : "") +
    ">" +
    icon("plus") +
    t("Añadir participante") +
    '</button></form><ul class="participants">' +
    filters
      .map(
        (rule) =>
          '<li><div><span class="pill neutral">' +
          t(rule.kind === "domain" ? "Dominio" : "Correo exacto") +
          "</span><strong>" +
          escape(rule.value) +
          '</strong></div><button class="icon-button danger-text" data-action="remove-filter" data-filter="' +
          rule.id +
          '" aria-label="' +
          t("Eliminar participante") +
          '"' +
          (globallyBusy() ? " disabled" : "") +
          ">" +
          icon("trash") +
          "</button></li>",
      )
      .join("") +
    "</ul>" +
    (!filters.length
      ? '<p class="hint">' + t("Añade el primero para sincronizar correos.") + "</p>"
      : "") +
    '<p class="hint">' +
    t("Cambiar participantes, fecha o etiqueta requiere volver a sincronizar.") +
    '</p></section><section class="panel automation-panel"><div class="section-heading"><h2>' +
    t("Seguimiento automático") +
    '</h2><span class="pill ' +
    (project.autoEnabled ? "success" : "neutral") +
    '">' +
    t(project.autoEnabled ? "Activo" : "Pausado") +
    "</span></div><p>" +
    t("Preparará propuestas mientras el servidor esté encendido, aunque cierres la página.") +
    "</p><p>" +
    t("Cada cambio en GitHub requiere aprobación.") +
    '</p><label for="poll-seconds">' +
    t("Intervalo") +
    '</label><select id="poll-seconds">' +
    [
      [60, "Cada minuto"],
      [120, "Cada 2 minutos"],
      [300, "Cada 5 minutos"],
    ]
      .map(
        ([seconds, label]) =>
          '<option value="' +
          seconds +
          '"' +
          (seconds === project.pollSeconds ? " selected" : "") +
          ">" +
          t(label) +
          "</option>",
      )
      .join("") +
    "</select>" +
    button(
      "automation",
      project.autoEnabled ? "Pausar seguimiento" : "Activar seguimiento",
      "secondary",
      state.busy ||
        (!project.autoEnabled &&
          (globallyBusy() || !filters.length || !state.config?.environmentReady)),
    ) +
    '</section><section class="panel danger-panel"><h2>' +
    t("Eliminar proyecto") +
    "</h2><p>" +
    t("Elimina el estado local de este proyecto.") +
    "</p>" +
    button("delete-project", "Eliminar proyecto", "danger", globallyBusy()) +
    "</section></div>"
  );
}
function mailsPage() {
  const project = current(),
    all = state.data.mails,
    filters = scopedFilters(project.id),
    query = state.search.trim().toLowerCase();
  const mails = [...all]
    .reverse()
    .filter((mail) => (mail.subject + " " + mail.from).toLowerCase().includes(query));
  const chosen = all.find((mail) => mail.id === state.route.emailId) || mails[0];
  const actions =
    '<div class="heading-actions">' +
    button(
      "sync",
      "Sincronizar correo",
      "secondary",
      globallyBusy() || !filters.length || !state.config.connections.gmail,
    ) +
    button(
      "analyze",
      "Analizar correos",
      "primary",
      globallyBusy() || !all.length || !state.config.connections.model,
    ) +
    "</div>";
  const metadata =
    '<div class="mail-summary"><span><strong>' +
    all.length +
    "</strong> " +
    t("Mensajes disponibles") +
    "</span><span><strong>" +
    all.filter((mail) => !mail.analyzed).length +
    "</strong> " +
    t("Por analizar") +
    "</span><span>" +
    t("Última sincronización") +
    ": " +
    date(state.data.runtime.lastSync) +
    " UTC</span></div>";
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
  return (
    heading(
      "Correos del proyecto",
      "Sincroniza los mensajes y deja que el agente los contraste con GitHub.",
      actions,
    ) +
    metadata +
    '<section class="mail-workspace"><div class="mail-index"><label class="sr-only" for="mail-search">' +
    t("Buscar por asunto o remitente") +
    '</label><input id="mail-search" type="search" placeholder="' +
    t("Buscar por asunto o remitente") +
    '" value="' +
    escape(state.search) +
    '"><div class="mail-list">' +
    mails
      .map(
        (mail) =>
          '<a class="mail-item' +
          (chosen?.id === mail.id ? " selected" : "") +
          '" href="' +
          routeFor("mail", project.id, mail.id) +
          '"><div class="mail-item-top"><span>' +
          escape(mail.from) +
          "</span>" +
          (!mail.analyzed ? '<span class="new-dot" aria-label="' + t("Nuevo") + '"></span>' : "") +
          "</div><h3>" +
          escape(mail.subject || translate("Sin asunto", state.language)) +
          "</h3><time>" +
          date(mail.date) +
          " UTC</time><p>" +
          escape(mail.text.slice(0, 110)) +
          "</p></a>",
      )
      .join("") +
    (!mails.length ? '<p class="no-search">' + t("No coincide con tu búsqueda.") + "</p>" : "") +
    '</div></div><article class="mail-reader">' +
    (chosen
      ? '<div class="mail-reader-heading"><span class="pill ' +
        (chosen.analyzed ? "neutral" : "new") +
        '">' +
        t(chosen.analyzed ? "Analizado" : "Nuevo") +
        "</span><h2>" +
        escape(chosen.subject || translate("Sin asunto", state.language)) +
        "</h2><p>" +
        escape(chosen.from) +
        " · " +
        date(chosen.date) +
        ' UTC</p></div><pre class="source-text">' +
        escape(chosen.text) +
        '</pre><div class="source-note">' +
        t("Texto original de Gmail") +
        "</div>"
      : empty("Selecciona un correo para leerlo.", "")) +
    "</article></section>"
  );
}
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
  return (
    heading("Propuestas", "Revisa lo que el agente propone hacer.") +
    '<div class="view-tabs" role="group" aria-label="' +
    t("Propuestas") +
    '"><button data-action="proposal-tab" data-tab="pending" aria-pressed="' +
    (state.proposalFilter === "pending") +
    '">' +
    t("Pendientes") +
    " <span>" +
    pending().length +
    '</span></button><button data-action="proposal-tab" data-tab="history" aria-pressed="' +
    (state.proposalFilter === "history") +
    '">' +
    t("Historial") +
    "</button></div>" +
    (items.length
      ? '<section class="proposals-list">' +
        items
          .map(
            (item) =>
              '<article class="proposal-card"><div class="proposal-kind"><span class="proposal-symbol">' +
              icon("proposals") +
              "</span><span>" +
              t(item.action === "create_issue" ? "Crear issue" : "Actualizar issue") +
              (item.issueNumber ? " #" + item.issueNumber : "") +
              '</span><span class="pill status-' +
              item.status +
              '">' +
              t(labels[item.status]) +
              "</span></div><h2>" +
              escape(item.title) +
              "</h2><p>" +
              escape(item.reason) +
              '</p><div class="proposal-sources">' +
              item.sources.length +
              " " +
              t("Correos") +
              " · " +
              date(item.createdAt) +
              " UTC</div>" +
              (item.error ? '<p class="error-text">' + t(item.error) + "</p>" : "") +
              '<div class="row-actions"><button class="button ' +
              (item.status === "pending" ? "primary" : "secondary") +
              '" data-action="review" data-proposal="' +
              escape(item.id) +
              '">' +
              t("Revisar propuesta") +
              "</button>" +
              (item.result
                ? '<a class="text-link" target="_blank" rel="noopener noreferrer" href="https://github.com/' +
                  escape(item.repository) +
                  "/issues/" +
                  item.result.number +
                  '">' +
                  t("Abrir en GitHub") +
                  icon("external") +
                  "</a>"
                : "") +
              "</div></article>",
          )
          .join("") +
        "</section>"
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
        )) +
    (state.data.runtime.summary
      ? '<section class="analysis-summary"><h2>' +
        t("Último análisis") +
        "</h2><p>" +
        escape(state.data.runtime.summary) +
        "</p></section>"
      : "")
  );
}
function activityPage() {
  return (
    heading(
      "El recorrido del proyecto.",
      "La sincronización, el análisis y las decisiones quedan registrados.",
    ) +
    (state.data.events.length
      ? '<ol class="activity-list">' +
        state.data.events
          .map(
            (event) =>
              '<li><span class="activity-dot"></span><div><time>' +
              date(event.date) +
              " UTC</time><h2>" +
              t(event.title) +
              "</h2><p>" +
              escape(event.detail) +
              "</p></div></li>",
          )
          .join("") +
        "</ol>"
      : empty(
          "Aún no hay actividad.",
          "Empieza sincronizando los correos del proyecto.",
          link("mail", "Correos", current().id, "button secondary"),
        ))
  );
}
function connectionsPage() {
  const config = state.config || {},
    oauth = config.oauth || {},
    connection = config.connections || {};
  const pill = (ready, yes, no) =>
    '<span class="pill ' + (ready ? "success" : "neutral") + '">' + t(ready ? yes : no) + "</span>";
  return (
    heading("Conexiones y datos", "Conecta las fuentes y controla los datos locales.") +
    '<section class="credentials-note"><h2>' +
    t("Credenciales desde .env") +
    "</h2><p>" +
    t("Las credenciales se configuran en el servidor. Reinicia la demo después de cambiarlas.") +
    '</p><div class="env-names"><code>GOOGLE_CLIENT_ID</code><code>GOOGLE_CLIENT_SECRET</code><code>MODEL_BASE_URL</code><code>MODEL_ID</code><code>MODEL_API_KEY</code></div></section><div class="connection-grid"><section class="panel"><div class="section-heading"><h2 class="connection-title">' +
    gmailLogo +
    "Gmail</h2>" +
    pill(config.gmailConnected, "Autorización guardada", "Sin autorización") +
    "</div><p>" +
    t("Gmail aporta los mensajes; cada proyecto decide qué participantes y fechas incluir.") +
    "</p>" +
    button(
      "gmail-login",
      config.gmailConnected ? "Volver a autorizar Gmail" : "Conectar Gmail",
      "secondary",
      globallyBusy() || !connection.gmail || oauth.status === "starting",
    ) +
    (oauth.url
      ? '<a class="button primary" href="' +
        escape(oauth.url) +
        '" target="_blank" rel="noopener noreferrer">' +
        t("Abrir autorización de Google") +
        "</a>"
      : "") +
    (oauth.message ? '<p class="error-text">' + t(oauth.message) + "</p>" : "") +
    '</section><section class="panel"><div class="section-heading"><h2 class="connection-title">' +
    githubLogo +
    "GitHub</h2>" +
    pill(Boolean(state.account), "Conectado", "Sin comprobar") +
    "</div><p>" +
    t("GitHub utiliza tu sesión de gh. El repositorio se elige en cada proyecto.") +
    "</p>" +
    (state.account ? '<p class="account-name">' + escape(state.account.login) + "</p>" : "") +
    button("github-check", "Comprobar GitHub", "secondary", globallyBusy()) +
    '</section><section class="panel"><div class="section-heading"><h2>' +
    t("Modelo de IA") +
    "</h2>" +
    pill(connection.model, "Configurado", "Pendiente de configurar") +
    "</div><p>" +
    t("El modelo recibe los correos sincronizados y los issues para preparar propuestas.") +
    '</p></section></div><section class="panel reset-panel"><div><h2>' +
    t("Datos locales") +
    "</h2><p>" +
    t(
      "Borra proyectos, participantes, correos sincronizados, propuestas y actividad de esta demo.",
    ) +
    '</p><p class="hint">' +
    t(
      "Tu autorización de Gmail y las credenciales se conservan. Los correos e issues originales no se eliminan.",
    ) +
    "</p></div>" +
    button("reset", "Reiniciar datos locales", "danger", globallyBusy()) +
    "</section>"
  );
}
function renderDialog() {
  if (!state.modal) {
    if (dialog.open) dialog.close();
    return;
  }
  const modal = state.modal;
  let content;
  if (modal.kind === "review") {
    const item = modal.proposal;
    const writable = item.status === "pending" && !globallyBusy();
    content =
      '<div class="dialog-heading"><div><span class="proposal-label">' +
      t(item.action === "create_issue" ? "Crear issue" : "Actualizar issue") +
      (item.issueNumber ? " #" + item.issueNumber : "") +
      '</span><h2 id="dialog-title">' +
      escape(item.title) +
      "</h2><p>" +
      escape(item.repository) +
      '</p></div><button class="icon-button" data-action="close-dialog" aria-label="' +
      t("Cerrar") +
      '">' +
      icon("close") +
      '</button></div><div class="dialog-content"><section><h3>' +
      t("Por qué se propone") +
      "</h3><p>" +
      escape(item.reason) +
      "</p></section><section><h3>" +
      t("Evidencia de los correos") +
      '</h3><div class="evidence-list">' +
      item.evidence
        .map((entry) => {
          const source = item.sources.find((source) => source.id === entry.emailId);
          return (
            "<blockquote><p>" +
            escape(entry.quote) +
            '</p><footer><a href="' +
            routeFor("mail", item.projectId, source.id) +
            '">' +
            escape(source.subject || source.from) +
            "</a> · " +
            date(source.date) +
            " UTC</footer></blockquote>"
          );
        })
        .join("") +
      '</div></section><div class="issue-comparison">' +
      (item.issueSnapshot
        ? "<section><h3>" +
          t("Descripción actual") +
          "</h3><pre>" +
          issueText(item.issueSnapshot.body) +
          "</pre></section>"
        : "") +
      "<section><h3>" +
      t("Descripción que se publicará") +
      "</h3><pre>" +
      issueText(item.previewBody) +
      "</pre></section></div>" +
      (item.error ? '<div class="alert"><p>' + t(item.error) + "</p></div>" : "") +
      '</div><div class="dialog-footer"><p>' +
      t("El proyecto decide el repositorio; la propuesta solo puede actuar allí.") +
      "</p>" +
      (item.status === "pending"
        ? button("reject", "Rechazar", "secondary", !writable) +
          button(
            "approve",
            item.action === "create_issue" ? "Aprobar y crear issue" : "Aprobar y actualizar issue",
            "primary",
            !writable,
          )
        : button("close-dialog", "Cerrar")) +
      "</div>";
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
    content =
      '<div class="dialog-heading"><h2 id="dialog-title">' +
      t(resetting ? "Reiniciar la demo" : "Eliminar proyecto") +
      '</h2><button class="icon-button" data-action="close-dialog" aria-label="' +
      t("Cerrar") +
      '">' +
      icon("close") +
      '</button></div><form id="confirmation-form"><div class="dialog-content"><p>' +
      t(
        resetting
          ? "Borra proyectos, participantes, correos sincronizados, propuestas y actividad de esta demo."
          : "Se eliminará el proyecto y sus datos locales. Gmail y GitHub conservarán sus datos.",
      ) +
      "</p>" +
      (resetting
        ? "<p>" +
          t(
            "Tu autorización de Gmail y las credenciales se conservan. Los correos e issues originales no se eliminan.",
          ) +
          "</p>"
        : "<p><strong>" + escape(modal.project.name) + "</strong></p>") +
      '<label for="confirmation">' +
      t(resetting ? "Escribe REINICIAR para confirmar" : "Escribe ELIMINAR para confirmar") +
      '<input id="confirmation" autocomplete="off" value="' +
      escape(state.confirmation) +
      '"></label></div><div class="dialog-footer">' +
      button("close-dialog", "Cancelar") +
      '<button type="submit" class="button danger" id="confirm-action"' +
      (state.confirmation !== word || globallyBusy() ? " disabled" : "") +
      ">" +
      t(resetting ? "Reiniciar datos locales" : "Eliminar proyecto") +
      "</button></div></form>";
  }
  dialog.className = "workflow-dialog" + (modal.kind === "review" ? " review-dialog" : "");
  const focused = document.activeElement;
  const focusedId = focused?.id,
    cursor = focused instanceof HTMLInputElement ? focused.selectionStart : null;
  dialog.innerHTML = content;
  if (!dialog.open) dialog.showModal();
  if (focusedId && document.getElementById(focusedId)) {
    const input = document.getElementById(focusedId);
    input.focus({ preventScroll: true });
    if (cursor !== null && input instanceof HTMLInputElement && input.type !== "datetime-local")
      try {
        input.setSelectionRange(cursor, cursor);
      } catch {
        // Algunos tipos de input no admiten restaurar el cursor.
      }
  }
}
function render() {
  const focused = document.activeElement,
    focusedId = focused?.id;
  const cursor = focused instanceof HTMLInputElement ? focused.selectionStart : null;
  let content;
  if (state.loading && !state.config)
    content = '<div class="boot"><span class="loader"></span><p>' + t("Cargando…") + "</p></div>";
  else if (!state.config)
    content = empty(
      "No se pudo conectar con la demo. Revisa que el servidor esté encendido y recarga la página.",
      "",
    );
  else if (state.route.projectId && (state.loading || current()?.id !== state.route.projectId))
    content = state.loading
      ? '<div class="boot"><span class="loader"></span><p>' + t("Cargando…") + "</p></div>"
      : empty(
          "Proyecto no encontrado.",
          "Vuelve a proyectos para seleccionar uno disponible.",
          link("projects", "Volver a proyectos", null, "button secondary"),
        );
  else if (state.route.view === "projects") content = projectsPage();
  else if (state.route.view === "new")
    content =
      heading(
        "Nuevo proyecto",
        "Crea un proyecto, elige su repositorio y añade sus participantes.",
      ) +
      '<section class="panel new-project-panel">' +
      projectForm() +
      "</section>";
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
    (current() && state.route.projectId ? current().name : translate("Proyectos", state.language));
  app.innerHTML =
    '<header class="topbar"><a class="brand" href="#/projects"><span class="brand-symbol">' +
    icon("proposals") +
    '</span>Company Brain</a><span class="top-tag">' +
    t("Espacio de coordinación") +
    '</span><div class="top-actions"><button class="language-button" data-action="language" aria-label="' +
    (state.language === "es" ? "Switch to English" : "Cambiar a español") +
    '">' +
    (state.language === "es" ? "EN" : "ES") +
    '</button><span class="connection-dot ' +
    (state.config?.environmentReady ? "ready" : "") +
    '"></span></div></header><div class="layout">' +
    sidebar() +
    '<main id="main" tabindex="-1">' +
    banner() +
    content +
    '</main></div><footer class="app-footer">' +
    t("Tú decides. Company Brain aporta el contexto.") +
    "</footer>";
  if (focusedId && !dialog.open && document.getElementById(focusedId)) {
    const input = document.getElementById(focusedId);
    input.focus({ preventScroll: true });
    if (
      cursor !== null &&
      input instanceof HTMLInputElement &&
      !["datetime-local", "number"].includes(input.type)
    )
      try {
        input.setSelectionRange(cursor, cursor);
      } catch {
        // Conservamos el foco aunque el navegador no permita restaurar la selección.
      }
  }
  renderDialog();
}
function changeRoute(fetchData = true) {
  if (state.routeHash === location.hash) return;
  const previous = state.route,
    next = parseRoute(location.hash);
  state.routeHash = location.hash;
  state.route = next;
  if (previous.projectId !== next.projectId || previous.view !== next.view) {
    state.projectDraft = null;
    state.participant = { kind: "domain", value: "" };
    state.search = "";
    window.scrollTo(0, 0);
  }
  state.modal = null;
  state.confirmation = "";
  if (fetchData && (previous.projectId !== next.projectId || !state.config)) load();
  else render();
}
function navigate(view, id) {
  location.hash = routeFor(view, id);
  changeRoute(false);
}
window.addEventListener("hashchange", () => changeRoute());
dialog.addEventListener("cancel", () => {
  state.modal = null;
  state.confirmation = "";
});
dialog.addEventListener("close", () => {
  state.modal = null;
  state.confirmation = "";
});
document.addEventListener("input", (event) => {
  const target = event.target;
  if (target.closest("#project-form") && state.projectDraft)
    state.projectDraft[target.name] = target.value;
  if (target.closest("#participant-form")) state.participant[target.name] = target.value;
  if (target.id === "mail-search") {
    state.search = target.value;
    render();
  }
  if (target.id === "confirmation") {
    state.confirmation = target.value;
    const reset = state.modal.kind === "reset",
      word =
        state.language === "en" ? (reset ? "RESET" : "DELETE") : reset ? "REINICIAR" : "ELIMINAR";
    document.getElementById("confirm-action").disabled =
      state.confirmation !== word || globallyBusy();
  }
});
document.addEventListener("change", (event) => {
  if (event.target.id === "project-switch") {
    navigate(event.target.value ? "mail" : "projects", event.target.value);
    load();
  }
  if (event.target.id === "participant-kind") {
    state.participant.kind = event.target.value;
    render();
  }
});
document.addEventListener("submit", async (event) => {
  if (!["project-form", "participant-form", "confirmation-form"].includes(event.target.id)) return;
  event.preventDefault();
  if (event.target.id === "project-form") {
    const values = Object.fromEntries(new FormData(event.target));
    values.gmailAfter += "Z";
    const editing = state.route.view === "settings",
      id = editing ? current().id : null;
    if (editing) values.id = id;
    await mutate("/api/projects", values, "Proyecto guardado.", (saved) => {
      state.projectDraft = null;
      navigate("settings", saved.id);
    });
  } else if (event.target.id === "participant-form") {
    const projectId = current().id,
      values = Object.fromEntries(new FormData(event.target));
    await mutate(
      "/api/filters",
      { projectId, ...values },
      "Participante añadido. Sincroniza los correos.",
      () => {
        state.participant.value = "";
      },
    );
  } else {
    const modal = state.modal;
    if (!modal) return;
    await mutate(
      modal.kind === "reset" ? "/api/data/reset" : "/api/projects/delete",
      modal.kind === "reset"
        ? { confirmation: "RESET_LOCAL_DATA" }
        : { projectId: modal.project.id, confirmation: modal.project.id },
      modal.kind === "reset" ? "Datos locales reiniciados." : "Proyecto eliminado.",
      () => {
        state.modal = null;
        state.activeProjectId = null;
        navigate("projects");
      },
    );
  }
});
document.addEventListener("click", async (event) => {
  if (event.target.closest(".skip-link")) {
    event.preventDefault();
    document.querySelector("#main")?.focus();
    return;
  }
  const target = event.target.closest("[data-action]");
  if (!target || target.disabled) return;
  const action = target.dataset.action,
    projectId = current()?.id;
  try {
    if (action === "language") {
      state.language = state.language === "es" ? "en" : "es";
      saveLanguage(localStorage, state.language);
      render();
    }
    if (action === "repositories") {
      state.repositories = (await request("/api/repositories")).repositories;
      render();
      const field = document.querySelector("#project-repository");
      field?.focus();
      if (field?.showPicker)
        try {
          field.showPicker();
        } catch {
          // El selector nativo es opcional; el campo sigue permitiendo escribir el repositorio.
        }
    }
    if (action === "sync") await mutate("/api/mail/sync", { projectId }, "Correos sincronizados.");
    if (action === "analyze")
      await mutate(
        "/api/agent/analyze",
        { projectId },
        "Análisis completado. Revisa las propuestas.",
        () => navigate("proposals", projectId),
      );
    if (action === "remove-filter")
      await mutate(
        "/api/filters/remove",
        { projectId, id: Number(target.dataset.filter) },
        "Participante eliminado. Sincroniza de nuevo.",
      );
    if (action === "automation")
      await mutate(
        "/api/projects/automation",
        {
          projectId,
          enabled: !current().autoEnabled,
          pollSeconds: Number(document.querySelector("#poll-seconds").value),
        },
        current().autoEnabled ? "Seguimiento pausado." : "Seguimiento activado.",
      );
    if (action === "proposal-tab") {
      state.proposalFilter = target.dataset.tab;
      render();
    }
    if (action === "review") {
      const proposal = await request(
        "/api/proposals/detail?projectId=" +
          encodeURIComponent(projectId) +
          "&id=" +
          encodeURIComponent(target.dataset.proposal),
      );
      if (state.route.projectId === projectId) {
        state.modal = { kind: "review", proposal };
        renderDialog();
      }
    }
    if (action === "approve" || action === "reject") {
      const item = state.modal?.proposal;
      if (item)
        await mutate(
          "/api/proposals/" + action,
          { projectId: item.projectId, proposalId: item.id },
          action === "approve" ? "Propuesta aprobada." : "Propuesta rechazada.",
          () => {
            state.modal = null;
          },
        );
    }
    if (action === "reset") {
      state.confirmation = "";
      state.modal = { kind: "reset" };
      renderDialog();
    }
    if (action === "delete-project") {
      state.confirmation = "";
      state.modal = { kind: "delete", project: current() };
      renderDialog();
    }
    if (action === "close-dialog") {
      state.modal = null;
      state.confirmation = "";
      renderDialog();
    }
    if (action === "gmail-login") await mutate("/api/gmail/login", {}, null);
    if (action === "github-check") {
      state.account = await request("/api/github/check", {});
      render();
      showNotice("GitHub conectado como " + state.account.login + ".");
    }
  } catch (problem) {
    showNotice(problem.message, true);
  }
});
state.routeHash = location.hash;
load();
setInterval(() => {
  if (
    state.busy ||
    state.loading ||
    dialog.open ||
    document.activeElement?.matches("input,select,textarea") ||
    !state.config
  )
    return;
  if (
    state.config.projects.some((project) => project.autoEnabled) ||
    state.config.busy ||
    ["starting", "waiting"].includes(state.config.oauth?.status)
  )
    load({ quiet: true });
}, 3000);
