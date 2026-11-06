# Ejecutar los ejemplos de primitivas

Consulta la [explicación](../README.md) para entender los tipos y las respuestas. Esta carpeta contiene solicitudes completas y una captura ficticia generada para el ejemplo.

## En el Playground

Abre el [Playground de TypeSafe](https://console.typesafe.ai/playground). Usa el modelo `jev-1.14.0`, el contenido de `state` y las preguntas de `request-texto.json`. Ejecuta y revisa la respuesta. Después cambia al estado de `request-logo.json` y conserva las mismas preguntas.

## Desde la terminal

Requiere `curl`, una cuenta TypeSafe con acceso al modelo y `TYPESAFE_API_KEY` exportada en el entorno del shell. Configura la clave fuera de una grabación. Un `.env` de otra aplicación no exporta automáticamente variables a esta terminal. Las solicitudes reales consumen la cuota de tu cuenta.

```bash
cd youtube-tutorials/videos/jev-primitivas/demo
```

Enviar las cuatro preguntas sobre el reporte:

```bash
curl --fail-with-body --silent --show-error \
  https://api.typesafe.ai/v1/systemone \
  -H "Authorization: Bearer $TYPESAFE_API_KEY" \
  -H 'Content-Type: application/json' \
  --data-binary @request-texto.json
```

Para probar el asunto no cubierto, repite el comando sustituyendo el archivo por `request-logo.json`.

Enviar la captura con Noul y Box:

```bash
curl --fail-with-body --silent --show-error \
  https://api.typesafe.ai/v1/systemone \
  -H "Authorization: Bearer $TYPESAFE_API_KEY" \
  -H 'TypeSafe-Danger-Zone-Images: true' \
  -F 'request=<request-imagen.json;type=application/json' \
  -F 'captura=@captura-reserva.png;type=image/png'
```

La primera parte contiene el JSON; la segunda es la imagen. El identificador de `state.captura` coincide con la clave de `assets`, y `assets` nombra la parte `captura`. La imagen no tiene texto y contiene un único botón rojo en la zona inferior derecha.

Los resultados dependen de cada ejecución. No hay respuestas precargadas ni cifras de precisión. Antes de aplicar reglas, valida el esquema y trata los errores como revisión manual. Los umbrales 0,2 y 0,8 del guion son ilustrativos, no umbrales evaluados para producción.
