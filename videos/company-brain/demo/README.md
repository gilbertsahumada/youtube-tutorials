# Company Brain: de un correo a una propuesta de cambio

Demo local basada en eventos detectados por polling: **Gmail real + GitHub real + Slack simulado**.

Una cuenta de prueba recibe un correo que confirma PDF en lugar de CSV. El proceso consulta la memoria del proyecto y un issue en GitHub, identifica la desalineación y abre un PR. El acuerdo anterior se conserva. El issue recibe un aviso, pero su descripción no cambia. **Un humano revisa y fusiona el PR.**

No hay un prompt manual por cada correo: una vez iniciado el watcher, el mensaje nuevo dispara el análisis. No se necesita RAG vectorial ni una base de grafos para este caso.

## Lo que muestra

```text
Correo etiquetado en Gmail (real)
        ↓ polling local cada 30 s
Filtrar remitente, ventana temporal y mensajes ya procesados
        ↓
Consultar GitHub: proyecto, decisión, procedimiento e issue
        + conversación de Slack (JSON simulado, no integración real)
        ↓
Modelo clasifica el acuerdo → el programa valida contexto y evidencia
        ↓
PR: decisión actualizada + historial + propuesta para la tarea
        + comentario advisory en el issue
        ↓
Revisión humana → merge → memoria vigente en GitHub
```

Enfoques del artículo: repositorio de conocimiento, consulta a herramientas, memoria estructurada, detección por eventos y actuación controlada. No es una plataforma completa de Company Brain.

## Requisitos

- Node.js 22 o superior. No hay paquetes que instalar.
- Git y GitHub CLI (`gh`), con sesión autorizada para escribir en **un repositorio sandbox**.
- Un proyecto de Google Cloud con Gmail API activada y un cliente OAuth de tipo **Desktop app**.
- Una cuenta Gmail de prueba y otro correo desde el que enviar el acuerdo.
- Un endpoint OpenAI-compatible de Chat Completions con API key.

Esta versión llama directamente al modelo mediante `fetch`; no requiere Pi ni un servidor MCP. El modelo no tiene herramientas: el código decide qué leer y qué operaciones realizar en GitHub.

## 1. Revisar sin cuentas ni credenciales

```bash
cd videos/company-brain/demo
npm test
npm run preview
```

`preview` usa correo, issue y clasificación **simulados**. No llama a Gmail, GitHub ni al modelo; tampoco publica, incluso si `PUBLISH=true`. Produce `output/fixture-plan.json` con los dos archivos que propondría cambiar.

La fixture prueba el flujo y las validaciones; **no demuestra la calidad del modelo**. La integración real se verifica al seguir los próximos pasos.

## 2. Crear un repositorio sandbox con la memoria inicial

No uses tu repositorio de producción. Desde `demo/`, con `gh auth login` ya completado:

```bash
DEMO="$PWD"
SANDBOX=$(mktemp -d)
cp -R "$DEMO/seed/." "$SANDBOX/"
cd "$SANDBOX"
git init -b main
git add brain slack
git commit -m "seed: acuerdos y contexto inicial del portal"

# Reemplaza TU_USUARIO. El repositorio no debe existir todavía.
gh repo create TU_USUARIO/company-brain-sandbox --private --source . --remote origin --push

gh issue create --repo TU_USUARIO/company-brain-sandbox \
  --title "portal-cliente: exportar-reportes para entrega-1" \
  --body $'Proyecto: portal-cliente\nEntrega: entrega-1\nRequisito: exportar-reportes\n\nImplementar exportación CSV.\n\nAceptación: generar un archivo CSV descargable con los datos del reporte.'

cd "$DEMO"
cp .env.example .env
```

El número del issue se muestra en su URL. Guárdalo en `GITHUB_ISSUE_NUMBER`. Los documentos seed y las conversaciones de Slack son **ficticios**; no representan una empresa real.

## 3. Conectar Gmail con OAuth de solo lectura

