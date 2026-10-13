import { english } from "./messages.js";
export { english };
export const locales = { es: "es-CO", en: "en-US" };
export const languageKey = "company-brain-language";

// Traducimos únicamente la interfaz; las citas y fuentes permanecen literales.

const patterns = [
  [
    /^El cliente solicita (\w+), pero la tarea sigue planificada en (\w+)\.$/,
    (_, to, from) => `The client requests ${to}, while the task is still planned as ${from}.`,
  ],
  [/^Proponer (\w+) en lugar de (\w+)$/, (_, to, from) => `Propose ${to} instead of ${from}`],
  [/^Issue #(\d+) · Portal del cliente$/, (_, number) => `Issue #${number} · Customer portal`],
  [/^Tarea en GitHub · Issue #(\d+)$/, (_, number) => `GitHub task · Issue #${number}`],
  [
    /^Acuerdo (\w+) · Issue #(\d+)\. Este contexto se conserva para comparar nuevas solicitudes\.$/,
    (_, format, number) =>
      `Agreement ${format} · Issue #${number}. This context is saved to compare new requests.`,
  ],
  [/^GitHub conectado como (.+)\.$/, (_, login) => `GitHub connected as ${login}.`],
  [
    /^Faltan variables de entorno: (.+)\.$/,
    (_, fields) => `Missing environment variables: ${fields}.`,
  ],
  [/^Completa la configuración: (.+)\.$/, (_, fields) => `Complete the settings: ${fields}.`],
  [
    /^Correo e issue coinciden en (\w+)\.$/,
    (_, format) => `Email and issue both specify ${format}.`,
  ],
  [
    /^(\w+) a (\w+)\. Pendiente de revisión\.$/,
    (_, from, to) => `${from} to ${to}. Awaiting review.`,
  ],
  [
    /^Issue #(\d+)\. El cambio sigue pendiente de decisión humana\.$/,
    (_, number) => `Issue #${number}. The change still awaits a human decision.`,
  ],
  [/^Falta (\w+)$/, (_, key) => `Missing ${key}`],
  [
    /^(Gmail|OAuth) respondió HTTP (\d+)$/,
    (_, service, status) => `${service} returned HTTP ${status}`,
  ],
  [/^Issue no relacionado: falta (.+)$/, (_, line) => `Unrelated issue: missing ${line}`],
  [
    /^La evidencia debe mencionar el formato (\w+)$/,
    (_, format) => `Evidence must mention the ${format} format`,
  ],
  [/^Contexto incorrecto: (\w+)$/, (_, key) => `Incorrect context: ${key}`],
];

export function readLanguage(storage) {
  try {
    return storage?.getItem(languageKey) === "en" ? "en" : "es";
  } catch {
    return "es";
  }
}

export function saveLanguage(storage, language) {
  try {
    storage?.setItem(languageKey, language === "en" ? "en" : "es");
  } catch {
    /* El cambio de idioma sigue funcionando si el navegador bloquea el almacenamiento. */
  }
}

export function translate(value, language) {
  if (language !== "en") return value;
  const key = value.trim().replace(/\s+/g, " ");
  let translated = Object.hasOwn(english, key) ? english[key] : undefined;
  if (translated === undefined) {
    for (const [pattern, format] of patterns) {
      const match = key.match(pattern);
      if (match) {
        translated = format(...match);
        break;
      }
    }
  }
  if (translated === undefined) return value;
  return (
    value.slice(0, value.length - value.trimStart().length) +
    translated +
    value.slice(value.trimEnd().length)
  );
}
