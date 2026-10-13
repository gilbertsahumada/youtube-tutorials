# Conectar las cuentas de la demo

La [guía completa](../README.md#paso-a-paso) incluye una conversación para probar la demo de principio a fin. Esta página reúne la configuración de las integraciones.

Desde `demo/`, crea `.env` con `cp -n .env.example .env`, completa estas cinco variables y arranca con `npm start` usando **Node.js ≥22.13**:

| Variable | Configuración |
|---|---|
| `GOOGLE_CLIENT_ID` | ID del cliente OAuth de escritorio de Google. |
| `GOOGLE_CLIENT_SECRET` | Secreto del mismo cliente. |
| `MODEL_BASE_URL` | URL base HTTPS compatible con Chat Completions, sin `/chat/completions`. |
| `MODEL_ID` | Modelo disponible en tu proveedor y cuenta. |
| `MODEL_API_KEY` | Clave de API del proveedor de esa URL. |

Puedes usar el entorno del proceso en lugar de `.env`. Reinicia el servidor al cambiarlo. La UI muestra qué falta y permite guardar proyectos; no pide secretos ni sustituye las conexiones por datos de ejemplo.

## Gmail

1. En [Google Cloud](https://console.cloud.google.com/), habilita **Gmail API**.
2. Configura la aplicación en Google Auth Platform. Para una cuenta personal de prueba, usa audiencia **External**, modo **Testing** y añade el **Gmail receptor** como usuario de prueba.
3. Incluye el permiso `https://www.googleapis.com/auth/gmail.readonly`.
4. Crea un cliente OAuth de tipo **Aplicación de escritorio** y copia su ID y secreto a `.env`.
5. En la demo, abre **Conexiones y datos → Conectar Gmail → Abrir autorización de Google** y autoriza el receptor.

[Configuración oficial de Gmail](https://developers.google.com/workspace/gmail/api/quickstart/nodejs) · [Consentimiento OAuth](https://developers.google.com/workspace/guides/configure-oauth-consent) · [Permisos](https://developers.google.com/workspace/gmail/api/auth/scopes).

La autorización se guarda en `.private/gmail-token.json`. Si la renovación falla, pulsa **Volver a autorizar Gmail**. Que el token esté guardado no garantiza que siga siendo válido.

Cada proyecto define los **remitentes**, la **fecha y hora UTC** y una **etiqueta opcional**. La cuenta autorizada es la receptora; el correo de un participante corresponde a quien envía el mensaje. Sin etiqueta se busca por participantes y fecha. Con etiqueta debe existir y estar aplicada al mensaje. [Búsquedas de Gmail API](https://developers.google.com/workspace/gmail/api/guides/filtering).

Se utiliza texto plano, sin adjuntos ni HTML, hasta 500 mensajes por consulta y 20.000 caracteres por mensaje. El servidor vuelve a validar fecha y remitente antes de guardarlo.

## GitHub

Autoriza GitHub CLI con la cuenta que leerá el repositorio y creará o editará issues:

```bash
gh auth login
```

En **Conexiones y datos → Comprobar GitHub** se verifica la cuenta. En el formulario del proyecto puedes cargar sus repositorios o escribir `owner/repo`. Si tu entorno ya contiene `GITHUB_REPO`, el formulario lo usa como valor inicial; la configuración guardada del proyecto es el destino efectivo.

El análisis consulta los issues abiertos y excluye las pull requests. La aprobación vuelve a consultar el estado antes de crear o actualizar un issue. No necesitas guardar un número de issue en el proyecto. [Autorización de gh](https://cli.github.com/manual/gh_auth_login) · [API de issues](https://docs.github.com/en/rest/issues/issues).

## Modelo

La URL, el identificador del modelo y la clave deben corresponder a la misma API compatible con Chat Completions. El servidor añade `/chat/completions` a `MODEL_BASE_URL` y solicita JSON con el resumen y las propuestas.

El modelo recibe los mensajes nuevos, contexto previo del mismo hilo, issues abiertos, vínculos de conversaciones y propuestas o decisiones relevantes. No dispone de herramientas para escribir en GitHub. La aplicación valida las citas y los cambios antes de mostrarlos para aprobación.

Un error de autenticación, límite del proveedor o JSON inválido se muestra en la UI. Los correos de un análisis fallido siguen disponibles para reintentar; no se crean resultados de ejemplo.

## Configuración del proyecto

Nombre, repositorio, fecha con hora, etiqueta y participantes se guardan en SQLite. No necesitas `GMAIL_LABEL`, `GMAIL_AFTER`, `GMAIL_INITIAL_MESSAGE_ID`, `GITHUB_ISSUE_NUMBER` ni `IMPORT_LEGACY_PROJECT` para la UI.

Los filtros exactos y por dominio se combinan dentro de cada proyecto; un mensaje puede estar disponible en varios proyectos si coincide con sus filtros. Cambiar el alcance limpia los mensajes locales y deja obsoletas las propuestas pendientes. Vuelve a sincronizar y analizar.

**Sincronizar correo** solo descarga mensajes; **Analizar correos** prepara propuestas; **Aprobar** crea o actualiza el issue. El seguimiento automático realiza las dos primeras acciones desde el servidor mientras esté encendido. Cada escritura sigue requiriendo aprobación.

**Reiniciar datos locales** borra el estado de SQLite con confirmación y conserva las conexiones y los datos externos. Para respaldar la demo, detén el servidor y copia `.private/`; conserva `.env` por separado. Los datos privados están excluidos de Git y no se sirven como archivos web.

[Solucionar errores de conexiones y propuestas](../README.md#si-algo-no-funciona).
