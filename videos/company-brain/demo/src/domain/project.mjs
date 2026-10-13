import { randomUUID } from "node:crypto";
import { normalizeAfter, normalizeLabel } from "../mail-settings.mjs";

const projectFields = [
  "id",
  "name",
  "repository",
  "gmailAfter",
  "gmailLabel",
  "autoEnabled",
  "pollSeconds",
];
/** Valida y normaliza la configuración pública; las credenciales nunca pertenecen al proyecto.
 * @param {Partial<import("../contracts.mjs").Project>} input
 * @returns {import("../contracts.mjs").Project}
 */
export function validateProject(input) {
  if (
    !input ||
    typeof input !== "object" ||
    Object.keys(input).some((key) => !projectFields.includes(key))
  )
    throw Error("Campo de proyecto inválido.");
  if (
    typeof input.name !== "string" ||
    !input.name.trim() ||
    input.name.length > 120 ||
    /[\r\n\0]/.test(input.name)
  )
    throw Error("Nombre de proyecto inválido.");
  if (
    typeof input.repository !== "string" ||
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(input.repository)
  )
    throw Error("El repositorio debe ser owner/repo.");
  const slug =
    input.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 55) || "proyecto";
  const id = input.id ?? slug + "-" + randomUUID().slice(0, 8);
  if (typeof id !== "string" || !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(id))
    throw Error("Identificador de proyecto inválido.");
  const autoEnabled = input.autoEnabled ?? false;
  const pollSeconds = input.pollSeconds ?? 60;
  if (typeof autoEnabled !== "boolean") throw Error("Seguimiento automático inválido.");
  if (!Number.isInteger(pollSeconds) || pollSeconds < 30 || pollSeconds > 3600)
    throw Error("El intervalo debe estar entre 30 y 3600 segundos.");
  return {
    id,
    name: input.name.trim(),
    repository: input.repository,
    gmailAfter: normalizeAfter(input.gmailAfter ?? new Date().toISOString()),
    gmailLabel: normalizeLabel(input.gmailLabel),
    autoEnabled,
    pollSeconds,
  };
}
