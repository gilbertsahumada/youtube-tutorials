import type { JevRequest, JevResult } from './types.ts';

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const probability = (value: unknown) => finite(value) && value >= 0 && value <= 1;

function distribution(value: unknown, keys: string[]): boolean {
  return object(value) && Object.keys(value).length === keys.length
    && keys.every(key => Object.hasOwn(value, key) && probability(value[key]))
    && Math.abs(Object.values(value).reduce<number>((sum, n) => sum + (n as number), 0) - 1) <= 0.02;
}

export function validateResult(value: unknown, request: JevRequest): JevResult {
  if (!object(value) || typeof value.model !== 'string' || !value.model.trim() || !object(value.answers)) {
    throw new Error('Faltan el modelo o las respuestas.');
  }
  const route = value.answers.ruta;
  const options = Object.keys(request.questions.ruta.criteria);
  if (!object(route) || route.type !== 'choice' || typeof route.choice !== 'string'
      || !options.includes(route.choice) || !probability(route.confidence)
      || !distribution(route.probabilities, options)) {
    throw new Error('Ruta, confianza o probabilidades inválidas.');
  }
  if (request.questions.impacto) {
    const score = value.answers.impacto;
    const levels = request.questions.impacto.criteria.map((_, i) => String(i));
    if (!object(score) || score.type !== 'score' || !finite(score.score)
        || score.score < 0 || score.score > levels.length - 1
        || !probability(score.confidence) || !distribution(score.probabilities, levels)) {
      throw new Error('Impacto o distribución fuera de la escala solicitada.');
    }
  }
  if (value.usage !== undefined && (!object(value.usage)
      || !Number.isInteger(value.usage.input_tokens) || (value.usage.input_tokens as number) < 0
      || !Number.isInteger(value.usage.output_tokens) || (value.usage.output_tokens as number) < 0)) {
    throw new Error('Uso de tokens inválido.');
  }
  return value as unknown as JevResult;
}
