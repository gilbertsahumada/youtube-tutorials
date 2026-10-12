import test from 'node:test';
import assert from 'node:assert/strict';
import { english, languageKey, translate, readLanguage, saveLanguage } from '../web/i18n.js';

test('idioma: mensajes dinámicos conservan formatos, cuentas y campos de configuración', () => {
  assert.equal(translate('El cliente solicita PDF, pero la tarea sigue planificada en CSV.', 'en'), 'The client requests PDF, while the task is still planned as CSV.');
  assert.equal(translate('Proponer CSV en lugar de PDF', 'en'), 'Propose CSV instead of PDF');
  assert.equal(translate('GitHub conectado como user-name.', 'en'), 'GitHub connected as user-name.');
  assert.equal(translate('Completa la configuración: MODEL_ID, MODEL_API_KEY.', 'en'), 'Complete the settings: MODEL_ID, MODEL_API_KEY.');
  assert.equal(translate('Faltan variables de entorno: MODEL_ID, MODEL_API_KEY.', 'en'), 'Missing environment variables: MODEL_ID, MODEL_API_KEY.');
  assert.equal(translate('Faltan variables de entorno.', 'en'), 'Environment variables are missing.');
  assert.equal(translate('La URL, el modelo y la clave se leen exclusivamente en el servidor.', 'en'), 'The URL, model and key are read exclusively on the server.');
  assert.equal(translate('Issue #42. El cambio sigue pendiente de decisión humana.', 'en'), 'Issue #42. The change still awaits a human decision.');
  assert.equal(translate('Etiqueta de Gmail (opcional)', 'en'), 'Gmail label (optional)');
  assert.equal(translate('Leer correos desde (UTC)', 'en'), 'Read emails from (UTC)');
  assert.equal(translate('La fecha de inicio debe incluir el correo del acuerdo inicial.', 'en'), 'The start date must include the initial agreement email.');
});

test('idioma: texto desconocido y fuentes originales nunca se traducen por aproximación', () => {
  const source = 'Para el proyecto portal-cliente, entrega-1, acordamos CSV para exportar-reportes.';
  assert.equal(translate(source, 'en'), source);
  assert.equal(translate('cliente@example.com', 'en'), 'cliente@example.com');
  assert.equal(translate('  Centro de decisiones\n', 'en'), '  Decision center\n');
  for (const label of Object.keys(english)) assert.equal(translate(label, 'es'), label);
});

test('idioma: preferencia persistente y fallback cuando el navegador bloquea almacenamiento', () => {
  const entries = new Map();
  const storage = { getItem: key => entries.get(key), setItem: (key, value) => entries.set(key, value) };
  assert.equal(readLanguage(storage), 'es');
  saveLanguage(storage, 'en');
  assert.equal(entries.get(languageKey), 'en');
  assert.equal(readLanguage(storage), 'en');
  saveLanguage(storage, 'es');
  assert.equal(readLanguage(storage), 'es');
  entries.set(languageKey, 'unknown');
  assert.equal(readLanguage(storage), 'es');
  const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
  assert.equal(readLanguage(blocked), 'es');
  assert.doesNotThrow(() => saveLanguage(blocked, 'en'));
});
