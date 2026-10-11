# Company Brain en código: la misma pregunta, otra memoria

> El LLM no aprende el nuevo acuerdo por sí solo. Cambiamos la memoria, reconstruimos el contexto y volvemos a hacer la misma pregunta.

Este es el compañero escrito de la **demo práctica**, que complementa el artículo [Qué es un Company Brain y cómo puedes construirlo](https://www.gilbertsahumada.com/blog/que-es-un-company-brain-y-como-puedes). Todo el recorrido se muestra con archivos, código y terminal: no hay interfaz 3D, Gmail ni GitHub que configurar.

## El problema que vamos a seguir

El proyecto Portal del cliente tiene un acuerdo aprobado: exportar reportes en **CSV**. El issue también pide CSV. En una conversación alguien propone Excel, pero nadie lo ha aprobado.

Después llega una confirmación de **PDF**. Si simplemente agregamos ese correo a una carpeta, todavía quedan preguntas importantes:

- ¿Reemplaza el acuerdo vigente o solo inicia una revisión?
- ¿Qué trabajo depende de esa decisión?
- ¿Conservamos por qué antes se había acordado CSV?
- ¿Qué debe responder el LLM mientras el cambio está pendiente?

La demo sigue una sola historia:

```text
Memoria v1: CSV aprobado + issue CSV + Excel sugerido
           ↓ misma pregunta
LLM recibe el contexto vigente → respuesta con fuentes
           ↓ nuevo evento ficticio
Propuesta PDF pendiente → el acuerdo sigue siendo CSV
           ↓ aprobación humana explícita
Memoria v2: PDF aprobado + CSV histórico + issue todavía CSV
           ↓ misma pregunta, mismo código, mismo modelo configurado
LLM recibe el contexto nuevo → PDF vigente + issue desactualizado
```

**Los archivos son la memoria. El LLM trabaja sobre esa memoria; no la reemplaza.**

## Qué es real y qué es simulado

| Pieza | Qué ocurre |
|---|---|
| Datos de la empresa | Ficticios, en JSON y Markdown |
| Actualización de la memoria | Real, en archivos locales dentro de `demo/workspace/` |
| Correo | Fixture local; no se consulta Gmail |
| Extracción del correo | Ya normalizada en JSON; no se demuestra clasificación de lenguaje natural |
| Slack e issue | Registros locales, no integraciones |
| `npm run ask:fixture` | Respuesta determinista y **etiquetada como simulada**; no llama a un modelo |
| `npm run ask` | Llamada real al LLM configurado; requiere credenciales y puede generar cargos |
| Aprobación | Comando que ejecutas tú, no una decisión del modelo |

Si quieres la integración Gmail → análisis → PR, está en [`../company-brain/demo/`](../company-brain/demo/). Es otra demo, con otros requisitos. El prototipo visual no forma parte de este recorrido.

## Antes de empezar

- Node.js **22 o superior**.
- Git para mostrar el diff.
- Editor y terminal. No hay dependencias que instalar ni servidor que iniciar.
- Para respuestas reales: endpoint HTTPS compatible con Chat Completions, modelo y API key.

Desde una copia del repositorio:

```bash
git clone https://github.com/gilbertsahumada/youtube-tutorials.git
cd youtube-tutorials/videos/company-brain-code/demo
node --version
npm test
npm run reset
```

`reset` copia la memoria inicial desde `seed/` a `workspace/`. **Borra únicamente el estado y los outputs de esta demo**; úsalo antes de una toma nueva, no si quieres conservar la toma anterior.

## 1. Primero muestra qué sabe la empresa

Abre estos archivos en el editor:

| Archivo en `workspace/` | Qué representa |
|---|---|
| `brain/project.json` | Proyecto, entrega, requisito y referencias a decisión/issue |
| `brain/agreement.json` | Acuerdo vigente, versión, fuente y antecedentes |
| `brain/issue.json` | Trabajo que depende de ese acuerdo |
| `brain/slack.json` | Una sugerencia, no una decisión aprobada |
| `brain/rules.md` | Procedimiento para revisar y actualizar acuerdos |

```bash
npm run show
```

En `agreement.json`, detente en tres campos:

```json
{
  "version": 1,
  "current": { "format": "CSV", "status": "approved" },
  "history": []
}
```

Es un extracto del archivo, no su contenido completo. La fuente y la evidencia también están registradas.

**Qué explicar:** “No guardé un bloque de texto que dice CSV. Guardé una decisión vigente, su fuente y la relación con el trabajo que depende de ella.”

No hace falta una base de grafos: `projectId`, `decisionId` e `issueId` ya expresan relaciones explícitas en este ejemplo pequeño.

## 2. Muestra lo que realmente recibe el LLM

```bash
npm run context
```

Abre:

```text
output/before-context.json
output/before-messages.json
```

En [`demo/src/memory.mjs`](demo/src/memory.mjs), muestra `buildContext` y `buildMessages`:

- El código lee los registros conocidos de **un proyecto**.
- Cada fuente tiene un ID y una ruta.
- El snapshot identifica la versión del acuerdo vigente.
- El mensaje de sistema define cómo distinguir decisión, sugerencia e historial.
- La pregunta y las fuentes viajan en el mensaje de usuario como datos.

Esta demo usa **selección explícita de contexto**, no embeddings, búsqueda semántica ni recuperación de miles de documentos. Para un proyecto pequeño, enviar estos registros es suficiente para enseñar el mecanismo.

**Qué explicar:** “El modelo no está leyendo mi disco. Mi código construye el contexto que le envío.”

## 3. Haz la primera pregunta

La pregunta predeterminada es siempre la misma:

> ¿Qué formato de exportación acordamos y qué trabajo necesita revisión?

### Recorrido sin credenciales

```bash
npm run ask:fixture
```

La plantilla responde, en esencia:

> El acuerdo vigente es CSV. El issue coincide con el acuerdo. Excel continúa siendo una sugerencia.

**Esto no es una respuesta de un LLM.** Sirve para ensayar la grabación y comprobar los cambios de estado. El comando lo indica y el archivo guarda `"mode": "fixture"`.

### Recorrido con un LLM real

```bash
cp .env.example .env
```

Edita `.env`, sin mostrar tu API key en cámara:

```dotenv
MODEL_BASE_URL=https://maas.qwencloudapi.com/compatible-mode/v1
MODEL_ID=deepseek-v4.1-flash
MODEL_API_KEY=TU_CLAVE
```

Es un ejemplo configurable, no un proveedor obligatorio. Usa la URL base de tu proveedor: el código añade `/chat/completions`. `MODEL_ID` es el ID del endpoint, sin un prefijo de provider de Pi.

```bash
npm run ask
```

Muestra [`demo/src/model.mjs`](demo/src/model.mjs): construye un `POST` con el modelo y los mensajes. **No hay tools ni un agente con acceso al disco.** La API key va en el header y no se guarda en los outputs.

Para el LLM real se guardan:

```text
output/before-request.json   # Body del POST, sin headers ni API key
output/before-answer.json    # Respuesta con mode: llm y fuentes citadas
```

La redacción variará. Comprueba que se apoye en el acuerdo vigente y no convierta Excel en una decisión. Si el proveedor falla, el comando falla: **no sustituye silenciosamente el LLM por la fixture**.

## 4. Llega información nueva, pero no cambia todavía el acuerdo

Abre `fixtures/event.json`. Contiene el correo ficticio, su evidencia literal y sus campos ya normalizados:

> confirmamos PDF en lugar de CSV para exportar-reportes

```bash
npm run ingest
npm run show
npm run diff
```

Aparecen dos archivos nuevos:

```text
workspace/events/email-pdf.json
workspace/proposal.json
```

La propuesta registra PDF, la versión base y el issue afectado. **`workspace/brain/agreement.json` sigue en CSV, versión 1.** El diff de la memoria sigue vacío.

Muestra `makeProposal` en [`demo/src/memory.mjs`](demo/src/memory.mjs): comprueba alcance, formato permitido, fecha y evidencia literal antes de proponer. No interpreta libremente un correo; recibe el evento estructurado de esta fixture.

Repite la consulta con el mismo modo del paso anterior:

```bash
npm run ask:fixture
# O, si configuraste un modelo real:
# npm run ask
```

En esta fase el contexto incluye el correo y la propuesta. La respuesta esperada es **CSV sigue vigente; PDF espera revisión humana**. Las salidas quedan en `output/pending-*`.

**Qué explicar:** “Que exista información nueva no significa que ya haya reemplazado una decisión aprobada.”

## 5. Aprueba tú y muestra los datos que cambian

Revisa primero `workspace/proposal.json` y el correo. Después:

```bash
npm run approve -- --yes --reviewer "Gilbert"
npm run diff
```

`approve` exige confirmación explícita y un reviewer. Revalida la propuesta contra el evento y la versión de la memoria. El código escribe en una ruta fija, no en una ruta elegida por el LLM.

El diff debe mostrar:

- `version`: **1 → 2**.
- `current.format`: **CSV → PDF**.
- Evidencia, fuente y aprobación del nuevo acuerdo.
- CSV conservado en `history` como `superseded`.
- **Ningún cambio** en `issue.json` ni en `slack.json`.

Muestra `approveProposal` en el código. La actualización es una operación ordinaria de JavaScript; **no la realiza el modelo**.

El diff usa `git diff --no-index` entre `seed/brain/` y `workspace/brain/`. No crea una rama, un commit ni un PR, y no requiere modificar el checkout del tutorial. El script trata el exit code 1 de Git como “hay diferencias”, no como un fallo de la demo.

## 6. Misma pregunta, memoria distinta

```bash
npm run context
npm run ask:fixture
# O el mismo modelo real usado antes:
# npm run ask
```

Abre juntos:

```text
output/before-messages.json   output/after-messages.json
output/before-answer.json     output/after-answer.json
```

La instrucción y la pregunta son las mismas. Cambió el contexto: PDF vigente, CSV histórico y un issue que todavía pide CSV.

La plantilla responde, en esencia:

> El acuerdo vigente es PDF, versión 2. El issue todavía solicita CSV y requiere revisión humana. Excel continúa siendo una sugerencia.

Con un LLM real, ese es el **comportamiento que buscamos**, no una transcripción garantizada. Revisa la salida real en vez de narrar una respuesta que el modelo no dio.

El programa verifica que los IDs citados existan entre las fuentes suministradas. Eso evita referencias desconocidas, **pero no demuestra que la interpretación sea correcta**.

**Frase de cierre:** “No entrené otra vez el modelo. Actualicé una memoria con fuentes e historial, reconstruí el contexto y le hice la misma pregunta.”

## Recorrido recomendado para grabar

| Momento | En pantalla | Qué debe quedar claro |
|---|---|---|
| 1 | Acuerdo CSV, issue CSV y sugerencia Excel | Estado inicial, no un chatbot vacío |
| 2 | `buildContext`, `buildMessages` y mensajes JSON | El código decide qué recibe el modelo |
| 3 | Consulta inicial y citas | Respuesta apoyada en la memoria vigente |
| 4 | Evento, propuesta pendiente y consulta intermedia | Información nueva no equivale a actualización aprobada |
| 5 | Comando de aprobación y diff | Cambian datos concretos; se conserva el historial |
| 6 | La misma pregunta después | PDF vigente; el issue desactualizado sigue visible |

Para el video con respuestas del LLM, usa `ask` en las tres consultas. Para ensayar sin cuentas, usa `ask:fixture` en las tres. **No mezcles respuestas simuladas y reales sin anunciarlo.**

## Qué hemos construido, y qué no

Sí mostramos repositorio de conocimiento, memoria estructurada, relaciones explícitas, incorporación de un evento y respuestas basadas en contexto actualizado.

No mostramos entrenamiento del modelo, RAG vectorial, clasificación automática de correos, permisos por área, conectores reales ni un agente autónomo. El evento entra por un comando manual y la única acción externa es `ask` al proveedor elegido.

Límites importantes:

- Usa datos ficticios. `ask` envía el contexto completo de esta demo al proveedor.
- El correo, las citas y la allowlist del ejemplo no prueban criptográficamente quién aprobó un acuerdo.
- El reviewer es una etiqueta local; no hay autenticación ni control de acceso empresarial.
- Los prompts y las validaciones no eliminan prompt injection ni alucinaciones.
- Ejecuta una sola instancia. Los archivos se reemplazan de forma individual; no hay transacción entre ambos archivos ni bloqueo multiusuario. Repetir la aprobación recupera el estado si se interrumpió entre guardar el acuerdo y guardar la propuesta.
- `.env`, `workspace/` y `output/` se ignoran en Git. Conserva las respuestas fuera de esas carpetas solo después de revisar que no contengan secretos o datos privados.
- Las pruebas y el ensayo con fixtures **no verifican la calidad de un proveedor real**. Esa parte requiere tu configuración y revisar las respuestas antes de grabar.

## Mapa de archivos

```text
company-brain-code/
├── README.md                  # Este recorrido, compañero del video
└── demo/
    ├── seed/brain/             # Memoria inicial reproducible
    ├── fixtures/event.json    # Correo ficticio ya normalizado
    ├── src/memory.mjs          # Propuestas, aprobación, contexto y citas
    ├── src/model.mjs           # Adaptador HTTP al LLM
    ├── src/cli.mjs             # Comandos y escritura local
    ├── test/                  # Invariantes y API simulada
    ├── .env.example           # Configuración sin secretos
    ├── workspace/             # Generado; memoria que cambia en pantalla
    └── output/                # Generado; contexto, requests y respuestas
```

Para preparar otra toma: guarda los outputs que quieras conservar y ejecuta `npm run reset`.
