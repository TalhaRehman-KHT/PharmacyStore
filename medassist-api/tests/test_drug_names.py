"""Drug name normalization and drug list building (no network, no DB)."""

import pytest

from app.ingest.make_drug_list import build, read_extras, render_report
from app.ingest.names import clean_generic, clean_label, normalize_generic


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("Paracetamol 500mg Tablets", ["acetaminophen"]),
        ("Amoxicillin + Clavulanic Acid 625 mg", ["amoxicillin", "clavulanate"]),
        ("Salbutamol (Albuterol) Inhaler", ["albuterol"]),
        ("Metformin HCl 500 mg", ["metformin"]),
        ("Diclofenac Sodium 50mg Tab", ["diclofenac"]),
        ("Amlodipine Besylate", ["amlodipine"]),
        ("Sodium Chloride 0.9% Infusion", ["sodium chloride"]),
        ("Ferrous Sulphate 200mg", ["ferrous sulfate"]),
        ("Magnesium Sulfate", ["magnesium sulfate"]),
        ("Losartan/Hydrochlorothiazide 50/12.5mg", ["losartan", "hydrochlorothiazide"]),
        ("Amoxicillin 250mg/5ml Suspension", ["amoxicillin"]),
        ("Sulfamethoxazole and Trimethoprim", ["sulfamethoxazole", "trimethoprim"]),
        ("Frusemide 40 mg", ["furosemide"]),
        ("Ciclosporin", ["cyclosporine"]),
        ("PARACETAMOL, paracetamol", ["acetaminophen"]),
        ("  Omeprazole   20 MG  Capsules ", ["omeprazole"]),
        ("Vitamin D3 1000 IU", ["vitamin d3"]),
        ("Co-trimoxazole", ["co-trimoxazole"]),
        ("", []),
        ("   ", []),
        (None, []),
        ("500 mg", []),
        ("(  )", []),
        ("+ / ,", []),
        ("Tablets", []),
        ("µg 5", []),
    ],
)
def test_normalize_generic(raw, expected):
    assert normalize_generic(raw) == expected


def test_clean_generic_keeps_inn_name():
    assert clean_generic("Amoxicillin + Clavulanic Acid") == ["amoxicillin", "clavulanic acid"]


def test_clean_label_keeps_brand_whole():
    assert clean_label("Augmentin 625mg Tablets") == "augmentin"
    assert clean_label("Panadol Extra Tab.") == "panadol extra"


def row(name, generic=None):
    return {"id": name, "name": name, "generic_name": generic}


def test_build_brand_becomes_synonym():
    r = build([row("Augmentin 625mg Tablets", "Amoxicillin + Clavulanic Acid")])
    assert r.synonyms == [
        ("augmentin", "amoxicillin + clavulanic acid", "amoxicillin + clavulanate", "product_table")
    ]
    assert r.drugs == ["amoxicillin", "clavulanate"]


def test_build_generic_product_is_not_a_synonym():
    r = build([row("Paracetamol 500mg", "Paracetamol"), row("Metformin HCl", "Metformin")])
    assert r.synonyms == []
    assert r.drugs == ["acetaminophen", "metformin"]


def test_build_derives_blank_generic_from_same_brand():
    r = build([row("Panadol 500mg", "Paracetamol"), row("Panadol Tablets", "  ")])
    assert r.derived == [("Panadol Tablets", ["acetaminophen"])]
    assert r.counts["acetaminophen"] == 2


def test_build_derives_blank_generic_from_known_generic_name():
    r = build([row("Omeprazole 40mg", "Omeprazole"), row("Omeprazole 20mg Caps", None)])
    assert r.derived == [("Omeprazole 20mg Caps", ["omeprazole"])]


def test_build_derives_blank_generic_from_us_names_map():
    r = build([row("Salbutamol Inhaler", None)])
    assert r.derived == [("Salbutamol Inhaler", ["albuterol"])]


def test_build_reports_rows_it_cannot_derive():
    r = build([row("Brufen", None), row("Paracetamol", "Paracetamol")])
    assert r.not_derived == ["Brufen"]
    assert r.drugs == ["acetaminophen"]
    assert "- Brufen" in render_report(r)


def test_build_merges_extras():
    r = build([row("Paracetamol", "Paracetamol")], ["ibuprofen", "acetaminophen"])
    assert r.drugs == ["acetaminophen", "ibuprofen"]


def test_top_ten_sorted_by_count_then_name():
    rows = [row(f"A{i}", "Ibuprofen") for i in range(3)] + [
        row("B", "Aspirin"),
        row("C", "Zinc Sulfate"),
        row("D", "Cetirizine"),
        row("E", "Cetirizine"),
    ]
    report = render_report(build(rows))
    top = report.split("## Top 10 generic names")[1].split("##")[0]
    assert top.index("ibuprofen") < top.index("cetirizine") < top.index("aspirin")
    assert top.index("aspirin") < top.index("zinc sulfate")


def test_read_extras(tmp_path):
    path = tmp_path / "drugs_extra.txt"
    path.write_text("# my additions\nParacetamol\n\nibuprofen  # pain\n", encoding="utf-8")
    assert read_extras(path) == ["acetaminophen", "ibuprofen"]
    assert read_extras(tmp_path / "missing.txt") == []
