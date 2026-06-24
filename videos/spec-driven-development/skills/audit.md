# /audit — Revisión senior del diff

Revisa los cambios como lo haría un ingeniero senior, contra la spec.

**Uso:** `/audit` (revisa los archivos cambiados) · `/audit <archivo o target>`

> Córrelo en un **contexto fresco / agente aparte**, para que NO sea el mismo agente revisando su propio trabajo. Ahí está el valor.

---

Revisa $ARGUMENTS (o todos los archivos cambiados) y evalúa, en este orden:

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
