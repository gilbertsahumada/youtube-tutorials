# Loop Engineering con Claude Code y Codex

## La pregunta que manda

Repetir un prompt no basta para diseñar un loop. Un loop útil tiene que responder tres preguntas:

1. ¿Qué debe provocar la próxima acción?
2. ¿Dónde debe sobrevivir el estado?
3. ¿Qué evidencia lo detiene?

Este proyecto responde las tres siguiendo un solo PR de principio a fin. No es un catálogo de
herramientas. Es una historia continua:

```text
bug visible
  -> PR con CI rojo
  -> /goal corrige lo que puede cambiar ahora
  -> push inicia CI otra vez
  -> /loop comprueba un estado externo
  -> una tarea durable puede volver cuando la sesión ya no existe
```

El ejemplo es un procesador de webhooks de facturación. Al principio procesa dos veces el mismo
evento, descarta un fallo temporal y trata un fallo permanente como una entrega exitosa.

## Antes de empezar

Necesitas:

- Git.
- GitHub CLI autenticado.
- Node.js 20 o superior.
- Claude Code con `/goal` y `/loop`.
- Permiso para crear una rama y un PR en este repositorio.

Clona el repositorio:

```bash
git clone https://github.com/gilbertsahumada/youtube-tutorials.git
cd youtube-tutorials
gh auth status
node --version
git status --short
```

La última salida debe estar vacía. Si muestra cambios, revísalos antes de continuar.

## 1. Mira primero el defecto

Crea la rama de la demo y entra en su directorio:

```bash
git switch -c demo/loop-engineering-recording
cd videos/loop-engineering/demo
npm run demo
```

La ejecución registrada muestra:

```text
Webhook delivery plan
evt_invoice_paid_01 -> deliver
evt_invoice_failed_02 -> drop
evt_invoice_failed_02 -> drop
evt_customer_invalid_03 -> deliver
```

El primer evento está bien, pero los otros revelan tres problemas:

- `evt_invoice_failed_02` aparece dos veces.
- El fallo temporal termina en `drop`, aunque debería reintentarse.
- El fallo permanente termina en `deliver`, aunque debería ir a revisión.

Estar bien significa procesar cada ID una vez, reintentar los fallos temporales y enviar los
permanentes a una cola de revisión.

Ejecuta la verificación:

```bash
npm run verify
```

Estado inicial registrado:

```text
tests 4
pass 1
fail 3
```

Este es el estado concreto que el agente debe cambiar. Todavía no necesitamos un loop temporal:
las pruebas ya fallaron y el código puede corregirse inmediatamente.

## 2. Lleva el mismo rojo a GitHub

Prepara un cambio neutro para abrir el PR sin arreglar el worker:

```bash
npm run demo:prepare
git add RUN.md
git commit -m "demo: start loop engineering run"
git push -u origin demo/loop-engineering-recording
gh pr create --draft \
  --title "Demo: repair webhook delivery policy" \
  --body "Reproducible run for the Loop Engineering tutorial."
```

`demo:prepare` exige un árbol limpio y crea `RUN.md`. El workflow solamente se activa en ramas con
el prefijo `demo/loop-engineering-`, así que el estado roto puede existir en el PR sin dejar rojo
cada cambio documental del repositorio.

Abre la URL que devuelve `gh pr create`. El check `Loop Engineering demo / webhook-delivery` debe
fallar. Ahora el mismo problema existe en dos lugares:

- El código local puede cambiar en este momento.
- GitHub Actions cambia fuera de tu computador y necesita tiempo.

Esa diferencia determina qué debe iniciar la próxima vuelta.

## 3. Momento 1: actuar ahora con `/goal`

Usa `/goal` cuando falta un resultado y el agente puede seguir trabajando inmediatamente. No lo
uses para esperar que cambie un sistema externo.

Abre Claude Code dentro de `videos/loop-engineering/demo` sin cargar hooks ni plugins globales:

```bash
claude --setting-sources project,local
```

Pega exactamente esta condición:

