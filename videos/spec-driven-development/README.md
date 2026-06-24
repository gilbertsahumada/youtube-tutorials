# Spec-Driven Development sin ceremonia

> Antes de pedirle código a un agente, defines qué vas a aceptar como "listo". No es una metodología pesada ni un framework: son **5 preguntas** que conviertes en un markdown corto.

---

## El problema

Le dices a un agente "agrega exportar reservas a CSV". Un minuto después tienes código. Pero no es lo que querías: columnas que no van, sin respetar permisos, una pantalla nueva que no pediste, una dependencia rara. Lo arreglas, se rompe otra cosa, y terminas desenredando **decisiones que nunca tomaste**.

Eso pasa cuando el agente está **adivinando** lo que querías.

## Qué es (y qué no)

En vez de tirarle la tarea vaga, escribes una **spec**: un documento corto que dice qué construyes, qué NO, y cómo se verifica. El agente deja de adivinar.

**Esto no es un PRD.** Cada documento tiene su audiencia:

| Documento | Para quién | Define |
|---|---|---|
| PRD | PMs / negocio | El valor de negocio |
| Design doc | Ingenieros | La arquitectura |
| **Spec (de agente)** | **El agente** | **Límites exactos + tareas** |

La spec lleva *algo* de por qué y cómo (lo justo para que el agente decida bien), pero no es un debate: es un **plan de ejecución**.

> **No es waterfall.** No tienes que saber todo al principio. Son 5 minutos y 15 líneas. Es un **boceto, no un plano**: implementas una tarea, revisas, y si algo estaba mal, vuelves y editas la spec.

## La regla que lo resume todo

**Una tarea, una evidencia.** La spec no es el documento: es **decidir qué aceptas como "listo" antes de que el agente toque código**.

## Las 5 preguntas

1. **¿Dónde estoy parado?** → **Contexto.** Qué ya existe (stack, carpetas, decisiones tomadas).
2. **¿Qué cambio exacto quiero?** → **Objetivo.** No "mejorar X". El resultado concreto.
3. **¿Qué NO puede tocar?** → **Restricciones + fuera de alcance.** Lo más importante: los agentes son ansiosos, acá los frenas.
4. **¿En qué pasos chicos se parte?** → **Tareas.** Cada una con sus archivos, ejecutable en una sesión.
5. **¿Qué prueba acepto?** → **Verificación.** La clave. Si una tarea no dice cómo se verifica, todavía es una opinión.

## El workflow

```
   scope          ┌─────────── repite por cada tarea ───────────┐
  (1 vez)         │                                             │
     │            ▼                                             │
     │     exec ──▶ prove ──▶ audit ──▶ ship ───────────────────┘
     │    (tarea)  (evidencia)(revisa) (commit)
     ▼
  ┌─────────────────────────────────────────────────────────┐
  │  LA SPEC · specs/<feature>.md                            │
  │  • Contexto       qué existe hoy y qué respetar          │
  │  • Objetivo       el resultado concreto + decisiones     │
  │  • Restricciones  qué NO tocar / fuera de alcance        │
  │  • Tareas         pasos chicos, cada uno con su Verify   │
  │  • Done           validación end-to-end                  │
  └─────────────────────────────────────────────────────────┘

  contexto fresco cada sesión · una tarea, una evidencia
```

Los 5 pasos, cada uno es un skill (carpeta [`skills/`](skills)):

| Skill | Hace |
|---|---|
| [`scope`](skills/scope/SKILL.md) | Convierte la idea en una spec (las 5 preguntas) |
| [`exec`](skills/exec/SKILL.md) | Implementa UNA tarea, nada más |
| [`prove`](skills/prove/SKILL.md) | Corre la prueba de la tarea y pega la evidencia real (no autoreporte) |
| [`audit`](skills/audit/SKILL.md) | Revisión senior del diff contra la spec (idealmente en un agente aparte) |
| [`ship`](skills/ship/SKILL.md) | Mensaje de commit que explica el porqué |

> `/prove` es la pieza que más sube la calidad: la verificación deja de ser "el agente dice que pasó" y pasa a ser **evidencia real corrida en un contexto independiente**.

## La plantilla

