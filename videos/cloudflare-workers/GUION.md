# Acortador con Cloudflare Workers Hono y D1

Guía de grabación con un recorrido previsto de 22:30 y 2:30 de margen para terminar dentro de 25 minutos. Inicializamos un proyecto oficial de Cloudflare en TypeScript y construimos sobre él: un Worker con una redirección fija, rutas con Hono y una API que guarda enlaces en D1. Al final, la URL pública funciona con el servidor local apagado.

## Preparación antes de grabar

- Node.js 22 o 24 actualizado, npm y una cuenta de Cloudflare. Comprueba los [requisitos actuales de Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/).
- Dos terminales: A mantiene `wrangler dev` en ejecución; B ejecuta `curl`, SQL y despliegues. Todos los comandos de B también parten de la carpeta del proyecto.
- Ejecuta `npx wrangler login` y `npx wrangler whoami` antes de la toma para resolver la autenticación y seleccionar la cuenta correcta. Estos comandos requieren tener instalado Wrangler; puedes hacerlo en una carpeta de ensayo.
- Ensaya con un nombre de Worker y base diferentes de los de la grabación. Los nombres de esta guía son `acortador-workers-demo` y `acortador-db`.
- Ten los archivos de `etapas/` abiertos para copiar bloques. Los 25 minutos suponen pegar código y explicar las líneas clave, con las esperas de instalación y despliegue recortadas.
- Todo el código es TypeScript. Generamos los tipos de Workers y D1 con Wrangler, y comprobamos el código con `tsc --noEmit`.
- El puerto es 8787. Si ya está ocupado por otra demo, detén esa demo o cambia el puerto y las URLs de las pruebas.

## Promesa y tiempos

**Título:** Cloudflare Workers en la práctica: crea y despliega una API con Hono y D1

**Miniatura:** TU API EN CLOUDFLARE

| Tiempo | Resultado en pantalla |
|---|---|
| 00:00–00:40 | Mostrar el resultado y explicar el recorrido |
| 00:40–05:10 | Inicializador TypeScript, Wrangler y handler local |
| 05:10–06:50 | Primer despliegue y URL pública |
| 06:50–09:00 | Mismas rutas con Hono |
| 09:00–12:00 | Base D1, binding y tabla local |
| 12:00–17:30 | API con persistencia y token de creación |
| 17:30–20:50 | Tabla remota, secret y despliegue final |
| 20:50–22:30 | Prueba pública con localhost apagado y cierre |

## 00:00 a 00:40 Mostrar el resultado

Con la versión final de ensayo, crea un enlace y ábrelo en el navegador. El resultado visual es pasar de una URL corta al sitio de destino.

**Qué decir:**

> “Vamos a construir un acortador de enlaces que corre en Cloudflare. Inicializamos un proyecto TypeScript y escribimos el handler del Worker, organizamos las rutas con Hono y guardamos los enlaces en D1. Después lo desplegamos con Wrangler y apagamos el servidor local para comprobar que sigue funcionando.”

> “En el video anterior vimos qué es un Worker. Ahora vamos directamente al código.”

Cambia a una carpeta nueva para empezar la construcción. La demo inicial puede estar desplegada con un nombre de ensayo diferente.

## 00:40 a 05:10 Inicializar TypeScript y usar Wrangler

### Explicar las herramientas antes de usarlas

**Qué decir:**

> “Vamos a inicializar un proyecto oficial de Cloudflare con TypeScript. El inicializador se llama Create Cloudflare, o C3: genera la estructura y configura las dependencias. Wrangler es la herramienta de línea de comandos que usamos después para ejecutar el Worker localmente, desplegarlo y administrar recursos como D1 y los secrets.”

> “Node y npm ejecutan las herramientas en nuestra máquina. Nuestro Worker corre en el runtime de Cloudflare, también cuando Wrangler lo ejecuta localmente.”

### Inicializar el proyecto

Desde la carpeta donde quieres guardar la demo, en terminal A:

```bash
npm create cloudflare@latest -- acortador-workers-demo
```

Si npm pregunta si quieres instalar `create-cloudflare`, acepta. En el asistente selecciona:

| Pregunta | Opción |
|---|---|
| What would you like to start with? | Hello World example |
| Which template would you like to use? | Worker only |
| Which language do you want to use? | TypeScript |
| Use git for version control? | Yes si grabas en una carpeta independiente |
| Add an AGENTS.md file? | No para este recorrido manual |
| Deploy your application? | No, desplegamos después |

