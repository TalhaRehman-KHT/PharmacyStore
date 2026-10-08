/**
 * Minimal chainable fake for the Supabase JS query builder.
 * `handler(call)` receives { table, op, payload, filters, single } and returns { data, error }.
 * Every executed call is recorded in `calls` for assertions.
 */
export function createSupabaseMock(handler) {
  const calls = [];

  function from(table) {
    const call = { table, op: "select", payload: null, filters: [], single: null, columns: null };
    const builder = {
      select(columns) {
        if (call.op === "select") call.columns = columns ?? "*";
        return builder;
      },
      insert(payload) { call.op = "insert"; call.payload = payload; return builder; },
      update(payload) { call.op = "update"; call.payload = payload; return builder; },
      delete() { call.op = "delete"; return builder; },
      maybeSingle() { call.single = "maybe"; return builder; },
      single() { call.single = "one"; return builder; },
      then(resolve, reject) {
        calls.push(call);
        return Promise.resolve(handler(call) ?? { data: null, error: null }).then(resolve, reject);
      },
    };
    for (const m of ["eq", "neq", "in", "gt", "gte", "lt", "lte", "order", "limit", "ilike"]) {
      builder[m] = (...args) => { call.filters.push([m, ...args]); return builder; };
    }
    return builder;
  }

  return { supabase: { from }, calls };
}

/** Value of the first `eq` filter on `column`, or undefined. */
export function eqValue(call, column) {
  return call.filters.find(([m, c]) => m === "eq" && c === column)?.[2];
}
