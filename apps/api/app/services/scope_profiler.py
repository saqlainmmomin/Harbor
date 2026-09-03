"""Scope Profiler — deterministic control filtering and evidence checklist
generation for ISO 27001, NIST CSF, and PCI-DSS.

Follows the compute_scope/_exclude(ids, reason) pattern from CyberAssess's
app/services/scope_profiler.py, but the exclusion rule tables here are new:
that sibling project only has this logic wired up for DPDPA (out of scope
for this app). ISO/NIST/PCI's ScopeQuestion lists exist there too but
nothing consumes the answers -- these rule tables are what does that, keyed
off each framework's own scope-question IDs and control IDs/tags.
"""

from __future__ import annotations

from app.frameworks.definitions.iso27001 import ISO27001_DEFINITION
from app.frameworks.definitions.nist_csf import NIST_CSF_DEFINITION
from app.frameworks.definitions.pci_dss import PCI_DSS_DEFINITION
from app.frameworks.schema import FrameworkDefinition

# Registry keyed by each FrameworkDefinition's own `id` field -- main.py's
# VALID_FRAMEWORKS strings (ISO27001/NIST_CSF/PCI_DSS) map onto these via
# .lower().
FRAMEWORKS: dict[str, FrameworkDefinition] = {
    "iso27001": ISO27001_DEFINITION,
    "nist_csf": NIST_CSF_DEFINITION,
    "pci_dss": PCI_DSS_DEFINITION,
}


def get_framework(framework_id: str) -> FrameworkDefinition | None:
    return FRAMEWORKS.get(framework_id)


def _exclude(excluded: list[dict], all_ids: set[str], ids: set[str], reason: str) -> None:
    for control_id in ids:
        if control_id in all_ids:
            excluded.append({"id": control_id, "reason": reason})


# ── ISO 27001 ────────────────────────────────────────────────────────────
# Gated on the four ISO.SCP.* questions in definitions/iso27001.py, using
# the control ranges named in their own help_text.

_ISO_CLOUD_CONTROLS = {"ISO.A5.23"}
_ISO_SOFTWARE_DEV_CONTROLS = {f"ISO.A8.{n}" for n in range(25, 35)}
_ISO_PHYSICAL_CONTROLS = {f"ISO.A7.{n}" for n in range(1, 15)}


def _compute_iso27001_exclusions(answers: dict) -> list[dict]:
    all_ids = {c.id for c in ISO27001_DEFINITION.all_controls()}
    excluded: list[dict] = []

    if answers.get("ISO.SCP.2") == "no":
        _exclude(excluded, all_ids, _ISO_CLOUD_CONTROLS, "Cloud services: not used")
    if answers.get("ISO.SCP.3") == "no":
        _exclude(
            excluded, all_ids, _ISO_SOFTWARE_DEV_CONTROLS,
            "Software development: not performed in-house or outsourced",
        )
    if answers.get("ISO.SCP.4") == "fully_remote":
        _exclude(
            excluded, all_ids, _ISO_PHYSICAL_CONTROLS,
            "Physical premises: fully remote, no on-prem information processing facilities",
        )
    return excluded


# ── NIST CSF 2.0 ─────────────────────────────────────────────────────────
# Of the four NIST.SCP.* questions, only SCP.3 (OT/ICS) names a control
# subset in its own help_text -- and the ported CSF 2.0 definition doesn't
# carry any OT/ICS-specific controls (the six functions apply uniformly
# regardless of asset type). So there's nothing to exclude on that answer;
# SCP.1/2/4 (critical-infra status, current tier, profile maturity)
# describe assessment context/depth, not applicability, and don't gate any
# control either. This framework's exclusion set is legitimately empty --
# left as a function (not omitted) so it stays consistent with the other
# two and easy to extend if a future control set adds OT-specific items.

def _compute_nist_csf_exclusions(answers: dict) -> list[dict]:
    return []