```md
# <Nombre de la feature>

## Contexto
- Qué existe hoy (stack, carpetas) que el agente debe respetar.
- Patrones a seguir (nombra un archivo que ya lo hace bien).
- Decisiones ya tomadas (para que no las re-discuta).

## Objetivo
El resultado concreto y acotado. Una frase, no "mejorar X".

## Restricciones
- Qué NO tocar (auth, modelo de datos, contratos de API).
- Sin dependencias nuevas salvo que sea necesario y justificado.

## Fuera de alcance
- Lo que el agente podría querer hacer de más y NO va acá.

## Tareas
### T1: <título>
**Hacer:** <cambio específico>
**Archivos:** <rutas>
**Verify:** <comando o check manual específico>

## Done (validación final)
- [ ] <comando build/test pasa>
- [ ] Manual: <qué revisar end-to-end>
```

Ejemplo lleno: [`ejemplos/exportar-reservas-csv.md`](ejemplos/exportar-reservas-csv.md).

## Cómo dimensionar tareas y escribir buenos `Verify`

- **Tarea:** una sesión, commit independiente. Si toca más de ~3 archivos o pasa de ~30 min, pártela. Contexto fresco por tarea evita que el agente se pierda.
- **Verify:** prefiere un comando sobre revisión manual. Si es manual, específico ("clic en Exportar, se descarga un .csv con 6 columnas"), no "verificar que funciona". Sin verificación, obtienes slop.

## Cuándo SÍ y cuándo abreviar

- **No** lo uses para scripts de una vez, prototipos de una tarde, o algo que botas mañana. Feature trivial (< 3 archivos): inline todo, 1-2 tareas. Bugfix: por qué + qué + una tarea.
- **Sí** cuando hay usuarios, permisos, datos, dinero, o una feature que vas a mantener.
- Regla personal: **mientras más permisos le das al agente, más concreta tiene que ser la spec.**

## No es nada nuevo

Esto es el ciclo de software de siempre. Lo único distinto es a quién le pasas las tareas:

```
TRADICIONAL  (equipos de software)
  Requisitos ─▶ Diseño ─▶ Tareas ─▶ Implementar ─▶ Revisar ─▶ Merge
     PRD       DesignDoc  Tickets     código         PR        main
  (humanos)    (humanos)  (humanos)   (humanos)     (humano)

SPEC-DRIVEN  (con agentes)
  Spec ───────────────▶ Tareas ─▶ Ejecutar ─▶ Verificar ─▶ Revisar ─▶ Commit
  contexto / objetivo   T1, T2…   exec        prove        audit      ship
  restricciones                   (agente)    (evidencia)  (humano)
  (para el agente)
```

Mismo proceso, distinta audiencia.

## FAQ

**"Claude Code ya tiene plan mode, ¿para qué archivos?"** El plan mode vive dentro de la sesión. Un archivo de spec es separado, limpio, versionable y compartible: se lo pasas a cualquier agente, en cualquier herramienta, dentro de seis meses. Usa plan mode para pensar; usa specs para ejecutar.

**"¿Y los frameworks (spec kit, OpenSpec, Kiro)?"** Para la mayoría de los casos son overkill: te llenan de carpetas y ceremonia. Un markdown en tu repo hace el trabajo. Empieza con un archivo; agrega complejidad cuando choques con un muro, no antes.

## Quick start

1. Copia los skills de [`skills/`](skills) a tu herramienta (ver abajo).
2. `/scope agregar exportar reservas a CSV desde el dashboard`
3. Revisa la spec generada. Que las decisiones sean tuyas.
4. `/exec specs/exportar-reservas-csv.md T1` → `/prove ... T1` → `/audit` → `/ship`.
5. Sesión fresca para T2. Repite.

> **Instalar los skills:** copia cada carpeta de `skills/` a `.claude/skills/<nombre>/` en tu proyecto (o a `~/.claude/skills/<nombre>/` para tenerlas globales). Claude Code las invoca solas según su `description`. Si prefieres invocarlas tú con `/nombre`, el mismo contenido sirve como command en `.claude/commands/<nombre>.md`.

---

> Por si quieres más (lives, casos reales, más prompts): la comunidad **IA en Producción** → https://www.skool.com/ia-en-produccion-3264
