# Company Brain en código: la misma pregunta, otra memoria

Esta guía permite reproducir una memoria de proyecto que conserva decisiones, fuentes e historial. Consultaremos su estado, incorporaremos un cambio de CSV a PDF y repetiremos la misma pregunta con el contexto actualizado.

**Los archivos mantienen el conocimiento; el código controla sus actualizaciones; el LLM responde usando el contexto que recibe.** No se entrena de nuevo al modelo ni se modifica su memoria interna.

## Qué vamos a comprobar

El proyecto ficticio **Portal del cliente** tiene un acuerdo aprobado para exportar reportes en CSV y un issue —una tarea— que solicita ese formato. Un mensaje de Slack sugiere Excel, pero no lo aprueba.

Después incorporaremos una confirmación ficticia de PDF. El cambio quedará pendiente hasta que lo aprobemos explícitamente:

| Estado | Acuerdo vigente | Propuesta | Issue |
|---|---|---|---|
| Inicial | CSV, versión 1 | Ninguna | Solicita CSV |
| Confirmación incorporada | CSV, versión 1 | PDF pendiente | Solicita CSV |
| Cambio aprobado | PDF, versión 2; CSV en historial | Aprobada | **Todavía solicita CSV** |

Dejamos la tarea sin modificar a propósito: la consulta final debe identificar que el trabajo quedó desactualizado respecto del acuerdo.

## Qué hace cada parte

| Parte | Responsabilidad |
|---|---|
| Archivos JSON y Markdown | Guardar el proyecto, el acuerdo vigente, su historial, la tarea y las fuentes |
| JavaScript | Leer archivos, preparar contexto, validar y crear propuestas, y escribir la actualización después de tu confirmación |
| Tú | Revisar la propuesta y ejecutar su aprobación |
| LLM | Responder la pregunta con el contexto suministrado; no dispone de herramientas para leer el disco o escribir archivos |

**El LLM no extrae el formato del correo ni crea la propuesta.** El evento de prueba ya contiene `format: "PDF"`, los identificadores del proyecto y la evidencia literal. Este ejemplo aísla la actualización de la memoria y su uso en consultas; no implementa interpretación automática de correos.

