# Demo visual de Company Brain

Con **Node.js ≥22**, desde esta carpeta:

```bash
npm start
```

Abre **http://127.0.0.1:4173** y pulsa **Analizar solicitud**. El ejemplo funciona sin cuentas ni instalación de dependencias.

Usa **EN / ES** en la barra superior para cambiar entre español e inglés. La preferencia se guarda en el navegador; los textos de las fuentes y los comentarios se conservan tal como fueron recibidos o preparados.

- **Ejemplo:** explora el acuerdo CSV, la solicitud PDF y la propuesta con evidencia. Usa un análisis preparado; no consulta servicios externos.
- **Mis cuentas:** conecta Gmail, GitHub y tu modelo desde Configuración. Captura el acuerdo, busca nuevas solicitudes y revisa antes de publicar el comentario.
- **Fuentes de contexto / Actividad:** inspecciona los datos utilizados y sigue el recorrido de la sesión.

[Guía del tutorial](../README.md) · [Conectar cuentas](../docs/conectar-cuentas.md) · [Comandos originales](../docs/scripts.md)

`npm test` verifica las integraciones con APIs simuladas. `npm run dev` reinicia el servidor al cambiar su código; recarga el navegador para ver los cambios visuales. Si el puerto está ocupado, usa `PORT=4174 npm start`.

`.env`, `.private/` y `output/` son privados y se ignoran en Git. Para otro proyecto, issue o acuerdo inicial usa otra copia de la demo.
