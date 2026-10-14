import { mockClient } from "./mockClient.js";
import { httpClient, MEDASSIST_API_URL } from "./httpClient.js";

// Real API is the default; mock data only when explicitly asked for.
export const USE_MEDASSIST_MOCK = import.meta.env.VITE_MEDASSIST_USE_MOCK === "true";

if (import.meta.env.DEV) {
  console.info(
    USE_MEDASSIST_MOCK
      ? "[MedAssist] MOCK mode (VITE_MEDASSIST_USE_MOCK=true): fixture data, no API calls"
      : `[MedAssist] REAL mode: API ${MEDASSIST_API_URL}`,
  );
}

/** @type {import("./client.js").MedAssistClient} */
export const medassistClient = USE_MEDASSIST_MOCK ? mockClient : httpClient;

export { toApiError } from "./client.js";
