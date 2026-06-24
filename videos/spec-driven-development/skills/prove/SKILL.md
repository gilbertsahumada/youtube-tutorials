---
name: prove
description: Verifica que una tarea quedó realmente lista corriendo su paso Verify y mostrando la salida real, sin autoreporte. Úsala después de implementar una tarea, cuando se quiera comprobar que funciona de verdad ("verifica T1", "prueba que esto funciona").
---

# Prove: verifica de verdad (sin autoreporte)

Demuestra que la tarea quedó lista corriendo su `Verify` y mostrando la **evidencia real**. Esta es la pieza que evita que el agente se autoengañe. Idealmente se corre en un contexto/sesión distinta del que implementó.

Toma el paso **Verify** de la tarea indicada y ejecútalo:

- **Si es un comando:** córrelo y **pega la salida COMPLETA y real** (no un resumen, no "pasó todo"). Si falla, muestra el error tal cual.
- **Si es un check manual:** haz los pasos exactos y reporta lo observado ("hice X, vi Y"), incluyendo el camino que falla cuando importe.

Reglas duras:
- **NO declares éxito sin evidencia pegada.**
- **NO inventes** salida de comandos ni resultados. Si no pudiste correrlo, dilo y explica por qué.
- Una tarea, una evidencia: si no hay evidencia, la tarea **no está lista**.

Veredicto final: **PASA / NO PASA**, con la evidencia que lo respalda.
