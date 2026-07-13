# Cómo crear un Skill (que sí se activa)

> Un skill no es un prompt guardado. Es un **proceso empaquetado** para que un agente ejecute una tarea igual de bien todas las veces, sin que se lo expliques de nuevo.

---

## El problema

Instalaste veinte skills y ninguno cambió nada: el agente ni los usa. O el otro lado de la misma moneda: repites los mismos prompts todos los días ("documenta esto", "revisa este código", "hazme un resumen") y cada vez obtienes un resultado distinto, porque cada vez lo escribes ligeramente diferente, omites detalles, o el agente interpreta otra cosa.

Prompt único, calidad de prompt único. A veces excelente, a veces mediocre.

## Qué es (y qué no)

Un skill es una carpeta con un archivo `SKILL.md` adentro. Eso es todo: sin plugins, sin frameworks, sin configuración rara. Pero la diferencia con un prompt guardado es de fondo:

| | Prompt guardado | Skill |
|---|---|---|
| Dice | "así se **empieza**" | "así se hace este trabajo **de principio a fin**" |
| Define | un punto de partida | el proceso, el buen resultado, el malo, y qué hacer cuando algo sale mal |
| Es como | un practicante al que le explicas todo cada vez | un profesional entrenado en lo que hace |

Regla práctica: **si te ves haciendo lo mismo tres veces, eso es un skill.**

## La anatomía

Un `SKILL.md` tiene tres partes, y solo una decide si se activa:

```
┌─ SKILL.md ────────────────────────────────────────────┐
│ ---                                                    │
│ name: <kebab-case>          ← el identificador         │
│ description: <qué + cuándo> ← EL DISPARADOR (~100 tok, │
│ ---                            siempre cargado)        │
│                                                        │
│ # Instrucciones              ← el proceso (< 5000 tok, │
│ pasos, reglas, ejemplos         se carga SOLO cuando   │
│ de output, edge cases           el skill se activa)    │
│                                                        │
│ scripts/ references/ assets/ ← recursos opcionales,    │
│                                 se cargan si se usan   │
└────────────────────────────────────────────────────────┘
```

El agente **no lee el cuerpo para decidir si usa el skill**. Y no es capricho: es economía de contexto. Lo único que vive siempre en el contexto es el `name` y la `description` (~100 tokens); el cuerpo se carga recién cuando el skill se activa. Por eso puedes tener muchos skills instalados sin quemar contexto — y por eso una description vaga es un skill muerto: existe, pero nunca se activa.

## La regla que lo resume todo

**La description es el disparador.** Tiene que decir tres cosas:

1. **QUÉ** hace (específico, no "ayuda con el código").
2. **CUÁNDO** usarlo (las frases que tú realmente escribirías para pedirlo).
3. **Cuándo NO** usarlo (para que no se active donde no toca).

Test rápido: si tu description dice "ayuda con documentación", está mal. Si dice "crea documentación técnica en Markdown; úsala cuando pidan documentar un archivo, módulo o generar un README; NO usarla para posts de marketing", esa sí se activa.

> ⚠️ Detalle traicionero: en el YAML, si la description contiene dos puntos seguidos de espacio (`: `) o comillas sin escapar, **rompe el frontmatter completo y el skill ni siquiera carga**. Reescribe con comas o paréntesis.

## Las 4 preguntas (antes de escribir una línea)

1. **¿Qué hace exactamente?** Si no puedes describir el trabajo, el agente tampoco puede hacerlo.
2. **¿Cuándo se gatilla?** Escribe las frases REALES que tú dirías para pedirlo. Esas frases van directo a la description.
3. **¿Cómo se ve un buen output?** Un ejemplo concreto del resultado esperado. Un ejemplo real vale más que cincuenta líneas de instrucciones vagas.
4. **¿Cómo lo pruebo?** Con qué input debería funcionar, con cuál podría fallar, y con cuál NO debería activarse.

Las 4 preguntas SON el método. El archivo es solo donde aterrizan.

## La plantilla

```md
---
name: <nombre-en-kebab-case>
description: <Qué hace, en una frase específica>. Úsala cuando <frases gatillo reales, ej. "documenta este archivo", "genera un README">. NO usarla para <casos fuera de alcance>.
---

# <Nombre del skill>

## Objetivo
Qué produce este skill, en una frase.

## Workflow
1. <Paso observable: qué revisar>
2. <Paso: qué decidir y con qué criterio>
3. <Paso: cómo entregar el resultado>

## Reglas
- No inventar lo que no se pueda inferir; si algo es incierto, decirlo explícitamente.
- <Regla que evita tu error más frecuente>

## Ejemplo de output
<El formato exacto que aceptas como bueno. Pega uno real.>
```

Escribe el cuerpo en **imperativo**: "lee esto", "corre aquello", "no toques lo otro". Un skill bueno es mandón: le quita ambigüedad al agente. Y no partas extenso — el skill crece con el ciclo de mejora, no en el primer borrador.

## Dónde vive

No es la misma carpeta en cada herramienta:

