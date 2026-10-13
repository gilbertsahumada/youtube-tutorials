import { createState } from "./state.js";
import { createApiClient } from "./api.js";
import { createRenderer } from "./renderer.js";
import { createApplicationController } from "./controllers/application.js";

// La entrada compone módulos; las vistas, efectos y formatos tienen sus propios responsables.
const state = createState(location.hash, localStorage);
const elements = {
  app: document.querySelector("#app"),
  dialog: document.querySelector("#dialog"),
  notice: document.querySelector("#notice"),
};
const renderer = createRenderer({ ...elements, state });
const controller = createApplicationController({
  ...elements,
  ...renderer,
  state,
  request: createApiClient(() => state.token),
});
controller.start();
