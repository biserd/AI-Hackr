export { WebDataStore } from "./web-data-store";
export default {
  fetch(request: Request, env: Env) {
    return env.WEB_DATA_STORE.get(env.WEB_DATA_STORE.idFromName("test")).fetch(
      request,
    );
  },
};
