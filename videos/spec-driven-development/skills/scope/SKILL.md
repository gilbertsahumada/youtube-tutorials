---
name: scope
description: Convierte una idea o feature vaga en una spec ejecutable con las 5 preguntas (contexto, objetivo, restricciones, tareas y verificación) antes de escribir código. Úsala cuando el usuario describa algo que quiere construir y pida una spec, o planear el trabajo antes de implementar.
---

# Scope: idea → spec

Convierte la idea del usuario en una spec y guárdala en `specs/<slug>.md`. Lee primero `CLAUDE.md` / `AGENTS.md` si existen (de ahí salen las convenciones y restricciones globales). Pregunta solo si estás bloqueado. **No escribas código todavía.**

Trabajas en **dos pasos**:

1. **Dibuja el flujo y confirma.** Antes de dividir nada en tareas, genera la sección `## Flujo` con DOS diagramas ASCII (secuencia + flujo) y **detente**: muéstraselos al usuario y pídele que confirme que ese es el comportamiento que quiere. Aquí es donde se aprueban las decisiones que el agente, si no, inventaría (ventanas de tiempo, casos borde, qué pasa si no hay datos). No sigas hasta el "sí".
2. **Solo entonces, divídelo en tareas.** Con el flujo aprobado, completa el resto de la spec (Restricciones, Fuera de alcance, Tareas con su Verify, Done).

La spec debe tener exactamente estas secciones:

```md
# <Nombre de la feature>

## Contexto
- Qué existe hoy (stack, carpetas) que debes respetar.
- Patrones a seguir (nombra un archivo del repo que ya lo hace bien).
- Decisiones ya tomadas (para no re-discutirlas).

## Objetivo
El resultado concreto y acotado. Una frase, no "mejorar X".

## Flujo
Diagrama de SECUENCIA. Por defecto entrega la versión **comprimida** (lista ordenada de pasos); solo si el usuario pide el detalle, dale la **completa** con lifelines.

Comprimida (default):
```
SECUENCIA (orden temporal ↓)
1. Actor → Componente: acción
2. Componente → OtroComp: llamada()
3. OtroComp → Componente: retorno
4. Componente → Actor: respuesta
```
Completa (solo si la piden) — cada participante con su lifeline vertical (`│`), el tiempo hacia ABAJO; llamadas flecha sólida (`──▶`), retornos punteada (`◀ ─ ─`):
```
Actor      Componente      OtroComp
  │             │              │
  │  acción     │              │
  │────────────▶│              │
  │             │  llamada()   │
  │             │─────────────▶│
  │             │◀ ─ retorno ─ │
  │◀─ respuesta │              │
  ▼             ▼              ▼
```
Diagrama de FLUJO (las decisiones y ramas — acá viven los casos borde):
```
 entrada
    │
    ▼
 ¿condición? ──no──▶ rama A
    │ sí
    ▼
 acción ──▶ resultado
```

## Restricciones
- Qué NO tocar (auth, modelo de datos, contratos de API).
- Sin dependencias nuevas salvo que sea necesario y justificado.

## Fuera de alcance
- Lo que NO va en esta feature.

## Tareas
### T1: <título corto>
- **Hacer:** <cambio específico>
- **Archivos:** <rutas que tocará>
- **Verify:** <comando o check manual específico>

### T2: ...

## Done (validación final)
- [ ] <comando build/test pasa>
- [ ] Manual: <qué revisar end-to-end>
```

Reglas al escribirla:
- **Flujo primero, confirmación obligatoria:** los dos diagramas se generan ANTES de las tareas y el usuario los aprueba. El diagrama de flujo debe mostrar cada decisión y caso borde (qué pasa si no hay datos, límites de tiempo, doble ejecución). Si el usuario corrige el flujo, ajusta los diagramas y vuelve a confirmar antes de seguir.
- **Tareas pequeñas:** cada una en una sesión, < ~3 archivos, segura de commitear sola. Si una tarea puede chocar con el límite de contexto, pártela.
- **Verify de verdad:** prefiere un comando sobre revisión manual; el manual debe ser específico ("clic en X, se ve Y"), no "verificar que funciona".

Al terminar, hazte el test de completitud: *¿un agente nuevo, sin más contexto que esta spec, podría implementar T1?* Si no, falta detalle.
