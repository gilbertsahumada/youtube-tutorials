import { privatePath, readJson } from "./common.mjs";
import { matchesSender, normalizeFilter } from "./filters.mjs";
import { normalizeAfter, normalizeLabel } from "./mail-settings.mjs";

export function mailbox(header) {
  if (header.includes(",") || (header.match(/</g) || []).length > 1)
    throw Error("Remitente ambiguo");
  const match = header.match(/<([^<>]+)>\s*$/);
  if (match && header.slice(0, match.index).includes("@"))
    throw Error("Remitente ambiguo");
  const address = (match ? match[1] : header).trim().toLowerCase();
  if (!/^[^\s<>@,]+@[^\s<>@,]+\.[^\s<>@,]+$/.test(address))
    throw Error("Remitente ambiguo");
  return address;
}
export function plainText(payload) {
  if (payload.filename) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data)
    return Buffer.from(payload.body.data, "base64url").toString("utf8");
  return (payload.parts || [])
    .filter((p) => !p.filename)
    .map(plainText)
    .filter(Boolean)
    .join("\n");
}
export async function gmailClient(env = process.env) {
  const token = await readJson(privatePath("gmail-token.json"));
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    signal: AbortSignal.timeout(30000),
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID || "",
      client_secret: env.GOOGLE_CLIENT_SECRET || "",
      refresh_token: token.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok)
    throw Error(
      `Refresh OAuth: HTTP ${response.status}. Reautoriza Gmail si el token expiró.`,
    );
  const { access_token } = await response.json();
  return async (path, params = {}) => {
    const url = new URL(
      `https://gmail.googleapis.com/gmail/v1/users/me/${path}`,
    );
    url.search = new URLSearchParams(params).toString();
    const res = await fetch(url, {
      headers: { authorization: `Bearer ${access_token}` },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw Error(`Gmail respondió HTTP ${res.status}`);
    return res.json();
  };
}
export async function getEmails({ env = process.env, api, filters = env.ALLOWED_SENDER, after = env.GMAIL_AFTER, label = env.GMAIL_LABEL || "" } = {}) {
  const rules = typeof filters === "string" ? [normalizeFilter("email", filters)] : (filters || []).map(rule => normalizeFilter(rule.kind, rule.value));
  if (!rules.length) throw Error("Añade al menos un correo o dominio a este proyecto.");
  // Quoted values cannot inject Gmail search operators. Quoted local parts are unsupported.
  if (rules.some(rule => /["\\]/.test(rule.value))) throw Error("Correo inválido.");
  const since = Date.parse(normalizeAfter(after));
  const labelName = normalizeLabel(label);
  const senders = [...new Set(rules.map(rule => `from:"${rule.kind === "domain" ? "@" : ""}${rule.value}"`))];
  const query = `after:${Math.floor(since / 1000) - 1} {${senders.join(" ")}}`;
  api ||= await gmailClient(env);
  let labelId;
  if (labelName) {
    const labels = await api("labels");
    labelId = labels.labels?.find(item => item.name === labelName)?.id;
    if (!labelId) throw Error("La etiqueta del proyecto no existe en Gmail. Créala o deja la etiqueta vacía en Proyectos y filtros.");
  }
  const ids = [];
  let pageToken = "";
  do {
    const page = await api("messages", {
      ...(labelId ? { labelIds: labelId } : {}),
      q: query,
      maxResults: "100",
      ...(pageToken ? { pageToken } : {}),
    });
    ids.push(...(page.messages || []));
    pageToken = page.nextPageToken || "";
    if (ids.length > 500)
      throw Error(
        "Más de 500 correos: acota los participantes, la fecha o la etiqueta del proyecto.",
      );
  } while (pageToken);
  const emails = [];
  for (const { id } of ids) {
    const mail = await api(`messages/${encodeURIComponent(id)}`, {
      format: "full",
    });
    const header = (name) =>
      mail.payload.headers.find((x) => x.name.toLowerCase() === name)?.value ||
      "";
    let from;
    try {
      from = mailbox(header("from"));
    } catch {
      continue;
    }
    if (!matchesSender(from, rules)) continue;
    const text = plainText(mail.payload);
    if (!text || text.length > 20000 || !Number.isFinite(Number(mail.internalDate)) || Number(mail.internalDate) < since)
      continue;
    emails.push({
      id,
      from,
      subject: header("subject"),
      date: new Date(Number(mail.internalDate)).toISOString(),
      text,
    });
  }
  return emails.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}
