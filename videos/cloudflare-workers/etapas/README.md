# Etapas TypeScript del acortador

Estas son versiones completas del mismo `src/index.ts`, no tres proyectos independientes:

1. [01-worker.ts](01-worker.ts): handler nativo con `/health` y una redirección fija en `/workers`.
2. [02-hono.ts](02-hono.ts): las mismas rutas organizadas con Hono.
3. [03-hono-d1.ts](03-hono-d1.ts): creación de enlaces, persistencia en D1 y token de escritura.

## Ejecutarlas sobre la demo

Prepara primero el proyecto según el [README de demo](../demo/README.md), incluido el binding D1 y los tipos generados. Desde `videos/cloudflare-workers/demo`, copia **solo la etapa que quieres ejecutar**:

```bash
cp ../etapas/01-worker.ts src/index.ts
```

```bash
cp ../etapas/02-hono.ts src/index.ts
```

```bash
cp ../etapas/03-hono-d1.ts src/index.ts
```

Estos comandos reemplazan únicamente el handler de tu copia local. Después:

```bash
npm run typecheck
npm run dev
```

En las dos primeras etapas solo el slug `workers` tiene un destino fijo. La tercera consulta D1 y necesita que crees el registro con la API; el contenido de las primeras etapas no se convierte automáticamente en un registro.

Para mostrar la inicialización y agregar recursos progresivamente, sigue la [chuleta por terminal](../CHULETA.md).
