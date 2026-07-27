# Graph Engineering: un grafo de loops que se vigilan entre sí

> Un loop revisa. Un grafo revisa, refuta y compara contra algo que no puede reescribir.

Este tutorial no explica el término de moda: lo ejecuta. Vamos a revisar la misma feature dos veces
—primero con un agente solo, después con un grafo de loops— y a comparar ambos resultados contra un
ancla externa.

La feature revisada es la misma exportación de pedidos a CSV del tutorial de
[Harness Engineering](../harness-engineering), en su estado inicial incorrecto. No necesitas haber
visto ese tutorial, pero si lo viste ya conoces el terreno.

## La escalera

```text
HARNESS   el entorno donde trabaja UN agente        contexto, reglas, scripts, feedback
LOOP      el sistema que empuja al agente sin ti    cadencia, memoria, subagentes
GRAFO     la organización de loops                  quién alimenta, quién vigila, quién manda
```

Un grafo es lo que obtienes cuando un solo loop deja de ser suficiente. No reemplaza al loop: lo contiene.

## Qué es un grafo, sin marketing

- **Nodos**: unidades de trabajo. Un agente, una llamada al modelo, **código normal** o una decisión humana.
- **Aristas**: quién le pasa trabajo a quién y, sobre todo, **quién vigila a quién**.
- **Estado**: la información que fluye entre pasos.

La regla de diseño que gobierna este repositorio:

> El código controla el enrutamiento predecible. El modelo solo maneja los pasos que requieren juicio.

Por eso en [`review-graph.mjs`](review-graph.mjs) el deduplicado de hallazgos es un `for` normal y no
un agente. Un grafo no es "más agentes": es **menos decisiones en manos del modelo**.

## El grafo de este tutorial

```text
                  ┌─ finder:spec ─┐
   directorio ────┼─ finder:csv  ─┼──> dedup (código) ──> refutador por hallazgo ──> reporte
                  └─ finder:http ─┘                            (1 por hallazgo)
                                                                      │
                                          ancla externa: evaluate.mjs ─┘ (fuera del grafo)
```

Tres piezas importan:

1. **Lentes distintas, no revisores redundantes.** Cada finder tiene una sola obsesión: cumplimiento de
   la spec, robustez del CSV, contrato HTTP. Tres copias del mismo revisor encuentran lo mismo tres veces.
2. **El que crea nunca es el que aprueba.** Cada hallazgo pasa por un agente cuya única instrucción es
   refutarlo. Lo que no sobrevive, no se reporta.
3. **Un ancla que el grafo no puede reescribir.** El evaluador vive fuera del grafo y ninguno de sus
   nodos lo modifica.

## El fallo real que tuvo este workflow (y por qué importa)

Este apartado no es teórico: es lo que pasó construyendo el tutorial, en dos corridas seguidas.

**Corrida 1.** El prompt de cada finder decía que trabajara dentro del directorio objetivo. Uno igual
se fue a revisar un `csv.js` de **otro proyecto** del disco y devolvió hallazgos detallados, con
reproducciones ejecutadas, sobre código que no era el nuestro. Nada en el reporte delataba el error:
la confianza era idéntica en los hallazgos correctos y en los del repositorio equivocado.

**Corrección ingenua.** Agregué un filtro en código para descartar hallazgos fuera del objetivo:

```js
if (!f.file || !f.file.includes(TARGET)) continue
```

**Corrida 2. Volvió a pasar exactamente igual.** El filtro no descartó nada.

La causa raíz estaba antes: `args` llegaba al script como string JSON en vez de objeto, así que
`args.target` era `undefined` y `TARGET` caía a un valor por defecto relativo, `'demo'`. Con eso, el
guardia comparaba `ruta.includes('demo')` — y `/otro/proyecto/output/demos/x.js` **contiene** "demo".
El filtro daba luz verde a todo mientras aparentaba proteger.

Dos lecciones, y la segunda es la que cuesta:

1. Un límite que depende de que el modelo se acuerde de respetarlo no es un límite, es una sugerencia.
2. **Un control en código mal construido es peor que no tenerlo**, porque compra confianza sin darla.
   Un `includes()` contra un valor por defecto relativo se ve como una validación y funciona como un
   colador.

La corrección definitiva no fue filtrar mejor, sino **no arrancar**:

```js
if (!TARGET || !TARGET.startsWith('/')) {
  throw new Error(`args.target debe ser una ruta ABSOLUTA. Recibido: ${JSON.stringify(TARGET)}`)
}
```

Es preferible que el grafo no corra a que entregue un reporte impecable sobre el repositorio
equivocado. Esa es la diferencia entre validar y fallar rápido.

## Anclas: la pieza que casi nadie menciona

Un grafo donde todos los nodos se evalúan entre sí sigue siendo un sistema evaluándose a sí mismo. Sin
un punto de contacto con la realidad, es una cámara de eco más cara: perfectamente consistente y
progresivamente equivocada.

Un ancla es un nodo que el sistema no puede modificar:

- un conjunto de tests que el loop de mejora nunca ve;
- una métrica de negocio real (dinero cobrado, no un dashboard);
- una especificación de seguridad congelada;
- tu propio juicio sobre qué significa "mejor".

En este tutorial el ancla es [`evaluate.mjs`](../harness-engineering/evaluation/evaluate.mjs): seis
criterios del producto que ningún agente del grafo toca.

## Requisitos

- Node.js 20 o superior.
- Bash (macOS, Linux o WSL). Los scripts no son portables a Windows nativo.
- Claude Code con Workflows disponibles.

## Reproducir la comparación

### 1. Preparar la feature a revisar

