import { translate } from "../i18n.js";
/** Los avisos muestran texto, nunca HTML recibido de una integración. */
export function createNotice(element, getLanguage) {
  let timer;
  const show = (message, failed = false) => {
    element.textContent = translate(message, getLanguage());
    element.className = "notice" + (failed ? " error" : "");
    element.hidden = false;
    clearTimeout(timer);
    timer = setTimeout(() => {
      element.hidden = true;
    }, 6000);
  };
  show.clear = () => clearTimeout(timer);
  return show;
}
