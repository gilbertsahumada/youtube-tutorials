# Demo del acortador en TypeScript

Este proyecto contiene la versión final del acortador: Cloudflare Workers, rutas con Hono, almacenamiento en D1 y un token para crear enlaces. El código está en [src/index.ts](src/index.ts).

## Requisitos

Node.js 22 o 24 actualizado, npm, una cuenta de Cloudflare y el puerto 8787 disponible. Los ejemplos usan Bash o Zsh; puedes usar WSL en Windows.

## Instalar y ejecutar

Desde la raíz del repositorio:

```bash
cd videos/cloudflare-workers/demo
npm ci
cp .dev.vars.example .dev.vars
npx wrangler login
npx wrangler whoami
npx wrangler d1 create acortador-db --binding DB --update-config
npm run db:local
npm run cf-typegen
npm run typecheck
npm run dev
```

Si ya estás dentro de `demo/`, omite el primer `cd`. El comando de creación configura el binding `DB` con un ID real en `wrangler.jsonc`. Si existe una base con ese nombre en tu cuenta, elige otro y actualiza los comandos y `database_name`, o configura el ID de la base que quieres reutilizar.

`cf-typegen` genera `worker-configuration.d.ts`; no crea D1, no aplica el esquema ni despliega. Ejecútalo después de configurar D1 y cuando cambien los bindings. Conserva el nombre `Env` del scaffold y no edites los tipos generados a mano.

El token de `.dev.vars.example` es público y solo sirve para ensayo local. `.dev.vars`, el estado de Wrangler y los tipos generados se excluyen de Git.

## Comprobar

En otra terminal dentro de esta carpeta:

```bash
DEMO_ADMIN_TOKEN='solo-para-ensayo-local'

curl -i http://localhost:8787/api/links \
  -H "Authorization: Bearer $DEMO_ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"slug":"workers","url":"https://developers.cloudflare.com/workers/"}'

curl -i http://localhost:8787/workers
```

Esperado: `201` al crear y `302` al consultar. Abre `http://localhost:8787/workers` en el navegador para seguir el destino. Si repites el slug, obtendrás `409`; elige otro.

## Scripts

| Comando | Resultado |
|---|---|
| `npm run dev` | Servidor local en el puerto 8787 |
| `npm run cf-typegen` | Ejecuta `wrangler types` y actualiza `Env` según la configuración y los bindings |
| `npm run typecheck` | Comprueba TypeScript sin emitir archivos |
| `npm run db:local` | Aplica el esquema inicial a D1 local |
| `npm run db:remote` | Aplica el esquema a D1 en Cloudflare; requiere acceso a la cuenta |
| `npm run deploy` | Publica el Worker en la cuenta autenticada |

La [guía del tema](../README.md) explica el despliegue, el secret remoto, las respuestas de error y la diferencia entre datos locales y remotos. Consulta la [documentación de Wrangler](https://developers.cloudflare.com/workers/wrangler/) para sus comandos.
