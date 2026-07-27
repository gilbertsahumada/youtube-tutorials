#!/usr/bin/env bash
# Deja demo/ como la ve el agente en el PRIMER recorrido: la app incorrecta y nada mas.
#
# Este script vive FUERA de demo/ a proposito. Si estuviera dentro (o declarado en
# demo/package.json), el agente lo veria y descubriria que aqui hubo un harness.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
demo="$root/demo"

if [ ! -d "$demo/src" ]; then
  echo "No encuentro $demo/src. ¿Estas en videos/harness-engineering?" >&2
  exit 1
fi

cd "$demo"

rm -f AGENTS.md CLAUDE.md README.md
rm -rf docs scripts test
npm pkg delete scripts.harness:start scripts.verify >/dev/null

echo "Harness oculto."
echo
echo "Esto es todo lo que ve el agente dentro de demo/:"
for entry in $(ls -A); do
  echo "  $entry"
done
echo
echo "Abre el agente en demo/ y dale la tarea."
echo "Cuando termine:  node evaluation/evaluate.mjs"
echo "Para restaurar:  npm run demo:reset"
