# Primitivas de Jev

Ejemplos para estudiar las cuatro formas de preguntar a Jev y combinar sus respuestas en código. La [guía de la demo](demo/README.md) explica cómo enviarlos.

- **Choice:** selecciona una opción definida en `criteria`. Devuelve la elección, probabilidades y confianza. Siempre selecciona una opción; un Noul complementario puede comprobar si alguna corresponde.
- **Score:** evalúa una dimensión sobre una lista ordenada de niveles. Devuelve un valor que puede ser fraccionario, la distribución, confianza y leyenda. No es un porcentaje de personas afectadas.
- **Noul:** estima la probabilidad de que una afirmación sea cierta, de 0 a 1. No tiene `confidence` separado; 0,5 expresa incertidumbre, no una intensidad intermedia.
- **Box:** devuelve los bordes normalizados de un rectángulo dentro de una imagen. Conviene preguntar también si el objetivo está presente, porque Box devuelve una localización incluso cuando no lo está.

Todos los tipos de una misma solicitud evalúan el mismo `state` de forma independiente. El código combina las respuestas; una pregunta no recibe automáticamente la respuesta de otra. Una dependencia que requiera datos nuevos necesita otra solicitud.

El ejemplo parte de un usuario de una aplicación de reservas que pide ayuda para confirmar una reserva y solicita hablar con una persona. `request-texto.json` pregunta por área, impacto, petición de atención humana y cobertura temática. `request-logo.json` usa las mismas preguntas con un asunto ajeno a las tres áreas. `request-imagen.json` combina Noul y Box sobre una captura ficticia.

Los archivos son ejemplos preparados para ejecutar. No incluyen resultados observados ni una evaluación de precisión. Las imágenes y Box están descritos por TypeSafe como funciones para prototipos, con formato y comportamiento sujetos a cambios.

Referencias oficiales: [primitivas](https://docs.typesafe.ai/primitives), [Noul](https://docs.typesafe.ai/primitives/noul), [Box](https://docs.typesafe.ai/primitives/box) e [imágenes](https://docs.typesafe.ai/images).
