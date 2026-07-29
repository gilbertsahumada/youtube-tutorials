import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const input = await new Promise((resolveInput) => {
  let value = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    value += chunk;
  });
  process.stdin.on("end", () => resolveInput(value));
});

let event = {};
try {
  event = input ? JSON.parse(input) : {};
} catch {
  process.stderr.write("El Stop hook recibió JSON inválido.\n");
  process.exit(1);
}

const demoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const verification = spawnSync("npm", ["run", "verify"], {
  cwd: demoRoot,
  encoding: "utf8",
});

if (verification.status === 0) {
  process.exit(0);
}

if (event.stop_hook_active === true) {
  process.stderr.write(
    "La verificación sigue fallando después de la continuación del hook. Se permite detenerse para evitar un loop infinito.\n",
  );
  process.exit(0);
}

const output = [verification.stdout, verification.stderr].filter(Boolean).join("\n").trim();
process.stderr.write(
  `La tarea todavía no está terminada: npm run verify falló.\n\n${output}\n\nCorrige la implementación sin modificar tests, datos de ejemplo ni documentación, y vuelve a ejecutar la verificación.\n`,
);
process.exit(2);