```text
/goal Este worker está procesando dos veces el mismo webhook, descarta un fallo temporal y trata un fallo permanente como entrega exitosa. Corrígelo hasta que npm run verify termine con exit code 0. No modifiques tests, eventos de ejemplo ni documentación. No hagas commit, push ni merge. Si te bloqueas, detente y conserva la última salida real.
```

La condición contiene cuatro piezas:

- El resultado observable.
- La comprobación que demuestra el resultado.
- Los archivos y acciones fuera de alcance.
- Una salida explícita si el agente queda bloqueado.

En Claude Code, un evaluador separado revisa después de cada turno la evidencia de la conversación.
Si todavía falta el resultado, inicia otro turno. En la corrida registrada terminó en un turno, pero
la cantidad puede variar.

Cuando termine, comprueba el resultado fuera del agente:

```bash
npm run demo
npm run verify
git diff --name-only
```

La solución mínima validada produce:

```text
Webhook delivery plan
evt_invoice_paid_01 -> deliver
evt_invoice_failed_02 -> retry
evt_customer_invalid_03 -> dead-letter
```

Y la verificación termina con:

```text
tests 4
pass 4
fail 0
```

La corrida registrada modificó solamente `src/delivery.js`. Tu agente puede tomar otro camino, así
que mira el diff real antes de continuar.

En este punto `/goal` debe detenerse. El estado local ya está demostrado y otra vuelta inmediata no
aportaría nada.

## 4. El estado cambia y el loop también

Publica la corrección:

```bash
git add src/delivery.js
git commit -m "fix: make webhook delivery idempotent"
git push
```

El goal no hizo el commit ni el push porque no tenía esa autoridad. El push inicia un nuevo workflow
en GitHub. Ahora el agente ya no tiene código demostrado por corregir: tiene que esperar que un
sistema externo termine.

## 5. Momento 2: esperar afuera con `/loop`

Dentro de la misma sesión de Claude Code:

```text
/loop Revisa el PR asociado a la rama actual. Si CI sigue ejecutándose, informa el estado y vuelve a revisar. Si termina, resume el resultado y detén este loop. No modifiques archivos, no hagas push y no hagas merge.
```

Aquí la próxima vuelta comienza porque pasa tiempo, no porque el turno anterior dejó trabajo de
código pendiente.

Sin intervalo explícito, Claude puede elegir cuándo volver a comprobar. También puedes fijarlo:

```text
/loop 5m revisa el PR asociado a la rama actual y detente cuando CI termine
```

El intervalo debe corresponder al sistema observado. Esperar cinco minutos por un workflow que dura
segundos solo hace la demo y el sistema más lentos.

En la corrida E2E registrada, el workflow principal pasó en 11 segundos. Cuando `/loop` consultó por
primera vez, los cinco checks del PR ya habían terminado. Informó el resultado y se detuvo sin una
segunda consulta.

Eso no es un fallo de la demo. El loop comprobó su condición y descubrió que ya debía parar. No
afirmes que hizo polling si el estado externo terminó antes de la primera revisión.

## 6. Momento 3: sobrevivir a la sesión

`/goal` y `/loop` resuelven disparadores diferentes, pero ambos viven dentro de la conversación:

- `/goal` vuelve cuando termina un turno y todavía falta evidencia.
- `/loop` vuelve cuando pasa tiempo y la sesión sigue disponible.

Para revisar este PR dentro de unos minutos, `/loop` es suficiente. Para limpiar un backlog mañana o
reaccionar a un evento de GitHub después de cerrar la sesión, necesitas una ejecución durable.

Elige según dónde debe vivir el trabajo:

- Una tarea de escritorio cuando necesita archivos y herramientas de tu computador.
- Una rutina cloud cuando debe ejecutarse sin tu computador y puede trabajar sobre un clon limpio.
- GitHub Actions o un controlador cuando un evento, una API o una cola debe iniciarlo.

La frontera importante no es el nombre del producto. Es si cerrar la conversación debe matar o no el
trabajo pendiente.

## 7. El mismo criterio en Codex

