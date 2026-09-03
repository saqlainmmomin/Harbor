"""
ISO 27001:2022 framework definition.

Based on ISO/IEC 27001:2022 Annex A controls, organized by the 4 themes:
  - Organizational (37 controls)
  - People (8 controls)
  - Physical (14 controls)
  - Technological (34 controls)

Total: 93 Annex A controls.
"""

from app.frameworks.schema import (
    Control,
    Domain,
    FrameworkDefinition,
    QuestionDef,
    RedFlagPattern,
    ScopeQuestion,
    Section,
)

# ── Domain: Organizational Controls (A.5–A.8) ────────────────────────────

_ORG_POLICIES = Section(
    key="policies",
    title="Information Security Policies",
    weight=0.15,
    controls=[
        Control(
            id="ISO.A5.1",
            title="Policies for information security",
            description="A set of policies for information security shall be defined, approved by management, published, communicated to and acknowledged by relevant personnel and relevant interested parties.",
            reference="Annex A.5.1",
            criticality="critical",
            tags=["governance", "policy", "management-commitment"],
        ),
        Control(
            id="ISO.A5.2",
            title="Information security roles and responsibilities",
            description="Information security roles and responsibilities shall be defined and allocated.",
            reference="Annex A.5.2",
            criticality="high",
            tags=["governance", "roles-responsibilities", "organizational-structure"],
        ),
        Control(
            id="ISO.A5.3",
            title="Segregation of duties",
            description="Conflicting duties and areas of responsibility shall be segregated.",
            reference="Annex A.5.3",
            criticality="high",
            tags=["access-control", "segregation-of-duties", "governance"],
        ),
        Control(
            id="ISO.A5.4",
            title="Management responsibilities",
            description="Management shall require all personnel to apply information security in accordance with the established policies and procedures.",
            reference="Annex A.5.4",
            criticality="high",
            tags=["governance", "management-commitment", "awareness"],
        ),
    ],
)

_ORG_THREAT_INTEL = Section(
    key="threat_intelligence",
    title="Threat Intelligence & Asset Management",
    weight=0.15,
    controls=[
        Control(
            id="ISO.A5.5",
            title="Contact with authorities",
            description="Appropriate contacts with relevant authorities shall be maintained.",
            reference="Annex A.5.5",
            criticality="medium",
            tags=["governance", "regulatory-notification", "incident-response"],
        ),
        Control(
            id="ISO.A5.6",
            title="Contact with special interest groups",
            description="Appropriate contacts with special interest groups or other specialist security forums shall be maintained.",
            reference="Annex A.5.6",
            criticality="low",
            tags=["governance", "threat-intelligence", "industry-collaboration"],
        ),
        Control(
            id="ISO.A5.7",
            title="Threat intelligence",
            description="Information relating to information security threats shall be collected and analysed to produce threat intelligence.",
            reference="Annex A.5.7",
            criticality="medium",
            tags=["threat-intelligence", "risk-assessment", "security-monitoring"],
        ),
        Control(
            id="ISO.A5.8",
            title="Information security in project management",
            description="Information security shall be integrated into project management.",
            reference="Annex A.5.8",
            criticality="medium",
            tags=["governance", "project-management", "security-by-design"],
        ),
        Control(
            id="ISO.A5.9",
            title="Inventory of information and other associated assets",
            description="An inventory of information and other associated assets shall be identified and maintained.",
            reference="Annex A.5.9",
            criticality="high",
            tags=["asset-management", "data-inventory", "classification"],
        ),
        Control(
            id="ISO.A5.10",
            title="Acceptable use of information and other associated assets",
            description="Rules for acceptable use and procedures for handling of information and other associated assets shall be identified, documented and implemented.",
            reference="Annex A.5.10",
            criticality="medium",
            tags=["asset-management", "acceptable-use", "policy"],
        ),
        Control(
            id="ISO.A5.11",
            title="Return of assets",
            description="Personnel and other interested parties shall return all organizational assets in their possession upon change or termination of employment, contract or agreement.",
            reference="Annex A.5.11",
            criticality="medium",
            tags=["asset-management", "offboarding", "employment-lifecycle"],
        ),
        Control(
            id="ISO.A5.12",
            title="Classification of information",
            description="Information shall be classified according to the information security needs of the organization based on confidentiality, integrity, availability and relevant interested party requirements.",
            reference="Annex A.5.12",
            criticality="high",
            tags=["classification", "data-protection", "confidentiality"],
        ),
        Control(
            id="ISO.A5.13",
            title="Labelling of information",
            description="An appropriate set of procedures for information labelling shall be developed and implemented in accordance with the classification scheme.",
            reference="Annex A.5.13",
            criticality="medium",
            tags=["classification", "labelling", "data-handling"],
        ),
    ],
)

