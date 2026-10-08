import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSupabaseMock, eqValue } from "../test/supabaseMock.js";

let mock;
vi.mock("./supabase.js", () => ({
  get supabase() {
    return mock.supabase;
  },
}));
vi.mock("./emailService.js", () => ({ sendOTPEmail: vi.fn(async () => ({ ok: true })) }));

const { requestPasswordReset, resetPassword, verifyOTPWithoutMarking } = await import("./authService.js");

const USER = { id: "u-user", email: "a@b.com", role: "user" };
const VENDOR = { id: "u-vendor", email: "a@b.com", role: "vendor" };
const future = () => new Date(Date.now() + 60_000).toISOString();

describe("requestPasswordReset (B10)", () => {
  beforeEach(() => {
    mock = createSupabaseMock((c) => {
      if (c.table === "users" && c.op === "select") {
        const roles = c.filters.find(([m, col]) => m === "in" && col === "role")?.[2];
        const rows = [USER, VENDOR].filter((u) => !roles || roles.includes(u.role));
        return { data: rows, error: null };
      }
      return { data: null, error: null };
    });
  });

  it("creates the OTP for the vendor account when role=vendor and email has two accounts", async () => {
    await requestPasswordReset({ email: "A@b.com", role: "vendor" });
    const insert = mock.calls.find((c) => c.table === "otps" && c.op === "insert");
    expect(insert).toBeTruthy();
    expect(insert.payload.user_id).toBe("u-vendor");
    expect(insert.payload.otp_type).toBe("password_reset");
  });

  it("creates the OTP for the customer account when role=user", async () => {
    await requestPasswordReset({ email: "a@b.com", role: "user" });
    const insert = mock.calls.find((c) => c.table === "otps" && c.op === "insert");
    expect(insert.payload.user_id).toBe("u-user");
  });

  it("throws if the OTP insert fails instead of pretending it was sent", async () => {
    mock = createSupabaseMock((c) => {
      if (c.table === "users") return { data: [USER], error: null };
      if (c.table === "otps" && c.op === "insert") return { data: null, error: { message: "boom" } };
      return { data: null, error: null };
    });
    await expect(requestPasswordReset({ email: "a@b.com", role: "user" })).rejects.toThrow();
  });
});

describe("resetPassword (B10)", () => {
  it("updates the user referenced by the OTP, not a lookup by email", async () => {
    const otp = { id: "otp1", user_id: "u-vendor", otp_code: "123456", attempts: 0, expires_at: future() };
    mock = createSupabaseMock((c) => {
      if (c.table === "otps" && c.op === "select") return { data: otp, error: null };
      return { data: null, error: null };
    });
    await resetPassword({ email: "a@b.com", otpCode: "123456", newPassword: "secret123" });

    const userUpdate = mock.calls.find((c) => c.table === "users" && c.op === "update");
    expect(eqValue(userUpdate, "id")).toBe("u-vendor");
    expect(userUpdate.payload.password_hash).toMatch(/^[A-Za-z0-9+/=]+:[0-9a-f]{64}$/);
    expect(mock.calls.some((c) => c.table === "users" && c.op === "select")).toBe(false);

    const used = mock.calls.find((c) => c.table === "otps" && c.op === "update" && c.payload.is_used);
    expect(eqValue(used, "id")).toBe("otp1");
  });
});

describe("OTP attempts (B11)", () => {
  it("increments attempts on a wrong code", async () => {
    const otp = { id: "otp1", user_id: "u1", otp_code: "111111", attempts: 2, expires_at: future() };
    mock = createSupabaseMock((c) => (c.table === "otps" && c.op === "select" ? { data: otp, error: null } : { data: null, error: null }));

    await expect(
      verifyOTPWithoutMarking({ email: "a@b.com", otpCode: "999999", otpType: "password_reset" })
    ).rejects.toThrow(/invalid/i);

    const upd = mock.calls.find((c) => c.table === "otps" && c.op === "update");
    expect(upd.payload).toEqual({ attempts: 3 });
    expect(eqValue(upd, "id")).toBe("otp1");
  });

  it("rejects even the right code after 5 attempts", async () => {
    const otp = { id: "otp1", user_id: "u1", otp_code: "111111", attempts: 5, expires_at: future() };
    mock = createSupabaseMock((c) => (c.table === "otps" && c.op === "select" ? { data: otp, error: null } : { data: null, error: null }));
    await expect(
      verifyOTPWithoutMarking({ email: "a@b.com", otpCode: "111111", otpType: "password_reset" })
    ).rejects.toThrow(/too many/i);
  });

  it("accepts the right code under the limit", async () => {
    const otp = { id: "otp1", user_id: "u1", otp_code: "111111", attempts: 1, expires_at: future() };
    mock = createSupabaseMock((c) => (c.table === "otps" && c.op === "select" ? { data: otp, error: null } : { data: null, error: null }));
    await expect(
      verifyOTPWithoutMarking({ email: "a@b.com", otpCode: "111111", otpType: "password_reset" })
    ).resolves.toBeTruthy();
  });
});
