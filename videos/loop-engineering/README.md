# Loop Engineering: deja de escribir prompts, diseña el sistema que los escribe

> El harness es el entorno donde trabaja un agente. El loop es lo que le dice qué hacer, sin ti.

En el tutorial de [Harness Engineering](../harness-engineering) construimos el entorno: contexto,
instrucciones, herramientas y feedback dentro del repositorio. Pero seguía faltando una persona en la
ecuación: **tú**, escribiendo el prompt.

Un loop quita esa parte. Encuentra el trabajo, se lo reparte al agente, revisa lo que salió, anota lo
hecho y decide qué sigue.

## De dónde viene esto

En junio de 2026 el término se popularizó a partir de una idea repetida por varias personas que
construyen estas herramientas: que el trabajo dejó de ser escribir prompts y pasó a ser diseñar los
loops que escriben esos prompts. Peter Steinberger lo planteó así en X, y Boris Cherny, que dirige
Claude Code en Anthropic, describió su propio trabajo en los mismos términos.

Lo interesante no es el nombre. Es que **las piezas dejaron de ser tuyas y ya vienen dentro de los
productos**. Hace un año, un loop era un montón de Bash que mantenías para siempre. Hoy Claude Code y
Codex traen los mismos cinco bloques.

## Las cinco piezas (y dónde están en cada herramienta)

| Pieza | Para qué | Claude Code | Codex |
|---|---|---|---|
| **Cadencia** | que el loop corra sin que lo lances | `/loop`, tareas programadas, hooks, GitHub Actions | Automations, hooks |
| **Aislamiento** | que dos agentes en paralelo no se pisen | `git worktree`, `isolation: worktree` en subagentes | worktrees integrados |
| **Conocimiento** | dejar de reexplicar el proyecto cada sesión | Skills (`SKILL.md`) | Skills (`SKILL.md`) |
| **Alcance** | que el loop toque tus herramientas reales | MCP, plugins | MCP, plugins |
| **Revisión** | que quien revisa no sea quien escribió | subagentes (`.claude/agents/`) | subagentes (`.codex/agents/`) |

Y debajo de las cinco, la que sostiene todo:

> **Memoria en disco.** Un archivo, un tablero, lo que sea que viva fuera de una conversación. El
> modelo olvida todo entre ejecuciones. El repositorio no.

## La demo: un loop que se detiene solo

Este repositorio incluye [`loop-fix.mjs`](loop-fix.mjs), un loop mínimo pero real que arregla la
feature rota del tutorial anterior.

Lo importante no es que arregle el CSV. Es **cómo** lo hace:

```text
vuelta 1 ─> agente nuevo ─> lee ESTADO.md ─> verify ─> arregla UNA cosa ─> reescribe ESTADO.md
vuelta 2 ─> agente nuevo ─> lee ESTADO.md ─> verify ─> arregla UNA cosa ─> reescribe ESTADO.md
   ...
vuelta N ─> verify pasa ─> el loop se detiene solo
```

Tres detalles que hacen que esto sea un loop y no un script:

1. **El prompt de cada vuelta es idéntico.** Tú no lo escribes de nuevo. Lo que cambia entre vueltas
   no es la instrucción: es el estado en disco.
2. **Cada vuelta es un agente nuevo, sin memoria de la anterior.** No hay contexto acumulado. Si
   `ESTADO.md` no dice algo, para el agente no existe.
3. **La condición de parada es verificable.** El loop no se detiene cuando el agente dice "ya está",
   sino cuando `npm run verify` pasa. Quien declara el éxito no es quien hizo el trabajo.

## Resultados reales de la ejecución registrada

Estos son los números de la corrida validada, no una estimación. La tuya dará algo distinto: la
generación es probabilística.

