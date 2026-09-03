"""Generate realistic, text-bearing evidence PDFs with known ground truth.

This fixture generator intentionally lives outside the application package and has no
effect on production seeding or database state. It uses the locally available fpdf2
package and validates every selected control against the ported framework definitions.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from fpdf import FPDF


FIXTURE_DIR = Path(__file__).resolve().parent
PDF_DIR = FIXTURE_DIR / "pdfs"
API_DIR = FIXTURE_DIR.parents[2]
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from app.frameworks.definitions.iso27001 import ISO27001_DEFINITION
from app.frameworks.definitions.nist_csf import NIST_CSF_DEFINITION
from app.frameworks.definitions.pci_dss import PCI_DSS_DEFINITION


FRAMEWORKS = {
    "ISO27001": ISO27001_DEFINITION,
    "NIST_CSF": NIST_CSF_DEFINITION,
    "PCI_DSS": PCI_DSS_DEFINITION,
}


class EvidencePDF(FPDF):
    """Small business-document layout with a stable text layer."""

    def __init__(self, short_title: str, document_code: str) -> None:
        super().__init__(orientation="P", unit="mm", format="Letter")
        self.short_title = short_title
        self.document_code = document_code
        self.set_margins(18, 16, 18)
        self.set_auto_page_break(auto=True, margin=16)

    def header(self) -> None:
        self.set_font("Helvetica", "B", 8)
        self.set_text_color(86, 96, 108)
        self.cell(0, 4, "NORTHSTAR COMMERCE | CONTROL EVIDENCE", align="L")
        self.ln(5)
        self.set_draw_color(210, 216, 224)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(4)

    def footer(self) -> None:
        self.set_y(-12)
        self.set_font("Helvetica", "I", 7)
        self.set_text_color(110, 118, 126)
        self.cell(0, 4, f"{self.document_code}  |  Page {self.page_no()}", align="R")


def control_metadata(framework: str, control_id: str) -> tuple[str, str, str]:
    definition = FRAMEWORKS[framework]
    control = definition.get_control(control_id)
    if control is None:
        raise ValueError(f"Unknown control {control_id} in {framework}")
    return control.title, control.description, control.reference


def document(
    *,
    framework: str,
    control_id: str,
    status: str,
    filename: str,
    title: str,
    document_type: str,
    document_code: str,
    effective_date: str,
    owner: str,
    sections: list[tuple[str, str]],
    planted_gap: str | None,
) -> dict:
    control_title, control_description, control_reference = control_metadata(framework, control_id)
    return {
        "framework": framework,
        "target_control_id": control_id,
        "control_title": control_title,
        "control_description": control_description,
        "control_reference": control_reference,
        "ground_truth_status": status,
        "file": f"pdfs/{filename}",
        "document_title": title,
        "document_type": document_type,
        "document_code": document_code,
        "effective_date": effective_date,
        "owner": owner,
        "sections": sections,
        "planted_gap": planted_gap,
    }


DOCUMENTS = [
    document(
        framework="ISO27001",
        control_id="ISO.A5.1",
        status="compliant",
        filename="iso_a5_1_compliant_information_security_policy.pdf",
        title="Information Security Policy Suite",
        document_type="Management policy",
        document_code="POL-SEC-001",
        effective_date="2026-01-15",
        owner="Chief Information Security Officer",
        sections=[
            (
                "Purpose and policy set",
                "Northstar Commerce maintains a controlled suite of information security policies covering governance, acceptable use, access control, supplier security, incident response, data handling, and business continuity. The suite applies to employees, contractors, temporary staff, systems, facilities, and information handled on behalf of customers and suppliers.",
            ),
            (
                "Approval and publication",
                "The Executive Risk Committee approved this suite on 15 January 2026. The document owner records approvals and revisions in the policy register. The current approved versions are published in the company intranet policy library and in the supplier portal for relevant interested parties. Superseded versions are retained in the controlled records repository.",
            ),
            (
                "Communication and acknowledgement",
                "People Operations assigns the policy suite to every employee and contractor during onboarding and after material revision. A quarterly communication reminds personnel of their responsibilities. Completion is recorded in the learning system; the 31 March 2026 report shows 486 of 486 assigned personnel acknowledged the current suite. Procurement sends the supplier-security policy summary to in-scope suppliers and records confirmation in the supplier register.",
            ),
            (
                "Maintenance",
                "The CISO reviews the suite at least annually and after a material legal, threat, technology, or organizational change. The next scheduled review is 15 January 2027. Exceptions require written approval from the Executive Risk Committee and an expiry date.",
            ),
        ],
        planted_gap=None,
    ),
    document(
        framework="ISO27001",
        control_id="ISO.A5.1",
        status="partially_compliant",
        filename="iso_a5_1_partial_acknowledgement_gap.pdf",
        title="Information Security Policy",
        document_type="Management policy",
        document_code="POL-SEC-001",
        effective_date="2026-02-01",
        owner="Director, Security and Risk",
        sections=[
            (
                "Purpose and scope",
                "This policy establishes Northstar Commerce's information security direction for corporate systems, production services, offices, and personnel who access company information. Supporting standards cover access control, data classification, incident response, supplier security, and continuity.",
            ),
            (
                "Approval and publication",
                "The Chief Operating Officer approved the policy on 1 February 2026. The current version is published in the internal policy library and the security team sent the February release notice to all employees and contractors. Previous versions remain in the records archive.",
            ),
            (
                "Responsibilities",
                "The Director, Security and Risk owns this policy. Managers are responsible for explaining the policy to their teams and incorporating its requirements into operating procedures. The policy applies to employees, contractors, and temporary personnel.",
            ),
            (
                "Review record",
                "The policy register records management approval and the planned annual review. The February communication report confirms delivery to personnel, but the policy administration export does not contain signed or electronic acknowledgements for the current version. The security team has scheduled an acknowledgement campaign for the next quarterly compliance cycle.",
            ),
        ],
        planted_gap="The policy is defined, management-approved, published, and communicated, but the evidence does not show that relevant personnel and interested parties acknowledged the current version.",
    ),
    document(
        framework="ISO27001",
        control_id="ISO.A5.1",
        status="non_compliant",
        filename="iso_a5_1_noncompliant_policy_template.pdf",
        title="Information Security Policy Template",
        document_type="Unapproved policy template",
        document_code="TEMPLATE-SEC-001",
        effective_date="Draft",
        owner="[Policy owner]",
        sections=[
            (
                "Purpose",
                "This template is provided for completion by [Company name]. It should describe how the organization protects [information assets] and communicate the expectations for [relevant personnel].",
            ),
            (
                "Approval",
                "Approved by: [Approver name and title]. Approval date: [DD/MM/YYYY]. Version: [insert version].",
            ),
            (
                "Publication and communication",
                "Published location: [intranet or controlled repository]. Communication method: [insert method]. Acknowledgement method: [insert system or record]. Relevant interested parties: [list parties].",
            ),
            (
                "Review",
                "Review frequency: [annual / after material change]. Next review date: [DD/MM/YYYY].",
            ),
        ],
        planted_gap="Off-target as evidence: this is an unapproved, unfilled template with no organization-specific policy, publication record, communication record, or acknowledgement evidence.",
    ),
    document(
        framework="ISO27001",
        control_id="ISO.A8.5",
        status="compliant",
        filename="iso_a8_5_compliant_authentication_standard.pdf",
        title="Secure Authentication Standard",
        document_type="Technical standard",
        document_code="STD-IAM-004",
        effective_date="2026-03-10",
        owner="Head of Identity Engineering",
        sections=[
            (
                "Access model",
                "Northstar Commerce uses the Access Control Policy and its information classification rules to determine authentication strength. Public information may use standard customer authentication; internal systems require managed workforce identities; restricted production and customer-data systems require phishing-resistant multi-factor authentication for administrators and privileged operators.",
            ),
            (
                "Workforce and privileged access",
                "Workforce access is federated through the identity provider using FIDO2 security keys or platform passkeys plus device posture checks. Password-only login is disabled for production, VPN, source control, and cloud consoles. Break-glass accounts are stored in the privileged access vault, require two-person approval, and generate an alert on every use. Session timeout and reauthentication requirements follow the system risk tier.",
            ),
            (
                "Services and exceptions",
                "Service identities authenticate with short-lived workload tokens issued by the workload identity platform. Static secrets are prohibited for new integrations and legacy exceptions require an owner, compensating control, expiry date, and quarterly review. Authentication failures and factor changes are forwarded to the security monitoring service for investigation.",
            ),
            (
                "Operations",
                "Identity Engineering reviews authentication policy mappings quarterly and after a material access-control change. The March 2026 review confirmed coverage for 100 percent of production applications in the service catalog.",
            ),
        ],
        planted_gap=None,
    ),
    document(
        framework="ISO27001",
        control_id="ISO.A8.5",
        status="partially_compliant",
        filename="iso_a8_5_partial_service_account_gap.pdf",
        title="Authentication and Login Procedure",
        document_type="Technical procedure",
        document_code="PROC-IAM-012",
        effective_date="2026-04-01",
        owner="Identity Operations Manager",
        sections=[
            (
                "Human user authentication",
                "All workforce users authenticate to the identity provider with a managed account. MFA is required for remote access, production systems, the source-code platform, and all administrator roles. The approved Access Control Policy defines the higher assurance requirement for restricted information.",
            ),
            (
                "Administrative safeguards",
                "Cloud and database administrators use FIDO2 keys and a privileged access workflow. Emergency credentials are kept in the vault and their use is reviewed by the security operations team on the next business day. Authentication events are sent to the central security monitoring platform.",
            ),
            (
                "Integration accounts",
                "Application accounts are registered with an owner and a service description. The billing integration and warehouse connector currently authenticate with long-lived API keys because their vendors do not yet support workload identity. Key rotation is performed on request and the migration plan is open with a target date of 30 September 2026. These accounts do not use MFA or another short-lived secure authentication mechanism.",
            ),
            (
                "Review",
                "Identity Operations reviews the human-user MFA report monthly and reviews service-account ownership quarterly. Exceptions are tracked in the IAM risk register.",
            ),
        ],
        planted_gap="Human and privileged authentication is established, but two in-scope application/service accounts still rely on long-lived API keys without secure short-lived authentication or MFA-equivalent protection.",
    ),
    document(
        framework="ISO27001",
        control_id="ISO.A8.5",
        status="non_compliant",
        filename="iso_a8_5_noncompliant_asset_inventory.pdf",
        title="Technology Asset Inventory Extract",
        document_type="Asset inventory report",
        document_code="INV-TECH-2026-Q2",
        effective_date="2026-06-30",
        owner="IT Operations",
        sections=[
            (
                "Inventory summary",
                "The Q2 inventory contains 212 laptops, 31 servers, 14 network appliances, and 9 managed SaaS applications. Records include asset tag, assigned team, location, operating system, and lifecycle state.",
            ),
            (
                "Lifecycle notes",
                "Twenty-three laptops are due for refresh in the next two quarters. The infrastructure team is reconciling three duplicate asset tags and two devices with an unknown custodian.",
            ),
            (
                "Reconciliation",
                "The inventory was exported from the endpoint management platform on 30 June 2026 and reviewed by IT Operations. Authentication configuration, factor enrollment, login procedures, and service-account controls are not recorded in this report.",
            ),
        ],
        planted_gap="Off-target as evidence: the document inventories technology assets but contains no secure authentication technology or procedure and no evidence about how access restrictions drive authentication strength.",
    ),
    document(
        framework="NIST_CSF",
        control_id="NIST.PR.AA.05",
        status="compliant",
        filename="nist_pr_aa_05_compliant_access_governance_standard.pdf",
        title="Access Permissions and Authorization Standard",
        document_type="Access-control standard",
        document_code="STD-ACCESS-002",
        effective_date="2026-01-20",
        owner="Chief Information Security Officer",
        sections=[
            (
                "Policy and principles",
                "Access permissions, entitlements, and authorizations are defined in the Access Governance Policy. Access is granted only for a documented business need, limited to the minimum role required, and separated where one person could otherwise request, approve, and execute the same sensitive transaction.",
            ),
            (
                "Management and enforcement",
                "Managers request access through the identity governance workflow; the data owner approves the entitlement and the system enforces the resulting role through centralized groups. Direct production grants are blocked except for time-bound emergency access. Conflicting role combinations are rejected by the policy engine and flagged to Security Operations.",
            ),
            (
                "Review and removal",
                "Application owners review access quarterly and data owners review privileged access monthly. Joiner, mover, and leaver events trigger changes through the identity lifecycle integration. The Q2 certification report shows all 37 critical applications completed review, with 14 entitlements removed and 6 reduced to read-only.",
            ),
            (
                "Separation of duties",
                "The finance, payment, and deployment role catalogs contain incompatible-role rules. Emergency access requires an incident reference, two approvers, automatic expiry after four hours, and an independent review on the next business day.",
            ),
        ],
        planted_gap=None,
    ),
    document(
        framework="NIST_CSF",
        control_id="NIST.PR.AA.05",
        status="partially_compliant",
        filename="nist_pr_aa_05_partial_emergency_access_gap.pdf",
        title="Access Review and Authorization Procedure",
        document_type="Access-control procedure",
        document_code="PROC-ACCESS-009",
        effective_date="2026-05-05",
        owner="Director, IT Governance",
        sections=[
            (
                "Authorization model",
                "The Access Governance Policy defines role-based access and least privilege for corporate, production, and customer-data systems. Requests require a business justification and manager approval; application owners approve data entitlements. The identity platform enforces the approved groups and blocks direct grants for standard users.",
            ),
            (
                "Review cycle",
                "Application owners certify access quarterly, with monthly certification for privileged roles. Joiner, mover, and leaver feeds remove or adjust access after the human-resources event is approved. The April review completed for 22 of 22 in-scope applications and recorded 9 removals.",
            ),
            (
                "Emergency access",
                "The emergency procedure permits a production administrator to obtain temporary elevated access during an incident. The requester records the incident number and a manager approves the request. The role expires automatically after eight hours, and Security Operations performs an independent post-use review on the next business day. The procedure does not require a second independent approver, and the role catalog does not prevent the same person from requesting and approving emergency access.",
            ),
            (
                "Evidence retention",
                "Access requests, approvals, certifications, and removal actions are retained in the identity governance platform for two years.",
            ),
        ],
        planted_gap="The standard defines and enforces least-privilege access and periodic reviews, but the emergency-access workflow does not enforce separation of duties: the same person can request and approve an emergency role.",
    ),
    document(
        framework="NIST_CSF",
        control_id="NIST.PR.AA.05",
        status="non_compliant",
        filename="nist_pr_aa_05_noncompliant_facility_badge_procedure.pdf",
        title="Visitor and Facility Badge Procedure",
        document_type="Physical-security procedure",
        document_code="PROC-FAC-003",
        effective_date="2026-02-10",
        owner="Facilities Manager",
        sections=[
            (
                "Visitor entry",
                "Visitors present government-issued identification at reception, sign the visitor register, and wear a temporary badge. The host escorts visitors in restricted areas and returns the badge at departure.",
            ),
            (
                "Employee badges",
                "Facilities issues photo badges to employees and contractors after a manager submits a start-date request. Lost badges are disabled by the service desk. Facilities reviews the badge list each month.",
            ),
            (
                "Records",
                "Visitor logs and badge issuance records are retained for twelve months. This procedure does not define logical access permissions, application entitlements, least privilege, role authorization, or separation of duties.",
            ),
        ],
        planted_gap="Off-target as evidence: the procedure addresses physical badges and visitors, not logical access permissions, policy-defined entitlements, least privilege, or separation of duties.",
    ),
    document(
        framework="NIST_CSF",
        control_id="NIST.DE.CM.01",
        status="compliant",
        filename="nist_de_cm_01_compliant_network_detection_runbook.pdf",
        title="Network and Network-Service Monitoring Runbook",
        document_type="Security operations runbook",
        document_code="RUN-SOC-017",
        effective_date="2026-03-22",
        owner="Security Operations Manager",
        sections=[
            (
                "Coverage",
                "Northstar Commerce continuously monitors corporate networks, production VPCs, VPN gateways, internet edges, DNS, and managed network services for potentially adverse events. The coverage register maps each network segment and service to an owner, telemetry source, and response queue.",
            ),
            (
                "Detection sources",
                "Network detection sensors inspect east-west and north-south traffic in production. Firewalls, VPN concentrators, DNS resolvers, cloud flow logs, and secure web gateways forward events to the central SIEM. Health checks alert when a required telemetry source stops reporting for more than ten minutes.",
            ),
            (
                "Monitoring and response",
                "The SIEM runs detections for unusual outbound volume, command-and-control indicators, impossible VPN travel, new internet-facing services, repeated denied connections, and changes to firewall rules. The on-call analyst triages alerts continuously, records disposition and affected assets, and escalates confirmed adverse events under the incident response plan.",
            ),
            (
                "Validation",
                "Security Operations tests sensor coverage monthly using controlled connection attempts and reviews detection rules quarterly. The June coverage test produced events from all 18 registered network segments and all 42 monitored network services.",
            ),
        ],
        planted_gap=None,
    ),
    document(
        framework="NIST_CSF",
        control_id="NIST.DE.CM.01",
        status="partially_compliant",
        filename="nist_de_cm_01_partial_branch_monitoring_gap.pdf",
        title="Network Monitoring Operations Report",
        document_type="Monitoring operations report",
        document_code="RPT-NETMON-2026-Q2",
        effective_date="2026-06-30",
        owner="Network Engineering",
        sections=[
            (
                "Monitored services",
                "Network Engineering forwards firewall, VPN, DNS, cloud flow-log, and production load-balancer events to the SIEM. The SOC monitors these sources continuously for suspicious connections, unusual egress, repeated authentication failures, and changes to perimeter rules.",
            ),
            (
                "Coverage review",
                "The Q2 review confirms coverage for the primary data center, the production cloud environment, remote access, and the corporate office network. Sensor health is checked every fifteen minutes and outages create an incident ticket.",
            ),
            (
                "Open coverage item",
                "The Pune branch still routes user traffic through a managed service-provider appliance that exports only availability metrics. Its connection events and DNS activity are not forwarded to the SIEM, and no network detection sensor is installed at the branch. The replacement circuit and sensor deployment are scheduled for 15 October 2026.",
            ),
            (
                "Review conclusion",
                "Monitoring is effective for the listed core environments; the branch exception remains open in the network risk register pending telemetry validation.",
            ),
        ],
        planted_gap="Core networks and services are monitored, but the Pune branch network has no connection-event telemetry or detection coverage for potentially adverse events.",
    ),
    document(
        framework="NIST_CSF",
        control_id="NIST.DE.CM.01",
        status="non_compliant",
        filename="nist_de_cm_01_noncompliant_backup_restore_report.pdf",
        title="Quarterly Backup Restore Test Report",
        document_type="Business continuity test report",
        document_code="RPT-BCP-2026-Q2",
        effective_date="2026-06-18",
        owner="Infrastructure Reliability",
        sections=[
            (
                "Test objective",
                "Infrastructure Reliability tested the restoration of the customer orders database from the 18 June 2026 backup set. The test measured recovery time, data integrity, and operator runbook readiness.",
            ),
            (
                "Results",
                "The database was restored to the isolated recovery account in 47 minutes. Row counts matched the source snapshot and the application team completed a read-only validation. Two runbook steps were updated after the exercise.",
            ),
            (
                "Limitations",
                "This report covers backup creation and recovery only. It contains no network or network-service monitoring scope, telemetry source, adverse-event detection rule, alert triage record, or monitoring coverage review.",
            ),
        ],
        planted_gap="Off-target as evidence: the report demonstrates a backup restoration exercise, not monitoring of networks and network services for potentially adverse events.",
    ),
    document(
        framework="PCI_DSS",
        control_id="PCI.10.2",
        status="compliant",
        filename="pci_10_2_compliant_cde_logging_standard.pdf",
        title="Cardholder Data Environment Logging Standard",
        document_type="Technical standard",
        document_code="STD-CDE-LOG-010",
        effective_date="2026-04-12",
        owner="Payment Security Lead",
        sections=[
            (
                "Scope and purpose",
                "All system components in the cardholder data environment, and all security-relevant services connected to it, generate audit events needed to detect, alert on, and analyze anomalous activity and potential compromise. The standard applies to payment APIs, databases, operating systems, firewalls, administrative consoles, and identity services.",
            ),
            (
                "Required events",
                "Logs record successful and failed user authentication, user access to cardholder-data repositories, administrator authentication and commands, creation and deletion of accounts, changes to privileges, changes to audit configuration, and security tool alerts. Events include the user or service identity, timestamp, source, action, target, and outcome. PAN is not written to application logs.",
            ),
            (
                "Detection and alerting",
                "Systems forward events to the central SIEM within five minutes. Correlation rules alert the Security Operations Center on repeated failures, access outside an approved window, privilege changes, disabled logging, unusual administrative activity, and suspicious payment-service behavior. Analysts preserve the event set with the incident record for investigation.",
            ),
            (
                "Validation",
                "Payment Security tests log generation and SIEM ingestion monthly using controlled user and administrator actions. The 30 June 2026 test confirmed coverage for 100 percent of 64 in-scope system components.",
            ),
        ],
        planted_gap=None,
    ),
    document(
        framework="PCI_DSS",
        control_id="PCI.10.2",
        status="partially_compliant",
        filename="pci_10_2_partial_api_alerting_gap.pdf",
        title="CDE Audit Logging Operations Review",
        document_type="Logging operations report",
        document_code="RPT-CDE-LOG-2026-Q2",
        effective_date="2026-07-05",
        owner="Security Operations Manager",
        sections=[
            (
                "Implemented coverage",
                "The payment gateway, cardholder database, operating systems, VPN, firewalls, and administrator consoles generate events for user authentication, user access, administrator activity, account changes, and changes to logging configuration. Events are sent to the central SIEM and are available to the SOC for investigation.",
            ),
            (
                "Review results",
                "The Q2 review confirmed log generation for 61 of 64 in-scope components. The three remaining components are the public payment-status API nodes deployed in the new Kubernetes cluster; their application logs reach the cluster log store but the stream is not yet connected to the SIEM correlation rules.",
            ),
            (
                "Detection gap",
                "Because the payment-status API stream is not connected to SIEM rules, anomalous user activity and administrator actions on those nodes do not create the standard SOC alert. The cluster team has a change record to complete the parser and alert mapping by 30 September 2026.",
            ),
            (
                "Evidence retained",
                "The review retains test events, source inventory, SIEM ingestion screenshots, and the open change record. No production PAN is included in the evidence package.",
            ),
        ],
        planted_gap="Audit events exist for most CDE components, but the three new payment-status API nodes are not connected to SIEM correlation and therefore do not support the required alerting for anomalous user or administrator activity.",
    ),
    document(
        framework="PCI_DSS",
        control_id="PCI.10.2",
        status="non_compliant",
        filename="pci_10_2_noncompliant_facility_badge_log.pdf",
        title="Facility Badge Access Log Review",
        document_type="Physical-security report",
        document_code="RPT-FAC-ACCESS-2026-Q2",
        effective_date="2026-06-30",
        owner="Facilities Security",
        sections=[
            (
                "Review period",
                "Facilities Security reviewed badge entries to the two offices and the data-center lobby for April through June 2026. The review compared employee badges, temporary visitor badges, and the visitor sign-in register.",
            ),
            (
                "Exceptions",
                "Four visitor badges were returned after the expected departure time. One employee badge was disabled after a lost-badge report. Facilities notified the relevant managers and closed the tickets.",
            ),
            (
                "Scope note",
                "This report records physical entry activity only. It does not cover system-component access, cardholder-data access, user authentication, administrator actions, audit-event generation, SIEM ingestion, or security-event alerting.",
            ),
        ],
        planted_gap="Off-target as evidence: the report covers physical badge activity and provides no audit logs for user access, administrator actions, or security events in the cardholder data environment.",
    ),
]


def render(item: dict) -> None:
    pdf = EvidencePDF(item["document_title"], item["document_code"])
    pdf.set_title(item["document_title"])
    pdf.set_author(item["owner"])
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 16)
    pdf.set_text_color(26, 38, 53)
    pdf.set_x(pdf.l_margin)
    pdf.multi_cell(0, 7, item["document_title"])
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(82, 91, 102)
    pdf.set_x(pdf.l_margin)
    pdf.multi_cell(0, 4.5, f"{item['document_type']}  |  {item['document_code']}")
    pdf.ln(2)

    metadata = [
        ("Document owner", item["owner"]),
        ("Effective date", item["effective_date"]),
        ("Applicable reference", f"{item['control_reference']} - {item['control_title']}"),
    ]
    pdf.set_fill_color(244, 246, 248)
    for label, value in metadata:
        pdf.set_x(pdf.l_margin)
        pdf.set_font("Helvetica", "B", 8.5)
        pdf.set_text_color(57, 68, 81)
        pdf.cell(37, 5, label)
        pdf.set_font("Helvetica", "", 8.5)
        pdf.set_text_color(57, 68, 81)
        pdf.multi_cell(0, 5, value, fill=True)
    pdf.ln(3)

    for heading, body in item["sections"]:
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(26, 38, 53)
        pdf.set_x(pdf.l_margin)
        pdf.multi_cell(0, 5, heading)
        pdf.set_font("Helvetica", "", 9.2)
        pdf.set_text_color(43, 50, 58)
        pdf.set_x(pdf.l_margin)
        pdf.multi_cell(0, 4.6, body)
        pdf.ln(1.5)

    output_path = FIXTURE_DIR / item["file"]
    output_path.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(output_path))


def main() -> None:
    expected_categories = {"compliant", "partially_compliant", "non_compliant"}
    if {item["ground_truth_status"] for item in DOCUMENTS} != expected_categories:
        raise AssertionError("Fixture set must contain all three ground-truth categories")
    for item in DOCUMENTS:
        render(item)

    manifest = []
    for item in DOCUMENTS:
        manifest.append(
            {
                "file": item["file"],
                "target_control_id": item["target_control_id"],
                "framework": item["framework"],
                "ground_truth_status": item["ground_truth_status"],
                "planted_gap": item["planted_gap"],
                "document_title": item["document_title"],
                "document_type": item["document_type"],
                "control_reference": item["control_reference"],
            }
        )
    (FIXTURE_DIR / "manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Generated {len(DOCUMENTS)} PDFs in {PDF_DIR}")
    print(f"Manifest: {FIXTURE_DIR / 'manifest.json'}")


if __name__ == "__main__":
    main()
