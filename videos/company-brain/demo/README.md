# Demo visual de Company Brain

Con **Node.js ≥22**, completa el entorno siguiendo la [guía de conexión](../docs/conectar-cuentas.md) y ejecuta desde esta carpeta:

```bash
cp -n .env.example .env
# Completa .env antes de iniciar.
npm start
```

Abre **http://127.0.0.1:4173**. La interfaz usa Gmail, GitHub y el modelo configurado; muestra un error si faltan variables. Para cambiar la configuración, edita el entorno o `.env` y reinicia el servidor.

En **Conexiones**, autoriza Gmail y captura el correo del acuerdo inicial. Después busca solicitudes y revisa la evidencia antes de publicar un comentario. **Fuentes de contexto** y **Actividad** permiten seguir el recorrido.

**EN / ES** cambia el idioma y recuerda tu elección. Las fuentes y los comentarios conservan su texto original.

[Guía del tutorial](../README.md) · [Conectar cuentas](../docs/conectar-cuentas.md) · [Comandos originales](../docs/scripts.md)

`npm test` y `npm run test:fixture` usan datos aislados para validar el código. `npm run preview` abre la misma interfaz con datos reales. `npm run dev` reinicia el servidor al cambiar su código. Si el puerto está ocupado, usa `PORT=4174 npm start`.

`.env`, `.private/` y `output/` son privados y se ignoran en Git. Para otro proyecto, issue o acuerdo inicial usa otra copia de la demo.
