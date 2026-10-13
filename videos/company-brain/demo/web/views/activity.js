/** Construye esta pantalla con datos explícitos; los eventos pertenecen al controlador. */
export function createActivityViews(context) {
  const { state, escape, t, date, link, current, heading, empty } = context;
  function activityPage() {
    return (
      heading(
        "El recorrido del proyecto.",
        "La sincronización, el análisis y las decisiones quedan registrados.",
      ) +
      (state.data.events.length
        ? /* HTML */ `<ol class="activity-list">
            ${state.data.events
              .map(
                (event) =>
                  /* HTML */ `<li>
                    <span class="activity-dot"></span>
                    <div>
                      <time>${date(event.date)} UTC</time>
                      <h2>${t(event.title)}</h2>
                      <p>${escape(event.detail)}</p>
                    </div>
                  </li>`,
              )
              .join("")}
          </ol>`
        : empty(
            "Aún no hay actividad.",
            "Empieza sincronizando los correos del proyecto.",
            link("mail", "Correos", current().id, "button secondary"),
          ))
    );
  }
  return { activityPage };
}
