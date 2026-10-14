"""FDA label structure: openFDA field -> section title, row dataclasses, section text, metadata."""

from dataclasses import dataclass, field

# openFDA field -> section title, in output order (boxed_warning always first).
# Old-format labels use "warnings"/"precautions"; new ones use "warnings_and_cautions".
SECTION_MAP: dict[str, str] = {
    "boxed_warning": "Boxed Warning",
    "indications_and_usage": "Indications and Usage",
    "dosage_and_administration": "Dosage and Administration",
    "dosage_forms_and_strengths": "Dosage Forms and Strengths",
    "contraindications": "Contraindications",
    "warnings_and_cautions": "Warnings and Precautions",
    "warnings": "Warnings",
    "precautions": "Precautions",
    "adverse_reactions": "Adverse Reactions",
    "drug_interactions": "Drug Interactions",
    "use_in_specific_populations": "Use in Specific Populations",
    "pregnancy": "Pregnancy",
    "nursing_mothers": "Lactation",
    "pediatric_use": "Pediatric Use",
    "geriatric_use": "Geriatric Use",
    "overdosage": "Overdosage",
    "mechanism_of_action": "Mechanism of Action",
    "clinical_pharmacology": "Clinical Pharmacology",
    "how_supplied": "How Supplied",
    "storage_and_handling": "Storage and Handling",
}


@dataclass
class DocMeta:
    """One drug_documents row."""

    label_id: str
    generic_name: str
    brand_names: list[str] = field(default_factory=list)
    source_url: str | None = None
    effective_date: str | None = None  # YYYY-MM-DD


@dataclass
class Chunk:
    """One drug_chunks row (without the embedding)."""

    label_id: str
    drug_name: str
    section: str
    chunk_index: int  # 0, 1, 2 ... within one section
    content: str  # header line + body text
    metadata: dict = field(default_factory=dict)


def header(drug_name: str, section: str) -> str:
    """First line of every chunk, so the embedding knows the drug and the section."""
    return f"Drug: {drug_name} | Section: {section}"


def section_text(label: dict, field_name: str) -> str:
    """Text of one openFDA field (stored as a list of strings), joined as paragraphs."""
    value = label.get(field_name)
    if not value:
        return ""
    parts = value if isinstance(value, list) else [value]
    return "\n\n".join(str(p).strip() for p in parts if str(p).strip())


def doc_meta(record: dict) -> DocMeta:
    """drug_documents fields from a data/raw/<drug>.json record."""
    label = record["label"]
    openfda = label.get("openfda", {})
    set_id = label.get("set_id") or (openfda.get("spl_set_id") or [None])[0]
    effective = label.get("effective_time") or ""
    return DocMeta(
        label_id=label["id"],
        generic_name=record["drug"],
        brand_names=sorted({b.strip() for b in openfda.get("brand_name", []) if b.strip()}),
        source_url=f"https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid={set_id}"
        if set_id
        else None,
        effective_date=f"{effective[:4]}-{effective[4:6]}-{effective[6:8]}"
        if len(effective) >= 8
        else None,
    )
