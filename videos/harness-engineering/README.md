# Harness Engineering con Claude Code y Codex

> El modelo propone decisiones. El harness le entrega el contexto, las instrucciones, las herramientas y el feedback necesarios para trabajar dentro de un proyecto real.

En este tutorial construiremos un harness dentro de un repositorio. Funcionará tanto con Claude Code como con Codex y no dependerá de hooks, plugins ni un framework de agentes.

La prueba será concreta: le daremos exactamente el mismo mensaje al mismo modelo, primero sin harness y después con harness. Sin cambiar una coma.

```text
La exportación a CSV está fallando: abro el archivo en Excel y hay una fila donde los datos no calzan con las columnas.
Arréglalo y verifica que quede bien.
```

Es un reporte de bug normal: dice qué falla y con qué síntoma. Lo que **no** dice es cuántos decimales lleva el total, en qué formato va la fecha o que el archivo deba descargarse. Eso no es parte del bug — son decisiones del producto, y ahí está toda la diferencia entre las dos ejecuciones.

## Qué es Harness Engineering

Un modelo por sí solo recibe una entrada y genera una salida. Claude Code y Codex agregan una primera capa alrededor del modelo: pueden leer archivos, editar código, ejecutar comandos y mantener una conversación.

Pero esas herramientas todavía necesitan entender cómo se trabaja en **este** proyecto:

- dónde están las decisiones de producto;
- qué proceso deben seguir antes de editar;
- qué comandos pueden utilizar;
- cómo comprobar si el resultado es correcto.

Ese entorno específico del repositorio es el harness.

```text
Modelo
  └── Claude Code o Codex
        └── Harness del repositorio
              ├── Contexto
              ├── Instrucciones
              ├── Herramientas
              └── Feedback
```

Harness Engineering es diseñar y mantener ese sistema para que el agente tenga mejores condiciones de trabajo. No consiste en escribir un prompt enorme ni en intentar controlar cada respuesta del modelo.

## De dónde viene la palabra "harness"

Casi todo el mundo asume que viene de los caballos. Es una suposición razonable y es incorrecta: los caballos aparecen temprano en la historia de la palabra, pero no son su origen.

La cadena documentada, según tres fuentes que coinciden:

```text
nórdico antiguo *hernest    herr ("ejército") + nest ("provisiones")
        ↓                   provisiones para una fuerza armada
francés antiguo harneis     equipo de batalla, bagaje
        ↓
inglés c. 1300              equipo de combate personal, armadura
        ↓
inglés s. XIV temprano      arreos para animales de carga   ← el sentido "de caballos"
        ↓
inglés 1690s                (verbo) controlar algo para usarlo como fuerza motriz
```

O sea que "harness" nunca significó "sujetar a un animal". Significaba **el equipo que un ejército cargaba para poder pelear**. El sentido de arreos es una especialización posterior, del siglo XIV.

Y el sentido que de verdad importa acá es el último, el figurado de los años 1690: *to harness* = tomar una fuerza que no controlas y convertirla en trabajo útil. Eso es exactamente lo que hace un harness alrededor de un agente: no lo sujeta ni lo limita, le da la estructura para que su capacidad rinda.

