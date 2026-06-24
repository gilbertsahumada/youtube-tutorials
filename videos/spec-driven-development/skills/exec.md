# /exec — Ejecuta una sola tarea

Implementa UNA tarea de una spec. Ni una línea más.

**Uso:** `/exec specs/<slug>.md T1`

---

$ARGUMENTS apunta al archivo de spec y a la tarea (ej. `T1`).

1. Lee la spec completa.
2. Lee Contexto, Objetivo, Restricciones y Fuera de alcance para tener el marco.
3. Implementa **exactamente** lo que describe esa tarea.

Reglas duras:
- **Solo esa tarea** — ignora las demás de la spec.
- **Solo los archivos** listados en la tarea.
- **Nada de refactors de paso** ni mejoras que no se pidieron.
- Respeta las restricciones al pie de la letra. **No agregues dependencias** salvo que la spec lo diga explícitamente.
- Escribe tests si la tarea lo pide.

Al terminar, reporta:
- Archivos creados o modificados.
- Qué hiciste y por qué.
- El resultado del paso **Verify** (o corre `/prove` para la evidencia real).
- Riesgos o dudas antes de continuar.

**No avances a la siguiente tarea.** Sugiere el siguiente paso: `/prove specs/<slug>.md T1` y, si pasa, `/exec specs/<slug>.md T2` en una sesión fresca.