La opción de Git puede omitirse si ya estás dentro de un repositorio. En la grabación puedes usar el asistente para mostrar las decisiones; si necesitas repetir una toma, esta variante fija las opciones principales:

```bash
npm create cloudflare@latest -- acortador-workers-demo \
  --type=hello-world --lang=ts --no-deploy --no-agents
```

Entra al proyecto:

```bash
cd acortador-workers-demo
```

El generador instala las dependencias. Si interrumpiste esa parte, ejecuta `npm install`. El flujo oficial está documentado en [Create Cloudflare y Wrangler](https://developers.cloudflare.com/workers/get-started/guide/).

### Instalar y comprobar Wrangler

C3 ya instala Wrangler como dependencia de desarrollo. Muestra en pantalla cómo se instala o actualiza **localmente en este proyecto**:

```bash
npm install -D wrangler@latest
npx wrangler --version
```

**Qué decir:**

> “Wrangler queda en las dependencias de desarrollo del proyecto. `npx wrangler` ejecuta esa instalación local. Así podemos conservar la versión en el lockfile y usarla al repetir la demo. El generador ya lo incluyó; este es el comando para instalarlo o actualizarlo.”

Abre `package.json` y señala `wrangler` en `devDependencies`, y los scripts `dev` y `deploy`. La [instalación recomendada de Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/) es local al proyecto.

### Recorrer la estructura generada

```text
acortador-workers-demo/
  src/index.ts                 Handler del Worker
  wrangler.jsonc               Entrada, compatibilidad y bindings
  tsconfig.json                Configuración de TypeScript
  worker-configuration.d.ts    Tipos generados para este Worker
  package.json                 Dependencias y scripts
  package-lock.json            Versiones instaladas
```

El generador también puede incluir tests y su configuración. Los tests de Hello World pertenecen a la plantilla y se deben actualizar al cambiar el comportamiento; en este video verificamos el flujo con peticiones HTTP y el chequeo de tipos.

**No crees estos archivos desde cero:** ya los generó C3. Abre `wrangler.jsonc`, conserva su `compatibility_date` y revisa `main: "src/index.ts"`. Puedes conservar los comentarios y opciones generadas. El archivo mínimo equivalente para esta guía es:

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "acortador-workers-demo",
  "main": "src/index.ts",
  "compatibility_date": "2026-10-24",
  "workers_dev": true,
  "observability": { "enabled": true }
}
```

Usa un nombre propio si ese Worker ya existe en tu cuenta. La fecha del generador puede ser anterior a la de esta guía: consérvala. Fija el comportamiento de compatibilidad del runtime. `workers_dev` habilita la URL pública usada en la demo. Referencia: [configuración de Wrangler](https://developers.cloudflare.com/workers/wrangler/configuration/).

Revisa que `.gitignore` incluya estas entradas antes de crear secretos; agrégalas si faltan:

```gitignore
node_modules/
.wrangler/
.dev.vars
.dev.vars.*
!.dev.vars.example
.env*
dist/
```

### Preparar los tipos del Worker

Configura dos scripts; conserva los demás que generó C3:

```bash
npm pkg set 'scripts.cf-typegen=wrangler types --env-interface CloudflareBindings'
npm pkg set 'scripts.typecheck=npm run cf-typegen && tsc --noEmit'
npm run cf-typegen
```

El comando genera `worker-configuration.d.ts` con una interfaz llamada `CloudflareBindings` y los tipos del runtime. No edites ese archivo a mano. Mantén el `tsconfig.json` generado, que incluye este archivo y activa `strict`. Si tu versión de la plantilla no lo incluye, agrega `"./worker-configuration.d.ts"` a `compilerOptions.types`.

**Qué decir:**

> “Wrangler genera los tipos a partir de la configuración. Cuando conectemos D1, vamos a regenerarlos para que TypeScript conozca `DB`. Wrangler prepara el código para ejecutarlo; `tsc --noEmit` comprueba sus tipos por separado.”

Referencia: [TypeScript y generación de tipos de Workers](https://developers.cloudflare.com/workers/languages/typescript/).

### Código completo de la etapa 1

Reemplaza el Hello World de `src/index.ts` por:

```ts
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
} satisfies ExportedHandler<CloudflareBindings>
```

### Ejecutar y comprobar

En terminal A:

```bash
npm run typecheck
npm run dev
```

Deja esta terminal abierta. Abre B en la misma carpeta padre donde empezó A y entra al proyecto una sola vez:

```bash
cd acortador-workers-demo
pwd
```

A partir de aquí B permanece dentro de `acortador-workers-demo`:

```bash
curl -i http://localhost:8787/health
curl -i http://localhost:8787/workers
curl -i http://localhost:8787/no-existe
```

Resultados: `200` con JSON, `302` con un header `Location`, y `404`. Abre `http://localhost:8787/workers` en el navegador para seguir la redirección. `curl` sin `-L` permite ver el `302` sin seguirlo.