Todos los datos son ficticios. No hay cuentas Gmail, Slack o GitHub conectadas, interfaz gráfica ni servidor local. La [demo de integración con Gmail y GitHub](../company-brain/demo/) es un recorrido distinto. El concepto se desarrolla en el artículo [Qué es un Company Brain y cómo puedes construirlo](https://www.gilbertsahumada.com/blog/que-es-un-company-brain-y-como-puedes).

## Requisitos y preparación

- Node.js **22 o superior** y Git.
- Editor y terminal. Los comandos de esta guía usan Bash: macOS, Linux o WSL.
- Para el recorrido principal: un proveedor HTTPS compatible con **Chat Completions**, un modelo disponible y una API key. Las consultas pueden generar cargos.

```bash
git clone https://github.com/gilbertsahumada/youtube-tutorials.git
cd youtube-tutorials/videos/company-brain-code/demo
node --version
git --version
npm test
```

Si ya tienes el repositorio, entra directamente en `videos/company-brain-code/demo`. **Todos los comandos siguientes se ejecutan desde esa carpeta.** No hay dependencias que instalar.

Las pruebas deben pasar. Comprueban el flujo de datos y las validaciones mediante fixtures y una API simulada; no consultan ni evalúan un proveedor real.

### Elegir el modo de consulta

La guía utiliza **`npm run ask`**, que llama al LLM real. Configúralo antes de continuar:

```bash
cp .env.example .env
```

Edita `.env` con tus credenciales. Este es un ejemplo de proveedor, no una obligación:

```dotenv
MODEL_BASE_URL=https://maas.qwencloudapi.com/compatible-mode/v1
MODEL_ID=deepseek-v4.1-flash
MODEL_API_KEY=TU_CLAVE
```

- `MODEL_BASE_URL`: URL base HTTPS. El código añade `/chat/completions`; no agregues ese sufijo a la variable.
- `MODEL_ID`: identificador de un modelo disponible en ese endpoint.
- `MODEL_API_KEY`: clave autorizada para ese servicio. No la publiques ni compartas `.env`.

`ask` envía al proveedor los datos de esta demo. La clave va en el header HTTP y no se incorpora a los archivos de contexto o request. Si falla el proveedor, el comando informa un error: no cambia silenciosamente a una respuesta simulada.

**Alternativa sin credenciales:** omite la configuración de `.env` y sustituye las tres ejecuciones de `npm run ask` por **`npm run ask:fixture`**. Todo lo demás es igual. Una *fixture* es un ejemplo preparado: aquí devuelve una plantilla programada, sin usar un LLM. Sirve para verificar el flujo, no para demostrar comprensión del modelo. La salida queda marcada con `"mode": "fixture"` en lugar de `"mode": "llm"`.

Elige un modo para todo el recorrido. Si después cambias de modo, guarda los resultados anteriores y reinicia para no confundir respuestas simuladas con reales.

## Dónde viven los datos

| Carpeta dentro de `demo/` | Función |
|---|---|
| `seed/brain/` | Memoria inicial reproducible; los scripts no la modifican |
| `workspace/` | Estado activo de la demo: memoria, evento y propuesta |
| `output/` | Contexto, mensajes, requests HTTP y respuestas generados |
| `fixtures/` | Evento ficticio que incorporaremos manualmente |
| `src/` | Código de los comandos, actualización de memoria y consulta al modelo |

`workspace/` y `output/` se generan durante el recorrido y están ignorados por Git. **Los archivos que debes observar cambiar están en `workspace/`, no en `seed/`.**

## 1. Inicializar y verificar la memoria

**Objetivo:** comenzar con CSV vigente, una tarea alineada y Excel como sugerencia.

```bash
npm run reset
npm run show
```

`reset` copia `seed/` a `workspace/`. **Borra cualquier estado y resultado anterior en `workspace/` y `output/`**; conserva lo que necesites antes de ejecutarlo.

`show` imprime el estado local, sin llamar a un modelo. Comprueba estos archivos en el editor:

| Archivo | Qué comprobar |
|---|---|
| `workspace/brain/project.json` | Referencias a la decisión y a la tarea mediante `decisionId` e `issueId` |
| `workspace/brain/agreement.json` | `version: 1`, `current.format: "CSV"`, `current.status: "approved"` e historial vacío |
| `workspace/brain/issue.json` | `requiredFormat: "CSV"` |
| `workspace/brain/slack.json` | Excel figura como `status: "suggestion"` |
| `workspace/brain/rules.md` | Procedimiento de revisión, aprobación e historial |

Estas referencias relacionan la tarea con el acuerdo. Un archivo reciente o una sugerencia no reemplazan por sí solos una decisión aprobada.

## 2. Inspeccionar el contexto que se enviará

**Objetivo:** entender qué información recibe el modelo antes de pedirle una respuesta.

```bash
npm run context
```

Este comando **no llama al LLM ni cambia la memoria**. Genera:

- `output/before-context.json`: fuentes con ID, ruta y contenido, más un `snapshot` —resumen de versión y estado—.
- `output/before-messages.json`: mensajes de sistema y de usuario que se usarán en la consulta.

Comprueba que `snapshot.version` sea `1` y `snapshot.currentFormat` sea `"CSV"`.

[`buildContext` y `buildMessages`](demo/src/memory.mjs) preparan estos datos. El mensaje de sistema indica que `agreement.current` es el acuerdo vigente, que `history` contiene antecedentes y que una propuesta pendiente no sustituye el acuerdo. El mensaje de usuario contiene la pregunta y las fuentes.

El modelo no lee el disco: recibe una copia del contenido en la petición. Aquí se seleccionan registros conocidos de **un único proyecto**, sin búsqueda vectorial ni búsqueda semántica.

`context` sirve para inspeccionar. **`ask` también reconstruye el contexto por su cuenta**; no necesita una ejecución previa de `context` para leer los archivos actualizados.

## 3. Consultar el estado inicial

**Objetivo:** obtener una respuesta basada en la memoria vigente.

```bash
npm run ask
```

La pregunta predeterminada, usada en las tres consultas, es:

> ¿Qué formato de exportación acordamos y qué trabajo necesita revisión?

El programa imprime la respuesta, el snapshot y las fuentes citadas. Comprueba que la respuesta indique:

- CSV es el formato vigente.
- La tarea coincide con el acuerdo.
- Si menciona Excel, lo trata como una sugerencia, no como una decisión aprobada.

**La redacción de un LLM puede variar; estos son los hechos que debe respetar, no una respuesta garantizada.** Si los contradice, el resultado no cumple el objetivo de la consulta.

La respuesta se guarda en `output/before-answer.json`. En modo real también se guarda `output/before-request.json`: el body del POST, con el modelo y los mensajes, sin el header de autorización. El [adaptador HTTP](demo/src/model.mjs) envía la petición al proveedor.

Los IDs de `citations`, por ejemplo `decision:exportacion`, corresponden a las fuentes de `before-context.json`. El programa rechaza IDs desconocidos, pero eso **no verifica que la interpretación del modelo sea correcta**.

## 4. Incorporar la confirmación y revisar la propuesta pendiente

**Objetivo:** registrar información nueva sin reemplazar todavía el acuerdo vigente.

Abre `fixtures/event.json`. El texto confirma PDF en lugar de CSV, pero el archivo ya incluye campos estructurados como `format`, `projectId` y `evidence`. No hay extracción de lenguaje natural ni consulta a Gmail.

```bash
npm run ingest
npm run show
npm run diff
```

`ingest` incorpora manualmente ese evento. El código valida proyecto, formato, fecha y evidencia literal; después crea:

| Archivo | Qué comprobar |
|---|---|
| `workspace/events/email-pdf.json` | Copia del evento ficticio |
| `workspace/proposal.json` | `status: "pending"`, `baseVersion: 1`, `fromFormat: "CSV"`, `toFormat: "PDF"` |
| `workspace/brain/agreement.json` | Continúa en CSV, versión 1; no se modificó |

**`npm run diff` no debe imprimir diferencias todavía. No es un error:** compara solamente `seed/brain/` con `workspace/brain/`. El evento y la propuesta están fuera de `brain/`, por lo que no aparecen en esa comparación.

La confirmación del cliente es evidencia para una propuesta. La política de esta demo exige además una revisión humana local antes de actualizar el registro vigente.

Repite la consulta:

```bash
npm run ask
```

La respuesta debe distinguir **CSV vigente** de **PDF propuesto y pendiente**. El contexto ya contiene el evento y la propuesta, aunque `agreement.current` siga en CSV.

Verifica `output/pending-context.json` y `output/pending-answer.json`: el snapshot debe mostrar versión `1`, formato `"CSV"` y `proposalStatus: "pending"`. Esta consulta permite comprobar que el modelo no trata simplemente el dato más reciente como el acuerdo vigente.

## 5. Aprobar y comprobar la actualización

**Objetivo:** convertir la propuesta revisada en el nuevo acuerdo y conservar su antecedente.

Revisa `workspace/proposal.json` y su evidencia en `workspace/events/email-pdf.json`. Si corresponden al cambio esperado:

```bash
npm run approve -- --yes --reviewer "Tu nombre"
npm run diff
```

Sustituye `Tu nombre` por tu nombre. `--yes` confirma la operación; `--reviewer` registra quién la ejecutó. Es una etiqueta local, no un sistema de autenticación.

El código revalida la propuesta y actualiza una ruta fija. **El LLM no participa en la aprobación ni escribe el acuerdo.**

Comprueba los resultados:

| Archivo | Resultado |
|---|---|
| `workspace/brain/agreement.json` | Versión `2`, PDF en `current`, fuente y aprobación registradas; CSV en `history` con estado `superseded` —reemplazado— |
| `workspace/proposal.json` | Estado `approved` |
| `workspace/brain/issue.json` | Sigue solicitando CSV |
| `workspace/brain/slack.json` | Excel sigue como sugerencia |

El diff debe mostrar cambios **solo en `agreement.json`**. La tarea no se actualiza automáticamente: queda visible la desalineación para que una persona revise sus requisitos y criterios de aceptación.

La lógica está en [`approveProposal`](demo/src/memory.mjs). `diff` usa `git diff --no-index` para comparar directorios: no crea commits, ramas ni PRs. Su script acepta el exit code 1 de Git como “hay diferencias”, por lo que la ejecución termina correctamente.

## 6. Repetir la pregunta con la memoria actualizada

**Objetivo:** comparar las respuestas manteniendo la misma pregunta y configuración del modelo.

```bash
npm run ask
```

No necesitas volver a ejecutar `context`: esta consulta lee la memoria actualizada y genera `output/after-context.json`, `after-messages.json` y `after-answer.json`.

Comprueba que el snapshot tenga versión `2`, formato `"PDF"` y propuesta `"approved"`. La respuesta debe identificar:

- PDF es el acuerdo vigente.
- La tarea todavía solicita CSV y necesita revisión.
- Si menciona Excel, no lo convierte en una decisión aprobada.

En `output/after-context.json`, verifica además que CSV esté en el historial de la decisión. La respuesta puede mencionarlo, pero no necesita enumerar todos los antecedentes.

Compara en el editor:

| Antes | Después |
|---|---|
| `output/before-messages.json` | `output/after-messages.json` |
| `output/before-answer.json` | `output/after-answer.json` |

La pregunta y la instrucción de sistema no cambian. Cambian las fuentes enviadas como contexto. **La actualización pertenece a los datos del proyecto, no a los parámetros ni al entrenamiento del modelo.**

## Resultados, repetición y otras preguntas

Los prefijos de los archivos indican el estado de la consulta:

- `before-*`: memoria inicial.
- `pending-*`: propuesta pendiente.
- `after-*`: acuerdo actualizado.

Cada consulta genera contexto, mensajes y respuesta. Solo `ask` en modo real genera el archivo `*-request.json`. **Repetir un comando en la misma fase reemplaza sus outputs**; no hay un archivo nuevo por cada consulta. Copia lo que quieras conservar antes de repetir, cambiar de modo o reiniciar. Un request de una ejecución real anterior no se elimina al usar luego una fixture en la misma fase; revisa el campo `mode` y no mezcles esos resultados.

Para comenzar de nuevo:

```bash
npm run reset
```

Para formular otra pregunta al LLM real:

```bash
npm run ask -- --question "¿Qué trabajo quedó desactualizado y por qué?"
```

La alternativa `ask:fixture` solo representa la pregunta predeterminada y rechaza preguntas distintas. Las respuestas simuladas sirven para verificar estados, no para probar la calidad del LLM.

## Si algo falla

| Síntoma | Qué revisar |
|---|---|
| `Primero ejecuta npm run reset` | Todavía no se creó el estado en `workspace/` |
| `Falta MODEL_ID` o `Configura MODEL_API_KEY` | Configura `.env` en `demo/`, o usa `ask:fixture` sin credenciales |
| El proveedor responde HTTP 401 | Clave y autorización para el servicio elegido |
| Error de endpoint o modelo | URL base HTTPS, sufijo añadido por el código e ID disponible en el proveedor |
| El modelo no devuelve JSON o cita fuentes desconocidas | La respuesta no cumple el contrato; el comando falla, no la reemplaza por una fixture |
| `diff` no muestra nada tras `ingest` | Es el resultado esperado antes de aprobar: el acuerdo no cambió |
| La propuesta fue alterada o cambió la memoria | No fuerces la aprobación; revisa los archivos y, para repetir el ejemplo inicial, conserva tus resultados y ejecuta `reset` |

## Alcance y límites

Esta demo combina un repositorio de conocimiento, memoria estructurada, relaciones explícitas y consultas sobre contexto actualizado. No implementa un agente autónomo, clasificación de correos, permisos empresariales, búsqueda semántica ni conectores externos; el evento se incorpora mediante un comando manual.

- Mantén datos ficticios: el proveedor recibe el contexto completo en `ask`.
- La dirección del correo y el nombre del reviewer no autentican un acuerdo empresarial.
- La validación de citas y el prompt no eliminan errores de interpretación ni prompt injection. Revisa las respuestas reales.
- Ejecuta una sola instancia. Las escrituras son individuales, sin transacción entre acuerdo y propuesta ni bloqueo multiusuario. Repetir la aprobación permite recuperar el estado si se interrumpió entre guardar ambos archivos.
- `.env`, `workspace/` y `output/` se ignoran en Git, pero eso no los convierte en un almacén seguro. Revisa cualquier archivo antes de compartirlo.
- Las pruebas automatizadas y las fixtures no verifican la calidad de un proveedor real.