En Google Cloud:

1. Crea un proyecto de prueba y activa **Gmail API**.
2. Configura la pantalla de consentimiento OAuth. Si la app está en testing, agrega la cuenta Gmail de prueba como test user.
3. Crea credenciales **OAuth client ID → Desktop app**.
4. Copia el client ID y client secret a `.env` como `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`.
5. En Gmail, crea la etiqueta `company-brain-demo`.
6. Crea un filtro para aplicar esa etiqueta a correos de tu remitente de prueba cuyo asunto contenga `company-brain-demo`.

En `.env` configura:

```dotenv
GMAIL_LABEL=company-brain-demo
APPROVED_SENDER=correo-del-remitente-de-prueba@example.com
GMAIL_AFTER=FECHA_ISO_ANTES_DE_ENVIAR_EL_CORREO
```

Para obtener la fecha actual: `node -e 'console.log(new Date().toISOString())'`. No pegues literalmente `FECHA_ISO_ANTES_DE_ENVIAR_EL_CORREO`.

Autoriza:

```bash
npm run gmail:login
```

Abre la URL que imprime la terminal. El callback usa localhost con puerto dinámico, state y PKCE. El refresh token queda en `.private/gmail-token.json`, ignorado por Git y con permisos `0600`.

**Importante:** el scope `gmail.readonly` permite leer el buzón; la etiqueta es un filtro del programa, no una restricción OAuth. Por eso se usa una cuenta dedicada. No se solicita acceso para enviar, borrar ni modificar correos.

Referencia: https://developers.google.com/workspace/gmail/api/auth/scopes

## 4. Configurar GitHub y el modelo

Completa `.env`:

```dotenv
GITHUB_REPO=TU_USUARIO/company-brain-sandbox
GITHUB_ISSUE_NUMBER=1
POLL_SECONDS=30
PUBLISH=false

# Ejemplo propio del tutorial, no un provider obligatorio:
MODEL_BASE_URL=https://maas.qwencloudapi.com/compatible-mode/v1
MODEL_ID=deepseek-v4.1-flash
MODEL_API_KEY=TU_CLAVE
```

`MODEL_ID` es el ID que acepta el endpoint, **no** el formato `provider/model-id` del reviewer de Pi. Puedes cambiar la URL y el modelo por otro proveedor compatible. Usa solo HTTPS.

El modelo recibe el texto del correo seleccionado, el issue y el contexto del sandbox. Eso envía esos datos al proveedor elegido: **no uses información privada**. La clave no se imprime ni forma parte de los archivos propuestos.

## 5. Enviar el correo y comprobar el preview real

Desde el remitente autorizado, envía un correo a la cuenta de prueba:

**Asunto:** `company-brain-demo — Portal cliente, entrega 1`

```text
Para el proyecto portal-cliente, entrega-1, confirmamos PDF en lugar de CSV
para exportar-reportes. El cambio queda aprobado por el cliente.
Excel sigue como propuesta para una entrega futura.
```

Comprueba que recibió la etiqueta. Entonces:

```bash
npm run once
```

Con `PUBLISH=false`, consulta Gmail, GitHub y el modelo, pero **no escribe en GitHub**. Revisa la propuesta JSON en `output/`. El procesamiento solo acepta texto plano (incluido multipart); ignora adjuntos, correos sin texto plano, remitentes distintos y cuerpos de más de 20 000 caracteres.

## 6. Activar el flujo para grabar

Cuando el preview sea correcto, cambia `PUBLISH=true` y ejecuta:

```bash
npm run watch
```

Para que en cámara se vea el evento, puedes iniciar el watcher antes de enviar un correo nuevo. Para una primera toma limpia, crea un sandbox nuevo y configura una fecha de inicio reciente.

El proceso:

