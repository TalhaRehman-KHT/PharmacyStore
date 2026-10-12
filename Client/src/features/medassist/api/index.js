import { mockClient } from "./mockClient.js";
import { httpClient } from "./httpClient.js";

export const USE_MEDASSIST_MOCK = import.meta.env.VITE_MEDASSIST_USE_MOCK !== "false";

/** @type {import("./client.js").MedAssistClient} */
export const medassistClient = USE_MEDASSIST_MOCK ? mockClient : httpClient;

export { toApiError } from "./client.js";
