export function normalizeAfter(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value))
    throw Error("La fecha de inicio debe ser una fecha válida.");
  const timestamp = Date.parse(value);
  // Date.parse accepts impossible calendar dates, such as February 30.
  const day = value.slice(0, 10);
  if (!Number.isFinite(timestamp) || new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day)
    throw Error("La fecha de inicio debe ser una fecha válida.");
  return new Date(timestamp).toISOString();
}

export function normalizeLabel(value = "") {
  if (typeof value !== "string" || value.length > 200 || /[\r\n\0]/.test(value))
    throw Error("La etiqueta de Gmail debe ser un nombre válido de hasta 200 caracteres.");
  return value.trim();
}

// The project form selects a calendar day in UTC; CLI queries can still use a timestamp.
export const projectAfter = value => normalizeAfter(normalizeAfter(value).slice(0, 10));

export function legacyMailSettings({ GMAIL_AFTER, GMAIL_LABEL } = {}, initialEmail) {
  let gmailAfter = new Date().toISOString().slice(0, 10);
  let gmailLabel = "";
  try { gmailAfter = normalizeAfter(GMAIL_AFTER); } catch { /* Old variables are optional. */ }
  try { gmailLabel = normalizeLabel(GMAIL_LABEL); } catch { /* Invalid old labels are ignored. */ }
  gmailAfter = projectAfter(gmailAfter);
  const initialDate = Date.parse(initialEmail?.date);
  if (Number.isFinite(initialDate) && Date.parse(gmailAfter) > initialDate)
    gmailAfter = projectAfter(new Date(initialDate).toISOString());
  return { gmailAfter, gmailLabel };
}
