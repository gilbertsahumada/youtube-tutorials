# Reglas del repositorio

Este repositorio publica los recursos de los videos de IA en Producción. Antes de agregar o reorganizar un tutorial, demo o recurso, lee y aplica [add-video-resource](.agents/skills/add-video-resource/SKILL.md).

## Carpetas y README obligatorios

- Cada tema vive en `videos/<slug>/` y siempre incluye un `README.md` para quien quiere entender y reproducir el video desde un checkout limpio.
- Reutiliza la carpeta del tema cuando una continuación comparte recursos. No crees otro repositorio de GitHub ni dupliques el tema para separar un video conceptual de su demo, salvo solicitud expresa.
- Cada demo ejecutable en una subcarpeta incluye su propio `README.md` con requisitos, instalación, configuración y ejecución desde esa carpeta. Enlázalo desde el README del tema.
- El README explica el resultado, requisitos y versiones mínimas, comandos en orden con su directorio, variables necesarias sin valores privados, cómo comprobar el resultado, problemas frecuentes y documentación oficial relevante. El código y los comandos deben coincidir con los archivos entregados.
- Los guiones, timestamps, instrucciones de cámara y chuletas pueden vivir en `GUION.md` y `CHULETA.md`. No sustituyen al README público ni a las instrucciones para ejecutar la demo.
- Actualiza el árbol y el índice de videos del README raíz. Conserva la numeración existente, agrega la siguiente disponible y escribe `Por agregar` cuando no haya una URL publicada confirmada.
- Escribe los recursos para lectores en español claro. Respeta las restricciones de lenguaje y herramientas del tutorial; la demo de Cloudflare Workers usa TypeScript en las tres etapas.

## Validación y publicación

- Comprueba la instalación y los comandos adecuados al cambio. Distingue pruebas realizadas, resultados esperados y pasos que requieren una cuenta o recursos externos.
- Conserva los lockfiles de las demos. Excluye `node_modules`, estado local, archivos temporales, secretos y configuraciones privadas. Los ejemplos de variables contienen solo valores de ensayo.
- Antes de publicar, revisa el diff y los enlaces relativos. No incluyas archivos ajenos a la tarea, capturas o PDFs internos sin autorización.
- Trabaja en una rama `codex/<tema>` y prepara el PR desde la base correcta, sin arrastrar commits de otro tema. Haz push y abre el PR cuando esté autorizado; no lo mezcles automáticamente.
- No afirmes que un recurso ya está publicado, desplegado o disponible en la academia si todavía no lo está. Informa el resultado real de la validación y el enlace del PR cuando exista.

## Reglas para borrar worktrees

- Un subagente que trabaja en un worktree nunca debe borrarlo. Debe dejarlo intacto e informar su ruta al agente principal.
- El agente principal debe pedir confirmación antes de `git worktree remove` si su directorio actual está dentro de un worktree.
- Desde la raíz del repositorio, el agente principal puede limpiar únicamente los worktrees que él mismo creó; nunca los de otros trabajos.

Los worktrees pueden contener trabajo en curso. No borres el checkout que estás usando ni asumas que otro trabajo ya terminó.
