import { describe, it, expect, vi } from "vitest";
import { createSupabaseMock, eqValue } from "../test/supabaseMock.js";

let mock;
vi.mock("./supabase.js", () => ({
  get supabase() {
    return mock.supabase;
  },
}));

const { createPharmacy, getPharmacyByVendorId, updatePharmacy } = await import("./vendorPharmacyService.js");

const ROW = { id: "p1", vendor_id: "v1", name: "Store", license_number: "L", address: "A", city: "C", is_active: true };
const INPUT = { vendorId: "v1", name: "Store 2", licenseNumber: "L2", address: "A", city: "C", phone: "1" };

describe("vendorPharmacyService (B4, B9)", () => {
  it("getPharmacyByVendorId tolerates duplicate rows (returns oldest, no error)", async () => {
    mock = createSupabaseMock((c) => {
      // Real PostgREST errors on maybeSingle() with >1 row unless limited to 1.
      const limited = c.filters.some(([m, n]) => m === "limit" && n === 1);
      if (c.single === "maybe" && !limited) return { data: null, error: { message: "multiple rows" } };
      return { data: ROW, error: null };
    });
    const p = await getPharmacyByVendorId("v1");
    expect(p.id).toBe("p1");
  });

  it("createPharmacy refuses when the vendor already has a store", async () => {
    mock = createSupabaseMock((c) => (c.op === "select" ? { data: ROW, error: null } : { data: { ...ROW, id: "p2" }, error: null }));
    await expect(createPharmacy(INPUT)).rejects.toThrow(/already/i);
    expect(mock.calls.some((c) => c.op === "insert")).toBe(false);
  });

  it("createPharmacy inserts when the vendor has no store", async () => {
    mock = createSupabaseMock((c) => (c.op === "select" ? { data: null, error: null } : { data: { ...ROW, id: "p2" }, error: null }));
    const p = await createPharmacy(INPUT);
    expect(p.id).toBe("p2");
    expect(mock.calls.find((c) => c.op === "insert").payload.vendor_id).toBe("v1");
  });

  it("updatePharmacy with no changes returns the current pharmacy by id", async () => {
    mock = createSupabaseMock(() => ({ data: ROW, error: null }));
    const p = await updatePharmacy("p1", {});
    expect(p.id).toBe("p1");
    expect(eqValue(mock.calls[0], "id")).toBe("p1");
    expect(mock.calls.some((c) => c.op === "update")).toBe(false);
  });
});