**Qué explicar:** `Request` y `Promise<Response>` tipan la entrada y salida; `satisfies ExportedHandler<CloudflareBindings>` comprueba la forma del handler. `fetch` recibe la petición entrante; `new URL()` separa el path; `Response` construye la respuesta. El Worker devuelve un `302` y el cliente hace otra petición al destino. No estamos descargando ni sirviendo la página de Cloudflare desde el Worker.

## 05:10 a 06:50 Primer despliegue

En terminal B:

```bash
npx wrangler whoami
npm run deploy
```

Si no estás autenticado, ejecuta `npx wrangler login`. En el primer despliegue la cuenta puede pedir configurar su subdominio `workers.dev`; déjalo resuelto durante el ensayo.

Copia la URL exacta que imprime Wrangler. En B define una variable con esa URL, sin slash final:

```bash
DEMO_BASE_URL='https://acortador-workers-demo.TU-SUBDOMINIO.workers.dev'
curl -i "$DEMO_BASE_URL/health"
curl -i "$DEMO_BASE_URL/workers"
```

Reemplaza `TU-SUBDOMINIO`; no ejecutes el ejemplo literal. Abre la URL pública `/workers` en el navegador.

**Qué decir:**

> “La misma función ya está desplegada. La URL pública ejecuta el código que acabamos de subir. Cambiar el archivo local todavía no actualiza este despliegue.”

CTA breve, después de mostrarlo funcionando:

> “Si te sirve construir estas demos paso a paso, suscríbete: vamos a seguir llevando herramientas a código que podamos ejecutar.”

## 06:50 a 09:00 Agregar Hono al mismo proyecto

En terminal B:

```bash
npm install hono
```

Reemplaza **todo** `src/index.ts` por la etapa 2:

```ts
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

En B ejecuta `npm run typecheck`. Wrangler recarga al guardar; si no lo hace, reinicia `npm run dev` en A.

En B:

```bash
curl -i http://localhost:8787/health
curl -i http://localhost:8787/workers
curl -i http://localhost:8787/no-existe
```

**Qué decir:**

> “Ahora necesitamos organizar las rutas. Hono nos permite declarar el método y el path, leer parámetros y construir respuestas. Sigue siendo un Worker; cambiamos cómo escribimos su manejo de HTTP.”

Señala `/:slug`, `c.req.param('slug')`, `c.json()` y `c.redirect()`. La ruta `/health` está declarada antes que `/:slug`. En esta etapa solo `workers` tiene destino: todavía no guardamos nada.

> “El enlace está escrito en el código. Para crear nuevos enlaces sin volver a desplegar, necesitamos persistencia.”

Referencia: [Hono en Cloudflare Workers](https://hono.dev/docs/getting-started/cloudflare-workers).

## 09:00 a 12:00 Crear D1 y conectar el binding

En B:

```bash
npx wrangler d1 create acortador-db --binding DB --update-config
```

El comando crea la base y agrega automáticamente el binding `DB`, el nombre y el ID reales a `wrangler.jsonc`. Verifica el resultado sin duplicar `d1_databases`. Las opciones se comprobaron con Wrangler 4.152.0.

Conserva el `wrangler.jsonc` actualizado por el comando, incluido el nombre y la fecha de tu proyecto. Este es el archivo completo equivalente como referencia; no lo pegues sobre tu ID real:

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "acortador-workers-demo",
  "main": "src/index.ts",
  "compatibility_date": "2026-10-24",
  "workers_dev": true,
  "observability": { "enabled": true },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "acortador-db",
      "database_id": "REEMPLAZAR_CON_EL_ID_DE_D1"
    }
  ]
}
```

El ID real ya lo escribió Wrangler. `database_name` identifica el recurso; `DB` es el nombre con el que nuestro código accede a él. Regenera los tipos después de agregar el binding:

```bash
npm run cf-typegen
```

