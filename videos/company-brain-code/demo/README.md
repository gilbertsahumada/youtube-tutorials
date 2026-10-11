# Demo ejecutable: Company Brain en código

El recorrido del video, las explicaciones y los comandos están en **[`../README.md`](../README.md)**.

Requiere Node.js 22 y Git; no hay dependencias que instalar ni servidor.

```bash
npm test
npm run reset
npm run context
npm run ask:fixture
npm run ingest
npm run ask:fixture
npm run approve -- --yes --reviewer "Gilbert"
npm run diff
npm run ask:fixture
```

`ask:fixture` es una plantilla simulada. Para consultas reales, configura `.env` desde `.env.example` y usa `npm run ask` en las tres consultas. No hay fallback silencioso de LLM a fixture.

Los cambios viven en `workspace/`; prompts y respuestas, en `output/`. Ambos directorios se ignoran en Git. `reset` borra su contenido y restaura el estado inicial.
