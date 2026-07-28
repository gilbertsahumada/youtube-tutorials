# Demo reproducible: Harness Engineering

Esta carpeta contiene una aplicación de pedidos deliberadamente incompleta y el harness que debe guiar a Claude Code para corregirla.

La demo usa **el mismo código de partida y el mismo mensaje** en las dos ejecuciones. Lo único que cambia es el entorno: la primera vez el agente trabaja sobre una copia que solo tiene la app; la segunda, sobre la carpeta que además tiene el harness.

El mensaje, idéntico en ambas:

```text
La exportación a CSV está fallando: abro el archivo en Excel y hay una fila donde los datos no calzan con las columnas.
Arréglalo y verifica que quede bien.
```

Primero sacaremos una copia de la app sin el harness y correremos ahí la tarea. Después la repetiremos en `demo/`, con el harness disponible.

## Estructura inicial

```text
harness-engineering/
├── evaluation/evaluate.mjs           # evaluador externo a la carpeta del agente
└── demo/
    ├── AGENTS.md                     # la guia canonica del proyecto
    ├── CLAUDE.md                     # entrada de Claude Code
    ├── docs/
    │   ├── harness/workflow.md       # como se trabaja
    │   └── product/export-orders.md  # las decisiones del producto
    ├── scripts/harness/
    │   ├── start.sh                  # npm run harness:start
    │   └── verify.sh                 # npm run verify
    ├── test/export-orders.test.js    # feedback ejecutable
    └── src/                          # la misma app rota
```

El evaluador vive fuera de la carpeta de trabajo del agente y no se menciona en el prompt.

En el **primer** recorrido el aislamiento es real: el agente trabaja sobre una copia fuera del repositorio, sin `.git` y sin ningún ancestro que contenga el evaluador (ver el paso 1).

En el **segundo** ya no hace falta esconder nada: las decisiones están a la vista, en la spec y en los tests, porque eso es justamente lo que aporta el harness.

## Requisitos

- Git.
- Node.js 20 o superior.
- Bash (macOS, Linux o WSL). Los scripts no son portables a Windows nativo.
- Claude Code.
- Una copia limpia del repositorio dedicada a la demo.
- No hay dependencias externas que instalar.

Clona el repositorio y entra en la carpeta del video (no en `demo/`: los comandos del recorrido se lanzan desde arriba):

```bash
git clone https://github.com/gilbertsahumada/youtube-tutorials.git
cd youtube-tutorials/videos/harness-engineering
```

Comprueba que no existan cambios previos:

```bash
git status --short
```

El comando no debe mostrar nada.

## 1. Sacar una copia de la app, sin el harness

El primer recorrido **no** se hace en `demo/`. Se hace en una copia de la app que vive fuera del repositorio, para que el aislamiento sea real.

Desde `videos/harness-engineering/` (la carpeta de arriba, no `demo/`):

```bash
npm run demo:sin-harness
```

El script copia `package.json` y `src/` a una carpeta hermana del repositorio, llamada `orders-app`, y te imprime la ruta:

```text
Copia limpia creada en:
  /ruta/a/tus/proyectos/orders-app

Esto es todo lo que ve el agente:
  package.json
  src

Sin .git, sin carpeta padre con el evaluador. demo/ quedo intacta.
```

Anota esa ruta: la vas a usar en el paso 4.

> **Por qué una copia, y no borrar archivos dentro de `demo/`.** La primera versión de esta demo escondía el harness borrándolo. Parecía suficiente y no lo era: al agente le bastaba un `git status` para ver los nombres de todo lo borrado, incluido `docs/product/export-orders.md`, donde viven las decisiones del producto, y un `git show HEAD:...` para leerlos enteros. No es teórico: en una corrida real el agente lo detectó y lo dijo en su respuesta. La copia se llama `orders-app` a propósito, porque el agente ve el nombre de su directorio de trabajo, y al `package.json` copiado se le quitan los comandos `harness:start` y `verify`, que también delatarían el montaje. Efecto secundario bienvenido: `demo/` no se toca en todo el primer recorrido, así que **no hay que restaurar nada antes del segundo**.