Abre `worker-configuration.d.ts` y muestra `DB: D1Database` dentro de `CloudflareBindings`. No pegues esa declaración a mano: la produce Wrangler.

Crea `schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS links (
  slug TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

En B:

```bash
npx wrangler d1 execute acortador-db --local --file=schema.sql
```

**Qué decir:**

> “D1 nos da una base SQL basada en SQLite. El binding conecta el Worker con ese recurso: lo usamos como `c.env.DB`, sin escribir una conexión con usuario y contraseña.”

> “Creamos el recurso en nuestra cuenta, pero este comando prepara una base local para desarrollar. La base remota todavía no tiene esta tabla.”

Usamos `CREATE TABLE IF NOT EXISTS` para poder repetir el comando sin borrar enlaces. Cambios posteriores de estructura requerirían migraciones; este SQL es el esquema inicial. Referencia: [inicio con D1](https://developers.cloudflare.com/d1/get-started/).

## 12:00 a 17:30 Crear y resolver enlaces con D1

### Configurar el token local

Crea `.dev.vars` en la misma carpeta que `wrangler.jsonc`:

```dotenv
ADMIN_TOKEN="solo-para-ensayo-local"
```

Este valor es público y sirve únicamente para el ensayo local. Antes del despliegue generaremos otro. `.dev.vars` ya está excluido de Git.

**Qué decir:**

> “Vamos a dejar públicas las redirecciones y pedir un token para crear enlaces. Así también vemos cómo usa un Worker un secret.”

### Código completo de la etapa 3

Reemplaza **todo** `src/index.ts` por:

```ts
import { Hono } from 'hono'
import { bearerAuth } from 'hono/bearer-auth'

