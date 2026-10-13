import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { createStudio } from "../src/studio.mjs";
import { harness, env, project, initial, reply, result } from "./support/workflow.mjs";
test("flujo real: Gmail → SQLite → modelo → propuesta → aprobación → issue → respuesta → actualización", async (t) => {
  const { studio, live } = await harness(t);
  assert.equal((await studio.snapshot()).mails.length, 0);
  await assert.rejects(studio.analyze(project.id), /Sincroniza/);
  assert.deepEqual(await studio.sync(project.id), { total: 1, added: 1 });
  assert.equal(live.calls.model, 0);
  assert.deepEqual(live.writes, []);
  assert.equal(
    live.queries[0].q,
    "after:" + (Date.parse(project.gmailAfter) / 1000 - 1) + ' {from:"@live.cl"}',
  );
  assert.equal((await studio.analyze(project.id)).prepared, 1);
  const first = (await studio.snapshot()).proposals[0];
  assert.equal(first.status, "pending");
  assert.deepEqual(live.writes, []);
  assert.equal(live.contexts[0].headers.authorization, "Bearer " + env.MODEL_API_KEY);
  assert.ok(!JSON.stringify(live.contexts[0].payload).includes(env.MODEL_API_KEY));
  const detail = await studio.proposalDetail(first.id, project.id);
  const created = await studio.approve(first.id, project.id);
  assert.equal(created.number, 1);
  assert.equal(live.writes[0].method, "POST");
  assert.equal(live.writes[0].body.body, detail.previewBody);
  await studio.approve(first.id, project.id);
  assert.equal(live.writes.length, 1);
  live.mails.push(reply);
  await studio.sync(project.id);
  await studio.analyze(project.id);
  const update = (await studio.snapshot()).proposals.find((item) => item.status === "pending");
  assert.equal(update.action, "update_issue");
  assert.match(update.body, /exportan en PDF/);
  assert.match(update.body, /Mantener el resto del portal/);
  assert.deepEqual(live.contexts.at(-1).context.links, [
    { threadId: initial.threadId, issueNumber: 1 },
  ]);
  assert.deepEqual(live.contexts.at(-1).context.freshEmailIds, [reply.id]);
  assert.equal(live.contexts.at(-1).context.emails.length, 2);
  assert.equal(live.writes.length, 1);
  await studio.approve(update.id, project.id);
  assert.equal(live.writes.at(-1).method, "PATCH");
  assert.match(live.issues[0].body, /exportan en PDF/);
  await studio.analyze(project.id);
  assert.equal(live.calls.model, 2);
});
test("sin entorno muestra error sin mocks; formularios y vista local funcionan", async (t) => {
  const { root } = await harness(t, { seed: false });
  const deny = () => {
    throw Error("No debe llamar ninguna integración");
  };
  const studio = createStudio({
    root,
    env: {},
    scheduler: false,
    adapters: { emails: deny, issues: deny, analyze: deny },
  });
  t.after(() => studio.close());
  assert.deepEqual((await studio.config()).projects, []);
  await studio.saveProject(project);
  await studio.saveFilter({ projectId: project.id, kind: "domain", value: "live.cl" });
  assert.equal((await studio.config()).environmentReady, false);
  await assert.rejects(studio.sync(project.id), /Faltan variables/);
  assert.deepEqual((await studio.snapshot()).mails, []);
  assert.equal(studio.fixture, undefined);
  assert.equal(studio.saveConfig, undefined);
});
test("rechazo y reinicio conservan decisiones y no vuelven a analizar fuentes ya revisadas", async (t) => {
  const { root, studio, live, adapters } = await harness(t);
  await studio.sync(project.id);
  await studio.analyze(project.id);
  const item = (await studio.snapshot()).proposals[0];
  await studio.reject(item.id, project.id);
  await studio.close();
  const reopened = createStudio({ root, env, adapters, scheduler: false });
  t.after(() => reopened.close());
  assert.equal((await reopened.snapshot()).proposals[0].status, "rejected");
  assert.equal((await reopened.snapshot()).mails[0].analyzed, true);
  await reopened.analyze(project.id);
  assert.equal(live.calls.model, 1);
  assert.deepEqual(live.writes, []);
  await assert.rejects(reopened.approve(item.id, project.id), /no está pendiente/);
});
test("reintentar después de perder la respuesta de GitHub recupera el issue sin duplicarlo", async (t) => {
  const { studio, live } = await harness(t);
  await studio.sync(project.id);
  await studio.analyze(project.id);
  const item = (await studio.snapshot()).proposals[0];
  live.failedWrite = true;
  await assert.rejects(studio.approve(item.id, project.id), /respuesta/);
  assert.equal((await studio.snapshot()).proposals[0].status, "pending");
  const recovered = await studio.approve(item.id, project.id);
  assert.equal(recovered.reused, true);
  assert.equal(live.writes.length, 1);
});
test("issues cambiados y fuentes modificadas bloquean propuestas antiguas y permiten reanálisis", async (t) => {
  const { studio, live } = await harness(t);
  await studio.sync(project.id);
  await studio.analyze(project.id);
  const item = (await studio.snapshot()).proposals[0];
  live.issues.push({
    number: 22,
    title: "Otra tarea",
    body: "Descripción",
    state: "open",
    user: { id: 7 },
  });
  await assert.rejects(studio.approve(item.id, project.id), /issues cambiaron/);
  assert.equal((await studio.snapshot()).proposals[0].status, "stale");
  assert.equal((await studio.snapshot()).mails[0].analyzed, false);
  await studio.analyze(project.id);
  assert.equal(live.calls.model, 2);
  assert.deepEqual(live.writes, []);
  live.mails[0] = { ...initial, text: initial.text + " También agregar filtros." };
  await studio.sync(project.id);
  assert.ok((await studio.snapshot()).proposals.every((item) => item.status === "stale"));
});
test("proyecto explícito evita redirigir una propuesta al cambiar la selección", async (t) => {
  const { studio, live } = await harness(t);
  await studio.sync(project.id);
  await studio.analyze(project.id);
  const item = (await studio.snapshot()).proposals[0];
  await studio.saveProject({ ...project, id: "otro", repository: "org/other" });
  await studio.selectProject("otro");
  await assert.rejects(studio.approve(item.id, "otro"), /no encontrada/);
  await studio.approve(item.id, project.id);
  assert.equal(live.writes[0].path, "repos/org/portal/issues");
  assert.deepEqual((await studio.snapshot("otro")).mails, []);
});
test("reset confirmado borra el estado local, conserva .env y OAuth y no toca GitHub", async (t) => {
  const { root, studio, live } = await harness(t);
  await studio.sync(project.id);
  await studio.analyze(project.id);
  await assert.rejects(studio.reset(""), /Confirma/);
  assert.equal((await studio.config()).projects.length, 1);
  await studio.reset("RESET_LOCAL_DATA");
  assert.deepEqual((await studio.config()).projects, []);
  assert.deepEqual((await studio.snapshot()).proposals, []);
  assert.equal(await readFile(join(root, ".env"), "utf8"), "PRIVATE_TEST=do-not-change\n");
  await access(join(root, ".private/gmail-token.json"));
  assert.deepEqual(live.writes, []);
  await studio.saveProject(project);
  assert.equal((await studio.config()).projects.length, 1);
});
test("seguimiento en servidor respeta intervalos, pausa y no aprueba propuestas", async (t) => {
  let clock = 1000000;
  const { root, studio, live, adapters } = await harness(t, { clock: () => clock });
  await studio.automation(project.id, true, 60);
  await studio.autoTick();
  assert.equal(live.calls.model, 1);
  assert.equal((await studio.snapshot()).proposals.length, 1);
  assert.deepEqual(live.writes, []);
  const calls = live.calls.gmail;
  clock += 30000;
  await studio.autoTick();
  assert.equal(live.calls.gmail, calls);
  clock += 30000;
  await studio.autoTick();
  assert.ok(live.calls.gmail > calls);
  assert.equal(live.calls.model, 1);
  await studio.close();
  const restarted = createStudio({ root, env, adapters, scheduler: false, now: () => clock });
  t.after(() => restarted.close());
  assert.equal((await restarted.config()).project.autoEnabled, true);
  await restarted.automation(project.id, false);
  clock += 60000;
  const paused = live.calls.gmail;
  await restarted.autoTick();
  assert.equal(live.calls.gmail, paused);
});
test("evidencia inventada falla sin marcar correos analizados; diagnóstico oculta secretos", async (t) => {
  const { studio, live, root } = await harness(t);
  live.modelResult = (context) => {
    const output = result(context);
    output.proposals[0].evidence[0].quote = "Esto no existe en el correo";
    return output;
  };
  await studio.sync(project.id);
  await assert.rejects(studio.analyze(project.id), /literalmente/);
  const data = await studio.snapshot();
  assert.deepEqual(data.proposals, []);
  assert.equal(data.mails[0].analyzed, false);
  assert.equal(
    studio.errorMessage(
      Error("Bearer leaked " + env.MODEL_API_KEY + " " + env.GOOGLE_CLIENT_SECRET),
    ),
    "[credencial] [credencial] [credencial]",
  );
  await writeFile(join(root, ".private/watch.lock"), "another-instance");
  await assert.rejects(studio.sync(project.id), /Otra instancia/);
  await access(join(root, ".private/watch.lock"));
  assert.deepEqual(live.writes, []);
});

