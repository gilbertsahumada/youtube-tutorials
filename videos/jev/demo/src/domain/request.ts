import { ROUTE_QUESTION, IMPACT_QUESTION } from './questions.ts';
import type { JevRequest, Report } from './types.ts';

export function buildRequest(report: Report, model: string, impact: boolean): JevRequest {
  return {
    model,
    state: { mensaje: report.message, contexto: report.context },
    questions: {
      ruta: structuredClone(ROUTE_QUESTION),
      ...(impact ? { impacto: structuredClone(IMPACT_QUESTION) } : {}),
    },
  };
}
