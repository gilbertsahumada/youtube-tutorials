# Loop Engineering con Claude Code y Codex

Loop Engineering incluye automatización, aislamiento, contexto, verificación y estado persistente.
Esta demo se concentra en su heartbeat: qué inicia la siguiente vuelta, qué estado conserva y qué
evidencia puede detenerla.

Esta demo sigue un solo trabajo durante todo su ciclo:

```text
bug visible
  -> PR con CI rojo
  -> /goal corrige hasta cumplir una condición
  -> push inicia CI otra vez
  -> un loop temporal espera el resultado externo
  -> una tarea durable puede volver cuando la sesión ya terminó
```

El ejemplo es un procesador de webhooks de facturación. El estado inicial duplica un evento,
descarta un fallo temporal y entrega un fallo permanente como si hubiera funcionado.

## La pregunta que separa los loops

**¿Qué debe iniciar la siguiente vuelta?**

<table>
  <thead>
    <tr>
      <th>Necesidad</th>
      <th>Claude Code</th>
      <th>Codex</th>
      <th>La siguiente vuelta empieza cuando</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Converger hasta un resultado</td>
      <td><code>/goal</code></td>
      <td><code>/goal</code></td>
      <td>Termina el turno anterior y todavía falta evidencia</td>
    </tr>
    <tr>
      <td>Aplicar una barrera personalizada</td>
      <td>Stop hook</td>
      <td>Stop hook</td>
      <td>El agente intenta terminar</td>
    </tr>
    <tr>
      <td>Esperar dentro del mismo contexto</td>
      <td><code>/loop</code></td>
      <td>Scheduled Task dentro del chat</td>
      <td>Pasa un intervalo</td>
    </tr>
    <tr>
      <td>Volver con una ejecución independiente</td>
      <td>Desktop task o Routine</td>
      <td>Standalone Scheduled Task</td>
      <td>Llega el horario</td>
    </tr>
    <tr>
      <td>Reaccionar a GitHub o una API</td>
      <td>Routine con trigger</td>
      <td>GitHub Action, SDK o controlador propio</td>
      <td>Ocurre el evento externo</td>
    </tr>
  </tbody>
</table>

Las herramientas se parecen, pero no son idénticas:

- Claude documenta `/goal` como un Stop hook de sesión con un evaluador separado.
- Codex documenta el goal como la primera instrucción y el criterio de finalización asociado al chat.
- Claude Code tiene `/loop` en la CLI. Codex no documenta un comando equivalente.
- En Codex, el equivalente temporal más cercano es una Scheduled Task dentro del mismo chat.
- Claude Routines acepta horarios, llamadas API y eventos de GitHub.
- Codex Scheduled Tasks puede ejecutar trabajo local en un worktree o trabajo web con herramientas
  conectadas.

No asumimos que dos mecanismos son iguales solamente porque resuelven un caso parecido.

## Requisitos

- Git.
- GitHub CLI autenticado.
- Node.js 20 o superior.
- Claude Code con `/goal` y `/loop`.
- Codex o ChatGPT Desktop con Goal mode y Scheduled Tasks.

## 1. Preparar una corrida real

Clona el repositorio y crea una rama con el prefijo que activa el workflow de la demo:

```bash
git clone https://github.com/gilbertsahumada/youtube-tutorials.git
cd youtube-tutorials
git switch -c demo/loop-engineering-recording
cd videos/loop-engineering/demo
npm run demo:prepare
```

El script requiere un árbol limpio y crea `RUN.md`. Ese archivo produce un cambio real para abrir el
PR sin modificar la implementación.

```bash
git add RUN.md
git commit -m "demo: start loop engineering run"
git push -u origin demo/loop-engineering-recording
gh pr create --draft \
  --title "Demo: repair webhook delivery policy" \
  --body "Reproducible run for the Loop Engineering tutorial."
```