# ── PCI-DSS v4.0 ─────────────────────────────────────────────────────────
# Gated on the four PCI.SCP.* questions in definitions/pci_dss.py.

_PCI_PHYSICAL_CONTROLS = {f"PCI.9.{n}" for n in range(1, 5)}
_PCI_ECOMMERCE_CONTROLS = {"PCI.6.6"}
_PCI_TPSP_CONTROLS = {"PCI.12.8", "PCI.12.9"}


def _compute_pci_dss_exclusions(answers: dict) -> list[dict]:
    all_ids = {c.id for c in PCI_DSS_DEFINITION.all_controls()}
    excluded: list[dict] = []

    if answers.get("PCI.SCP.1") == "outsourced":
        _exclude(
            excluded, all_ids, _PCI_PHYSICAL_CONTROLS,
            "Cardholder data environment: fully outsourced, no on-premises CDE",
        )
    channels = answers.get("PCI.SCP.2") or []
    if isinstance(channels, str):
        channels = [channels]
    if "ecommerce" not in channels:
        _exclude(
            excluded, all_ids, _PCI_ECOMMERCE_CONTROLS,
            "Payment channels: no e-commerce / consumer-browser payment pages",
        )
    if answers.get("PCI.SCP.3") == "no_tpsp":
        _exclude(
            excluded, all_ids, _PCI_TPSP_CONTROLS,
            "Third-party service providers: all processing handled in-house",
        )
    return excluded


_EXCLUSION_FNS = {
    "iso27001": _compute_iso27001_exclusions,
    "nist_csf": _compute_nist_csf_exclusions,
    "pci_dss": _compute_pci_dss_exclusions,
}


# ── Evidence checklist ──────────────────────────────────────────────────
# One entry per document type a framework's controls actually ask for,
# derived from reading each framework's own control titles/descriptions --
# not DPDPA's hardcoded list. `maps_to` feeds RFI generation (each checklist
# item becomes one draft evidence-request item).

def _iso27001_checklist() -> list[dict]:
    return [
        {
            "document_type": "information_security_policy",
            "label": "Information Security Policy",
            "reason": "Assessed against A.5.1 (policies for information security)",
            "required": True,
            "maps_to": ["ISO.A5.1"],
        },
        {
            "document_type": "access_control_policy",
            "label": "Access Control Policy",
            "reason": "Assessed against A.5.15-A.5.18 (access control, identity/authentication management)",
            "required": True,
            "maps_to": ["ISO.A5.15", "ISO.A5.16", "ISO.A5.17", "ISO.A5.18"],
        },
        {
            "document_type": "risk_assessment",
            "label": "Information Security Risk Assessment",
            "reason": "Assessed against A.5.7 and the ISMS risk treatment process",
            "required": True,
            "maps_to": ["ISO.A5.7"],
        },
        {
            "document_type": "incident_response_plan",
            "label": "Incident Response Plan / Procedures",
            "reason": "Assessed against A.5.24-A.5.28 (incident management)",
            "required": True,
            "maps_to": ["ISO.A5.24", "ISO.A5.25", "ISO.A5.26"],
        },
        {
            "document_type": "hr_security_docs",
            "label": "HR Security Documentation (screening, terms, awareness training records)",
            "reason": "Assessed against People domain controls (A.6.1-A.6.8)",
            "required": True,
            "maps_to": ["ISO.A6.1", "ISO.A6.3"],
        },
        {
            "document_type": "cloud_services_agreement",
            "label": "Cloud Service Provider Agreements / Security Reviews",
            "reason": "Assessed against A.5.23 (information security for cloud services)",
            "required": True,
            "maps_to": ["ISO.A5.23"],
        },
        {
            "document_type": "secure_development_policy",
            "label": "Secure Development Lifecycle Policy",
            "reason": "Assessed against A.8.25-A.8.34 (secure development)",
            "required": True,
            "maps_to": [f"ISO.A8.{n}" for n in range(25, 35)],
        },
        {
            "document_type": "physical_security_docs",
            "label": "Physical & Environmental Security Documentation",
            "reason": "Assessed against A.7.1-A.7.14 (physical controls)",
            "required": True,
            "maps_to": [f"ISO.A7.{n}" for n in range(1, 15)],
        },
        {
            "document_type": "asset_inventory",
            "label": "Asset Inventory",
            "reason": "Assessed against A.5.9 (inventory of information and other associated assets)",
            "required": False,
            "maps_to": ["ISO.A5.9"],
        },
    ]


