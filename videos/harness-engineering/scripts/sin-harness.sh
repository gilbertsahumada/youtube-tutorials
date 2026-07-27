#!/usr/bin/env bash
#
# Comando de PRODUCCION (no forma parte del harness ni de la demo).
#
# Crea una copia limpia de la app FUERA del repositorio, para el primer recorrido:
# la implementacion incorrecta y nada mas.
#
# Por que fuera del repo, y no borrando los archivos dentro de demo/:
#
#   La primera version de este script borraba el harness dentro de demo/. Parecia
#   suficiente y no lo era. Al agente le bastaba un `git status` para ver los nombres
#   de todo lo borrado —incluido docs/product/export-orders.md, que es justo donde
#   viven los seis criterios— y con `git show HEAD:...` podia leerlos completos.
#   No es teorico: un agente lo detecto y lo reporto en su respuesta.
#
#   Copiando fuera del repositorio no hay .git que consultar, no hay carpeta padre
#   con el evaluador, y demo/ ni siquiera se toca.
#
# La copia se llama "orders-app" a proposito. El agente ve el nombre de su propio
# directorio de trabajo, asi que no puede decir "harness" ni "demo" ni "sin-harness".

set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
demo="$root/demo"

if [ ! -d "$demo/src" ]; then
  echo "No encuentro $demo/src. ¿Estas en videos/harness-engineering?" >&2
  exit 1
fi

# La copia vive junto al repositorio clonado, nunca dentro.
repo_root="$(git -C "$root" rev-parse --show-toplevel)"
out="$(dirname "$repo_root")/orders-app"

# Guardia: "orders-app" es un nombre generico y esto hace rm -rf. Solo borramos si
# la carpeta es una copia nuestra; si es cualquier otra cosa, paramos.
if [ -e "$out" ]; then
  if [ ! -f "$out/src/csv.js" ] || [ -d "$out/.git" ]; then
    echo "Ya existe $out y no parece una copia de esta demo." >&2
    echo "No la voy a borrar. Muevela o renombrala y vuelve a intentar." >&2
    exit 1
  fi
  rm -rf "$out"
fi

mkdir -p "$out"

# Solo la app: el manifiesto y el codigo. Nada del harness.
cp "$demo/package.json" "$out/package.json"
cp -R "$demo/src" "$out/src"

cd "$out"

# El package.json copiado todavia declara los comandos del harness y se llama
# "harness-engineering-demo". Las dos cosas delatan el montaje.
npm pkg delete scripts.harness:start scripts.verify >/dev/null
npm pkg set name=orders-app >/dev/null

echo "Copia limpia creada en:"
echo "  $out"
echo
echo "Esto es todo lo que ve el agente:"
for entry in $(ls -A); do
  echo "  $entry"
done
echo
echo "Sin .git, sin carpeta padre con el evaluador. demo/ quedo intacta."
echo
echo "Abre el agente EN ESA CARPETA y dale la tarea."
echo "Cuando termine:  node evaluation/evaluate.mjs \"$out\""
echo "Para limpiar:    npm run demo:reset"
