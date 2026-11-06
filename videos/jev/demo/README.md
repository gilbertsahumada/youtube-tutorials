# Comandos de la demo de Jev

Guía para instalar, explorar y ejecutar el proyecto. Para entender Jev, las preguntas y las mediciones, consulta la [explicación del ejemplo](../README.md).

## Probar desde la terminal de VS Code

Si abriste la carpeta `demo` en VS Code y ya configuraste `.env`, ejecuta:

```bash
nvm use
npm ci
npm start
```

`nvm use` es opcional si ya tienes activo Node.js 22.19 o superior. Una vez que aparezca `jev>`, escribe cada comando y espera su resultado antes de continuar:

```text
ver 1
preguntas
impacto si
1
2
3
datos
lote 100 8
```

`impacto si` activa Choice + Score para los tres casos y el lote, igual que en la prueba real registrada. `ver 1`, `preguntas` y `datos` solo inspeccionan información. Los números y `lote` envían solicitudes reales.

Si prefieres ejecutar todo desde el prompt normal de VS Code, sin entrar a `jev>`:

```bash
npm run demo -- enviar 1 2 3 --impacto
npm run demo -- lote 100 8 --impacto
```

Espera a que termine el primer comando antes de ejecutar el lote. Para abandonar la sesión interactiva, escribe `salir`.

## Distinguir solicitud, respuesta y registro

- `ver 1` muestra el cuerpo completo que se enviaría: `model`, `state` y `questions`. No consulta la API.
- `1`, `2` y `3` muestran la solicitud y hacen una llamada real. El JSON que aparece después del tiempo corresponde solo a `answers`; el modelo recibido se muestra por separado.
- `ultimo` permite inspeccionar los registros completos de la sesión. En `runs/`, `request` contiene la solicitud, `rawResult` la respuesta HTTP completa y `result` la respuesta validada. `destination`, el tiempo y los intentos son datos de nuestro programa.
- Los archivos de `data/` contienen los reportes; `src/domain/request.ts` los convierte en solicitudes completas añadiendo el modelo y las preguntas.

