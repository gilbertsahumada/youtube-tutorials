# Conectar tus cuentas

Desde `demo/`, copia `.env.example` a `.env` si todavía no existe. Completa las variables y ejecuta `npm start`. La UI lee el estado del servidor; no permite introducir ni guardar credenciales.

## Variables necesarias

| Variable | Qué debes configurar |
|---|---|
| `GOOGLE_CLIENT_ID` | ID del cliente OAuth de escritorio de Google |
| `GOOGLE_CLIENT_SECRET` | Secreto de ese cliente OAuth |
| `GMAIL_LABEL` | Nombre exacto de una etiqueta existente en el Gmail receptor |
| `ALLOWED_SENDER` | Dirección del remitente cuyos correos se analizarán |
| `GMAIL_AFTER` | Fecha ISO anterior al primer correo, por ejemplo `2026-10-01T00:00:00Z` |
| `GITHUB_REPO` | Repositorio con formato `owner/repo` |
| `GITHUB_ISSUE_NUMBER` | Número de un issue abierto en ese repositorio |
| `MODEL_BASE_URL` | URL HTTPS de una API compatible con Chat Completions, sin `/chat/completions` |
| `MODEL_ID` | Identificador de un modelo disponible en tu cuenta |
| `MODEL_API_KEY` | Clave de API del proveedor indicado en la URL |

Puedes declarar estas variables en el entorno del proceso en lugar de usar `.env`. Tras cambiar cualquier valor, reinicia el servidor. Una configuración incompleta o inválida muestra un error; nunca carga datos de ejemplo.

`GMAIL_INITIAL_MESSAGE_ID` es opcional en la UI: el correo se selecciona en **Conexiones**. Si lo declaras, debe coincidir con el ID de Gmail API del correo seleccionado. Los [comandos por terminal](scripts.md) sí necesitan ese valor.

## Gmail

1. En [Google Cloud](https://console.cloud.google.com/), activa **Gmail API**.
2. En Google Auth Platform, configura audiencia **External**, modo **Testing**, y añade la cuenta receptora como usuario de prueba.
3. Incluye `https://www.googleapis.com/auth/gmail.readonly` en los permisos.
4. Crea un cliente OAuth de tipo **Aplicación de escritorio** y copia su Client ID y Client secret a `.env`.
5. Crea la etiqueta indicada en `GMAIL_LABEL` y aplícala a los correos que quieras procesar.
6. Arranca el servidor. En **Conexiones → Conectar Gmail → Abrir autorización de Google**, autoriza la cuenta receptora y vuelve a la demo.

El token OAuth se guarda localmente en `.private/gmail-token.json`. El programa filtra los mensajes por etiqueta, remitente y fecha; lee texto plano sin adjuntos.

## GitHub y contexto del proyecto

Inicia sesión una vez con [GitHub CLI](https://cli.github.com/):

```bash
gh auth login
```

Configura el repositorio y el número del issue en `.env`. El issue debe estar abierto y contener una única línea de formato actual. Las referencias deben coincidir con `demo/config/project.json`; con su configuración inicial, las líneas son:

```text
Proyecto: portal-cliente
Entrega: entrega-1
Requisito: exportar-reportes
Formato actual: CSV
```

Estos valores definen el alcance del tutorial. Puedes ajustar el proyecto antes de la captura. Los correos reales deben identificar el mismo proyecto, entrega y requisito, y acordar o solicitar uno de los formatos admitidos: CSV o PDF.

En **Conexiones → Comprobar acceso**, verifica la sesión de GitHub. El proveedor de IA recibe los correos y la tarea para contrastar sus fuentes.

## Capturar, analizar y revisar

1. Pulsa **Cargar correos** y selecciona el acuerdo inicial. El modelo comprueba que el correo y el issue coincidan en el formato.
2. Cuando llegue una nueva solicitud del remitente permitido con la etiqueta configurada, pulsa **Buscar solicitudes**.
3. En **Revisar propuesta**, comprueba los extractos y el comentario. **Publicar comentario en GitHub** publica solo ese comentario y evita duplicarlo.

**Observar Gmail** prepara propuestas cada 30 segundos mientras la página está abierta. Cada publicación requiere pulsar el botón de revisión. Para otro proyecto, issue o acuerdo inicial, usa otra copia de la demo: el acuerdo capturado se conserva.

## Si algo no aparece

| Problema | Qué revisar |
|---|---|
| Variables faltantes o inválidas | Completa los campos indicados en el entorno o `.env` y reinicia el servidor. |
| Sin correos | Cuenta receptora autorizada, etiqueta aplicada, remitente exacto y fecha anterior al mensaje. |
| Google bloquea el acceso | Usuario de prueba, Gmail API activa y cliente OAuth de escritorio. |
| GitHub falla | Sesión de `gh`, acceso al repositorio y número de un issue abierto. |
| Evidencia rechazada | El extracto debe coincidir literalmente con el correo, mencionar el formato y tener al menos 20 caracteres. Consulta `output/initial-context.json` para la captura. |
| El issue cambió | Busca solicitudes de nuevo antes de publicar. |
| Otra instancia en curso | Detén el otro servidor o script; ambos comparten un lock local. |
