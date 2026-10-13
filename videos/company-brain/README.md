# Company Brain: del correo a una decisión

Un cliente acordó recibir reportes en **CSV**. El equipo creó una tarea en GitHub con ese alcance. Días después, el cliente pidió priorizar **PDF** por correo. ¿Cómo hacemos visible esa diferencia antes de seguir construyendo?

Company Brain conecta las conversaciones con el trabajo del equipo. Esta demo reúne el acuerdo inicial, la tarea y la nueva solicitud, y prepara una propuesta con citas de sus fuentes. Tú revisas el comentario antes de publicarlo en GitHub.

El resultado es una vista donde puedes entender **qué se acordó, qué cambió y qué decisión falta tomar**. Todo el recorrido se hace desde la UI después de configurar las conexiones.

[Preparar y probar la demo](#paso-a-paso) · [Proyectos y filtros](#cómo-funcionan-los-proyectos-y-filtros) · [Datos locales](#qué-se-guarda-en-sqlite) · [Resolver problemas](#si-algo-no-funciona)

## Qué hace cada parte

| Parte | Su función en la demo |
|---|---|
| Gmail | Aporta el correo del acuerdo inicial y las solicitudes posteriores. |
| GitHub | Aporta la tarea actual y recibe el comentario que revisas. |
| Modelo de IA | Compara el contexto, identifica una solicitud de cambio y extrae evidencia literal. |
| Servidor local | Filtra correos, valida referencias y citas, guarda el estado y consulta las APIs. |
| Persona que revisa | Decide si publica la propuesta y si el equipo modifica el alcance de la tarea. |

Por ejemplo, la UI mostrará **CSV → PDF**, las citas de ambos correos y la tarea que todavía pide CSV. Publicar deja un comentario pendiente de revisión humana. El cambio de alcance lo decide el equipo en GitHub.

Esta implementación cubre un caso acotado: cambios entre **CSV y PDF**, con **un issue y un acuerdo inicial por proyecto**. Puedes gestionar varios proyectos. El modelo recibe el contexto de cada caso; no dispone de herramientas para ejecutar acciones.

## Antes de empezar

Necesitas:

- **Node.js ≥22.13**. Compruébalo con `node --version`. La demo usa SQLite incluido en Node y no requiere instalar paquetes.
- **GitHub CLI (`gh`)** y una cuenta con acceso al repositorio donde crearás el issue y publicarás comentarios.
- **Una cuenta receptora de Gmail** y acceso a Google Cloud para crear un cliente OAuth. Para reproducir la conversación, usa otra cuenta como remitente; puede ser de cualquier proveedor de correo.
- **Una API compatible con Chat Completions**, con su URL HTTPS, modelo y clave de API. Las consultas al modelo usan tu cuenta del proveedor.

Elige las cuentas reales con las que harás la prueba. Las plantillas de abajo son textos para que envíes los correos tú mismo; la aplicación carga los mensajes de Gmail y el issue de GitHub.

## Paso a paso

### 1. Prepara las conexiones

Si todavía no tienes el repositorio:

```bash
git clone https://github.com/gilbertsahumada/youtube-tutorials.git
cd youtube-tutorials/videos/company-brain/demo
```

Si ya lo tienes, entra en `videos/company-brain/demo` desde su raíz. Todos los comandos siguientes se ejecutan en esa carpeta.

```bash
cp -n .env.example .env
```

Esto crea `.env` sin reemplazar una configuración existente. Si usas nvm, ejecuta `nvm use` para usar la versión indicada en `.nvmrc`.

**Google y Gmail**

1. Crea o selecciona un proyecto en [Google Cloud](https://console.cloud.google.com/) y habilita **Gmail API**.
2. En **Google Auth Platform**, configura los datos de la aplicación. Para probar con una cuenta personal, elige audiencia **External**, deja la aplicación en **Testing** y añade el correo receptor como usuario de prueba. [Configuración oficial del consentimiento](https://developers.google.com/workspace/guides/configure-oauth-consent).
3. En **Data Access**, incluye `https://www.googleapis.com/auth/gmail.readonly`. Este permiso permite leer mensajes; la demo acota la búsqueda con los participantes, la fecha y la etiqueta opcional del proyecto. [Permisos de Gmail](https://developers.google.com/workspace/gmail/api/auth/scopes).
4. En **Clients**, crea un cliente OAuth de tipo **Desktop app / Aplicación de escritorio**. Copia su **Client ID** y **Client secret** a `.env`. [Guía oficial para habilitar Gmail API y crear el cliente](https://developers.google.com/workspace/gmail/api/quickstart/nodejs).
**Completa estas cinco variables en `.env`:**

| Variable | Qué poner |
|---|---|
| `GOOGLE_CLIENT_ID` | Client ID del cliente OAuth de escritorio que acabas de crear. |
| `GOOGLE_CLIENT_SECRET` | Client secret de ese mismo cliente. |
| `MODEL_BASE_URL` | URL base HTTPS de tu proveedor compatible con Chat Completions, sin `/chat/completions`. |
| `MODEL_ID` | Identificador de un modelo disponible en ese proveedor y en tu cuenta. |
| `MODEL_API_KEY` | Clave de API del mismo proveedor. |

Estas son todas las variables de la plantilla. El repositorio, el issue, los participantes, la fecha de inicio y la etiqueta opcional se configuran por proyecto en la UI y se guardan en SQLite. El correo inicial también se selecciona en la UI; su ID se guarda al capturar el acuerdo.

Obtén las tres variables del modelo en el panel o la documentación de tu proveedor. El servidor añade `/chat/completions` a la URL base. La URL, el modelo y la clave deben corresponder a la misma API. El modelo recibirá los textos de los correos y del issue para analizarlos.

**GitHub**

Inicia sesión con la cuenta que tendrá acceso al issue:

```bash
gh auth login
```

GitHub CLI te guía por la autorización. [Ayuda oficial del comando](https://cli.github.com/manual/gh_auth_login).

Las credenciales se leen únicamente en el servidor, desde `.env` o el entorno del proceso. Si faltan variables o sus valores tienen un formato inválido, la UI muestra el error. Tras cambiar `.env`, reinicia el servidor. Los valores cargados se comprueban con las APIs al conectar o analizar; **“Entorno listo” no garantiza que una clave sea válida**.

### 2. Crea la tarea y el proyecto

En GitHub, crea un repositorio de prueba o usa uno donde puedas publicar comentarios. Crea un **issue abierto** con el título **Implementar exportación CSV** y esta descripción:

```text
Proyecto: portal-cliente
Entrega: entrega-1
Requisito: exportar-reportes
Formato actual: CSV

Implementar exportación CSV.

Aceptación: generar un archivo CSV descargable con los datos del reporte.
```

Guarda el nombre del repositorio y el número real del issue. Por ejemplo, si su URL termina en `TU_USUARIO/company-brain-sandbox/issues/3`, el repositorio es `TU_USUARIO/company-brain-sandbox` y el número es `3`.

Arranca la demo:

```bash
npm start
```

Abre [http://127.0.0.1:4173](http://127.0.0.1:4173). En **Proyectos y filtros**, completa:

| Campo | Valor para esta prueba |
|---|---|
| Nombre del proyecto | `Portal del cliente` |
| Referencia del proyecto | `portal-cliente` |
| Repositorio de GitHub | Tu repositorio real, en formato `owner/repo`. |
| Número del issue | El número del issue que acabas de crear. |
| Referencia de la entrega | `entrega-1` |
| Referencia del requisito | `exportar-reportes` |
| Leer correos desde (UTC) | El día del acuerdo inicial o uno anterior. Por defecto aparece el día actual en UTC. |
| Etiqueta de Gmail (opcional) | Déjala vacía para consultar por participantes. |

Pulsa **Crear proyecto**. En **Correos y dominios**, selecciona ese proyecto, elige **Correo exacto**, introduce la dirección real desde la que enviarás los dos correos y pulsa **Guardar filtro**. El filtro corresponde al **remitente**, no a la cuenta receptora de Gmail.

El nombre del proyecto es una etiqueta para la UI. Las tres referencias identifican el caso: deben aparecer iguales en el formulario, el issue y los correos. Usa minúsculas, números y guiones, como en el ejemplo. El issue necesita una única línea `Formato actual: CSV` o `Formato actual: PDF`.

**Resultado esperado:** el proyecto aparece en **Tus proyectos**, con su issue y su filtro, en estado **Pendiente de captura**. Puedes crear proyectos y filtros incluso mientras completas el entorno; para consultar las cuentas necesitas las cinco variables.

### 3. Conecta las cuentas desde la UI

Selecciona **Portal del cliente** y entra en **Conexiones**:

1. Pulsa **Conectar Gmail** y luego **Abrir autorización de Google**.
2. Autoriza la **cuenta receptora** que añadiste como usuario de prueba y vuelve a la demo.
3. Pulsa **Comprobar acceso** para verificar la sesión de GitHub CLI. El acceso al issue concreto se comprobará al capturar el acuerdo.

**Resultado esperado:** Gmail muestra **Lectura autorizada**, el entorno está listo y puedes pulsar **Cargar correos**. La autorización se guarda localmente; no tienes que pegar un token en la UI.

### 4. Envía y captura el acuerdo inicial

Desde la cuenta remitente que guardaste en el filtro, envía un correo al Gmail receptor.

**Asunto:** `company-brain-demo — acuerdo inicial`

**Cuerpo:**

```text
Para el proyecto portal-cliente, entrega-1, acordamos CSV para exportar-reportes.

La primera entrega debe permitir descargar los reportes en CSV.
```

Si dejaste la etiqueta vacía, no tienes que etiquetar el mensaje. En la demo, abre **Conexiones → Cargar correos** y selecciona **Capturar acuerdo** junto al asunto que acabas de enviar.

El servidor consulta el issue y el modelo identifica el acuerdo. Solo guarda el contexto inicial si las referencias y el formato coinciden y la evidencia aparece literalmente en el correo.

**Resultado esperado:** verás **Contexto guardado**, **Acuerdo CSV** y el número del issue. Este paso conserva una copia del correo y de la tarea inicial como referencia para comparar las solicitudes futuras. Todavía no hay una solicitud de PDF ni una propuesta de cambio.

### 5. Envía una nueva solicitud y revisa la propuesta

Después de capturar el acuerdo, envía **otro correo** desde el mismo remitente al mismo Gmail receptor.

**Asunto:** `company-brain-demo — cambio de prioridad`

**Cuerpo:**

```text
Para el proyecto portal-cliente, entrega-1, necesito que prioricemos PDF en lugar de CSV para exportar-reportes.

Por favor planteen el cambio y su impacto antes de modificar el alcance.
```

Este mensaje debe ser posterior al correo inicial. Solo aplica una etiqueta si elegiste una en el proyecto.

En **Centro de decisiones**, pulsa **Buscar solicitudes**. Si ya tienes el contexto en pantalla, el botón puede aparecer como **Buscar nuevas solicitudes**. La vista reúne:

- **Lo que sabemos:** el correo inicial que acuerda CSV y el issue actual.
- **Lo que cambió:** el nuevo correo que solicita PDF.
- **Lo que propone el Brain:** la comparación **CSV → PDF**, una explicación y la propuesta pendiente de tu revisión.

Abre **Revisar propuesta**. Comprueba las citas de ambos correos y el comentario que se publicará. La explicación puede variar según el modelo, pero la evidencia debe copiarse literalmente de los mensajes.

Pulsa **Publicar comentario en GitHub** y abre el issue para verlo. **Resultado esperado:** un comentario que cita el acuerdo y la solicitud, propone priorizar PDF y deja explícita la revisión humana pendiente. La descripción del issue seguirá indicando CSV hasta que el equipo decida modificarla.

También puedes abrir **Fuentes de contexto** para leer los documentos completos y **Actividad** para seguir el recorrido. El botón **EN / ES** cambia el idioma de la interfaz; las fuentes y el comentario conservan su contenido.

## Cómo funcionan los proyectos y filtros

Cada proyecto guarda su destino de GitHub, sus referencias, participantes, fecha de inicio, etiqueta opcional, acuerdo inicial y propuestas. Usa el selector **Proyecto** para cambiar de contexto. Un mismo issue solo puede estar asociado a un proyecto.

En **Proyectos y filtros** puedes añadir o eliminar filtros sin reiniciar:

| Tipo | Qué incluye |
|---|---|
| Correo exacto: `ana@empresa.com` | Mensajes cuyo remitente sea esa dirección. |
| Dominio completo: `empresa.com` | Mensajes de remitentes de ese dominio. |

El correo exacto tiene prioridad sobre el dominio **entre todos los proyectos**. Si el proyecto A incluye `empresa.com` y el B incluye el correo exacto `ana@empresa.com`, los mensajes de Ana se asignan al B. Para dominios, escribe `empresa.com`, sin URL; `sub.empresa.com` necesita otro filtro.

Si la misma dirección está en varios proyectos, o varios proyectos comparten un dominio sin una regla exacta que resuelva el destino, **Conexiones → Cargar correos** muestra **Correos por asignar**. Elige un proyecto y pulsa **Asignar correo** antes de capturarlo o analizarlo. La asignación se guarda para ese mensaje.

Gmail busca directamente por los **correos y dominios del proyecto seleccionado** y su **fecha de inicio**. El servidor vuelve a comprobar el remitente y el dominio completo antes de utilizar los mensajes. Las referencias del texto se validan antes de generar la propuesta. [Búsquedas con Gmail API](https://developers.google.com/workspace/gmail/api/guides/filtering).

**La etiqueta es opcional.** Si quieres acotar más la búsqueda, crea una etiqueta en el Gmail receptor, introduce su nombre exacto en **Editar proyecto → Etiqueta de Gmail** y aplícala a los mensajes, incluido el acuerdo inicial. Déjala vacía para buscar solo por participantes y fecha.

La fecha incluye correos desde las **00:00 UTC** del día elegido. Para usar mensajes anteriores, cambia **Leer correos desde (UTC)**. El servidor impide guardar una fecha que deje fuera el acuerdo capturado. Estos cambios se guardan en SQLite y se aplican en la siguiente consulta, sin reiniciar.

Una vez capturado el acuerdo, el destino y las referencias del proyecto quedan fijos. Puedes editar su nombre, filtros, fecha y etiqueta opcional. Para trabajar con otro issue o alcance, crea otro proyecto.

## Qué se guarda en SQLite

Los proyectos y sus filtros son configuración persistente. SQLite los conserva al cerrar el navegador o reiniciar el servidor, junto con los acuerdos y las propuestas que necesitas volver a revisar.

| Ubicación, dentro de `demo/` | Contenido |
|---|---|
| `.private/company-brain.sqlite` | Proyectos, fechas de inicio, etiquetas opcionales, filtros, asignaciones de mensajes, contexto inicial, análisis, propuestas, publicaciones y actividad. |
| `.private/gmail-token.json` | Autorización OAuth para volver a consultar Gmail. |
| `output/<referencia-del-proyecto>/` | Diagnósticos de los análisis y comentarios preparados. |
| `.env` | Configuración de conexiones, si eliges usar este archivo. |

La base guarda el contexto utilizado por la demo; no replica todo el buzón. Las propuestas pendientes vuelven a aparecer al recargar. El estado de publicación y un identificador en el comentario permiten evitar publicaciones duplicadas.

Para respaldar el estado, detén la demo y copia `.private/`. Conserva `.env` por separado si necesitas restaurar las conexiones; la sesión de GitHub CLI se gestiona con `gh`. `.env`, `.private/` y `output/` están excluidos de Git, y los archivos privados y diagnósticos no se sirven como archivos web.

Al iniciar con una base vacía, crea tu primer proyecto desde **Proyectos y filtros**. Los proyectos guardados en SQLite vuelven a aparecer al reiniciar.

## Si algo no funciona

| Lo que ves | Qué revisar |
|---|---|
| Error de entorno | Completa las cinco variables indicadas y reinicia el servidor. La UI usa datos reales y muestra el error cuando faltan conexiones. |
| Error relacionado con `node:sqlite` | Ejecuta la demo con Node.js ≥22.13; con nvm, usa `nvm use` en `demo/`. |
| Google bloquea la autorización | Gmail API activa, cliente OAuth de escritorio y Gmail receptor añadido como usuario de prueba. Si falla la renovación del token, vuelve a conectar Gmail. |
| No aparecen correos | Autoriza la cuenta receptora correcta y revisa los participantes y la fecha en **Editar proyecto**. Si elegiste una etiqueta, aplícala a cada mensaje o deja ese campo vacío. Revisa también **Correos por asignar**. |
| GitHub devuelve un error | Sesión de `gh`, permisos sobre el repositorio, formato `owner/repo` y número real de un issue abierto. |
| No se puede capturar el acuerdo | Las tres referencias deben coincidir; el correo inicial y la línea `Formato actual:` del issue deben acordar el mismo formato. |
| El modelo falla o la evidencia se rechaza | Revisa URL base, modelo y clave. Las citas deben ser literales, tener al menos 20 caracteres y mencionar el formato. Consulta los diagnósticos en `output/<proyecto>/`; un diagnóstico no implica que se haya guardado el acuerdo. |
| No se propone un cambio | La solicitud debe ser posterior al acuerdo, pertenecer al mismo caso y pedir otro formato. Si el issue ya solicita PDF, pedir PDF no genera una nueva propuesta. |
| El issue cambió antes de publicar | Busca solicitudes de nuevo para preparar el comentario con la tarea actual. |
| Puerto ocupado | Arranca con `PORT=4174 npm start` y abre [http://127.0.0.1:4174](http://127.0.0.1:4174). Ejecuta una sola instancia o script a la vez. |

**Observar Gmail** consulta nuevas solicitudes cada 30 segundos mientras la página está abierta. Cambiar de proyecto o navegar a otra vista detiene la observación. Las propuestas se publican con su botón de revisión.

Para esta demo se lee texto plano, sin adjuntos, con un máximo de 20.000 caracteres por mensaje y 500 correos por consulta. Si necesitas procesar más, acota los participantes, la fecha o la etiqueta opcional del proyecto. [Más detalles de las conexiones](docs/conectar-cuentas.md).

## Explorar el código y comprobarlo

| Archivo | Qué encontrarás |
|---|---|
| [demo/web/app.js](demo/web/app.js) | Formularios, fuentes, revisión de propuestas e interacción con el servidor. |
| [demo/src/studio.mjs](demo/src/studio.mjs) | El recorrido de captura, análisis y publicación por proyecto. |
| [demo/src/filters.mjs](demo/src/filters.mjs) | Coincidencias de correos y dominios y su prioridad. |
| [demo/src/store.mjs](demo/src/store.mjs) | Persistencia local y validación de proyectos. |
| [demo/src/plan.mjs](demo/src/plan.mjs) | Consulta al modelo, validación de evidencia y preparación del comentario. |

Desde `demo/`:

```bash
npm test
npm run test:fixture
```

Estas comprobaciones usan datos aislados y no publican comentarios. Los archivos de `fixtures/` se usan para pruebas; la UI no los carga como sustituto de las cuentas reales. `npm run preview` ejecuta la misma interfaz con datos reales, y `npm run dev` reinicia el servidor al cambiar su código.

[Comandos originales por terminal](docs/scripts.md) · [Video conceptual](https://youtu.be/uB21nWjsx50) · [Artículo sobre Company Brain](https://www.gilbertsahumada.com/blog/que-es-un-company-brain-y-como-puedes)
