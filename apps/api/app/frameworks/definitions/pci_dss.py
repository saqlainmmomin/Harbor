"""
PCI-DSS v4.0 framework definition.

Based on PCI Data Security Standard v4.0, organized by the 6 goals:
  - Build & Maintain a Secure Network and Systems (Req 1-2)
  - Protect Account Data (Req 3-4)
  - Maintain a Vulnerability Management Program (Req 5-6)
  - Implement Strong Access Control Measures (Req 7-9)
  - Regularly Monitor & Test Networks (Req 10-11)
  - Maintain an Information Security Policy (Req 12)

Total: ~64 key controls across 12 requirements.
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

# ── Domain 1: Build & Maintain a Secure Network and Systems ─────────────

_REQ1_NETWORK_SECURITY = Section(
    key="req1_network_security",
    title="Req 1 — Install & Maintain Network Security Controls",
    weight=0.50,
    controls=[
        Control(
            id="PCI.1.1",
            title="Network security controls defined and understood",
            description="Processes and mechanisms for installing and maintaining network security controls are defined and understood by all affected parties.",
            reference="PCI-DSS v4.0 Req 1.1",
            criticality="critical",
            tags=["network-security", "governance", "policy", "documentation"],
        ),
        Control(
            id="PCI.1.2",
            title="Network security controls configured and maintained",
            description="Network security controls (NSCs) are configured and maintained to restrict inbound and outbound traffic to/from the cardholder data environment.",
            reference="PCI-DSS v4.0 Req 1.2",
            criticality="critical",
            tags=["network-security", "firewall", "segmentation", "cde"],
        ),
        Control(
            id="PCI.1.3",
            title="Network access to and from CDE is restricted",
            description="Network access to and from the cardholder data environment is restricted, including controls between trusted and untrusted networks.",
            reference="PCI-DSS v4.0 Req 1.3",
            criticality="critical",
            tags=["network-security", "segmentation", "cde", "access-control"],
        ),
        Control(
            id="PCI.1.4",
            title="Network connections between trusted and untrusted networks controlled",
            description="Network connections between trusted and untrusted networks are controlled, including restrictions on direct public access to the CDE.",
            reference="PCI-DSS v4.0 Req 1.4",
            criticality="high",
            tags=["network-security", "dmz", "perimeter", "access-control"],
        ),
        Control(
            id="PCI.1.5",
            title="Risks to the CDE from computing devices managed",
            description="Risks to the CDE from computing devices that are able to connect to both untrusted networks and the CDE are mitigated.",
            reference="PCI-DSS v4.0 Req 1.5",
            criticality="high",
            tags=["network-security", "endpoint-security", "remote-access", "cde"],
        ),
    ],
)

_REQ2_SECURE_CONFIG = Section(
    key="req2_secure_config",
    title="Req 2 — Apply Secure Configurations to All System Components",
    weight=0.50,
    controls=[
        Control(
            id="PCI.2.1",
            title="Secure configuration processes defined and understood",
            description="Processes and mechanisms for applying secure configurations to all system components are defined and understood.",
            reference="PCI-DSS v4.0 Req 2.1",
            criticality="high",
            tags=["configuration-management", "governance", "policy", "hardening"],
        ),
        Control(
            id="PCI.2.2",
            title="System components configured and managed securely",
            description="System components are configured and managed securely, including removal of unnecessary functionality and changing of vendor defaults.",
            reference="PCI-DSS v4.0 Req 2.2",
            criticality="critical",
            tags=["hardening", "configuration-management", "baseline", "vendor-defaults"],
        ),
        Control(
            id="PCI.2.3",
            title="Wireless environments configured and managed securely",
            description="Wireless environments are configured and managed securely, including changing defaults for wireless vendor settings.",
            reference="PCI-DSS v4.0 Req 2.3",
            criticality="high",
            tags=["wireless-security", "configuration-management", "hardening"],
        ),
        Control(
            id="PCI.2.4",
            title="Vendor default accounts managed",
            description="Vendor default accounts are managed and default passwords are changed before systems go into production.",
            reference="PCI-DSS v4.0 Req 2.2.1 (sub)",
            criticality="critical",
            tags=["hardening", "credential-management", "vendor-defaults"],
        ),
        Control(
            id="PCI.2.5",
            title="Primary functions separated on different servers",
            description="Primary functions requiring different security levels are managed on separate system components to prevent co-mingling of security contexts.",
            reference="PCI-DSS v4.0 Req 2.2.3 (sub)",
            criticality="medium",
            tags=["hardening", "segmentation", "architecture"],
        ),
    ],
)

# ── Domain 2: Protect Account Data ──────────────────────────────────────

_REQ3_STORED_DATA = Section(
    key="req3_stored_data",
    title="Req 3 — Protect Stored Account Data",
    weight=0.55,
    controls=[
        Control(
            id="PCI.3.1",
            title="Stored account data protection processes defined and understood",
            description="Processes and mechanisms for protecting stored account data are defined and understood by all affected parties.",
            reference="PCI-DSS v4.0 Req 3.1",
            criticality="critical",
            tags=["data-protection", "governance", "policy", "storage"],
        ),
        Control(
            id="PCI.3.2",
            title="Storage of account data is kept to a minimum",
            description="Storage of account data is kept to a minimum through implementation of data retention and disposal policies, procedures and processes.",
            reference="PCI-DSS v4.0 Req 3.2",
            criticality="critical",
            tags=["data-retention", "data-minimization", "disposal", "storage"],
        ),
        Control(
            id="PCI.3.3",
            title="Sensitive authentication data not stored after authorization",
            description="Sensitive authentication data (SAD) is not stored after authorization, even if encrypted. This includes full track data, card verification codes/values, and PINs.",
            reference="PCI-DSS v4.0 Req 3.3",
            criticality="critical",
            tags=["sad", "data-protection", "authorization", "storage"],
        ),
        Control(
            id="PCI.3.4",
            title="Access to displays of full PAN is restricted",
            description="Access to displays of full PAN and ability to copy cardholder data are restricted using appropriate controls.",
            reference="PCI-DSS v4.0 Req 3.4",
            criticality="high",
            tags=["data-masking", "pan", "access-control", "display"],
        ),
        Control(
            id="PCI.3.5",
            title="PAN is secured wherever it is stored",
            description="Primary Account Number (PAN) is secured wherever it is stored through strong cryptography, truncation, tokenization, or hashing.",
            reference="PCI-DSS v4.0 Req 3.5",
            criticality="critical",
            tags=["encryption", "tokenization", "pan", "data-protection"],
        ),
        Control(
            id="PCI.3.6",
            title="Cryptographic keys used to protect stored account data are secured",
            description="Cryptographic keys used to protect stored account data are managed securely with defined key management processes.",
            reference="PCI-DSS v4.0 Req 3.6",
            criticality="critical",
            tags=["key-management", "encryption", "cryptography", "data-protection"],
        ),
    ],
)

_REQ4_CRYPTO_TRANSIT = Section(
    key="req4_crypto_transit",
    title="Req 4 — Protect Cardholder Data with Strong Cryptography During Transmission",
    weight=0.45,
    controls=[
        Control(
            id="PCI.4.1",
            title="Transmission protection processes defined and understood",
            description="Processes and mechanisms for protecting cardholder data with strong cryptography during transmission over open, public networks are defined and understood.",
            reference="PCI-DSS v4.0 Req 4.1",
            criticality="critical",
            tags=["encryption", "governance", "policy", "transmission"],
        ),
        Control(
            id="PCI.4.2",
            title="PAN protected with strong cryptography during transmission",
            description="PAN is protected with strong cryptography during transmission over open, public networks and any untrusted network segments.",
            reference="PCI-DSS v4.0 Req 4.2",
            criticality="critical",
            tags=["encryption", "tls", "transmission", "pan"],
        ),
        Control(
            id="PCI.4.3",
            title="Trusted keys and certificates managed",
            description="Certificates used to safeguard PAN during transmission over open, public networks are confirmed as valid and are not expired or revoked.",
            reference="PCI-DSS v4.0 Req 4.2.1 (sub)",
            criticality="high",
            tags=["certificate-management", "tls", "key-management", "transmission"],
        ),
        Control(
            id="PCI.4.4",
            title="PAN protected when sent via end-user messaging technologies",
            description="PAN is secured with strong cryptography whenever it is sent via end-user messaging technologies such as email, instant messaging, SMS, or chat.",
            reference="PCI-DSS v4.0 Req 4.2.2 (sub)",
            criticality="high",
            tags=["encryption", "messaging", "pan", "communication-security"],
        ),
    ],
)

# ── Domain 3: Maintain a Vulnerability Management Program ───────────────

_REQ5_MALWARE = Section(
    key="req5_malware",
    title="Req 5 — Protect All Systems and Networks from Malicious Software",
    weight=0.45,
    controls=[
        Control(
            id="PCI.5.1",
            title="Malware protection processes defined and understood",
            description="Processes and mechanisms for protecting all systems and networks from malicious software are defined and understood.",
            reference="PCI-DSS v4.0 Req 5.1",
            criticality="high",
            tags=["malware-protection", "governance", "policy", "endpoint-security"],
        ),
        Control(
            id="PCI.5.2",
            title="Malicious software is prevented or detected and addressed",
            description="Malicious software (malware) is prevented, or detected and addressed on all system components with anti-malware solutions that are regularly updated.",
            reference="PCI-DSS v4.0 Req 5.2",
            criticality="critical",
            tags=["malware-protection", "anti-malware", "endpoint-security", "detection"],
        ),
        Control(
            id="PCI.5.3",
            title="Anti-malware mechanisms are active and maintained",
            description="Anti-malware mechanisms and processes are active, maintained, and monitored, including ensuring mechanisms cannot be disabled or altered by users.",
            reference="PCI-DSS v4.0 Req 5.3",
            criticality="high",
            tags=["malware-protection", "monitoring", "endpoint-security", "tamper-protection"],
        ),
        Control(
            id="PCI.5.4",
            title="Anti-phishing mechanisms protect against phishing attacks",
            description="Anti-phishing mechanisms protect users against phishing attacks, including both technical controls and user training.",
            reference="PCI-DSS v4.0 Req 5.4",
            criticality="high",
            tags=["phishing", "email-security", "awareness", "social-engineering"],
        ),
    ],
)

_REQ6_SECURE_SYSTEMS = Section(
    key="req6_secure_systems",
    title="Req 6 — Develop & Maintain Secure Systems and Software",
    weight=0.55,
    controls=[
        Control(
            id="PCI.6.1",
            title="Secure development processes defined and understood",
            description="Processes and mechanisms for developing and maintaining secure systems and software are defined and understood.",
            reference="PCI-DSS v4.0 Req 6.1",
            criticality="high",
            tags=["sdlc", "governance", "policy", "secure-development"],
        ),
        Control(
            id="PCI.6.2",
            title="Bespoke and custom software developed securely",
            description="Bespoke and custom software is developed securely, including secure coding practices and code reviews.",
            reference="PCI-DSS v4.0 Req 6.2",
            criticality="critical",
            tags=["sdlc", "secure-coding", "code-review", "development-security"],
        ),
        Control(
            id="PCI.6.3",
            title="Security vulnerabilities identified and addressed",
            description="Security vulnerabilities are identified and addressed through a vulnerability management process including patching and ranking vulnerabilities by risk.",
            reference="PCI-DSS v4.0 Req 6.3",
            criticality="critical",
            tags=["vulnerability-management", "patching", "risk-assessment"],
        ),
        Control(
            id="PCI.6.4",
            title="Public-facing web applications protected against attacks",
            description="Public-facing web applications are protected against attacks via automated technical solutions (WAF) or manual application vulnerability assessment.",
            reference="PCI-DSS v4.0 Req 6.4",
            criticality="critical",
            tags=["web-application-security", "waf", "application-security"],
        ),
        Control(
            id="PCI.6.5",
            title="Changes to all system components managed securely",
            description="Changes to all system components are managed securely using established change control procedures.",
            reference="PCI-DSS v4.0 Req 6.5",
            criticality="high",
            tags=["change-management", "configuration-management", "sdlc"],
        ),
        Control(
            id="PCI.6.6",
            title="Payment page scripts managed and integrity ensured",
            description="Payment page scripts that are loaded and executed in the consumer's browser are managed to ensure their integrity and authorized behavior.",
            reference="PCI-DSS v4.0 Req 6.4.3 (sub)",
            criticality="critical",
            tags=["payment-page", "script-integrity", "skimming-protection", "web-security"],
        ),
    ],
)

# ── Domain 4: Implement Strong Access Control Measures ──────────────────

_REQ7_NEED_TO_KNOW = Section(
    key="req7_need_to_know",
    title="Req 7 — Restrict Access to System Components and Cardholder Data by Business Need to Know",
    weight=0.30,
    controls=[
        Control(
            id="PCI.7.1",
            title="Access control processes defined and understood",
            description="Processes and mechanisms for restricting access to system components and cardholder data by business need to know are defined and understood.",
            reference="PCI-DSS v4.0 Req 7.1",
            criticality="high",
            tags=["access-control", "governance", "policy", "need-to-know"],
        ),
        Control(
            id="PCI.7.2",
            title="Access to system components and data appropriately defined",
            description="Access to system components and data is appropriately defined and assigned based on job function and least privilege.",
            reference="PCI-DSS v4.0 Req 7.2",
            criticality="critical",
            tags=["access-control", "least-privilege", "rbac", "authorization"],
        ),
        Control(
            id="PCI.7.3",
            title="Access to system components and data managed via access control system",
            description="Access to system components and data is managed via an access control system(s) that restricts access based on user need to know and covers all system components.",
            reference="PCI-DSS v4.0 Req 7.3",
            criticality="critical",
            tags=["access-control", "access-control-system", "enforcement", "automation"],
        ),
        Control(
            id="PCI.7.4",
            title="Access reviewed periodically",
            description="Access to system components and cardholder data is reviewed periodically (at least every six months) to ensure access remains appropriate.",
            reference="PCI-DSS v4.0 Req 7.2.5 (sub)",
            criticality="high",
            tags=["access-review", "access-control", "periodic-review", "governance"],
        ),
    ],
)

_REQ8_AUTHENTICATION = Section(
    key="req8_authentication",
    title="Req 8 — Identify Users and Authenticate Access to System Components",
    weight=0.40,
    controls=[
        Control(
            id="PCI.8.1",
            title="User identification and authentication processes defined",
            description="Processes and mechanisms for identifying users and authenticating access to system components are defined and understood.",
            reference="PCI-DSS v4.0 Req 8.1",
            criticality="high",
            tags=["authentication", "governance", "policy", "identity-management"],
        ),
        Control(
            id="PCI.8.2",
            title="User identification and related accounts managed throughout lifecycle",
            description="User identification and related accounts for users and administrators are strictly managed throughout an account's lifecycle, including unique IDs for all users.",
            reference="PCI-DSS v4.0 Req 8.2",
            criticality="critical",
            tags=["identity-management", "unique-id", "lifecycle-management", "account-management"],
        ),
        Control(
            id="PCI.8.3",
            title="Strong authentication for users and administrators established",
            description="Strong authentication for users and administrators is established and managed, including minimum password complexity, lockout mechanisms, and session management.",
            reference="PCI-DSS v4.0 Req 8.3",
            criticality="critical",
            tags=["authentication", "password-policy", "mfa", "session-management"],
        ),
        Control(
            id="PCI.8.4",
            title="Multi-factor authentication implemented",
            description="Multi-factor authentication (MFA) is implemented to secure access into the CDE and for all non-console administrative access.",
            reference="PCI-DSS v4.0 Req 8.4",
            criticality="critical",
            tags=["mfa", "authentication", "cde", "admin-access"],
        ),
        Control(
            id="PCI.8.5",
            title="Multi-factor authentication systems configured properly",
            description="Multi-factor authentication systems are configured to prevent misuse, including ensuring MFA cannot be bypassed and at least two different types of factors are used.",
            reference="PCI-DSS v4.0 Req 8.5",
            criticality="high",
            tags=["mfa", "authentication", "configuration", "anti-bypass"],
        ),
        Control(
            id="PCI.8.6",
            title="Application and system account authentication managed",
            description="Use of application and system accounts and associated authentication factors is strictly managed, including controls for service accounts and shared credentials.",
            reference="PCI-DSS v4.0 Req 8.6",
            criticality="high",
            tags=["service-accounts", "authentication", "credential-management", "system-accounts"],
        ),
    ],
)

_REQ9_PHYSICAL_ACCESS = Section(
    key="req9_physical_access",
    title="Req 9 — Restrict Physical Access to Cardholder Data",
    weight=0.30,
    controls=[
        Control(
            id="PCI.9.1",
            title="Physical access control processes defined and understood",
            description="Processes and mechanisms for restricting physical access to cardholder data are defined and understood.",
            reference="PCI-DSS v4.0 Req 9.1",
            criticality="high",
            tags=["physical-security", "governance", "policy", "cde"],
        ),
        Control(
            id="PCI.9.2",
            title="Physical access controls manage entry into facilities and sensitive areas",
            description="Physical access controls manage entry into facilities and into areas where cardholder data is present, including badge systems and visitor management.",
            reference="PCI-DSS v4.0 Req 9.2",
            criticality="critical",
            tags=["physical-security", "access-control", "visitor-management", "entry-controls"],
        ),
        Control(
            id="PCI.9.3",
            title="Physical access for personnel and visitors authorized and managed",
            description="Physical access for personnel and visitors is authorized and managed, including distinguishing between on-site personnel and visitors.",
            reference="PCI-DSS v4.0 Req 9.3",
            criticality="high",
            tags=["physical-security", "visitor-management", "badges", "authorization"],
        ),
        Control(
            id="PCI.9.4",
            title="Media with cardholder data securely stored, accessed, distributed, and destroyed",
            description="Media with cardholder data is securely stored, accessed, distributed, and destroyed when no longer needed.",
            reference="PCI-DSS v4.0 Req 9.4",
            criticality="critical",
            tags=["media-handling", "data-protection", "secure-disposal", "physical-security"],
        ),
    ],
)

# ── Domain 5: Regularly Monitor & Test Networks ─────────────────────────

_REQ10_LOGGING = Section(
    key="req10_logging",
    title="Req 10 — Log and Monitor All Access to System Components and Cardholder Data",
    weight=0.50,
    controls=[
        Control(
            id="PCI.10.1",
            title="Logging and monitoring processes defined and understood",
            description="Processes and mechanisms for logging and monitoring all access to system components and cardholder data are defined and understood.",
            reference="PCI-DSS v4.0 Req 10.1",
            criticality="high",
            tags=["logging", "monitoring", "governance", "policy"],
        ),
        Control(
            id="PCI.10.2",
            title="Audit logs capture user activities and security events",
            description="Audit logs are implemented to support the detection, alerting, and analysis of anomalous activity and potential compromise, including logging user access and admin actions.",
            reference="PCI-DSS v4.0 Req 10.2",
            criticality="critical",
            tags=["logging", "audit-trail", "detection", "security-events"],
        ),
        Control(
            id="PCI.10.3",
            title="Audit logs protected from destruction and unauthorized modifications",
            description="Audit logs are protected from destruction and unauthorized modifications through access controls and integrity monitoring.",
            reference="PCI-DSS v4.0 Req 10.3",
            criticality="high",
            tags=["logging", "integrity", "access-control", "tamper-protection"],
        ),
        Control(
            id="PCI.10.4",
            title="Audit logs reviewed to identify anomalies or suspicious activity",
            description="Audit logs are reviewed to identify anomalies or suspicious activity, with automated mechanisms to perform log reviews.",
            reference="PCI-DSS v4.0 Req 10.4",
            criticality="critical",
            tags=["logging", "log-review", "siem", "monitoring", "anomaly-detection"],
        ),
        Control(
            id="PCI.10.5",
            title="Time-synchronization mechanisms support consistent audit logs",
            description="Time-synchronization technology is implemented and kept current to synchronize clocks on all critical system components.",
            reference="PCI-DSS v4.0 Req 10.6",
            criticality="medium",
            tags=["logging", "time-synchronization", "ntp", "infrastructure"],
        ),
    ],
)

_REQ11_SECURITY_TESTING = Section(
    key="req11_security_testing",
    title="Req 11 — Test Security of Systems and Networks Regularly",
    weight=0.50,
    controls=[
        Control(
            id="PCI.11.1",
            title="Security testing processes defined and understood",
            description="Processes and mechanisms for regularly testing security of systems and networks are defined and understood.",
            reference="PCI-DSS v4.0 Req 11.1",
            criticality="high",
            tags=["security-testing", "governance", "policy"],
        ),
        Control(
            id="PCI.11.2",
            title="Wireless access points identified and monitored",
            description="Authorized and unauthorized wireless access points are identified and monitored, and unauthorized wireless access points are addressed.",
            reference="PCI-DSS v4.0 Req 11.2",
            criticality="high",
            tags=["wireless-security", "monitoring", "rogue-detection"],
        ),
        Control(
            id="PCI.11.3",
            title="Vulnerabilities identified, prioritized, and addressed",
            description="External and internal vulnerabilities are regularly identified, prioritized, and addressed through internal and external vulnerability scans.",
            reference="PCI-DSS v4.0 Req 11.3",
            criticality="critical",
            tags=["vulnerability-scanning", "vulnerability-management", "risk-assessment"],
        ),
        Control(
            id="PCI.11.4",
            title="Penetration testing is regularly performed",
            description="External and internal penetration testing is regularly performed and exploitable vulnerabilities and security weaknesses are corrected.",
            reference="PCI-DSS v4.0 Req 11.4",
            criticality="critical",
            tags=["penetration-testing", "security-testing", "remediation"],
        ),
        Control(
            id="PCI.11.5",
            title="Network intrusions and file changes detected and responded to",
            description="Network intrusions and unexpected file changes are detected and responded to using intrusion-detection/prevention techniques and change-detection mechanisms.",
            reference="PCI-DSS v4.0 Req 11.5",
            criticality="critical",
            tags=["ids-ips", "file-integrity-monitoring", "detection", "incident-response"],
        ),
    ],
)

# ── Domain 6: Maintain an Information Security Policy ───────────────────

_REQ12_SECURITY_POLICY = Section(
    key="req12_security_policy",
    title="Req 12 — Support Information Security with Organizational Policies and Programs",
    weight=1.0,
    controls=[
        Control(
            id="PCI.12.1",
            title="Comprehensive information security policy established",
            description="A comprehensive information security policy that governs and provides direction for protection of the entity's information assets is known and current.",
            reference="PCI-DSS v4.0 Req 12.1",
            criticality="critical",
            tags=["policy", "governance", "information-security", "documentation"],
        ),
        Control(
            id="PCI.12.2",
            title="Acceptable use policies for end-user technologies defined",
            description="Acceptable use policies for end-user technologies are defined and implemented.",
            reference="PCI-DSS v4.0 Req 12.2",
            criticality="medium",
            tags=["acceptable-use", "policy", "end-user", "governance"],
        ),
        Control(
            id="PCI.12.3",
            title="Risks to the CDE formally identified, evaluated, and managed",
            description="Risks to the cardholder data environment are formally identified, evaluated, and managed through a targeted risk analysis process.",
            reference="PCI-DSS v4.0 Req 12.3",
            criticality="critical",
            tags=["risk-assessment", "risk-management", "cde", "governance"],
        ),
        Control(
            id="PCI.12.4",
            title="PCI DSS compliance managed",
            description="PCI DSS compliance is managed, including assignment of responsibilities and a formal charter for a PCI DSS compliance program.",
            reference="PCI-DSS v4.0 Req 12.4",
            criticality="high",
            tags=["compliance-program", "governance", "roles-responsibilities"],
        ),
        Control(
            id="PCI.12.5",
            title="PCI DSS scope documented and validated",
            description="PCI DSS scope is documented, confirmed, and managed, with scope validation performed at least annually and upon significant changes.",
            reference="PCI-DSS v4.0 Req 12.5",
            criticality="critical",
            tags=["scope-validation", "cde", "documentation", "governance"],
        ),
        Control(
            id="PCI.12.6",
            title="Security awareness education is ongoing activity",
            description="Security awareness education is an ongoing activity for all personnel, including training on threats, responsibilities, and acceptable use.",
            reference="PCI-DSS v4.0 Req 12.6",
            criticality="high",
            tags=["awareness", "training", "security-culture", "people"],
        ),
        Control(
            id="PCI.12.7",
            title="Personnel are screened to reduce risks from insider threats",
            description="Personnel are screened to reduce risks of insider threats through background checks prior to hire.",
            reference="PCI-DSS v4.0 Req 12.7",
            criticality="medium",
            tags=["screening", "background-check", "people", "insider-threat"],
        ),
        Control(
            id="PCI.12.8",
            title="Risk to information assets from third-party relationships managed",
            description="Risk to information assets associated with third-party service provider (TPSP) relationships is managed through due diligence, agreements, and monitoring.",
            reference="PCI-DSS v4.0 Req 12.8",
            criticality="critical",
            tags=["third-party", "tpsp", "vendor-management", "risk-management"],
        ),
        Control(
            id="PCI.12.9",
            title="Third-party service providers support PCI DSS compliance",
            description="Third-party service providers (TPSPs) support their customers' PCI DSS compliance through written agreements acknowledging responsibilities.",
            reference="PCI-DSS v4.0 Req 12.9",
            criticality="high",
            tags=["third-party", "tpsp", "compliance", "contracts"],
        ),
        Control(
            id="PCI.12.10",
            title="Security incidents and suspected compromises responded to immediately",
            description="Security incidents and suspected security compromises are responded to immediately through a formally established incident response plan.",
            reference="PCI-DSS v4.0 Req 12.10",
            criticality="critical",
            tags=["incident-response", "incident-response-plan", "breach-management"],
        ),
    ],
)

# ── Assemble domains ────────────────────────────────────────────────────

_SECURE_NETWORK = Domain(
    key="secure_network",
    title="Build & Maintain a Secure Network and Systems",
    weight=0.20,
    sections={
        "req1_network_security": _REQ1_NETWORK_SECURITY,
        "req2_secure_config": _REQ2_SECURE_CONFIG,
    },
)

_PROTECT_DATA = Domain(
    key="protect_data",
    title="Protect Account Data",
    weight=0.20,
    sections={
        "req3_stored_data": _REQ3_STORED_DATA,
        "req4_crypto_transit": _REQ4_CRYPTO_TRANSIT,
    },
)

_VULN_MANAGEMENT = Domain(
    key="vuln_management",
    title="Maintain a Vulnerability Management Program",
    weight=0.15,
    sections={
        "req5_malware": _REQ5_MALWARE,
        "req6_secure_systems": _REQ6_SECURE_SYSTEMS,
    },
)

_ACCESS_CONTROL = Domain(
    key="access_control",
    title="Implement Strong Access Control Measures",
    weight=0.20,
    sections={
        "req7_need_to_know": _REQ7_NEED_TO_KNOW,
        "req8_authentication": _REQ8_AUTHENTICATION,
        "req9_physical_access": _REQ9_PHYSICAL_ACCESS,
    },
)

_MONITOR_TEST = Domain(
    key="monitor_test",
    title="Regularly Monitor & Test Networks",
    weight=0.15,
    sections={
        "req10_logging": _REQ10_LOGGING,
        "req11_security_testing": _REQ11_SECURITY_TESTING,
    },
)

_SECURITY_POLICY = Domain(
    key="security_policy",
    title="Maintain an Information Security Policy",
    weight=0.10,
    sections={
        "req12_security_policy": _REQ12_SECURITY_POLICY,
    },
)

# ── Dependency DAG ──────────────────────────────────────────────────────

_PCI_DEPENDENCIES: dict[str, list[str]] = {
    # Network controls depend on policy
    "PCI.1.2": ["PCI.1.1"],  # NSC config needs defined processes
    "PCI.1.3": ["PCI.1.2"],  # CDE restriction needs NSC configuration
    # Secure config chain
    "PCI.2.2": ["PCI.2.1"],  # Secure config needs defined processes
    "PCI.2.4": ["PCI.2.2"],  # Default account mgmt needs secure config baseline
    # Stored data protection chain
    "PCI.3.5": ["PCI.3.1"],  # PAN encryption needs defined processes
    "PCI.3.6": ["PCI.3.5"],  # Key management needs encryption implemented
    # Crypto transit chain
    "PCI.4.2": ["PCI.4.1"],  # PAN encryption in transit needs defined processes
    "PCI.4.3": ["PCI.4.2"],  # Certificate management needs encryption
    # Vulnerability management
    "PCI.6.2": ["PCI.6.1"],  # Secure coding needs defined processes
    "PCI.6.4": ["PCI.6.3"],  # WAF protection needs vuln management
    "PCI.6.6": ["PCI.6.4"],  # Payment page scripts need web app protection
    # Access control chain
    "PCI.7.2": ["PCI.7.1"],  # Access definition needs defined processes
    "PCI.7.3": ["PCI.7.2"],  # Access system needs defined access
    "PCI.7.4": ["PCI.7.3"],  # Access review needs access system
    # Authentication chain
    "PCI.8.3": ["PCI.8.2"],  # Strong auth needs account lifecycle
    "PCI.8.4": ["PCI.8.3"],  # MFA needs authentication baseline
    "PCI.8.5": ["PCI.8.4"],  # MFA configuration needs MFA implemented
    # Logging chain
    "PCI.10.2": ["PCI.10.1"],  # Audit logs need defined processes
    "PCI.10.4": ["PCI.10.2"],  # Log review needs logs captured
    # Testing chain
    "PCI.11.3": ["PCI.11.1"],  # Vuln scanning needs defined processes
    "PCI.11.4": ["PCI.11.3"],  # Pen testing builds on vuln scanning
    # Policy dependencies
    "PCI.12.3": ["PCI.12.1"],  # Risk assessment needs policy
    "PCI.12.5": ["PCI.12.3"],  # Scope validation needs risk assessment
    "PCI.12.10": ["PCI.12.1"],  # Incident response needs policy
}

# ── Root cause clusters ─────────────────────────────────────────────────

_PCI_ROOT_CAUSE_CLUSTERS: dict[str, dict] = {
    "policy": {
        "title": "PCI DSS Policy & Documentation Program",
        "description": "Develop, formalize and publish PCI DSS-specific policies covering all 12 requirements, acceptable use, and risk management.",
        "typical_requirements": [
            "PCI.1.1", "PCI.2.1", "PCI.3.1", "PCI.4.1", "PCI.7.1",
            "PCI.12.1", "PCI.12.2",
        ],
    },
    "people": {
        "title": "Security Awareness & Training Program",
        "description": "Implement ongoing security awareness training, background screening, and role-specific PCI DSS education for all personnel.",
        "typical_requirements": [
            "PCI.12.6", "PCI.12.7", "PCI.5.4", "PCI.9.3",
        ],
    },
    "process": {
        "title": "Operational Security Process Program",
        "description": "Establish repeatable operational processes for access management, change control, log review, vulnerability management, and third-party oversight.",
        "typical_requirements": [
            "PCI.6.5", "PCI.7.4", "PCI.8.2", "PCI.10.4", "PCI.12.5",
            "PCI.12.8",
        ],
    },
    "technology": {
        "title": "Security Technology & Controls Implementation",
        "description": "Implement or upgrade technical security controls including encryption, network segmentation, anti-malware, MFA, logging, WAF, and intrusion detection.",
        "typical_requirements": [
            "PCI.1.2", "PCI.3.5", "PCI.4.2", "PCI.5.2", "PCI.6.4",
            "PCI.8.4", "PCI.10.2", "PCI.11.5",
        ],
    },
    "governance": {
        "title": "PCI DSS Compliance Governance Program",
        "description": "Establish management oversight, PCI DSS compliance charter, scope validation, risk assessment, and third-party service provider management.",
        "typical_requirements": [
            "PCI.12.3", "PCI.12.4", "PCI.12.5", "PCI.12.8", "PCI.12.9",
        ],
    },
}

# ── Scope questions ─────────────────────────────────────────────────────

_PCI_SCOPE_QUESTIONS = [
    ScopeQuestion(
        id="PCI.SCP.1",
        question="How is your cardholder data environment (CDE) structured?",
        help_text="The CDE includes all systems that store, process, or transmit cardholder data, plus any connected systems.",
        type="single_select",
        options=[
            {"value": "flat_network", "label": "Flat network — no segmentation from CDE"},
            {"value": "segmented", "label": "Segmented — CDE isolated via network controls"},
            {"value": "outsourced", "label": "Fully outsourced — no cardholder data on-premises"},
            {"value": "undefined", "label": "Not yet defined or documented"},
        ],
    ),
    ScopeQuestion(
        id="PCI.SCP.2",
        question="What payment channels does your organization use?",
        help_text="Different payment channels affect which PCI DSS requirements apply and the complexity of your CDE.",
        type="multi_select",
        options=[
            {"value": "ecommerce", "label": "E-commerce (card-not-present online)"},
            {"value": "pos", "label": "Point-of-sale terminals (card-present)"},
            {"value": "moto", "label": "Mail-order / telephone-order (MOTO)"},
            {"value": "mobile", "label": "Mobile payments"},
            {"value": "recurring", "label": "Recurring / subscription billing"},
        ],
    ),
    ScopeQuestion(
        id="PCI.SCP.3",
        question="Do you use third-party service providers for payment processing or cardholder data handling?",
        help_text="TPSPs include payment gateways, processors, hosting providers, and managed security service providers handling cardholder data.",
        type="single_select",
        options=[
            {"value": "payment_gateway", "label": "Yes — payment gateway / processor only"},
            {"value": "multiple_tpsp", "label": "Yes — multiple TPSPs (hosting, tokenization, etc.)"},
            {"value": "no_tpsp", "label": "No — all processing handled in-house"},
        ],
    ),
    ScopeQuestion(
        id="PCI.SCP.4",
        question="What is your current PCI DSS validation level and SAQ type?",
        help_text="Your validation level is determined by annual transaction volume. SAQ type determines scope of assessment.",
        type="single_select",
        options=[
            {"value": "level1", "label": "Level 1 (>6M transactions) — ROC required"},
            {"value": "level2", "label": "Level 2 (1-6M transactions) — SAQ or ROC"},
            {"value": "level3_4", "label": "Level 3/4 (<1M transactions) — SAQ"},
            {"value": "unknown", "label": "Not sure / not yet determined"},
        ],
    ),
]

# ── Question text ───────────────────────────────────────────────────────
# One question per control, following the same pattern as ISO 27001

_PCI_QUESTIONS: dict[str, QuestionDef] = {}


def _generate_pci_questions() -> dict[str, QuestionDef]:
    """Generate question definitions for all PCI-DSS controls."""
    qs = {}
    for domain in [_SECURE_NETWORK, _PROTECT_DATA, _VULN_MANAGEMENT, _ACCESS_CONTROL, _MONITOR_TEST, _SECURITY_POLICY]:
        for section in domain.sections.values():
            for ctrl in section.controls:
                qs[ctrl.id] = QuestionDef(
                    control_id=ctrl.id,
                    question=f"Has your organization implemented {ctrl.title.lower()}? ({ctrl.reference})",
                    guidance=ctrl.description,
                )
    return qs


_PCI_QUESTIONS = _generate_pci_questions()

# ── Red flag patterns ───────────────────────────────────────────────────

_PCI_RED_FLAGS = [
    RedFlagPattern(
        pattern="SAQ self-assessment without supporting evidence",
        description="Entity completed SAQ as compliant but cannot produce evidence of implemented controls (firewall rules, scan reports, access lists, training records).",
        severity="high",
    ),
    RedFlagPattern(
        pattern="Flat network with no CDE segmentation",
        description="Cardholder data environment not segmented from general corporate network, putting entire network in scope and dramatically increasing risk surface.",
        severity="high",
    ),
    RedFlagPattern(
        pattern="Sensitive authentication data (SAD) stored post-authorization",
        description="Full track data, CVV/CVC, or PIN blocks found stored after transaction authorization — a direct violation regardless of encryption.",
        severity="high",
    ),
    RedFlagPattern(
        pattern="Missing or stale vulnerability scans",
        description="ASV scans not conducted quarterly, or internal scans not performed after significant changes. No evidence of passing ASV scan in last quarter.",
        severity="high",
    ),
    RedFlagPattern(
        pattern="Shared or generic accounts accessing the CDE",
        description="Multiple users sharing credentials or using generic accounts (e.g., 'admin', 'operator') to access cardholder data environment, defeating audit trail.",
        severity="high",
    ),
    RedFlagPattern(
        pattern="No MFA for administrative or remote CDE access",
        description="Administrative access to CDE or remote access lacks multi-factor authentication, relying solely on passwords.",
        severity="high",
    ),
]

# ── Framework definition ────────────────────────────────────────────────

PCI_DSS_DEFINITION = FrameworkDefinition(
    id="pci_dss",
    name="PCI-DSS",
    version="4.0",
    description="PCI Data Security Standard v4.0 — Payment Card Industry Data Security Standard for protecting cardholder data",
    domains={
        "secure_network": _SECURE_NETWORK,
        "protect_data": _PROTECT_DATA,
        "vuln_management": _VULN_MANAGEMENT,
        "access_control": _ACCESS_CONTROL,
        "monitor_test": _MONITOR_TEST,
        "security_policy": _SECURITY_POLICY,
    },
    dependencies=_PCI_DEPENDENCIES,
    root_cause_clusters=_PCI_ROOT_CAUSE_CLUSTERS,
    scope_questions=_PCI_SCOPE_QUESTIONS,
    questions=_PCI_QUESTIONS,
    red_flag_patterns=_PCI_RED_FLAGS,
)
