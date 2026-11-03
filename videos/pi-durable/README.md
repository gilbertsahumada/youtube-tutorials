# Pi Durable: un agente que recupera su trabajo

Esta demo acompaña la explicación de Pi Durable. Un planificador investiga un viaje de tres días a Viena. Clima y museos terminan, trenes queda pendiente, terminamos el proceso y lo reiniciamos. El mismo harness recupera la conversación, conserva los resultados confirmados y vuelve a ejecutar la lectura interrumpida.

El código usa **Pi Durable 1.5.0 y SQLite**. Las consultas de viaje tienen datos simulados, identificados en pantalla. Hay dos proveedores de modelo: `faux`, con respuestas programadas para reproducir la prueba sin credenciales, y `openai`, para usar un LLM real. Ambos ejecutan las mismas herramientas, tarea de investigación, persistencia y recuperación.

## Qué significa durable en este video

El proceso puede terminar. El almacenamiento conserva los mensajes, las tareas y los puntos de avance confirmados. Otro proceso abre ese mismo estado y reanuda el trabajo pendiente.

Esto no significa que el programa siga trabajando mientras está apagado ni que cualquier acción externa ocurra exactamente una vez. Una herramienta de lectura puede repetirse con seguridad. Un pago necesita idempotencia en el proveedor de pagos.

Cloudflare Durable Objects es un servicio de infraestructura donde también puede alojarse un harness. Esta primera demo es local: nosotros arrancamos el nuevo proceso. El despliegue y el despertar gestionado en Cloudflare quedan para otro recorrido.

## Recursos

- [Slides en PDF](slides/pi-durable.pdf).
- [Código de la CLI](demo/src/main.ts).
- [Pruebas de recuperación](demo/test/recovery.test.ts).

## Estructura

```text
videos/pi-durable/
  README.md
  slides/pi-durable.pdf
  demo/
    package.json
    package-lock.json
    .env.example
    src/
      main.ts        CLI, consola interactiva y comandos
      harness.ts     Proveedor, registry, SQLite y conversación principal
      tools.ts       Consultas de lectura y pausa manual de trenes
      fixtures.ts    Datos simulados y pedido inicial
      research.ts    Background, conversación hija y reporte durable
      state.ts       Estado leído del harness y conteos observados
      control.ts     Comunicación local entre las dos terminales
      events.ts      Registro diagnóstico JSONL
    test/recovery.test.ts
```

## 1. Requisitos e instalación

Necesitas macOS, Linux o WSL, npm y **Node.js 22.19.0 o superior**. El backend usa el módulo `node:sqlite`. Windows nativo no está soportado por los sockets Unix de esta CLI.

Desde la raíz del repositorio:

```bash
cd videos/pi-durable/demo
node --version
npm ci --ignore-scripts
npm run verify
```

Si usas nvm:

```bash
nvm install
nvm use
```

Comprueba Node en las dos terminales. Cada demo tiene sus requisitos; el mínimo general del repo no reemplaza el de esta carpeta. Node 22 puede imprimir un aviso experimental de SQLite: ese aviso no indica que haya fallado la prueba.

Las dependencias y el lockfile fijan la versión ensayada. Pi Durable es experimental y su API puede cambiar. Para repetir este video, usa `npm ci` y conserva el lockfile.

## 2. Qué mirar en el código

### Harness y SQLite

`src/harness.ts` abre `Harness.open()` sobre `openNodeSqliteStorage()`, instala las extensiones y obtiene la conversación principal con `root()`. Al reanudar, `main.ts` abre el mismo archivo y activa `harness.resume()`.

El proveedor y el modelo elegidos se guardan en `session.json`. Los mensajes, tareas y resultados viven en SQLite. El archivo de configuración no contiene claves y no decide qué consultas se recuperan.

### Herramientas seguras de repetir

`src/tools.ts` declara `search` con `replay: "safe"`. Clima y museos devuelven sus fixtures tras una espera corta. Trenes espera una liberación manual.

La pausa permite interrumpir la ejecución en un punto conocido: el comando `release` la abre para el proceso actual. Después de un crash, el nuevo intento espera de nuevo. No hay una caché propia que evite ejecutar consultas completadas. Esa decisión pertenece a Pi Durable.

### Investigación en background

`src/research.ts` instala una herramienta `research` y una tarea durable con dos fases:

1. `deliver`: obtiene la conversación hija persistida, entrega su petición con `requestId` estable, espera su respuesta y guarda el reporte en el checkpoint.
2. `report`: entrega el reporte al principal con otro `requestId` estable y termina la tarea.

La herramienta crea la tarea en background y su conversación hija en un commit. Devuelve inmediatamente el control al principal. La demo admite un viaje por sesión; repetir la delegación encuentra la investigación existente.

### Diagnóstico y evidencia

