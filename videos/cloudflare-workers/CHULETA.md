# Chuleta de grabación de Cloudflare Workers

**TypeScript · Wrangler · Hono · D1 · 22:30 de recorrido + 2:30 de margen**

Abre A y B en la **misma carpeta padre** antes de empezar. A mantiene el servidor local; B instala, prueba y despliega. **Mantén B abierta durante toda la grabación:** allí quedan la URL pública y el token.

Los pasos de **Editor** indican cuándo pegar el código. Ejecuta los bloques uno por uno; `npm run dev` mantiene A ocupada hasta que pulses **Ctrl+C**.

## Antes de grabar — A y B

En cada terminal:

```bash
node --version
npm --version
```

Node 22 o 24 actualizado. Cuenta de Cloudflare lista, autenticación ensayada y puerto 8787 libre. Usa nombres distintos si ya existen `acortador-workers-demo` o `acortador-db` en tu cuenta; adapta los comandos y la configuración al nombre elegido.

## 1 · Inicializar TypeScript y primer Worker · 0:40–5:10

### Terminal A

```bash
npm create cloudflare@latest -- acortador-workers-demo
```

En el asistente: **Hello World example → Worker only → TypeScript → Git: Yes → AGENTS.md: No → Deploy: No.** Si ya estás en un repositorio, la pregunta de Git puede omitirse.

```bash
cd acortador-workers-demo
npm install -D wrangler@latest
npx wrangler --version
```

**Mostrar:** `package.json`, `wrangler.jsonc`, `tsconfig.json` y `src/index.ts`. C3 genera el proyecto e incluye Wrangler; el comando anterior muestra cómo instalarlo o actualizarlo localmente.

```bash
npm pkg set 'scripts.cf-typegen=wrangler types --env-interface CloudflareBindings'
npm pkg set 'scripts.typecheck=npm run cf-typegen && tsc --noEmit'
npm run cf-typegen
```

**Editor:** reemplazar todo `src/index.ts` con [etapa 1 — Worker TypeScript](etapas/01-worker.ts). Conservar el nombre y la fecha que generó C3 en `wrangler.jsonc`; comprobar `main: "src/index.ts"`.

```bash
npm run typecheck
npm run dev
```

**Dejar A ejecutándose.**

### Terminal B

Desde la misma carpeta padre donde empezó A; este `cd` se ejecuta **una sola vez**:

```bash
cd acortador-workers-demo
pwd
curl -i http://localhost:8787/health
curl -i http://localhost:8787/workers
```

**Esperado:** `200` y `302`. Abrir `http://localhost:8787/workers` en el navegador.

## 2 · Primer despliegue · 5:10–6:50

### Terminal B

```bash
npx wrangler login
npx wrangler whoami
npm run deploy
```

**Copiar la URL exacta impresa por Wrangler y reemplazar el ejemplo de abajo.** Sin slash al final. Resolver la configuración del subdominio si Cloudflare la solicita.

```bash
DEMO_BASE_URL='https://acortador-workers-demo.TU-SUBDOMINIO.workers.dev'
curl -i "$DEMO_BASE_URL/health"
curl -i "$DEMO_BASE_URL/workers"
```

**Esperado:** `200` y `302`. Abrir la URL pública `/workers`.

## 3 · Agregar Hono · 6:50–9:00

### Terminal B

```bash
npm install hono
```

**Editor:** reemplazar todo `src/index.ts` con [etapa 2 — Hono TypeScript](etapas/02-hono.ts). Guardar; Wrangler recarga automáticamente.

```bash
npm run typecheck
curl -i http://localhost:8787/workers
curl -i http://localhost:8787/no-existe
```

**Esperado:** `302` y `404`.

Solo si no recarga: **A → Ctrl+C → `npm run dev`**; después repetir las peticiones en B.

## 4 · D1 y tabla local · 9:00–12:00

### Terminal B

```bash
npx wrangler d1 create acortador-db --binding DB --update-config
```

**Mostrar:** `wrangler.jsonc` ya contiene `d1_databases`, binding `DB` e ID real. No reemplazar el archivo ni pegar un ID de ejemplo.

```bash
npm run cf-typegen
```

**Mostrar:** `DB: D1Database` en los tipos generados.

Crear `schema.sql` en la raíz del proyecto; este bloque equivale a pegar el SQL en el editor:

```bash
cat > schema.sql <<'SQL'
CREATE TABLE IF NOT EXISTS links (
  slug TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
SQL
```

```bash
npx wrangler d1 execute acortador-db --local --file=schema.sql
```

**Punto clave:** este esquema se aplicó a la base local.

## 5 · API con Hono y D1 · 12:00–17:30

### Terminal B

Agregar las exclusiones si faltan y crear `.dev.vars`. El token de este bloque es solo para el ensayo local:

```bash
cat >> .gitignore <<'IGNORE'

.dev.vars
.dev.vars.*
.env*
IGNORE

cat > .dev.vars <<'VARS'
ADMIN_TOKEN="solo-para-ensayo-local"
VARS
```

**Editor:** reemplazar todo `src/index.ts` con [etapa 3 — Hono y D1 en TypeScript](etapas/03-hono-d1.ts). Guardar y explicar los tipos, el middleware, la creación del enlace y la redirección.

### Terminal A

Pulsar **Ctrl+C** para detener el servidor anterior. Reiniciar para cargar el binding y el secret:

```bash
npm run dev
```

### Terminal B

```bash
npm run typecheck
DEMO_ADMIN_TOKEN='solo-para-ensayo-local'

curl -i http://localhost:8787/api/links \
  -H "Authorization: Bearer $DEMO_ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"slug":"workers","url":"https://developers.cloudflare.com/workers/"}'
```

**Esperado:** `201` con `shortUrl` apuntando a `http://localhost:8787/workers`.

```bash
curl -i http://localhost:8787/workers
```

**Esperado:** `302`. Abrir el enlace en el navegador.

```bash
npx wrangler d1 execute acortador-db --local \
  --command='SELECT slug, url, created_at FROM links'
```

**Mostrar:** el registro guardado.

Petición sin token:

```bash
curl -i http://localhost:8787/api/links \
  -H 'Content-Type: application/json' \
  --data '{"slug":"otro","url":"https://example.com/"}'
```

**Esperado:** `401`.

## 6 · Base remota, secret y despliegue · 17:30–20:50

### Terminal B

```bash
npx wrangler d1 execute acortador-db --remote --file=schema.sql
```

Confirmar cuando se solicite. **Punto clave:** no copia los registros locales; prepara la tabla remota.

Generar otro token y cargarlo en Cloudflare. Estos comandos sustituyen el token local de la variable de B por el remoto:

```bash
DEMO_ADMIN_TOKEN=$(node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))")
printf '%s' "$DEMO_ADMIN_TOKEN" | npx wrangler secret put ADMIN_TOKEN
```

```bash
npm run typecheck
npm run deploy
```

**Comprobar:** la URL impresa coincide con `DEMO_BASE_URL`. Si cambió, volver a asignar esa variable con la URL nueva.

Crear el enlace en la API pública:

```bash
curl -i "$DEMO_BASE_URL/api/links" \
  -H "Authorization: Bearer $DEMO_ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"slug":"workers","url":"https://developers.cloudflare.com/workers/"}'
```

**Esperado:** `201`. Si aparece `409`, el slug ya existía por una toma anterior: usar otro en la creación y en las pruebas siguientes.

## 7 · Apagar localhost y comprobar · 20:50–22:30

### Terminal A

Pulsar **Ctrl+C**. **Dejar el servidor detenido.**

### Terminal B

```bash
curl -i "$DEMO_BASE_URL/health"
curl -i "$DEMO_BASE_URL/workers"
curl -i "$DEMO_BASE_URL/no-existe"
```

**Esperado, en orden:** `200` → `302` → `404`.

```bash
npx wrangler d1 execute acortador-db --remote \
  --command='SELECT slug, url, created_at FROM links'
```

**Mostrar:** registro remoto y redirección en el navegador con A detenida. Cierre del video. Quedan **2:30 de margen** hasta los 25 minutos.

## Recordatorios para la toma

- A: servidor local. B: comandos, peticiones, variables y despliegues.
- Los pasos de Editor van entre los bloques; no ejecutar todo seguido.
- Mantener B abierta para conservar `DEMO_BASE_URL` y `DEMO_ADMIN_TOKEN`.
- `.dev.vars` es local. El secret remoto se carga con `wrangler secret put`.
- `--local` y `--remote` trabajan con bases separadas.
- Las tres versiones del Worker son archivos `.ts`.
- Pegar bloques completos y recortar esperas; dejar las pruebas adicionales para el ensayo.
