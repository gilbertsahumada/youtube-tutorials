# Conectar tus cuentas

Desde `demo/`, copia `.env.example` a `.env` si todavía no existe. Completa las conexiones y ejecuta `npm start` con **Node.js ≥22.13**. La UI permite guardar proyectos y filtros, y muestra el estado de las conexiones. Las credenciales se configuran exclusivamente en el entorno.

## Variables necesarias

| Variable | Qué debes configurar |
|---|---|
| `GOOGLE_CLIENT_ID` | ID del cliente OAuth de escritorio de Google |
| `GOOGLE_CLIENT_SECRET` | Secreto de ese cliente OAuth |
| `MODEL_BASE_URL` | URL HTTPS de una API compatible con Chat Completions, sin `/chat/completions` |
| `MODEL_ID` | Identificador de un modelo disponible en tu cuenta |
| `MODEL_API_KEY` | Clave de API del proveedor indicado en la URL |

Puedes declarar estas variables en el entorno del proceso en lugar de usar `.env`. Tras cambiarlas, reinicia el servidor. Una configuración incompleta o inválida muestra un error; nunca carga datos de ejemplo. Puedes crear proyectos y guardar filtros mientras completas las conexiones.

## Gmail y GitHub

1. En [Google Cloud](https://console.cloud.google.com/), activa **Gmail API**.
2. En Google Auth Platform, configura audiencia **External**, modo **Testing**, y añade la cuenta receptora como usuario de prueba.
3. Incluye `https://www.googleapis.com/auth/gmail.readonly` en los permisos.
4. Crea un cliente OAuth de tipo **Aplicación de escritorio** y copia su Client ID y Client secret a `.env`.
5. Arranca el servidor. En **Conexiones → Conectar Gmail → Abrir autorización de Google**, autoriza la cuenta receptora y vuelve a la demo.

El token OAuth queda en `.private/gmail-token.json`. Gmail se consulta por los participantes y la fecha del proyecto seleccionado. La etiqueta es opcional. Solo se utiliza texto plano, sin adjuntos, y el servidor vuelve a comprobar los remitentes y la fecha.

Inicia sesión con [GitHub CLI](https://cli.github.com/):

```bash
gh auth login
```

En **Conexiones → Comprobar acceso**, verifica esa sesión. El proveedor de IA recibe los correos y la tarea para contrastar sus fuentes.

## Proyectos y filtros

En **Proyectos y filtros**, guarda el nombre, repositorio (`owner/repo`), número del issue, referencias del proyecto, entrega y requisito, y la fecha **Leer correos desde (UTC)**. Por defecto aparece el día actual; si el acuerdo ya existe, elige ese día o uno anterior. La fecha incluye mensajes desde las 00:00 UTC y se guarda en SQLite. Usa letras minúsculas, números y guiones para esas referencias. El issue debe estar abierto y contener las referencias del formulario y una única línea de formato actual, por ejemplo:

```text
Proyecto: mi-proyecto
Entrega: entrega-1
Requisito: exportar-reportes
Formato actual: CSV
```

Los correos también deben identificar ese proyecto, entrega y requisito, y acordar o solicitar CSV o PDF. Cada proyecto tiene su propio issue y acuerdo inicial. Una vez capturado, su destino y referencias se conservan; para otro alcance, crea un proyecto.

Añade los participantes con un **correo exacto** o un **dominio completo**, y selecciona a qué proyecto pertenece cada filtro:

- Los correos exactos tienen prioridad sobre los dominios en todos los proyectos.
- Un dominio coincide completo: `empresa.com` no incluye `sub.empresa.com` ni `empresa.com.otro.com`. Añade los subdominios por separado.
- Si varios proyectos coinciden, **Conexiones → Cargar correos** muestra **Correos por asignar**. Elige su destino antes de capturarlos o analizarlos.

**Etiqueta de Gmail (opcional):** déjala vacía para buscar directamente por los correos y dominios. Si eliges una, introduce el nombre exacto de una etiqueta existente y aplícala a los mensajes que quieres consultar, incluido el acuerdo inicial.

Puedes editar la fecha y la etiqueta, añadir o eliminar filtros y cambiar el proyecto activo sin reiniciar. La fecha no puede dejar fuera el correo del acuerdo capturado. La UI no requiere `GMAIL_LABEL` ni `GMAIL_AFTER` en el entorno.

## Capturar, analizar y revisar

1. Selecciona el proyecto. En **Conexiones**, pulsa **Cargar correos** y captura el acuerdo inicial. El modelo valida que correo e issue coincidan en el formato.
2. Cuando llegue una solicitud de un participante, pulsa **Buscar solicitudes**.
3. En **Revisar propuesta**, comprueba los extractos y el comentario. **Publicar comentario en GitHub** escribe solo ese comentario y evita duplicarlo.

**Observar Gmail** prepara propuestas cada 30 segundos mientras la página está abierta. Cambiar el proyecto o navegar a otra vista detiene la observación. Cada publicación requiere su botón de revisión.

SQLite guarda proyectos, fechas de inicio, etiquetas opcionales, filtros, asignaciones, acuerdos, propuestas y publicaciones en `.private/company-brain.sqlite`. Al reiniciar o recargar la página, las propuestas pendientes siguen disponibles. Para conservar los datos, respalda `.private/`; las credenciales de `.env` y la sesión de `gh` se mantienen por separado. La base y los diagnósticos de `output/<proyecto>/` no se sirven al navegador ni se incluyen en Git.

Una base anterior se actualiza sin perder el estado: copia una sola vez la fecha y etiqueta antiguas a cada proyecto. Si falta una fecha válida, elige una que incluya el acuerdo guardado o el día actual cuando no hay acuerdo. Los cambios posteriores de `GMAIL_LABEL` y `GMAIL_AFTER` no modifican los proyectos de la UI.

El inicio normal deja los proyectos vacíos hasta que los creas en el formulario. Para importar el proyecto de la CLI y su estado, activa `IMPORT_LEGACY_PROJECT=true` antes de iniciar con una base vacía y configura `GITHUB_REPO`, `GITHUB_ISSUE_NUMBER` y `ALLOWED_SENDER`. La importación es única y deja los JSON originales intactos. Si el proyecto ya se importó con una versión anterior, sigue guardado y la UI indica su procedencia. Después, los proyectos de la UI se gestionan en SQLite. [Ver compatibilidad con los scripts](scripts.md).

## Si algo no aparece

| Problema | Qué revisar |
|---|---|
| Variables faltantes o inválidas | Completa los campos indicados en el entorno o `.env` y reinicia. |
| Sin correos | Cuenta receptora, filtros y fecha del proyecto, etiqueta aplicada solo si elegiste una, y correos pendientes de asignar. |
| Google bloquea el acceso | Usuario de prueba, Gmail API activa y cliente OAuth de escritorio. |
| GitHub falla | Sesión de `gh`, acceso al repositorio y número de un issue abierto. |
| Evidencia rechazada | El extracto debe coincidir literalmente con el correo, mencionar el formato y tener al menos 20 caracteres. Consulta `output/<proyecto>/initial-context.json`. |
| El issue cambió | Busca solicitudes de nuevo antes de publicar. |
| Otra instancia en curso | Detén el otro servidor o script; ambos usan un lock local. |
