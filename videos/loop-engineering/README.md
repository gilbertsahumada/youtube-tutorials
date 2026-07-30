# Loop Engineering con Claude Code y Codex

> Loop Engineering no es escribir un `while`. Es decidir qué inicia la siguiente vuelta, qué
> información sobrevive y quién tiene autoridad para decir que el trabajo terminó.

Claude Code y Codex ya ejecutan un loop interno durante cada turno: leen, editan, prueban y corrigen.
Este tutorial trata del loop externo, el que conecta varios turnos, ejecuciones o momentos.

```text
observar el estado
  -> elegir la siguiente acción
  -> ejecutar
  -> verificar
  -> continuar, detenerse o escalar
```

No existe una única herramienta llamada "Loop Engineering". Hay mecanismos distintos porque no
todos los problemas necesitan que la siguiente vuelta empiece por la misma razón.

## La pregunta que separa los loops

**¿Qué inicia la siguiente vuelta?**

| Tipo | La siguiente vuelta empieza cuando | Se detiene cuando | Mecanismo |
|---|---|---|---|
| Convergencia | termina el turno anterior | se cumple una condición | `/goal`, Stop hook |
| Temporal | pasa un intervalo | lo detienes o cambia el estado externo | Claude Code `/loop` |
| Programado | llega una fecha u horario | lo define la tarea | Scheduled Tasks, Routines |
| Evento | ocurre algo en otro sistema | se resuelve el evento | CI, GitHub Actions, webhooks |
| Backlog | queda trabajo pendiente | la cola queda vacía | skill, script, SDK, supervisor |

La cadencia, los worktrees, las skills, MCP y los subagentes pueden formar parte de un loop, pero no
son el loop por sí solos. Son decisiones de implementación.

## Las preguntas de diseño

Antes de automatizar, responde:

1. ¿Qué dispara la siguiente vuelta?
2. ¿Cuál es el objetivo o la fuente de trabajo?
3. ¿Qué estado persiste?
4. ¿Quién ejecuta?
5. ¿Qué evidencia verifica el resultado?
6. ¿Cuándo se detiene, se bloquea o pide ayuda?
7. ¿Qué puede tocar y dónde queda aislado?

Este marco no es una taxonomía oficial de Anthropic u OpenAI. Es una forma práctica de revisar un
loop antes de dejarlo trabajando sin supervisión.

## La demo principal: converger hasta una condición

La demo es una aplicación real y pequeña que exporta pedidos a CSV. La exportación está rota:

```csv
id,customer,total,status,created_at
ORD-001,Acme Norte,1299.5,paid,2026-07-14T14:35:00.000Z
ORD-002,Cafe "Central", SpA,89,pending,2026-07-15T09:10:00.000Z
ORD-003,Distribuidora Sur,450.75,refunded,2026-07-16T18:05:00.000Z
```

La segunda fila queda con seis campos donde deberían existir cinco. El dinero usa uno, cero y dos
decimales. La fecha incluye hora y milisegundos. Además, el navegador abre el archivo en vez de
descargarlo.

El estado correcto vive en
[`demo/docs/product/export-orders.md`](demo/docs/product/export-orders.md), y la comprobación
mecánica es:

```bash
npm run verify
```

En el estado inicial, la ejecución registrada produce:

```text
tests 4
pass 1
fail 3
```

La demo no promete cuántos turnos utilizará el agente. Eso es probabilístico. La promesa es otra:
la tarea solo se considera terminada cuando la misma verificación pasa.

## Preparar la demo

```bash
git clone https://github.com/gilbertsahumada/youtube-tutorials.git
cd youtube-tutorials/videos/loop-engineering/demo
npm run verify
```

Si el resultado inicial no termina con `pass 1` y `fail 3`, no continúes. Restaura la demo:

```bash
npm run demo:reset
```

El script avisa qué archivos va a restaurar antes de descartar cambios.

## Opción 1: `/goal`

Usa `/goal` cuando el trabajo debe continuar inmediatamente hasta alcanzar una condición verificable.

