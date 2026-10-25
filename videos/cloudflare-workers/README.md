# Acortador de enlaces con Cloudflare Workers Hono y D1

Esta demo construye una API de enlaces cortos en **TypeScript**. Cloudflare Workers recibe las peticiones, Hono organiza las rutas y D1 guarda los destinos. Wrangler permite desarrollar localmente, generar los tipos, administrar la base y desplegar el Worker.

El recorrido tiene tres etapas sobre el mismo proyecto: un Worker con una redirección fija, las mismas rutas con Hono y una API con persistencia y un token para crear enlaces.

## Recursos

| Archivo o carpeta | Para qué sirve |
|---|---|
| [demo](demo/README.md) | Proyecto final e instrucciones para ejecutarlo |
| [etapas](etapas/README.md) | Las tres versiones TypeScript del handler |
| [CHULETA.md](CHULETA.md) | Comandos por etapa y terminal A o B |
| [verificacion.json](verificacion.json) | Evidencia de la auditoría del recorrido y sus límites |

## Requisitos

- Node.js 22 o 24 actualizado y npm. Usa la misma versión en ambas terminales.
- Una cuenta de Cloudflare para crear D1 y desplegar el Worker.
- Un navegador y `curl`. Los ejemplos usan Bash o Zsh; en Windows puedes seguirlos desde WSL.
- El puerto 8787 disponible. Si eliges otro, cambia también las URLs de prueba.

Wrangler se instala como dependencia de desarrollo. No hace falta instalarlo globalmente: `npx wrangler ...` ejecuta la copia del proyecto.

## Ejecutar el proyecto final

Desde la carpeta donde guardarás el repositorio:

```bash
git clone https://github.com/gilbertsahumada/youtube-tutorials.git
cd youtube-tutorials/videos/cloudflare-workers/demo
npm ci
cp .dev.vars.example .dev.vars
```

Si ya tienes el repositorio, entra directamente en `videos/cloudflare-workers/demo`. A partir de aquí, ejecuta todos los comandos desde esa carpeta.

Autentica Wrangler, comprueba la cuenta y crea la base:

```bash
npx wrangler login
npx wrangler whoami
npx wrangler d1 create acortador-db --binding DB --update-config
```

El último comando crea un recurso en tu cuenta y configura `DB` en `wrangler.jsonc` con su ID real, reemplazando el ID de ejemplo. Verifica el archivo antes de desplegar. Si ya existe una base con ese nombre, elige otro y actualiza `database_name` y los comandos correspondientes. Para reutilizar una base, configura su ID real en lugar de crearla de nuevo.

Prepara la tabla local y comprueba TypeScript:

```bash
npm run db:local
npm run typecheck
npm run dev
```

`typecheck` genera `worker-configuration.d.ts` mediante Wrangler y ejecuta `tsc --noEmit`. Ese archivo deriva de la configuración; no se edita a mano ni se incluye en este repositorio. Deja el servidor ejecutándose.

## Crear y abrir un enlace

Abre otra terminal dentro de `videos/cloudflare-workers/demo`. El token de `.dev.vars.example` es público y sirve solo para ensayo local:

```bash
DEMO_ADMIN_TOKEN='solo-para-ensayo-local'

curl -i http://localhost:8787/api/links \
  -H "Authorization: Bearer $DEMO_ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"slug":"workers","url":"https://developers.cloudflare.com/workers/"}'
```

La API responde `201` con el slug, el destino y `shortUrl`. Si el slug ya existe, responde `409`; elige otro para crear otro enlace.

```bash
curl -i http://localhost:8787/workers
```

Debes obtener `302` con el destino en `Location`. Abre `http://localhost:8787/workers` en el navegador para seguir la redirección. `curl` sin `-L` permite inspeccionarla sin seguirla.

| Ruta | Uso | Resultado |
|---|---|---|
| `GET /health` | Comprobar que responde el Worker | `200` |
| `POST /api/links` | Crear un enlace; requiere Bearer token | `201`, `400`, `401`, `409` o `503` según el caso |
| `GET /:slug` | Buscar el destino y redirigir | `302` o `404` |

Puedes omitir `slug` para generar uno. Los slugs explícitos admiten entre 3 y 32 caracteres de `a-z`, `0-9` y guion; `api` y `health` están reservados. El destino debe usar HTTP o HTTPS.

`/health` no consulta D1. El token controla la creación de enlaces, pero no implementa cuentas de usuario. El Worker guarda el destino y devuelve una redirección; no descarga la página de destino.

## Desplegar en Cloudflare

Las bases local y remota guardan datos separados. Preparar la tabla local o desplegar el código no copia registros a Cloudflare.

Desde `demo/`, prepara la tabla remota y publica el código final:

```bash
npm run db:remote
npm run typecheck
npm run deploy
```

