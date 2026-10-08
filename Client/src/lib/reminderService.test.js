import { describe, it, expect, vi } from "vitest";
import { createSupabaseMock, eqValue } from "../test/supabaseMock.js";

let mock;
vi.mock("./supabase.js", () => ({
  get supabase() {
    return mock.supabase;
  },
}));

const { createReminder, updateReminder } = await import("./reminderService.js");

const ROW = { id: "r1", user_id: "u1", medicine_name: "Para", is_active: true, reminder_times: [{ schedule_time: "08:00:00" }] };

function db(fail = {}) {
  return createSupabaseMock((c) => {
    const key = `${c.table}.${c.op}`;
    if (fail[key]) return { data: null, error: { message: `${key} failed` } };
    if (c.table === "reminders" && (c.op === "insert" || c.op === "select")) return { data: ROW, error: null };
    return { data: null, error: null };
  });
}

describe("reminderService (K7)", () => {
  it("createReminder inserts all times in one call", async () => {
    mock = db();
    await createReminder("u1", { medicineName: "Para", times: [{ hour: 8 }, { hour: 20, minute: 30 }] });
    const inserts = mock.calls.filter((c) => c.table === "reminder_times" && c.op === "insert");
    expect(inserts).toHaveLength(1);
    expect(inserts[0].payload.map((t) => t.schedule_time)).toEqual(["08:00:00", "20:30:00"]);
  });

  it("createReminder throws and removes the reminder when times fail to save", async () => {
    mock = db({ "reminder_times.insert": true });
    await expect(createReminder("u1", { medicineName: "Para", times: [{ hour: 8 }] })).rejects.toThrow(/reminder_times.insert failed/);
    const del = mock.calls.find((c) => c.table === "reminders" && c.op === "delete");
    expect(eqValue(del, "id")).toBe("r1");
  });

  it("updateReminder throws when replacing times fails", async () => {
    mock = db({ "reminder_times.insert": true });
    await expect(updateReminder("r1", { times: [{ hour: 9 }] })).rejects.toThrow(/reminder_times.insert failed/);
  });
});
