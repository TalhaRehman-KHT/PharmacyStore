import { describe, it, expect } from "vitest";
import { normalizeSupabaseUrl } from "./supabaseUrl.js";

describe("normalizeSupabaseUrl", () => {
  it("keeps a bare project URL", () => {
    expect(normalizeSupabaseUrl("https://abc.supabase.co")).toBe("https://abc.supabase.co");
  });

  it("strips a trailing /rest/v1 (would double the path)", () => {
    expect(normalizeSupabaseUrl("https://abc.supabase.co/rest/v1")).toBe("https://abc.supabase.co");
    expect(normalizeSupabaseUrl("https://abc.supabase.co/rest/v1/")).toBe("https://abc.supabase.co");
  });

  it("strips trailing slashes and whitespace", () => {
    expect(normalizeSupabaseUrl("  https://abc.supabase.co/ ")).toBe("https://abc.supabase.co");
  });

  it("returns empty string for missing input", () => {
    expect(normalizeSupabaseUrl(undefined)).toBe("");
  });
});