def _nist_csf_checklist() -> list[dict]:
    return [
        {
            "document_type": "governance_charter",
            "label": "Cybersecurity Governance Charter / Strategy",
            "reason": "Assessed against the Govern function (GV.OC, GV.RM, GV.PO)",
            "required": True,
            "maps_to": ["NIST.GV.OC.01", "NIST.GV.RM.01", "NIST.GV.PO.01"],
        },
        {
            "document_type": "asset_inventory",
            "label": "Asset Inventory (hardware, software, data)",
            "reason": "Assessed against the Identify function's asset management category (ID.AM)",
            "required": True,
            "maps_to": ["NIST.GV.OC.01"],
        },
        {
            "document_type": "risk_assessment",
            "label": "Cybersecurity Risk Assessment",
            "reason": "Assessed against the Identify function's risk assessment category (ID.RA)",
            "required": True,
            "maps_to": ["NIST.GV.RM.01"],
        },
        {
            "document_type": "access_control_policy",
            "label": "Identity & Access Management Policy",
            "reason": "Assessed against the Protect function's access control category (PR.AA)",
            "required": True,
            "maps_to": ["NIST.GV.PO.01"],
        },
        {
            "document_type": "monitoring_procedures",
            "label": "Continuous Monitoring / Detection Procedures",
            "reason": "Assessed against the Detect function (DE.CM, DE.AE)",
            "required": True,
            "maps_to": ["NIST.GV.OC.01"],
        },
        {
            "document_type": "incident_response_plan",
            "label": "Incident Response Plan",
            "reason": "Assessed against the Respond function (RS.MA, RS.AN, RS.CO, RS.MI)",
            "required": True,
            "maps_to": ["NIST.GV.RR.01"],
        },
        {
            "document_type": "recovery_plan",
            "label": "Recovery / Business Continuity Plan",
            "reason": "Assessed against the Recover function (RC.RP, RC.CO)",
            "required": True,
            "maps_to": ["NIST.GV.RR.01"],
        },
        {
            "document_type": "supply_chain_risk_docs",
            "label": "Supply Chain Risk Management Documentation",
            "reason": "Assessed against the Govern function's supply chain category (GV.SC)",
            "required": False,
            "maps_to": ["NIST.GV.RM.01"],
        },
    ]


