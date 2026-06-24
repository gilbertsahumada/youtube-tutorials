# /scope — Convierte una idea en una spec

Genera una spec ejecutable para un agente a partir de una idea vaga (las 5 preguntas).

**Uso:** `/scope <describe la feature en 1-2 líneas>`

---

Lee primero `CLAUDE.md` / `AGENTS.md` si existen (de ahí salen las convenciones y restricciones globales). Pregunta solo si estás bloqueado.

Convierte esta idea en una spec y guárdala en `specs/<slug>.md`:

$ARGUMENTS

La spec debe tener exactamente estas secciones:

```md
# <Nombre de la feature>

## Contexto
- Qué existe hoy (stack, carpetas) que debes respetar.
- Patrones a seguir (nombra un archivo del repo que ya lo hace bien).
- Decisiones ya tomadas (para no re-discutirlas).

## Objetivo
El resultado concreto y acotado. Una frase, no "mejorar X".

## Restricciones
- Qué NO tocar (auth, modelo de datos, contratos de API).
- Sin dependencias nuevas salvo que sea necesario y justificado.

## Fuera de alcance
- Lo que NO va en esta feature.

## Tareas
### T1: <título corto>
**Hacer:** <cambio específico>
**Archivos:** <rutas que tocará>
**Verify:** <comando o check manual específico>
### T2: ...

## Done (validación final)
- [ ] <comando build/test pasa>
- [ ] Manual: <qué revisar end-to-end>
```

Reglas al escribirla:
- **Tareas chicas:** cada una en una sesión, < ~3 archivos, segura de commitear sola. Si una tarea puede chocar con el límite de contexto, pártela.
- **Verify de verdad:** prefiere un comando sobre revisión manual; el manual debe ser específico ("clic en X, se ve Y"), no "verificar que funciona".
- **No escribas código todavía.**

Al terminar, hazte el test de completitud: *¿un agente nuevo, sin más contexto que esta spec, podría implementar T1?* Si no, falta detalle.