> **Nota de honestidad:** no encontré ninguna fuente que documente por qué el término se adoptó en software (*test harness*). La conexión con el sentido de 1690 es una lectura razonable, no un hecho documentado. Las tres fuentes de arriba sí documentan todo lo anterior:
> [Etymonline](https://www.etymonline.com/word/harness) · [Wiktionary](https://en.wiktionary.org/wiki/harness) · [Dictionary.com](https://www.dictionary.com/browse/harness)

## Las cuatro piezas

### 1. Contexto

El contexto contiene las decisiones que el agente no debería inventar: especificaciones, arquitectura, convenciones y límites del producto.

En la demo, la especificación [`export-orders.md`](demo/docs/product/export-orders.md) define el nombre del archivo, las columnas, el formato de fechas y dinero, el escape de CSV y lo que queda fuera de alcance.

### 2. Instrucciones

Las instrucciones indican cómo trabajar con ese contexto. El proyecto usa [`AGENTS.md`](demo/AGENTS.md) como entrada canónica y [`CLAUDE.md`](demo/CLAUDE.md) para dirigir Claude Code al mismo flujo.

Ambas herramientas terminan leyendo [`workflow.md`](demo/docs/harness/workflow.md), que define este ciclo:

```text
preparar → leer la especificación → implementar → verificar → corregir
```

### 3. Herramientas

Las herramientas convierten acciones frecuentes en comandos conocidos por el proyecto:

- [`start.sh`](demo/scripts/harness/start.sh) comprueba que el entorno esté listo y muestra dónde están la especificación y la verificación.
- [`verify.sh`](demo/scripts/harness/verify.sh) ejecuta el contrato de verificación del repositorio.

Los scripts no sustituyen al agente. Le entregan una interfaz estable que también puede usar una persona o un pipeline de CI.

### 4. Feedback

El feedback le permite comparar su implementación con un resultado observable. En esta demo, [`export-orders.test.js`](demo/test/export-orders.test.js) comprueba cuatro comportamientos definidos por el producto.

Sin ese feedback, el agente solo puede revisar su propio código y afirmar que parece correcto. Con él, puede detectar un fallo, corregirlo y volver a ejecutar la prueba.

## La demo

> Los pasos para reproducirla están en **[`demo/README.md`](demo/README.md)**. Este archivo cuenta
> qué pasó y por qué; el otro dice qué teclear. No repetimos lo mismo en dos sitios.

La aplicación muestra tres pedidos y un botón **Exportar CSV**, para que alguien se lleve la tabla a Excel. El botón ya devuelve un archivo, así que a primera vista funciona. Este es el archivo que produce:

```csv
id,customer,total,status,created_at
ORD-001,Acme Norte,1299.5,paid,2026-07-14T14:35:00.000Z
ORD-002,Cafe "Central", SpA,89,pending,2026-07-15T09:10:00.000Z
ORD-003,Distribuidora Sur,450.75,refunded,2026-07-16T18:05:00.000Z
```

Tres defectos visibles, más uno que se nota antes de abrirlo:

| Dónde | Qué se ve | Por qué importa |
|---|---|---|
| Al descargar | el archivo se abre en la pestaña | falta `Content-Disposition: attachment` |
| Fila `ORD-002` | `Cafe "Central", SpA` | la coma parte la fila: seis campos donde van cinco |
| Columna `total` | `1299.5` · `89` · `450.75` | un decimal, ninguno y dos, en la misma columna de dinero |
| Columna `created_at` | `2026-07-14T14:35:00.000Z` | se llama fecha, pero trae hora y milisegundos |

Lo que el producto necesita son seis criterios concretos, escritos en [`demo/docs/product/export-orders.md`](demo/docs/product/export-orders.md). El prompt no los menciona, y esa omisión es deliberada: en un proyecto real no repetimos todo el conocimiento del producto en cada petición.

## Primera ejecución: sin harness

El agente trabaja sobre una copia de la app que vive **fuera del repositorio**: solo `package.json` y `src/`, sin `.git` y sin carpeta padre que contenga el evaluador.

Esto empezó siendo más simple —borrar el harness dentro de `demo/`— y no funcionaba. Con la carpeta dentro de un repo Git, al agente le bastaba `git status` para ver los nombres de todo lo borrado, incluido el archivo con los seis criterios, y `git show` para leerlos. No es teórico: un agente lo detectó y lo dijo en su respuesta.

El prompt reporta el bug con su síntoma, como se lo reportarías a un colega, y calla las decisiones del producto:

```text
La exportación a CSV está fallando: abro el archivo en Excel y hay una fila donde los datos no calzan con las columnas.
Arréglalo y verifica que quede bien.
```

En una ejecución registrada, el agente hizo un buen trabajo: arregló el escape siguiendo RFC 4180, escribió su propio chequeo con un parser CSV independiente —"para que no se valide a sí mismo", en sus palabras—, probó casos borde, lo corrió contra el endpoint real y reportó *"Listo, arreglado y verificado"*.

Lo interesante es **qué verificó**: que cada fila tenga cinco columnas. Es decir, exactamente el síntoma que le reportaron. Nada más. No tocó decimales, ni el formato de fecha, ni el header de descarga, porque nadie le dijo nunca que existieran.

Un evaluador independiente, que sí conoce las seis decisiones del producto, mide el resultado. El único valor publicado hasta ahora es `1/6`, obtenido con una versión anterior del prompt que no reportaba el bug; con el prompt actual es razonable esperar un punto más, pero **eso no está medido**.

Esto no demuestra que el modelo sea malo. Demuestra que la verificación puede ser impecable y aun así medir el criterio equivocado, cuando ese criterio no está escrito en ninguna parte. Ese [`evaluate.mjs`](evaluation/evaluate.mjs) nunca se menciona en el prompt.

## Construcción del harness

Después de evaluar el primer resultado, restauramos la misma carpeta con `npm run demo:reset`. Eso recupera simultáneamente la implementación incorrecta original y el entorno de trabajo:

```text
harness-engineering/
├── evaluation/evaluate.mjs
└── demo/
    ├── AGENTS.md
    ├── CLAUDE.md
    ├── docs/
    │   ├── harness/workflow.md
    │   └── product/export-orders.md
    ├── scripts/harness/
    │   ├── start.sh
    │   └── verify.sh
    ├── test/export-orders.test.js
    └── src/
```

### Paso 1: conectar ambos agentes

[`AGENTS.md`](demo/AGENTS.md) contiene las instrucciones del proyecto para Codex:

```markdown
Before changing code:

1. Run `npm run harness:start`.
2. Read `docs/harness/workflow.md`.
3. Read the product specification named by the task.

Before declaring the task complete:

1. Run `npm run verify`.
2. If verification fails, fix the implementation and run it again.
3. Report the real verification output and any remaining limitation.
```

[`CLAUDE.md`](demo/CLAUDE.md) importa esas mismas instrucciones con `@AGENTS.md`, el patrón documentado de Claude Code para compartir memoria entre herramientas. No mantenemos dos procesos diferentes: Claude Code y Codex comparten el harness del repositorio.

### Paso 2: sacar decisiones del prompt

La especificación [`export-orders.md`](demo/docs/product/export-orders.md) convierte "lista para usar" en decisiones observables:

```text
Archivo: orders.csv
Columnas: id, customer, total, status, created_at
Total: exactamente dos decimales
Fecha: YYYY-MM-DD en UTC
CSV: escapar comas, comillas y saltos de línea
```

El prompt puede seguir siendo corto porque el conocimiento duradero vive junto al código.

### Paso 3: ofrecer comandos estables

Antes de editar, el agente ejecuta:

```bash
npm run harness:start
```

Antes de declarar éxito, ejecuta:

```bash
npm run verify
```

El primer comando orienta. El segundo devuelve feedback ejecutable. Si la implementación no cumple la especificación, la verificación falla.

### Paso 4: cerrar el ciclo de feedback

El workflow no le pide al agente que "revise bien". Le indica una secuencia verificable:

1. Leer las decisiones del producto.
2. Hacer el cambio mínimo necesario.
3. Ejecutar la verificación.
4. Usar el error para corregir la implementación.
5. No declarar éxito hasta obtener una salida real.

## Segunda ejecución: el mismo prompt con harness

Ahora en `demo/`, que no se tocó durante el primer recorrido: mismo código de partida, y además el harness. Abrimos una sesión nueva y repetimos **el mismo mensaje**, sin agregar nada:

```text
La exportación a CSV está fallando: abro el archivo en Excel y hay una fila donde los datos no calzan con las columnas.
Arréglalo y verifica que quede bien.
```

Esta vez el agente encontró las instrucciones del repositorio, leyó la especificación, ejecutó la verificación, corrigió la implementación y volvió a comprobarla.

La verificación interna reportó:

```text
tests 4
pass 4
fail 0
```

Después aplicamos el mismo evaluador independiente de la primera ejecución:

```text
Resultado: 6/6 checks pasan
```

El agente solo necesitó modificar los dos archivos de implementación relacionados con la tarea. No fue necesario incluir las reglas del CSV en el prompt ni crear pruebas improvisadas durante la ejecución.

## Claude Code y Codex

El harness no depende de una sola herramienta:

- Codex descubre [`AGENTS.md`](demo/AGENTS.md).
- Claude Code descubre [`CLAUDE.md`](demo/CLAUDE.md).
- Ambos leen la misma especificación y el mismo workflow.
- Ambos ejecutan los mismos scripts y reciben el mismo feedback.

La demo también fue validada con Claude Code. Su implementación pasó `4/4` pruebas internas y `6/6` criterios externos.

Los permisos siguen perteneciendo a cada herramienta. Si el entorno bloquea la ejecución de un script, el comportamiento correcto es informarlo; el harness no evade sandboxes ni aprobaciones. Para grabar el flujo completo, autoriza los scripts del repositorio cuando la herramienta lo solicite.

## ¿Y los hooks?

No usamos hooks en esta demo.

Un hook podría ejecutar automáticamente `harness:start` al iniciar una sesión o `verify` antes de terminar. Eso reduce pasos manuales, pero no define las decisiones del producto, el workflow ni las pruebas.

```text
Harness = sistema de contexto, instrucciones, herramientas y feedback
Hook    = conexión opcional a un momento del ciclo de la herramienta
```

Primero conviene construir comandos explícitos y comprobar que el flujo funciona. Después se puede automatizar su ejecución si aporta valor.

## Qué no garantiza

Un harness mejora las condiciones de trabajo, pero no vuelve determinista al modelo:

- las pruebas solo cubren los comportamientos que alguien definió;
- una especificación desactualizada puede guiar al agente hacia una solución incorrecta;
- el modelo todavía puede interpretar mal una instrucción;
- los scripts y documentos también necesitan mantenimiento;
- para un script pequeño y descartable, este nivel de estructura puede ser innecesario.

La ventaja es que los errores dejan de depender únicamente de la interpretación del prompt. El proyecto conserva criterios que pueden leer y ejecutar agentes, personas y CI.

## Reproducir la comparación

Tres comandos tuyos. El resto lo hace el agente.

```bash
git clone https://github.com/gilbertsahumada/youtube-tutorials.git
cd youtube-tutorials/videos/harness-engineering

npm run demo:sin-harness              # copia la app a orders-app/, fuera del repo
# abre tu agente en orders-app/ y pégale el prompt
node evaluation/evaluate.mjs <ruta>   # mide esa copia

# abre tu agente en demo/ y pégale el MISMO prompt
node evaluation/evaluate.mjs          # sin argumentos: mide demo/

npm run demo:reset                    # borra la copia y restaura demo/
```

No hay que cambiar de commit, rama ni worktree, y `demo/` no se toca durante el primer recorrido.

El paso a paso completo, con las salidas esperadas de cada comando, está en
**[`demo/README.md`](demo/README.md)**.

## Idea central

Harness Engineering no consiste en esperar que el agente acierte por casualidad ni en reemplazar el desarrollo tradicional. Consiste en convertir el conocimiento y las comprobaciones de un proyecto en un entorno que el agente pueda descubrir, usar y verificar.

En este ejemplo usamos archivos Markdown, scripts de shell y tests. En otro entorno, las mismas cuatro piezas podrían implementarse con CI, contenedores, observabilidad, permisos, herramientas propias o un harness construido con código y un SDK de IA. Esa será la siguiente capa; primero necesitábamos demostrar el principio dentro de Claude Code y Codex.
