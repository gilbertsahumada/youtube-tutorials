import type { BatchSummary, JevRequest, Report, RunRecord } from '../domain/types.ts';
import type { Progress } from '../services/batch.ts';
import { formatJson } from './json.ts';

export function showCases(reports: Report[]) {
  for (const report of reports) {
    console.log(`\n[${report.id}] ${report.message}`);
    console.log(`    ${report.context}`);
  }
}

export function showRequest(report: Report, request: JevRequest) {
  console.log(`\nREPORTE ${report.id} · solicitud que se envía a Jev`);
  console.log(formatJson(request));
}

export function showResult(record: RunRecord) {
  console.log(`\nREPORTE ${record.report.id} · ${record.elapsedMs.toFixed(0)} ms · ${record.attempts.length} intento(s) HTTP`);
  if (record.error) console.log(`Error: ${record.error}`);
  else {
    console.log(formatJson(record.result?.answers));
    console.log(`Modelo recibido: ${record.result?.model}`);
  }
  console.log(`Destino que aplica nuestro código: ${record.destination}`);
}

export function showProgress(progress: Progress) {
  const line = `Procesados ${progress.completed}/${progress.total} | errores ${progress.failures} | ${(progress.elapsedMs / 1000).toFixed(2)} s`;
  if (process.stdout.isTTY) process.stdout.write(`\r\u001b[2K${line}${progress.completed === progress.total ? '\n' : ''}`);
  else if (progress.completed % 10 === 0 || progress.completed === progress.total) console.log(line);
}

export function showSummary(summary: BatchSummary, concurrency: number) {
  console.log('\nRESUMEN DE ESTA EJECUCIÓN');
  console.table([{
    reportes: summary.total, exitosos: summary.successes, errores: summary.failures,
    concurrencia: concurrency, intentos_HTTP: summary.httpAttempts, reintentos: summary.retries,
    tiempo_total_s: (summary.wallMs / 1000).toFixed(3),
    exitosos_por_segundo: summary.successfulReportsPerSecond.toFixed(2),
  }]);
  if (summary.latencyMs) {
    console.table([Object.fromEntries(Object.entries(summary.latencyMs).map(([key, value]) => [`${key}_ms`, value.toFixed(0)]))]);
  } else console.log('No hubo respuestas válidas; no se calculan percentiles de éxito.');
  console.log('Tiempo total de pared: red + reintentos + validación + progreso, antes de guardar el archivo.');
  console.log('Latencias: solo solicitudes exitosas, con reintentos y sin espera en cola. No es tiempo aislado de inferencia.');
  console.log(`Modelos recibidos: ${summary.models.join(', ') || 'ninguno'}`);
  if (summary.models.length > 1) console.log('Hay varias versiones recibidas; tenlo en cuenta al comparar resultados.');
  console.log(`Tokens informados por respuestas válidas: entrada ${summary.inputTokens}, salida ${summary.outputTokens}.`);
}

export function showHelp() {
  console.log(`
JEV · Laboratorio por terminal

  casos                         Ver los tres reportes iniciales
  ver 1                         Ver el JSON exacto sin enviarlo
  preguntas                     Ver las preguntas y criterios activos
  1 / 2 / 3                     Enviar un reporte y ver su respuesta
  enviar 1 2 3                  Enviar varios, uno tras otro
  comparar                      Enviar 1 y 2: mismo mensaje, otro contexto
  nuevo                         Escribir mensaje y contexto (modo interactivo)
  impacto si / impacto no       Añadir o quitar Score (inicia desactivado)
  datos                         Ver una muestra del lote sintético
  lote 100 8                    Enviar 100 reportes, hasta 8 simultáneos
  ultimo                        Ver el registro completo de la última ejecución
  ayuda / salir

También: npm run demo -- enviar 1 2 3 --impacto
         npm run demo -- lote --cantidad 100 --concurrencia 8 --impacto
Solo ver entradas no consume la API. Enviar y lote hacen llamadas reales.
`);
}