_ORG_ACCESS = Section(
    key="access_identity",
    title="Access Control & Identity Management",
    weight=0.20,
    controls=[
        Control(
            id="ISO.A5.14",
            title="Information transfer",
            description="Information transfer rules, procedures or agreements shall be in place for all types of transfer facilities.",
            reference="Annex A.5.14",
            criticality="high",
            tags=["data-transfer", "information-exchange", "communication-security"],
        ),
        Control(
            id="ISO.A5.15",
            title="Access control",
            description="Rules to control physical and logical access to information and other associated assets shall be established and implemented based on business and information security requirements.",
            reference="Annex A.5.15",
            criticality="critical",
            tags=["access-control", "least-privilege", "authorization"],
        ),
        Control(
            id="ISO.A5.16",
            title="Identity management",
            description="The full life cycle of identities shall be managed.",
            reference="Annex A.5.16",
            criticality="high",
            tags=["identity-management", "access-control", "lifecycle-management"],
        ),
        Control(
            id="ISO.A5.17",
            title="Authentication information",
            description="Allocation and management of authentication information shall be controlled by a management process including advising personnel of appropriate handling.",
            reference="Annex A.5.17",
            criticality="high",
            tags=["authentication", "credential-management", "access-control"],
        ),
        Control(
            id="ISO.A5.18",
            title="Access rights",
            description="Access rights to information and other associated assets shall be provisioned, reviewed, modified and removed in accordance with the topic-specific policy and rules.",
            reference="Annex A.5.18",
            criticality="critical",
            tags=["access-control", "access-review", "least-privilege", "provisioning"],
        ),
    ],
)

_ORG_SUPPLIER = Section(
    key="supplier_relations",
    title="Supplier & Third-Party Management",
    weight=0.15,
    controls=[
        Control(
            id="ISO.A5.19",
            title="Information security in supplier relationships",
            description="Processes and procedures shall be defined and implemented to manage the information security risks associated with the use of supplier's products or services.",
            reference="Annex A.5.19",
            criticality="high",
            tags=["third-party", "supplier-management", "risk-assessment"],
        ),
        Control(
            id="ISO.A5.20",
            title="Addressing information security within supplier agreements",
            description="Relevant information security requirements shall be established and agreed with each supplier based on the type of supplier relationship.",
            reference="Annex A.5.20",
            criticality="high",
            tags=["third-party", "contracts", "supplier-management"],
        ),
        Control(
            id="ISO.A5.21",
            title="Managing information security in the ICT supply chain",
            description="Processes and procedures shall be defined and implemented for managing information security risks associated with the ICT products and services supply chain.",
            reference="Annex A.5.21",
            criticality="high",
            tags=["supply-chain", "third-party", "ict-security"],
        ),
        Control(
            id="ISO.A5.22",
            title="Monitoring, review and change management of supplier services",
            description="The organization shall regularly monitor, review, evaluate and manage change in supplier information security practices and service delivery.",
            reference="Annex A.5.22",
            criticality="medium",
            tags=["third-party", "monitoring", "change-management"],
        ),
        Control(
            id="ISO.A5.23",
            title="Information security for use of cloud services",
            description="Processes for acquisition, use, management and exit from cloud services shall be established in accordance with the organization's information security requirements.",
            reference="Annex A.5.23",
            criticality="high",
            tags=["cloud-security", "third-party", "data-protection"],
        ),
    ],
)

_ORG_INCIDENT = Section(
    key="incident_continuity",
    title="Incident Management, Continuity & Compliance",
    weight=0.20,
    controls=[
        Control(
            id="ISO.A5.24",
            title="Information security incident management planning and preparation",
            description="The organization shall plan and prepare for managing information security incidents by defining, establishing and communicating incident management processes, roles and responsibilities.",
            reference="Annex A.5.24",
            criticality="critical",
            tags=["incident-response", "incident-response-plan", "governance"],
        ),
        Control(
            id="ISO.A5.25",
            title="Assessment and decision on information security events",
            description="The organization shall assess information security events and decide if they are to be categorized as information security incidents.",
            reference="Annex A.5.25",
            criticality="high",
            tags=["incident-response", "event-classification", "triage"],
        ),
        Control(
            id="ISO.A5.26",
            title="Response to information security incidents",
            description="Information security incidents shall be responded to in accordance with the documented procedures.",
            reference="Annex A.5.26",
            criticality="critical",
            tags=["incident-response", "breach-management", "containment"],
        ),
        Control(
            id="ISO.A5.27",
            title="Learning from information security incidents",
            description="Knowledge gained from information security incidents shall be used to strengthen and improve the information security controls.",
            reference="Annex A.5.27",
            criticality="medium",
            tags=["incident-response", "lessons-learned", "continuous-improvement"],
        ),
        Control(
            id="ISO.A5.28",
            title="Collection of evidence",
            description="The organization shall establish and implement procedures for the identification, collection, acquisition and preservation of evidence related to information security events.",
            reference="Annex A.5.28",
            criticality="medium",
            tags=["incident-response", "evidence-collection", "forensics"],
        ),
        Control(
            id="ISO.A5.29",
            title="Information security during disruption",
            description="The organization shall plan how to maintain information security at an appropriate level during disruption.",
            reference="Annex A.5.29",
            criticality="high",
            tags=["business-continuity", "resilience", "disaster-recovery"],
        ),
        Control(
            id="ISO.A5.30",
            title="ICT readiness for business continuity",
            description="ICT readiness shall be planned, implemented, maintained and tested based on business continuity objectives and ICT continuity requirements.",
            reference="Annex A.5.30",
            criticality="high",
            tags=["business-continuity", "disaster-recovery", "ict-security"],
        ),
    ],
)