## 2. Ver la aplicación inicial

Todo este paso ocurre **dentro de la copia**, que es exactamente lo que verá el agente.

La app es una página interna de pedidos con un botón **Exportar CSV**: la idea es que alguien se lleve la tabla a Excel. El botón ya existe y ya devuelve un archivo, así que a primera vista funciona.

```bash
cd /ruta/a/tus/proyectos/orders-app
PORT=3000 npm start
```

Abre `http://localhost:3000` y usa **Exportar CSV**.

El primer defecto se ve antes de mirar el contenido: **el archivo no se descarga, se abre en la pestaña**. Falta el header `Content-Disposition: attachment`. (El nombre `orders.csv` sí está definido: viene de la URL `/api/orders.csv`.)

Y este es el contenido que produce:

```csv
id,customer,total,status,created_at
ORD-001,Acme Norte,1299.5,paid,2026-07-14T14:35:00.000Z
ORD-002,Cafe "Central", SpA,89,pending,2026-07-15T09:10:00.000Z
ORD-003,Distribuidora Sur,450.75,refunded,2026-07-16T18:05:00.000Z
```

Tres defectos, todos visibles:

| Dónde | Qué se ve | Por qué importa |
|---|---|---|
| Fila `ORD-002` | `Cafe "Central", SpA` | La coma del nombre parte la fila: seis campos donde deberían ir cinco. En Excel ese pedido se corre entero |
| Columna `total` | `1299.5` · `89` · `450.75` | Un decimal, ninguno y dos, en la misma columna de dinero |
| Columna `created_at` | `2026-07-14T14:35:00.000Z` | Se llama fecha, pero trae hora y milisegundos |

La causa está en `src/csv.js`, en cinco líneas: une los valores con comas y los escribe tal como vienen, sin escapar ni formatear.

Lo que el producto necesita de verdad está escrito en `docs/product/export-orders.md`. Esa es justamente la información que el agente **no** va a tener en la primera ejecución.

Detén el servidor antes de continuar.

## 3. Ejecutar la tarea sin harness

Abre Claude Code **dentro de `orders-app/`** (la copia, no `demo/`) y entrega exactamente este prompt:

```text
La exportación a CSV está fallando: abro el archivo en Excel y hay una fila donde los datos no calzan con las columnas.
Arréglalo y verifica que quede bien.
```

El prompt reporta un bug real, con su síntoma, igual que se lo reportarías a un colega. Lo que **no** hace es nombrar las decisiones del producto: cuántos decimales lleva el total, en qué formato va la fecha, cómo se llama el archivo o que deba descargarse en vez de abrirse. Eso no es parte del bug: es conocimiento que hoy no está en ninguna parte del repositorio.

No agregues esos criterios al prompt. Permite que el agente inspeccione, implemente y verifique con la información disponible.

La respuesta es probabilística. Lo esperable es que arregle el escape que le reportaste y lo verifique de alguna forma, mientras el resto de las decisiones queda a su criterio. En una corrida registrada, el agente escribió su propio chequeo con un parser CSV independiente, "para que no se valide a sí mismo" en sus palabras, probó casos borde, lo corrió contra el endpoint real y reportó *"Listo, arreglado y verificado"*. No dejó tests en el repo: los escribió aparte y los descartó.

Lo interesante no es que trabajara mal, sino qué verificó: que **cada fila tenga cinco columnas**, es decir, exactamente el síntoma que le reportaste. Nada más.

## 4. Evaluar el primer resultado

Cuando el agente termine, vuelve a `videos/harness-engineering/` y ejecuta el evaluador **contra la copia**:

```bash
node evaluation/evaluate.mjs /ruta/a/tus/proyectos/orders-app
```

Es la misma ruta que te imprimió el paso 1. Sin argumentos, el evaluador apunta a `demo/`, sin importar desde qué carpeta lo llames.

