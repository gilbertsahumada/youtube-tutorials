export interface Report {
  id: string;
  message: string;
  context: string;
}

export type Route = 'investigar_fallo' | 'pedir_informacion';
export type Destination = 'pendiente_de_investigacion' | 'pendiente_de_informacion' | 'revision_manual';
export interface ChoiceQuestion {
  type: 'choice';
  instructions: string;
  criteria: Record<Route, string>;
}
export interface ScoreQuestion {
  type: 'score';
  instructions: string;
  criteria: string[];
}
export interface JevRequest {
  model: string;
  state: { mensaje: string; contexto: string };
  questions: { ruta: ChoiceQuestion; impacto?: ScoreQuestion };
}
export interface ChoiceAnswer {
  type: 'choice';
  choice: Route;
  confidence: number;
  probabilities: Record<Route, number>;
}
export interface ScoreAnswer {
  type: 'score';
  score: number;
  confidence: number;
  probabilities: Record<string, number>;
}
export interface JevResult {
  model: string;
  answers: { ruta: ChoiceAnswer; impacto?: ScoreAnswer };
  usage?: { input_tokens: number; output_tokens: number };
}
export interface Attempt {
  status: number | null;
  elapsedMs: number;
  retryDelayMs: number;
}
export interface RunRecord {
  report: Report;
  request: JevRequest;
  rawResult: unknown;
  result: JevResult | null;
  destination: Destination;
  error: string | null;
  elapsedMs: number;
  attempts: Attempt[];
}
export interface BatchSummary {
  total: number;
  successes: number;
  failures: number;
  httpAttempts: number;
  retries: number;
  wallMs: number;
  successfulReportsPerSecond: number;
  latencyMs: { min: number; p50: number; p95: number; max: number; mean: number } | null;
  models: string[];
  inputTokens: number;
  outputTokens: number;
}