def _pci_dss_checklist() -> list[dict]:
    return [
        {
            "document_type": "network_diagram",
            "label": "Network Diagram / CDE Segmentation Documentation",
            "reason": "Assessed against Requirement 1 (network security controls)",
            "required": True,
            "maps_to": ["PCI.1.1", "PCI.1.2"],
        },
        {
            "document_type": "data_retention_policy",
            "label": "Cardholder Data Retention & Disposal Policy",
            "reason": "Assessed against Requirement 3 (protect stored account data)",
            "required": True,
            "maps_to": ["PCI.3.1"],
        },
        {
            "document_type": "encryption_standards",
            "label": "Encryption / Key Management Standards",
            "reason": "Assessed against Requirements 3-4 (protect stored/transmitted data)",
            "required": True,
            "maps_to": ["PCI.3.6", "PCI.4.1"],
        },
        {
            "document_type": "vulnerability_management_policy",
            "label": "Vulnerability Management / Patch Management Policy",
            "reason": "Assessed against Requirement 6 (develop and maintain secure systems)",
            "required": True,
            "maps_to": ["PCI.6.1", "PCI.6.2"],
        },
        {
            "document_type": "access_control_policy",
            "label": "Access Control Policy (need-to-know, unique IDs, MFA)",
            "reason": "Assessed against Requirements 7-8 (access control)",
            "required": True,
            "maps_to": ["PCI.7.1", "PCI.8.1"],
        },
        {
            "document_type": "physical_security_docs",
            "label": "Physical Security Documentation (CDE facilities, media handling)",
            "reason": "Assessed against Requirement 9 (restrict physical access)",
            "required": True,
            "maps_to": list(_PCI_PHYSICAL_CONTROLS),
        },
        {
            "document_type": "logging_policy",
            "label": "Logging & Monitoring Policy",
            "reason": "Assessed against Requirement 10 (log and monitor access)",
            "required": True,
            "maps_to": ["PCI.10.1"],
        },
        {
            "document_type": "security_testing_reports",
            "label": "Penetration Test / Vulnerability Scan Reports",
            "reason": "Assessed against Requirement 11 (test security regularly)",
            "required": True,
            "maps_to": ["PCI.11.2", "PCI.11.3"],
        },
        {
            "document_type": "information_security_policy",
            "label": "Information Security Policy",
            "reason": "Assessed against Requirement 12 (organizational security policy)",
            "required": True,
            "maps_to": ["PCI.12.1"],
        },
        {
            "document_type": "payment_page_integrity_docs",
            "label": "Payment Page Script Integrity Controls",
            "reason": "Assessed against Requirement 6.4.3 (e-commerce payment page scripts)",
            "required": False,
            "maps_to": list(_PCI_ECOMMERCE_CONTROLS),
        },
        {
            "document_type": "tpsp_agreements",
            "label": "Third-Party Service Provider Agreements",
            "reason": "Assessed against Requirement 12.8-12.9 (TPSP risk management)",
            "required": False,
            "maps_to": list(_PCI_TPSP_CONTROLS),
        },
    ]


_CHECKLIST_FNS = {
    "iso27001": _iso27001_checklist,
    "nist_csf": _nist_csf_checklist,
    "pci_dss": _pci_dss_checklist,
}


def compute_scope(framework_id: str, scope_answers: dict) -> dict:
    """Compute applicable/excluded controls and the evidence checklist for
    one framework. Returns {"applicable_controls", "excluded_controls",
    "evidence_checklist"}. Raises KeyError if framework_id isn't registered
    -- callers (main.py) validate against VALID_FRAMEWORKS first."""
    fw = FRAMEWORKS[framework_id]
    all_ids = [c.id for c in fw.all_controls()]

    excluded = _EXCLUSION_FNS[framework_id](scope_answers)
    excluded_ids = {e["id"] for e in excluded}
    applicable = [cid for cid in all_ids if cid not in excluded_ids]

    checklist = [
        item for item in _CHECKLIST_FNS[framework_id]()
        # Drop checklist items whose controls are entirely excluded -- no
        # point asking for a document that maps only to out-of-scope controls.
        if any(cid not in excluded_ids for cid in item["maps_to"])
    ]

    return {
        "applicable_controls": applicable,
        "excluded_controls": excluded,
        "evidence_checklist": checklist,
    }


def compute_scope_multi(scope_answers_by_framework: dict[str, dict]) -> dict:
    """Union compute_scope() across multiple frameworks selected for one
    engagement. No cross-framework dedup/UCC clustering -- explicitly out of
    scope for this slice (see handoff)."""
    applicable: list[str] = []
    excluded: list[dict] = []
    checklist: list[dict] = []

    for framework_id, answers in scope_answers_by_framework.items():
        result = compute_scope(framework_id, answers)
        applicable.extend(result["applicable_controls"])
        excluded.extend(result["excluded_controls"])
        checklist.extend(result["evidence_checklist"])

    return {
        "applicable_controls": applicable,
        "excluded_controls": excluded,
        "evidence_checklist": checklist,
    }
