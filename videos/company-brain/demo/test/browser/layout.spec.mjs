import { test, expect } from "./fixtures.mjs";
import { publicAssets } from "../../src/public-assets.mjs";
import { project } from "../support/workflow.mjs";

test.use({ seed: true });
const views = [
  ["projects", "Tus proyectos"],
  ["projects/new", "Nuevo proyecto"],
  ["projects/portal/settings", "Configuración del proyecto"],
  ["projects/portal/mail", "Correos del proyecto"],
  ["projects/portal/proposals", "Propuestas"],
  ["projects/portal/activity", "El recorrido del proyecto."],
  ["connections", "Conexiones y datos"],
];

for (const viewport of [
  { width: 1904, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`siete vistas alineadas arriba y sin desbordamiento en ${viewport.width} × ${viewport.height}`, async ({
    page,
    demo,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await demo.studio.sync(project.id);
    await demo.studio.analyze(project.id);
    const errors = [];
    page.on("pageerror", (problem) => errors.push(problem.message));
    for (const [route, heading] of views) {
      await test.step(route, async () => {
        await page.goto("/#/" + route);
        await expect(
          page.getByRole("heading", { level: 1, name: heading, exact: true }),
        ).toBeVisible();
        const geometry = await page.evaluate(() => {
          const main = document.querySelector("main").getBoundingClientRect();
          const layout = document.querySelector(".layout").getBoundingClientRect();
          const sidebar = document.querySelector(".sidebar").getBoundingClientRect();
          return {
            top: main.top,
            expectedTop: innerWidth > 760 ? layout.top : sidebar.bottom,
            width: document.documentElement.scrollWidth,
            viewport: innerWidth,
          };
        });
        expect(Math.abs(geometry.top - geometry.expectedTop)).toBeLessThanOrEqual(1);
        expect(geometry.width).toBeLessThanOrEqual(geometry.viewport);
        await page.screenshot({
          path: testInfo.outputPath(route.replaceAll("/", "-") + ".png"),
          fullPage: true,
        });
      });
    }
    expect(errors).toEqual([]);
  });
}

test("el navegador carga los módulos públicos y bloquea archivos privados", async ({
  page,
  request,
}) => {
  const errors = [],
    failed = [];
  page.on("pageerror", (problem) => errors.push(problem.message));
  page.on("requestfailed", (request) => failed.push(request.url()));
  await page.goto("/#/projects");
  await expect(page.getByRole("heading", { name: "Tus proyectos", exact: true })).toBeVisible();
  for (const [path, [, type]] of Object.entries(publicAssets)) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(response.headers()["content-type"], path).toContain(type);
  }
  for (const path of [
    "/.env",
    "/.env.example",
    "/.private/gmail-token.json",
    "/.private/company-brain.sqlite",
    "/src/oauth/authorization.mjs",
    "/src/db/schema.mjs",
    "/test/support/workflow.mjs",
    "/node_modules/@playwright/test/package.json",
  ])
    expect((await request.get(path)).status(), path).toBe(404);
  await page.goto("/#/connections");
  await expect(page.locator(".source-icon svg")).toHaveCount(2);
  await page.getByRole("button", { name: "Comprobar GitHub" }).click();
  await expect(page.locator(".account-name")).toHaveText("test-user");
  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
});
