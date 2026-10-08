import { describe, it, expect } from "vitest";
import { normalizeSupabaseUrl } from "./supabaseAdmin.js";

describe("normalizeSupabaseUrl", () => {
  it("strips a trailing /rest/v1", () => {
    expect(normalizeSupabaseUrl("https://abc.supabase.co/rest/v1/")).toBe("https://abc.supabase.co");
  });

  it("keeps a bare project URL", () => {
    expect(normalizeSupabaseUrl("https://abc.supabase.co")).toBe("https://abc.supabase.co");
  });
});