`events.jsonl` muestra cuándo entró una herramienta, qué proceso la ejecutó y su ID. `tool_returning` indica que el cuerpo de la herramienta está por devolver el resultado. **No demuestra que esté confirmado.**

`demo:status` consulta el historial real del harness para construir `confirmedTopics`. Espera a que allí aparezcan clima y museos antes de provocar el fallo. Los conteos `attempts` son observaciones del registro, no el estado que utiliza el harness para recuperarse.

## 3. Reproducir la recuperación con dos terminales

Los comandos siguientes se ejecutan desde `videos/pi-durable/demo/` en ambas terminales. El proveedor predeterminado es `faux`. No necesita `.env` ni usa llamadas de pago.

### Terminal A: arrancar

```bash
npm run demo
```

Espera `session_ready`. Esta terminal queda ejecutando el servidor y muestra los eventos y las respuestas. Si es interactiva, también admite `/trip`, `/status`, `/steer texto`, `/release` y `/quit`.

Arrancar no envía una petición automáticamente. `session_ready` muestra el proveedor y la identidad de la conversación. La investigación empieza al ejecutar `demo:trip`.

### Terminal B: comenzar el viaje

```bash
npm run demo:trip
npm run demo:ask -- "¿Qué información te falta?"
npm run demo:status
```

El principal puede responder mientras la investigación trabaja en background. En modo `faux`, las respuestas están programadas; el harness y su persistencia son reales.

Espera un estado equivalente a este. Los IDs concretos pueden variar:

```json
{
  "rootId": 1,
  "childId": 14,
  "confirmedTopics": ["weather", "museums"],
  "gateOpen": false,
  "attempts": { "weather": 1, "museums": 1, "trains": 1 },
  "reportCount": 0
}
```

La salida completa tiene más campos. Compara `rootId`, `childId`, `researchTaskId` y el `taskId` de trenes antes y después del reinicio. Este último aparece en el evento `tool_enter`.

### Provocar un crash real

Desde B:

```bash
npm run demo:crash
```

La aplicación que atiende esa sesión responde con su PID y **se termina a sí misma con SIGKILL**. Este comando no busca ni mata otros procesos por nombre. A vuelve al shell; SQLite y el registro permanecen.

En este punto, clima y museos ya tienen resultado confirmado. Trenes sigue dentro de la herramienta. El proceso termina antes de completar esa llamada.

Ctrl+C en A hace un cierre normal. Para reproducir la prueba del crash usa `demo:crash`. Ctrl+C en un cliente o en el visor de eventos no demuestra que murió el servidor.

### Terminal A: recuperar

```bash
npm run demo:resume
```

Usa la misma carpeta de datos. No vuelvas a iniciar una sesión nueva ni cambies de proveedor a mitad de la prueba.

### Terminal B: comprobar y dirigir

```bash
npm run demo:status
npm run demo:steer -- "Prioriza trenes directos y evita trasbordos."
npm run demo:release
npm run demo:status
```

Antes de liberar trenes, el estado debe conservar los IDs y mostrar:

```json
{
  "confirmedTopics": ["weather", "museums"],
  "attempts": { "weather": 1, "museums": 1, "trains": 2 },
  "reportCount": 0
}
```

Los resultados terminados permanecen. La lectura interrumpida vuelve a ejecutarse con el mismo ID de tarea. El steer entra en el siguiente paso del subagente, después de su ronda de herramientas.

Tras liberar la pausa, espera el reporte y el plan final en A. Consulta otra vez `demo:status` si todavía no terminaron. Debe mostrar las tres consultas confirmadas, un solo reporte y la prioridad de trenes directos en `answersAfterReport`.

### Comprobar la deduplicación de entrada

Opcionalmente, vuelve a enviar el pedido estable:

```bash
npm run demo:trip
```

Devuelve el mismo `submissionId` que antes. No representa un segundo viaje. El `requestId` del pedido de la demo es fijo; las preguntas libres usan un identificador nuevo.

### Cierre y otra reapertura

Desde B:

```bash
npm run demo:stop
```

Desde A:

```bash
npm run demo:resume
```

Desde B:

```bash
npm run demo:status
npm run demo:stop
```

El plan sigue disponible y los conteos permanecen 1/1/2.

## 4. Crear otra sesión

La CLI rechaza `start` si ya existe una sesión. No borra automáticamente el trabajo anterior. Para otra ejecución usa una carpeta nueva:

```bash
# Terminal A
npm run demo -- --data-dir .data/sesion-02
```

Todos los comandos de B y el posterior resume deben usar esa misma ruta:

```bash
npm run demo:trip -- --data-dir .data/sesion-02
npm run demo:status -- --data-dir .data/sesion-02
npm run demo:crash -- --data-dir .data/sesion-02
# En A, después del crash:
npm run demo:resume -- --data-dir .data/sesion-02
```

