# Company Brain: del correo al trabajo del equipo

Un cliente pide una funcionalidad por correo. Después cambia una fecha, añade un requisito o solicita otro formato. Company Brain conecta esas conversaciones con el repositorio del equipo: identifica solicitudes que todavía no tienen issue y diferencias con tareas existentes, y prepara propuestas para que una persona decida qué publicar.

Esta demo permite hacer ese recorrido desde una interfaz local con **Gmail y GitHub reales**. Cada proyecto define su repositorio, sus participantes y desde cuándo leer los mensajes. Los correos se sincronizan en SQLite; el modelo los compara con los issues abiertos. Una propuesta puede **crear un issue** o **actualizar su título y descripción**, siempre después de tu aprobación.

[Preparar y probar la demo](#paso-a-paso) · [Proyectos y participantes](#proyectos-y-participantes) · [Seguimiento automático](#seguimiento-automático) · [Reiniciar datos](#reiniciar-la-demo) · [Resolver problemas](#si-algo-no-funciona)

## Qué hace cada parte

| Parte              | Responsabilidad                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| Gmail              | Aporta los mensajes que coinciden con participantes, fecha y etiqueta opcional.                 |
| SQLite local       | Conserva proyectos, mensajes sincronizados, propuestas, decisiones y actividad.                 |
| GitHub             | Aporta los issues abiertos del repositorio y recibe las creaciones o actualizaciones aprobadas. |
| Modelo de IA       | Identifica solicitudes y discrepancias; explica sus propuestas con citas literales.             |
| Persona que revisa | Examina las fuentes y el texto que se publicará; aprueba o rechaza cada propuesta.              |

**Sincronizar correo** descarga y guarda mensajes. **Analizar correos** consulta los issues y prepara propuestas. **Aprobar** ejecuta el cambio en GitHub. Son acciones separadas: sincronizar, analizar y activar el seguimiento nunca publican por sí solos.

## Antes de empezar

Necesitas **Node.js ≥22.13**, [GitHub CLI](https://cli.github.com/), una cuenta receptora de Gmail, un cliente OAuth de Google y una API compatible con **Chat Completions**. No hay paquetes que instalar: la interfaz utiliza JavaScript y el servidor usa SQLite incluido en Node.

Elige un repositorio al que tengas acceso y donde puedas crear y editar issues. Para probar una conversación, envía los mensajes desde otra cuenta a tu Gmail receptor. El análisis envía al proveedor de IA los textos de esos mensajes y los issues del repositorio elegido.

## Paso a paso

### 1. Prepara las conexiones

Si todavía no tienes el repositorio:

```bash
git clone https://github.com/gilbertsahumada/youtube-tutorials.git
cd youtube-tutorials/videos/company-brain/demo
```

Si ya lo tienes, entra en `videos/company-brain/demo`. Los comandos siguientes se ejecutan allí. Comprueba `node --version`; si usas nvm, ejecuta `nvm use`.

```bash
cp -n .env.example .env
```

Abre `.env` y completa estas cinco variables. El comando anterior conserva un archivo existente.

| Variable               | Valor                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`     | Client ID de un cliente OAuth de Google de tipo Aplicación de escritorio.           |
| `GOOGLE_CLIENT_SECRET` | Client secret del mismo cliente.                                                    |
| `MODEL_BASE_URL`       | URL base HTTPS de una API compatible con Chat Completions, sin `/chat/completions`. |
| `MODEL_ID`             | Identificador de un modelo disponible en ese proveedor y tu cuenta.                 |
| `MODEL_API_KEY`        | Clave de API del mismo proveedor.                                                   |

Para configurar Google:

1. Crea o selecciona un proyecto en [Google Cloud](https://console.cloud.google.com/) y habilita **Gmail API**.
2. Configura la aplicación en **Google Auth Platform**. Para una cuenta personal de prueba, selecciona audiencia **External**, modo **Testing**, y añade el Gmail receptor como usuario de prueba. [Guía de consentimiento](https://developers.google.com/workspace/guides/configure-oauth-consent).
3. Incluye el permiso `https://www.googleapis.com/auth/gmail.readonly`. [Permisos de Gmail](https://developers.google.com/workspace/gmail/api/auth/scopes).
4. Crea un cliente OAuth de tipo **Desktop app / Aplicación de escritorio** y copia sus dos valores a `.env`. [Guía de configuración de Gmail](https://developers.google.com/workspace/gmail/api/quickstart/nodejs).

Obtén los valores del modelo en el panel de tu proveedor. El servidor añade `/chat/completions` a la URL base. URL, modelo y clave deben corresponder a la misma API.

`.env.example` incluye esta configuración personalizable, utilizada con QwenCloud y un modelo de DeepSeek. Completa los secretos o cambia los valores por los de tu proveedor; quien sirve la API y quien desarrolla el modelo pueden ser compañías distintas:

```dotenv
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

MODEL_BASE_URL=https://maas.qwencloudapi.com/compatible-mode/v1
MODEL_ID=deepseek-v4.1-flash
MODEL_API_KEY=
```

La URL es la base, sin `/chat/completions` al final.

Autoriza GitHub CLI:

```bash
gh auth login
```

Las credenciales solo se leen en el servidor, desde `.env` o el entorno del proceso. **La UI no solicita ni muestra secretos.** Tras cambiar `.env`, reinicia el servidor. Si faltan variables, la UI indica cuáles; no carga datos de ejemplo.

Repositorio, participantes, fecha y etiqueta se configuran en el proyecto. Si ya tienes `GITHUB_REPO` en el entorno, se usa únicamente para rellenar inicialmente el campo del repositorio; el valor guardado en el proyecto es el que se utiliza.

### 2. Arranca y autoriza Gmail

```bash
npm start
```

Abre [http://127.0.0.1:4173](http://127.0.0.1:4173). En **Conexiones y datos**:

1. Pulsa **Conectar Gmail** y después **Abrir autorización de Google**.
2. Autoriza la cuenta receptora añadida como usuario de prueba y vuelve a la demo.
3. Pulsa **Comprobar GitHub** para verificar la sesión de `gh`.

La autorización de Gmail queda guardada localmente. Que el entorno esté configurado significa que las variables están presentes y tienen un formato válido; la validez de las credenciales se comprueba al consultar las APIs.

### 3. Crea el proyecto y configura sus participantes

En **Proyectos → Nuevo proyecto**, completa:

| Campo                        | Qué elegir                                                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Nombre del proyecto          | Por ejemplo, `Portal del cliente`. Sirve también como contexto para el agente.                                    |
| Repositorio de GitHub        | Carga los repositorios con el botón del campo y selecciona uno, o escribe `owner/repo`.                           |
| Leer correos desde (UTC)     | Fecha **y hora** desde las que quieres incluir mensajes. Elige un momento anterior al primer correo de la prueba. |
| Etiqueta de Gmail (opcional) | Déjala vacía para filtrar únicamente por participantes y fecha.                                                   |

Pulsa **Crear proyecto**. Se abrirá **Configuración del proyecto**. En **Participantes**, añade el correo exacto del remitente o un dominio completo. Por ejemplo, el dominio `live.cl` incluye remitentes como `persona@live.cl`. Puedes añadir varios dominios y direcciones.

**Resultado esperado:** el proyecto tiene su repositorio y sus participantes, y aparece en el selector del sidebar. No necesitas crear un issue previamente ni indicar su número, entrega o referencia de requisito.

### 4. Envía una solicitud y sincroniza

Desde una cuenta incluida entre los participantes, envía al Gmail receptor:

```text
Asunto: Exportación de informes del Portal del cliente

Necesitamos que el Portal del cliente permita descargar los informes en CSV.
El archivo debe incluir las columnas fecha, cliente e importe.
La descarga debe estar disponible desde la pantalla de informes.
```

Si configuraste una etiqueta, aplícala al mensaje en la cuenta receptora.

En **Correos**, pulsa **Sincronizar correo**. Verás los mensajes que coincidan con los filtros y podrás leer su texto. Quedan guardados localmente para el análisis; sincronizar no llama al modelo ni cambia GitHub.

### 5. Analiza, revisa y aprueba

Pulsa **Analizar correos**. El agente compara los mensajes nuevos con los issues abiertos del repositorio y las decisiones guardadas.

En **Propuestas**, abre **Revisar propuesta**. La revisión muestra el motivo, las citas de los mensajes y la descripción completa que se publicará. Si la solicitud todavía no tiene issue, puede proponer **Crear issue**. Si ya existe una tarea relacionada, puede proponer **Actualizar issue**, mostrando también su descripción actual.

Pulsa **Aprobar y crear issue** o **Aprobar y actualizar issue** para ejecutar ese cambio. **Rechazar** conserva la decisión sin escribir en GitHub. Las decisiones pasan a **Historial**; las aprobadas incluyen el enlace al issue. **Actividad** registra el recorrido.

El texto generado depende del modelo. Un saludo o una confirmación no tiene por qué producir una propuesta. Las citas se validan contra los mensajes y los cambios de descripción deben corresponder a extractos únicos del issue.

### 6. Prueba el seguimiento de una conversación

Responde al mismo hilo desde un participante:

```text
Ahora necesitamos los informes en PDF en lugar de CSV.
Las columnas y la ubicación de la descarga se mantienen.
Por favor actualicen la tarea del Portal del cliente con este cambio.
```

Vuelve a **Correos → Sincronizar correo → Analizar correos**. El agente recibe el nuevo mensaje, el contexto anterior de esa conversación y el vínculo con el issue aprobado. Puede proponer actualizar la tarea de CSV a PDF conservando los demás requisitos.

Revisa y aprueba la actualización. No necesitas crear otro proyecto ni capturar un acuerdo inicial. **EN / ES** cambia el idioma de la interfaz; los correos y las propuestas mantienen el idioma de sus fuentes.

## Proyectos y participantes

Cada proyecto tiene configuración, mensajes, propuestas y actividad propios. Un proyecto puede coordinar varias tareas y varios proyectos pueden usar el mismo repositorio. El selector del sidebar cambia el contexto; las rutas incluyen el proyecto, de modo que recargar o volver con el navegador conserva la vista correcta.

| Filtro                          | Coincidencia                                    |
| ------------------------------- | ----------------------------------------------- |
| Correo exacto `ana@empresa.com` | Mensajes enviados por esa dirección.            |
| Dominio `empresa.com`           | Mensajes de remitentes de ese dominio completo. |

Los participantes se combinan con **O** dentro de cada proyecto. Los filtros de un proyecto no excluyen mensajes de otro: si dos proyectos incluyen el mismo remitente, ambos pueden sincronizar sus mensajes. Usa fecha, etiqueta y participantes para acotar el contexto de cada uno. Un dominio no incluye subdominios ni nombres parecidos; añade `sub.empresa.com` por separado.

La fecha incluye mensajes desde el instante elegido en **UTC**, con precisión de segundos. Gmail utiliza una búsqueda por timestamp y el servidor vuelve a comprobar remitente y fecha. Si hay etiqueta, también debe coincidir su nombre exacto. [Filtrado de Gmail API](https://developers.google.com/workspace/gmail/api/guides/filtering).

En **Configurar proyecto** puedes cambiar estos campos sin reiniciar. Cambiar participantes, fecha o etiqueta limpia la copia local de mensajes y requiere sincronizar otra vez. Cambiar el repositorio retira los vínculos anteriores. Las propuestas que ya no correspondan al contexto pasan a **Desactualizada** y no se pueden aprobar.

## Seguimiento automático

En **Configuración del proyecto → Seguimiento automático**, elige un intervalo y pulsa **Activar seguimiento**. El servidor sincroniza y analiza ese proyecto periódicamente, aunque cierres el navegador. Puedes activar varios proyectos o pausar cada uno.

El servidor debe permanecer encendido. El seguimiento solo prepara propuestas; cada creación o actualización sigue necesitando aprobación. Las operaciones se ejecutan una a una, el estado aparece en la UI y los errores quedan en **Actividad**. Ante un error, se espera al menos cinco minutos antes de reintentar automáticamente; puedes corregir la conexión y sincronizar manualmente.

Si llega otra respuesta mientras su propuesta está pendiente, esta queda desactualizada para volver a analizar la conversación. Si alguien modifica los issues después del análisis, la aprobación se detiene y pide analizar otra vez. Esto también puede ocurrir al aprobar varias creaciones consecutivas: cada propuesta se comprueba contra el contexto actual del repositorio.

## Reiniciar la demo

Ve a **Conexiones y datos → Reiniciar datos locales**. La confirmación explica qué se borrará y pide escribir **REINICIAR**; en inglés, **RESET**.

Se eliminan proyectos, participantes, mensajes sincronizados, propuestas, vínculos y actividad de SQLite. **Se conservan `.env`, la autorización de Gmail, los correos originales y los issues de GitHub.** Para quitar únicamente un proyecto, utiliza **Configuración del proyecto → Eliminar proyecto**.

Después del reinicio, crea un proyecto de nuevo. Si ya aprobaste issues, siguen existiendo en GitHub y el agente los tendrá en cuenta al analizar. Reiniciar la base local no borra ni revierte esos cambios externos.

## Datos locales y límites

| Ubicación dentro de `demo/`     | Contenido                                                                                                        |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `.private/company-brain.sqlite` | Configuración, mensajes sincronizados, análisis, propuestas, decisiones, vínculos de conversaciones y actividad. |
| `.private/gmail-token.json`     | Autorización OAuth de Gmail.                                                                                     |
| `.env`                          | Conexiones, cuando usas este archivo.                                                                            |

SQLite persiste al cerrar el navegador y reiniciar el servidor. Se vuelven a mostrar los mensajes y las propuestas guardados sin consultar las APIs al abrir una vista. La sincronización actualiza esa copia según el alcance del proyecto; el análisis procesa mensajes nuevos o fuentes que necesitan revisión.

Para respaldar el estado, detén la demo y copia `.private/`; conserva `.env` por separado. Estos archivos están excluidos de Git y no se sirven como archivos web. GitHub CLI gestiona su propia sesión.

La demo lee **texto plano**, sin adjuntos ni HTML, hasta **500 mensajes por sincronización** y **20.000 caracteres por mensaje**. Consulta hasta **500 issues** y limita la paginación y el contexto enviado al modelo. Para repositorios o buzones mayores, acota la fecha, los participantes y la etiqueta, o utiliza un repositorio específico. No incluye usuarios múltiples ni despliegue público.

Las propuestas no son órdenes ejecutadas por el modelo: el servidor valida acciones, destino, fuentes y estado. Al aprobar, la descripción incluye las citas y un identificador para recuperar una escritura cuya respuesta se perdió, sin duplicar el issue. [API de issues de GitHub](https://docs.github.com/en/rest/issues/issues).

## Si algo no funciona

| Lo que ves                                   | Qué revisar                                                                                                                                                                |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Faltan conexiones                            | Completa las cinco variables en `.env` y reinicia el servidor. Puedes guardar proyectos mientras configuras las cuentas.                                                   |
| Error de `node:sqlite`                       | Usa Node.js ≥22.13; con nvm, ejecuta `nvm use`.                                                                                                                            |
| Gmail sin autorización o error de renovación | Pulsa **Volver a autorizar Gmail**. Comprueba cliente OAuth, Gmail API y cuenta receptora añadida como usuario de prueba.                                                  |
| Cero correos                                 | Cuenta receptora correcta, remitentes incluidos, fecha y hora UTC, y etiqueta aplicada solo si elegiste una.                                                               |
| GitHub 404 o permisos insuficientes          | Comprueba la sesión de `gh`, que el repositorio exista y los permisos de lectura y escritura.                                                                              |
| El modelo devuelve un error                  | Revisa URL, modelo, clave y compatibilidad con Chat Completions; no hay resultados de ejemplo como alternativa.                                                            |
| Evidencia o respuesta inválida               | El modelo debe devolver el JSON solicitado y citas literales. La fuente permanece pendiente de análisis para reintentar.                                                   |
| No hay propuestas                            | Puede no haber solicitudes accionables, el issue ya reflejar la petición o los mensajes estar ya analizados. Revisa el resumen del último análisis.                        |
| Propuesta desactualizada                     | Sincroniza si cambió el correo o la configuración; luego analiza de nuevo antes de aprobar.                                                                                |
| Otra instancia en curso                      | Ejecuta una sola instancia de la demo por carpeta. Si quedó `.private/watch.lock` tras un cierre forzado, elimínalo únicamente cuando no haya otra instancia ejecutándose. |
| Puerto ocupado                               | Usa `PORT=4174 npm start` y abre [http://127.0.0.1:4174](http://127.0.0.1:4174).                                                                                           |

## Código y comprobaciones

| Archivo                                                                                              | Responsabilidad                                                                            |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [demo/web/app.js](demo/web/app.js), [controllers/](demo/web/controllers/), [views/](demo/web/views/) | Entrada, acciones y pantallas; API, estado y componentes tienen módulos propios.           |
| [demo/src/studio.mjs](demo/src/studio.mjs), [services/](demo/src/services/)                          | Coordinación de sincronización, análisis y aprobaciones; seguimiento y conexión separados. |
| [demo/src/agent.mjs](demo/src/agent.mjs)                                                             | Contexto del modelo y validación de evidencia y cambios.                                   |
| [demo/src/coordination-github.mjs](demo/src/coordination-github.mjs)                                 | Repositorios, issues, escritura aprobada y recuperación de reintentos.                     |
| [demo/src/store.mjs](demo/src/store.mjs), [db/schema.mjs](demo/src/db/schema.mjs)                    | Consultas y transacciones; esquema y migraciones SQLite v3.                                |
| [demo/src/domain/](demo/src/domain/), [contracts.mjs](demo/src/contracts.mjs)                        | Validaciones, hashes y contratos documentados con JSDoc en español.                        |
| [demo/src/oauth/](demo/src/oauth/)                                                                   | Autorización local de Gmail y eventos JSON sin tokens ni secretos.                         |

```bash
npm ci
npx playwright install chromium
npm run format
npm run check
```

`format` aplica el formato; `format:check` y `lint` lo comprueban sin modificar archivos. `check` ejecuta ambas comprobaciones, las pruebas de Node, los fixtures originales y Chromium. Las pruebas de navegador usan un trabajador, puertos libres, SQLite temporal y adaptadores aislados: comprueban aprobación, actualización posterior, navegación, formularios, ES/EN y siete vistas en escritorio y móvil. Las capturas y trazas de fallos quedan en `demo/output/playwright/` y en los artefactos de GitHub Actions. [Detalle de desarrollo](demo/README.md#desarrollo).

Las pruebas no acceden a tus cuentas ni modifican tu `.env`. La UI utiliza exclusivamente las integraciones reales. `npm run dev` reinicia el servidor al cambiar su código; `npm run preview` ejecuta la misma aplicación que `npm start`.

[Detalle de conexiones](docs/conectar-cuentas.md) · [Ejemplo original por terminal](docs/scripts.md) · [Video conceptual](https://youtu.be/uB21nWjsx50) · [Artículo sobre Company Brain](https://www.gilbertsahumada.com/blog/que-es-un-company-brain-y-como-puedes)
