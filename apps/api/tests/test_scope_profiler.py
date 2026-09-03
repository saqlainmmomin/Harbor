"""Pure-function tests for app/services/scope_profiler.py -- no DB, no
network. Covers the P1 scope-correctness findings from
tasks/handoffs/2026-09-03-codex-review-scope-rfi.md: dangling maps_to
references, PCI's unanswered-question handling, the corrected NIST
maps_to families, and the narrowed ISO fully-remote exclusion set."""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.frameworks.definitions.iso27001 import ISO27001_DEFINITION
from app.frameworks.definitions.nist_csf import NIST_CSF_DEFINITION
from app.frameworks.definitions.pci_dss import PCI_DSS_DEFINITION
from app.services import scope_profiler as sp

_ALL_IDS = {
    "iso27001": {c.id for c in ISO27001_DEFINITION.all_controls()},
    "nist_csf": {c.id for c in NIST_CSF_DEFINITION.all_controls()},
    "pci_dss": {c.id for c in PCI_DSS_DEFINITION.all_controls()},
}


def test_every_checklist_maps_to_id_exists():
    """Every maps_to control id referenced by any framework's evidence
    checklist must be a real control id in that framework's own
    definitions -- a typo'd/stale id would silently no-op an RFI's control
    reference instead of erroring anywhere visible."""
    for framework_id, checklist_fn in sp._CHECKLIST_FNS.items():
        all_ids = _ALL_IDS[framework_id]
        for item in checklist_fn():
            for control_id in item["maps_to"]:
                assert control_id in all_ids, f"{framework_id}: {control_id!r} (from {item['label']!r}) is not a real control id"


def test_every_exclusion_id_exists():
    for framework_id, exclusion_fn in sp._EXCLUSION_FNS.items():
        all_ids = _ALL_IDS[framework_id]
        # Exercise every gating answer at once so every candidate id is checked.
        answers = {
            "ISO.SCP.2": "no", "ISO.SCP.3": "no", "ISO.SCP.4": "fully_remote",
            "PCI.SCP.1": "outsourced", "PCI.SCP.2": [], "PCI.SCP.3": "no_tpsp",
        }
        for excl in exclusion_fn(answers):
            assert excl["id"] in all_ids, f"{framework_id}: excluded id {excl['id']!r} is not a real control id"


def test_pci_unanswered_ecommerce_does_not_exclude():
    """A missing PCI.SCP.2 answer must not be treated as 'no e-commerce'."""
    excluded = sp._compute_pci_dss_exclusions({})
    excluded_ids = {e["id"] for e in excluded}
    assert "PCI.6.6" not in excluded_ids


def test_pci_explicit_empty_channels_excludes_ecommerce_control():
    """An explicit answer of "no channels selected" is a real answer and
    should still exclude PCI.6.6 -- only *absence* of the key is unresolved."""
    excluded = sp._compute_pci_dss_exclusions({"PCI.SCP.2": []})
    excluded_ids = {e["id"] for e in excluded}
    assert "PCI.6.6" in excluded_ids


def test_pci_answered_with_ecommerce_channel_keeps_control():
    excluded = sp._compute_pci_dss_exclusions({"PCI.SCP.2": ["ecommerce", "pos"]})
    excluded_ids = {e["id"] for e in excluded}
    assert "PCI.6.6" not in excluded_ids


def test_iso_fully_remote_excludes_only_premises_controls():
    excluded = sp._compute_iso27001_exclusions({"ISO.SCP.4": "fully_remote"})
    excluded_ids = {e["id"] for e in excluded}
    # Premises-specific controls: excluded.
    for cid in ("ISO.A7.1", "ISO.A7.2", "ISO.A7.3", "ISO.A7.4", "ISO.A7.5", "ISO.A7.6", "ISO.A7.7", "ISO.A7.11", "ISO.A7.12"):
        assert cid in excluded_ids, f"{cid} should be excluded for a fully remote org"
    # Off-premises asset / media / maintenance / disposal controls: NOT excluded.
    for cid in ("ISO.A7.8", "ISO.A7.9", "ISO.A7.10", "ISO.A7.13", "ISO.A7.14"):
        assert cid not in excluded_ids, f"{cid} (off-premises asset/media/maintenance/disposal) must stay applicable when fully remote"


def test_iso_missing_remote_answer_excludes_nothing():
    excluded = sp._compute_iso27001_exclusions({})
    assert excluded == []


def test_nist_checklist_maps_to_matches_named_family():
    """Each NIST checklist item's maps_to ids must belong to the function
    family named in its own `reason` text -- this is the exact class of bug
    the review found (reason names ID.AM, maps_to pointed at GV.OC)."""
    checklist = {item["document_type"]: item for item in sp._nist_csf_checklist()}

    def family_of(control_id: str) -> str:
        # e.g. "NIST.ID.AM.01" -> "ID.AM"
        parts = control_id.split(".")
        return f"{parts[1]}.{parts[2]}"

    expectations = {
        "asset_inventory": "ID.AM",
        "risk_assessment": "ID.RA",
        "access_control_policy": "PR.AA",
        "supply_chain_risk_docs": "GV.SC",
    }
    for doc_type, expected_family in expectations.items():
        for control_id in checklist[doc_type]["maps_to"]:
            assert family_of(control_id) == expected_family, (
                f"{doc_type}: {control_id} is not in the {expected_family} family"
            )

    # monitoring_procedures names DE.CM/DE.AE; incident_response_plan names
    # RS.*; recovery_plan names RC.*  -- checked as "any of the named
    # families", since each of these reasons names more than one.
    monitoring_families = {family_of(c) for c in checklist["monitoring_procedures"]["maps_to"]}
    assert monitoring_families <= {"DE.CM", "DE.AE"}
    incident_families = {family_of(c) for c in checklist["incident_response_plan"]["maps_to"]}
    assert incident_families <= {"RS.MA", "RS.AN", "RS.CO", "RS.MI"}
    recovery_families = {family_of(c) for c in checklist["recovery_plan"]["maps_to"]}
    assert recovery_families <= {"RC.RP", "RC.CO"}


def test_validate_scope_answers_complete_flags_missing_question():
    missing = sp.validate_scope_answers_complete({"pci_dss": {"PCI.SCP.1": "outsourced"}})
    # PCI has 4 scope questions; only one was answered.
    assert "PCI.SCP.2" in missing
    assert "PCI.SCP.3" in missing
    assert "PCI.SCP.4" in missing
    assert "PCI.SCP.1" not in missing


def test_validate_scope_answers_complete_passes_when_all_present():
    full_pci_answers = {q.id: "x" for q in PCI_DSS_DEFINITION.scope_questions}
    missing = sp.validate_scope_answers_complete({"pci_dss": full_pci_answers})
    assert missing == []


def test_compute_scope_drops_checklist_items_whose_controls_are_all_excluded():
    result = sp.compute_scope("pci_dss", {"PCI.SCP.2": []})
    doc_types = {item["document_type"] for item in result["evidence_checklist"]}
    assert "payment_page_integrity_docs" not in doc_types
