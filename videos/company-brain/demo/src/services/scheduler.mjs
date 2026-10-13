/**
 * Programa sincronización y análisis; la aprobación permanece fuera del seguimiento.
 * El coordinador conserva el bloqueo compartido con las acciones manuales.
 */
export function createScheduler({
  projects,
  runtime,
  runProject,
  unavailable,
  now,
  intervalMs = 10000,
}) {
  let timer;
  async function tick() {
    if (unavailable()) return;
    for (const project of projects().filter((item) => item.autoEnabled)) {
      if (unavailable()) return;
      const saved = runtime(project.id);
      // Una conexión fallida espera al menos cinco minutos para evitar reintentos constantes.
      const delay = (saved.error ? Math.max(project.pollSeconds, 300) : project.pollSeconds) * 1000;
      if (saved.lastAutoAttempt && now() - saved.lastAutoAttempt < delay) continue;
      try {
        await runProject(project);
      } catch (problem) {
        if (problem.status !== 423) throw problem;
      }
    }
  }
  return {
    tick,
    start() {
      if (timer) return;
      timer = setInterval(
        () =>
          tick().catch(() => {
            // El coordinador ya conserva los errores operativos en la actividad del proyecto.
          }),
        intervalMs,
      );
      timer.unref();
    },
    stop() {
      clearInterval(timer);
      timer = undefined;
    },
  };
}
