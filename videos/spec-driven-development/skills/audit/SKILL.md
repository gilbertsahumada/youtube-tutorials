---
name: audit
description: Revisa los cambios (el diff) como un ingeniero senior contra la spec, mirando alcance, correctitud, simplicidad y consistencia. Úsala antes de commitear o mergear, cuando se pida revisar el código o el diff.
---

# Audit: revisión senior del diff

Revisa los archivos cambiados (o el target indicado) como lo haría un ingeniero senior, contra la spec. Idealmente se corre en un **contexto fresco / sesión aparte**, para no ser el mismo agente revisando su propio trabajo.

Evalúa en este orden:

### 1. Alcance (lo primero)
- ¿Tocó algo de **"No tocar"** o **"Fuera de alcance"** de la spec? Si sí, márcalo: es lo más grave.
- ¿Hizo de más (features, abstracciones, dependencias que nadie pidió)?

### 2. Correctitud
- Casos borde sin cubrir, bugs evidentes, manejo de errores.

### 3. Simplicidad
- ¿Está sobre-ingenierizado? ¿Se puede más corto sin perder claridad? ¿Abstracciones innecesarias?

### 4. Consistencia
- ¿Sigue los patrones de `CLAUDE.md` / `AGENTS.md` y del resto del repo? ¿Es idiomático?

Salida:
- Si hay problemas: lista con **archivo:línea** + el fix concreto.
- Si está bien: dilo breve y sigue.

Sé constructivo, no nitpick. Enfócate en lo que importa: bugs, alcance, claridad, mantenibilidad. No sugieras cambios solo por sugerir.
