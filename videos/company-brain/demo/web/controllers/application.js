import { parseRoute, routeFor } from "../router.js";
import { saveLanguage } from "../i18n.js";
import { prepareProjectDraft } from "../state.js";
import { createNotice } from "../components/notice.js";
/** Las acciones son el único lugar que modifica el estado o solicita cambios al servidor. */
export function createApplicationController({
  state,
  request,
  render,
  renderDialog,
  dialog,
  notice,
}) {
  const current = () => state.data?.project;
  const globallyBusy = () => state.busy || Boolean(state.config?.busy);
  const showNotice = createNotice(notice, () => state.language);
  let poll,
    reviewId = 0;
  async function load({ quiet = false } = {}) {
    // Una respuesta de una ruta anterior no puede reemplazar la selección actual.
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
        prepareProjectDraft(state);
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
  function changeRoute(fetchData = true) {
    if (state.routeHash === location.hash) return;
    // Invalida también la revisión si se sale y luego se vuelve a la misma ruta.
    reviewId++;
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
    else {
      prepareProjectDraft(state);
      render();
    }
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
    if (!["project-form", "participant-form", "confirmation-form"].includes(event.target.id))
      return;
    event.preventDefault();
    if (event.target.id === "project-form") {
      const values = Object.fromEntries(new FormData(event.target));
      // datetime-local no incluye zona: el formulario indica UTC y la API recibe una fecha ISO.
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
      if (action === "sync")
        await mutate("/api/mail/sync", { projectId }, "Correos sincronizados.");
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
        const id = ++reviewId,
          routeHash = location.hash;
        const proposal = await request(
          "/api/proposals/detail?projectId=" +
            encodeURIComponent(projectId) +
            "&id=" +
            encodeURIComponent(target.dataset.proposal),
        );
        if (id === reviewId && location.hash === routeHash && state.route.projectId === projectId) {
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
  return {
    start() {
      load();
      poll = setInterval(() => {
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
    },
    stop() {
      clearInterval(poll);
      showNotice.clear();
    },
  };
}
