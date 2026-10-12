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

**Objetivo:** tener una tarea de prueba que pida CSV, sin tocar un proyecto real.

Comprueba la sesión de GitHub:

```bash
gh auth status
```

Si no estás autenticado, ejecuta `gh auth login` y completa el inicio de sesión antes de seguir. La cuenta que uses debe poder crear el sandbox y comentar en sus issues.

Crea el repositorio y la tarea. Si ya hiciste este paso, no los crees de nuevo: conserva su nombre y número para el paso 5.

```bash
# Sustituye TU_USUARIO. El repositorio no debe existir todavía.
gh repo create TU_USUARIO/company-brain-sandbox --private

gh issue create --repo TU_USUARIO/company-brain-sandbox \
  --title "Implementar exportación CSV" \
  --body $'Proyecto: portal-cliente\nEntrega: entrega-1\nRequisito: exportar-reportes\nFormato actual: CSV\n\nImplementar exportación CSV.\n\nAceptación: generar un archivo CSV descargable con los datos del reporte.'
```

**Resultado:** GitHub imprime la URL de un issue abierto titulado «Implementar exportación CSV». Ábrelo y comprueba su descripción. Guarda el número que aparece al final de la URL para el paso 5. No hay que subir un repositorio de memoria ni crear un commit inicial: para este caso el contexto es el correo inicial y la tarea.

Las líneas `Proyecto`, `Entrega`, `Requisito` y `Formato actual` son parte del contrato de la demo. El código las valida contra `config/project.json` para no comentar sobre otra tarea. No cambies esos identificadores a mitad del recorrido.

## 3. Conectar Gmail y preparar la lectura de correos

**Objetivo:** autorizar la cuenta que recibirá los mensajes y definir cuáles debe leer el programa. En este paso todavía no necesitas configurar el modelo ni las variables de GitHub.

### 3.1. Elegir las dos cuentas y crear `.env`

Distingue estos dos papeles:

| Cuenta | Qué harás con ella |
|---|---|
| **Receptora: Gmail de prueba** | Recibirá los dos mensajes. Aquí crearás la etiqueta y esta es la cuenta que autorizarás para que el programa lea su buzón. |
| **Remitente: otro correo tuyo** | Enviará los dos mensajes. Su dirección irá en `ALLOWED_SENDER`. No tienes que autorizar esta cuenta al programa. |

Usa cuentas que controles y contenido ficticio. En `ALLOWED_SENDER` escribirás la dirección de correo del remitente, no su nombre de contacto ni un nombre de usuario.

Desde `videos/company-brain/demo/`, crea `.env` **solo si aún no existe**:

```bash
[ -f .env ] || cp .env.example .env
```

Abre `.env` en tu editor. No vuelvas a copiar la plantilla encima de un archivo que ya completaste: perderías sus valores. Los bloques siguientes indican qué líneas editar; no son comandos de terminal.

**No hay que completar todo de golpe.** Por ahora deja `GMAIL_INITIAL_MESSAGE_ID=` vacío, conserva `POLL_SECONDS=30` y `PUBLISH=false`, y no uses todavía los placeholders de GitHub o del modelo.

### 3.2. Obtener las dos credenciales de Google

