# Company Brain: de un correo a una propuesta en un issue

Esta es la única demo de Company Brain del repositorio. Reúne **Gmail real, un issue real de GitHub y un LLM** para conectar información nueva con trabajo existente.

El objetivo no es que el modelo cambie una tarea por su cuenta. Es que detecte una solicitud relevante, deje evidencia y proponga un cambio que una persona pueda revisar.

```text
Correo inicial: acordamos CSV ──┐
                               ├─ contexto del proyecto
Issue inicial: implementar CSV ┘
            ↓
Nuevo correo: prioricemos PDF en lugar de CSV
            ↓ polling local
LLM analiza los dos correos y el issue
            ↓ validación en código
Comentario en el issue: evidencia + propuesta + revisión pendiente
```

**Una solicitud no es una aprobación.** El issue continúa en CSV hasta que una persona decida cambiarlo. El programa no edita tareas, prioridades, etiquetas o acuerdos; no crea ramas, commits ni PRs.

## Qué hace cada parte

| Parte | Responsabilidad |
|---|---|
| Gmail | Fuente del acuerdo inicial y de la nueva solicitud |
| GitHub | Tarea existente y destino del comentario |
| LLM | Identificar el formato inicial, la solicitud y sus extractos de evidencia; explicar el cambio propuesto |
| JavaScript | Limitar remitente, proyecto e issue, validar evidencia, preparar el comentario y publicarlo |
| Tú | Revisar la propuesta y decidir qué cambiar después |

El modelo no tiene tools ni acceso directo a las cuentas: recibe datos en una petición Chat Completions. El código controla las APIs y el único endpoint de escritura es el de comentarios del issue configurado.

## Requisitos

- Node.js **22 o superior**; no hay dependencias que instalar ni servidor persistente que iniciar.
- GitHub CLI (`gh`) autenticado. Usa un **repositorio sandbox privado**, no producción.
- Cuenta Gmail de prueba, otro correo desde el que enviar los dos mensajes y proyecto Google Cloud con Gmail API/OAuth.
- Proveedor HTTPS compatible con Chat Completions, modelo y API key.
- Bash en macOS, Linux o WSL.