| Herramienta | Proyecto | Global |
|---|---|---|
| Claude Code | `.claude/skills/<nombre>/SKILL.md` | `~/.claude/skills/<nombre>/SKILL.md` |
| Codex | `.agents/skills/<nombre>/SKILL.md` | `~/.agents/skills/<nombre>/SKILL.md` |

La regla para elegir alcance es la misma en ambas: al **proyecto** van los skills específicos de un repo; a **global** los que usas todos los días, en cualquier proyecto.

Si trabajas con varios agentes, guarda los skills en **un solo lugar** y enlázalos (symlink) a la carpeta de cada uno — las dos herramientas siguen symlinks: editas una vez, se actualiza en todos.

## Las 3 formas de invocarlo

1. **Indirecta** — el agente matchea tu pedido con la description y lo activa solo. Es la que quieres que funcione.
2. **Explícita** — lo nombras en el prompt: "usa el skill de documentación para esto".
3. **Directa** — en Claude Code: `/nombre-del-skill`. En Codex: lo referencias con `$nombre-del-skill` o abres el picker con `/skills`.

Si un skill debería haberse activado solo y no lo hizo, invócalo a mano para salir del paso — pero anota: es señal de que la description hay que mejorarla. Y separa las dos fallas posibles: si **no se activa**, el problema es la description o la ubicación; si **se activa pero el resultado sale malo**, el problema está en el cuerpo (instrucciones o ejemplos).

Y no todo lo escribes tú: hay skills de la comunidad y oficiales en [github.com/anthropics/skills](https://github.com/anthropics/skills), [skills.sh](https://skills.sh) y [agentskills.io](https://agentskills.io). Pégale la URL al agente y pídele que lo instale.

## Cómo probarlo

Un skill se trata como software, no como un prompt bonito que quedó listo para siempre.

- **La prueba de fuego:** pide la tarea **sin nombrar el skill**. Si la description está bien escrita, tiene que entrar solo.
- **La otra mitad (la que nadie hace):** pide algo que NO debería activarlo y comprueba que no entra. Un skill que se activa cuando no toca es tan malo como uno que nunca se activa: la description quedó demasiado amplia. Y como la activación es probabilística, prueba varias frases (positivas y negativas), no una sola vez.
- **Caso feliz:** el input normal que representa el 80% del uso.
- **Caso límite:** input incompleto o ambiguo. Aquí quieres que el skill declare la incertidumbre, no que invente.
- **Stress:** la versión grande y desordenada de la tarea, para ver si escala.

## El ciclo de mejora

```
     escribir ──▶ usar en trabajo REAL ──▶ ¿falló?
        ▲                                    │
        │            sí: cada falla ─────────┘
        └──────── es UNA regla o UNA frase
                  gatillo que le faltaba
```

- ¿Omitió algo relevante? → agrega una regla.
- ¿Inventó comportamiento? → agrega una regla.
- ¿Formato inconsistente? → agrega un ejemplo mejor.
- ¿Se activó cuando no debía? → acota la description.
- ¿No se activó cuando debía? → agrega frases gatillo.

Úsalo una semana en trabajo real (no en ejemplos inventados) y tendrás una versión mucho mejor que la inicial.

## Cuándo SÍ y cuándo no

- **No** empaquetes lo que haces una sola vez: eso se pide y ya.
- **Sí** cuando repites un proceso y siempre quieres el output con el mismo estándar.
- Pocos skills buenos le ganan a veinte a medias, siempre. No necesitas una biblioteca el día uno: parte con LA tarea más repetida, la más clara, la de output más fácil de evaluar.

## De un skill a una cadena

Un skill solo es una herramienta. Varios que se pasan el trabajo entre sí son un **sistema**: la description de cada uno dice cuándo entra, y por eso tienen límites compatibles y no se pisan.

El ejemplo vivo está en este mismo repo: [`spec-driven-development`](../spec-driven-development). Cinco skills forman el pipeline (`scope · exec · prove · audit · ship`) y `trace` es la herramienta auxiliar para entrar a código existente antes de tocarlo. `scope` entra cuando hay una idea, `exec` cuando ya existe la spec, `prove` después de implementar. Una tarea, una evidencia.

**El matiz de producción:** que el agente *pueda* elegirlos en orden es comportamiento probable, no una garantía. Si el orden es crítico, no lo dejes a la suerte: invoca cada etapa tú (`/scope` → `/exec` → `/prove` → `/audit` → `/ship`, como en el quick start de SDD) o define la secuencia en tu `CLAUDE.md` / `AGENTS.md` o en un skill orquestador.

## Quick start

1. Elige una tarea que repitas todas las semanas.
2. Responde las 4 preguntas (en serio, escríbelas).
3. Crea `.claude/skills/<nombre>/SKILL.md` con la plantilla de arriba.
4. Prueba de fuego: pide la tarea sin nombrar el skill.
5. Prueba negativa: pide algo fuera del caso de uso y verifica que NO entre.
6. Úsalo una semana en trabajo real; cada falla es una regla nueva.

---

> La versión extendida de esta guía (con un ejemplo completo de skill de documentación técnica) está escrita en mi blog **El Diario de Filemón**. Y por si quieres más (lives, casos reales, más prompts): la comunidad **IA en Producción** → https://www.skool.com/ia-en-produccion-3264