No puede haber dos servidores para el mismo directorio. Sí pueden coexistir sesiones con carpetas distintas.

`demo:events` sigue el registro completo en una ventana adicional. No abre SQLite ni conduce la recuperación:

```bash
npm run demo:events
```

## 5. Usar un modelo real

Configura `.env` a partir de `.env.example`, con `OPENAI_API_KEY` y `PI_MODEL`. El ID debe estar soportado por Pi AI 1.5.0 y disponible para tu cuenta. Esta CLI usa la API de OpenAI; no carga automáticamente el login OAuth del coding agent de Pi.

```bash
cp .env.example .env
```

Edita `.env` localmente. El archivo queda excluido de Git.

```bash
# Terminal A, con .env preparado
npm run demo -- --provider openai --data-dir .data/real-01
```

En B, repite los comandos anteriores agregando `--data-dir .data/real-01`. Para recuperar:

```bash
npm run demo:resume -- --data-dir .data/real-01
```

El proveedor y modelo se recuperan desde `session.json`; la clave vuelve a cargarse desde `.env`. Este modo realiza llamadas de pago. Las consultas de viaje siguen siendo simuladas.

El modelo recibe instrucciones para investigar los tres temas en paralelo, pero puede elegir otra secuencia. Antes del corte revisa los resultados confirmados. El conteo 1/1/2 es el criterio del recorrido controlado con `faux`, no una promesa sobre las decisiones de cualquier LLM.

## 6. Verificación automática

```bash
npm run verify
```

Primero comprueba TypeScript. Luego las pruebas inician **la CLI de esta carpeta**, usan un SQLite temporal, invocan los comandos de control, provocan SIGKILL y reinician. Ejecutan la misma aplicación que usa el recorrido manual.

Comprueban:

- Respuesta del principal durante la investigación.
- Dos resultados realmente confirmados antes del corte.
- Mismas conversaciones y tarea después del reinicio.
- Conteos 1/1/2, mismo ID de tarea y diferente PID para los dos intentos de trenes.
- Deduplicación del pedido y entrega única del reporte.
- Admisión del steering mientras el subagente está ocupado y presencia de la prioridad en su siguiente respuesta programada.
- Persistencia del resultado tras abrir una sesión completada.
- Rechazo de un segundo dueño del mismo almacenamiento.
- Error claro si se elige OpenAI sin credenciales, sin hacer una llamada remota.

Las pruebas conservan su carpeta temporal si fallan y la eliminan si pasan. No borran la sesión manual. Algunas herramientas restringen la creación de sockets locales: ejecútalas en una terminal que permita comunicación local entre procesos.

El recorrido automatizado no valida la obediencia ni la calidad de un LLM remoto, precios ni información actual de viajes.

El resultado esperado es TypeScript correcto y 2 pruebas aprobadas. La prueba de recuperación comprueba el conteo clima 1, museos 1 y trenes 2 con el proveedor faux.

## 7. Archivos de ejecución y límites

Por defecto, la ejecución queda en `demo/.data/`, excluida de Git:

```text
session.sqlite        Estado real de Pi Durable
session.sqlite-wal    Archivo auxiliar de SQLite, cuando corresponde
session.sqlite-shm    Archivo auxiliar de SQLite, cuando corresponde
session.json          Proveedor y modelo, sin claves
events.jsonl          Diagnóstico de ejecuciones
```

No copies una base activa sin sus mecanismos de respaldo de SQLite. Mantén la misma carpeta entre el crash y resume. El historial y los logs pueden contener mensajes del usuario: usa datos de ejemplo.

El reporte vuelve como una nueva entrada al principal. Las entradas y sus identidades en SQLite son la evidencia de entrega; un evento diagnóstico podría mostrarse otra vez al reconstruir una vista. `restored: true` identifica una entrada que ya existía al abrir la sesión.

El servicio local y sus sockets permiten controlar y probar la demo. No son una API pública ni un despliegue de producción. No implementa autenticación multiusuario, reservas ni pagos.

## Referencias

- [Artículo de Earendil sobre Pi Durable](https://earendil.com/posts/pi-durable/).
- [README de Pi Durable](https://github.com/earendil-works/pi/blob/main/packages/durable/README.md).
- [Planificador oficial v1.0.0](https://github.com/earendil-works/pi/tree/v1.0.0/packages/coding-agent/src/experimental/vacation).
- [Ejemplo oficial de subagentes en background](https://github.com/earendil-works/pi/blob/main/packages/durable/test/examples/22-subagent-background.ts).
- [Integración con Cloudflare](https://developers.cloudflare.com/agents/harnesses/pi/).

El diseño de investigación se inspira en el ejemplo oficial. La CLI, los comandos, la pausa controlada y las pruebas de este repo usan la API fijada en 1.5.0.
