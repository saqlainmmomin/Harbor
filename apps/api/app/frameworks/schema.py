"""
Framework schema — the contract every compliance framework must implement.

All framework definitions (DPDPA, ISO 27001, GDPR, etc.) produce a
FrameworkDefinition instance that the rest of the system consumes.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Control:
    """Single assessable control/requirement within a framework."""

    id: str  # e.g. "DPDPA.CH2.CONSENT.1", "ISO.A5.1"
    title: str
    description: str
    reference: str  # legislative/standard section ref
    criticality: str  # critical | high | medium | low
    tags: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class Section:
    """Group of related controls within a domain."""

    key: str
    title: str
    weight: float  # relative weight within the domain (section weights sum to ~1.0)
    controls: list[Control] = field(default_factory=list)


@dataclass(frozen=True)
class Domain:
    """Top-level grouping (chapter, clause, function, etc.)."""

    key: str
    title: str
    weight: float  # relative weight in overall scoring (domain weights sum to 1.0)
    sections: dict[str, Section] = field(default_factory=dict)


@dataclass(frozen=True)
class QuestionDef:
    """Question mapped to a control."""

    control_id: str
    question: str
    guidance: str = ""


@dataclass(frozen=True)
class ScopeQuestion:
    """Framework-specific applicability question."""

    id: str
    question: str
    help_text: str
    type: str  # single_select | multi_select
    options: list[dict] = field(default_factory=list)


@dataclass(frozen=True)
class RedFlagPattern:
    """Skepticism guideline for Claude prompts."""

    pattern: str  # what to look for
    description: str  # why it's a red flag
    severity: str = "medium"  # low | medium | high


@dataclass
class FrameworkDefinition:
    """Complete definition of a compliance framework."""

    id: str  # e.g. "dpdpa", "iso27001", "gdpr"
    name: str  # display name
    version: str  # e.g. "2023", "2022", "2016/679"
    description: str = ""

    domains: dict[str, Domain] = field(default_factory=dict)
    dependencies: dict[str, list[str]] = field(default_factory=dict)
    root_cause_clusters: dict[str, dict] = field(default_factory=dict)

    scope_questions: list[ScopeQuestion] = field(default_factory=list)
    questions: dict[str, QuestionDef] = field(default_factory=dict)
    red_flag_patterns: list[RedFlagPattern] = field(default_factory=list)

    # -- derived helpers ---------------------------------------------------

    def all_controls(self) -> list[Control]:
        """Flatten all controls across domains/sections."""
        controls = []
        for domain in self.domains.values():
            for section in domain.sections.values():
                controls.extend(section.controls)
        return controls

    def all_controls_enriched(self) -> list[dict]:
        """Flatten controls with domain/section metadata (mirrors legacy get_all_requirements)."""
        result = []
        for domain_key, domain in self.domains.items():
            for section_key, section in domain.sections.items():
                for ctrl in section.controls:
                    result.append(
                        {
                            "id": ctrl.id,
                            "title": ctrl.title,
                            "description": ctrl.description,
                            "section_ref": ctrl.reference,
                            "criticality": ctrl.criticality,
                            "tags": ctrl.tags,
                            "chapter": domain_key,
                            "chapter_title": domain.title,
                            "section": section_key,
                            "section_title": section.title,
                        }
                    )
        return result

    def control_count(self) -> int:
        return len(self.all_controls())

    def get_control(self, control_id: str) -> Control | None:
        for ctrl in self.all_controls():
            if ctrl.id == control_id:
                return ctrl
        return None

    def domain_weight_map(self) -> dict[str, float]:
        """Return {domain_key: weight} for scoring."""
        return {k: d.weight for k, d in self.domains.items()}

    def as_legacy_framework_dict(self) -> dict:
        """
        Convert back to the nested dict format used by existing DPDPA code.

        Returns a dict shaped like DPDPA_FRAMEWORK so that existing scoring,
        prompt building, and questionnaire code can consume it without changes.
        """
        framework = {}
        for domain_key, domain in self.domains.items():
            sections = {}
            for section_key, section in domain.sections.items():
                sections[section_key] = {
                    "title": section.title,
                    "weight": section.weight,
                    "requirements": [
                        {
                            "id": ctrl.id,
                            "title": ctrl.title,
                            "description": ctrl.description,
                            "section_ref": ctrl.reference,
                            "criticality": ctrl.criticality,
                        }
                        for ctrl in section.controls
                    ],
                }
            framework[domain_key] = {
                "title": domain.title,
                "weight": domain.weight,
                "sections": sections,
            }
        return framework
