#!/usr/bin/env bash
#
# Comando de PRODUCCION (no forma parte del harness ni de la demo).
#
# Deja todo como al empezar:
#   1. borra la copia sin harness que creo sin-harness.sh, si existe;
#   2. restaura demo/ a su estado inicial.
#
# Cuando hace falta cada cosa:
#   - Despues del PRIMER recorrido solo hace falta (1): ese recorrido ocurre en la
#     copia de afuera y demo/ no se toca. Igual puedes correrlo entero, es inofensivo.
#   - Despues de un recorrido CON harness si hace falta (2): ahi el agente si edito
#     archivos dentro de demo/.
#
# Este script borra archivos, asi que esta escrito a la defensiva:
#   - Lo que va a borrar se imprime ANTES de borrarlo.
#   - Todo lo destructivo dentro del repo va acotado a demo/ con pathspec.
#   - Si al final demo/ no quedo limpia, sale con error en vez de dar por buena la toma.
#
# OJO: descarta CUALQUIER cambio sin commitear dentro de demo/, no solo lo que haya
# hecho el agente. Si estas editando la demo, commitea antes de correr esto o perderas
# el trabajo. Es el comportamiento correcto para una restauracion, pero muerde: me paso
# mientras escribia estos mismos comentarios.

set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
demo="$root/demo"

if ! git -C "$root" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Esto no es un repositorio Git. reset.sh restaura con Git, asi que no puede seguir." >&2
  exit 1
fi

# 1. La copia de afuera. Misma guardia que en sin-harness.sh: solo borramos algo que
#    de verdad sea una copia nuestra.
repo_root="$(git -C "$root" rev-parse --show-toplevel)"
copia="$(dirname "$repo_root")/orders-app"

if [ -e "$copia" ]; then
  if [ -f "$copia/src/csv.js" ] && [ ! -d "$copia/.git" ]; then
    echo "Elimino la copia sin harness:"
    echo "  $copia"
    rm -rf "$copia"
    echo
  else
    echo "AVISO: $copia existe pero no parece una copia de esta demo. No la toco." >&2
    echo
  fi
fi

# 2. demo/, dentro del repositorio.
#
# -n = dry run. Preguntamos primero que archivos sin rastrear hay (los que creo el
# agente: tests propios, notas, scratch) para poder mostrarlos antes de borrarlos.
sin_rastrear="$(git -C "$root" clean -nd -- "$demo")"

if [ -n "$sin_rastrear" ]; then
  echo "Archivos sin rastrear dentro de demo/ que se van a eliminar:"
  echo "$sin_rastrear" | sed 's/^/  /'
  echo
fi

# Dos operaciones distintas, las dos limitadas a demo/ por el pathspec tras el --:
#   restore  devuelve los archivos RASTREADOS a como estaban.
#   clean    elimina los archivos SIN RASTREAR, que restore no toca.
git -C "$root" restore -- "$demo"
git -C "$root" clean -fdq -- "$demo"

echo "demo/ restaurada: misma app incorrecta, harness disponible."
echo

# Comprobacion final. Sin esto, un fallo silencioso significaria grabar el siguiente
# recorrido sobre un estado contaminado por el anterior, y el video mentiria.
estado="$(git -C "$root" status --short -- "$demo")"
if [ -n "$estado" ]; then
  echo "AVISO: demo/ no quedo limpia:" >&2
  echo "$estado" | sed 's/^/  /' >&2
  exit 1
fi

echo "Comprobado: no quedan cambios pendientes en demo/."