Confirma cuando Wrangler lo solicite. La creación de enlaces responde `503` hasta configurar `ADMIN_TOKEN`; las redirecciones y `/health` permanecen públicas.

Genera otro token y cárgalo en Cloudflare sin imprimirlo:

```bash
DEMO_ADMIN_TOKEN=$(node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))")
printf '%s' "$DEMO_ADMIN_TOKEN" | npx wrangler secret put ADMIN_TOKEN
```

`secret put` publica una versión con el secret. `.dev.vars` es local y no se sube con `deploy`. La [chuleta](CHULETA.md) despliega primero la etapa básica, carga el secret y después publica el código final; aquí partimos directamente del código final.

Copia la URL real de Wrangler y reemplaza el ejemplo, sin slash final:

```bash
DEMO_BASE_URL='https://acortador-workers-demo.TU-SUBDOMINIO.workers.dev'

curl -i "$DEMO_BASE_URL/api/links" \
  -H "Authorization: Bearer $DEMO_ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"slug":"workers","url":"https://developers.cloudflare.com/workers/"}'
```

Esto crea el registro remoto. Detén el servidor local con Ctrl+C y comprueba:

```bash
curl -i "$DEMO_BASE_URL/health"
curl -i "$DEMO_BASE_URL/workers"
curl -i "$DEMO_BASE_URL/no-existe"
```

Debes obtener `200`, `302` y `404` con el servidor local apagado. Mantén abierta la terminal de pruebas para conservar la URL y el token.

## Construir las tres etapas

Para comenzar desde el inicializador oficial, sigue la [chuleta](CHULETA.md). Selecciona **Worker only** y **TypeScript**, conserva el mismo proyecto y reemplaza el handler:

1. [Worker a mano](etapas/01-worker.ts): `fetch`, respuestas JSON y una redirección fija.
2. [Hono](etapas/02-hono.ts): rutas y parámetros sobre el mismo Worker.
3. [Hono con D1](etapas/03-hono-d1.ts): bindings tipados, consultas con parámetros, persistencia y Bearer Auth.

El [README de etapas](etapas/README.md) explica cómo usarlas sobre el proyecto entregado. El guion prevé 22:30 de recorrido y 2:30 de margen; supone pegar bloques y recortar esperas. La duración oral requiere un ensayo.

## Problemas frecuentes

| Síntoma | Qué revisar |
|---|---|
| Wrangler rechaza Node | Usar una versión admitida de Node 22 o 24 en ambas terminales |
| `no such table: links` en local | Ejecutar `npm run db:local` desde `demo/` |
| `no such table: links` en público | Ejecutar `npm run db:remote` contra la base configurada |
| TypeScript no reconoce `DB` | Verificar el binding y ejecutar `npm run typecheck` |
| `401` al crear | Enviar el token correcto en `Authorization: Bearer ...` |
| `503` al crear | Configurar `.dev.vars` o el secret remoto `ADMIN_TOKEN` |
| `409` al crear | Elegir otro slug sin sobrescribir su destino |
| Funciona localmente pero devuelve `404` en público | Crear el enlace en la API remota; los registros locales no se copian |
| Puerto ocupado | Elegir otro y ajustar las peticiones sin detener procesos ajenos |

## Validación

El recorrido se auditó desde un proyecto nuevo de Create Cloudflare. Pasaron 78 comprobaciones con TypeScript 5.9.3, Wrangler 4.152.0 y Hono 4.13.13: tipos y empaquetado de las tres etapas, peticiones locales, D1 local y remoto, secrets, dos despliegues, duplicados y persistencia. La URL pública se verificó con los servidores locales detenidos. Los recursos remotos de ensayo se eliminaron al terminar.

[verificacion.json](verificacion.json) conserva los resultados y los hashes del código comprobado. Es evidencia de esa corrida, no una prueba de carga ni una garantía sobre latencia o duración de grabación. Los lockfiles fijan las dependencias del proyecto entregado.

## Documentación oficial

- [Inicializar un Worker](https://developers.cloudflare.com/workers/get-started/guide/).
- [Instalar y actualizar Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/).
- [Configuración de Wrangler](https://developers.cloudflare.com/workers/wrangler/configuration/).
- [TypeScript y tipos generados](https://developers.cloudflare.com/workers/languages/typescript/).
- [Bindings de Workers](https://developers.cloudflare.com/workers/runtime-apis/bindings/).
- [Hono en Cloudflare Workers](https://hono.dev/docs/getting-started/cloudflare-workers).
- [D1 y su configuración](https://developers.cloudflare.com/d1/get-started/).
- [Consultas preparadas de D1](https://developers.cloudflare.com/d1/worker-api/prepared-statements/).
- [Bearer Auth de Hono](https://hono.dev/docs/middleware/builtin/bearer-auth).
- [Secrets locales y desplegados](https://developers.cloudflare.com/workers/configuration/secrets/).