El workflow solo se ejecuta en ramas que comienzan con `demo/loop-engineering-`. Así, el estado roto
forma parte de la práctica y no convierte cada cambio documental del repositorio en un CI rojo.

## 2. Ver el defecto

Desde `videos/loop-engineering/demo`:

```bash
npm run demo
```

Salida registrada:

```text
Webhook delivery plan
evt_invoice_paid_01 -> deliver
evt_invoice_failed_02 -> drop
evt_invoice_failed_02 -> drop
evt_customer_invalid_03 -> deliver
```

Hay tres problemas visibles:

- `evt_invoice_failed_02` aparece dos veces.
- El `503` termina en `drop`, aunque es temporal.
- El `400` termina en `deliver`, aunque es un fallo permanente.

La misma política está expresada como cuatro comprobaciones:

```bash
npm run verify
```

Estado inicial registrado:

```text
tests 4
pass 1
fail 3
```

El primer push también deja el check `Loop Engineering demo / webhook-delivery` en rojo. Ese cambio
externo es lo que después justifica usar un loop temporal.

## 3. Converger con `/goal`

Usa `/goal` cuando no hay nada que esperar y la siguiente acción debe comenzar inmediatamente.

Abre Claude Code o Codex dentro de `videos/loop-engineering/demo` y pega exactamente:

```text
/goal Este worker está procesando dos veces el mismo webhook, descarta un fallo temporal y trata un fallo permanente como entrega exitosa. Corrígelo hasta que npm run verify termine con exit code 0. No modifiques tests, eventos de ejemplo ni documentación. No hagas commit, push ni merge. Si te bloqueas, detente y conserva la última salida real.
```

El goal contiene:

- Un resultado observable.
- Límites sobre lo que no puede modificar.
- Una comprobación mecánica.
- Un estado bloqueado.

En Claude Code, un evaluador separado revisa después de cada turno la evidencia que Claude dejó en
la conversación. No ejecuta herramientas por su cuenta.

En Codex, el objetivo queda asociado al chat y se puede pausar, editar, reanudar o borrar. La
documentación pública no afirma que use internamente el mismo evaluador de Claude.

Cuando termine, verifica fuera del agente:

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

Y la comprobación termina con:

```text
tests 4
pass 4
fail 0
```

La implementación validada modifica únicamente:

```text
videos/loop-engineering/demo/src/delivery.js
```

La cantidad de turnos y la solución concreta de un agente pueden cambiar entre ejecuciones.

## 4. Enviar la nueva evidencia a GitHub

El goal termina cuando la comprobación local pasa. Eso no significa que tenga permiso para publicar.

```bash
git add src/delivery.js
git commit -m "fix: make webhook delivery idempotent"
git push
```

El push inicia otra corrida de GitHub Actions. Ahora existe una razón real para esperar: el estado
puede cambiar fuera del agente.

## 5. Esperar con Claude Code `/loop`

Claude Code ofrece `/loop` dentro de la sesión:

```text
/loop Revisa el PR asociado a la rama actual. Si CI sigue ejecutándose, informa el estado y vuelve a revisar. Si termina, resume el resultado y detén este loop. No modifiques archivos, no hagas push y no hagas merge.
```

Sin un intervalo explícito, Claude puede escoger el siguiente intervalo según lo que observa. También
puedes fijarlo:

```text
/loop 5m revisa el PR asociado a la rama actual y detente cuando CI termine
```

`/loop` es correcto aquí porque GitHub puede cambiar mientras esperamos. No habría sido correcto
usarlo para reparar el código local: esperar cinco minutos no mejora una prueba que ya está roja.

## 6. Mapear el equivalente temporal en Codex

Codex no documenta un comando `/loop` en la CLI. Para volver al mismo contexto por tiempo, el
mecanismo más cercano es una Scheduled Task dentro del chat:

