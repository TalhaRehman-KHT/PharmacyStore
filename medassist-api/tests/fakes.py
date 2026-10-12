"""In-memory stand-in for the async supabase client (only what the repositories use).

Rows are dicts in lists. Ids are uuid4 strings; created_at/updated_at come from a fake clock
that moves forward one second per write, so ordering is deterministic. Mirrors the SQL defaults,
the touch_chat_session trigger, unique(message_id, user_id) on feedback and the ON DELETE
CASCADE foreign keys. `queries` counts every execute() (for query-count tests).
"""

import copy
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import uuid4

DEFAULTS = {
    "chat_sessions": {"title": "New chat"},
    "chat_messages": {
        "route": None,
        "citations": [],
        "products": [],
        "variant": None,
        "latency_ms": None,
        "tokens": None,
    },
    "escalations": {
        "status": "pending",
        "pharmacist_id": None,
        "reply": None,
        "answered_at": None,
        "chunk_ids": [],
        "pharmacy_id": None,
    },
    "feedback": {"comment": None},
}
UNIQUE = {"feedback": ("message_id", "user_id")}
# Live RPC signatures (docs/DB_SCHEMA.md). PostgREST resolves a function by its parameter
# NAMES, so a wrong name fails against the real DB; the fake fails the same way.
RPC_PARAMS = {"answer_escalation": ("p_id", "p_pharmacist", "p_reply")}
# parent table -> [(child table, child column)] deleted with the parent row.
CASCADES = {
    "users": [("chat_sessions", "user_id")],
    "chat_sessions": [("chat_messages", "session_id"), ("escalations", "session_id")],
    "chat_messages": [("feedback", "message_id"), ("escalations", "message_id")],
}


class FakeError(Exception):
    """Raised where Postgres would raise (unique violation, .single() mismatch)."""


class FakeSupabase:
    def __init__(self) -> None:
        self.tables: dict[str, list[dict]] = {}
        self.rpc_handlers: dict = {}
        self.queries = 0
        self._clock = datetime(2026, 1, 1, tzinfo=UTC)

    # --- client API ---
    def table(self, name: str) -> "_Query":
        return _Query(self, name)

    def rpc(self, name: str, params: dict) -> "_Rpc":
        return _Rpc(self, name, params)

    # --- test helpers ---
    def now(self) -> str:
        self._clock += timedelta(seconds=1)
        return self._clock.isoformat()

    def rows(self, name: str) -> list[dict]:
        return self.tables.setdefault(name, [])

    def seed(self, table: str, /, **row) -> dict:
        """Insert one row directly (with defaults) and return it. `table` is positional-only, so
        a column called `name` (users.name) can be passed as a keyword."""
        return self._insert(table, [row])[0]

    def register_answer_escalation(self) -> None:
        """Mimic sql/008 answer_escalation: atomic update of a pending row + pharmacist message."""

        def handler(params: dict):
            if not (params["p_reply"] or "").strip():
                raise FakeError("reply must not be empty")
            for esc in self.rows("escalations"):
                if esc["id"] == params["p_id"] and esc["status"] == "pending":
                    esc.update(
                        status="answered",
                        pharmacist_id=params["p_pharmacist"],
                        reply=params["p_reply"],
                        answered_at=self.now(),
                    )
                    self.seed(
                        "chat_messages",
                        session_id=esc["session_id"],
                        user_id=esc["user_id"],
                        role="pharmacist",
                        content=params["p_reply"],
                    )
                    return esc["id"]
            return None

        self.rpc_handlers["answer_escalation"] = handler

    # --- internals ---
    def _insert(self, name: str, rows: list[dict]) -> list[dict]:
        out = []
        for row in rows:
            now = self.now()
            full = {"id": str(uuid4()), "created_at": now, **DEFAULTS.get(name, {}), **row}
            if name == "chat_sessions":
                full.setdefault("updated_at", now)
            self._check_unique(name, full)
            self.rows(name).append(full)
            if name == "chat_messages":  # trigger touch_chat_session
                for s in self.rows("chat_sessions"):
                    if s["id"] == full["session_id"]:
                        s["updated_at"] = now
            out.append(full)
        return out

    def _check_unique(self, name: str, row: dict) -> None:
        cols = UNIQUE.get(name)
        if cols and any(all(r[c] == row[c] for c in cols) for r in self.rows(name)):
            raise FakeError(f"duplicate key value violates unique constraint on {name}{cols}")

    def _delete(self, name: str, victims: list[dict]) -> None:
        for row in victims:
            for child, column in CASCADES.get(name, []):
                self._delete(child, [r for r in self.rows(child) if r[column] == row["id"]])
            if row in self.rows(name):
                self.rows(name).remove(row)


