---
name: add-video-resource
description: Agrega o reorganiza tutoriales, demos y recursos de videos en youtube-tutorials con su README, estructura, índice y validación. Úsalo al incorporar un tema o una continuación al repositorio; no para cambios de código sin impacto en los recursos del video.
---

# Agregar un recurso de video

Aplica este flujo al repositorio `youtube-tutorials`. Las reglas compartidas están en [AGENTS.md](../../../AGENTS.md); la estructura y el índice vigentes están en el [README raíz](../../../README.md). Lee ambos antes de elegir la carpeta y la base del cambio.

## Preparar el recurso

1. Revisa el estado de Git y los recursos existentes del tema. Reutiliza su carpeta cuando corresponda; si es nuevo, usa `videos/<slug>/`. Conserva los cambios ajenos al trabajo.
2. Crea o actualiza el README del tema para quien reproduce el video desde un checkout limpio. Incluye el resultado, requisitos y versiones, configuración, comandos con su directorio, comprobación del resultado, problemas frecuentes y fuentes oficiales. No conviertas el README en una transcripción ni sustituyas la explicación por una lista de comandos.
3. Coloca la implementación ejecutable en `demo/` cuando aplique, con su README, dependencias y lockfile. Mantén los comandos de la documentación alineados con los scripts y archivos reales. Si hay etapas, identifica cuándo se reemplaza cada archivo y cómo se ejecuta cada versión.
4. Mantén los guiones y las chuletas de grabación exclusivamente en Notion. No los copies al repositorio ni al PR. El README público explica cómo reproducir la demo; describe los requisitos de cuentas y recursos externos antes del comando que los necesita.
5. Actualiza el árbol y el índice del README raíz sin alterar otras entradas ni inventar enlaces de videos pendientes.

## Comprobar y entregar

- Ejecuta las comprobaciones apropiadas sobre la carpeta entregada. Una validación histórica puede conservarse como evidencia identificada; no la presentes como una prueba nueva de archivos que cambiaron.
- Revisa que los enlaces relativos resuelvan, que los comandos partan del directorio indicado y que no se publique estado local, dependencias instaladas o secretos. Los guiones privados y PDFs ajenos no entran por accidente en el PR.
- Si la rama actual pertenece a otro tema, prepara el cambio desde la base adecuada en una rama `codex/` separada. Inspecciona el diff y agrega solo los archivos del trabajo.
- La solicitud de un recurso no autoriza por sí sola publicaciones externas. Si el usuario ya pidió el PR o autorizó la publicación, completa commit, push y creación del PR sin volver a pedir permiso. No mezcles el PR.
- Al entregar, enlaza la carpeta, el README y el PR que exista; indica qué se verificó y cualquier paso pendiente relevante.
