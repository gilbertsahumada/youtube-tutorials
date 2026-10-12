export const requiredFields = [
  "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GMAIL_LABEL", "GMAIL_AFTER",
  "MODEL_BASE_URL", "MODEL_ID", "MODEL_API_KEY",
];

// Only names and validation messages leave the server; credentials stay in env.
export function environmentStatus(env) {
  const missing = requiredFields.filter(key => typeof env[key] !== "string" || !env[key].trim());
  const errors = [];
  const invalid = (field, message) => errors.push({ field, message });
  if (env.GMAIL_AFTER && !Number.isFinite(Date.parse(env.GMAIL_AFTER))) invalid("GMAIL_AFTER", "GMAIL_AFTER debe ser una fecha ISO válida anterior al primer correo.");
  if (env.MODEL_BASE_URL) {
    try {
      const url = new URL(env.MODEL_BASE_URL);
      if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw Error();
    } catch { invalid("MODEL_BASE_URL", "MODEL_BASE_URL debe ser HTTPS sin credenciales ni parámetros."); }
  }
  for (const field of requiredFields) {
    if (env[field] && /[\r\n\0]/.test(env[field])) invalid(field, "La variable no puede contener saltos de línea.");
  }
  const valid = keys => !keys.some(key => missing.includes(key) || errors.some(error => error.field === key));
  return {
    ready: missing.length === 0 && errors.length === 0,
    missing, errors,
    error: missing.length ? `Faltan variables de entorno: ${missing.join(", ")}.` : errors.length ? "Hay variables de entorno inválidas. Corrige el archivo .env y reinicia el servidor." : null,
    connections: {
      gmail: valid(["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GMAIL_LABEL", "GMAIL_AFTER"]),
      model: valid(["MODEL_BASE_URL", "MODEL_ID", "MODEL_API_KEY"]),
    },
  };
}
