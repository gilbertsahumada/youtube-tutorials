---
name: prove
description: Comprueba si una tarea de una spec está realmente terminada revisando su alcance, ejecutando su Verify y contrastando la evidencia con los criterios de Done. Úsala después de implementar una tarea y antes de declararla lista o hacer commit.
---

# Prove

Verifica una tarea sin modificar el proyecto y sin confiar en el autoreporte del agente que la implementó.

## Entrada

Recibe:

- la ruta de una spec Markdown;
- el identificador de una tarea, por ejemplo `T1`.

## Procedimiento

1. Lee la tarea y extrae `Hacer`, `Archivos` y `Verify`.
2. Lee los criterios de `Done` de la spec.
3. Revisa el diff actual.
4. Comprueba que los archivos modificados pertenecen al alcance de la tarea.
5. Si cambiaron tests, comprueba que no fueron eliminados, omitidos ni debilitados.
6. Ejecuta el comando indicado en `Verify`.
7. Contrasta la salida real con cada criterio de `Done`.

Si la tarea no tiene `Verify`, indica que no pudiste verificarla. No inventes uno.

## Reglas

- No modifiques código, tests ni la spec.
- No corrijas los errores encontrados.
- No declares un criterio cumplido si la evidencia no lo demuestra.
- No inventes comandos, resultados ni salidas.
- Si `Verify` falla, conserva el error real.

## Salida

- Tarea revisada.
- Archivos modificados y resultado del control de alcance.
- Comando `Verify` ejecutado.
- Salida real relevante, incluyendo errores.
- Criterios de `Done` comprobados y pendientes.
- Veredicto final: `PASA` o `NO PASA`.