_ORG_COMPLIANCE = Section(
    key="legal_compliance",
    title="Legal, Regulatory & Policy Compliance",
    weight=0.15,
    controls=[
        Control(
            id="ISO.A5.31",
            title="Legal, statutory, regulatory and contractual requirements",
            description="Legal, statutory, regulatory and contractual requirements relevant to information security and the organization's approach to meet these requirements shall be identified, documented and kept up to date.",
            reference="Annex A.5.31",
            criticality="high",
            tags=["compliance", "legal-requirements", "regulatory"],
        ),
        Control(
            id="ISO.A5.32",
            title="Intellectual property rights",
            description="The organization shall implement appropriate procedures to protect intellectual property rights.",
            reference="Annex A.5.32",
            criticality="medium",
            tags=["compliance", "intellectual-property", "legal-requirements"],
        ),
        Control(
            id="ISO.A5.33",
            title="Protection of records",
            description="Records shall be protected from loss, destruction, falsification, unauthorized access and unauthorized release.",
            reference="Annex A.5.33",
            criticality="high",
            tags=["record-keeping", "data-protection", "integrity"],
        ),
        Control(
            id="ISO.A5.34",
            title="Privacy and protection of personal information",
            description="The organization shall identify and meet requirements regarding the preservation of privacy and protection of PII as applicable.",
            reference="Annex A.5.34",
            criticality="critical",
            tags=["privacy", "data-protection", "pii", "compliance"],
        ),
        Control(
            id="ISO.A5.35",
            title="Independent review of information security",
            description="The organization's approach to managing information security shall be independently reviewed at planned intervals or when significant changes occur.",
            reference="Annex A.5.35",
            criticality="high",
            tags=["audit", "independent-review", "governance"],
        ),
        Control(
            id="ISO.A5.36",
            title="Compliance with policies, rules and standards",
            description="Compliance with the organization's information security policy, topic-specific policies, rules and standards shall be regularly reviewed.",
            reference="Annex A.5.36",
            criticality="medium",
            tags=["compliance", "policy-compliance", "monitoring"],
        ),
        Control(
            id="ISO.A5.37",
            title="Documented operating procedures",
            description="Operating procedures for information processing facilities shall be documented and made available to personnel who need them.",
            reference="Annex A.5.37",
            criticality="medium",
            tags=["documentation", "operating-procedures", "process"],
        ),
    ],
)

# ── Domain: People Controls (A.6) ────────────────────────────────────────

_PEOPLE_SCREENING = Section(
    key="screening_employment",
    title="Screening & Employment",
    weight=0.40,
    controls=[
        Control(
            id="ISO.A6.1",
            title="Screening",
            description="Background verification checks on all candidates to become personnel shall be carried out prior to joining the organization and on an ongoing basis.",
            reference="Annex A.6.1",
            criticality="high",
            tags=["people", "screening", "background-check", "employment-lifecycle"],
        ),
        Control(
            id="ISO.A6.2",
            title="Terms and conditions of employment",
            description="Employment contractual agreements shall state the personnel's and the organization's responsibilities for information security.",
            reference="Annex A.6.2",
            criticality="high",
            tags=["people", "contracts", "employment-lifecycle", "responsibilities"],
        ),
        Control(
            id="ISO.A6.3",
            title="Information security awareness, education and training",
            description="Personnel and relevant interested parties shall receive appropriate information security awareness, education and training and regular updates of the organization's policies and procedures.",
            reference="Annex A.6.3",
            criticality="critical",
            tags=["awareness", "training", "security-culture", "people"],
        ),
        Control(
            id="ISO.A6.4",
            title="Disciplinary process",
            description="A disciplinary process shall be formalized and communicated to take actions against personnel who have committed an information security policy violation.",
            reference="Annex A.6.4",
            criticality="medium",
            tags=["people", "disciplinary", "policy-enforcement"],
        ),
        Control(
            id="ISO.A6.5",
            title="Responsibilities after termination or change of employment",
            description="Information security responsibilities that remain valid after termination or change of employment shall be defined, enforced and communicated.",
            reference="Annex A.6.5",
            criticality="medium",
            tags=["people", "offboarding", "employment-lifecycle"],
        ),
    ],
)

