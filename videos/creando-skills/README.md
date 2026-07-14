# Cómo crear un Skill útil para Claude Code y Codex

> Un skill convierte un proceso que repites en un workflow reutilizable, con instrucciones, criterios y recursos que un agente puede ejecutar y verificar.

---

## El problema

Cada vez que terminas una feature vuelves a pedir lo mismo: revisa el cambio, corre las pruebas y demuestra que funciona. A veces el agente ejecuta todo; otras veces responde que el cambio "se ve bien" sin mostrar evidencia.

El problema no es que falte otro prompt. Falta capturar el proceso y definir cómo se ve un resultado aceptable.

## Qué es un skill

Un skill no es **solamente** un prompt guardado. Es un paquete reutilizable que puede contener:

- `SKILL.md`: metadatos e instrucciones del workflow.
- `scripts/`: operaciones deterministas o repetitivas.
- `references/`: documentación que el agente consulta cuando la necesita.
- `assets/`: templates, ejemplos y otros recursos de salida.

En su forma mínima, un skill es una carpeta con un `SKILL.md`:

```text
prove/
└── SKILL.md
```

Regla práctica: **si repites un proceso y puedes reconocer objetivamente un buen resultado, es candidato a skill.**

## Anatomía y progressive disclosure

```text
prove/
├── SKILL.md
│   ├── name          identificador
│   ├── description   qué hace y cuándo es relevante
│   └── cuerpo        workflow, límites y formato de salida
├── scripts/          opcional
├── references/       opcional
└── assets/           opcional
```

Claude Code y Codex conocen inicialmente el nombre y la `description` de los skills disponibles. Cuando seleccionan uno, cargan el cuerpo de `SKILL.md` y consultan sus recursos según sea necesario. Este patrón se llama **progressive disclosure**.

La distinción importante es:

- La `description` ayuda al agente a **descubrir** cuándo un skill es relevante.
- El cuerpo, los ejemplos y los recursos determinan la **calidad de la ejecución**.

Un skill puede ser descubierto correctamente y producir un mal resultado. También puede estar bien escrito y no ser seleccionado implícitamente en una ejecución concreta. Son problemas distintos y se prueban por separado.

## Las 4 preguntas

Antes de escribir una línea, responde:

1. **¿Qué hace exactamente?** Define un trabajo concreto, no "ayuda con el código".
2. **¿Cuándo aplica?** Anota las situaciones y frases reales con las que pedirías ese trabajo.
3. **¿Cómo se ve un buen output?** Define evidencia, formato y criterios observables.
4. **¿Cómo lo pruebo?** Incluye un caso normal, uno que falla y uno fuera de alcance.

Las cuatro preguntas son el método. `SKILL.md` es donde aterrizan las respuestas.

## Ejemplo real: `prove`

El ejemplo de este tutorial es [`prove`](skill/prove/SKILL.md). Es el único skill que se crea y utiliza en la demo.

La carpeta [`demo/`](demo) contiene el repo mínimo usado en pantalla: una spec, una implementación CSV, tres tests y comandos para recuperar los estados inicial y final de la grabación.

La demo define un contrato explícito entre la spec y el skill:

```md
### T1: Nombre de la tarea
- **Verify:** `comando o check`
```

- El prompt entrega la ruta de la spec y el ID de la tarea.
- La tarea contiene exactamente un campo literal `Verify`.
- Un valor en código inline representa un comando ejecutable.
- Si el campo falta, se repite o es ambiguo, `prove` no inventa una verificación.

`Verify` no es una palabra reservada de Claude Code o Codex. Es una convención documentada por esta spec y consumida por este skill.

El trabajo de `prove` es acotado:

1. Leer la tarea implementada.
2. Encontrar su paso `Verify`.
3. Ejecutar el comando o check definido.
4. Mostrar la salida real.
5. Devolver `PASA` o `NO PASA` sin inventar evidencia.

Su `description` define el alcance:

```yaml
---
name: prove
description: Verifica que una tarea quedó realmente lista corriendo su paso Verify y mostrando la salida real, sin autoreporte. Úsala después de implementar una tarea, cuando se quiera comprobar que funciona de verdad y no solo que el agente lo afirme.
---
```

El cuerpo define cómo ejecutar la verificación, qué hacer si falla y qué formato debe tener el resultado.

## Plantilla mínima

