# Acortador de enlaces con Cloudflare Workers Hono y D1

Este tutorial permite construir y probar **tres ejemplos en TypeScript**, en orden y sobre el mismo proyecto. Incluye la inicialización, los archivos completos, los comandos y el resultado que debes comprobar en cada etapa. Puedes seguirlo sin ver el video y sin abrir Notion.

Un **acortador de enlaces** guarda una URL de destino asociada a un alias, llamado `slug`. Por ejemplo, guardamos `workers → https://developers.cloudflare.com/workers/` y compartimos `https://TU-WORKER.workers.dev/workers`. Al abrir ese enlace, el navegador llama al Worker, el Worker busca el destino y responde con una redirección `302`; el navegador abre la página original.

Construiremos **un solo proyecto que evoluciona en tres etapas**:

1. **Worker a mano:** `/workers` lleva a un destino fijo escrito en TypeScript; `/health` permite comprobar que responde. Todavía no podemos guardar enlaces nuevos.
2. **Hono:** conserva ese comportamiento, pero organiza las rutas y obtiene el alias desde `/:slug`. El destino sigue escrito en el código.
3. **Hono y D1:** `POST /api/links` recibe una URL y un alias opcional, guarda la relación en D1 y devuelve el enlace corto. `GET /:slug` consulta la base y redirige. Crear enlaces requiere un token; abrirlos es público.

La demo se utiliza mediante peticiones HTTP y enlaces en el navegador. Local Explorer es la interfaz de desarrollo que aporta Wrangler para inspeccionar los recursos; nuestra aplicación responde con JSON y redirecciones.