El modelo recibe el contenido de los correos y el issue: usa datos ficticios. La integración real puede generar cargos. El video conceptual está en [YouTube](https://youtu.be/uB21nWjsx50) y los enfoques se explican en el [artículo de Company Brain](https://www.gilbertsahumada.com/blog/que-es-un-company-brain-y-como-puedes).

## 1. Preparar el entorno y comprobar el ejemplo sin cuentas

```bash
git clone https://github.com/gilbertsahumada/youtube-tutorials.git
cd youtube-tutorials/videos/company-brain/demo
node --version
npm test
npm run preview
```

Todos los comandos siguientes se ejecutan desde `videos/company-brain/demo/`. Si ya tienes el repositorio, entra directamente en esa carpeta.

`preview` usa dos correos, un issue y análisis preparados como fixtures —datos simulados—. No llama a Gmail, GitHub ni al LLM, ni publica aunque `PUBLISH=true`. Genera:

- `output/fixture.json`: contexto, análisis y plan.
- `output/fixture-comment.md`: comentario que propondría publicar.

Comprueba que el comentario cite el acuerdo CSV, la petición PDF y diga **pendiente de revisión humana**. Esto prueba el recorrido, no la calidad de un modelo real. Los pasos siguientes conectan las cuentas.

## 2. Crear el issue inicial en GitHub

```bash
gh auth status
# Sustituye TU_USUARIO. El repositorio no debe existir todavía.
gh repo create TU_USUARIO/company-brain-sandbox --private

gh issue create --repo TU_USUARIO/company-brain-sandbox \
  --title "Implementar exportación CSV" \
  --body $'Proyecto: portal-cliente\nEntrega: entrega-1\nRequisito: exportar-reportes\nFormato actual: CSV\n\nImplementar exportación CSV.\n\nAceptación: generar un archivo CSV descargable con los datos del reporte.'
```

Guarda el número que aparece en la URL del issue. No hay que subir un repositorio de memoria ni crear un commit inicial: para este caso el contexto es el correo inicial y la tarea.

Las líneas `Proyecto`, `Entrega`, `Requisito` y `Formato actual` son parte del contrato de la demo. El código las valida contra `config/project.json` para no comentar sobre otra tarea. No cambies esos identificadores a mitad del recorrido.

## 3. Configurar Gmail de solo lectura y el modelo

```bash
cp .env.example .env
```

En Google Cloud:

1. Activa **Gmail API** en un proyecto de prueba.
2. Configura la pantalla OAuth. En modo testing, añade la cuenta receptora como test user.
3. Crea un cliente OAuth de tipo **Desktop app**.
4. Copia el client ID y secret a `.env`.

En Gmail crea la etiqueta `company-brain-demo` y un filtro para aplicarla al remitente de prueba cuando el asunto contenga `company-brain-demo`. También puedes aplicar la etiqueta manualmente a ambos mensajes.

Completa `.env`:

```dotenv
GOOGLE_CLIENT_ID=TU_CLIENT_ID
GOOGLE_CLIENT_SECRET=TU_CLIENT_SECRET
GMAIL_LABEL=company-brain-demo
ALLOWED_SENDER=correo-del-remitente-de-prueba@example.com
GMAIL_AFTER=FECHA_ISO_ANTES_DEL_PRIMER_CORREO
GMAIL_INITIAL_MESSAGE_ID=
GITHUB_REPO=TU_USUARIO/company-brain-sandbox
GITHUB_ISSUE_NUMBER=1
POLL_SECONDS=30
PUBLISH=false
MODEL_BASE_URL=https://maas.qwencloudapi.com/compatible-mode/v1
MODEL_ID=deepseek-v4.1-flash
MODEL_API_KEY=TU_CLAVE
```

Usa el número real del issue. Para obtener una fecha ISO:

```bash
node -e 'console.log(new Date().toISOString())'
```

Guárdala en `GMAIL_AFTER` **antes de enviar el correo inicial**. No pegues literalmente los placeholders. El endpoint y modelo son un ejemplo: puedes usar otro servicio compatible. `MODEL_ID` es el ID del modelo, sin prefijo de provider. La URL base debe usar HTTPS; el código añade `/chat/completions`.

Autoriza Gmail:

```bash
npm run gmail:login
```

Abre la URL que imprime y autoriza la cuenta receptora de prueba. El callback local es temporal, con state y PKCE; no es una interfaz de la demo. El refresh token queda en `.private/gmail-token.json`, ignorado por Git.

**El scope `gmail.readonly` puede leer el buzón completo.** La etiqueta, el remitente y la fecha son filtros del programa, no restricciones OAuth. Usa una cuenta dedicada. No se solicitan permisos para enviar, borrar ni modificar mensajes.

## 4. Enviar y capturar el correo inicial

Desde el remitente configurado, envía este mensaje a la cuenta receptora:

**Asunto:** `company-brain-demo — acuerdo inicial`

```text
Para el proyecto portal-cliente, entrega-1, acordamos CSV para exportar-reportes.
La primera entrega debe permitir descargar los reportes en CSV.
```

Comprueba que tiene la etiqueta. Lista los correos disponibles:

```bash
npm run inbox
```

La salida contiene `id`, remitente, asunto y fecha. Copia el `id` del correo inicial a `GMAIL_INITIAL_MESSAGE_ID` en `.env`. Es el **ID de Gmail API**, no el identificador RFC Message-ID ni un fragmento de la URL del navegador.

Captura el contexto:

```bash
npm run baseline
```

Este comando consulta el correo y el issue, pide al LLM identificar el formato y comprueba que ambos coincidan en CSV. Guarda:

- `.private/baseline.json`: correo inicial, evidencia, proyecto y snapshot inicial del issue.
- `output/initial-context.json`: datos enviados al modelo y su análisis.

No escribe en GitHub. Comprueba `initialFormat: "CSV"` y que los IDs del proyecto, entrega y requisito sean correctos. Esta captura permite comparar la nueva petición con una fuente concreta, no con un supuesto acuerdo inventado.

La captura no se sobrescribe automáticamente. Si cambias cuenta, configuración, repo, issue o correo inicial, usa otra copia de la demo con su propio `.env` y estado.

## 5. Enviar la nueva solicitud y revisar sin publicar

Desde el mismo remitente, envía:

**Asunto:** `company-brain-demo — cambio de prioridad`

```text
Para el proyecto portal-cliente, entrega-1, necesito que prioricemos PDF en lugar de CSV para exportar-reportes.
Por favor planteen el cambio y su impacto antes de modificar el alcance.
```

Este mensaje **pide un cambio; no afirma que ya esté aprobado**. Debe tener la etiqueta y una fecha posterior al correo inicial.

Con `PUBLISH=false`:

```bash
npm run once
```

El sistema lee la nueva solicitud y el estado actual del issue, envía ambos correos y la tarea al LLM, valida los extractos y prepara el comentario. El acuerdo inicial solo aporta contexto; el correo inicial no se procesa como una nueva solicitud.

Revisa los archivos `output/<clave>.json` y `output/<clave>-comment.md`. La clave es un hash del ID del mensaje; no tiene que coincidir con el ejemplo fixture.

El comentario debe contener:

1. El formato que solicita el issue: CSV.
2. Remitente, fecha, ID y evidencia del correo inicial.
3. Remitente, fecha, ID y evidencia de la petición PDF.
4. Propuesta de revisar el requisito y los criterios de aceptación.
5. Advertencia de revisión humana pendiente, sin declarar PDF como acuerdo vigente.

Hasta aquí **no debe aparecer un comentario nuevo en GitHub**. Una petición ambigua, de otro alcance o con evidencia inventada se omite o provoca un error. Los errores del proveedor no se sustituyen por fixtures.

## 6. Publicar solo el comentario

Después de revisar el preview, cambia en `.env`:

```dotenv
PUBLISH=true
```

Ejecuta de nuevo:

```bash
npm run once
```

Abre el issue. Debe aparecer un comentario similar a:

> El issue solicita CSV. Se recibió un correo pidiendo priorizar PDF para esta entrega. Propongo revisar el requisito y los criterios de aceptación. **Pendiente de revisión humana.**

La explicación del LLM puede variar; las citas deben corresponder a los correos reales. El código comprueba que cada evidencia sea un extracto literal y que el formato pertenezca al alcance. Esto no demuestra que toda la interpretación sea correcta: revisa el comentario.

Comprueba también que el título, la descripción, el formato, los criterios, las etiquetas y el estado del issue **no cambiaron** y que no se creó un PR. La nueva solicitud quedó vinculada al trabajo, no aplicada silenciosamente.

El programa guarda el resultado en `.private/state.json`. Repetir `once` no debe duplicar el comentario ni volver a clasificar mensajes ya procesados. Si hubo un timeout después de publicarlo, recupera el comentario de la misma cuenta mediante un marcador por mensaje y paginación.

## 7. Observar la llegada de mensajes automáticamente

`once` realiza una iteración. Para comprobar periódicamente Gmail:

```bash
npm run watch
```

Con `PUBLISH=true`, consulta cada 30 segundos y comenta nuevas solicitudes válidas. Para observar la detección de una llegada nueva, inicia el watcher después de capturar el contexto inicial y **antes de enviar la segunda solicitud**. Un correo ya procesado no se reprocesa.

Detén el proceso con `Ctrl+C`. No hay aprobaciones automáticas ni un PR pendiente que bloquearía el watcher: cada propuesta vive en el comentario de su issue. La decisión y cualquier edición posterior son humanas.

## Código y archivos

| Archivo | Qué hace |
|---|---|
| `config/project.json` | Define un solo proyecto, entrega, requisito y formatos permitidos |
| `src/gmail-login.mjs`, `src/gmail.mjs` | OAuth de solo lectura, filtro y lectura de mensajes |
| `src/plan.mjs` | Prompt, análisis del LLM, validaciones y comentario con evidencia |
| `src/github.mjs` | Lee el issue y publica únicamente un comentario |
| `src/pipeline.mjs` | Excluye correo inicial, evita reprocesar y coordina el flujo |
| `src/main.mjs` | Comandos, outputs, captura inicial y polling |
| `fixtures/`, `test/` | Ejemplo sin cuentas y pruebas con APIs simuladas |

`.env`, `.private/` y `output/` se ignoran en Git. Contienen credenciales o contenidos de correo; no los publiques. Los outputs se reemplazan al analizar otra vez el mismo mensaje: conserva una copia antes de repetir si quieres comparar resultados.

## Fallos, permisos y límites

- **Correo no visible:** comprueba etiqueta, remitente único, texto plano y fecha posterior a `GMAIL_AFTER`. Se ignoran HTML, adjuntos y cuerpos de más de 20 000 caracteres. La ventana admite hasta 500 mensajes.
- **Issue no relacionado:** conserva las líneas de identificación y un único `Formato actual: CSV` o `PDF`. Un PR o un issue cerrado no son destinos válidos.
- **Cambio durante el análisis:** antes de publicar se comprueba de nuevo el texto y estado del issue. Si cambió, reintenta con contexto actualizado. No es una transacción: sigue siendo una propuesta advisory.
- **Error OAuth/401:** revisa cuentas, claves y scopes; reautoriza si expiró el token. El modelo necesita credenciales de API, no solo una suscripción a un chat web.
- **Allowlist:** la dirección `From` no autentica criptográficamente a una persona. La demo no es un sistema de aprobación empresarial ni elimina prompt injection.
- **Permisos GitHub:** `gh` usa tu sesión; el límite del programa no restringe el token. Usa un sandbox y, cuando sea posible, un token con acceso solo a ese repo e Issues de escritura. No se necesitan escrituras de contenidos para ejecutar el flujo, aunque crear el sandbox requiere permisos adicionales.
- **Una instancia:** `.private/watch.lock` evita concurrencia local. Si el proceso terminó abruptamente, verifica que no haya otro antes de retirar el lock. No existe exactly-once distribuido entre distintas copias.
- **Estado antiguo:** los estados del flujo anterior con PRs no son compatibles; usa otra copia de la demo y conserva los archivos anteriores. No reutilices tokens o estado de un sandbox ajeno.
- **Llamadas y costes:** `baseline` y cada solicitud nueva consultan el modelo. Repetir `once` en preview puede repetir el análisis porque no marca procesados. El modo fixture no llama a ningún proveedor y las pruebas no verifican la calidad real de su interpretación.

Para el caso inverso, prepara correo e issue iniciales con PDF y envía una solicitud de CSV; ambos formatos están permitidos. El código no cambia de proyecto ni de issue por sugerencia del modelo.