_PEOPLE_REMOTE = Section(
    key="remote_work",
    title="Remote Working & Reporting",
    weight=0.60,
    controls=[
        Control(
            id="ISO.A6.6",
            title="Confidentiality or non-disclosure agreements",
            description="Confidentiality or non-disclosure agreements reflecting the organization's needs for information protection shall be identified, documented, regularly reviewed and signed by personnel and relevant interested parties.",
            reference="Annex A.6.6",
            criticality="medium",
            tags=["people", "nda", "confidentiality", "contracts"],
        ),
        Control(
            id="ISO.A6.7",
            title="Remote working",
            description="Security measures shall be implemented when personnel are working remotely to protect information accessed, processed or stored outside the organization's premises.",
            reference="Annex A.6.7",
            criticality="high",
            tags=["remote-working", "endpoint-security", "data-protection"],
        ),
        Control(
            id="ISO.A6.8",
            title="Information security event reporting",
            description="The organization shall provide a mechanism for personnel to report observed or suspected information security events through appropriate channels in a timely manner.",
            reference="Annex A.6.8",
            criticality="high",
            tags=["incident-response", "reporting", "people", "security-culture"],
        ),
    ],
)

# ── Domain: Physical Controls (A.7) ──────────────────────────────────────

_PHYSICAL_PERIMETER = Section(
    key="perimeter_access",
    title="Physical Perimeter & Access",
    weight=0.50,
    controls=[
        Control(
            id="ISO.A7.1",
            title="Physical security perimeters",
            description="Security perimeters shall be defined and used to protect areas that contain information and other associated assets.",
            reference="Annex A.7.1",
            criticality="high",
            tags=["physical-security", "perimeter", "secure-areas"],
        ),
        Control(
            id="ISO.A7.2",
            title="Physical entry",
            description="Secure areas shall be protected by appropriate entry controls and access points.",
            reference="Annex A.7.2",
            criticality="high",
            tags=["physical-security", "access-control", "entry-controls"],
        ),
        Control(
            id="ISO.A7.3",
            title="Securing offices, rooms and facilities",
            description="Physical security for offices, rooms and facilities shall be designed and implemented.",
            reference="Annex A.7.3",
            criticality="medium",
            tags=["physical-security", "secure-areas", "facility-management"],
        ),
        Control(
            id="ISO.A7.4",
            title="Physical security monitoring",
            description="Premises shall be continuously monitored for unauthorized physical access.",
            reference="Annex A.7.4",
            criticality="medium",
            tags=["physical-security", "monitoring", "surveillance"],
        ),
        Control(
            id="ISO.A7.5",
            title="Protecting against physical and environmental threats",
            description="Protection against physical and environmental threats shall be designed and implemented.",
            reference="Annex A.7.5",
            criticality="medium",
            tags=["physical-security", "environmental-threats", "resilience"],
        ),
        Control(
            id="ISO.A7.6",
            title="Working in secure areas",
            description="Security measures for working in secure areas shall be designed and implemented.",
            reference="Annex A.7.6",
            criticality="medium",
            tags=["physical-security", "secure-areas", "operating-procedures"],
        ),
        Control(
            id="ISO.A7.7",
            title="Clear desk and clear screen",
            description="Clear desk rules for papers and removable storage media and clear screen rules for information processing facilities shall be defined and appropriately enforced.",
            reference="Annex A.7.7",
            criticality="medium",
            tags=["physical-security", "clear-desk", "data-protection"],
        ),
    ],
)

_PHYSICAL_EQUIPMENT = Section(
    key="equipment",
    title="Equipment Security",
    weight=0.50,
    controls=[
        Control(
            id="ISO.A7.8",
            title="Equipment siting and protection",
            description="Equipment shall be sited securely and protected.",
            reference="Annex A.7.8",
            criticality="medium",
            tags=["physical-security", "equipment-protection", "facility-management"],
        ),
        Control(
            id="ISO.A7.9",
            title="Security of assets off-premises",
            description="Off-site assets shall be protected.",
            reference="Annex A.7.9",
            criticality="medium",
            tags=["physical-security", "asset-management", "remote-working"],
        ),
        Control(
            id="ISO.A7.10",
            title="Storage media",
            description="Storage media shall be managed through their life cycle of acquisition, use, transportation and disposal in accordance with the classification scheme and handling requirements.",
            reference="Annex A.7.10",
            criticality="high",
            tags=["media-handling", "data-protection", "data-deletion", "asset-management"],
        ),
        Control(
            id="ISO.A7.11",
            title="Supporting utilities",
            description="Information processing facilities shall be protected from power failures and other disruptions caused by failures in supporting utilities.",
            reference="Annex A.7.11",
            criticality="medium",
            tags=["physical-security", "resilience", "business-continuity"],
        ),
        Control(
            id="ISO.A7.12",
            title="Cabling security",
            description="Cables carrying power, data or supporting information services shall be protected from interception, interference or damage.",
            reference="Annex A.7.12",
            criticality="low",
            tags=["physical-security", "cabling", "infrastructure"],
        ),
        Control(
            id="ISO.A7.13",
            title="Equipment maintenance",
            description="Equipment shall be maintained correctly to ensure availability, integrity and confidentiality of information.",
            reference="Annex A.7.13",
            criticality="medium",
            tags=["equipment-maintenance", "availability", "physical-security"],
        ),
        Control(
            id="ISO.A7.14",
            title="Secure disposal or re-use of equipment",
            description="Items of equipment containing storage media shall be verified to ensure that any sensitive data and licensed software has been removed or securely overwritten prior to disposal or re-use.",
            reference="Annex A.7.14",
            criticality="high",
            tags=["data-deletion", "secure-disposal", "media-handling"],
        ),
    ],
)

