# Conectar tus cuentas

Desde `demo/`, copia `.env.example` a `.env` si todavía no existe. Completa las conexiones y ejecuta `npm start` con **Node.js ≥22.13**. La UI permite guardar proyectos y filtros, y muestra el estado de las conexiones. Las credenciales se configuran exclusivamente en el entorno.

## Variables necesarias

| Variable | Qué debes configurar |
|---|---|
| `GOOGLE_CLIENT_ID` | ID del cliente OAuth de escritorio de Google |
| `GOOGLE_CLIENT_SECRET` | Secreto de ese cliente OAuth |
| `GMAIL_LABEL` | Nombre exacto de una etiqueta existente en el Gmail receptor |
| `GMAIL_AFTER` | Fecha ISO anterior al primer correo, por ejemplo `2026-10-01T00:00:00Z` |
| `MODEL_BASE_URL` | URL HTTPS de una API compatible con Chat Completions, sin `/chat/completions` |
| `MODEL_ID` | Identificador de un modelo disponible en tu cuenta |
| `MODEL_API_KEY` | Clave de API del proveedor indicado en la URL |

Puedes declarar estas variables en el entorno del proceso en lugar de usar `.env`. Tras cambiarlas, reinicia el servidor. Una configuración incompleta o inválida muestra un error; nunca carga datos de ejemplo. Puedes crear proyectos y guardar filtros mientras completas las conexiones.

## Gmail y GitHub

1. En [Google Cloud](https://console.cloud.google.com/), activa **Gmail API**.
2. En Google Auth Platform, configura audiencia **External**, modo **Testing**, y añade la cuenta receptora como usuario de prueba.
3. Incluye `https://www.googleapis.com/auth/gmail.readonly` en los permisos.
4. Crea un cliente OAuth de tipo **Aplicación de escritorio** y copia su Client ID y Client secret a `.env`.
5. Crea la etiqueta indicada en `GMAIL_LABEL` y aplícala a los correos que quieras procesar.
6. Arranca el servidor. En **Conexiones → Conectar Gmail → Abrir autorización de Google**, autoriza la cuenta receptora y vuelve a la demo.

El token OAuth queda en `.private/gmail-token.json`. Solo se lee texto plano, sin adjuntos, dentro de la etiqueta y fecha configuradas y con los filtros de los proyectos.

Inicia sesión con [GitHub CLI](https://cli.github.com/):

```bash
gh auth login
```

En **Conexiones → Comprobar acceso**, verifica esa sesión. El proveedor de IA recibe los correos y la tarea para contrastar sus fuentes.

## Proyectos y filtros

En **Proyectos y filtros**, guarda el nombre, repositorio (`owner/repo`), número del issue y referencias del proyecto, entrega y requisito. Usa letras minúsculas, números y guiones para esas referencias. El issue debe estar abierto y contener las referencias del formulario y una única línea de formato actual, por ejemplo:

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

Puedes añadir o eliminar filtros y cambiar el proyecto activo sin reiniciar.

## Capturar, analizar y revisar

1. Selecciona el proyecto. En **Conexiones**, pulsa **Cargar correos** y captura el acuerdo inicial. El modelo valida que correo e issue coincidan en el formato.
2. Cuando llegue una solicitud de un participante, con la etiqueta configurada, pulsa **Buscar solicitudes**.
3. En **Revisar propuesta**, comprueba los extractos y el comentario. **Publicar comentario en GitHub** escribe solo ese comentario y evita duplicarlo.

**Observar Gmail** prepara propuestas cada 30 segundos mientras la página está abierta. Cambiar el proyecto o navegar a otra vista detiene la observación. Cada publicación requiere su botón de revisión.

SQLite guarda proyectos, filtros, asignaciones, acuerdos, propuestas y publicaciones en `.private/company-brain.sqlite`. Al reiniciar o recargar la página, las propuestas pendientes siguen disponibles. Para conservar los datos, respalda `.private/`; las credenciales de `.env` y la sesión de `gh` se mantienen por separado. La base y los diagnósticos de `output/<proyecto>/` no se sirven al navegador ni se incluyen en Git.

Si ya utilizabas la CLI y tienes `GITHUB_REPO`, `GITHUB_ISSUE_NUMBER` y `ALLOWED_SENDER`, el primer inicio importa ese proyecto de `config/project.json` y sus archivos privados de acuerdo y estado, si existen. La importación es única y deja los JSON originales intactos. Después, los proyectos de la UI se gestionan en SQLite. [Ver compatibilidad con los scripts](scripts.md).

## Si algo no aparece

| Problema | Qué revisar |
|---|---|
| Variables faltantes o inválidas | Completa los campos indicados en el entorno o `.env` y reinicia. |
| Sin correos | Cuenta receptora, etiqueta aplicada, filtros del proyecto, fecha anterior al mensaje y correos pendientes de asignar. |
| Google bloquea el acceso | Usuario de prueba, Gmail API activa y cliente OAuth de escritorio. |
| GitHub falla | Sesión de `gh`, acceso al repositorio y número de un issue abierto. |
| Evidencia rechazada | El extracto debe coincidir literalmente con el correo, mencionar el formato y tener al menos 20 caracteres. Consulta `output/<proyecto>/initial-context.json`. |
| El issue cambió | Busca solicitudes de nuevo antes de publicar. |
| Otra instancia en curso | Detén el otro servidor o script; ambos usan un lock local. |
