---
name: prove
description: Verifica una tarea definida en una spec con un campo Verify, ejecutando ese comando o check y mostrando la salida real sin autoreporte. Úsala después de implementar una tarea, cuando se quiera comprobar que funciona de verdad y no solo que el agente lo afirme.
---

# Prove: verifica de verdad (sin autoreporte)

Demuestra que la tarea quedó lista corriendo su `Verify` y mostrando la **evidencia real**.

## Entrada y contrato

Recibe:

- la ruta de una spec Markdown;
- el identificador de una tarea, por ejemplo `T1`.

La tarea debe tener este formato:

```md
### T1: Nombre de la tarea
- **Verify:** `comando o check`
```

- Localiza el encabezado de la tarea indicada.
- Busca exactamente un campo `Verify` dentro de esa sección.
- Si el valor es código inline, trátalo como comando.
- Si describe pasos manuales, ejecútalos en el orden indicado.
- Si `Verify` falta, aparece más de una vez o es ambiguo, no infieras: entrega `NO PASA: Verify ausente o ambiguo`.

Toma el paso **Verify** de la tarea indicada y ejecútalo:

- **Si es un comando:** córrelo y **pega la salida COMPLETA y real** (no un resumen, no "pasó todo"). Si falla, muestra el error tal cual.
- **Si es un check manual:** haz los pasos exactos y reporta lo observado ("hice X, vi Y"), incluyendo el camino que falla cuando importe.

Reglas duras:
- **NO declares éxito sin evidencia pegada.**
- **NO inventes** salida de comandos ni resultados. Si no pudiste correrlo, dilo y explica por qué.
- Una tarea, una evidencia: si no hay evidencia, la tarea **no está lista**.

Veredicto final: **PASA / NO PASA**, con la evidencia que lo respalda.