# ── Domain: Technological Controls (A.8) ──────────────────────────────────

_TECH_ACCESS = Section(
    key="tech_access",
    title="Technical Access Control & Authentication",
    weight=0.25,
    controls=[
        Control(
            id="ISO.A8.1",
            title="User endpoint devices",
            description="Information stored on, processed by or accessible via user endpoint devices shall be protected.",
            reference="Annex A.8.1",
            criticality="high",
            tags=["endpoint-security", "device-management", "data-protection"],
        ),
        Control(
            id="ISO.A8.2",
            title="Privileged access rights",
            description="The allocation and use of privileged access rights shall be restricted and managed.",
            reference="Annex A.8.2",
            criticality="critical",
            tags=["access-control", "privileged-access", "least-privilege"],
        ),
        Control(
            id="ISO.A8.3",
            title="Information access restriction",
            description="Access to information and other associated assets shall be restricted in accordance with the established topic-specific policy on access control.",
            reference="Annex A.8.3",
            criticality="high",
            tags=["access-control", "information-access", "authorization"],
        ),
        Control(
            id="ISO.A8.4",
            title="Access to source code",
            description="Read and write access to source code, development tools and software libraries shall be appropriately managed.",
            reference="Annex A.8.4",
            criticality="medium",
            tags=["access-control", "source-code", "development-security"],
        ),
        Control(
            id="ISO.A8.5",
            title="Secure authentication",
            description="Secure authentication technologies and procedures shall be established and implemented based on information access restrictions and the topic-specific policy on access control.",
            reference="Annex A.8.5",
            criticality="critical",
            tags=["authentication", "mfa", "access-control"],
        ),
    ],
)

_TECH_OPERATIONS = Section(
    key="tech_operations",
    title="Operational & Network Security",
    weight=0.25,
    controls=[
        Control(
            id="ISO.A8.6",
            title="Capacity management",
            description="The use of resources shall be monitored and adjusted in line with current and expected capacity requirements.",
            reference="Annex A.8.6",
            criticality="medium",
            tags=["capacity-management", "monitoring", "availability"],
        ),
        Control(
            id="ISO.A8.7",
            title="Protection against malware",
            description="Protection against malware shall be implemented and supported by appropriate user awareness.",
            reference="Annex A.8.7",
            criticality="critical",
            tags=["malware-protection", "endpoint-security", "technical-measures"],
        ),
        Control(
            id="ISO.A8.8",
            title="Management of technical vulnerabilities",
            description="Information about technical vulnerabilities of information systems in use shall be obtained, the organization's exposure to such vulnerabilities shall be evaluated and appropriate measures shall be taken.",
            reference="Annex A.8.8",
            criticality="critical",
            tags=["vulnerability-management", "patching", "risk-assessment"],
        ),
        Control(
            id="ISO.A8.9",
            title="Configuration management",
            description="Configurations, including security configurations, of hardware, software, services and networks shall be established, documented, implemented, monitored and reviewed.",
            reference="Annex A.8.9",
            criticality="high",
            tags=["configuration-management", "hardening", "baseline"],
        ),
        Control(
            id="ISO.A8.10",
            title="Information deletion",
            description="Information stored in information systems, devices or in any other storage media shall be deleted when no longer required.",
            reference="Annex A.8.10",
            criticality="high",
            tags=["data-deletion", "storage-limitation", "data-retention"],
        ),
        Control(
            id="ISO.A8.11",
            title="Data masking",
            description="Data masking shall be used in accordance with the organization's topic-specific policy on access control and other related policies and business requirements, taking applicable legislation into consideration.",
            reference="Annex A.8.11",
            criticality="medium",
            tags=["data-masking", "data-protection", "privacy"],
        ),
        Control(
            id="ISO.A8.12",
            title="Data leakage prevention",
            description="Data leakage prevention measures shall be applied to systems, networks and any other devices that process, store or transmit sensitive information.",
            reference="Annex A.8.12",
            criticality="high",
            tags=["dlp", "data-protection", "exfiltration-prevention"],
        ),
        Control(
            id="ISO.A8.13",
            title="Information backup",
            description="Backup copies of information, software and systems shall be maintained and regularly tested in accordance with the agreed topic-specific policy on backup.",
            reference="Annex A.8.13",
            criticality="high",
            tags=["backup", "data-protection", "business-continuity"],
        ),
        Control(
            id="ISO.A8.14",
            title="Redundancy of information processing facilities",
            description="Information processing facilities shall be implemented with redundancy sufficient to meet availability requirements.",
            reference="Annex A.8.14",
            criticality="medium",
            tags=["availability", "redundancy", "business-continuity"],
        ),
    ],
)

