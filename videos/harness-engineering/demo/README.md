# Demo reproducible: Harness Engineering

Esta carpeta contiene una aplicación de pedidos deliberadamente incompleta y el harness que debe guiar a Claude Code o Codex para corregirla.

La demo usa **una sola carpeta, un solo estado inicial y el mismo prompt** en las dos ejecuciones:

```text
Termina la exportación de pedidos a CSV. Tiene que quedar lista para abrirla en Excel.
Verifica que funcione antes de decirme que está lista.
```

Primero ocultaremos temporalmente el harness. Después restauraremos exactamente el mismo estado inicial y repetiremos la tarea con el harness disponible.

## Estructura inicial

```text
harness-engineering/
├── evaluation/evaluate.mjs           # evaluador externo a la carpeta del agente
└── demo/
    ├── AGENTS.md                     # entrada de Codex
    ├── CLAUDE.md                     # entrada de Claude Code
    ├── docs/
    │   ├── harness/workflow.md       # proceso compartido
    │   └── product/export-orders.md  # decisiones del producto
    ├── scripts/harness/
    │   ├── start.sh                  # comprueba el entorno
    │   └── verify.sh                 # ejecuta la verificación
    ├── test/export-orders.test.js    # feedback ejecutable
    └── src/                          # aplicación incorrecta
```

El evaluador queda fuera de la carpeta de trabajo del agente y no se menciona en el prompt. El aislamiento no es hermético: `demo/` sigue dentro del mismo repositorio Git, así que un agente podría inspeccionar `../evaluation` o el historial. En la ejecución registrada, el agente no lo hizo. Si quieres un experimento más riguroso, ejecuta la primera prueba en una copia exportada sin `.git` y sin acceso al directorio padre.

## Requisitos

- Git.
- Node.js 20 o superior.
- Bash (macOS, Linux o WSL). Los scripts no son portables a Windows nativo.
- Claude Code o Codex.
- Una copia limpia del repositorio dedicada a la demo.
- No hay dependencias externas que instalar.

Clona el repositorio y entra en la única carpeta que usaremos:

```bash
git clone https://github.com/gilbertsahumada/youtube-tutorials.git
cd youtube-tutorials/videos/harness-engineering/demo
```

Comprueba que no existan cambios previos:

```bash
git status --short
```

El comando no debe mostrar nada.

## 1. Ver la aplicación inicial

La app es una página interna de pedidos con un botón **Exportar CSV**: la idea es que alguien se lleve la tabla a Excel. El botón ya existe y ya devuelve un archivo, así que a primera vista funciona.

