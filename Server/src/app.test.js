import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "./app.js";

describe("app", () => {
  it("GET /api/health returns ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("health details do not report unused GOOGLE_CLIENT_ID", async () => {
    const res = await request(app).get("/api/health?details=1");
    expect(res.body.configured).not.toHaveProperty("googleClientIdFromEnv");
  });

  it("has no /api/auth/google route (never implemented)", async () => {
    const res = await request(app).post("/api/auth/google").send({});
    expect(res.status).toBe(404);
  });
});
