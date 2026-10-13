import { createHash } from "node:crypto";

/** Conserva la serialización original: cambiarla invalidaría fuentes y propuestas ya guardadas. */
export const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