Abre Claude Code o Codex dentro de `videos/loop-engineering/demo` y pega exactamente:

```text
/goal La exportación a CSV está fallando: abro el archivo en Excel y hay una fila donde los datos no calzan con las columnas. Arréglalo hasta que npm run verify termine con exit code 0. No modifiques tests, datos de ejemplo ni documentación. Si después de 10 turnos sigue fallando, detente y explica el bloqueo con la última salida real.
```

El objetivo contiene cuatro cosas:

| Parte | Texto |
|---|---|
| Síntoma | una fila no calza con las columnas |
| Estado final | la exportación queda arreglada |
| Evidencia | `npm run verify` termina con exit code 0 |
| Límite | 10 turnos, sin modificar tests, datos o documentación |

En Claude Code, un evaluador separado revisa después de cada turno la evidencia que Claude dejó en la
conversación. Si la condición todavía no se demuestra, abre otro turno. El evaluador no ejecuta
comandos ni lee archivos por su cuenta.

En Codex, el texto del goal funciona como primer prompt y criterio de finalización del trabajo. El
goal se puede pausar, editar y continuar desde el mismo chat.

No afirmamos que ambas implementaciones internas sean idénticas. Lo que comparten es el caso de uso:
trabajo largo con un final explícito.

Al terminar, comprueba fuera del agente:

```bash
npm run verify
git diff --name-only -- src
```

La verificación debe mostrar:

```text
tests 4
pass 4
fail 0
```

El diff solo debe incluir:

```text
src/csv.js
src/server.js
```

El número de turnos y la solución concreta pueden cambiar entre ejecuciones.

## Opción 2: Stop hook mecánico

`/goal` evalúa una condición de alto nivel. Un Stop hook puede ejecutar el árbitro real justo cuando
el agente intenta terminar.

Esta demo incluye un hook compatible con Claude Code y Codex:

```text
demo/scripts/stop-until-verified.mjs
```

El hook:

1. Ejecuta `npm run verify`.
2. Si pasa, permite que el agente termine.
3. Si falla, bloquea el cierre y devuelve la salida real como nueva instrucción.
4. Si ya produjo una continuación, permite detenerse para evitar un loop infinito.

Los ejemplos no están activos por defecto. Copia solo el de la herramienta que estés usando.

### Claude Code

```bash
mkdir -p .claude
cp examples/claude-settings.json .claude/settings.json
```

Reinicia Claude Code y revisa el hook antes de aceptar su ejecución.

### Codex

```bash
mkdir -p .codex
cp examples/codex-hooks.json .codex/hooks.json
```

Abre Codex, ejecuta `/hooks` y confía la definición después de revisarla.

Luego usa un prompt normal:

```text
La exportación a CSV está fallando: abro el archivo en Excel y hay una fila donde los datos no calzan con las columnas. Arréglalo y verifica que quede bien.
```

La diferencia se ve al final:

```text
el agente intenta terminar
  -> Stop hook ejecuta npm run verify
  -> si falla, devuelve evidencia y abre una continuación
  -> si pasa, permite terminar
```

Para varias vueltas autónomas, usa `/goal`. El Stop hook de esta demo bloquea una vez por seguridad.
Su trabajo es mostrar una verificación mecánica, no construir un loop infinito escondido.

## Opción 3: `/loop` en Claude Code

`/loop` sirve cuando el siguiente intento debe esperar. No es la herramienta correcta para reparar
esta exportación, porque no hay ninguna razón para dormir cinco minutos entre correcciones.

Sí es correcto para vigilar un sistema externo:

```text
/loop 5m revisa el PR actual. Si CI terminó, resume el resultado. Si hay un fallo nuevo, diagnostícalo. No modifiques ni publiques nada sin una tarea accionable.
```

La sesión debe seguir disponible. El prompt vuelve a ejecutarse por tiempo, aunque el turno anterior
ya hubiera terminado correctamente.

Comparación:

```text
/goal  -> continúa porque todavía no se demostró el estado final
/loop  -> continúa porque pasó el intervalo
```

## Opción 4: Scheduled Tasks

Usa una tarea programada cuando el trabajo debe regresar después, sin depender de una sesión abierta.

Ejemplo para ChatGPT/Codex Desktop:

```text
Cada 15 minutos, revisa el PR asociado a este proyecto.

1. Lee el estado de CI y los comentarios nuevos.
2. Si no hay nada accionable, reporta el estado y termina esta ejecución.
3. Si hay un fallo o comentario accionable, trabaja en un worktree aislado.
4. Ejecuta las verificaciones del repositorio.
5. Resume lo que cambió, la evidencia y cualquier bloqueo.
6. No hagas merge y no publiques cambios sin autorización explícita.
```

En un repositorio Git, selecciona un worktree aislado para no mezclar la tarea con cambios locales.
Una tarea creada dentro de un chat puede volver al mismo contexto. Una tarea independiente empieza
cada ejecución desde el prompt guardado.

Para archivos locales, el computador debe permanecer encendido y la aplicación ejecutándose. La
interfaz de Scheduled Tasks está en ChatGPT Desktop o web, no en Codex CLI.

Claude ofrece tres variantes según dónde deba vivir la tarea:

- `/loop`, para polling rápido dentro de la sesión actual.
- Desktop scheduled tasks, para archivos locales sin mantener una sesión abierta.
- Routines, para ejecución durable en infraestructura de Anthropic.

## Opción 5: loop personalizado

Un controlador propio sigue teniendo sentido cuando necesitas una cola dinámica, presupuestos,
reintentos, varios ejecutores o integración con sistemas que las herramientas nativas no cubren.

Puedes construirlo con:

- `claude -p`;
- `codex exec`;
- Claude Agent SDK;
- Codex SDK;
- GitHub Actions;
- un script o servicio supervisor.

Ese es el último escalón, no el primero. Si `/goal`, un hook o una tarea programada resuelven el
problema, mantener un orquestador propio añade código sin añadir control útil.

## Qué opción elegir

| Necesidad | Opción |
|---|---|
| Trabajar sin pausas hasta demostrar un resultado | `/goal` |
| Impedir que el agente termine con una comprobación fallando | Stop hook |
| Esperar CI, un deployment o feedback externo | Claude Code `/loop` |
| Volver cada cierto tiempo sin una sesión abierta | Scheduled Task o Routine |
| Reaccionar inmediatamente a un evento del repositorio | GitHub Actions o webhook |
| Controlar una cola, varios agentes y políticas propias | SDK o controlador personalizado |

## Restaurar

El reset descarta cambios de implementación en `src/` y configuraciones temporales de hooks:

```bash
npm run demo:reset
```

No restaura tests, documentación ni configuración base. Si detecta cambios rastreados en esas rutas,
sale con error y muestra los archivos para que los revises.

Después comprueba otra vez:

```bash
npm run verify
```

Debe volver a:

```text
tests 4
pass 1
fail 3
```

## Fuentes oficiales

- [Claude Code: `/goal`](https://code.claude.com/docs/en/goal)
- [Claude Code: `/loop` y tareas programadas](https://code.claude.com/docs/en/scheduled-tasks)
- [Claude Code: hooks](https://code.claude.com/docs/en/hooks-guide)
- [Codex: long-running work y `/goal`](https://learn.chatgpt.com/docs/long-running-work)
- [Codex: Scheduled Tasks](https://learn.chatgpt.com/docs/automations)
- [Codex: hooks](https://learn.chatgpt.com/docs/hooks)
- [Anthropic: effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [OpenAI: Harness Engineering](https://openai.com/index/harness-engineering/)

## Idea central

El harness prepara el entorno de una ejecución. El loop decide cómo se conectan las ejecuciones.

Antes de automatizar, no preguntes solamente "¿qué prompt repito?". Pregunta:

> ¿Qué inicia la siguiente vuelta y qué evidencia tiene autoridad para detenerla?