_TECH_LOGGING = Section(
    key="tech_logging",
    title="Logging, Monitoring & Cryptography",
    weight=0.25,
    controls=[
        Control(
            id="ISO.A8.15",
            title="Logging",
            description="Logs that record activities, exceptions, faults and other relevant events shall be produced, stored, protected and analysed.",
            reference="Annex A.8.15",
            criticality="high",
            tags=["logging", "monitoring", "audit-trail"],
        ),
        Control(
            id="ISO.A8.16",
            title="Monitoring activities",
            description="Networks, systems and applications shall be monitored for anomalous behaviour and appropriate actions taken to evaluate potential information security incidents.",
            reference="Annex A.8.16",
            criticality="high",
            tags=["monitoring", "anomaly-detection", "siem"],
        ),
        Control(
            id="ISO.A8.17",
            title="Clock synchronization",
            description="The clocks of information processing systems used by the organization shall be synchronized to approved time sources.",
            reference="Annex A.8.17",
            criticality="low",
            tags=["logging", "time-synchronization", "infrastructure"],
        ),
        Control(
            id="ISO.A8.18",
            title="Use of privileged utility programs",
            description="The use of utility programs that can be capable of overriding system and application controls shall be restricted and tightly controlled.",
            reference="Annex A.8.18",
            criticality="medium",
            tags=["privileged-access", "utility-programs", "access-control"],
        ),
        Control(
            id="ISO.A8.19",
            title="Installation of software on operational systems",
            description="Procedures and measures shall be implemented to securely manage software installation on operational systems.",
            reference="Annex A.8.19",
            criticality="medium",
            tags=["change-management", "software-installation", "configuration-management"],
        ),
        Control(
            id="ISO.A8.20",
            title="Networks security",
            description="Networks and network devices shall be secured, managed and controlled to protect information in systems and applications.",
            reference="Annex A.8.20",
            criticality="critical",
            tags=["network-security", "segmentation", "firewall"],
        ),
        Control(
            id="ISO.A8.21",
            title="Security of network services",
            description="Security mechanisms, service levels and service requirements of network services shall be identified, implemented and monitored.",
            reference="Annex A.8.21",
            criticality="high",
            tags=["network-security", "service-management", "third-party"],
        ),
        Control(
            id="ISO.A8.22",
            title="Segregation of networks",
            description="Groups of information services, users and information systems shall be segregated in the organization's networks.",
            reference="Annex A.8.22",
            criticality="high",
            tags=["network-security", "segmentation", "isolation"],
        ),
        Control(
            id="ISO.A8.23",
            title="Web filtering",
            description="Access to external websites shall be managed to reduce exposure to malicious content.",
            reference="Annex A.8.23",
            criticality="medium",
            tags=["web-filtering", "malware-protection", "network-security"],
        ),
        Control(
            id="ISO.A8.24",
            title="Use of cryptography",
            description="Rules for the effective use of cryptography, including cryptographic key management, shall be defined and implemented.",
            reference="Annex A.8.24",
            criticality="critical",
            tags=["encryption", "cryptography", "key-management"],
        ),
    ],
)

_TECH_SDLC = Section(
    key="tech_sdlc",
    title="Secure Development & Testing",
    weight=0.25,
    controls=[
        Control(
            id="ISO.A8.25",
            title="Secure development life cycle",
            description="Rules for the secure development of software and systems shall be established and applied.",
            reference="Annex A.8.25",
            criticality="high",
            tags=["sdlc", "secure-development", "security-by-design"],
        ),
        Control(
            id="ISO.A8.26",
            title="Application security requirements",
            description="Information security requirements shall be identified, specified and approved when developing or acquiring applications.",
            reference="Annex A.8.26",
            criticality="high",
            tags=["application-security", "requirements", "security-by-design"],
        ),
        Control(
            id="ISO.A8.27",
            title="Secure system architecture and engineering principles",
            description="Principles for engineering secure systems shall be established, documented, maintained and applied to any information system development activity.",
            reference="Annex A.8.27",
            criticality="high",
            tags=["architecture", "security-by-design", "engineering-principles"],
        ),
        Control(
            id="ISO.A8.28",
            title="Secure coding",
            description="Secure coding principles shall be applied to software development.",
            reference="Annex A.8.28",
            criticality="high",
            tags=["secure-coding", "sdlc", "development-security"],
        ),
        Control(
            id="ISO.A8.29",
            title="Security testing in development and acceptance",
            description="Security testing processes shall be defined and implemented in the development life cycle.",
            reference="Annex A.8.29",
            criticality="high",
            tags=["security-testing", "sdlc", "quality-assurance"],
        ),
        Control(
            id="ISO.A8.30",
            title="Outsourced development",
            description="The organization shall direct, monitor and review the activities related to outsourced system development.",
            reference="Annex A.8.30",
            criticality="medium",
            tags=["outsourced-development", "third-party", "sdlc"],
        ),
        Control(
            id="ISO.A8.31",
            title="Separation of development, test and production environments",
            description="Development, testing and production environments shall be separated and secured.",
            reference="Annex A.8.31",
            criticality="high",
            tags=["environment-separation", "sdlc", "change-management"],
        ),
        Control(
            id="ISO.A8.32",
            title="Change management",
            description="Changes to information processing facilities and information systems shall be subject to change management procedures.",
            reference="Annex A.8.32",
            criticality="high",
            tags=["change-management", "configuration-management", "governance"],
        ),
        Control(
            id="ISO.A8.33",
            title="Test information",
            description="Test information shall be appropriately selected, protected and managed.",
            reference="Annex A.8.33",
            criticality="medium",
            tags=["test-data", "data-protection", "sdlc"],
        ),
        Control(
            id="ISO.A8.34",
            title="Protection of information systems during audit testing",
            description="Audit tests and other assurance activities involving assessment of operational systems shall be planned and agreed between the tester and appropriate management.",
            reference="Annex A.8.34",
            criticality="medium",
            tags=["audit", "testing", "operational-security"],
        ),
    ],
)

