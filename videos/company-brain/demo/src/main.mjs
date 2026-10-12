import { mkdir, open, unlink, writeFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { ROOT, loadEnv, privatePath, readJson, saveJson } from "./common.mjs";
import { classify, createBaseline, buildPlan, messageKey } from "./plan.mjs";
import { getEmails } from "./gmail.mjs";
import { readIssue, publishComment, repository } from "./github.mjs";
import { assertBaseline, processEmails } from "./pipeline.mjs";

loadEnv();
const args = process.argv.slice(2),
  command = args[0];
if (
  args.length !== 1 ||
  !["--fixture", "--inbox", "--baseline", "--once", "--watch"].includes(command)
)
  throw Error("Usa --fixture, --inbox, --baseline, --once o --watch");
const publishing = command !== "--fixture" && process.env.PUBLISH === "true";
const local = (path) => readJson(resolve(ROOT, path));
async function savePlan(
  { email, context, analysis, plan },
  prefix = messageKey(email.id),
) {
  await saveJson(resolve(ROOT, `output/${prefix}.json`), {
    context,
    analysis,
    plan,
  });
  const commentPath = resolve(ROOT, `output/${prefix}-comment.md`);
  if (plan.action === "comment")
    await writeFile(commentPath, plan.body + "\n", { mode: 0o600 });
  else await rm(commentPath, { force: true });
}
async function fixture() {
  const [project, initialEmail, email, issue, initialAnalysis, analysis] =
    await Promise.all([
      local("config/project.json"),
      local("fixtures/initial-email.json"),
      local("fixtures/email.json"),
      local("fixtures/issue.json"),
      local("fixtures/initial-analysis.json"),
      local("fixtures/analysis.json"),
    ]);
  const baseline = createBaseline({
    repo: "demo/sandbox",
    project,
    email: initialEmail,
    issue,
    analysis: initialAnalysis,
    sender: "client@example.com",
  });
  const plan = buildPlan({
    baseline,
    email,
    issue,
    analysis,
    sender: "client@example.com",
  });
  await savePlan(
    {
      email,
      context: { project, initialEmail, issue, requestEmail: email },
      analysis,
      plan,
    },
    "fixture",
  );
  console.log(
    "MODO FIXTURE: ambos correos, issue y análisis simulados. No se llamó a Gmail, GitHub ni al LLM. No se publicó nada.",
  );
  console.log(plan.body);
}
async function optional(path) {
  try {
    return await readJson(path);
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
}
async function real() {
  for (const key of [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GMAIL_AFTER",
    "ALLOWED_SENDER",
  ])
    if (!process.env[key]) throw Error(`Falta ${key}`);
  if (command === "--inbox") {
    const emails = await getEmails();
    console.log(
      JSON.stringify(
        emails.map(({ id, from, subject, date }) => ({
          id,
          from,
          subject,
          date,
        })),
        null,
        2,
      ),
    );
    return;
  }
  for (const key of ["MODEL_BASE_URL", "MODEL_ID", "MODEL_API_KEY"])
    if (!process.env[key]) throw Error(`Falta ${key}`);
  const repo = repository(),
    number = Number(process.env.GITHUB_ISSUE_NUMBER);
  const project = await local("config/project.json");
  const previous = await optional(privatePath("baseline.json"));
  if (previous) {
    assertBaseline(previous, repo, number);
    if (previous.initialEmail.id !== process.env.GMAIL_INITIAL_MESSAGE_ID)
      throw Error(
        "GMAIL_INITIAL_MESSAGE_ID no coincide con la captura inicial",
      );
    if (JSON.stringify(previous.project) !== JSON.stringify(project))
      throw Error(
        "La configuración cambió desde la captura inicial; usa otra copia de la demo",
      );
  }
  if (command === "--baseline") {
    if (!process.env.GMAIL_INITIAL_MESSAGE_ID)
      throw Error("Define GMAIL_INITIAL_MESSAGE_ID usando npm run inbox");
    if (previous) {
      if (previous.initialEmail.id !== process.env.GMAIL_INITIAL_MESSAGE_ID)
        throw Error(
          "Ya existe otra captura inicial; usa otra copia de la demo",
        );
      console.log("Captura inicial existente. No se sobrescribió.");
      return;
    }
    const email = (await getEmails()).find(
      (e) => e.id === process.env.GMAIL_INITIAL_MESSAGE_ID,
    );
    if (!email)
      throw Error(
        "El correo inicial no está entre los mensajes etiquetados, permitidos y posteriores a GMAIL_AFTER",
      );
    const issue = readIssue();
    const context = { project, initialEmail: email, issue, requestEmail: null };
    const analysis = await classify(context);
    // Preserve the model result even when deterministic validation rejects it.
    await saveJson(resolve(ROOT, "output/initial-context.json"), {
      context,
      analysis,
    });
    let baseline;
    try {
      baseline = createBaseline({
        repo,
        project,
        email,
        issue,
        analysis,
        sender: process.env.ALLOWED_SENDER,
      });
    } catch (error) {
      throw Error(
        `${error.message}. Revisa context.initialEmail.text y analysis.initialEvidence en output/initial-context.json. No se guardó la captura inicial ni se escribió en GitHub.`,
      );
    }
    await saveJson(privatePath("baseline.json"), baseline);
    console.log(
      `Contexto inicial capturado: ${baseline.initialFormat}, issue #${number}. No se escribió en GitHub.`,
    );
    return;
  }
  if (!previous)
    throw Error(
      "Primero ejecuta npm run baseline con el correo y el issue iniciales",
    );
  if (command === "--watch" && !publishing)
    throw Error(
      "Para watch usa PUBLISH=true solo después de revisar once con PUBLISH=false",
    );
  const seconds = Number(process.env.POLL_SECONDS || 30);
  if (!Number.isFinite(seconds) || seconds < 10)
    throw Error("POLL_SECONDS debe ser >= 10");
  let state = (await optional(privatePath("state.json"))) || {
    schemaVersion: 2,
    repo,
    issueNumber: number,
    processed: {},
  };
  if (
    state.schemaVersion !== 2 ||
    state.repo !== repo ||
    state.issueNumber !== number
  )
    throw Error(
      "Estado incompatible o de otro destino: usa otra copia de la demo; no borres una revisión activa",
    );
  let stopping = false;
  const stop = () => {
    stopping = true;
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  console.log(
    publishing
      ? "PUBLICACIÓN: solo comentario en el issue. No hay PR, edición ni aprobación automática."
      : "PREVIEW REAL: consulta Gmail, GitHub y LLM; sin escrituras en GitHub.",
  );
  try {
    do {
      try {
        const results = await processEmails({
          baseline: previous,
          emails: await getEmails(),
          state,
          publishing,
          sender: process.env.ALLOWED_SENDER,
          readIssue: () => readIssue(),
          analyze: (context) => classify(context),
          publish: (plan) => publishComment(plan),
          onPlan: savePlan,
          persist: (s) => saveJson(privatePath("state.json"), s),
        });
        for (const plan of results)
          console.log(
            plan.action === "skip"
              ? `Omitido: ${plan.reason}`
              : `Propuesta ${plan.fromFormat} → ${plan.toFormat}. ${publishing ? "Comentario creado o recuperado en el issue." : "Comentario disponible en output/; no publicado."}`,
          );
      } catch (error) {
        if (command !== "--watch") throw error;
        console.error(
          `Falló la iteración: ${error.message}. Se reintentará sin marcar el correo como procesado.`,
        );
      }
      if (command !== "--watch" || stopping) break;
      for (let elapsed = 0; elapsed < seconds && !stopping; elapsed++)
        await sleep(1000);
    } while (!stopping);
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
  }
}
if (command === "--fixture") await fixture();
else {
  await mkdir(privatePath("."), { recursive: true, mode: 0o700 });
  const path = privatePath("watch.lock");
  let lock;
  try {
    lock = await open(path, "wx", 0o600);
  } catch (e) {
    if (e.code === "EEXIST")
      throw Error(
        "Otro proceso o lock antiguo en .private/watch.lock. Verifica antes de borrarlo.",
      );
    throw e;
  }
  try {
    await real();
  } finally {
    await lock.close();
    await unlink(path);
  }
}
