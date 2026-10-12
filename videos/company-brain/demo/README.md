# Demo visual de Company Brain

Con **Node.js ≥22.13**, completa las conexiones siguiendo la [guía](../docs/conectar-cuentas.md) y ejecuta desde esta carpeta:

```bash
cp -n .env.example .env
# Completa .env. Si utilizas nvm: nvm use
npm start
```

Abre **http://127.0.0.1:4173**. En **Proyectos y filtros**, crea un proyecto con su issue de GitHub y añade correos o dominios. En **Conexiones**, autoriza Gmail, asigna cualquier correo con varias coincidencias y captura el acuerdo inicial. Después busca solicitudes y revisa la evidencia antes de publicar un comentario.

**EN / ES** cambia el idioma. La interfaz usa exclusivamente tus datos y muestra un error cuando faltan variables. Las credenciales se leen del entorno o `.env`; tras editarlas, reinicia el servidor.

SQLite conserva proyectos, filtros, acuerdos, asignaciones y propuestas en `.private/company-brain.sqlite`. Puedes gestionar varios proyectos sin duplicar la demo. `.env`, `.private/` y `output/` son privados y se ignoran en Git.

[Guía del tutorial](../README.md) · [Conectar cuentas](../docs/conectar-cuentas.md) · [Comandos originales](../docs/scripts.md)

`npm test` y `npm run test:fixture` validan el código con datos aislados. `npm run preview` abre la misma interfaz con datos reales. `npm run dev` reinicia el servidor al cambiar su código. Si el puerto está ocupado, usa `PORT=4174 npm start`.
