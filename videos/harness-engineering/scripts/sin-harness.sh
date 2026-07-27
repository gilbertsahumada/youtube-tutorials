#!/usr/bin/env bash
#
# Comando de PRODUCCION (no forma parte del harness ni de la demo).
#
# Deja demo/ como la ve el agente en el PRIMER recorrido: la app incorrecta y nada mas.
#
# Por que existe: hacer esto a mano eran tres comandos, y restaurarlo cuatro mas, dos
# veces por grabacion. Es plomeria que no ensena nada y que hay que narrar en camara.
#
# Por que vive FUERA de demo/: si estuviera dentro, o declarado en demo/package.json,
# el agente lo veria durante el primer recorrido y descubriria que aqui hubo un harness.
# Todo lo que el agente no debe saber tiene que vivir en este nivel, no en el suyo.

set -euo pipefail

# Resolvemos rutas desde la ubicacion del script, no desde el cwd: asi funciona igual
# lo llames desde donde lo llames.
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
demo="$root/demo"

# Guardia: si no encontramos la app, algo esta mal y es mejor no borrar nada.
if [ ! -d "$demo/src" ]; then
  echo "No encuentro $demo/src. ¿Estas en videos/harness-engineering?" >&2
  exit 1
fi

cd "$demo"

# Las cuatro piezas del harness, mas el README.
#
# El README se borra por una razon concreta: describe el harness completo Y apunta a
# ../evaluation/evaluate.mjs, o sea al archivo donde viven los seis criterios. Dejarlo
# seria entregarle el mapa al agente.
rm -f AGENTS.md CLAUDE.md README.md

# Carpetas ENTERAS, no solo sus subcarpetas: borrar unicamente docs/harness y
# scripts/harness dejaba docs/ y scripts/ vacios pero existentes, visibles en camara
# y pista evidente de que ahi habia algo.
rm -rf docs scripts test

# Y los comandos del harness en el package.json de la demo, que tambien lo delatarian.
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
