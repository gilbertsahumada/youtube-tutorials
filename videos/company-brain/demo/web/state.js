import { readLanguage } from "./i18n.js";
import { parseRoute } from "./router.js";
/** Crea el estado de una sesión; los datos persistidos llegan exclusivamente desde la API. */
export function createState(hash, storage) {
  const state = {
    language: readLanguage(storage),
    route: parseRoute(hash),
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
  state.routeHash = hash;
  return state;
}
/** Prepara el borrador fuera del render para conservar la escritura durante cambios de idioma. */
export function prepareProjectDraft(state) {
  if (state.projectDraft || !["new", "settings"].includes(state.route.view)) return;
  const project = state.route.view === "settings" ? state.data?.project : null;
  if (state.route.view === "settings" && (!project || project.id !== state.route.projectId)) return;
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
}