Trabajaremos sobre una copia de la demo del tutorial anterior, en su estado inicial incorrecto:

```bash
git clone https://github.com/gilbertsahumada/youtube-tutorials.git
cd youtube-tutorials/videos/harness-engineering/demo
npm run verify
```

`npm run verify` debe fallar. Ese es el estado inicial: la feature todavía no cumple su especificación.

### 2. Recorrido A: un agente solo

Abre Claude Code dentro de `demo/` y entrega esta tarea:

```text
Revisa la exportacion de pedidos a CSV y dime si esta lista para produccion.
No modifiques ningun archivo: esto es una revision.
```

Guarda su veredicto y su lista de hallazgos. No es un mal resultado — es un resultado **sin filtro
independiente**: el mismo agente encuentra, juzga y reporta.

### 3. Recorrido B: el grafo

Desde la raíz del repositorio, ejecuta el workflow apuntando a la misma carpeta. **Usa una ruta
absoluta**: el control de alcance compara contra las rutas que reportan los agentes, y esas son
absolutas.

```bash
# dentro de Claude Code, reemplazando /ruta/a por la tuya
Workflow({
  scriptPath: "videos/graph-engineering/review-graph.mjs",
  args: { target: "/ruta/a/youtube-tutorials/videos/harness-engineering/demo" }
})
```

Usa `/workflows` para ver los tres finders corriendo en paralelo y los refutadores apareciendo a
medida que cada hallazgo entra en verificación.

El reporte final separa **confirmados** de **refutados**. Los refutados son la parte interesante: son
los hallazgos que en el recorrido A habrían llegado directo a tu reporte.

### 4. El ancla

Desde `demo/`, ejecuta el evaluador externo:

```bash
node ../evaluation/evaluate.mjs .
```

Compara sus seis criterios con los hallazgos confirmados del grafo. El ancla no le pregunta al grafo si
hizo un buen trabajo: comprueba el producto contra criterios que el grafo nunca pudo tocar.

## Resultados reales de la comparación

Estos son los números de la ejecución registrada, no una estimación. Tu corrida dará algo distinto:
la generación es probabilística.

| | Un agente solo | El grafo |
|---|---|---|
| Defectos reales encontrados | 5 | 5 |
| Hallazgos reportados | 6 | 13 → 12 confirmados |
| Falsos positivos que sobrevivieron | 1 | 0 |
| Agentes | 1 | 16 |
| Tokens | ~40 000 | ~436 000 |
| Duración | ~1,5 min | ~3 min |

El ancla externa (`evaluate.mjs`) reportó `1/6` criterios cumplidos: los 5 criterios fallidos coinciden
exactamente con los 5 defectos reales que ambos recorridos identificaron.

**El grafo no encontró más.** Encontró lo mismo, once veces más caro. Lo que sí hizo, y el agente solo
no podía hacer, fue **matar un falso positivo**: una de las lentes reportó que los valores `null` se
serializaban como el literal `"null"`, y el refutador demostró que el hallazgo se contradecía a sí
mismo. En el recorrido de un agente solo, un hallazgo así llega intacto a tu reporte — de hecho llegó:
el agente solo afirmó que el README del proyecto estaba desactualizado, que es interpretación y no
defecto, y nada en su proceso lo cuestionó.

Ahí está el negocio real de un grafo: **no compra hallazgos, compra confianza en los hallazgos.**
Decide si eso vale once veces el costo en tu caso.

### Una limitación honesta de este workflow

Los 12 hallazgos confirmados son en realidad unos 5 o 6 defectos distintos, vistos dos veces por lentes
diferentes: "no se escapan las comas" (lente `spec`) y "los campos con coma no se citan" (lente `csv`)
son el mismo bug redactado distinto.

El deduplicado de [`review-graph.mjs`](review-graph.mjs) compara cadenas (`archivo` + título), así que
no puede fusionar dos redacciones del mismo problema. Un dedup semántico —otro nodo del grafo cuyo
trabajo sea agrupar— lo arreglaría, a costa de otra llamada al modelo.

Lo dejamos así a propósito: un reporte inflado que *parece* más exhaustivo que el del agente solo es
justo el tipo de espejismo que un grafo produce cuando agregas nodos sin agregar criterio.

## Cuándo NO construir un grafo

Tres preguntas. Si respondes "no" a cualquiera, todavía no necesitas un grafo:

| Pregunta | Si respondes NO |
|---|---|
| ¿Necesitas resultados cruzados: paralelo, verificación independiente, aprobación humana? | Tu workflow es lineal. Déjalo lineal. |
| ¿Tienes un ancla externa que el sistema no pueda reescribir? | Construye el ancla primero. |
| ¿El valor de la tarea justifica multiplicar tokens por N agentes? | Un loop con buen harness te basta. |

Un grafo cuesta tokens, latencia y mantenimiento. Se gana, no se declara.

## Qué no garantiza

- Los refutadores también se equivocan: pueden matar un hallazgo real.
- Tres lentes cubren tres ángulos; lo que ninguna mira, nadie lo encuentra.
- El ancla solo es tan buena como los criterios que alguien escribió en ella.
- Un grafo mal diseñado es un loop caro con más piezas que mantener.

La ventaja no es la topología. Es que el resultado deja de depender de que un solo agente se califique
a sí mismo.

## Idea central

Graph Engineering no es una capa nueva encima de todo lo anterior. Es lo que pasa cuando aceptas dos
cosas: que un loop no puede cuestionar su propia meta, y que ningún sistema se valida solo. Los nodos
que agregas —lentes distintas, refutadores, anclas— existen para corregir esas dos limitaciones, no
para tener más agentes corriendo.
