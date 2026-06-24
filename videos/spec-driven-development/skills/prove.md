# /prove — Verifica de verdad (sin autoreporte)

Demuestra que la tarea quedó lista corriendo su `Verify` y mostrando la **evidencia real**. Esta es la pieza que evita que el agente se autoengañe.

**Uso:** `/prove specs/<slug>.md T1`

> Idealmente córrelo tú, en CI, o en un agente/sesión distinta del que implementó. El que escribió el código no es buen juez de si su código funciona.

---

Toma el paso **Verify** de la tarea indicada en $ARGUMENTS y ejecútalo:

- **Si es un comando:** córrelo y **pega la salida COMPLETA y real** (no un resumen, no "pasó todo"). Si falla, muestra el error tal cual.
- **Si es un check manual:** haz los pasos exactos y reporta lo observado ("hice X, vi Y"), incluyendo el camino que falla cuando importe.

Reglas duras:
- **NO declares éxito sin evidencia pegada.**
- **NO inventes** salida de comandos ni resultados. Si no pudiste correrlo, dilo y explica por qué.
- Una tarea, una evidencia: si no hay evidencia, la tarea **no está lista**.

Veredicto final: **PASA / NO PASA**, con la evidencia que lo respalda.
