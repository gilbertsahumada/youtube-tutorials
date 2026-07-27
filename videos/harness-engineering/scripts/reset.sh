#!/usr/bin/env bash
# Devuelve demo/ a su estado inicial: la app incorrecta Y el harness disponible.
#
# Todas las operaciones destructivas van acotadas a demo/ y se muestran antes de
# ejecutarse. Nunca toca el resto del repositorio.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
demo="$root/demo"

if ! git -C "$root" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Esto no es un repositorio Git. reset.sh restaura con Git, asi que no puede seguir." >&2
  exit 1
fi

sin_rastrear="$(git -C "$root" clean -nd -- "$demo")"

if [ -n "$sin_rastrear" ]; then
  echo "Archivos sin rastrear que creo el agente y que se van a eliminar:"
  echo "$sin_rastrear" | sed 's/^/  /'
  echo
fi

git -C "$root" restore -- "$demo"
git -C "$root" clean -fdq -- "$demo"

echo "demo/ restaurada: misma app incorrecta, harness disponible."
echo

estado="$(git -C "$root" status --short -- "$demo")"
if [ -n "$estado" ]; then
  echo "AVISO: demo/ no quedo limpia:"
  echo "$estado" | sed 's/^/  /'
  exit 1
fi

echo "Comprobado: no quedan cambios pendientes en demo/."