```bash
npm start
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

Lo que el producto necesita de verdad son seis criterios concretos, escritos en `docs/product/export-orders.md`. Esa es justamente la información que el agente **no** va a tener en la primera ejecución.

Detén el servidor antes de continuar.

## 2. Ocultar temporalmente el harness

Desde `videos/harness-engineering/` (la carpeta de arriba, no `demo/`):

```bash
npm run demo:sin-harness
```

Eso es todo. El script borra `AGENTS.md`, `CLAUDE.md`, el `README.md` de la demo, la documentación, los scripts y los tests, y te imprime lo único que queda visible:

```text
package.json
src
```

Se borra también el `README.md` porque describe el harness y apunta al evaluador: dejarlo sería entregarle el mapa al agente. Y se borran `docs/` y `scripts/` enteros, no solo sus subcarpetas, porque los directorios padre vacíos también son una pista.

Los comandos de producción viven en `videos/harness-engineering/package.json`, fuera de `demo/`. Si estuvieran dentro, el agente los vería y descubriría que aquí hubo un harness.

Aun así, el aislamiento no es hermético: el historial de Git conserva todo y el `package.json` de la demo se sigue llamando `harness-engineering-demo`. Nada de eso revela los seis criterios, pero sí delata que aquí había un harness. Reduce la probabilidad de que el agente los encuentre, no la elimina. Para un experimento estricto, copia `demo/` fuera del repositorio y ejecuta ahí el primer recorrido.

Confirma el estado:

```bash
git status --short
```

Debes ver únicamente los archivos del harness eliminados y `package.json` modificado.

## 3. Ejecutar la tarea sin harness

Abre Claude Code o Codex **dentro de `demo/`** y entrega exactamente este prompt:

```text
Termina la exportación de pedidos a CSV. Tiene que quedar lista para abrirla en Excel.
Verifica que funcione antes de decirme que está lista.
```

No agregues criterios sobre el CSV. Permite que el agente inspeccione, implemente y verifique con la información disponible.

La respuesta es probabilística. En la ejecución registrada, Codex creó sus propias pruebas y reportó `2/2`, pero tomó decisiones distintas de las requeridas por el producto. Ese resultado se obtuvo con una versión anterior del prompt: con el prompt actual el número puede ser otro, y lo que importa es la comparación entre las dos pasadas, no el valor exacto.

## 4. Evaluar el primer resultado

Cuando el agente termine, vuelve a `videos/harness-engineering/` y ejecuta:

```bash
node evaluation/evaluate.mjs
```

Sin argumentos: el evaluador ya apunta a `demo/` por defecto.

En la ejecución registrada, el resultado fue:

```text
Resultado: 1/6 checks pasan
```

Otra ejecución podría obtener un número diferente. Lo importante es que ambos recorridos usan el mismo evaluador independiente.

## 5. Restaurar la misma carpeta

Cierra la sesión del agente y, desde `videos/harness-engineering/`:

```bash
npm run demo:reset
```

El script te lista los archivos que creó el agente antes de eliminarlos, restaura `demo/` a su estado inicial y comprueba que no quedó nada pendiente. Todo lo destructivo queda acotado a `demo/`: no toca el resto del repositorio.

Debe quedar limpio. Ahora tenemos la misma implementación incorrecta del comienzo, pero el harness vuelve a estar disponible.

## 6. Comprobar el harness antes de corregir

```bash
npm run harness:start
npm run verify
```

El primer comando debe mostrar:

```text
Harness ready
Node: v20.19.6
Product spec: docs/product/export-orders.md
Verification: npm run verify
```

Y `npm run verify` debe fallar:

```text
# tests 4
# pass 1
# fail 3
```

Esto es intencional: el harness ya está instalado, pero todavía no ha corregido la aplicación. Que el check siga rojo es la prueba de que el harness no arregla el bug por arte de magia — hace visible qué falta.

## 7. Repetir la misma tarea con harness

Abre una sesión nueva de Claude Code o Codex dentro de la misma carpeta `demo/` y entrega el mismo prompt:

```text
Termina la exportación de pedidos a CSV. Tiene que quedar lista para abrirla en Excel.
Verifica que funcione antes de decirme que está lista.
```

El agente debe descubrir las instrucciones del proyecto, ejecutar `npm run harness:start`, leer la especificación y usar `npm run verify` como feedback antes de terminar.

No es necesario nombrar esos archivos en el prompt. Esa información pertenece al harness.

## 8. Comprobar el segundo resultado

Dentro de `demo/`:

```bash
npm run verify
```

Y desde `videos/harness-engineering/`:

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
PASS incluye las columnas en el orden acordado
PASS escapa comas y comillas del nombre del cliente
PASS formatea totales con dos decimales
PASS formatea fechas como YYYY-MM-DD
PASS produce exactamente el CSV esperado
PASS entrega headers HTTP de descarga

Resultado: 6/6 checks pasan
```

Esas seis etiquetas son las que imprime el evaluador de verdad. Si en el video prefieres una versión resumida, ponla como overlay de edición, no como si fuera la salida del terminal.

## Repetir la demo

Cierra el agente y, desde `videos/harness-engineering/`:

```bash
npm run demo:reset
```

La aplicación vuelve a quedar incorrecta y el harness vuelve a quedar instalado. No necesitas cambiar de commit, rama ni worktree.

Todo el recorrido, entonces, son tres comandos tuyos:

```bash
npm run demo:sin-harness      # esconder
node evaluation/evaluate.mjs  # medir
npm run demo:reset            # restaurar
```

## Permisos

La herramienta debe tener permiso para ejecutar los scripts del proyecto. El harness no evade el sandbox ni las aprobaciones de Claude Code o Codex. Si un comando está bloqueado, el comportamiento correcto es reportarlo en vez de afirmar que la verificación pasó.

No hay hooks en la demo. El agente ejecuta los scripts porque el workflow del repositorio se lo indica.
