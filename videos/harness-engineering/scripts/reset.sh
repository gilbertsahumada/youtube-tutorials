#!/usr/bin/env bash
#
# Comando de PRODUCCION (no forma parte del harness ni de la demo).
#
# Devuelve demo/ a su estado inicial: la app incorrecta Y el harness disponible.
# Es lo que se ejecuta entre recorrido y recorrido, y para repetir una toma.
#
# Este script borra archivos, asi que esta escrito a la defensiva:
#   - Todo va acotado a demo/ con pathspec. El resto del repositorio no se toca nunca.
#   - Lo que se va a borrar se imprime ANTES de borrarlo.
#   - Si al final demo/ no quedo limpia, sale con error en vez de dar por buena la toma.
#
# OJO: esto descarta CUALQUIER cambio sin commitear dentro de demo/, no solo lo que
# haya hecho el agente. Si estas editando la demo, commitea antes de correr esto o
# perderas el trabajo. Es el comportamiento correcto para una restauracion, pero
# muerde: me paso mientras escribia estos mismos comentarios.

set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
demo="$root/demo"

# La restauracion se apoya enteramente en Git: si esto no es un repositorio, no hay
# estado inicial al que volver y seguir solo destruiria trabajo.
if ! git -C "$root" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Esto no es un repositorio Git. reset.sh restaura con Git, asi que no puede seguir." >&2
  exit 1
fi

# -n = dry run. Preguntamos primero que archivos sin rastrear hay dentro de demo/
# (los que creo el agente: tests propios, notas, scratch) para poder mostrarlos.
sin_rastrear="$(git -C "$root" clean -nd -- "$demo")"

if [ -n "$sin_rastrear" ]; then
  echo "Archivos sin rastrear que creo el agente y que se van a eliminar:"
  echo "$sin_rastrear" | sed 's/^/  /'
  echo
fi

# Dos operaciones distintas, las dos limitadas a demo/ por el pathspec tras el --:
#   restore  devuelve los archivos RASTREADOS a como estaban (deshace las ediciones
#            del agente y recupera lo que borro sin-harness.sh).
#   clean    elimina los archivos SIN RASTREAR, que restore no toca.
git -C "$root" restore -- "$demo"
git -C "$root" clean -fdq -- "$demo"

echo "demo/ restaurada: misma app incorrecta, harness disponible."
echo

# Comprobacion final. Sin esto, un fallo silencioso significaria grabar el segundo
# recorrido sobre un estado contaminado por el primero, y el video mentiria.
estado="$(git -C "$root" status --short -- "$demo")"
if [ -n "$estado" ]; then
  echo "AVISO: demo/ no quedo limpia:"
  echo "$estado" | sed 's/^/  /'
  exit 1
fi

echo "Comprobado: no quedan cambios pendientes en demo/."