```text
Cada 5 minutos, revisa el PR asociado a este proyecto.

Si CI sigue ejecutándose, informa el estado y termina esta ejecución.
Si CI terminó, resume el resultado y pausa esta tarea.
No modifiques archivos, no hagas push y no hagas merge.
```

La tarea vuelve al mismo chat con su contexto existente. Una Standalone Scheduled Task es diferente:
cada corrida empieza en un chat nuevo desde el prompt guardado.

No intentes demostrar las dos herramientas esperando el mismo check. Cuando Claude Code `/loop`
termina, la transición de CI ya ocurrió. Usa este bloque para comparar la primitiva y el estado que
conserva Codex, no para fingir una segunda espera.

Para proyectos locales, el computador y ChatGPT Desktop deben seguir ejecutándose. En un repositorio
Git, selecciona un worktree cuando la tarea pueda modificar archivos.

## 7. Stop hooks

Un Stop hook no espera tiempo. Se ejecuta cuando el agente intenta terminar.

Esta demo incluye una comprobación compatible con ambas herramientas:

```text
demo/scripts/stop-until-verified.mjs
```

Ejemplos de configuración:

```text
demo/examples/claude-settings.json
demo/examples/codex-hooks.json
```

Si `npm run verify` falla, el hook devuelve la evidencia y abre una continuación. Si la
continuación vuelve a fallar, permite detenerse para evitar un loop infinito.

Usa `/goal` para trabajo largo con una condición de alto nivel. Usa un Stop hook cuando necesitas
que una comprobación concreta actúe como barrera.

## 8. Trabajo durable y eventos

Cuando el trabajo debe sobrevivir a la sesión:

- En Claude, usa una Desktop task para archivos locales o una Routine para ejecución cloud. Una
  Routine puede despertar por horario, API o evento de GitHub.
- En Codex, usa una Scheduled Task dentro del chat si necesita conservar ese contexto, o una
  Standalone Scheduled Task si cada corrida debe ser independiente.
- Usa GitHub Actions, `claude -p`, `codex exec`, los SDK o un controlador propio cuando necesites
  triggers, colas, presupuestos o políticas que las superficies nativas no expresan.

## Qué opción elegir

<table>
  <thead>
    <tr>
      <th>Pregunta</th>
      <th>Elección</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>¿Debe actuar otra vez inmediatamente porque falta el resultado?</td>
      <td><code>/goal</code></td>
    </tr>
    <tr>
      <td>¿Debe impedir que el agente termine si una comprobación falla?</td>
      <td>Stop hook</td>
    </tr>
    <tr>
      <td>¿Debe esperar porque CI o un deployment todavía puede cambiar?</td>
      <td><code>/loop</code> o Scheduled Task dentro del chat</td>
    </tr>
    <tr>
      <td>¿Debe volver aunque la sesión original haya terminado?</td>
      <td>Desktop task, Routine o Standalone Scheduled Task</td>
    </tr>
    <tr>
      <td>¿Debe reaccionar a una cola, API o evento externo?</td>
      <td>Routine, GitHub Action, SDK o controlador propio</td>
    </tr>
  </tbody>
</table>

## Restaurar

Antes de hacer commit, puedes restaurar la implementación y eliminar configuraciones temporales:

```bash
npm run demo:reset
```

Si ya publicaste la rama de práctica, vuelve a `main` y crea una rama nueva para repetir el
recorrido. No reutilices un PR que ya tiene la solución.

## Fuentes oficiales

- Claude Code `/goal`: https://code.claude.com/docs/en/goal
- Claude Code `/loop` y scheduling: https://code.claude.com/docs/en/scheduled-tasks
- Claude Code Routines: https://code.claude.com/docs/en/web-scheduled-tasks
- Claude Code hooks: https://code.claude.com/docs/en/hooks
- Codex Goal mode: https://learn.chatgpt.com/docs/long-running-work
- Codex Scheduled Tasks: https://learn.chatgpt.com/docs/automations
- Codex hooks: https://learn.chatgpt.com/docs/hooks
