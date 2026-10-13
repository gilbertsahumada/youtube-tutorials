import { test as base, expect } from "@playwright/test";
import { createDemoServer } from "../../src/server.mjs";
import { createWorkflowFixture, env } from "../support/workflow.mjs";

/** El puerto libre y la base privada se crean para cada prueba y se eliminan al terminar. */
export const test = base.extend({
  seed: [false, { option: true }],
  environment: [env, { option: true }],
  demo: async ({ seed, environment }, use) => {
    const fixture = await createWorkflowFixture({ seed, environment });
    const server = createDemoServer({ studio: fixture.studio });
    try {
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
      });
      await use({ ...fixture, baseURL: `http://127.0.0.1:${server.address().port}` });
    } finally {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      await fixture.dispose();
    }
  },
  baseURL: async ({ demo }, use) => use(demo.baseURL),
});
export { expect };
