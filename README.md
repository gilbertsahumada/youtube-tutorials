# IA en Producción: recursos de los videos

Prompts, skills y ejemplos que acompañan los videos del canal **IA en Producción** ([@gilbertsahumada](https://www.youtube.com/@gilbertsahumada)). La idea de fondo: construir con IA **con criterio de ingeniería**, no tirándole prompts a ciegas.

## Cómo está organizado

**Una carpeta por video.** Cada una tiene su `README.md` (el compañero escrito del video) y, cuando aplica, sus `skills/` (comandos reutilizables) y `ejemplos/`.

```
videos/
  arquitectura-minima-3-capas/   → el modelo de 3 capas + prompts de refactor
  codex-de-0-a-pro/              → setup, permisos, AGENTS.md y prompts
  spec-driven-development/       → las 5 preguntas + skills scope/exec/prove/audit/ship
  creando-skills/                → anatomía de un SKILL.md, las 4 preguntas y cómo probarlo
  harness-engineering/            → demo comparativa sin harness y con harness
  loop-engineering/               → un loop que arregla una feature y se detiene solo
  graph-engineering/              → un grafo de loops que se refutan entre sí, con ancla externa
  pi/                             → introducción a Pi, skills, extensiones y repository onboarding
  pi-pr-evidence/                 → revisión read-only de Pull Requests con Pi y GitHub Actions
```

## Videos

| Video | Carpeta | Qué te llevas |
|---|---|---|
| La mejor arquitectura para vibecoding: 3 capas | [`videos/arquitectura-minima-3-capas`](videos/arquitectura-minima-3-capas) | El modelo de 3 capas y los prompts para ordenar una app vibecodeada |
| Cómo uso OpenAI Codex de 0 a Pro | [`videos/codex-de-0-a-pro`](videos/codex-de-0-a-pro) | `config.toml`, permisos, `AGENTS.md` y los 4 prompts del workflow |
| Spec-Driven Development sin ceremonia | [`videos/spec-driven-development`](videos/spec-driven-development) | Las 5 preguntas, la plantilla y los skills `scope · exec · prove · audit · ship` |
| Cómo crear un Skill (que sí se activa) | [`videos/creando-skills`](videos/creando-skills) | La anatomía de un `SKILL.md`, las 4 preguntas antes de escribirlo, la plantilla y cómo probarlo |
| Harness engineering con Claude Code y Codex | [`videos/harness-engineering`](videos/harness-engineering) | Una demo reproducible de contexto, especificación, scripts y feedback ejecutable |
| Loop Engineering: deja de escribir prompts | [`videos/loop-engineering`](videos/loop-engineering) | Un loop real con memoria en disco y condición de parada verificable |
| Qué es Graph Engineering (y cuándo NO usarlo) | [`videos/graph-engineering`](videos/graph-engineering) | Un workflow real con lentes en paralelo, verificación adversarial y anclas externas |
| Pi: skills, extensiones y repository onboarding | [`videos/pi`](videos/pi) | La introducción básica a Pi y un onboarding local por rol |
| Revisión de Pull Requests con Pi | [`videos/pi-pr-evidence`](videos/pi-pr-evidence) | Un reviewer read-only que publica comentarios desde GitHub Actions |

> Los links a cada video de YouTube se agregan acá a medida que se publican.

## Cómo reproducir una demo

Todas se reproducen igual: clonas, entras a la carpeta del video y sigues su `README.md`. Cada demo documenta sus propios requisitos y dependencias.

```bash
git clone https://github.com/gilbertsahumada/youtube-tutorials.git
cd youtube-tutorials/videos/<carpeta-del-video>
```

Las demos basadas en scripts requieren **Node.js 20 o superior** y **Bash** (macOS, Linux o WSL; los scripts no corren en Windows nativo). Cada video indica si necesita Claude Code, Codex o Pi.

Las tres demos con recorrido ejecutable, y qué hace cada una:

| Demo | Qué corres | Qué obtienes |
|---|---|---|
| [`harness-engineering`](videos/harness-engineering) | el mismo mensaje dos veces, con y sin harness | un evaluador independiente puntúa las dos: sin harness el marcador no se mueve, con harness `6/6` |
| [`loop-engineering`](videos/loop-engineering) | `node loop-fix.mjs` | un loop que arregla una feature vuelta a vuelta y se detiene solo |
| [`graph-engineering`](videos/graph-engineering) | `node review-graph.mjs` | lentes en paralelo, verificación adversarial y ancla externa |

Los números que verás publicados salen de ejecuciones registradas y están marcados como tales. La generación es probabilística: **tu corrida dará algo distinto**, y esa es justamente la razón de que cada demo traiga su propio evaluador.

## Una nota sobre el idioma

Todo está en español para que lo entiendas rápido, pero los modelos suelen rendir mejor en inglés (están entrenados mayormente en inglés). Si quieres exprimir mejores resultados, traduce los prompts, los skills y tus specs a inglés. Funciona igual en español, así que es cosa de cada uno.

## La comunidad (por si quieres más)

Estos recursos salen de **IA en Producción**. Por si quieres lives, casos reales y más prompts, la comunidad está acá: https://www.skool.com/ia-en-produccion-3264

## Licencia

MIT