| Vuelta | Qué arregló | Marcador después |
|---|---|---|
| 1 | headers HTTP (`charset` + `Content-Disposition`) | `1 pass / 3 fail` |
| 2 | `total` con `toFixed(2)` | `1 pass / 3 fail` |
| 3 | `created_at` con `slice(0, 10)` | `1 pass / 3 fail` |
| 4 | escapado CSV (comas, comillas, CR/LF) | `4 pass / 0 fail` |

El loop se detuvo solo en la vuelta 4. El evaluador externo del tutorial anterior —que ningún agente
del loop pudo tocar— confirmó `6/6`. Solo se modificaron `src/csv.js` y `src/server.js`.

### El hallazgo: el marcador no se movió durante tres vueltas

Mira la columna de la derecha. `1 pass / 3 fail`, tres veces seguidas, mientras cada vuelta arreglaba
un defecto real. La razón es simple: cada test fallaba por varias causas a la vez, así que arreglar
una de tres no pone ningún test en verde.

Eso tiene dos consecuencias que valen más que el resto de este README:

**1. Una condición de parada ingenua habría matado este loop.** "Detente si el número no mejora" —que
es lo que uno escribe sin pensar— lo habría declarado atascado tras la vuelta 1, devolviendo la
feature rota con el 75% del trabajo sin hacer. Y lo habría reportado como intento legítimo.

Por eso la condición de parada de [`loop-fix.mjs`](loop-fix.mjs) es mecánica y total: `npm run verify`
pasando entero. No "mejoró algo", no "el agente cree que terminó".

**2. El archivo de estado llevaba criterio, no solo datos.** El agente de la vuelta 1 le dejó escrita
una advertencia a su sucesor: el conteo de tests no va a bajar, confirma el avance mirando el diff. El
agente de la vuelta 2, que no recordaba absolutamente nada, no se asustó con el marcador congelado
gracias a esa nota.

Un `for` pasa estado hacia adelante. Este loop pasó **interpretación**. Esa es la diferencia.

## Requisitos

- Node.js 20 o superior.
- Bash (macOS, Linux o WSL).
- Claude Code con Workflows disponibles.

## Reproducir

```bash
git clone https://github.com/gilbertsahumada/youtube-tutorials.git
cd youtube-tutorials/videos/harness-engineering/demo
npm run verify   # debe fallar: ese es el estado inicial
```

Crea el archivo de memoria del loop:

```bash
printf '# Estado del loop\n\n(vacio: el loop todavia no ha corrido)\n' > ESTADO.md
```

Y lanza el loop apuntando a esa carpeta con **ruta absoluta**:

```bash
# dentro de Claude Code, reemplazando /ruta/a por la tuya
Workflow({
  scriptPath: "videos/loop-engineering/loop-fix.mjs",
  args: { target: "/ruta/a/youtube-tutorials/videos/harness-engineering/demo" }
})
```

Mira `ESTADO.md` entre vueltas: ahí está, literalmente, la memoria del sistema.

Para repetir la demo desde cero:

```bash
git restore . && git clean -fd
```

## Qué NO hace un loop por ti

- **La verificación sigue siendo tuya.** Un loop corriendo sin supervisión también es un loop
  equivocándose sin supervisión. Por eso la condición de parada tiene que ser mecánica.
- **Tu comprensión se deteriora si lo permites.** Mientras más rápido entra código que no escribiste,
  más crece la distancia entre lo que existe y lo que entiendes.
- **La postura cómoda es la arriesgada.** Cuando el loop corre solo, es tentador dejar de tener
  opinión y aceptar lo que devuelva.

Dos personas pueden construir el mismo loop y obtener resultados opuestos: una lo usa para avanzar
más rápido en un trabajo que entiende, otra para no entenderlo nunca. El loop no nota la diferencia.

## Idea central

Diseñar loops es más difícil que escribir prompts, no más fácil. El punto de apalancamiento se movió,
pero el criterio sigue siendo tuyo.

Construye el loop como alguien que piensa seguir siendo el ingeniero, no como quien solo aprieta
ejecutar.