- Consulta el buzón cada 30 segundos, sin prompt manual por mensaje.
- Clasifica aprobación, contexto y propuestas pendientes.
- Valida remitente, proyecto, entrega, requisito, formato y extracto literal.
- Crea un único commit con dos archivos: `brain/decisions/exportacion.json` y `brain/proposals/<id>.md`.
- Abre un PR y comenta en el issue con el enlace.
- Espera a que el PR se fusione o cierre antes de procesar otro cambio.

Después del merge, el siguiente ciclo consulta la nueva memoria desde la rama principal. **El issue conserva CSV hasta que un humano actualice su descripción y criterios.** No hay auto-merge ni edición silenciosa del trabajo.

### Recorrido de grabación

1. Mostrar el acuerdo CSV y el issue CSV en GitHub.
2. Mostrar el mensaje de Slack simulado: Excel es una sugerencia pendiente.
3. Iniciar el watcher y enviar el correo con la confirmación de PDF.
4. Mostrar la detección en terminal y el PR generado.
5. Revisar el diff: PDF vigente, CSV en el historial, Excel pendiente.
6. Abrir el issue y enseñar el comentario advisory.
7. Fusionar manualmente el PR y mostrar la decisión actualizada.

Frase clave: **“No le pedí que actualizara una tarea. Llegó información nueva, el sistema la relacionó con el trabajo y propuso un cambio.”**

## Permisos, fallos y límites

- `.env`, `.private/` y `output/` se ignoran en Git. Nunca subas credenciales ni correos reales.
- El modelo no ejecuta comandos ni elige rutas de escritura. Las operaciones GitHub están definidas en código.
- El contenido de correo, Slack e issues es evidencia no confiable. Puede contener prompt injection; las validaciones reducen el alcance, pero **no garantizan una interpretación correcta**. El PR requiere revisión humana.
- El campo `From` y la allowlist no prueban criptográficamente la identidad del cliente. Esta demo no implementa autenticación de acuerdos empresariales.
- Una confirmación en un correo produce una propuesta; no reemplaza la aprobación humana en GitHub.
- El polling no es Gmail Push. Una integración con `watch` y Pub/Sub sería una evolución: https://developers.google.com/workspace/gmail/api/guides/push
- Se guarda estado por ID de mensaje, se reutiliza el PR identificado por una rama determinista y se evita duplicar comentarios. Si falla, se reintenta. No hay garantía distribuida de exactly-once; ejecuta **una sola instancia** con su estado local intacto.
- `.private/watch.lock` impide dos procesos locales concurrentes. Si hubo un cierre abrupto, verifica que no haya otro watcher antes de borrarlo.
- Un PR cerrado sin merge queda registrado como procesado; para reproponer, envía una confirmación nueva. No borres estado en medio de una revisión.
- No se procesa otro acuerdo mientras hay un PR abierto. Un correo anterior al acuerdo vigente no lo reemplaza.
- Puede haber cargos por llamadas al modelo. Los mensajes procesados no se reclasifican. `once` en preview sí puede volver a analizar el mismo mensaje.
- Apps OAuth en testing pueden tener refresh tokens de corta duración. Si aparece un error de refresh, reautoriza con `npm run gmail:login`.
- GitHub CLI usa los permisos de tu sesión. Las restricciones del programa **no restringen el token**: usa un sandbox y una cuenta/token de alcance mínimo.

## Estructura

```text
demo/
├── seed/                 # Memoria inicial para el sandbox
│   ├── brain/            # Proyecto, decisión y procedimiento
│   └── slack/            # Mensajes simulados
├── fixtures/             # Correo, issue y análisis deterministas para preview
├── src/                  # OAuth, Gmail, clasificación, validación y GitHub
├── test/                 # Pruebas de reglas y publicaciones con API simulada
├── .env.example          # Plantilla sin secretos
└── package.json          # Comandos, sin dependencias
```

Las pruebas y fixtures se ejecutan sin cuentas externas. La autenticación de Gmail, la compatibilidad del modelo y la publicación real dependen de tus credenciales y deben verificarse con el sandbox antes de grabar.