La primera línea que imprime es `Evaluando: <ruta>`. Léela: en esta demo se mide dos veces, contra la copia y contra `demo/`, y esa línea es la que dice cuál de las dos estás midiendo.

Imprime los seis checks, el resultado, y el CSV producido contra el esperado con los `\r` y `\n` visibles.

**Compara ese resultado con el de la aplicación intacta:** corre el evaluador sin argumentos, contra `demo/`, que nadie tocó. Esa es la comparación que importa, y no es la que uno espera.

En la corrida registrada, los dos dieron `2/6`:

| Check | App intacta | Después del agente |
|---|---|---|
| columnas y su orden | PASS | PASS |
| escapa comas y comillas | FAIL | **PASS** |
| totales con dos decimales | FAIL | FAIL |
| fechas `YYYY-MM-DD` | FAIL | FAIL |
| separa filas con LF, sin salto final | PASS | **FAIL** |
| headers HTTP de descarga | FAIL | FAIL |

El agente arregló lo que le reportaste **y rompió un criterio que ya estaba bien**: cambió los saltos de línea a `CRLF`. Y no se equivocó: `CRLF` es lo que manda RFC 4180, el estándar que él mismo citó. Este producto usa `LF`, y esa decisión no estaba en ninguna parte que él pudiera leer.

Ahí está el punto de la demo, y no es "el agente programa mal". Es que **al no conocer las decisiones, puede romper las que ya estaban bien**, y quedarse tranquilo, porque su propia verificación pasó.

Tu corrida dará otra cosa: la generación es probabilística. Lo que se repite no es el número, es que el resultado depende de que el modelo adivine.

## 5. Pasar a `demo/`, que sí tiene el harness

**No hay nada que restaurar.** El agente trabajó en la copia, así que `demo/` quedó intacta: tiene exactamente la misma app rota del principio y, además, el harness. La comparación es limpia: mismo código de partida, mismo mensaje, y lo único distinto es lo que hay alrededor.

```bash
cd demo
git status --short     # vacio: nadie la toco
```

Son ocho archivos, y ninguno es especial: markdown, dos scripts de bash y un archivo de tests.

### Pieza 1: la puerta de entrada

`AGENTS.md` es la guía canónica. Es corta a propósito: apunta a dónde está lo demás y define el ciclo mínimo.

```md
Before changing code:

1. Run `npm run harness:start`.
2. Read `docs/harness/workflow.md`.
3. Read the product specification named by the task.
4. Run `npm run verify` and read the failures. That output is the task.
```

El punto 4 es el que más cambia las cosas: el agente **empieza** mirando qué está mal, en vez de verificar al final para ver si acertó.

`CLAUDE.md` solo importa ese archivo con la sintaxis `@`, que es el patrón documentado de memoria de Claude Code; se carga al iniciar la sesión sin pedirlo:

```md
# Claude Code entry point

@AGENTS.md

`AGENTS.md` is the canonical project guide.
```

```text
Claude Code -> CLAUDE.md -> AGENTS.md -> el workflow del proyecto
                                ↑
                    otras herramientas entran aqui directo
```

### Pieza 2: contexto y decisiones

`docs/harness/workflow.md` dice cómo trabajar: preparar, leer la spec, verificar, hacer el cambio mínimo, verificar otra vez.

`docs/product/export-orders.md` es donde dejan de vivir en tu cabeza las decisiones del producto: dos decimales, `YYYY-MM-DD`, escapado, `LF` en vez de `CRLF`, sin salto final, y el header de descarga. También dice qué **no** hacer: no agregar dependencias, no rediseñar la página, no tocar los tests.

## 6. Piezas 3 y 4: los scripts y el feedback

Primero el script directo, para ver que es un `.sh` normal:

```bash
./scripts/harness/start.sh
```

```text
Harness ready
Node: v20.19.6
Product spec: docs/product/export-orders.md
Verification: npm run verify
```

Comprueba la versión de Node y que existan las piezas del workflow. No instala nada y es idempotente.