Claude Code y Codex cubren necesidades parecidas, pero no tienen una traducción literal:

- Ambos ofrecen un goal asociado al trabajo de la conversación.
- Claude Code documenta `/loop` en la CLI.
- Codex no documenta un comando `/loop` equivalente. Para volver por tiempo, usa una Scheduled Task.
- Una tarea dentro del chat conserva ese contexto; una tarea standalone empieza una ejecución nueva.

Un prompt equivalente para observar el PR en Codex sería:

```text
Cada 5 minutos, revisa el PR asociado a este proyecto.

Si CI sigue ejecutándose, informa el estado y termina esta ejecución.
Si CI terminó, resume el resultado y pausa esta tarea.
No modifiques archivos, no hagas push y no hagas merge.
```

No intentes demostrar Claude y Codex esperando el mismo check. Cuando la primera herramienta consume
la transición de CI, la segunda ya no puede observarla otra vez. Compara el mecanismo sin fingir una
segunda espera.

### ¿Y un Stop hook?

Un Stop hook actúa cuando el agente intenta terminar. Sirve como barrera para una comprobación
concreta, no como reloj ni como tarea durable.

La demo incluye:

```text
demo/scripts/stop-until-verified.mjs
demo/examples/claude-settings.json
demo/examples/codex-hooks.json
```

Usa `/goal` para perseguir un resultado de alto nivel. Usa un Stop hook cuando una comprobación
determinista debe impedir que el agente declare el trabajo terminado.

## Decide en este orden

Antes de automatizar otro turno, responde:

1. **¿Qué lo activa?** Terminar un turno, pasar tiempo, intentar detenerse o recibir un evento.
2. **¿Dónde sobrevive?** En la conversación, en tu computador o fuera de ambos.
3. **¿Qué lo detiene?** Un exit code, CI verde, una cola vacía o un límite explícito.

Mapeo rápido:

- Falta trabajo que puede hacerse ahora: `/goal`.
- Hay que impedir una salida incorrecta: Stop hook.
- Un sistema externo puede cambiar con tiempo: `/loop` o Scheduled Task dentro del chat.
- El trabajo debe volver después de cerrar la sesión: tarea de escritorio, rutina cloud o tarea standalone.
- Debe reaccionar a una API, GitHub o una cola: rutina, GitHub Action, SDK o controlador.

Si no puedes responder las tres preguntas, todavía no diseñaste el loop. Solo automatizaste la
repetición.

## Restaurar la demo

Si todavía no hiciste commit de la solución:

```bash
npm run demo:reset
```

El script muestra exactamente qué rutas va a limpiar, restaura solamente la implementación y
confirma que la verificación vuelve a fallar.

Si ya publicaste la rama, vuelve a `main` y crea una rama nueva. No reutilices un PR que ya contiene
la solución porque la transición de rojo a verde ya ocurrió.

## Resultados registrados

Estos valores pertenecen a la corrida E2E usada para validar el tutorial:

```text
estado inicial: pass 1 / fail 3
/goal: 1 turno, aproximadamente 2 minutos, 2.5k tokens
archivo modificado: src/delivery.js
primer webhook-delivery: fail, 9 segundos
estado corregido: pass 4 / fail 0
segundo webhook-delivery: pass, 11 segundos
/loop: los 5 checks ya estaban completos en la primera consulta
```

La generación del agente es probabilística. Los comandos, los tests y la condición de salida son la
parte reproducible; la cantidad de turnos y la implementación concreta pueden cambiar.

## Fuentes oficiales

- Claude Code `/goal`: https://code.claude.com/docs/en/goal
- Claude Code `/loop` y scheduling: https://code.claude.com/docs/en/scheduled-tasks
- Claude Code Routines: https://code.claude.com/docs/en/routines
- Claude Code hooks: https://code.claude.com/docs/en/hooks
- Codex Goal mode: https://learn.chatgpt.com/docs/long-running-work
- Codex Scheduled Tasks: https://learn.chatgpt.com/docs/automations
- Codex hooks: https://learn.chatgpt.com/docs/hooks
