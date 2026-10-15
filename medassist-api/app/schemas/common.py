"""Shared schema base and literal types. Mirrors Client/src/features/medassist/types.js."""

from typing import Literal

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

Role = Literal["user", "assistant", "pharmacist"]
Route = Literal[
    "knowledge", "product", "both", "out_of_scope", "emergency", "escalated", "no_evidence"
]
EscalationReason = Literal[
    "personal_dosing", "prescription_only", "pregnancy_or_child", "no_evidence"
]
EscalationStatus = Literal["pending", "answered"]
Variant = Literal["agent"]  # the DB column also allows older rows' "naive" / "rewrite"


class CamelModel(BaseModel):
    """Base for every API model: snake_case in Python, camelCase in JSON."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


class ApiError(CamelModel):
    """Error body returned by every non-2xx response."""

    status: int
    message: str
    retry_after_sec: int | None = None