class _Query:
    def __init__(self, db: FakeSupabase, name: str) -> None:
        self.db = db
        self.name = name
        self.op = "select"
        self.payload = None
        self.on_conflict = None
        self.filters: list = []
        self.order_by: list = []
        self.limit_n = None
        self.mode = "many"

    def select(self, _columns: str = "*", **_kwargs) -> "_Query":
        return self

    def insert(self, rows) -> "_Query":
        self.op, self.payload = "insert", rows if isinstance(rows, list) else [rows]
        return self

    def upsert(self, rows, on_conflict: str = "") -> "_Query":
        self.op, self.payload = "upsert", rows if isinstance(rows, list) else [rows]
        self.on_conflict = [c.strip() for c in on_conflict.split(",") if c.strip()]
        return self

    def update(self, values: dict) -> "_Query":
        self.op, self.payload = "update", values
        return self

    def delete(self) -> "_Query":
        self.op = "delete"
        return self

    def eq(self, column: str, value) -> "_Query":
        self.filters.append(lambda r: r.get(column) == value)
        return self

    def in_(self, column: str, values) -> "_Query":
        allowed = list(values)
        self.filters.append(lambda r: r.get(column) in allowed)
        return self

    def order(self, column: str, desc: bool = False) -> "_Query":
        self.order_by.append((column, desc))
        return self

    def limit(self, n: int) -> "_Query":
        self.limit_n = n
        return self

    def maybe_single(self) -> "_Query":
        self.mode = "maybe_single"
        return self

    def single(self) -> "_Query":
        self.mode = "single"
        return self

    def _matching(self) -> list[dict]:
        return [r for r in self.db.rows(self.name) if all(f(r) for f in self.filters)]

    async def execute(self):
        self.db.queries += 1
        if self.op == "insert":
            return SimpleNamespace(data=copy.deepcopy(self.db._insert(self.name, self.payload)))
        if self.op == "upsert":
            return SimpleNamespace(data=copy.deepcopy(self._upsert()))
        if self.op == "update":
            rows = self._matching()
            for r in rows:
                r.update(self.payload)
            return SimpleNamespace(data=copy.deepcopy(rows))
        if self.op == "delete":
            rows = self._matching()
            self.db._delete(self.name, rows)
            return SimpleNamespace(data=copy.deepcopy(rows))

        rows = self._matching()
        for column, desc in reversed(self.order_by):
            rows.sort(key=lambda r, c=column: r.get(c), reverse=desc)
        if self.limit_n is not None:
            rows = rows[: self.limit_n]
        rows = copy.deepcopy(rows)
        if self.mode == "maybe_single":
            return SimpleNamespace(data=rows[0]) if rows else None  # supabase-py 2.x returns None
        if self.mode == "single":
            if len(rows) != 1:
                raise FakeError(f"single() expected 1 row, got {len(rows)}")
            return SimpleNamespace(data=rows[0])
        return SimpleNamespace(data=rows)

    def _upsert(self) -> list[dict]:
        out = []
        for row in self.payload:
            existing = next(
                (
                    r
                    for r in self.db.rows(self.name)
                    if self.on_conflict and all(r.get(c) == row.get(c) for c in self.on_conflict)
                ),
                None,
            )
            if existing is not None:
                existing.update(row)
                out.append(existing)
            else:
                out.extend(self.db._insert(self.name, [row]))
        return out


class _Rpc:
    def __init__(self, db: FakeSupabase, name: str, params: dict) -> None:
        self.db, self.name, self.params = db, name, params

    async def execute(self):
        self.db.queries += 1
        expected = RPC_PARAMS.get(self.name)
        if expected is None:
            raise FakeError(f"rpc {self.name!r} has no known live signature (add it to RPC_PARAMS)")
        if set(self.params) != set(expected):
            raise FakeError(
                f"Could not find the function public.{self.name}({', '.join(sorted(self.params))});"
                f" live signature is ({', '.join(expected)})"
            )
        handler = self.db.rpc_handlers.get(self.name)
        if handler is None:
            raise FakeError(f"no fake handler registered for rpc {self.name!r}")
        return SimpleNamespace(data=handler(self.params))
