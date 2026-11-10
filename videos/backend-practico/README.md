# Backend práctico: prompts de los dos videos

Diez prompts en inglés para revisar los problemas de backend que vimos en los dos videos. Cada uno se puede copiar por separado y pide al asistente que encuentre evidencia en tu código, explique el problema y proponga una corrección concreta.

Esta carpeta contiene los prompts; la aplicación que vas a revisar es la tuya. Los ejemplos de pedidos, precios y usuarios sirven para explicar los casos y se deben adaptar a las operaciones reales de tu proyecto.

## Cómo usarlos

1. Abre el repositorio de tu aplicación en un asistente de programación con acceso a sus archivos.
2. Elige un tema y copia todo el bloque de texto del archivo correspondiente.
3. Pégalo en el prompt del asistente, no en la terminal. Puedes añadir al final el endpoint o la operación que quieres revisar; si no lo haces, el prompt le pide que elija un caso relevante del código.
4. Revisa los archivos y líneas que cita, el caso que puede fallar y la corrección propuesta. Los prompts solicitan una revisión sin modificar archivos.
5. Distingue las comprobaciones ejecutadas de las propuestas. Si falta una base local, un servicio o un consumidor externo, el informe debe indicar qué quedó sin verificar.

No requieren un lenguaje, framework ni proveedor de IA específico. El asistente debe identificar las versiones y convenciones de tu proyecto antes de recomendar cambios. Si prefieres el informe en español, añade `Write the report in Spanish` al final del prompt.

## Video 1: 5 decisiones para construir una API confiable

| Tema | Prompt en inglés | Caso que revisa |
| --- | --- | --- |
| Idempotencia | [01 - Idempotency](prompts/video-1/01-idempotency.md) | La respuesta se pierde después de crear un pedido y el cliente reintenta |
| Errores claros | [02 - API errors](prompts/video-1/02-api-errors.md) | El frontend necesita distinguir falta de stock de una falla inesperada |
| JWT y autorización | [03 - JWT and authorization](prompts/video-1/03-jwt-and-authorization.md) | Un token válido no debe permitir consultar pedidos de otro usuario |
| Versionado | [04 - API versioning](prompts/video-1/04-api-versioning.md) | Un importe cambia de número a objeto y el cliente anterior sigue esperando el número |
| Documentación | [05 - API documentation](prompts/video-1/05-api-documentation.md) | Otro desarrollador debe poder crear y reintentar un pedido siguiendo la guía |

## Video 2: Por qué tu backend se vuelve lento y devuelve datos incorrectos

| Tema | Prompt en inglés | Caso que revisa |
| --- | --- | --- |
| Paginación | [06 - Pagination](prompts/video-2/06-pagination.md) | Un historial crece y necesita respuestas acotadas y un recorrido estable |
| Consultas N+1 | [07 - N+1 queries](prompts/video-2/07-n-plus-one.md) | Una página de veinte pedidos provoca una consulta adicional por cliente |
| Caché | [08 - Cache correctness](prompts/video-2/08-cache-correctness.md) | La base tiene un precio nuevo y una copia todavía devuelve el anterior |
| Rate limiting | [09 - Rate limiting](prompts/video-2/09-rate-limiting.md) | Un cliente repite solicitudes y debe respetar el límite y la espera |
| Consistencia | [10 - Data consistency](prompts/video-2/10-data-consistency.md) | Dos compras compiten por la última unidad y el reporte se actualiza después |

## Qué debe entregar la revisión

Un recorrido de la operación real, hallazgos con evidencia en archivos y líneas, una corrección mínima propuesta y comprobaciones para verificarla. Cuando el asistente pueda ejecutar pruebas locales, debe identificar los comandos y sus resultados; cuando no pueda, debe marcar esos pasos como pendientes.

Los prompts incluyen ejemplos para razonar sobre fallos. El contador de 21 consultas frente a 2 y el límite de 3 solicitudes cada 10 segundos son ejemplos del video, no mediciones ni configuraciones obligatorias para tu aplicación.

## Si el resultado no es útil

- Si revisa este repositorio de recursos en vez de tu aplicación, abre el proyecto que contiene el backend y vuelve a pegar el prompt allí.
- Si solo devuelve consejos generales, pide que los relacione con una ruta y archivos concretos. Un tema sin evidencia suficiente debe quedar como no verificado.
- Si faltan consumidores externos, datos de prueba o configuración, aporta ese contexto sin compartir credenciales ni información privada.
- Si quieres revisar solo una operación, indica su ruta o el archivo que la implementa para acotar el recorrido.

Las referencias oficiales de cada tema están al final de su archivo. [Volver al índice del repositorio](../../README.md).
