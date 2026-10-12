# Scripts de la demo Company Brain

La guía única, desde la configuración hasta el comentario real, está en **[../README.md](../README.md)**. Ejecuta estos comandos desde esta carpeta con Node.js ≥22.

| Comando | Resultado |
|---|---|
| `npm test` | Pruebas locales con APIs simuladas, sin credenciales |
| `npm run preview` | Fixture explícita: `output/fixture.json` y `fixture-comment.md`; ninguna API ni publicación |
| `npm run gmail:login` | OAuth Gmail read-only; guarda el refresh token local |
| `npm run inbox` | Lista IDs, remitentes, asuntos y fechas de mensajes filtrados |
| `npm run baseline` | LLM real: valida correo e issue iniciales y guarda `.private/baseline.json`; no publica |
| `npm run once` | Una iteración con Gmail/GitHub/LLM reales; publica únicamente si `PUBLISH=true` |
| `npm run watch` | Polling con `PUBLISH=true`; comentarios pendientes de revisión humana |

Con `PUBLISH=false`, `once` prepara el comentario en `output/` sin escribir en GitHub ni marcar procesado. Con `PUBLISH=true`, guarda el resultado en `.private/state.json` y evita repetirlo.

No hay comando `approve`: las decisiones y ediciones posteriores se hacen manualmente en GitHub. No se crean PRs ni se actualiza un supuesto acuerdo automáticamente. El remitente permitido es un filtro, no prueba criptográfica de identidad.

`.env`, `.private/` y `output/` contienen información privada y se ignoran en Git. Los estados del flujo anterior con PRs no son compatibles. Para otro destino usa otra copia de la demo.