type Bindings = CloudflareBindings & {
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

En A detén el proceso con `Ctrl+C` y vuelve a iniciarlo, para cargar el binding y el secret:

```bash
npm run dev
```

### Explicar el código en cuatro bloques

1. **Tipos y middleware:** `new Hono<{ Bindings: Bindings }>()` tipa `c.env`. `CloudflareBindings` contiene `DB`, generado por Wrangler, y agregamos `ADMIN_TOKEN` como secret opcional en nuestro tipo de aplicación. Protege `/api/*` con Bearer Auth. El secret llega por `c.env.ADMIN_TOKEN`; si no está configurado, rechazamos la creación. Las redirecciones siguen siendo públicas.
2. **Entrada:** leemos JSON como `unknown` y validamos su estructura: TypeScript no valida las peticiones en ejecución. Capturamos JSON inválido, validamos la URL y aceptamos solo `http` o `https`. Si falta el slug, generamos uno; si lo envían, validamos su formato. `api` y `health` están reservados para las rutas del servicio.
3. **INSERT:** los datos se pasan con `.bind()`, sin concatenarlos en el SQL. `slug` es clave primaria; `ON CONFLICT` evita sobrescribir un destino y permite devolver `409` incluso con peticiones concurrentes.
4. **SELECT y redirección:** `.first<{ url: string }>()` tipa el resultado SQL. Buscamos por slug, devolvemos `404` si falta y `302` si existe. Elegimos `302` para evitar una redirección permanente cacheada durante las pruebas.

El token autentica a quien crea enlaces; no es un sistema de usuarios. `GET /health` confirma que responde el Worker, no comprueba la base de datos. El Worker guarda y devuelve destinos; no hace `fetch` a las URLs enviadas.

### Probar creación y redirección

En B:

```bash
DEMO_ADMIN_TOKEN='solo-para-ensayo-local'

curl -i http://localhost:8787/api/links \
  -H "Authorization: Bearer $DEMO_ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"slug":"workers","url":"https://developers.cloudflare.com/workers/"}'
```

Resultado esperado: `201` y este cuerpo:

```json
{
  "slug": "workers",
  "url": "https://developers.cloudflare.com/workers/",
  "shortUrl": "http://localhost:8787/workers"
}
```

Ahora:

```bash
curl -i http://localhost:8787/workers
```

Muestra `302` y abre el enlace en el navegador. Consulta la tabla para que se vea la persistencia:

```bash
npx wrangler d1 execute acortador-db --local \
  --command='SELECT slug, url, created_at FROM links'
```

Prueba una petición sin token:

```bash
curl -i http://localhost:8787/api/links \
  -H 'Content-Type: application/json' \
  --data '{"slug":"otro","url":"https://example.com/"}'
```

Esperado: `401`. Repite la creación autenticada de `workers`: debe devolver `409`, conservando el destino anterior.

Si sobra tiempo, omite `slug` en otra creación para mostrar la generación automática. Si vas justo, muestra solo `201`, redirección y `401`; deja las demás pruebas para el repositorio.

Referencias: [Bearer Auth de Hono](https://hono.dev/docs/middleware/builtin/bearer-auth) y [secrets de Workers](https://developers.cloudflare.com/workers/configuration/secrets/).

## 17:30 a 20:50 Preparar la base remota y desplegar

### Crear la tabla remota

En B:

```bash
npx wrangler d1 execute acortador-db --remote --file=schema.sql
```

Confirma cuando Wrangler lo solicite. Este comando prepara el esquema en Cloudflare; no copia los enlaces locales.

**Qué decir:**

> “El código, los secrets y los datos son cosas que tenemos que configurar. La tabla que usamos en localhost no apareció automáticamente en la base remota. Por eso aplicamos el mismo esquema con `--remote`.”

### Guardar el secret de Cloudflare

Genera un token nuevo, de ensayo, para la grabación. En B:

```bash
DEMO_ADMIN_TOKEN=$(node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))")
```

Carga ese mismo valor sin imprimirlo:

```bash
printf '%s' "$DEMO_ADMIN_TOKEN" | npx wrangler secret put ADMIN_TOKEN
```

`DEMO_ADMIN_TOKEN` queda en esta terminal para probar la API. `secret put` crea y despliega una versión con el secret; aquí actualiza el Worker que desplegamos al principio. Todavía falta subir el código final. `.dev.vars` sigue siendo solo local y no se sube con `deploy`. Referencia: [secrets en Workers desplegados](https://developers.cloudflare.com/workers/configuration/secrets/#secrets-on-deployed-workers).

### Comprobar TypeScript y desplegar el código final

En B:

```bash
npm run typecheck
npm run deploy
```

Comprueba la URL impresa. Si cambió respecto de la etapa inicial, actualiza `DEMO_BASE_URL` con la URL nueva.

En B crea el enlace **remoto**:

```bash
curl -i "$DEMO_BASE_URL/api/links" \
  -H "Authorization: Bearer $DEMO_ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"slug":"workers","url":"https://developers.cloudflare.com/workers/"}'
```

Esperado: `201`. Si ensayaste con la misma base, el `409` significa que ya existe: usa otro slug y ajusta las siguientes pruebas. No es necesario borrar datos.

## 20:50 a 22:30 Apagar localhost y demostrar el resultado

En A detén `npm run dev` con `Ctrl+C`. En B:

```bash
curl -i "$DEMO_BASE_URL/health"
curl -i "$DEMO_BASE_URL/workers"
curl -i "$DEMO_BASE_URL/no-existe"
```

Resultados: `200`, `302` y `404`. Abre `/workers` usando la URL pública en el navegador.

Muestra el registro remoto:

```bash
npx wrangler d1 execute acortador-db --remote \
  --command='SELECT slug, url, created_at FROM links'
```

**Qué decir:**

> “El servidor local está apagado. La petición llega al Worker desplegado, consulta D1 y devuelve una redirección. Empezamos con un handler, agregamos rutas y conectamos persistencia usando un binding.”

> “Para convertirlo en un servicio público con registro de usuarios, el siguiente paso es agregar permisos por usuario, límites de creación y controles de abuso. Para nuestros propios enlaces, ya tenemos una API que podemos usar.”

CTA de cierre:

> “El código de las tres etapas queda en el repositorio. En la siguiente demo podemos conectar un webhook externo y usar Cloudflare Tunnel para depurarlo desde localhost.”

## Archivos para ensayar sin escribir todo

`etapas/` contiene las tres versiones completas en TypeScript de `src/index.ts`. `demo/` contiene el proyecto final, con configuración TypeScript y scripts de generación y chequeo de tipos. Para ensayar el resultado final desde este repositorio:

```bash
cd videos/cloudflare-workers/demo
npm ci
cp .dev.vars.example .dev.vars
npx wrangler login
npx wrangler d1 create acortador-db --binding DB --update-config
```

Verifica que el comando haya agregado el binding `DB` con su ID real a `wrangler.jsonc` y ejecuta:

```bash
npm run db:local
npm run typecheck
npm run dev
```

Para reproducir las etapas desde `demo/`, copia la versión deseada; estos comandos reemplazan únicamente `src/index.ts`:

```bash
cp ../etapas/01-worker.ts src/index.ts
cp ../etapas/02-hono.ts src/index.ts
cp ../etapas/03-hono-d1.ts src/index.ts
```

Ejecuta solo el comando de la etapa que quieres mostrar. Para reproducir exactamente el arranque, inicializa la carpeta nueva con C3 en el minuto 00:40: el `demo/` ya trae la configuración final con D1.

## Pruebas adicionales para el ensayo

Estas peticiones usan el token local y el servidor local. No hace falta mostrarlas todas en el video:

```bash
# JSON invalido: 400
curl -i http://localhost:8787/api/links \
  -H "Authorization: Bearer $DEMO_ADMIN_TOKEN" \
  -H 'Content-Type: application/json' --data '{'

# Protocolo no permitido: 400
curl -i http://localhost:8787/api/links \
  -H "Authorization: Bearer $DEMO_ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"url":"javascript:alert(1)"}'

# Ruta reservada: 400
curl -i http://localhost:8787/api/links \
  -H "Authorization: Bearer $DEMO_ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"slug":"health","url":"https://example.com/"}'

# Slug automatico: 201
curl -i http://localhost:8787/api/links \
  -H "Authorization: Bearer $DEMO_ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"url":"https://example.com/"}'
```

Si acabas de probar la versión remota en la misma terminal, vuelve a definir `DEMO_ADMIN_TOKEN='solo-para-ensayo-local'` para estas pruebas locales.

| Síntoma | Qué revisar |
|---|---|
| `no such table: links` en local | Ejecutar el SQL con `--local` desde la misma carpeta del proyecto |
| `no such table: links` en público | Ejecutar el SQL con `--remote` contra la base configurada |
| `DB` no está definido | Binding exactamente `DB` y reiniciar Wrangler |
| `401` al crear | Token local o remoto correspondiente y header `Authorization` |
| `503` al crear | Falta `ADMIN_TOKEN`; configurar `.dev.vars` o `wrangler secret put` |
| `409` al crear | El slug ya está guardado; elegir otro |
| `404` remoto pero funciona en local | El enlace existe solo en la base local; crearlo en la API pública |
| Puerto 8787 ocupado | Detener el proceso anterior o ajustar puerto y peticiones |
| No conserva los datos después de un ensayo | Mantener la misma carpeta y estado `.wrangler`; no borrarlo entre tomas |

Si te atrasas: recorta instalaciones, lectura detallada de validaciones y pruebas adicionales. Mantén los dos despliegues, el binding, la separación local/remoto y la prueba final con localhost apagado.

## Verificación del material

La auditoría completa partió de un proyecto nuevo generado con Create Cloudflare 2.74.3 en TypeScript. Con Node 22.19.0, TypeScript 5.9.3, Wrangler 4.152.0 y Hono 4.13.13 pasaron 78 comprobaciones: tipos y empaquetado de las tres etapas, HTTP local, D1 local y remoto, ambos despliegues públicos, secret, autenticación, validaciones, duplicados y persistencia. La URL pública se comprobó con los servidores locales detenidos. El Worker y la base de ensayo se eliminaron al terminar.

La evidencia está en [verificacion.json](verificacion.json). Los dos despliegues se hicieron con nombres únicos de ensayo; la grabación debe crear sus propios recursos.

El guion de Notion marca 883 palabras de narración, unos 6.3–7.4 minutos a 120–140 palabras por minuto. El resto del recorrido de 22:30 queda para ejecutar comandos, mostrar código y navegar; hay 2:30 adicionales de margen. El límite de 25 minutos supone pegar los bloques y recortar las esperas. La duración oral real requiere un ensayo del creador.

El lockfile conserva las versiones del proyecto final local. `npm audit` reportó alertas en la cadena de desarrollo de Wrangler; no se aplicó la bajada de versión sugerida por el auditor.

## Descripción sugerida para YouTube

Construimos un acortador de enlaces con Cloudflare Workers, inicializando un proyecto TypeScript y avanzando desde el handler del Worker hasta una API con Hono y D1. Usamos Wrangler para desarrollar, crear la base, configurar un secret y desplegar. Terminamos comprobando la URL pública con el servidor local apagado.

Código y guía: carpeta `videos/cloudflare-workers` de este repositorio.

#cloudflare #workers #hono #backend

Tags: cloudflare workers, wrangler, hono, cloudflare d1, api typescript, acortador de enlaces, serverless español
