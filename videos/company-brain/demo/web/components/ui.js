import { translate } from "../i18n.js";
import { routeFor } from "../router.js";
import { icon, gmailLogo, githubLogo } from "./icons.js";
export const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
  );
export const issueText = (value) =>
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
/** Formatos y componentes leen el estado recibido, sin modificarlo. */
export function createViewContext(state) {
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
  const button = (action, label, style = "secondary", disabled = false, extra = "") =>
    /* HTML */ `<button
      class="button ${style}"
      data-action="${action}"
      ${extra}${disabled ? " disabled" : ""}
    >
      ${t(label)}
    </button>`;
  const link = (view, label, id, style = "text-link") =>
    /* HTML */ `<a class="${style}" href="${routeFor(view, id)}">${t(label)}</a>`;
  const current = () => state.data?.project;
  const globallyBusy = () => state.busy || Boolean(state.config?.busy);
  const scopedFilters = (id) =>
    (state.config?.filters || []).filter((rule) => rule.projectId === id);
  const pending = () => (state.data?.proposals || []).filter((item) => item.status === "pending");
  function heading(title, description, action = "") {
    return /* HTML */ `<div class="page-heading">
      <div>
        <h1>${t(title)}</h1>
        <p>${t(description)}</p>
      </div>
      ${action}
    </div>`;
  }
  function empty(title, description, action = "") {
    return /* HTML */ `<div class="empty-state">
      ${icon("projects")}
      <h2>${t(title)}</h2>
      <p>${t(description)}</p>
      ${action}
    </div>`;
  }
  return {
    state,
    escape,
    issueText,
    t,
    date,
    icon,
    gmailLogo,
    githubLogo,
    button,
    link,
    current,
    globallyBusy,
    scopedFilters,
    pending,
    heading,
    empty,
  };
}