# ── Assemble domains ──────────────────────────────────────────────────────

_ORGANIZATIONAL = Domain(
    key="organizational",
    title="Organizational Controls",
    weight=0.35,
    sections={
        "policies": _ORG_POLICIES,
        "threat_intelligence": _ORG_THREAT_INTEL,
        "access_identity": _ORG_ACCESS,
        "supplier_relations": _ORG_SUPPLIER,
        "incident_continuity": _ORG_INCIDENT,
        "legal_compliance": _ORG_COMPLIANCE,
    },
)

_PEOPLE = Domain(
    key="people",
    title="People Controls",
    weight=0.15,
    sections={
        "screening_employment": _PEOPLE_SCREENING,
        "remote_work": _PEOPLE_REMOTE,
    },
)

_PHYSICAL = Domain(
    key="physical",
    title="Physical Controls",
    weight=0.15,
    sections={
        "perimeter_access": _PHYSICAL_PERIMETER,
        "equipment": _PHYSICAL_EQUIPMENT,
    },
)

_TECHNOLOGICAL = Domain(
    key="technological",
    title="Technological Controls",
    weight=0.35,
    sections={
        "tech_access": _TECH_ACCESS,
        "tech_operations": _TECH_OPERATIONS,
        "tech_logging": _TECH_LOGGING,
        "tech_sdlc": _TECH_SDLC,
    },
)

# ── Dependency DAG ────────────────────────────────────────────────────────

_ISO_DEPENDENCIES: dict[str, list[str]] = {
    # Policies must exist before specific controls
    "ISO.A5.15": ["ISO.A5.1"],  # Access control needs policy
    "ISO.A5.18": ["ISO.A5.15", "ISO.A5.16"],  # Access rights need AC policy + identity mgmt
    "ISO.A8.2": ["ISO.A5.15"],  # Privileged access needs AC policy
    # Incident response chain
    "ISO.A5.25": ["ISO.A5.24"],  # Event assessment needs IR planning
    "ISO.A5.26": ["ISO.A5.24"],  # Response needs IR planning
    "ISO.A5.27": ["ISO.A5.26"],  # Lessons learned needs incident response
    "ISO.A5.28": ["ISO.A5.24"],  # Evidence collection needs IR planning
    # Supplier chain
    "ISO.A5.20": ["ISO.A5.19"],  # Supplier agreements need supplier policy
    "ISO.A5.21": ["ISO.A5.19"],  # Supply chain mgmt needs supplier policy
    "ISO.A5.22": ["ISO.A5.19"],  # Monitoring needs supplier policy
    # Development chain
    "ISO.A8.28": ["ISO.A8.25"],  # Secure coding needs SDLC
    "ISO.A8.29": ["ISO.A8.25"],  # Security testing needs SDLC
    "ISO.A8.31": ["ISO.A8.25"],  # Environment separation needs SDLC
}

# ── Root cause clusters ───────────────────────────────────────────────────

_ISO_ROOT_CAUSE_CLUSTERS: dict[str, dict] = {
    "policy": {
        "title": "ISMS Policy Development & Documentation",
        "description": "Develop, formalize and publish information security policies and procedures.",
        "typical_requirements": [
            "ISO.A5.1", "ISO.A5.10", "ISO.A5.31", "ISO.A5.37",
        ],
    },
    "people": {
        "title": "Security Awareness & Competency Program",
        "description": "Train staff, establish security culture, and ensure competency across all roles.",
        "typical_requirements": [
            "ISO.A6.1", "ISO.A6.2", "ISO.A6.3", "ISO.A6.4", "ISO.A6.5",
        ],
    },
    "process": {
        "title": "Operational Process Formalization",
        "description": "Establish repeatable processes for access management, change control, incident response, and supplier management.",
        "typical_requirements": [
            "ISO.A5.15", "ISO.A5.18", "ISO.A5.24", "ISO.A5.26", "ISO.A8.32",
        ],
    },
    "technology": {
        "title": "Technology Controls & Security Infrastructure",
        "description": "Implement or upgrade technical security controls including encryption, network security, endpoint protection, and monitoring.",
        "typical_requirements": [
            "ISO.A8.5", "ISO.A8.7", "ISO.A8.8", "ISO.A8.20", "ISO.A8.24",
        ],
    },
    "governance": {
        "title": "ISMS Governance & Management Framework",
        "description": "Establish management oversight, risk assessment processes, audit program, and continuous improvement.",
        "typical_requirements": [
            "ISO.A5.2", "ISO.A5.4", "ISO.A5.35", "ISO.A5.36",
        ],
    },
}