test(
  "al reiniciar, el servidor programa el seguimiento sin recibir peticiones del navegador",
  { timeout: 3000 },
  async (t) => {
    const { root, studio, live, adapters } = await harness(t);
    await studio.automation(project.id, true, 60);
    await studio.close();
    const originalInterval = globalThis.setInterval;
    const scheduled = new Promise((resolve) =>
      t.mock.method(globalThis, "setInterval", (callback, milliseconds) => {
        assert.equal(milliseconds, 10000);
        resolve(callback);
        return originalInterval(callback, milliseconds);
      }),
    );
    const restarted = createStudio({ root, env, adapters, scheduler: true });
    t.after(() => restarted.close());
    const tick = await scheduled;
    await tick();
    assert.equal(live.calls.model, 1);
    assert.deepEqual(live.writes, []);
  },
);

test("un cambio externo en GitHub vuelve a contrastar los correos aunque ya fueran analizados", async (t) => {
  const { studio, live } = await harness(t);
  await studio.sync(project.id);
  await studio.analyze(project.id);
  await studio.approve((await studio.snapshot()).proposals[0].id, project.id);
  live.issues[0].body += "\nCambio realizado por otra persona.";
  live.modelResult = () => ({ summary: "Revisado con la tarea actual.", proposals: [] });
  await studio.analyze(project.id);
  assert.equal(live.calls.model, 2);
  assert.deepEqual(live.contexts.at(-1).context.freshEmailIds, [initial.id]);
  assert.match(live.contexts.at(-1).context.issues[0].body, /otra persona/);
  assert.equal(live.writes.length, 1);
});

test("un mismo correo puede originar varias tareas distintas sin perder propuestas", async (t) => {
  const { studio, live } = await harness(t);
  live.modelResult = (context) => {
    const output = result(context);
    output.proposals.push({
      ...structuredClone(output.proposals[0]),
      title: "Otra tarea del portal",
      body: "Otra descripción de tarea.",
    });
    return output;
  };
  await studio.sync(project.id);
  assert.equal((await studio.analyze(project.id)).prepared, 2);
  assert.equal((await studio.snapshot()).proposals.length, 2);
  assert.deepEqual(live.writes, []);
});