Y en `package.json` está el atajo, que es la interfaz estable que usa el agente:

```json
"scripts": {
  "harness:start": "./scripts/harness/start.sh",
  "verify": "./scripts/harness/verify.sh"
}
```

```bash
npm run harness:start
```

npm imprime qué está ejecutando (`> ./scripts/harness/start.sh`), así que el mapeo se ve solo. No hay nada nuevo aquí: es un script de bash y un alias, lo de siempre. Lo único que cambió es que ahora también lo corre un modelo.

**No corras `npm run verify` todavía.** Ese es el primer trabajo del agente en el paso siguiente, y verlo encontrarse con el rojo es la parte que vale.

(Si quieres el estado de partida sin abrir un agente: `npm run verify` da `1 pass / 3 fail`.)

## 7. Repetir la misma tarea con harness

Abre una sesión nueva de Claude Code dentro de la misma carpeta `demo/` y entrega el mismo prompt:

```text
La exportación a CSV está fallando: abro el archivo en Excel y hay una fila donde los datos no calzan con las columnas.
Arréglalo y verifica que quede bien.
```

El agente debe descubrir las instrucciones del proyecto, ejecutar `npm run harness:start`, leer la especificación y **correr `npm run verify` antes de escribir nada**: `AGENTS.md` y el workflow le dicen que las fallas que reporte son la tarea. Después implementa y lo vuelve a correr hasta que pase.

Eso es lo que hay que mirar en este paso: el agente se encuentra con `1 pass / 3 fail`, y son esas tres fallas, no el mensaje que le mandaste, las que le dicen qué falta. En la primera pasada, sin harness, no existía nada equivalente.

No es necesario nombrar esos archivos en el prompt. Esa información pertenece al harness.

## 8. Comprobar el segundo resultado

El propio agente ya corrió `npm run verify` y debería reportar `4/4`. Compruébalo tú desde `videos/harness-engineering/` con el evaluador, que él nunca vio:

```bash
node evaluation/evaluate.mjs
```

En el resultado validado para esta demo:

```text
# tests 4
# pass 4
# fail 0
```

```text
Evaluando: /ruta/a/youtube-tutorials/videos/harness-engineering/demo

PASS columnas y su orden
PASS escapa comas y comillas del nombre del cliente
PASS formatea totales con dos decimales
PASS formatea fechas como YYYY-MM-DD
PASS separa filas con LF y no deja salto final
PASS entrega headers HTTP de descarga

Resultado: 6/6 checks pasan

El CSV coincide exactamente con el esperado.
```

Esas seis etiquetas son las que imprime el evaluador de verdad. Si en el video prefieres una versión resumida, ponla como overlay de edición, no como si fuera la salida del terminal.

## Repetir la demo

Cierra el agente y, desde `videos/harness-engineering/`:

```bash
npm run demo:reset
```

La aplicación vuelve a quedar incorrecta y el harness vuelve a quedar instalado. No necesitas cambiar de commit, rama ni worktree.

El script borra la copia, lista los archivos sin rastrear que hubiera dentro de `demo/` antes de eliminarlos, restaura la carpeta y comprueba que no quedó nada pendiente. Todo lo destructivo queda acotado a `demo/` con pathspec. **Ojo: descarta los cambios sin commitear que haya ahí dentro**, incluido el trabajo del agente que acabas de ver.

Todo el recorrido son tres comandos tuyos:

```bash
npm run demo:sin-harness              # copia limpia fuera del repo
node evaluation/evaluate.mjs [ruta]   # medir: con la ruta de la copia, o sin nada para demo/
npm run demo:reset                    # borrar la copia y restaurar demo/
```

## Permisos

La herramienta debe tener permiso para ejecutar los scripts del proyecto. El harness no evade el sandbox ni las aprobaciones de Claude Code. Si un comando está bloqueado, el comportamiento correcto es reportarlo en vez de afirmar que la verificación pasó.

No hay hooks en la demo. El agente ejecuta los scripts porque el workflow del repositorio se lo indica.