# ── Scope questions ───────────────────────────────────────────────────────

_ISO_SCOPE_QUESTIONS = [
    ScopeQuestion(
        id="ISO.SCP.1",
        question="What is the scope of your Information Security Management System (ISMS)?",
        help_text="Define which parts of the organization, business processes, and information assets are within scope.",
        type="single_select",
        options=[
            {"value": "full_org", "label": "Entire organization"},
            {"value": "specific_units", "label": "Specific business units or departments"},
            {"value": "specific_services", "label": "Specific products or services"},
            {"value": "undefined", "label": "Not yet defined"},
        ],
    ),
    ScopeQuestion(
        id="ISO.SCP.2",
        question="Does your organization use cloud services for storing or processing information?",
        help_text="Cloud services include IaaS, PaaS, SaaS. This activates cloud-specific controls (A.5.23).",
        type="single_select",
        options=[
            {"value": "yes", "label": "Yes"},
            {"value": "no", "label": "No"},
            {"value": "planned", "label": "Planning to adopt"},
        ],
    ),
    ScopeQuestion(
        id="ISO.SCP.3",
        question="Does your organization develop software or systems (in-house or outsourced)?",
        help_text="This determines applicability of secure development lifecycle controls (A.8.25-A.8.34).",
        type="single_select",
        options=[
            {"value": "inhouse", "label": "Yes — in-house development"},
            {"value": "outsourced", "label": "Yes — outsourced development"},
            {"value": "both", "label": "Both in-house and outsourced"},
            {"value": "no", "label": "No software development"},
        ],
    ),
    ScopeQuestion(
        id="ISO.SCP.4",
        question="Does your organization have physical premises with sensitive information processing facilities?",
        help_text="This determines applicability of physical security controls (A.7.1-A.7.14).",
        type="single_select",
        options=[
            {"value": "yes_datacenter", "label": "Yes — including data center / server room"},
            {"value": "yes_office", "label": "Yes — office only (no on-prem servers)"},
            {"value": "fully_remote", "label": "No — fully remote / cloud-only"},
        ],
    ),
]

# ── Question text ─────────────────────────────────────────────────────────
# One question per control, following the same pattern as DPDPA

_ISO_QUESTIONS: dict[str, QuestionDef] = {}


def _generate_iso_questions() -> dict[str, QuestionDef]:
    """Generate question definitions for all ISO 27001 controls."""
    qs = {}
    for domain in [_ORGANIZATIONAL, _PEOPLE, _PHYSICAL, _TECHNOLOGICAL]:
        for section in domain.sections.values():
            for ctrl in section.controls:
                qs[ctrl.id] = QuestionDef(
                    control_id=ctrl.id,
                    question=f"Has your organization implemented {ctrl.title.lower()}? ({ctrl.reference})",
                    guidance=ctrl.description,
                )
    return qs


_ISO_QUESTIONS = _generate_iso_questions()

# ── Red flag patterns ─────────────────────────────────────────────────────

_ISO_RED_FLAGS = [
    RedFlagPattern(
        pattern="Certification without evidence of operational controls",
        description="ISO 27001 certificate exists but no evidence of operational implementation (risk register, audit reports, training records, access reviews).",
        severity="high",
    ),
    RedFlagPattern(
        pattern="Statement of Applicability gaps",
        description="Controls marked 'not applicable' without justification, or SoA not updated since 2022 restructure.",
        severity="high",
    ),
    RedFlagPattern(
        pattern="Generic policy documents",
        description="Policies that read as templates without organization-specific content, risk context, or defined roles.",
        severity="medium",
    ),
    RedFlagPattern(
        pattern="No management review evidence",
        description="No minutes or records of management review meetings discussing ISMS performance, audit findings, or improvement actions.",
        severity="high",
    ),
    RedFlagPattern(
        pattern="Risk assessment staleness",
        description="Risk assessment or risk treatment plan not updated in over 12 months, or missing trigger-based reviews.",
        severity="medium",
    ),
]

# ── Framework definition ──────────────────────────────────────────────────

ISO27001_DEFINITION = FrameworkDefinition(
    id="iso27001",
    name="ISO 27001",
    version="2022",
    description="ISO/IEC 27001:2022 — Information Security Management System (Annex A controls)",
    domains={
        "organizational": _ORGANIZATIONAL,
        "people": _PEOPLE,
        "physical": _PHYSICAL,
        "technological": _TECHNOLOGICAL,
    },
    dependencies=_ISO_DEPENDENCIES,
    root_cause_clusters=_ISO_ROOT_CAUSE_CLUSTERS,
    scope_questions=_ISO_SCOPE_QUESTIONS,
    questions=_ISO_QUESTIONS,
    red_flag_patterns=_ISO_RED_FLAGS,
)