```md
---
name: <nombre-en-kebab-case>
description: <Qué hace>. Usar cuando <situaciones y solicitudes concretas>. No usar para <casos fuera de alcance>.
---

# <Nombre del skill>

## Objetivo
Qué produce, en una frase verificable.

## Workflow
1. <Paso observable>
2. <Decisión y criterio>
3. <Resultado y evidencia>

## Reglas
- No inventar información ni resultados.
- <Regla que evita el error más frecuente del proceso>.

## Formato de salida
<Ejemplo concreto de un resultado aceptable>.
```

Escribe el cuerpo en imperativo: "lee", "ejecuta", "comprueba", "no modifiques". Empieza con el mínimo proceso útil y agrega reglas cuando el uso real revele una brecha.

## Dónde vive

| Herramienta | Proyecto | Global |
|---|---|---|
| Claude Code | `.claude/skills/<nombre>/SKILL.md` | `~/.claude/skills/<nombre>/SKILL.md` |
| Codex | `.agents/skills/<nombre>/SKILL.md` | `~/.agents/skills/<nombre>/SKILL.md` |

Los skills específicos de un repo deben vivir en el proyecto. Los que reutilizas entre repos pueden vivir globalmente.

Si usas ambas herramientas, puedes mantener una fuente canónica y crear symlinks hacia las carpetas que descubre cada una.

## Cómo invocarlo

### Explícitamente

Usa esta opción primero para probar el workflow sin mezclarlo con el problema de descubrimiento:

- Claude Code: `/prove`.
- Codex: `$prove` o selección mediante `/skills`.
- En lenguaje natural: "usa el skill prove para verificar la tarea T1".

Si fue seleccionado pero ejecutó mal el trabajo, revisa el cuerpo, los ejemplos, los recursos y los permisos disponibles.

### Implícitamente

También puedes pedir la tarea sin nombrar el skill. El agente puede seleccionarlo cuando la solicitud coincide con su `description`.

La selección implícita es probabilística: una buena `description` mejora el descubrimiento, pero no garantiza que el skill se use en cada ejecución. Cuando aplicar el workflow es obligatorio, invócalo explícitamente o define una orquestación que controle la secuencia.

## Cómo probarlo

Prueba ejecución y descubrimiento por separado.

### 1. Ejecución controlada

Invoca el skill explícitamente:

- **Caso normal:** produce el resultado y la evidencia esperados.
- **Caso que falla:** conserva el error real y no declara éxito.
- **Caso límite:** declara incertidumbre o bloqueo en vez de inventar.

### 2. Descubrimiento implícito

En una sesión nueva:

- Pide una tarea claramente dentro del alcance sin nombrar el skill.
- Prueba varias formulaciones reales, no una frase diseñada para la demo.
- Pide una tarea fuera de alcance y comprueba que el skill no interfiera.

Si no lo descubre, revisa ubicación, frontmatter, claridad y límites de la `description`. Si necesitas garantizar el proceso, vuelve a la invocación explícita.

## Ciclo de mejora

```text
escribir -> invocar -> observar evidencia -> corregir una brecha -> repetir
```

- ¿No se cargó? Revisa ubicación y frontmatter.
- ¿No fue descubierto? Revisa alcance y términos de la `description`.
- ¿Omitió un paso? Agrega una regla o referencia.
- ¿Inventó un resultado? Exige evidencia observable.
- ¿Entregó un formato inconsistente? Agrega un ejemplo real.
- ¿Se activó fuera de alcance? Acota la `description`.

Un skill mejora con trabajo real, no intentando anticipar todos los casos en el primer borrador.

## Quick start

1. Elige un proceso repetitivo con un resultado evaluable.
2. Responde las cuatro preguntas.
3. Crea el skill en la ruta de Claude Code o Codex.
4. Invócalo explícitamente y prueba un caso normal y uno que falla.
5. Corrige el cuerpo hasta que la ejecución sea consistente.
6. En una sesión nueva, prueba el descubrimiento implícito y un caso fuera de alcance.
7. Si el workflow es obligatorio, mantenlo explícito u orquestado.

---

> La demo reproducible y el skill `prove` terminado están en esta carpeta. La versión extendida de esta guía está en **El Diario de Filemón**. Más recursos y casos reales en **IA en Producción**: https://www.skool.com/ia-en-produccion-3264