En [Google Cloud Console](https://console.cloud.google.com/), selecciona o crea un proyecto de prueba:

1. En **APIs y servicios → Biblioteca**, busca **Gmail API** y actívala.
2. Configura la pantalla de consentimiento OAuth (puede aparecer como **Google Auth Platform**). Para una cuenta personal, usa audiencia **External**, en modo **Testing**, y añade la dirección de la **cuenta receptora** como test user.
3. En los permisos/scopes de acceso a datos, incluye `https://www.googleapis.com/auth/gmail.readonly`.
4. En **Credenciales / Clients**, crea un cliente OAuth de tipo **Desktop app / Aplicación de escritorio**.
5. Copia su **Client ID** y **Client secret** a estas dos líneas de `.env`:

```dotenv
GOOGLE_CLIENT_ID=PEGA_AQUI_EL_CLIENT_ID_REAL
GOOGLE_CLIENT_SECRET=PEGA_AQUI_EL_CLIENT_SECRET_REAL
```

Sustituye los textos de ejemplo por los valores de Google. **No son tu dirección ni tu contraseña de Gmail, ni una API key del modelo.** No compartas el secret ni el archivo `.env`.

### 3.3. Autorizar la cuenta receptora

Con esas dos variables ya completadas, ejecuta:

```bash
npm run gmail:login
```

**Este comando solo requiere `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`.** No necesita todavía `GMAIL_AFTER`, el ID del correo, GitHub ni el modelo.

1. Abre la URL que imprime la terminal.
2. Selecciona la **cuenta receptora de prueba**, no la remitente.
3. Revisa el permiso de lectura y autoriza tu aplicación de prueba.
4. Vuelve a la terminal: debe confirmar que guardó el refresh token. Si aparece un bloqueo de OAuth, revisa que la cuenta receptora esté añadida como test user; no continúes hasta resolverlo.

**Resultado:** existe `.private/gmail-token.json`. Ese archivo permite renovar el acceso sin iniciar sesión en cada consulta. No tienes que copiar su contenido a `.env` ni publicarlo.

El callback local es temporal, con state y PKCE; no es una interfaz de la demo. **El scope `gmail.readonly` permite leer el buzón completo.** La etiqueta, el remitente y la fecha son filtros del código, no restricciones OAuth. No se solicitan permisos para enviar, borrar ni modificar mensajes.

### 3.4. Crear la etiqueta y elegir el remitente permitido

En Gmail web, dentro de la **cuenta receptora**:

1. En el menú izquierdo, junto a **Etiquetas**, pulsa **+** (o **Más → Crear etiqueta nueva**).
2. Crea una etiqueta llamada exactamente `company-brain-demo`.
3. En la barra de búsqueda, abre **Mostrar opciones de búsqueda**.
4. En **De / From**, escribe la dirección de tu cuenta remitente.
5. En **Asunto / Subject**, escribe `company-brain-demo`.
6. Pulsa **Crear filtro**, marca **Aplicar la etiqueta**, elige `company-brain-demo` y confirma **Crear filtro**.

Así se etiquetarán automáticamente los dos correos cuando lleguen. Si prefieres no crear el filtro, aplica la etiqueta manualmente a **cada uno** antes de ejecutar los scripts; crear solo la etiqueta no etiqueta ningún mensaje.

Edita estas líneas de `.env`:

```dotenv
GMAIL_LABEL=company-brain-demo
ALLOWED_SENDER=LA_DIRECCION_REAL_DESDE_LA_QUE_ENVIARAS_LOS_CORREOS
```

Reemplaza el segundo valor por la dirección real de tu cuenta remitente. No uses `cliente@example.com`: es una dirección ficticia de los ejemplos. No pongas la dirección de la cuenta receptora. Conserva el nombre de etiqueta tal como lo creaste.

### 3.5. Definir desde qué momento leer mensajes (`GMAIL_AFTER`)

`GMAIL_AFTER` significa **«ignora los correos recibidos antes de este momento»**. Sirve para no procesar mensajes antiguos de la misma etiqueta. No es una credencial.

**Si todavía no enviaste el correo inicial**, ejecuta ahora:

```bash
node -e 'console.log(new Date().toISOString())'
```

El comando imprime la fecha y hora actuales en formato ISO, que el programa puede interpretar. Por ejemplo:

```text
2026-01-16T12:34:56.789Z
```

`T` separa la fecha de la hora; `Z` indica hora UTC. No tienes que convertirla a tu zona horaria ni escribirla a mano.

1. Copia **la salida real del comando**, no el comando ni la fecha del ejemplo.
2. Pégala después de `GMAIL_AFTER=` en `.env`, sin espacios. Si el comando hubiera impreso la fecha anterior, la línea quedaría así:

   ```dotenv
   GMAIL_AFTER=2026-01-16T12:34:56.789Z
   ```

3. Guarda `.env`.
4. **Envía el primer correo después de guardar este valor**, en el paso 4.

Conserva ese mismo valor durante todo el recorrido. Si vuelves a generar la fecha después de recibir el primer correo, lo excluirás de la lectura.

**Si ya enviaste el correo inicial:** no uses la hora actual como corte. Pon una fecha anterior a su recepción. Para obtener, por ejemplo, la fecha de hace 24 horas:

```bash
node -e 'console.log(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())'
```

Usa esa salida **solo si el correo llegó en las últimas 24 horas**; para uno más antiguo, elige un corte anterior a su llegada. Si necesitas aplicar la etiqueta a un correo ya recibido, hazlo manualmente o selecciona «aplicar también a las conversaciones coincidentes» al crear el filtro.

**Antes de continuar:** debes tener `.private/gmail-token.json`, la etiqueta creada y estas cinco variables completas: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GMAIL_LABEL`, `ALLOWED_SENDER` y `GMAIL_AFTER`. El ID del correo sigue vacío. `PUBLISH` sigue en `false`.

## 4. Enviar el correo inicial y obtener su ID

**Objetivo:** establecer por correo el acuerdo inicial de **CSV**, coherente con el issue, y comprobar que el programa puede leerlo. La petición de PDF se enviará después de capturar este contexto.

### 4.1. Redactar y enviar este correo

Abre la **cuenta remitente**, pulsa **Redactar** y prepara un correo nuevo con estos campos:

| Campo | Qué poner |
|---|---|
| **De** | La dirección real que configuraste en `ALLOWED_SENDER` |
| **Para** | La dirección real de la **cuenta Gmail receptora que autorizaste** con `gmail:login` |

**Asunto — copia este texto:**

```text
company-brain-demo — acuerdo inicial
```

**Cuerpo — copia este texto:**

```text
Para el proyecto portal-cliente, entrega-1, acordamos CSV para exportar-reportes.

La primera entrega debe permitir descargar los reportes en CSV.
```

Conserva `portal-cliente`, `entrega-1` y `exportar-reportes` exactamente así: identifican el proyecto, la entrega y el requisito que el código relaciona con el issue. No necesitas adjuntos ni mencionar PDF en este primer mensaje.

Pulsa **Enviar**. Este envío lo haces tú desde tu correo: el script solo tiene permisos de lectura y no envía mensajes. **No cambies `GMAIL_AFTER`** después de enviar: debe seguir siendo anterior a la recepción de este correo.

### 4.2. Comprobar la recepción y listar el mensaje

Abre el mensaje en la **cuenta receptora** y comprueba que tiene el asunto anterior, el cuerpo que copiaste y la etiqueta `company-brain-demo`. Si no creaste el filtro, aplícala ahora manualmente.

Desde `videos/company-brain/demo/`, lista los mensajes que cumplen los filtros:

```bash
npm run inbox
```

**Este comando no llama al modelo ni a GitHub.** Usa las cinco variables de Gmail del paso 3 y el token guardado al autorizar.

Debe aparecer un objeto con `id`, `from`, `subject` y `date` del mensaje inicial. Si ves `[]`, no continúes: comprueba que autorizaste la cuenta receptora correcta, que el mensaje tiene la etiqueta, que `from` coincide con `ALLOWED_SENDER` y que llegó después de `GMAIL_AFTER`.

### 4.3. Guardar el ID del correo inicial

Copia el valor de `id` de ese mensaje, **sin las comillas del JSON**, a la línea `GMAIL_INITIAL_MESSAGE_ID=` de `.env` y guarda el archivo. Por ejemplo, si la salida contiene `"id": "18abcdef12345678"`, escribe:

```dotenv
GMAIL_INITIAL_MESSAGE_ID=18abcdef12345678
```

Usa tu ID real, no el ejemplo. Es el **ID de Gmail API**, no el identificador RFC Message-ID ni un fragmento de la URL del navegador. No lo conocías antes porque el mensaje todavía no existía.

**Resultado:** `inbox` muestra el correo inicial y `.env` ya contiene su ID. Aún no se ha capturado el contexto ni se ha escrito en GitHub.

## 5. Configurar GitHub y el modelo, y capturar el contexto inicial

### 5.1. Indicar dónde está el issue

Edita estas dos líneas de `.env` usando el repositorio y el issue que creaste en el paso 2:

```dotenv
GITHUB_REPO=TU_USUARIO/company-brain-sandbox
GITHUB_ISSUE_NUMBER=NUMERO_REAL_DEL_ISSUE
```

`GITHUB_REPO` es `owner/repo`, **sin** `https://github.com/`. Si la URL del issue termina en `/issues/3`, pon `GITHUB_ISSUE_NUMBER=3`, no `1`.

GitHub se autentica mediante la sesión de `gh`, no mediante las credenciales de Google. Comprueba que puedes leer el destino, sustituyendo los argumentos por tus valores reales:

```bash
gh auth status
gh issue view NUMERO_REAL_DEL_ISSUE --repo TU_USUARIO/company-brain-sandbox
```

**Resultado:** ves el issue abierto que pide CSV y sus líneas de proyecto, entrega, requisito y formato. Si no puedes leerlo, corrige la cuenta o los permisos antes de continuar.

### 5.2. Configurar el proveedor del modelo

Ahora sí, completa las tres variables del modelo. Este bloque es un ejemplo para un endpoint compatible de DashScope:

```dotenv
MODEL_BASE_URL=https://maas.qwencloudapi.com/compatible-mode/v1
MODEL_ID=deepseek-v4.1-flash
MODEL_API_KEY=PEGA_AQUI_TU_API_KEY_REAL_DE_ESE_SERVICIO
```

- `MODEL_BASE_URL`: URL base HTTPS de la API de tu proveedor, no de su página de chat. El código añade `/chat/completions`; no lo añadas tú a la URL base.
- `MODEL_ID`: ID de un modelo disponible para tu cuenta, sin prefijo de provider. No uses `dashscope/deepseek-v4.1-flash` aquí.
- `MODEL_API_KEY`: clave de API válida para **ese endpoint**. No es el client secret de Google ni un token de GitHub. Una suscripción a un chat web no garantiza acceso a la API.

Puedes usar otro proveedor compatible con Chat Completions, pero cambia los tres valores como un conjunto. No dejes el endpoint del ejemplo si tu clave pertenece a otro servicio. No pegues tu clave en el README, en un issue ni en mensajes.

Conserva:

```dotenv
POLL_SECONDS=30
PUBLISH=false
```

`POLL_SECONDS` es el intervalo entre consultas cuando uses `watch`. `PUBLISH=false` impide escribir comentarios al ejecutar `once`. No lo cambies todavía.

### 5.3. Comprobar qué está configurado y capturar el contexto

En este punto **todas las variables de `.env` deben tener valores reales o los valores fijos indicados**. Ya no debe quedar vacío `GMAIL_INITIAL_MESSAGE_ID`, porque lo obtuviste en el paso 4.

| Comando | Configuración necesaria |
|---|---|
| `gmail:login` | Solo las dos credenciales OAuth de Google |
| `inbox` | Las cinco variables de Gmail del paso 3 y el token OAuth guardado |
| `baseline` | Todo lo anterior, ID del correo inicial, repo/issue, sesión `gh` y las tres variables del modelo |
| `once` | La misma configuración que `baseline` y la captura inicial guardada; `PUBLISH=false` para revisar sin publicar |
| `watch` | Lo mismo, pero con `PUBLISH=true` para publicar y `POLL_SECONDS` de al menos 10 |

Ejecuta:

```bash
npm run baseline
```

Este es el **primer comando del recorrido real que llama al LLM**. Lee el correo seleccionado y el issue, pide al modelo identificar el formato inicial y comprueba que ambos coincidan en CSV. No escribe en GitHub.

**Resultado esperado en la terminal:** `Contexto inicial capturado: CSV` y el número de tu issue. Guarda:

- `.private/baseline.json`: correo inicial, evidencia, proyecto y snapshot inicial del issue.
- `output/initial-context.json`: datos enviados al modelo y su análisis. También se guarda si el análisis no pasa la validación; su existencia por sí sola no significa que la captura haya sido aceptada.

Comprueba en `.private/baseline.json` que `initialFormat` sea `"CSV"`, que `initialEmail.id` sea el ID que seleccionaste y que el proyecto, entrega y requisito sean correctos. No compartas esos archivos: contienen información del correo.

Esta captura permite comparar la nueva petición con una fuente concreta, no con un supuesto acuerdo inventado. No se sobrescribe automáticamente. Si cambias cuenta, configuración del proyecto, repo, issue o correo inicial, usa otra copia de la demo con su propio `.env` y estado.

## 6. Enviar la nueva solicitud y revisar sin publicar

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

## 7. Publicar solo el comentario

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

## 8. Observar la llegada de mensajes automáticamente

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

- **Correo no visible:** sigue la comprobación del paso 4: cuenta receptora autorizada, etiqueta aplicada al mensaje, remitente único, texto plano y fecha posterior a `GMAIL_AFTER`. Crear una etiqueta no la aplica por sí solo a los mensajes. No actualices la fecha de corte después de recibir el correo inicial. Se ignoran HTML, adjuntos y cuerpos de más de 20 000 caracteres. La ventana admite hasta 500 mensajes.
- **Issue no relacionado:** conserva las líneas de identificación y un único `Formato actual: CSV` o `PDF`. Un PR o un issue cerrado no son destinos válidos.
- **Cambio durante el análisis:** antes de publicar se comprueba de nuevo el texto y estado del issue. Si cambió, reintenta con contexto actualizado. No es una transacción: sigue siendo una propuesta advisory.
- **Evidencia rechazada en `baseline`:** la cita del modelo debe tener al menos 20 caracteres, mencionar el formato y ser un extracto exacto del correo, incluidos espacios y saltos de línea. El error indica qué condición falló. Revisa `context.initialEmail.text` y `analysis.initialEvidence` en `output/initial-context.json`; el diagnóstico se guarda antes de validar, pero la captura solo se guarda si pasa los controles. No edites el diagnóstico para intentar aprobarlo ni cambies el acuerdo a mano. No compartas el archivo completo si contiene información privada.
- **Error OAuth/401:** revisa cuentas, claves y scopes; reautoriza si expiró el token. El modelo necesita credenciales de API, no solo una suscripción a un chat web.
- **Allowlist:** la dirección `From` no autentica criptográficamente a una persona. La demo no es un sistema de aprobación empresarial ni elimina prompt injection.
- **Permisos GitHub:** `gh` usa tu sesión; el límite del programa no restringe el token. Usa un sandbox y, cuando sea posible, un token con acceso solo a ese repo e Issues de escritura. No se necesitan escrituras de contenidos para ejecutar el flujo, aunque crear el sandbox requiere permisos adicionales.
- **Una instancia:** `.private/watch.lock` evita concurrencia local. Si el proceso terminó abruptamente, verifica que no haya otro antes de retirar el lock. No existe exactly-once distribuido entre distintas copias.
- **Estado antiguo:** los estados del flujo anterior con PRs no son compatibles; usa otra copia de la demo y conserva los archivos anteriores. No reutilices tokens o estado de un sandbox ajeno.
- **Llamadas y costes:** `baseline` y cada solicitud nueva consultan el modelo. Repetir `once` en preview puede repetir el análisis porque no marca procesados. El modo fixture no llama a ningún proveedor y las pruebas no verifican la calidad real de su interpretación.

Para el caso inverso, prepara correo e issue iniciales con PDF y envía una solicitud de CSV; ambos formatos están permitidos. El código no cambia de proyecto ni de issue por sugerencia del modelo.
