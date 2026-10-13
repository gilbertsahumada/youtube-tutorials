import { domainToASCII } from "node:url";

export function normalizeDomain(value) {
  if (typeof value !== "string" || value.length > 254) throw Error("Dominio inválido.");
  const raw = value.trim().toLowerCase().replace(/^@/, "");
  // eslint-disable-next-line no-control-regex -- Los caracteres de control no pertenecen a un dominio.
  if (/[\s\x00-\x1f\x7f:/?#@<>\\]/.test(raw)) throw Error("Dominio inválido.");
  const domain = domainToASCII(raw);
  if (
    domain.length > 253 ||
    !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])$/.test(domain)
  )
    throw Error("Dominio inválido.");
  return domain;
}
export function normalizeEmail(value) {
  if (
    typeof value !== "string" ||
    value.length > 254 ||
    // eslint-disable-next-line no-control-regex -- Rechazamos controles antes de interpretar la dirección.
    /[\x00-\x1f\x7f"\\]/.test(value) ||
    !/^[^\s@,<>]+@[^\s@,<>]+$/.test(value.trim())
  )
    throw Error("Correo inválido.");
  const [local, domain] = value.trim().toLowerCase().split("@");
  return `${local}@${normalizeDomain(domain)}`;
}
export function normalizeFilter(kind, value) {
  if (!["email", "domain"].includes(kind)) throw Error("Tipo de filtro inválido.");
  return { kind, value: kind === "email" ? normalizeEmail(value) : normalizeDomain(value) };
}
export function matchesSender(from, rules) {
  try {
    const email = normalizeEmail(from);
    if (typeof rules === "string") return email === normalizeEmail(rules);
    return (
      Array.isArray(rules) &&
      rules.some((rule) =>
        rule.kind === "email"
          ? rule.value === email
          : rule.kind === "domain" && rule.value === email.split("@")[1],
      )
    );
  } catch {
    return false;
  }
}
// Exact addresses take precedence globally. Domains match exactly, including subdomains.
export function senderProjects(from, rules) {
  let email;
  try {
    email = normalizeEmail(from);
  } catch {
    return [];
  }
  const exact = rules.filter((rule) => rule.kind === "email" && rule.value === email);
  const matched = exact.length
    ? exact
    : rules.filter((rule) => rule.kind === "domain" && rule.value === email.split("@")[1]);
  return [...new Set(matched.map((rule) => rule.projectId))].sort();
}
