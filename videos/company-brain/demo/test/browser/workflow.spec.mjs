import { test, expect } from "./fixtures.mjs";
import { initial, reply, project, result } from "../support/workflow.mjs";

test("proyecto, participantes y conversación: crear y actualizar un issue tras aprobar", async ({
  page,
  demo,
}) => {
  await page.goto("/#/projects");
  await expect(page.getByRole("heading", { name: "Todavía no hay proyectos." })).toBeVisible();
  await page.getByRole("link", { name: "Nuevo proyecto", exact: true }).click();
  await page.getByLabel("Nombre del proyecto").fill("Portal del cliente");
  await page.getByRole("button", { name: "Cargar repositorios" }).click();
  await expect(page.locator("#repository-options option")).toHaveAttribute("value", "org/portal");
  await page.getByLabel("Repositorio de GitHub").fill("org/portal");
  await page.getByLabel("Leer correos desde (UTC)").fill("2026-10-12T09:30:15");
  await page.getByRole("button", { name: "Crear proyecto", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Configuración del proyecto" })).toBeVisible();
  const id = new URL(page.url()).hash.split("/")[2];
  expect(id).toMatch(/^portal-del-cliente-/);
  expect((await demo.studio.snapshot(id)).project.gmailAfter).toBe("2026-10-12T09:30:15.000Z");

  await page.getByLabel("Correo o dominio").fill("live.cl");
  await page.getByRole("button", { name: "Añadir participante" }).click();
  await expect(page.locator(".participants")).toContainText("live.cl");
  await page.getByLabel("Tipo de filtro").selectOption("email");
  await page.getByLabel("Correo o dominio").fill("otra@empresa.com");
  await page.getByRole("button", { name: "Añadir participante" }).click();
  await expect(page.locator(".participants li")).toHaveCount(2);

  await page.locator(".sidebar").getByRole("link", { name: "Correos", exact: true }).click();
  await page.getByRole("button", { name: "Sincronizar correo" }).click();
  await expect(page.locator(".source-text")).toHaveText(initial.text);
  expect(demo.live.calls.model).toBe(0);
  await page.getByRole("button", { name: "Analizar correos" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Propuestas", exact: true }),
  ).toBeVisible();
  expect(demo.live.writes).toEqual([]);
  await page.getByRole("button", { name: "Revisar propuesta" }).click();
  await expect(page.getByRole("dialog")).toContainText("exportar los informes del portal en CSV");
  await page.getByRole("button", { name: "Aprobar y crear issue" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect.poll(() => demo.live.writes.length).toBe(1);
  expect(demo.live.writes[0].method).toBe("POST");
  await page.getByRole("button", { name: "Historial", exact: true }).click();
  await expect(page.locator(".proposals-list")).toContainText("Aprobada");

  demo.live.mails.push(reply);
  await page.locator(".sidebar").getByRole("link", { name: "Correos", exact: true }).click();
  await page.getByRole("button", { name: "Sincronizar correo" }).click();
  await expect(page.locator(".mail-item")).toHaveCount(2);
  await page.getByRole("button", { name: "Analizar correos" }).click();
  await page.locator("[data-tab=pending]").click();
  await page.getByRole("button", { name: "Revisar propuesta" }).click();
  await expect(page.getByRole("dialog")).toContainText("Los informes se exportan en PDF.");
  await expect(page.getByRole("dialog")).toContainText("Mantener el resto del portal.");
  await page.getByRole("button", { name: "Aprobar y actualizar issue" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect.poll(() => demo.live.writes.length).toBe(2);
  expect(demo.live.writes[1].method).toBe("PATCH");
  expect(demo.live.issues).toHaveLength(1);
  expect(demo.live.issues[0].body).toContain("Los informes se exportan en PDF.");
  expect(demo.live.issues[0].body).toContain("Mantener el resto del portal.");
  expect(demo.live.contexts.at(-1).context.emails.map((mail) => mail.id)).toContain("initial");
  await page.locator(".sidebar").getByRole("link", { name: "Actividad", exact: true }).click();
  await expect(page.locator(".activity-list")).toContainText("Issue actualizado");
  await page.reload();
  await expect(page.getByRole("heading", { name: "El recorrido del proyecto." })).toBeVisible();
  await expect(page.locator(".project-bar")).toContainText("Portal del cliente");
});

test.describe("navegación y formularios", () => {
  test.use({ seed: true });

  test("ES/EN conserva borradores, foco, correo literal y preferencia al recargar", async ({
    page,
    demo,
  }) => {
    const raw =
      "\n" +
      initial.text +
      '\r\n\n<script>document.body.dataset.injected="sí"</script>\n& literal\r\n';
    demo.live.mails = [{ ...initial, subject: "Sin asunto", text: raw }];
    await demo.studio.sync(project.id);
    await page.goto("/#/projects/portal/settings");
    await page.getByLabel("Nombre del proyecto").fill("Borrador sin guardar");
    await page.getByLabel("Etiqueta de Gmail (opcional)").fill("prueba pendiente");
    await page.getByLabel("Correo o dominio").fill("pendiente@live.cl");
    await page.getByLabel("Correo o dominio").press("ArrowLeft");
    const cursor = await page
      .locator("#participant-value")
      .evaluate((input) => input.selectionStart);
    // Un render conserva el control activo y su cursor; la acción no cambia el borrador.
    await page.locator("[data-action=language]").evaluate((button) => button.click());
    await expect(page.locator("#participant-value")).toBeFocused();
    expect(await page.locator("#participant-value").evaluate((input) => input.selectionStart)).toBe(
      cursor,
    );
    await expect(page.getByLabel("Project name")).toHaveValue("Borrador sin guardar");
    await expect(page.getByLabel("Gmail label (optional)")).toHaveValue("prueba pendiente");
    await expect(page.getByLabel("Email or domain")).toHaveValue("pendiente@live.cl");
    expect((await demo.studio.snapshot(project.id)).project.name).toBe("Portal");

    await page.locator(".sidebar").getByRole("link", { name: "Email", exact: true }).click();
    await expect(page.locator(".source-text")).toHaveText(raw);
    expect(await page.locator(".source-text").textContent()).toBe(raw);
    await expect(page.locator(".mail-item h3")).toHaveText("Sin asunto");
    expect(await page.locator("body").getAttribute("data-injected")).toBeNull();
    await page.getByRole("searchbox").fill("Sin asunto");
    await expect(page.getByRole("searchbox")).toBeFocused();
    await expect(page.locator(".mail-item")).toHaveCount(1);
    await page.getByRole("button", { name: "Cambiar a español" }).click();
    await expect(page.locator(".source-text")).toHaveText(raw);
    await page.getByRole("button", { name: "Switch to English" }).click();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Project email" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    expect(await page.locator(".source-text").textContent()).toBe(raw);
    const quote = initial.text + '\r\n\n<script>document.body.dataset.injected="sí"</script>';
    demo.live.modelResult = (context) => {
      const response = result(context);
      response.proposals[0].evidence[0].quote = quote;
      return response;
    };
    await page.locator("[data-action=analyze]").click();
    await page.locator("[data-action=review]").click();
    expect(await page.locator("[data-evidence-index]").textContent()).toBe(quote);
    expect(await page.locator("body").getAttribute("data-injected")).toBeNull();
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.locator(".project-bar").getByRole("link", { name: "Project settings" }).click();
    await expect(page.getByLabel("Project name")).toHaveValue("Portal");
  });

  test("una respuesta antigua no sustituye el proyecto seleccionado", async ({ page, demo }) => {
    await demo.studio.saveProject({ ...project, id: "second", name: "Segundo proyecto" });
    await page.goto("/#/projects");
    await expect(page.locator(".project-row")).toHaveCount(2);
    let release, arrived;
    const blocked = new Promise((resolve) => {
      release = resolve;
    });
    const requested = new Promise((resolve) => {
      arrived = resolve;
    });
    await page.route("**/api/bootstrap?projectId=portal", async (route) => {
      const response = await route.fetch();
      arrived();
      await blocked;
      await route.fulfill({ response });
    });
    try {
      await page.locator("#project-switch").selectOption("portal");
      await requested;
      await page.locator("#project-switch").selectOption("second");
      await expect(page.locator(".project-bar h2")).toHaveText("Segundo proyecto");
      release();
      await page.unroute("**/api/bootstrap?projectId=portal", { behavior: "wait" });
      await expect(page.locator(".project-bar h2")).toHaveText("Segundo proyecto");
      await expect(page.locator("#project-switch")).toHaveValue("second");
      await page.reload();
      await expect(page.locator(".project-bar h2")).toHaveText("Segundo proyecto");
      await page.goBack();
      await expect(page.locator(".project-bar h2")).toHaveText("Portal");
    } finally {
      release();
    }
  });

  test("el análisis pendiente no cambia la ruta que eligió la persona", async ({ page, demo }) => {
    await demo.studio.saveProject({ ...project, id: "second", name: "Segundo proyecto" });
    await demo.studio.sync(project.id);
    let release;
    const blocked = new Promise((resolve) => {
      release = resolve;
    });
    demo.live.modelResult = async (context) => {
      await blocked;
      return result(context);
    };
    try {
      await page.goto("/#/projects/portal/mail");
      await page.getByRole("button", { name: "Analizar correos" }).click();
      await expect.poll(() => demo.live.calls.model).toBe(1);
      await page.locator("#project-switch").selectOption("second");
      await expect(page.locator(".project-bar h2")).toHaveText("Segundo proyecto");
      release();
      await expect(page.locator("#notice")).toContainText("Análisis completado");
      await expect(page).toHaveURL(/projects\/second\/mail$/);
      await expect(page.locator(".project-bar h2")).toHaveText("Segundo proyecto");
    } finally {
      release();
    }
  });

  for (const returnToProposals of [false, true]) {
    test(
      returnToProposals
        ? "regresión TDD: una revisión tardía se descarta aunque vuelvas a la misma pantalla"
        : "regresión TDD: una revisión tardía no se abre después de cambiar de pantalla",
      async ({ page, demo }) => {
        await demo.studio.sync(project.id);
        await demo.studio.analyze(project.id);
        await page.goto("/#/projects/portal/proposals");
        await expect(page.getByRole("button", { name: "Revisar propuesta" })).toBeVisible();
        let release, arrived;
        const blocked = new Promise((resolve) => {
          release = resolve;
        });
        const requested = new Promise((resolve) => {
          arrived = resolve;
        });
        const detailPattern = "**/api/proposals/detail?**";
        await page.route(detailPattern, async (route) => {
          const response = await route.fetch();
          expect(response.status()).toBe(200);
          arrived();
          await blocked;
          await route.fulfill({ response });
        });
        try {
          await page.getByRole("button", { name: "Revisar propuesta" }).click();
          await requested;
          // Conservamos el mismo proyecto para comprobar la navegación entre sus pantallas.
          await page
            .locator(".sidebar")
            .getByRole("link", { name: "Correos", exact: true })
            .click();
          await expect(page.getByRole("heading", { name: "Correos del proyecto" })).toBeVisible();
          if (returnToProposals) {
            await page
              .locator(".sidebar")
              .getByRole("link", { name: /^Propuestas\b/ })
              .click();
            await expect(
              page.getByRole("heading", { name: "Propuestas", exact: true }),
            ).toBeVisible();
          }
          await expect(page.locator("#dialog")).toHaveJSProperty("open", false);

          const delivered = page.waitForResponse((response) =>
            response.url().includes("/api/proposals/detail?"),
          );
          release();
          const response = await delivered;
          expect(response.status()).toBe(200);
          expect(await response.finished()).toBeNull();
          // Dejamos procesar la respuesta y el render antes de comprobar que el diálogo sigue cerrado.
          await page.evaluate(
            () =>
              new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
          );
          const view = returnToProposals ? "proposals" : "mail";
          await expect(page).toHaveURL(new RegExp("projects/portal/" + view + "$"));
          await expect(page.locator("#dialog")).toHaveJSProperty("open", false);
          expect(demo.live.writes).toEqual([]);

          // Descartar una revisión antigua no debe impedir abrir otra desde Propuestas.
          await page.unroute(detailPattern, { behavior: "wait" });
          await page
            .locator(".sidebar")
            .getByRole("link", { name: /^Propuestas\b/ })
            .click();
          await page.getByRole("button", { name: "Revisar propuesta" }).click();
          await expect(page.getByRole("dialog")).toBeVisible();
          await expect(page.getByRole("button", { name: "Aprobar y crear issue" })).toBeVisible();
        } finally {
          release();
          await page.unroute(detailPattern, { behavior: "wait" });
        }
      },
    );
  }

  test("el seguimiento actualiza la pantalla sin borrar un formulario activo", async ({
    page,
    demo,
  }) => {
    await demo.studio.automation(project.id, true, 60);
    await page.goto("/#/projects/portal/settings");
    await page.getByLabel("Nombre del proyecto").fill("Nombre pendiente");
    await demo.studio.autoTick();
    await expect.poll(() => demo.live.calls.model).toBe(1);
    // La consulta periódica se pausa mientras se escribe; tampoco reconstruye el borrador después.
    await page.waitForTimeout(3200);
    await expect(page.getByLabel("Nombre del proyecto")).toHaveValue("Nombre pendiente");
    await expect(page.getByLabel("Nombre del proyecto")).toBeFocused();
    await page.getByRole("heading", { name: "Datos del proyecto" }).click();
    await expect(page.locator(".nav-count")).toHaveText("1", { timeout: 6000 });
    await expect(page.getByLabel("Nombre del proyecto")).toHaveValue("Nombre pendiente");
  });
});

test.describe("configuración incompleta", () => {
  test.use({ environment: {} });
  test("muestra un error explícito y empieza sin datos de demostración", async ({ page, demo }) => {
    await page.goto("/#/projects");
    await expect(page.getByRole("alert")).toContainText("MODEL_API_KEY");
    await expect(page.locator(".project-row")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Todavía no hay proyectos." })).toBeVisible();
    await page.getByRole("link", { name: "Configurar conexiones" }).click();
    await expect(page.getByRole("heading", { name: "Credenciales desde .env" })).toBeVisible();
    await expect(page.locator("[data-action=gmail-login]")).toBeDisabled();
    await expect(page.locator("input")).toHaveCount(0);
    expect(demo.live.calls).toEqual({ gmail: 0, model: 0 });
    expect(demo.live.writes).toEqual([]);
  });
});