| Ejemplo | Qué construyes | Qué puedes comprobar |
|---|---|---|
| [1. Worker a mano](#ejemplo-1-worker-a-mano) | Un handler HTTP con una redirección fija | JSON, `302` y rutas inexistentes |
| [2. Rutas con Hono](#ejemplo-2-rutas-con-hono) | Las mismas rutas organizadas con Hono | Parámetros de ruta y el mismo comportamiento |
| [3. Enlaces con D1](#ejemplo-3-enlaces-con-d1) | Una API que crea y consulta enlaces guardados | Persistencia, token, validación y redirección |

Si solo quieres ejecutar la versión terminada que viene en el repositorio, sigue el [README de demo](demo/README.md). La ruta principal de este documento empieza con un proyecto nuevo. Las [versiones de referencia](etapas/README.md) contienen el mismo código que aparece abajo.

## Desarrollo local y despliegue

Probamos cada etapa en nuestra máquina con Wrangler y después publicamos el código en Cloudflare. La copia local y la desplegada tienen direcciones y datos independientes:

| Acción o dirección | Para qué sirve |
|---|---|
| `npm run dev` | Ejecuta `wrangler dev`, inicia el Worker local y recarga el código al guardar |
| `http://localhost:8787/` | Es nuestra aplicación local; la raíz devuelve JSON |
| `http://localhost:8787/cdn-cgi/local/explorer` | Abre Local Explorer para inspeccionar los recursos locales, incluida D1 cuando la configuremos |
| `npm run deploy` | Publica el código actual en Cloudflare y devuelve una URL pública |
| `https://TU-WORKER.workers.dev/` | Es la aplicación desplegada; sigue funcionando con el servidor local apagado |

Guardar un archivo no actualiza la versión desplegada. En esta demo, D1 local guarda su estado en `.wrangler/state`; reiniciar el servidor conserva los registros, pero borrar ese directorio elimina esos datos locales. `deploy` tampoco copia a Cloudflare la tabla ni los registros locales: prepararemos el esquema y crearemos los enlaces remotos por separado. Local Explorer muestra la base local de esta configuración; el panel de Cloudflare permite consultar la base remota.

## Requisitos y organización

- Node.js 22 o 24 actualizado y npm. Comprueba los [requisitos de Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/).
- Una cuenta de Cloudflare para desplegar el primer Worker y crear D1.
- Un editor, un navegador y `curl`.
- Bash o Zsh para los ejemplos de terminal; puedes usar WSL en Windows.
- El puerto 8787 libre. Si eliges otro, cambia también las URLs de las peticiones.

Abre **dos terminales en la misma carpeta padre**, donde crearás el proyecto:

- **Terminal A:** inicializa el proyecto y mantiene el servidor local.
- **Terminal B:** instala dependencias adicionales, hace peticiones y administra los recursos remotos.

En ambas comprueba las versiones:

```bash
node --version
npm --version
```

Después de entrar al proyecto, ambas terminales permanecen en su raíz, donde están `package.json` y `wrangler.jsonc`. Cuando A ejecute `npm run dev`, déjala abierta; los comandos siguientes se ejecutan en B hasta que se indique lo contrario.

## Ejemplo 1 Worker a mano

El objetivo es abrir `/workers` y llegar a la documentación de Cloudflare. El destino estará fijo en el handler; usaremos `/health` para comprobar que la aplicación responde antes de probar la redirección.

### Inicializar el proyecto TypeScript

En **A**, desde la carpeta padre:

```bash
npm create cloudflare@latest -- acortador-workers-demo
```

Acepta instalar `create-cloudflare` si npm lo solicita. Elige:

1. **Hello World example**.
2. **Worker only**.
3. **TypeScript**.
4. Git: **Yes** si estás en una carpeta independiente; el asistente puede omitirlo dentro de otro repositorio.
5. `AGENTS.md`: **No** para este recorrido manual.
6. Deploy: **No**; publicaremos después de probar el código.

Entra en el proyecto:

```bash
cd acortador-workers-demo
```

Si ya inicializaste esta carpeta, omite la creación y entra directamente. No vuelvas a generar un proyecto encima de otro.

Create Cloudflare, o C3, crea la estructura y las dependencias. **Wrangler** es la herramienta de Cloudflare que usaremos para desarrollar localmente, generar tipos, desplegar y administrar D1 y secrets. C3 ya lo incluye; este comando muestra cómo instalarlo o actualizarlo dentro del proyecto. Fijamos las versiones utilizadas en la auditoría:

```bash
npm install -D --save-exact wrangler@4.152.0 typescript@5.9.3
npx wrangler --version
```

No necesitas instalar Wrangler globalmente. `npx wrangler` utiliza la instalación del proyecto. Conserva `package-lock.json` para reproducir sus dependencias.

### Revisar la configuración

C3 genera estos archivos; no tienes que crearlos desde cero:

```text
acortador-workers-demo/
  src/index.ts
  wrangler.jsonc
  tsconfig.json
  package.json
  package-lock.json
```

En `wrangler.jsonc`, conserva las opciones y la fecha de compatibilidad generadas. Comprueba que el nombre sea el de tu proyecto y que `main` apunte a `src/index.ts`. El archivo de entrada será TypeScript durante las tres etapas.

La fecha de compatibilidad fija comportamientos del runtime. Puede ser anterior al día en que creaste el proyecto; no necesitas cambiarla para seguir el ejemplo.

Conserva `Env`, el nombre de la interfaz de tipos que viene en el scaffold. Conserva también `tsconfig.json` y `worker-configuration.d.ts`, generado durante la inicialización. No edites ese archivo de tipos a mano.

Agrega únicamente un script para comprobar TypeScript en **A**, sin borrar los scripts de la plantilla:

```bash
npm pkg set 'scripts.typecheck=tsc --noEmit'
```

### Escribir el handler completo

Reemplaza **todo** `src/index.ts` por:

```typescript
export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'GET' && url.pathname === '/') {
      return Response.json({ message: 'Prueba /workers o /health' })
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      return Response.json({ ok: true })
    }

    if (request.method === 'GET' && url.pathname === '/workers') {
      return Response.redirect('https://developers.cloudflare.com/workers/', 302)
    }

    return Response.json({ error: 'No encontrado' }, { status: 404 })
  }
} satisfies ExportedHandler<Env>
```

Cloudflare llama a `fetch` cuando llega una petición HTTP. El handler lee el path y devuelve una respuesta. `Request` y `Promise<Response>` tipan la entrada y la salida; `satisfies ExportedHandler<Env>` comprueba que el objeto cumpla el contrato de un Worker. `Env` describe los recursos disponibles en el argumento `env`; esta comprobación solo ocurre durante el desarrollo.

`Response.redirect(..., 302)` le indica al cliente que haga otra petición al destino. El Worker no descarga la página de Cloudflare ni la sirve como intermediario.

### Ejecutar y comprobar el primer ejemplo

En **A**:

```bash
npm run typecheck
npm run dev
```

El primer comando ejecuta `tsc --noEmit` para comprobar TypeScript sin generar archivos JavaScript. El segundo mantiene un servidor local en ejecución.

En **B**, desde la misma carpeta padre donde comenzó A, entra al proyecto **una sola vez**:

```bash
cd acortador-workers-demo
pwd
curl -i http://localhost:8787/health
curl -i http://localhost:8787/workers
curl -i http://localhost:8787/no-existe
```

| Petición | Resultado esperado |
|---|---|
| `/health` | `200` con `{"ok":true}` |
| `/workers` | `302` y `Location: https://developers.cloudflare.com/workers/` |
| `/no-existe` | `404` con `{"error":"No encontrado"}` |

Abre `http://localhost:8787/workers` en el navegador para seguir la redirección. `curl` sin `-L` permite ver el `302` sin seguirlo. Hasta aquí la aplicación corre en tu máquina.

### Abrir Local Explorer

Con `npm run dev` todavía ejecutándose en **A**, abre en el navegador:

[http://localhost:8787/cdn-cgi/local/explorer](http://localhost:8787/cdn-cgi/local/explorer)

Wrangler proporciona este panel junto al servidor local. Detecta los bindings configurados y permite inspeccionar los recursos y las peticiones del Worker. En este momento todavía no hemos agregado D1: no esperes encontrar la tabla `links`. Volveremos a esta misma dirección cuando guardemos el primer enlace.

Conserva abierta la terminal A y esta pestaña. Si cambiaste el puerto, usa el que imprime Wrangler en ambas direcciones. `http://localhost:8787/` sigue siendo la raíz de nuestra aplicación y devuelve JSON; el panel está bajo `/cdn-cgi/local/explorer`.

Consulta la [documentación de Local Explorer](https://developers.cloudflare.com/workers/local-development/local-explorer/). La versión de Wrangler utilizada en este recorrido, 4.152.0, incluye esta herramienta.

### Publicar el primer Worker

En **B**, dentro del proyecto:

```bash
npx wrangler login
npx wrangler whoami
npm run deploy
```

`login` abre el navegador para autorizar Wrangler. `whoami` permite comprobar la cuenta. `deploy` prepara el código y lo publica. Si tu cuenta tiene varios destinos, selecciona el que quieres usar. En el primer despliegue puede ser necesario configurar el subdominio `workers.dev`.

Copia la URL que imprime Wrangler y reemplaza el ejemplo siguiente, sin slash final:

```bash
DEMO_BASE_URL='https://acortador-workers-demo.TU-SUBDOMINIO.workers.dev'
curl -i "$DEMO_BASE_URL/health"
curl -i "$DEMO_BASE_URL/workers"
```

Debes obtener `200` y `302`. Conserva B abierta: volveremos a usar `DEMO_BASE_URL` al publicar el tercer ejemplo. Si cierras la terminal, asigna de nuevo la URL antes de continuar.

**Primer ejemplo terminado:** el mismo handler responde localmente y desde una dirección HTTPS pública.

## Ejemplo 2 Rutas con Hono

El resultado para quien abre `/workers` será el mismo. Ahora organizaremos las rutas con Hono y leeremos el alias como parámetro de `/:slug`; todavía no hay almacenamiento ni una API para crear enlaces. Continuamos dentro del mismo proyecto.

Partimos del proyecto del ejemplo 1. A sigue ejecutando el servidor y B permanece dentro de `acortador-workers-demo`.

### Instalar Hono

En **B**:

```bash
npm install --save-exact hono@4.13.13
```

Hono permite declarar métodos, rutas y parámetros sin acumular condiciones dentro del handler. Seguimos ejecutando el código como un Worker.

### Reemplazar el handler

Reemplaza **todo** `src/index.ts` por:

```typescript
import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => c.json({ message: 'Prueba /workers o /health' }))
app.get('/health', (c) => c.json({ ok: true }))

app.get('/:slug', (c) => {
  const slug = c.req.param('slug')

  if (slug === 'workers') {
    return c.redirect('https://developers.cloudflare.com/workers/', 302)
  }

  return c.json({ error: 'Enlace no encontrado' }, 404)
})

app.notFound((c) => c.json({ error: 'No encontrado' }, 404))

export default app
```

`app.get` define una ruta GET. `/:slug` captura una parte de la URL; `c.req.param('slug')` la lee. `c.json` devuelve JSON y `c.redirect` construye una redirección.

En este ejemplo solo `workers` tiene un destino fijo. Todavía no hay una base de datos ni un endpoint que cree enlaces. `/health` se declara antes de la ruta con el parámetro.

### Comprobar el segundo ejemplo

Guarda el archivo: Wrangler recarga al detectar el cambio. En **B**:

```bash
npm run typecheck
curl -i http://localhost:8787/health
curl -i http://localhost:8787/workers
curl -i http://localhost:8787/no-existe
```

Esperado: `200`, `302` y `404`, respectivamente. El último cuerpo ahora es `{"error":"Enlace no encontrado"}`.

Si el servidor no recarga, pulsa **Ctrl+C en A**, vuelve a ejecutar `npm run dev` y repite las peticiones en B.

**Segundo ejemplo terminado:** cambió la organización de las rutas y conservamos la redirección. La URL pública sigue ejecutando el código del primer despliegue; los cambios locales se publican al volver a desplegar.

## Ejemplo 3 Enlaces con D1

Partimos del ejemplo 2, con Hono instalado. Ahora queremos crear enlaces sin cambiar el código cada vez: guardaremos el slug y su destino en D1. Enviaremos una URL larga a `POST /api/links`, recibiremos un enlace con nuestro dominio y un alias, y podremos abrirlo con `GET /:slug`. Las redirecciones serán públicas y la creación requerirá un token.

### Crear la base y conectar el binding

En **B**, con la cuenta de Cloudflare autenticada:

```bash
npx wrangler d1 create acortador-db --binding DB --update-config
```

El comando crea una base **remota** y escribe en `wrangler.jsonc` el binding `DB`, el nombre y el ID reales. Abre el archivo y comprueba que `d1_databases` contenga esa información. No reemplaces el resto de la configuración ni pegues un ID de ejemplo.

Si ya existe `acortador-db` en tu cuenta, elige otro nombre y úsalo también en los comandos D1 que siguen. Para reutilizar una base existente, configura su nombre e ID reales en `wrangler.jsonc` en lugar de crearla de nuevo.

Un binding conecta al Worker con un recurso. Nuestro código accederá a esta base mediante `c.env.DB`, sin escribir una conexión con usuario y contraseña.

Ahora que agregamos D1, necesitamos actualizar los tipos. `cf-typegen` es un script de `package.json` que ejecuta `wrangler types`: lee la configuración y genera `worker-configuration.d.ts`. No crea la base, no aplica SQL y no despliega el Worker. Conservamos el nombre predeterminado `Env`.

En **B**, asegura que el script use el comando predeterminado y ejecútalo:

```bash
npm pkg set 'scripts.cf-typegen=wrangler types'
npm run cf-typegen
```

El scaffold normalmente ya incluye ese script; `npm pkg set` lo deja explícito y también corrige una copia que antes usara otro nombre de interfaz. En `worker-configuration.d.ts` aparecerá `DB: D1Database` dentro de `Env`. No escribas esa declaración a mano. Repite `npm run cf-typegen` cuando cambies los bindings u otra configuración que afecte a los tipos. `npm run typecheck` comprueba el código usando los tipos generados.

### Crear el esquema local

Crea `schema.sql` en la raíz del proyecto, junto a `wrangler.jsonc`, con este contenido completo:

```sql
CREATE TABLE IF NOT EXISTS links (
  slug TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

En **B**:

```bash
npx wrangler d1 execute acortador-db --local --file=schema.sql
```

Este comando prepara la tabla **local**, aunque el recurso remoto se creó en el paso anterior. `CREATE TABLE IF NOT EXISTS` permite repetir el esquema inicial sin borrar registros. Mantén el estado `.wrangler` entre ejecuciones para conservar los datos locales.

### Configurar el token local

Comprueba que `.gitignore` excluya estos archivos; agrega las entradas que falten, sin borrar las reglas de C3:

```text
.dev.vars
.dev.vars.*
.env*
```

Crea `.dev.vars` junto a `wrangler.jsonc` con:

```text
ADMIN_TOKEN="solo-para-ensayo-local"
```

Es un valor público de ensayo. Más adelante generaremos otro token para la versión desplegada. Este archivo se carga en desarrollo y no se sube con `deploy`.

### Escribir la API completa

Reemplaza **todo** `src/index.ts` por:

```typescript
import { Hono } from 'hono'
import { bearerAuth } from 'hono/bearer-auth'

type Bindings = Env & {
  ADMIN_TOKEN?: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', (c) => c.json({ message: 'Acortador con Workers, Hono y D1' }))
app.get('/health', (c) => c.json({ ok: true }))

app.use('/api/*', async (c, next) => {
  if (!c.env.ADMIN_TOKEN) {
    return c.json({ error: 'Falta configurar ADMIN_TOKEN' }, 503)
  }

  return bearerAuth<{ Bindings: Bindings }>({ token: c.env.ADMIN_TOKEN })(c, next)
})

app.post('/api/links', async (c) => {
  const body = await c.req.json<unknown>().catch(() => null)

  if (!body || typeof body !== 'object' || !('url' in body)
      || typeof body.url !== 'string' || body.url.length > 2048) {
    return c.json({ error: 'Envia una URL de hasta 2048 caracteres' }, 400)
  }

  let destination: URL
  try {
    destination = new URL(body.url)
  } catch {
    return c.json({ error: 'URL invalida' }, 400)
  }

  if (!['http:', 'https:'].includes(destination.protocol)) {
    return c.json({ error: 'Solo aceptamos http o https' }, 400)
  }

  const requestedSlug = 'slug' in body ? body.slug : undefined
  const slug = requestedSlug ?? crypto.randomUUID().slice(0, 8)

  if (typeof slug !== 'string' || !/^[a-z0-9-]{3,32}$/.test(slug)
      || ['api', 'health'].includes(slug)) {
    return c.json({ error: 'Slug: 3-32 caracteres a-z, 0-9 o guion; api y health estan reservados' }, 400)
  }

  const result = await c.env.DB.prepare(
    'INSERT INTO links (slug, url) VALUES (?, ?) ON CONFLICT(slug) DO NOTHING'
  ).bind(slug, destination.href).run()

  if (result.meta.changes === 0) {
    return c.json({ error: 'Ese slug ya existe; elige otro' }, 409)
  }

  return c.json({
    slug,
    url: destination.href,
    shortUrl: new URL(`/${slug}`, c.req.url).href
  }, 201)
})

app.get('/:slug', async (c) => {
  const link = await c.env.DB.prepare(
    'SELECT url FROM links WHERE slug = ?'
  ).bind(c.req.param('slug')).first<{ url: string }>()

  if (!link) {
    return c.json({ error: 'Enlace no encontrado' }, 404)
  }

  return c.redirect(link.url, 302)
})

app.notFound((c) => c.json({ error: 'No encontrado' }, 404))

export default app
```

El tipo `Bindings` combina los recursos generados por Wrangler con el secret de la aplicación. `new Hono<{ Bindings: Bindings }>()` da tipos a `c.env`.

El middleware protege `/api/*`. Si falta configurar el token, devuelve `503`; si la petición no presenta un token válido, devuelve `401`. Las redirecciones continúan públicas.

El POST lee JSON como `unknown` y comprueba su estructura: TypeScript no valida los datos que llegan por HTTP. Acepta destinos HTTP o HTTPS y un slug opcional. Si lo omites, genera uno. Los slugs explícitos admiten de 3 a 32 caracteres de `a-z`, `0-9` y guion; `api` y `health` están reservados.

Las consultas usan `prepare` y `bind` para pasar valores como parámetros. El slug es clave primaria y `ON CONFLICT` evita sobrescribir un destino existente. `first<{ url: string }>()` describe el tipo de la fila esperada; no modifica ni valida el esquema SQL.

### Reiniciar y crear el primer enlace

En **A**, pulsa **Ctrl+C** y reinicia para cargar el binding y `.dev.vars`:

```bash
npm run dev
```

En **B**:

```bash
npm run typecheck
DEMO_ADMIN_TOKEN='solo-para-ensayo-local'

curl -i http://localhost:8787/api/links \
  -H "Authorization: Bearer $DEMO_ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"slug":"workers","url":"https://developers.cloudflare.com/workers/"}'
```

Debes obtener `201` con este cuerpo:

```json
{
  "slug": "workers",
  "url": "https://developers.cloudflare.com/workers/",
  "shortUrl": "http://localhost:8787/workers"
}
```

La redirección fija de los ejemplos anteriores ya no existe en el código: ahora `/workers` funciona porque acabas de crear el registro. Antes de crearlo, devolvería `404`.

En **B**, comprueba la redirección:

```bash
curl -i http://localhost:8787/workers
```

Debes obtener `302` y el destino en `Location`. Abre `http://localhost:8787/workers` en el navegador para seguirlo.

### Ver el enlace guardado en Local Explorer

Mantén `npm run dev` ejecutándose en **A** y vuelve a [Local Explorer](http://localhost:8787/cdn-cgi/local/explorer):

1. Abre la sección de **D1** y selecciona la base correspondiente al binding **`DB`**, cuyo nombre configuramos como `acortador-db`.
2. Abre la tabla **`links`** en el explorador de tablas de SQL Studio.
3. Comprueba que exista una fila con `slug = workers`, `url = https://developers.cloudflare.com/workers/` y su fecha `created_at`.

Esa fila es el resultado del `POST /api/links` anterior. Al abrir `/workers`, el Worker consulta ese registro y devuelve el destino. El enlace corto apunta al Worker; la URL de destino sigue siendo la página original. Estamos viendo los datos locales, separados de los remotos.

Si prefieres comprobarlo desde la terminal **B**, esta consulta ofrece el mismo dato:

```bash
npx wrangler d1 execute acortador-db --local \
  --command='SELECT slug, url, created_at FROM links'
```

Para comprobar persistencia, detén y reinicia `npm run dev` en **A**, y vuelve a consultar `/workers` en **B**: debe seguir redirigiendo. Recarga Local Explorer y comprueba que la fila siga presente. Mientras el servidor esté detenido, las direcciones locales de la demo y de Local Explorer no estarán disponibles.

### Comprobar los casos de error

Una creación sin token debe responder `401`:

```bash
curl -i http://localhost:8787/api/links \
  -H 'Content-Type: application/json' \
  --data '{"slug":"otro","url":"https://example.com/"}'
```

Repetir un slug con el token correcto debe responder `409` y conservar el destino anterior:

```bash
curl -i http://localhost:8787/api/links \
  -H "Authorization: Bearer $DEMO_ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"slug":"workers","url":"https://example.com/"}'
```

Un destino con un protocolo no admitido debe responder `400`:

```bash
curl -i http://localhost:8787/api/links \
  -H "Authorization: Bearer $DEMO_ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"url":"javascript:alert(1)"}'
```

Para crear otro enlace con slug automático, omite `slug`:

```bash
curl -i http://localhost:8787/api/links \
  -H "Authorization: Bearer $DEMO_ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"url":"https://example.com/"}'
```

La respuesta `201` incluye el enlace generado en `shortUrl`. Si un slug de ensayo ya existe, elige otro; no necesitas borrar la base.

**Tercer ejemplo terminado en local:** creas enlaces mediante la API y D1 conserva sus destinos entre reinicios. El token es un control de escritura para la demo, no un sistema de cuentas de usuario. `/health` confirma que responde el Worker; no consulta la base de datos.

## Publicar el tercer ejemplo y comprobarlo

Todos los comandos de esta sección se ejecutan en **B**, desde la raíz del mismo proyecto. El primer Worker ya se desplegó al terminar el ejemplo 1.

### Preparar la tabla remota

```bash
npx wrangler d1 execute acortador-db --remote --file=schema.sql
```

Confirma cuando se solicite. Esto prepara el esquema remoto; **no copia los enlaces de la base local**. Los crearemos usando la API pública.

### Cargar el secret y desplegar el código final

Genera un token nuevo y cárgalo sin imprimirlo:

```bash
DEMO_ADMIN_TOKEN=$(node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))")
printf '%s' "$DEMO_ADMIN_TOKEN" | npx wrangler secret put ADMIN_TOKEN
```

`secret put` publica una versión con el secret. En este punto actualiza el Worker del primer ejemplo; todavía falta publicar el código final. La variable de B ahora contiene el token remoto. El archivo `.dev.vars` conserva el token de desarrollo local.

```bash
npm run typecheck
npm run deploy
```

Comprueba la URL impresa por Wrangler. Debe corresponder a `DEMO_BASE_URL`; si cambió o cerraste la terminal desde el primer despliegue, vuelve a asignar la variable con la URL real antes de continuar:

```bash
DEMO_BASE_URL='https://acortador-workers-demo.TU-SUBDOMINIO.workers.dev'
```

### Crear el registro remoto

```bash
curl -i "$DEMO_BASE_URL/api/links" \
  -H "Authorization: Bearer $DEMO_ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"slug":"workers","url":"https://developers.cloudflare.com/workers/"}'
```

Esperado: `201`, con `shortUrl` apuntando a tu dominio público. Un `409` significa que el slug ya existe en esa base; usa otro y ajusta las pruebas siguientes.

### Apagar el servidor local y verificar

En **A**, detén el servidor con **Ctrl+C** y déjalo apagado. En **B**:

```bash
curl -i "$DEMO_BASE_URL/health"
curl -i "$DEMO_BASE_URL/workers"
curl -i "$DEMO_BASE_URL/no-existe"
npx wrangler d1 execute acortador-db --remote \
  --command='SELECT slug, url, created_at FROM links'
```

Debes obtener `200`, `302` y `404`; la consulta SQL debe mostrar el enlace remoto. Abre la URL pública `/workers` en el navegador. El Worker desplegado consulta D1 y devuelve la redirección aunque el servidor local esté apagado.

## Archivos de referencia

- [etapas/01-worker.ts](etapas/01-worker.ts), [etapas/02-hono.ts](etapas/02-hono.ts) y [etapas/03-hono-d1.ts](etapas/03-hono-d1.ts): código completo de cada ejemplo.
- [demo/README.md](demo/README.md): instalación y ejecución de la versión final desde un checkout del repositorio.
- [etapas/README.md](etapas/README.md): cómo cambiar de versión sobre esa copia de la demo.
- [verificacion.json](verificacion.json): evidencia de la auditoría del recorrido.

## Problemas frecuentes

| Síntoma | Qué revisar |
|---|---|
| Wrangler rechaza Node | Usar una versión admitida de Node 22 o 24 en ambas terminales |
| No existe el script `typecheck` | Ejecutar el comando `npm pkg set` del ejemplo 1 |
| TypeScript no reconoce `Env` o `DB` | Ejecutar `npm run cf-typegen` y conservar el archivo generado en `tsconfig.json` |
| `no such table: links` en local | Aplicar `schema.sql` con `--local` desde la raíz del proyecto |
| `no such table: links` en público | Aplicar el esquema con `--remote` contra la base configurada |
| `401` al crear | Enviar el token correspondiente a local o remoto en `Authorization: Bearer ...` |
| `503` al crear | Configurar `.dev.vars` y reiniciar en local, o cargar el secret remoto |
| `409` al crear | El slug ya existe; usar otro sin sobrescribir su destino |
| Funciona en local, pero devuelve `404` en público | Crear el enlace en la API remota; los registros locales no se copian |
| Tras pasar al ejemplo 3, `/workers` devuelve `404` | Crear el registro con el POST; el destino ya no está escrito en el código |
| Local Explorer no abre | Mantener `npm run dev` activo, comprobar el puerto y usar `/cdn-cgi/local/explorer` |
| D1 o `links` no aparece en Local Explorer | Revisar el binding `DB`, aplicar el esquema local y reiniciar el servidor tras cambiar la configuración |
| Puerto ocupado | Elegir otro puerto y ajustar las peticiones sin detener procesos ajenos |

## Validación

La versión anterior, con la interfaz de tipos llamada `CloudflareBindings`, se auditó desde un proyecto nuevo de Create Cloudflare con Node 22.19.0, TypeScript 5.9.3, Wrangler 4.152.0 y Hono 4.13.13. Pasaron 78 comprobaciones que incluyen tipos y empaquetado, HTTP local, D1 local y remoto, secrets, dos despliegues, duplicados y persistencia. Los recursos remotos de ensayo se eliminaron al terminar.

Con la versión actual que conserva `Env`, los tres ejemplos locales se reprodujeron en otro proyecto nuevo usando los bloques de código de este README: pasaron 41 comprobaciones de tipos, HTTP, SQL local, persistencia y empaquetado. Esta corrida no creó ni desplegó recursos remotos.

[verificacion.json](verificacion.json) conserva los resultados y los hashes de esa corrida. Es evidencia identificada de la versión comprobada, no una prueba de carga ni una garantía sobre latencia. En un proyecto nuevo C3 puede instalar versiones adicionales más recientes; conserva su lockfile.

## Documentación oficial

- [Inicializar un Worker](https://developers.cloudflare.com/workers/get-started/guide/).
- [Desarrollo local](https://developers.cloudflare.com/workers/local-development/).
- [Local Explorer y D1 SQL Studio](https://developers.cloudflare.com/workers/local-development/local-explorer/).
- [Instalar y actualizar Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/).
- [Configuración de Wrangler](https://developers.cloudflare.com/workers/wrangler/configuration/).
- [TypeScript y tipos generados](https://developers.cloudflare.com/workers/languages/typescript/).
- [Handler fetch](https://developers.cloudflare.com/workers/runtime-apis/handlers/fetch/).
- [Bindings de Workers](https://developers.cloudflare.com/workers/runtime-apis/bindings/).
- [Hono en Cloudflare Workers](https://hono.dev/docs/getting-started/cloudflare-workers).
- [Crear y consultar D1](https://developers.cloudflare.com/d1/get-started/).
- [Consultas preparadas de D1](https://developers.cloudflare.com/d1/worker-api/prepared-statements/).
- [Bearer Auth de Hono](https://hono.dev/docs/middleware/builtin/bearer-auth).
- [Secrets locales y desplegados](https://developers.cloudflare.com/workers/configuration/secrets/).