Consulta la [explicación de cada campo y los formatos admitidos](../README.md#qué-enviamos-a-jev-estructura-fija-y-contenido-propio) para distinguir el esquema de TypeSafe de los nombres que elegimos nosotros.

## Colores del JSON

Las solicitudes enviadas a Jev y sus respuestas se muestran con indentación y resaltado de sintaxis. También se aplica a `ver 1`, `preguntas` y `ultimo`:

| Elemento | Color |
| --- | --- |
| Claves | Cian |
| Textos | Verde |
| Números | Amarillo |
| Booleanos | Magenta |
| `null` | Gris |

En la terminal integrada de VS Code se activa automáticamente. Reinicia la demo con `salir` y `npm start` si la tenías abierta antes de esta actualización.

Para desactivar colores o forzarlos, ejecuta desde el shell:

```bash
NO_COLOR=1 npm start
FORCE_COLOR=1 npm start
```

`NO_COLOR` tiene prioridad; `FORCE_COLOR=0` también los desactiva. Al redirigir la salida se utiliza texto sin códigos de color, salvo que los fuerces explícitamente:

```bash
npm run demo -- ver 1 > solicitud-vista.txt
```

Este archivo contiene la salida completa del comando, incluidos sus encabezados. Los JSON de `runs/` y el cuerpo HTTP enviado a Jev siempre conservan su formato normal, sin códigos ANSI.

## Preparación

Requiere **Node.js 22.19 o superior**. El proyecto ejecuta TypeScript con el soporte nativo de Node y comprueba sus tipos con TypeScript. No necesita un navegador.

```bash
cd youtube-tutorials/videos/jev/demo
# Si usas nvm:
nvm install
nvm use
npm ci
cp -n .env.example .env
```

Completa `TYPESAFE_API_KEY` en `.env` con una clave de [TypeSafe](https://console.typesafe.ai/keys), o proporciona esa variable en tu entorno. `JEV_MODEL` permite cambiar la versión fija predeterminada `jev-1.14.0`. La clave, `node_modules/` y `runs/` están excluidos de Git.

Consultar datos y preguntas funciona sin clave. Enviar casos y procesar lotes hace llamadas reales que consumen la cuota de tu cuenta.

```bash
npm start
```

## Explorar, enviar uno a uno y probar un lote

La sesión mantiene un prompt `jev>` y estos comandos:

| Comando | Qué hace |
| --- | --- |
| `casos` | Lista los tres casos de `data/manual.json` |
| `ver 1` | Muestra el JSON completo que se enviaría, sin consultar la API |
| `preguntas` | Muestra las preguntas y sus criterios |
| `1`, `2` o `3` | Muestra la entrada, envía ese caso y muestra la respuesta |
| `enviar 1 2 3` | Envía los tres secuencialmente; también acepta `enviar 1,2,3` |
| `comparar` | Envía los casos 1 y 2, con el mismo mensaje y diferente contexto |
| `nuevo` | Pide un mensaje y un contexto escritos por ti; muestra la solicitud y la envía |
| `impacto si` | Añade la pregunta Score a las siguientes solicitudes |
| `impacto no` | Vuelve a usar solo Choice, el modo inicial |
| `datos` | Muestra cinco ejemplos del archivo del lote |
| `lote 100 8` | Procesa los 100 casos con hasta ocho solicitudes simultáneas |
| `ultimo` | Imprime los registros completos de la última ejecución de la sesión |
| `ayuda`, `salir` | Ayuda o salida |

Los casos 1 y 2 mantienen «No puedo entrar». A cambia de un entorno de pruebas sin más información a B en producción con un despliegue reciente y más clientes afectados. El caso 3 añade un error HTTP 500 reproducido y una interrupción documentada de la operación. La respuesta no está preparada: las opciones pueden coincidir.

Una secuencia para explorar la demo es `ver 1`, `preguntas`, `1`, `2`, `impacto si`, `3`, `nuevo`, `datos` y `lote 100 8`. Puedes editar los JSON y el código entre ejecuciones; reinicia el programa después de modificar archivos.

También admite comandos directos sin sesión interactiva:

```bash
npm run demo -- ver 1
npm run demo -- enviar 1 2 3
npm run demo -- comparar --impacto
npm run demo -- lote --cantidad 100 --concurrencia 8 --impacto
```

Para comparar ejecución secuencial y concurrente, mantén dataset, modelo y preguntas y ejecuta:

```bash
npm run demo -- lote 100 1
npm run demo -- lote 100 8
```

Son **200 llamadas lógicas nuevas**, además de posibles reintentos. Puedes empezar con `lote 10 2`. La cantidad admite 1–100 y la concurrencia 1–32; el valor predeterminado es 100 con concurrencia 8.

## Errores y registros

Cada solicitud tiene un timeout de 30 segundos por intento. Los HTTP 429 y 529 admiten hasta dos reintentos con espera exponencial de al menos 500 y 1000 ms, respetando `Retry-After` cuando corresponde. Si el proveedor pide esperar más de 30 segundos, se registra el fallo sin reintentar en esta ejecución. Los reintentos y esperas cuentan dentro del tiempo total; una solicitud puede tardar más de 30 segundos al reintentarse. Los demás errores no se reintentan automáticamente.

Cada envío o lote guarda un JSON único en `runs/`, con todas las entradas y preguntas, respuestas crudas disponibles, respuestas válidas, destinos, errores, intentos, configuración de concurrencia y métricas. La cabecera de autorización y los cuerpos de error HTTP no se guardan. Si el proceso se interrumpe antes del guardado final, esa ejecución puede quedar sin archivo; no es una cola durable.

Los comandos directos terminan con código 1 si hubo reportes fallidos. En una sesión interactiva puedes seguir explorando después de un fallo. No se crean tickets, no se diagnostica la causa y no se aplican cambios a una aplicación.

## Verificación

```bash
npm run check
```

Comprueba los tipos y ejecuta las pruebas de contratos HTTP, datasets, concurrencia, reintentos, errores, métricas y registros. Las pruebas usan respuestas controladas: **sus tiempos no son un benchmark de Jev**. Las cifras para un video deben salir de una ejecución real guardada en `runs/`.
